from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from api.deps import get_current_user, require_admin
from core.database import get_db
from models.business import Business
from schemas.business import BusinessCreate, BusinessOut

router = APIRouter()


@router.get('', response_model=list[BusinessOut])
def list_businesses(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Business).order_by(Business.name.asc()).all()


@router.post('', response_model=BusinessOut)
def create_business(payload: BusinessCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    name = payload.name.strip()
    existing = db.query(Business).filter(Business.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail='Business name already exists')
    business = Business(
        name=name,
        industry=payload.industry.strip() if payload.industry else None,
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(business)
    db.commit()
    db.refresh(business)
    return business
