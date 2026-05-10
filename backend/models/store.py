from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint
from core.database import Base


class Store(Base):
    __tablename__ = 'stores'
    __table_args__ = (UniqueConstraint('name', 'region_id', name='uq_store_region'),)

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    region_id = Column(Integer, ForeignKey('regions.id'), nullable=False, index=True)
