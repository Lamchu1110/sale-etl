from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from api.deps import get_current_user
from core.database import get_db
from schemas.evaluation import ForecastEvaluationOut, ForecastEvaluationSummaryOut
from services.evaluation_service import evaluate_forecast_run, export_evaluation_csv, get_evaluation, list_evaluations

router = APIRouter()


@router.post('/forecast-runs/{forecast_run_id}', response_model=ForecastEvaluationOut)
def create_evaluation(
    forecast_run_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        return evaluate_forecast_run(db, current_user, forecast_run_id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get('/history', response_model=list[ForecastEvaluationSummaryOut])
def history(
    business_id: int | None = Query(default=None),
    actual_year: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return list_evaluations(db, current_user, business_id, actual_year)


@router.get('/{evaluation_id}', response_model=ForecastEvaluationOut)
def detail(
    evaluation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        return get_evaluation(db, current_user, evaluation_id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get('/{evaluation_id}/export')
def export_csv(
    evaluation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        filename, content = export_evaluation_csv(db, current_user, evaluation_id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return Response(
        content=content,
        media_type='text/csv',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )
