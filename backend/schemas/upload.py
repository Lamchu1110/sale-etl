from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class BatchOut(BaseModel):
    id: int
    uploader_id: int
    business_id: Optional[int] = None
    data_year: Optional[int] = None
    data_type: str = 'base'
    file_name: str
    stored_path: Optional[str] = None
    file_status: str
    total_rows: int
    valid_rows: int
    invalid_rows: int
    notes: Optional[str] = None
    error_summary: Optional[str] = None
    uploaded_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None

    model_config = {'from_attributes': True}


class BatchUpdate(BaseModel):
    """Admin-only batch update. All fields optional."""
    notes: Optional[str] = None
    file_status: Optional[str] = None
    business_id: Optional[int] = None
    data_year: Optional[int] = None
    data_type: Optional[str] = None
