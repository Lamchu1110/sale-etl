from __future__ import annotations

from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class ForecastRequest(BaseModel):
    periods: int = Field(default=7, ge=1, le=90)


class ForecastPoint(BaseModel):
    target_date: date
    predicted_revenue: float


class ForecastRecordOut(BaseModel):
    id: int
    target_date: date
    predicted_revenue: float
    model_name: str
    created_at: Optional[datetime] = None

    model_config = {'from_attributes': True}
