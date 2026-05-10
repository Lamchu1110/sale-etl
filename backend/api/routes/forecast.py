from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from api.deps import get_current_user
from core.database import get_db
from schemas.forecast import ForecastPoint, ForecastRecordOut, ForecastRequest
from services.forecast_service import generate_forecast, get_saved_forecasts

router = APIRouter()


@router.post('/generate', response_model=list[ForecastPoint])
def create_forecast(payload: ForecastRequest, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return generate_forecast(db, payload.periods)


@router.get('/history', response_model=list[ForecastRecordOut])
def history(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return get_saved_forecasts(db)
