from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from api.deps import get_current_user
from core.database import get_db
from schemas.forecast import ForecastRecordOut, ForecastRequest, ForecastRunOut
from services.forecast_service import generate_forecast, get_forecast_run, get_saved_forecasts

router = APIRouter()


@router.post('/generate', response_model=ForecastRunOut)
def create_forecast(payload: ForecastRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    try:
        return generate_forecast(
            db,
            current_user,
            business_id=payload.business_id,
            base_year=payload.base_year,
            model_name=payload.model_name,
            target_year=payload.target_year,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get('/history', response_model=list[ForecastRecordOut])
def history(
    business_id: int | None = Query(default=None),
    base_year: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return get_saved_forecasts(db, current_user, business_id, base_year)


@router.get('/runs/{run_id}', response_model=ForecastRunOut)
def run_detail(run_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    try:
        return get_forecast_run(db, current_user, run_id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
