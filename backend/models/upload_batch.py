from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func
from core.database import Base


class UploadBatch(Base):
    __tablename__ = 'upload_batches'

    id = Column(Integer, primary_key=True, index=True)
    uploader_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    business_id = Column(Integer, ForeignKey('businesses.id'), nullable=True, index=True)
    data_year = Column(Integer, nullable=True, index=True)
    data_type = Column(String(20), nullable=False, default='base', index=True)
    file_name = Column(String(255), nullable=False)
    stored_path = Column(String(500), nullable=True)
    file_status = Column(String(50), nullable=False, default='uploaded', index=True)
    total_rows = Column(Integer, nullable=False, default=0)
    valid_rows = Column(Integer, nullable=False, default=0)
    invalid_rows = Column(Integer, nullable=False, default=0)
    notes = Column(Text, nullable=True)
    error_summary = Column(Text, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)
