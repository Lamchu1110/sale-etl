from __future__ import annotations

from pathlib import Path
from fastapi import HTTPException, UploadFile
from core.config import settings

UPLOAD_DIR = Path('uploads')
UPLOAD_DIR.mkdir(exist_ok=True)

CHUNK_SIZE = 64 * 1024  # 64 KB chunks


def save_upload_file(batch_id: int, file: UploadFile) -> Path:
    """Save uploaded file with chunked reading to prevent memory exhaustion."""
    max_bytes = settings.max_file_size_mb * 1024 * 1024
    safe_filename = Path(file.filename or 'upload.csv').name
    file_path = UPLOAD_DIR / f'batch_{batch_id}_{safe_filename}'

    bytes_written = 0
    try:
        with file_path.open('wb') as buffer:
            while True:
                chunk = file.file.read(CHUNK_SIZE)
                if not chunk:
                    break
                bytes_written += len(chunk)
                if bytes_written > max_bytes:
                    buffer.close()
                    file_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=400,
                        detail=f'File exceeds {settings.max_file_size_mb} MB limit',
                    )
                buffer.write(chunk)
    except HTTPException:
        raise
    except Exception as exc:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f'File save failed: {exc}') from exc

    return file_path


def get_batch_file_path(batch_id: int, file_name: str | None = None) -> Path | None:
    if file_name:
        exact_path = UPLOAD_DIR / f'batch_{batch_id}_{Path(file_name).name}'
        if exact_path.exists():
            return exact_path

    matches = sorted(
        UPLOAD_DIR.glob(f'batch_{batch_id}_*'),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    return matches[0] if matches else None
