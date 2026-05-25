from pathlib import Path
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session
from api.deps import get_current_user
from core.config import settings
from core.database import get_db
from models.business import Business
from models.upload_batch import UploadBatch
from models.user import User
from schemas.upload import BatchOut
from services.upload_service import save_upload_file

router = APIRouter()
ALLOWED_DATA_TYPES = {'base', 'actual'}


@router.post('/csv', response_model=BatchOut)
def upload_csv(
    file: UploadFile = File(...),
    business_id: int = Form(default=1),
    data_year: int | None = Form(default=None),
    data_type: str = Form(default='base'),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    extension = Path(file.filename or '').suffix.lower()
    allowed = [x.strip() for x in settings.allowed_file_extensions.split(',') if x.strip()]
    if extension not in allowed:
        raise HTTPException(status_code=400, detail=f'Only {allowed} files are allowed')

    normalized_type = data_type.lower().strip()
    if normalized_type not in ALLOWED_DATA_TYPES:
        raise HTTPException(status_code=400, detail='data_type must be "base" or "actual"')
    if data_year is not None and (data_year < 1900 or data_year > 2200):
        raise HTTPException(status_code=400, detail='data_year must be between 1900 and 2200')
    if not db.query(Business).filter(Business.id == business_id).first():
        raise HTTPException(status_code=404, detail='Business not found')

    batch = UploadBatch(
        uploader_id=current_user.id,
        business_id=business_id,
        data_year=data_year,
        data_type=normalized_type,
        file_name=file.filename or 'uploaded.csv',
        file_status='uploaded',
        notes='File uploaded, waiting for ETL processing',
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    stored_path = save_upload_file(batch.id, file)
    batch.stored_path = str(stored_path)
    db.commit()
    db.refresh(batch)
    return batch


@router.get('/batches', response_model=list[BatchOut])
def list_batches(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(UploadBatch)
    if current_user.role != 'admin':
        query = query.filter(UploadBatch.uploader_id == current_user.id)
    return query.order_by(UploadBatch.id.desc()).offset(skip).limit(limit).all()


@router.get('/batches/{batch_id}', response_model=BatchOut)
def get_batch(batch_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    batch = db.query(UploadBatch).filter(UploadBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail='Batch not found')
    if batch.uploader_id != current_user.id and current_user.role != 'admin':
        raise HTTPException(status_code=403, detail='Not allowed')
    return batch
