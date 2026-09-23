"""
AI Adviser (RAG-lite chatbot) + Visual Search.

Chat: retrieves the most relevant catalog products for the user's message
/ car details (simple keyword retrieval over the DB — swap for a vector
store later without changing the route contract), then asks the LLM
(Groq by default, or OpenAI / Gemini, per AI_PROVIDER) to give a grounded recommendation.
If no API key is configured, falls back to a deterministic catalog-match
reply so the endpoint always works out of the box.

Visual search: accepts an uploaded car photo and, since real image
embeddings need an external model, currently matches on filename/EXIF-free
heuristics + optional vehicle hint form fields. Wire in CLIP/Gemini Vision
here for production-grade matching.
"""
import logging

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import Product, User
from app.schemas import AIChatRequest, AIChatResponse, VisualSearchResponse, ProductOutPublic

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai", tags=["ai"])


def _retrieve_candidates(db: Session, message: str, make: str | None, model: str | None, limit: int = 6):
    q = db.query(Product).options(joinedload(Product.category)).filter(Product.is_active == True)  # noqa: E712
    if make:
        q = q.filter(Product.vehicle_make.ilike(f"%{make}%"))
    if model:
        q = q.filter(Product.vehicle_model.ilike(f"%{model}%"))
    terms = [t for t in message.lower().split() if len(t) > 2][:6]
    if terms:
        clauses = []
        for t in terms:
            like = f"%{t}%"
            clauses += [Product.title.ilike(like), Product.description.ilike(like), Product.search_keywords.ilike(like)]
        q = q.filter(or_(*clauses))
    results = q.limit(limit).all()
    if not results:
        # widen: drop keyword filter, keep vehicle filter only
        q2 = db.query(Product).options(joinedload(Product.category)).filter(Product.is_active == True)  # noqa: E712
        if make:
            q2 = q2.filter(Product.vehicle_make.ilike(f"%{make}%"))
        if model:
            q2 = q2.filter(Product.vehicle_model.ilike(f"%{model}%"))
        results = q2.limit(limit).all()
    return results


SYSTEM_PROMPT = (
    "You are the AA Car Traders AI Adviser. Recommend car modification "
    "parts ONLY from the catalog context given. Be concise, friendly, and "
    "mention exact product titles and prices from the context. Reply in the same "
    "language the customer writes in (English, Urdu, or Roman Urdu)."
)


def _openai_compatible_chat(api_key: str, model: str, prompt: str, base_url: str | None = None) -> str | None:
    """Groq exposes an OpenAI-compatible API, so one client serves both."""
    from openai import OpenAI
    client = OpenAI(api_key=api_key, base_url=base_url, timeout=20)
    kwargs: dict = {}
    if model.startswith("openai/gpt-oss"):
        # gpt-oss models "think" first and thinking tokens count toward max_tokens;
        # keep reasoning short so the visible answer is never cut off / empty.
        kwargs["extra_body"] = {"reasoning_effort": "low"}
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        max_tokens=1024,
        **kwargs,
    )
    return (resp.choices[0].message.content or "").strip() or None


def _call_llm(prompt: str) -> str | None:
    provider = settings.AI_PROVIDER.lower()
    try:
        if provider == "groq" and settings.GROQ_API_KEY:
            return _openai_compatible_chat(
                settings.GROQ_API_KEY, settings.GROQ_MODEL, prompt,
                base_url="https://api.groq.com/openai/v1",
            )
        if provider == "openai" and settings.OPENAI_API_KEY:
            return _openai_compatible_chat(settings.OPENAI_API_KEY, settings.OPENAI_MODEL, prompt)
        if provider == "gemini" and settings.GEMINI_API_KEY:
            import httpx
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
            )
            r = httpx.post(url, json={"contents": [{"parts": [{"text": prompt}]}]}, timeout=20)
            r.raise_for_status()
            return r.json()["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        logger.exception("AI provider '%s' call failed; using catalog fallback", provider)
    return None


@router.post("/chat", response_model=AIChatResponse)
def ai_chat(payload: AIChatRequest, db: Session = Depends(get_db), user: User | None = Depends(get_current_user)):
    candidates = _retrieve_candidates(db, payload.message, payload.vehicle_make, payload.vehicle_model)

    catalog_context = "\n".join(
        f"- {p.title} | {p.category.name if p.category else ''} | PKR {p.retail_price:,.0f} "
        f"| Fits: {p.vehicle_make} {p.vehicle_model} ({p.vehicle_year_from or '-'}-{p.vehicle_year_to or '-'})"
        for p in candidates
    ) or "No close matches found in catalog."

    vehicle_line = ""
    if payload.vehicle_make or payload.vehicle_model:
        vehicle_line = f"Customer's car: {payload.vehicle_make or ''} {payload.vehicle_model or ''} {payload.vehicle_year or ''}\n"

    prompt = (
        f"{vehicle_line}Customer question: {payload.message}\n\n"
        f"Relevant catalog items:\n{catalog_context}\n\n"
        "Recommend the best matching part(s), explain briefly why they fit, and suggest they tap "
        "'Buy on WhatsApp' on the product to order."
    )

    llm_reply = _call_llm(prompt)
    if llm_reply is None:
        if candidates:
            lines = [f"Based on your car, here's what I'd recommend from our catalog:"]
            for p in candidates[:4]:
                lines.append(f"• {p.title} — PKR {p.retail_price:,.0f} ({p.category.name if p.category else ''})")
            lines.append("Tap 'Buy on WhatsApp' on any item to order directly, or ask me for more options.")
            llm_reply = "\n".join(lines)
        else:
            llm_reply = (
                "I couldn't find an exact match in our catalog yet. Tell me your car's make, model, "
                "and year, and what modification you're after (e.g. body kit, LED lights, spoiler) "
                "and I'll find the closest fit."
            )

    return AIChatResponse(
        reply=llm_reply,
        recommended_product_ids=[p.id for p in candidates],
        recommended_products=[ProductOutPublic.model_validate(p) for p in candidates[:4]],
    )


@router.post("/visual-search", response_model=VisualSearchResponse)
async def visual_search(
    image: UploadFile = File(...),
    vehicle_make: str | None = Form(None),
    vehicle_model: str | None = Form(None),
    db: Session = Depends(get_db),
):
    # Production upgrade path: run `image` through a CLIP/vision embedding model,
    # compare against stored product-image embeddings (pgvector / FAISS), and
    # return nearest neighbours. For now we ground the match on the vehicle hint
    # fields (typically pre-filled by the frontend from EXIF or user selection).
    await image.read()  # consume upload; not persisted in this stub

    q = db.query(Product).options(joinedload(Product.category)).filter(Product.is_active == True)  # noqa: E712
    if vehicle_make:
        q = q.filter(Product.vehicle_make.ilike(f"%{vehicle_make}%"))
    if vehicle_model:
        q = q.filter(Product.vehicle_model.ilike(f"%{vehicle_model}%"))
    matches = q.limit(8).all()

    note = (
        "Matched by vehicle details provided alongside the photo."
        if (vehicle_make or vehicle_model)
        else "Upload with make/model for sharper matches — showing popular exterior mods for now."
    )
    if not matches:
        matches = db.query(Product).options(joinedload(Product.category)).filter(Product.is_active == True).limit(8).all()  # noqa: E712

    return VisualSearchResponse(matches=[ProductOutPublic.model_validate(p) for p in matches], note=note)
