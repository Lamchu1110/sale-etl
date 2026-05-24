from datetime import timedelta
import numpy as np
from sqlalchemy import func
from sqlalchemy.orm import Session
from models.sales_cleaned import SalesCleaned
from models.sales_forecast import SalesForecast
from models.upload_batch import UploadBatch


def _forecast_source_query(db: Session, current_user):
    query = db.query(SalesCleaned.order_date, func.sum(SalesCleaned.total_revenue))
    if current_user.role != 'admin':
        query = query.join(UploadBatch, SalesCleaned.batch_id == UploadBatch.id).filter(
            UploadBatch.uploader_id == current_user.id
        )
    return query


def generate_forecast(db: Session, current_user, periods: int = 7):
    history = (
        _forecast_source_query(db, current_user)
        .group_by(SalesCleaned.order_date)
        .order_by(SalesCleaned.order_date.asc())
        .all()
    )
    if len(history) < 2:
        return []

    dates = [row[0] for row in history]
    values = np.array([float(row[1]) for row in history], dtype=float)
    x = np.arange(len(values))
    slope, intercept = np.polyfit(x, values, 1)

    points = []
    last_date = dates[-1]
    target_dates = []
    for i in range(1, periods + 1):
        target_date = last_date + timedelta(days=i)
        target_dates.append(target_date)
        prediction = max(0.0, float(intercept + slope * (len(values) + i - 1)))
        points.append({'target_date': target_date, 'predicted_revenue': round(prediction, 2)})

    # Remove existing forecasts for the same dates to avoid duplicates
    if target_dates:
        db.query(SalesForecast).filter(
            SalesForecast.target_date.in_(target_dates),
            SalesForecast.created_by_user_id == current_user.id,
        ).delete(synchronize_session=False)

    for point in points:
        record = SalesForecast(
            created_by_user_id=current_user.id,
            target_date=point['target_date'],
            predicted_revenue=point['predicted_revenue'],
            model_name='linear_trend',
        )
        db.add(record)
    db.commit()
    return points


def get_saved_forecasts(db: Session, current_user):
    query = db.query(SalesForecast)
    if current_user.role != 'admin':
        query = query.filter(SalesForecast.created_by_user_id == current_user.id)
    return query.order_by(SalesForecast.target_date.asc()).all()
