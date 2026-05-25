from __future__ import annotations

import json
from statistics import mean

from sqlalchemy import func
from sqlalchemy.orm import Session

from models.business import Business
from models.forecast_result import ForecastResult
from models.forecast_run import ForecastRun
from models.monthly_revenue import MonthlyRevenue
from models.upload_batch import UploadBatch

MONTHS_PER_YEAR = 12
SUPPORTED_MODELS = {'moving_average', 'holt_winters'}


def _scoped_monthly_query(db: Session, current_user, business_id: int, max_year: int):
    query = db.query(MonthlyRevenue).filter(
        MonthlyRevenue.business_id == business_id,
        MonthlyRevenue.data_year <= max_year,
    )
    if current_user.role != 'admin':
        query = query.join(UploadBatch, MonthlyRevenue.source_batch_id == UploadBatch.id)
        query = query.filter(UploadBatch.uploader_id == current_user.id)
    return query


def _month_key(year: int, month: int) -> str:
    return f'{year}-{month:02d}'


def _series_for_forecast(db: Session, current_user, business_id: int, base_year: int):
    rows = (
        _scoped_monthly_query(db, current_user, business_id, base_year)
        .with_entities(MonthlyRevenue.data_year, MonthlyRevenue.month, MonthlyRevenue.revenue)
        .order_by(MonthlyRevenue.data_year.asc(), MonthlyRevenue.month.asc())
        .all()
    )
    if not rows:
        raise ValueError('No monthly revenue data found for this business/year. Upload base data and run ETL first.')

    available_years = sorted({int(row.data_year) for row in rows})
    start_year = available_years[0]
    revenue_map = {
        (int(row.data_year), int(row.month)): float(row.revenue or 0)
        for row in rows
    }

    values: list[float] = []
    periods: list[tuple[int, int]] = []
    for year in range(start_year, base_year + 1):
        for month in range(1, MONTHS_PER_YEAR + 1):
            periods.append((year, month))
            values.append(revenue_map.get((year, month), 0.0))

    base_year_values = [revenue_map.get((base_year, month), 0.0) for month in range(1, MONTHS_PER_YEAR + 1)]
    if not any(value > 0 for value in base_year_values):
        raise ValueError('Selected base year has no monthly revenue. Choose another year or run ETL again.')

    return {
        'values': values,
        'periods': periods,
        'available_years': available_years,
        'base_year_values': base_year_values,
    }


def _recent_average(values: list[float], window: int = 3) -> float:
    recent = [value for value in values[-window:] if value > 0]
    if recent:
        return float(mean(recent))
    non_zero = [value for value in values if value > 0]
    if non_zero:
        return float(mean(non_zero[-window:]))
    return 0.0


def _moving_average_forecast(values: list[float], periods: int = MONTHS_PER_YEAR, window: int = 3) -> list[float]:
    history = [float(value) for value in values]
    forecasts = []
    for _ in range(periods):
        prediction = max(0.0, _recent_average(history, window))
        forecasts.append(prediction)
        history.append(prediction)
    return forecasts


def _fallback_seasonal_trend(values: list[float], base_year_values: list[float]) -> list[float]:
    non_zero = [value for value in values if value > 0]
    fallback_level = float(mean(non_zero)) if non_zero else 0.0

    first_half = [value for value in base_year_values[:6] if value > 0]
    second_half = [value for value in base_year_values[6:] if value > 0]
    growth_rate = 0.0
    if first_half and second_half:
        first_avg = mean(first_half)
        second_avg = mean(second_half)
        if first_avg:
            growth_rate = (second_avg - first_avg) / first_avg
            growth_rate = max(-0.5, min(1.0, growth_rate))

    forecasts = []
    for value in base_year_values:
        seasonal_value = value if value > 0 else fallback_level
        forecasts.append(max(0.0, seasonal_value * (1 + growth_rate)))
    return forecasts


def _initial_trend(values: list[float], season_length: int) -> float:
    total = 0.0
    for i in range(season_length):
        total += (values[i + season_length] - values[i]) / season_length
    return total / season_length


def _initial_seasonals(values: list[float], season_length: int) -> dict[int, float]:
    season_count = int(len(values) / season_length)
    season_averages = [
        mean(values[season_length * season: season_length * (season + 1)])
        for season in range(season_count)
    ]

    seasonals: dict[int, float] = {}
    for month_index in range(season_length):
        month_sum = 0.0
        for season in range(season_count):
            month_sum += values[season_length * season + month_index] - season_averages[season]
        seasonals[month_index] = month_sum / season_count
    return seasonals


def _holt_winters_additive(values: list[float], periods: int = MONTHS_PER_YEAR, season_length: int = MONTHS_PER_YEAR) -> list[float]:
    if len(values) < season_length * 2:
        return []

    alpha = 0.45
    beta = 0.20
    gamma = 0.25

    level = values[0]
    trend = _initial_trend(values, season_length)
    seasonals = _initial_seasonals(values, season_length)

    for i, value in enumerate(values):
        seasonal_index = i % season_length
        previous_level = level
        level = alpha * (value - seasonals[seasonal_index]) + (1 - alpha) * (level + trend)
        trend = beta * (level - previous_level) + (1 - beta) * trend
        seasonals[seasonal_index] = gamma * (value - level) + (1 - gamma) * seasonals[seasonal_index]

    forecasts = []
    for step in range(1, periods + 1):
        seasonal_index = (len(values) + step - 1) % season_length
        forecasts.append(max(0.0, level + step * trend + seasonals[seasonal_index]))
    return forecasts


