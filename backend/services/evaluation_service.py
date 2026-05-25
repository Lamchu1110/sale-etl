from __future__ import annotations

import csv
from io import StringIO
import json
import math
from statistics import mean

from sqlalchemy import func
from sqlalchemy.orm import Session

from models.actual_revenue import ActualRevenue
from models.business import Business
from models.forecast_evaluation import ForecastEvaluation
from models.forecast_result import ForecastResult
from models.forecast_run import ForecastRun
from models.upload_batch import UploadBatch


def _month_key(year: int, month: int) -> str:
    return f'{year}-{month:02d}'


def _check_run_access(run: ForecastRun | None, current_user) -> ForecastRun:
    if not run:
        raise ValueError('Forecast run not found')
    if current_user.role != 'admin' and run.created_by_user_id != current_user.id:
        raise PermissionError('Not allowed to evaluate this forecast run')
    return run


def _actual_revenue_map(db: Session, current_user, business_id: int, actual_year: int) -> dict[int, float]:
    query = db.query(ActualRevenue).filter(
        ActualRevenue.business_id == business_id,
        ActualRevenue.actual_year == actual_year,
    )
    if current_user.role != 'admin':
        query = query.join(UploadBatch, ActualRevenue.source_batch_id == UploadBatch.id)
        query = query.filter(UploadBatch.uploader_id == current_user.id)

    return {int(row.month): float(row.revenue or 0) for row in query.all()}


def _result_rows(db: Session, run_id: int) -> list[ForecastResult]:
    return (
        db.query(ForecastResult)
        .filter(ForecastResult.forecast_run_id == run_id)
        .order_by(ForecastResult.month.asc())
        .all()
    )


def _build_month_errors(forecast_rows: list[ForecastResult], actual_map: dict[int, float], actual_year: int) -> list[dict]:
    month_errors = []
    for row in forecast_rows:
        month = int(row.month)
        forecast_revenue = round(float(row.predicted_revenue or 0), 2)
        actual_revenue = actual_map.get(month)

        if actual_revenue is None:
            month_errors.append({
                'actual_year': actual_year,
                'month': month,
                'period': _month_key(actual_year, month),
                'forecast_revenue': forecast_revenue,
                'actual_revenue': None,
                'error': None,
                'abs_error': None,
                'error_pct': None,
            })
            continue

        error = round(actual_revenue - forecast_revenue, 2)
        abs_error = round(abs(error), 2)
        error_pct = None if actual_revenue == 0 else round((abs_error / actual_revenue) * 100, 4)

        month_errors.append({
            'actual_year': actual_year,
            'month': month,
            'period': _month_key(actual_year, month),
            'forecast_revenue': forecast_revenue,
            'actual_revenue': round(actual_revenue, 2),
            'error': error,
            'abs_error': abs_error,
            'error_pct': error_pct,
        })
    return month_errors


def _metrics(month_errors: list[dict]) -> dict:
    evaluated = [row for row in month_errors if row['actual_revenue'] is not None]
    if not evaluated:
        raise ValueError('No actual revenue found for the forecast target year. Upload actual data and run ETL first.')

    absolute_errors = [float(row['abs_error']) for row in evaluated]
    squared_errors = [float(row['error']) ** 2 for row in evaluated]
    percent_errors = [float(row['error_pct']) for row in evaluated if row['error_pct'] is not None]

    mae = round(mean(absolute_errors), 2)
    rmse = round(math.sqrt(mean(squared_errors)), 2)
    mape = round(mean(percent_errors), 4) if percent_errors else 0.0
    accuracy = round(max(0.0, 100 - mape), 4)

    ranked = sorted(evaluated, key=lambda row: (row['abs_error'], row['month']))
    best_month = int(ranked[0]['month']) if ranked else None
    worst_month = int(ranked[-1]['month']) if ranked else None

    return {
        'mae': mae,
        'rmse': rmse,
        'mape': mape,
        'accuracy': accuracy,
        'best_month': best_month,
        'worst_month': worst_month,
        'evaluated_months': len(evaluated),
    }


def _period_for_month(actual_year: int, month: int | None) -> str | None:
    if month is None:
        return None
    return _month_key(actual_year, int(month))


