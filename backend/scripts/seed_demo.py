from pathlib import Path
import sys
BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from core.bootstrap import load_model_modules
from core.database import Base, engine, SessionLocal
from core.security import get_password_hash
from models.user import User

load_model_modules()
Base.metadata.create_all(bind=engine)

db = SessionLocal()
try:
    if not db.query(User).filter(User.username == 'admin').first():
        db.add(User(username='admin', email='admin@example.com', hashed_password=get_password_hash('admin123'), role='admin'))
    if not db.query(User).filter(User.username == 'user').first():
        db.add(User(username='user', email='user@example.com', hashed_password=get_password_hash('user123'), role='user'))
    db.commit()
    print('Seeded demo users: admin/admin123 and user/user123')
finally:
    db.close()
