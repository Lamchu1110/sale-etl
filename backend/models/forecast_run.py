from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func
from core.database import Base


class ForecastRun(Base):
    __tablename__ = 'forecast_runs'

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey('businesses.id'), nullable=False, index=True)
    created_by_user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    base_year = Column(Integer, nullable=False, index=True)
    target_year = Column(Integer, nullable=False, index=True)
    model_name = Column(String(100), nullable=False, default='holt_winters', index=True)
    status = Column(String(30), nullable=False, default='created', index=True)
    parameters_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
