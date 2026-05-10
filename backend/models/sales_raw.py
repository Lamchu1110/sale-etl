from sqlalchemy import Column, ForeignKey, Integer, String, Text
from core.database import Base


class SalesRaw(Base):
    __tablename__ = 'sales_raw'

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey('upload_batches.id'), nullable=False, index=True)
    row_number = Column(Integer, nullable=False)
    order_id = Column(String(100), nullable=True)
    order_date = Column(String(50), nullable=True)
    product_name = Column(String(255), nullable=True)
    category = Column(String(100), nullable=True)
    quantity = Column(String(50), nullable=True)
    unit_price = Column(String(50), nullable=True)
    total_revenue = Column(String(50), nullable=True)
    store_name = Column(String(255), nullable=True)
    region_name = Column(String(255), nullable=True)
    raw_payload = Column(Text, nullable=True)