def _insights(evaluation: ForecastEvaluation, month_errors: list[dict]) -> list[str]:
    accuracy = float(evaluation.accuracy or 0)
    mape = float(evaluation.mape or 0)
    mae = float(evaluation.mae or 0)
    evaluated = [row for row in month_errors if row.get('actual_revenue') is not None]
    insights = []

    if accuracy >= 90:
        insights.append(f'Model accuracy is high at {accuracy:.2f}%, suitable for short-term revenue planning.')
    elif accuracy >= 75:
        insights.append(f'Model accuracy is moderate at {accuracy:.2f}%; review high-error months before decisions.')
    else:
        insights.append(f'Model accuracy is low at {accuracy:.2f}%; retraining or more historical data is recommended.')

    insights.append(f'Average absolute monthly error is {mae:,.2f}; MAPE is {mape:.2f}%.')

    if evaluation.best_month:
        best = next((row for row in evaluated if int(row['month']) == int(evaluation.best_month)), None)
        if best:
            insights.append(
                f'Best month is {best["period"]} with absolute error {float(best["abs_error"]):,.2f}.'
            )

    if evaluation.worst_month:
        worst = next((row for row in evaluated if int(row['month']) == int(evaluation.worst_month)), None)
        if worst:
            insights.append(
                f'Worst month is {worst["period"]} with absolute error {float(worst["abs_error"]):,.2f}.'
            )

    missing_months = [row['period'] for row in month_errors if row.get('actual_revenue') is None]
    if missing_months:
        insights.append(f'Missing actual revenue for {len(missing_months)} month(s): {", ".join(missing_months)}.')

    return insights


def _evaluation_payload(db: Session, evaluation: ForecastEvaluation) -> dict:
    run = db.query(ForecastRun).filter(ForecastRun.id == evaluation.forecast_run_id).first()
    business = db.query(Business).filter(Business.id == evaluation.business_id).first()
    month_errors = json.loads(evaluation.month_errors_json or '[]')
    actual_year = int(evaluation.actual_year)

    return {
        'id': evaluation.id,
        'forecast_run_id': evaluation.forecast_run_id,
        'business_id': evaluation.business_id,
        'business_name': business.name if business else None,
        'base_year': run.base_year if run else evaluation.actual_year - 1,
        'actual_year': evaluation.actual_year,
        'model_name': run.model_name if run else 'unknown',
        'mae': round(float(evaluation.mae or 0), 2),
        'rmse': round(float(evaluation.rmse or 0), 2),
        'mape': round(float(evaluation.mape or 0), 4),
        'accuracy': round(float(evaluation.accuracy or 0), 4),
        'best_month': evaluation.best_month,
        'worst_month': evaluation.worst_month,
        'best_month_period': _period_for_month(actual_year, evaluation.best_month),
        'worst_month_period': _period_for_month(actual_year, evaluation.worst_month),
        'evaluated_months': len([row for row in month_errors if row.get('actual_revenue') is not None]),
        'month_errors': month_errors,
        'insights': _insights(evaluation, month_errors),
        'created_at': evaluation.created_at,
    }


def evaluate_forecast_run(db: Session, current_user, forecast_run_id: int) -> dict:
    run = _check_run_access(db.query(ForecastRun).filter(ForecastRun.id == forecast_run_id).first(), current_user)
    forecast_rows = _result_rows(db, run.id)
    if not forecast_rows:
        raise ValueError('Forecast run has no forecast results')

    actual_map = _actual_revenue_map(db, current_user, run.business_id, run.target_year)
    month_errors = _build_month_errors(forecast_rows, actual_map, run.target_year)
    metrics = _metrics(month_errors)

    db.query(ForecastEvaluation).filter(
        ForecastEvaluation.forecast_run_id == run.id,
        ForecastEvaluation.actual_year == run.target_year,
    ).delete(synchronize_session=False)

    evaluation = ForecastEvaluation(
        forecast_run_id=run.id,
        business_id=run.business_id,
        actual_year=run.target_year,
        mae=metrics['mae'],
        rmse=metrics['rmse'],
        mape=metrics['mape'],
        accuracy=metrics['accuracy'],
        best_month=metrics['best_month'],
        worst_month=metrics['worst_month'],
        month_errors_json=json.dumps(month_errors),
    )
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)
    return _evaluation_payload(db, evaluation)


