"""
Leopards Courier integration (Pakistan-wide delivery).

Uses Leopards' Merchant API (booking + tracking). Real endpoints/field names come
from your Leopards merchant dashboard once your account is approved — the ones
below match Leopards' publicly documented Merchant API as of this writing, but
courier APIs occasionally change field names, so if a real booking call fails,
check your Leopards merchant portal for the current field list and adjust the
payload in `book_shipment()` below.

MOCK MODE: if LEOPARDS_API_KEY / LEOPARDS_API_PASSWORD are blank (the default),
booking never calls the real Leopards servers — it just generates a realistic-
looking local tracking number so the whole "book courier → see tracking number
→ mark shipped" flow works end-to-end for demos, before you have real credentials.
"""
import random
import string
from datetime import datetime

import httpx

from app.config import settings
from app.models import Order


class LeopardsError(Exception):
    pass


def _mock_tracking_number() -> str:
    return "MOCK-" + "".join(random.choices(string.digits, k=10))


async def book_shipment(order: Order) -> dict:
    """
    Books a COD shipment for this order. Returns
    {"tracking_number": str, "status": str, "mock": bool}.
    Raises LeopardsError on a real API failure.
    """
    if not settings.leopards_configured:
        return {
            "tracking_number": _mock_tracking_number(),
            "status": "booked (mock — add LEOPARDS_API_KEY/PASSWORD in .env for real bookings)",
            "mock": True,
        }

    payload = {
        "api_key": settings.LEOPARDS_API_KEY,
        "api_password": settings.LEOPARDS_API_PASSWORD,
        "booked_packet_weight": 1,
        "booked_packet_no_piece": 1,
        "origin_city": settings.LEOPARDS_ORIGIN_CITY,
        "destination_city": _guess_city(order.customer_address),
        "shipment_id": order.order_number,
        "order_id": order.order_number,
        "consignment_bill_amount": round(order.total_amount),
        "cod_amount": round(order.total_amount),
        "shipment_name": order.customer_name,
        "shipment_email": "",
        "shipment_phone": order.customer_phone,
        "shipment_address": order.customer_address or "",
        "special_instructions": f"AA Car Traders order {order.order_number}",
        "shipping_mode": settings.LEOPARDS_SHIPPING_MODE,
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(settings.LEOPARDS_BOOKING_URL, data=payload)
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPError as exc:
        raise LeopardsError(f"Could not reach Leopards Courier: {exc}") from exc
    except ValueError as exc:
        raise LeopardsError("Leopards Courier returned an unexpected (non-JSON) response.") from exc

    # Leopards' bookPacket response typically nests the tracking number under
    # a "packet_list" array — adjust here if your account's response shape differs.
    track_number = None
    if isinstance(data, dict):
        packets = data.get("packet_list") or data.get("data") or []
        if isinstance(packets, list) and packets:
            track_number = packets[0].get("track_number") or packets[0].get("cn_number")
        track_number = track_number or data.get("track_number")

    if not track_number:
        raise LeopardsError(f"Leopards Courier didn't return a tracking number: {data}")

    return {"tracking_number": track_number, "status": "booked", "mock": False}


async def track_shipment(tracking_number: str) -> dict:
    """Returns {"status": str, "raw": dict|None}. Mock tracking numbers get a canned status."""
    if tracking_number.startswith("MOCK-"):
        return {"status": "In transit (mock tracking — no real courier booked yet)", "raw": None}

    if not settings.leopards_configured:
        return {"status": "Tracking unavailable — Leopards API credentials not configured.", "raw": None}

    payload = {
        "api_key": settings.LEOPARDS_API_KEY,
        "api_password": settings.LEOPARDS_API_PASSWORD,
        "track_numbers": tracking_number,
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(settings.LEOPARDS_TRACKING_URL, data=payload)
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPError as exc:
        raise LeopardsError(f"Could not reach Leopards Courier: {exc}") from exc
    except ValueError as exc:
        raise LeopardsError("Leopards Courier returned an unexpected (non-JSON) response.") from exc

    status = "Unknown"
    if isinstance(data, list) and data:
        status = data[0].get("booked_packet_status") or data[0].get("status") or status
    elif isinstance(data, dict):
        status = data.get("booked_packet_status") or data.get("status") or status

    return {"status": status, "raw": data}


def _guess_city(address: str | None) -> str:
    """Best-effort city guess from a free-text address; falls back to the origin city.
    Replace with a proper city dropdown in the checkout form for reliable booking."""
    if not address:
        return settings.LEOPARDS_ORIGIN_CITY
    common_cities = [
        "Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan",
        "Peshawar", "Quetta", "Sialkot", "Gujranwala", "Hyderabad", "Sargodha",
    ]
    lower = address.lower()
    for city in common_cities:
        if city.lower() in lower:
            return city
    return settings.LEOPARDS_ORIGIN_CITY
