"""
Admin-only upload endpoint for product photos / videos / banner images.
Files land in MEDIA_DIR (served at /media/...). Used by the drag-and-drop
uploader in the admin Products page.
"""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from app.config import settings
from app.deps import require_admin
from app.models import User

router = APIRouter(prefix="/api/media", tags=["media"])

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
VIDEO_EXT = {".mp4", ".webm", ".mov", ".m4v"}
CHUNK = 1024 * 1024


@router.post("/upload")
async def upload_media(file: UploadFile = File(...), _admin: User = Depends(require_admin)):
    ext = Path(file.filename or "").suffix.lower()
    if ext in IMAGE_EXT:
        kind, limit_mb = "image", settings.MAX_IMAGE_MB
    elif ext in VIDEO_EXT:
        kind, limit_mb = "video", settings.MAX_VIDEO_MB
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use JPG, PNG, WEBP, GIF, MP4, WEBM or MOV.")

    folder = settings.media_path / "products"
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    dest = folder / name

    size, limit = 0, limit_mb * 1024 * 1024
    try:
        with dest.open("wb") as out:
            while chunk := await file.read(CHUNK):
                size += len(chunk)
                if size > limit:
                    raise HTTPException(status_code=413, detail=f"File too large (max {limit_mb} MB for {kind}s).")
                out.write(chunk)

        if kind == "image":
            try:
                with Image.open(dest) as im:
                    im.verify()  # rejects renamed non-images
            except (UnidentifiedImageError, OSError):
                raise HTTPException(status_code=400, detail="That file isn't a valid image.")
    except HTTPException:
        dest.unlink(missing_ok=True)
        raise
    except Exception:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Upload failed. Please try again.")

    return {"url": f"/media/products/{name}", "media_type": kind, "filename": file.filename, "size": size}
