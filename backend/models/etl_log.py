from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func
from core.database import Base


class ETLLog(Base):
    __tablename__ = 'etl_logs'

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey('upload_batches.id'), nullable=False, index=True)
    step = Column(String(50), nullable=False)
    level = Column(String(20), nullable=False, default='INFO')
    message = Column(String(500), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
