from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class EvaluationMonthOut(BaseModel):
    actual_year: int
    month: int
    period: str
    forecast_revenue: float
    actual_revenue: Optional[float] = None
    error: Optional[float] = None
    abs_error: Optional[float] = None
    error_pct: Optional[float] = None


class ForecastEvaluationOut(BaseModel):
    id: int
    forecast_run_id: int
    business_id: int
    business_name: str | None = None
    base_year: int
    actual_year: int
    model_name: str
    mae: float
    rmse: float
    mape: float
    accuracy: float
    best_month: Optional[int] = None
    worst_month: Optional[int] = None
    best_month_period: Optional[str] = None
    worst_month_period: Optional[str] = None
    evaluated_months: int
    month_errors: list[EvaluationMonthOut]
    insights: list[str] = []
    created_at: Optional[datetime] = None


class ForecastEvaluationSummaryOut(BaseModel):
    id: int
    forecast_run_id: int
    business_id: int
    business_name: str | None = None
    base_year: int
    actual_year: int
    model_name: str
    mae: float
    rmse: float
    mape: float
    accuracy: float
    evaluated_months: int
    created_at: Optional[datetime] = None
