from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, Text, UniqueConstraint
from sqlalchemy.sql import func
from core.database import Base


class ForecastEvaluation(Base):
    __tablename__ = 'forecast_evaluations'
    __table_args__ = (
        UniqueConstraint('forecast_run_id', 'actual_year', name='uq_forecast_evaluation_run_actual_year'),
    )

    id = Column(Integer, primary_key=True, index=True)
    forecast_run_id = Column(Integer, ForeignKey('forecast_runs.id'), nullable=False, index=True)
    business_id = Column(Integer, ForeignKey('businesses.id'), nullable=False, index=True)
    actual_year = Column(Integer, nullable=False, index=True)
    mae = Column(Numeric(14, 2), nullable=False, default=0)
    rmse = Column(Numeric(14, 2), nullable=False, default=0)
    mape = Column(Numeric(8, 4), nullable=False, default=0)
    accuracy = Column(Numeric(8, 4), nullable=False, default=0)
    best_month = Column(Integer, nullable=True)
    worst_month = Column(Integer, nullable=True)
    month_errors_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
