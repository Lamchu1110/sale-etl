from sqlalchemy import Column, Integer, String
from core.database import Base


class Region(Base):
    __tablename__ = 'regions'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
