from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.sql import func
from core.database import Base


class SalesForecast(Base):
    __tablename__ = 'sales_forecasts'

    id = Column(Integer, primary_key=True, index=True)
    created_by_user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    target_date = Column(Date, nullable=False, index=True)
    predicted_revenue = Column(Numeric(14, 2), nullable=False)
    model_name = Column(String(100), nullable=False, default='linear_trend')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
