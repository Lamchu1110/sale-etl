from sqlalchemy import Column, Date, ForeignKey, Integer, Numeric, String
from core.database import Base


class SalesCleaned(Base):
    __tablename__ = 'sales_cleaned'

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey('upload_batches.id'), nullable=False, index=True)
    order_id = Column(String(100), nullable=False, index=True)
    order_date = Column(Date, nullable=False, index=True)
    product_id = Column(Integer, ForeignKey('products.id'), nullable=False, index=True)
    region_id = Column(Integer, ForeignKey('regions.id'), nullable=False, index=True)
    store_id = Column(Integer, ForeignKey('stores.id'), nullable=False, index=True)
    product_name = Column(String(255), nullable=False, index=True)
    category = Column(String(100), nullable=True)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    total_revenue = Column(Numeric(14, 2), nullable=False, index=True)
    store_name = Column(String(255), nullable=False)
    region_name = Column(String(255), nullable=False, index=True)
