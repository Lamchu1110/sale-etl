from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from api.deps import get_current_user
from core.database import get_db
from models.data_quality_report import DataQualityReport
from models.etl_log import ETLLog
from models.upload_batch import UploadBatch
from models.user import User
from schemas.etl import DataQualityOut, ETLLogOut, ValidationPreviewOut
from services.etl_service import preview_validation_rules, process_batch
from services.upload_service import get_batch_file_path

router = APIRouter()


def _check_access(batch: UploadBatch | None, user: User):
    if not batch:
        raise HTTPException(status_code=404, detail='Batch not found')
    if batch.uploader_id != user.id and user.role != 'admin':
        raise HTTPException(status_code=403, detail='Not allowed')


@router.post('/process/{batch_id}')
def run_etl(batch_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    batch = db.query(UploadBatch).filter(UploadBatch.id == batch_id).first()
    _check_access(batch, current_user)
    return process_batch(db, batch_id)


@router.get('/logs/{batch_id}', response_model=list[ETLLogOut])
def get_logs(batch_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    batch = db.query(UploadBatch).filter(UploadBatch.id == batch_id).first()
    _check_access(batch, current_user)
    return db.query(ETLLog).filter(ETLLog.batch_id == batch_id).order_by(ETLLog.id.asc()).all()


@router.get('/quality/{batch_id}', response_model=DataQualityOut)
def get_quality(batch_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    batch = db.query(UploadBatch).filter(UploadBatch.id == batch_id).first()
    _check_access(batch, current_user)
    report = db.query(DataQualityReport).filter(DataQualityReport.batch_id == batch_id).order_by(DataQualityReport.id.desc()).first()
    if not report:
        raise HTTPException(status_code=404, detail='No quality report found')
    return report


@router.get('/preview/{batch_id}', response_model=ValidationPreviewOut)
def preview(batch_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    batch = db.query(UploadBatch).filter(UploadBatch.id == batch_id).first()
    _check_access(batch, current_user)
    return preview_validation_rules(get_batch_file_path(batch_id, batch.file_name))
