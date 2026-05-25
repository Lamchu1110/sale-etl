from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session 
from api.deps import get_current_user
from core.database import get_db
from schemas.analytics import DashboardFilterOptions, DashboardSummary, KPIOut, RevenueByDimension, TrendPoint
from services.analytics_service import calculate_kpis, dashboard_filter_options, dashboard_summary, revenue_by_product, revenue_by_region, revenue_trend

router = APIRouter()


@router.get('/filters', response_model=DashboardFilterOptions)
def get_filters(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return dashboard_filter_options(db, current_user)


@router.get('/summary', response_model=DashboardSummary)
def get_summary(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    region: str | None = Query(default=None),
    product: str | None = Query(default=None),
    business_id: int | None = Query(default=None),
    data_year: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return dashboard_summary(db, current_user, start_date, end_date, region, product, business_id, data_year)


@router.get('/revenue-by-region', response_model=list[RevenueByDimension])
def get_rev_by_region(
    business_id: int | None = Query(default=None),
    data_year: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return revenue_by_region(db, current_user, business_id, data_year)


@router.get('/revenue-by-product', response_model=list[RevenueByDimension])
def get_rev_by_product(
    limit: int = 10,
    business_id: int | None = Query(default=None),
    data_year: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return revenue_by_product(db, current_user, limit, business_id, data_year)


@router.get('/trend', response_model=list[TrendPoint])
def get_trend(
    business_id: int | None = Query(default=None),
    data_year: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return revenue_trend(db, current_user, business_id, data_year)


@router.get('/kpis', response_model=list[KPIOut])
def get_kpis(
    business_id: int | None = Query(default=None),
    data_year: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return calculate_kpis(db, current_user, business_id, data_year)
