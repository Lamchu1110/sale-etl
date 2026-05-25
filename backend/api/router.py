from fastapi import APIRouter
from api.routes import admin, analytics, auth, businesses, etl, evaluation, forecast, uploads

api_router = APIRouter()
api_router.include_router(auth.router, prefix='/auth', tags=['auth'])
api_router.include_router(businesses.router, prefix='/businesses', tags=['businesses'])
api_router.include_router(uploads.router, prefix='/uploads', tags=['uploads'])
api_router.include_router(etl.router, prefix='/etl', tags=['etl'])
api_router.include_router(analytics.router, prefix='/analytics', tags=['analytics'])
api_router.include_router(forecast.router, prefix='/forecast', tags=['forecast'])
api_router.include_router(evaluation.router, prefix='/evaluation', tags=['evaluation'])
api_router.include_router(admin.router, prefix='/admin', tags=['admin'])
