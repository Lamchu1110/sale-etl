from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class BusinessCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    industry: Optional[str] = Field(default=None, max_length=100)
    notes: Optional[str] = None


class BusinessOut(BaseModel):
    id: int
    name: str
    industry: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {'from_attributes': True}
