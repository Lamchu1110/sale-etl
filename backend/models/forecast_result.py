from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, Numeric, UniqueConstraint
from sqlalchemy.sql import func
from core.database import Base


class ForecastResult(Base):
    __tablename__ = 'forecast_results'
    __table_args__ = (
        UniqueConstraint('forecast_run_id', 'month', name='uq_forecast_result_run_month'),
        CheckConstraint('month >= 1 AND month <= 12', name='ck_forecast_result_month'),
    )

    id = Column(Integer, primary_key=True, index=True)
    forecast_run_id = Column(Integer, ForeignKey('forecast_runs.id'), nullable=False, index=True)
    business_id = Column(Integer, ForeignKey('businesses.id'), nullable=False, index=True)
    target_year = Column(Integer, nullable=False, index=True)
    month = Column(Integer, nullable=False, index=True)
    predicted_revenue = Column(Numeric(14, 2), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
