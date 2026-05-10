from datetime import timedelta
import numpy as np
from sqlalchemy import func
from sqlalchemy.orm import Session
from models.sales_cleaned import SalesCleaned
from models.sales_forecast import SalesForecast


def generate_forecast(db: Session, periods: int = 7):
    history = (
        db.query(SalesCleaned.order_date, func.sum(SalesCleaned.total_revenue))
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
        db.query(SalesForecast).filter(SalesForecast.target_date.in_(target_dates)).delete(synchronize_session=False)

    for point in points:
        record = SalesForecast(
            target_date=point['target_date'],
            predicted_revenue=point['predicted_revenue'],
            model_name='linear_trend',
        )
        db.add(record)
    db.commit()
    return points


def get_saved_forecasts(db: Session):
    return db.query(SalesForecast).order_by(SalesForecast.target_date.asc()).all()