def get_evaluation(db: Session, current_user, evaluation_id: int) -> dict:
    evaluation = db.query(ForecastEvaluation).filter(ForecastEvaluation.id == evaluation_id).first()
    if not evaluation:
        raise ValueError('Forecast evaluation not found')

    run = _check_run_access(
        db.query(ForecastRun).filter(ForecastRun.id == evaluation.forecast_run_id).first(),
        current_user,
    )
    if run.id != evaluation.forecast_run_id:
        raise ValueError('Forecast evaluation not found')
    return _evaluation_payload(db, evaluation)


def export_evaluation_csv(db: Session, current_user, evaluation_id: int) -> tuple[str, str]:
    payload = get_evaluation(db, current_user, evaluation_id)
    output = StringIO()
    writer = csv.writer(output)

    writer.writerow(['Forecast Evaluation Report'])
    writer.writerow(['Evaluation ID', payload['id']])
    writer.writerow(['Forecast Run ID', payload['forecast_run_id']])
    writer.writerow(['Business', payload['business_name'] or payload['business_id']])
    writer.writerow(['Base Year', payload['base_year']])
    writer.writerow(['Actual Year', payload['actual_year']])
    writer.writerow(['Model', payload['model_name']])
    writer.writerow(['MAE', payload['mae']])
    writer.writerow(['RMSE', payload['rmse']])
    writer.writerow(['MAPE (%)', payload['mape']])
    writer.writerow(['Accuracy (%)', payload['accuracy']])
    writer.writerow(['Best Month', payload['best_month_period'] or ''])
    writer.writerow(['Worst Month', payload['worst_month_period'] or ''])
    writer.writerow([])
    writer.writerow(['Insights'])
    for insight in payload['insights']:
        writer.writerow([insight])
    writer.writerow([])
    writer.writerow(['Period', 'Forecast Revenue', 'Actual Revenue', 'Error', 'Abs Error', 'Error %'])

    for row in payload['month_errors']:
        writer.writerow([
            row.get('period'),
            row.get('forecast_revenue'),
            row.get('actual_revenue'),
            row.get('error'),
            row.get('abs_error'),
            row.get('error_pct'),
        ])

    filename = f'forecast_evaluation_{payload["id"]}.csv'
    return filename, output.getvalue()


def list_evaluations(db: Session, current_user, business_id: int | None = None, actual_year: int | None = None) -> list[dict]:
    query = db.query(ForecastEvaluation, ForecastRun, Business).join(
        ForecastRun,
        ForecastEvaluation.forecast_run_id == ForecastRun.id,
    ).join(
        Business,
        ForecastEvaluation.business_id == Business.id,
    )
    if current_user.role != 'admin':
        query = query.filter(ForecastRun.created_by_user_id == current_user.id)
    if business_id:
        query = query.filter(ForecastEvaluation.business_id == business_id)
    if actual_year:
        query = query.filter(ForecastEvaluation.actual_year == actual_year)

    rows = query.order_by(ForecastEvaluation.created_at.desc(), ForecastEvaluation.id.desc()).limit(50).all()
    summaries = []
    for evaluation, run, business in rows:
        month_errors = json.loads(evaluation.month_errors_json or '[]')
        summaries.append({
            'id': evaluation.id,
            'forecast_run_id': evaluation.forecast_run_id,
            'business_id': evaluation.business_id,
            'business_name': business.name,
            'base_year': run.base_year,
            'actual_year': evaluation.actual_year,
            'model_name': run.model_name,
            'mae': round(float(evaluation.mae or 0), 2),
            'rmse': round(float(evaluation.rmse or 0), 2),
            'mape': round(float(evaluation.mape or 0), 4),
            'accuracy': round(float(evaluation.accuracy or 0), 4),
            'evaluated_months': len([row for row in month_errors if row.get('actual_revenue') is not None]),
            'created_at': evaluation.created_at,
        })
    return summaries
