from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, Numeric, UniqueConstraint
from sqlalchemy.sql import func
from core.database import Base


class ActualRevenue(Base):
    __tablename__ = 'actual_revenue'
    __table_args__ = (
        UniqueConstraint('business_id', 'actual_year', 'month', name='uq_actual_revenue_business_year_month'),
        CheckConstraint('month >= 1 AND month <= 12', name='ck_actual_revenue_month'),
    )

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey('businesses.id'), nullable=False, index=True)
    actual_year = Column(Integer, nullable=False, index=True)
    month = Column(Integer, nullable=False, index=True)
    revenue = Column(Numeric(14, 2), nullable=False, default=0)
    source_batch_id = Column(Integer, ForeignKey('upload_batches.id'), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
