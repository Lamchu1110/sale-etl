from __future__ import annotations

from datetime import datetime
from sqlalchemy import func, distinct
from sqlalchemy.orm import Session
from models.business import Business
from models.monthly_revenue import MonthlyRevenue
from models.upload_batch import UploadBatch
from models.sales_cleaned import SalesCleaned


MONTH_LABELS = {
    1: 'Jan',
    2: 'Feb',
    3: 'Mar',
    4: 'Apr',
    5: 'May',
    6: 'Jun',
    7: 'Jul',
    8: 'Aug',
    9: 'Sep',
    10: 'Oct',
    11: 'Nov',
    12: 'Dec',
}


def _cleaned_query(
    db: Session,
    current_user,
    start_date: str | None = None,
    end_date: str | None = None,
    region: str | None = None,
    product: str | None = None,
    business_id: int | None = None,
    data_year: int | None = None,
):
    query = db.query(SalesCleaned).join(UploadBatch, SalesCleaned.batch_id == UploadBatch.id)

    if current_user.role != 'admin':
        query = query.filter(UploadBatch.uploader_id == current_user.id)
    if business_id:
        query = query.filter(UploadBatch.business_id == business_id)
    if data_year:
        query = query.filter(UploadBatch.data_year == data_year)

    query = query.filter(UploadBatch.data_type == 'base')

    if start_date:
        query = query.filter(SalesCleaned.order_date >= datetime.fromisoformat(start_date).date())
    if end_date:
        query = query.filter(SalesCleaned.order_date <= datetime.fromisoformat(end_date).date())
    if region:
        query = query.filter(SalesCleaned.region_name == region.title())
    if product:
        query = query.filter(SalesCleaned.product_name == product.title())
    return query


def _monthly_query(db: Session, current_user, business_id: int | None = None, data_year: int | None = None):
    query = db.query(MonthlyRevenue)
    if current_user.role != 'admin':
        query = query.join(UploadBatch, MonthlyRevenue.source_batch_id == UploadBatch.id)
        query = query.filter(UploadBatch.uploader_id == current_user.id)
    if business_id:
        query = query.filter(MonthlyRevenue.business_id == business_id)
    if data_year:
        query = query.filter(MonthlyRevenue.data_year == data_year)
    return query


def dashboard_filter_options(db: Session, current_user):
    query = db.query(MonthlyRevenue.business_id, MonthlyRevenue.data_year).distinct()
    if current_user.role != 'admin':
        query = query.join(UploadBatch, MonthlyRevenue.source_batch_id == UploadBatch.id)
        query = query.filter(UploadBatch.uploader_id == current_user.id)

    rows = query.order_by(MonthlyRevenue.data_year.desc(), MonthlyRevenue.business_id.asc()).all()
    year_map: dict[int, set[int]] = {}
    for business_id, data_year in rows:
        year_map.setdefault(int(business_id), set()).add(int(data_year))

    businesses = []
    if year_map:
        business_rows = (
            db.query(Business)
            .filter(Business.id.in_(year_map.keys()))
            .order_by(Business.name.asc())
            .all()
        )
        name_map = {business.id: business.name for business in business_rows}
        businesses = [
            {
                'id': business_id,
                'name': name_map.get(business_id, f'Business #{business_id}'),
                'years': sorted(years, reverse=True),
            }
            for business_id, years in sorted(year_map.items(), key=lambda item: name_map.get(item[0], ''))
        ]
    else:
        business_query = db.query(Business).order_by(Business.name.asc())
        businesses = [{'id': business.id, 'name': business.name, 'years': []} for business in business_query.all()]

    all_years = sorted({year for years in year_map.values() for year in years}, reverse=True)
    default_business_id = None
    default_year = None
    if rows:
        default_business_id = int(rows[0][0])
        default_year = int(rows[0][1])

    return {
        'businesses': businesses,
        'years': all_years,
        'default_business_id': default_business_id,
        'default_year': default_year,
    }


