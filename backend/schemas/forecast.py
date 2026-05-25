from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


ForecastModelName = Literal['moving_average', 'holt_winters']


class ForecastRequest(BaseModel):
    business_id: int = Field(ge=1)
    base_year: int = Field(ge=1900, le=2200)
    target_year: Optional[int] = Field(default=None, ge=1900, le=2200)
    model_name: ForecastModelName = 'holt_winters'


class ForecastPoint(BaseModel):
    target_year: int
    month: int
    period: str
    predicted_revenue: float


class ForecastRunOut(BaseModel):
    id: int
    business_id: int
    business_name: str | None = None
    base_year: int
    target_year: int
    model_name: str
    status: str
    parameters: dict | None = None
    created_at: Optional[datetime] = None
    results: list[ForecastPoint] = []


class ForecastRecordOut(BaseModel):
    id: int
    business_id: int
    business_name: str | None = None
    base_year: int
    target_year: int
    model_name: str
    status: str
    created_at: Optional[datetime] = None
    result_count: int = 0
    total_predicted_revenue: float = 0
