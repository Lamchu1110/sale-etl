from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from api.deps import get_current_user
from core.database import get_db
from core.security import create_access_token, get_password_hash, verify_password
from models.user import User
from schemas.auth import LoginRequest, TokenResponse, UserCreate, UserOut

router = APIRouter()


@router.post('/register', response_model=UserOut)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter((User.username == payload.username) | (User.email == payload.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail='Username or email already exists')

    user = User(
        username=payload.username.strip(),
        email=payload.email.strip().lower(),
        hashed_password=get_password_hash(payload.password),
        role='user',  # Public registration always creates 'user' role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post('/login', response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    value = payload.username_or_email.strip()
    user = db.query(User).filter((User.username == value) | (User.email == value.lower())).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid credentials')
    return TokenResponse(access_token=create_access_token(user.id))


@router.get('/me', response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