def dashboard_summary(
    db: Session,
    current_user,
    start_date: str | None = None,
    end_date: str | None = None,
    region: str | None = None,
    product: str | None = None,
    business_id: int | None = None,
    data_year: int | None = None,
):
    """Use SQL aggregations instead of loading all rows into Python memory."""
    if not start_date and not end_date and not region and not product and (business_id or data_year):
        monthly = _monthly_query(db, current_user, business_id, data_year)
        result = monthly.with_entities(
            func.coalesce(func.sum(MonthlyRevenue.revenue), 0).label('total_revenue'),
            func.coalesce(func.sum(MonthlyRevenue.total_orders), 0).label('total_orders'),
            func.coalesce(func.sum(MonthlyRevenue.total_quantity), 0).label('total_quantity'),
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

    base = _cleaned_query(db, current_user, start_date, end_date, region, product, business_id, data_year)

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


def revenue_by_region(db: Session, current_user, business_id: int | None = None, data_year: int | None = None):
    rows = (
        _cleaned_query(db, current_user, business_id=business_id, data_year=data_year)
        .with_entities(SalesCleaned.region_name, func.sum(SalesCleaned.total_revenue))
        .group_by(SalesCleaned.region_name)
        .order_by(func.sum(SalesCleaned.total_revenue).desc())
        .all()
    )
    return [{'label': label, 'revenue': round(float(revenue or 0), 2)} for label, revenue in rows]


def revenue_by_product(db: Session, current_user, limit: int = 10, business_id: int | None = None, data_year: int | None = None):
    rows = (
        _cleaned_query(db, current_user, business_id=business_id, data_year=data_year)
        .with_entities(SalesCleaned.product_name, func.sum(SalesCleaned.total_revenue))
        .group_by(SalesCleaned.product_name)
        .order_by(func.sum(SalesCleaned.total_revenue).desc())
        .limit(limit)
        .all()
    )
    return [{'label': label, 'revenue': round(float(revenue or 0), 2)} for label, revenue in rows]


def revenue_trend(db: Session, current_user, business_id: int | None = None, data_year: int | None = None):
    if business_id or data_year:
        rows = (
            _monthly_query(db, current_user, business_id, data_year)
            .with_entities(MonthlyRevenue.data_year, MonthlyRevenue.month, MonthlyRevenue.revenue)
            .order_by(MonthlyRevenue.data_year.asc(), MonthlyRevenue.month.asc())
            .all()
        )
        revenue_map = {(int(year), int(month)): float(revenue or 0) for year, month, revenue in rows}

        if data_year:
            return [
                {
                    'period': f'{data_year}-{month:02d}',
                    'label': MONTH_LABELS[month],
                    'revenue': round(revenue_map.get((int(data_year), month), 0), 2),
                }
                for month in range(1, 13)
            ]

        return [
            {
                'period': f'{int(year)}-{int(month):02d}',
                'label': f'{MONTH_LABELS[int(month)]} {int(year)}',
                'revenue': round(float(revenue or 0), 2),
            }
            for year, month, revenue in rows
        ]

    rows = (
        _cleaned_query(db, current_user)
        .with_entities(SalesCleaned.order_date, func.sum(SalesCleaned.total_revenue))
        .group_by(SalesCleaned.order_date)
        .order_by(SalesCleaned.order_date.asc())
        .all()
    )
    return [{'period': str(period), 'revenue': round(float(revenue or 0), 2)} for period, revenue in rows]


def calculate_kpis(db: Session, current_user, business_id: int | None = None, data_year: int | None = None):
    summary = dashboard_summary(db, current_user, business_id=business_id, data_year=data_year)

    # Meaningful KPI: percentage of total rows that passed cleaning
    batch_query = db.query(
        func.coalesce(func.sum(UploadBatch.valid_rows), 0),
        func.coalesce(func.sum(UploadBatch.total_rows), 0),
    ).filter(UploadBatch.file_status == 'processed', UploadBatch.data_type == 'base')
    if current_user.role != 'admin':
        batch_query = batch_query.filter(UploadBatch.uploader_id == current_user.id)
    if business_id:
        batch_query = batch_query.filter(UploadBatch.business_id == business_id)
    if data_year:
        batch_query = batch_query.filter(UploadBatch.data_year == data_year)
    batch_stats = batch_query.first()

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
