from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from api.deps import get_current_user, require_admin
from core.database import get_db
from core.security import get_password_hash
from models.data_quality_report import DataQualityReport
from models.etl_log import ETLLog
from models.sales_cleaned import SalesCleaned
from models.sales_raw import SalesRaw
from models.upload_batch import UploadBatch
from models.user import User
from schemas.auth import AdminUserCreate, UserOut, UserUpdate
from schemas.etl import DataQualityOut, ETLLogOut
from schemas.upload import BatchOut, BatchUpdate

router = APIRouter()


# ── Batches ──────────────────────────────────────────────────────────

@router.get('/batches', response_model=list[BatchOut])
def all_batches(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return db.query(UploadBatch).order_by(UploadBatch.id.desc()).offset(skip).limit(limit).all()


@router.get('/batches/{batch_id}', response_model=BatchOut)
def batch_detail(batch_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    batch = db.query(UploadBatch).filter(UploadBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail='Batch not found')
    return batch


@router.patch('/batches/{batch_id}', response_model=BatchOut)
def update_batch(
    batch_id: int,
    payload: BatchUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    batch = db.query(UploadBatch).filter(UploadBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail='Batch not found')
    if payload.notes is not None:
        batch.notes = payload.notes.strip()
    if payload.file_status is not None:
        allowed = {'uploaded', 'processing', 'processed', 'failed'}
        if payload.file_status not in allowed:
            raise HTTPException(status_code=400, detail=f'Status must be one of: {", ".join(allowed)}')
        batch.file_status = payload.file_status
    db.commit()
    db.refresh(batch)
    return batch


@router.delete('/batches/{batch_id}')
def delete_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    batch = db.query(UploadBatch).filter(UploadBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail='Batch not found')
    # Cascade-delete related data
    db.query(SalesCleaned).filter(SalesCleaned.batch_id == batch_id).delete()
    db.query(SalesRaw).filter(SalesRaw.batch_id == batch_id).delete()
    db.query(ETLLog).filter(ETLLog.batch_id == batch_id).delete()
    db.query(DataQualityReport).filter(DataQualityReport.batch_id == batch_id).delete()
    db.delete(batch)
    db.commit()
    return {'message': f'Batch #{batch_id} deleted successfully'}


# ── Logs ─────────────────────────────────────────────────────────────

@router.get('/logs', response_model=list[ETLLogOut])
def all_logs(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return db.query(ETLLog).order_by(ETLLog.id.desc()).offset(skip).limit(limit).all()


# ── Quality ──────────────────────────────────────────────────────────

@router.get('/quality', response_model=list[DataQualityOut])
def all_quality(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return db.query(DataQualityReport).order_by(DataQualityReport.id.desc()).offset(skip).limit(limit).all()


# ── Users (full CRUD, admin-only) ────────────────────────────────────

@router.get('/users', response_model=list[UserOut])
def list_users(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return db.query(User).order_by(User.id.asc()).offset(skip).limit(limit).all()


@router.post('/users', response_model=UserOut)
def create_user(
    payload: AdminUserCreate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    role = payload.role.lower().strip()
    if role not in {'user', 'admin'}:
        raise HTTPException(status_code=400, detail='Role must be "user" or "admin"')
    existing = db.query(User).filter(
        (User.username == payload.username) | (User.email == payload.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail='Username or email already exists')
    user = User(
        username=payload.username.strip(),
        email=payload.email.strip().lower(),
        hashed_password=get_password_hash(payload.password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch('/users/{user_id}', response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_admin=Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    if payload.role is not None:
        if payload.role not in {'user', 'admin'}:
            raise HTTPException(status_code=400, detail='Role must be "user" or "admin"')
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.email is not None:
        user.email = payload.email.strip().lower()
    if payload.password is not None:
        if len(payload.password) < 6:
            raise HTTPException(status_code=400, detail='Password must be at least 6 characters')
        user.hashed_password = get_password_hash(payload.password)
    db.commit()
    db.refresh(user)
    return user


@router.delete('/users/{user_id}')
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin=Depends(require_admin),
):
    # Prevent self-deletion
    if current_admin.id == user_id:
        raise HTTPException(status_code=400, detail='You cannot delete your own account')
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    db.delete(user)
    db.commit()
    return {'message': f'User "{user.username}" deleted successfully'}


# ── Tech Summary ─────────────────────────────────────────────────────

@router.get('/technical-summary')
def technical_summary(_=Depends(require_admin)):
    return {
        'week_1': 'DB schema, source mapping, ETL draft, analytics metric definitions',
        'week_2': 'CSV schema, validation rules, valid and invalid test datasets',
        'week_3': 'Upload + extract + clean + load pipeline + quality reports',
        'week_4': 'Dashboard summary, KPI APIs, revenue-by-dimension queries, trend endpoints',
        'week_5': 'Linear-trend forecast service with forecast history API',
        'week_6': 'Validation preview, log review, simple optimization indexes, technical handoff',
    }
