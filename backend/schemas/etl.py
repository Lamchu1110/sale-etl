from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ETLLogOut(BaseModel):
    id: int
    batch_id: int
    step: str
    level: str
    message: str
    created_at: Optional[datetime] = None

    model_config = {'from_attributes': True}


class DataQualityOut(BaseModel):
    id: int
    batch_id: int
    missing_count: int
    duplicate_count: int
    invalid_count: int
    summary: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {'from_attributes': True}


class ValidationPreviewOut(BaseModel):
    required_columns: list[str]
    missing_columns: list[str]
    allowed_extensions: list[str]
    validation_rules: list[str]

    model_config = {'from_attributes': True}
