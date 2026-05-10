from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text
from sqlalchemy.sql import func
from core.database import Base


class DataQualityReport(Base):
    __tablename__ = 'data_quality_reports'

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey('upload_batches.id'), nullable=False, index=True)
    missing_count = Column(Integer, nullable=False, default=0)
    duplicate_count = Column(Integer, nullable=False, default=0)
    invalid_count = Column(Integer, nullable=False, default=0)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
