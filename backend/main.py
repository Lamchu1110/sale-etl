from pathlib import Path
import sys

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.router import api_router
from core.config import settings
from core.database import Base, engine
from core.bootstrap import load_model_modules
from core.schema_migrations import ensure_runtime_schema
from fastapi.responses import JSONResponse

load_model_modules()
Base.metadata.create_all(bind=engine)
ensure_runtime_schema(engine)

app = FastAPI(title=settings.app_name, version='1.0.0')
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)
app.include_router(api_router, prefix=settings.api_prefix)


@app.get('/')
def root():
    return {
        'message': settings.app_name,
        'docs': '/docs',
        'note': 'Project structure does not rely on __init__.py files.',
    }


@app.get('/health')
def health():
    return {'status': 'ok'}

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return JSONResponse(status_code=204, content=None)