def _forecast_values(model_name: str, values: list[float], base_year_values: list[float]) -> tuple[list[float], dict]:
    if model_name == 'moving_average':
        return _moving_average_forecast(values), {'engine': 'rolling_moving_average', 'window': 3}

    holt_winters = _holt_winters_additive(values)
    if holt_winters:
        return holt_winters, {
            'engine': 'additive_holt_winters',
            'season_length': MONTHS_PER_YEAR,
            'alpha': 0.45,
            'beta': 0.20,
            'gamma': 0.25,
        }

    return _fallback_seasonal_trend(values, base_year_values), {
        'engine': 'seasonal_trend_fallback',
        'reason': 'need at least 24 monthly points for additive Holt-Winters',
    }


def _result_payload(result: ForecastResult) -> dict:
    return {
        'target_year': int(result.target_year),
        'month': int(result.month),
        'period': _month_key(int(result.target_year), int(result.month)),
        'predicted_revenue': round(float(result.predicted_revenue or 0), 2),
    }


def _run_payload(db: Session, run: ForecastRun, include_results: bool = True) -> dict:
    business = db.query(Business).filter(Business.id == run.business_id).first()
    results = []
    if include_results:
        rows = (
            db.query(ForecastResult)
            .filter(ForecastResult.forecast_run_id == run.id)
            .order_by(ForecastResult.month.asc())
            .all()
        )
        results = [_result_payload(row) for row in rows]

    parameters = json.loads(run.parameters_json) if run.parameters_json else None
    return {
        'id': run.id,
        'business_id': run.business_id,
        'business_name': business.name if business else None,
        'base_year': run.base_year,
        'target_year': run.target_year,
        'model_name': run.model_name,
        'status': run.status,
        'parameters': parameters,
        'created_at': run.created_at,
        'results': results,
    }


def generate_forecast(
    db: Session,
    current_user,
    business_id: int,
    base_year: int,
    model_name: str = 'holt_winters',
    target_year: int | None = None,
) -> dict:
    model_name = model_name.lower().strip()
    if model_name not in SUPPORTED_MODELS:
        raise ValueError('model_name must be "moving_average" or "holt_winters"')

    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise ValueError('Business not found')

    target_year = target_year or base_year + 1
    if target_year <= base_year:
        raise ValueError('target_year must be greater than base_year')

    source = _series_for_forecast(db, current_user, business_id, base_year)
    forecasts, model_params = _forecast_values(model_name, source['values'], source['base_year_values'])

    run = ForecastRun(
        business_id=business_id,
        created_by_user_id=current_user.id,
        base_year=base_year,
        target_year=target_year,
        model_name=model_name,
        status='completed',
        parameters_json=json.dumps({
            **model_params,
            'source_years': source['available_years'],
            'source_months': len(source['values']),
            'periods': MONTHS_PER_YEAR,
        }),
    )
    db.add(run)
    db.flush()

    for month, predicted_revenue in enumerate(forecasts, start=1):
        db.add(
            ForecastResult(
                forecast_run_id=run.id,
                business_id=business_id,
                target_year=target_year,
                month=month,
                predicted_revenue=round(float(predicted_revenue), 2),
            )
        )

    db.commit()
    db.refresh(run)
    return _run_payload(db, run, include_results=True)


def get_forecast_run(db: Session, current_user, run_id: int) -> dict:
    run = db.query(ForecastRun).filter(ForecastRun.id == run_id).first()
    if not run:
        raise ValueError('Forecast run not found')
    if current_user.role != 'admin' and run.created_by_user_id != current_user.id:
        raise PermissionError('Not allowed to view this forecast run')
    return _run_payload(db, run, include_results=True)


def get_saved_forecasts(db: Session, current_user, business_id: int | None = None, base_year: int | None = None) -> list[dict]:
    query = db.query(ForecastRun)
    if current_user.role != 'admin':
        query = query.filter(ForecastRun.created_by_user_id == current_user.id)
    if business_id:
        query = query.filter(ForecastRun.business_id == business_id)
    if base_year:
        query = query.filter(ForecastRun.base_year == base_year)

    runs = query.order_by(ForecastRun.created_at.desc(), ForecastRun.id.desc()).limit(50).all()
    run_ids = [run.id for run in runs]
    totals: dict[int, tuple[int, float]] = {}
    if run_ids:
        rows = (
            db.query(
                ForecastResult.forecast_run_id,
                func.count(ForecastResult.id),
                func.coalesce(func.sum(ForecastResult.predicted_revenue), 0),
            )
            .filter(ForecastResult.forecast_run_id.in_(run_ids))
            .group_by(ForecastResult.forecast_run_id)
            .all()
        )
        totals = {int(run_id): (int(count), float(total or 0)) for run_id, count, total in rows}

    business_ids = {run.business_id for run in runs}
    businesses = {}
    if business_ids:
        businesses = {
            business.id: business.name
            for business in db.query(Business).filter(Business.id.in_(business_ids)).all()
        }

    history = []
    for run in runs:
        result_count, total = totals.get(run.id, (0, 0.0))
        history.append({
            'id': run.id,
            'business_id': run.business_id,
            'business_name': businesses.get(run.business_id),
            'base_year': run.base_year,
            'target_year': run.target_year,
            'model_name': run.model_name,
            'status': run.status,
            'created_at': run.created_at,
            'result_count': result_count,
            'total_predicted_revenue': round(total, 2),
        })
    return history
