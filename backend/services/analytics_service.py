from __future__ import annotations

from datetime import datetime
from sqlalchemy import func, distinct
from sqlalchemy.orm import Session
from models.sales_cleaned import SalesCleaned


def _base_query(db: Session, start_date: str | None = None, end_date: str | None = None, region: str | None = None, product: str | None = None):
    """Return a filtered base query for SalesCleaned."""
    query = db.query(SalesCleaned)
    if start_date:
        query = query.filter(SalesCleaned.order_date >= datetime.fromisoformat(start_date).date())
    if end_date:
        query = query.filter(SalesCleaned.order_date <= datetime.fromisoformat(end_date).date())
    if region:
        query = query.filter(SalesCleaned.region_name == region.title())
    if product:
        query = query.filter(SalesCleaned.product_name == product.title())
    return query


def dashboard_summary(db: Session, start_date: str | None = None, end_date: str | None = None, region: str | None = None, product: str | None = None):
    """Use SQL aggregations instead of loading all rows into Python memory."""
    base = _base_query(db, start_date, end_date, region, product)

    result = base.with_entities(
        func.coalesce(func.sum(SalesCleaned.total_revenue), 0).label('total_revenue'),
        func.count(distinct(SalesCleaned.order_id)).label('total_orders'),
        func.coalesce(func.sum(SalesCleaned.quantity), 0).label('total_quantity'),
    ).first()

    total_revenue = round(float(result.total_revenue), 2)
    total_orders = int(result.total_orders)
    total_quantity = int(result.total_quantity)
    avg_order_value = round(total_revenue / total_orders, 2) if total_orders else 0.0

    return {
        'total_revenue': total_revenue,
        'total_orders': total_orders,
        'total_quantity': total_quantity,
        'avg_order_value': avg_order_value,
    }


def revenue_by_region(db: Session):
    rows = (
        db.query(SalesCleaned.region_name, func.sum(SalesCleaned.total_revenue))
        .group_by(SalesCleaned.region_name)
        .order_by(func.sum(SalesCleaned.total_revenue).desc())
        .all()
    )
    return [{'label': label, 'revenue': round(float(revenue or 0), 2)} for label, revenue in rows]


def revenue_by_product(db: Session, limit: int = 10):
    rows = (
        db.query(SalesCleaned.product_name, func.sum(SalesCleaned.total_revenue))
        .group_by(SalesCleaned.product_name)
        .order_by(func.sum(SalesCleaned.total_revenue).desc())
        .limit(limit)
        .all()
    )
    return [{'label': label, 'revenue': round(float(revenue or 0), 2)} for label, revenue in rows]


def revenue_trend(db: Session):
    rows = (
        db.query(SalesCleaned.order_date, func.sum(SalesCleaned.total_revenue))
        .group_by(SalesCleaned.order_date)
        .order_by(SalesCleaned.order_date.asc())
        .all()
    )
    return [{'period': str(period), 'revenue': round(float(revenue or 0), 2)} for period, revenue in rows]


def calculate_kpis(db: Session):
    summary = dashboard_summary(db)

    # Meaningful KPI: percentage of total rows that passed cleaning
    from models.upload_batch import UploadBatch
    batch_stats = db.query(
        func.coalesce(func.sum(UploadBatch.valid_rows), 0),
        func.coalesce(func.sum(UploadBatch.total_rows), 0),
    ).filter(UploadBatch.file_status == 'processed').first()

    valid_total = int(batch_stats[0])
    all_total = int(batch_stats[1])
    data_quality_rate = round((valid_total / max(all_total, 1)) * 100, 2)

    return [
        {'kpi_name': 'total_revenue', 'value': summary['total_revenue'], 'note': 'Main sales KPI for dashboard cards.'},
        {'kpi_name': 'total_orders', 'value': float(summary['total_orders']), 'note': 'Count of distinct order_id after cleaning.'},
        {'kpi_name': 'avg_order_value', 'value': summary['avg_order_value'], 'note': 'Revenue divided by distinct orders.'},
        {'kpi_name': 'total_quantity', 'value': float(summary['total_quantity']), 'note': 'Sum of cleaned quantity values.'},
        {'kpi_name': 'data_quality_rate', 'value': data_quality_rate, 'note': 'Percentage of uploaded rows that passed ETL validation.'},
    ]
