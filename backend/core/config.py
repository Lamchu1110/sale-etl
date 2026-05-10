from __future__ import annotations

from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    app_name: str = Field(default='Web Sales ETL and Analytics Dashboard System', alias='APP_NAME')
    api_prefix: str = Field(default='/api', alias='API_PREFIX')
    secret_key: str = Field(default='change-this-secret-key', alias='SECRET_KEY')  # Override in .env!
    access_token_expire_minutes: int = Field(default=1440, alias='ACCESS_TOKEN_EXPIRE_MINUTES')
    database_url: str = Field(default='sqlite:///./web_sales_etl.db', alias='DATABASE_URL')
    allowed_file_extensions: str = Field(default='.csv', alias='ALLOWED_FILE_EXTENSIONS')
    max_file_size_mb: int = Field(default=10, alias='MAX_FILE_SIZE_MB')
    cors_origins: str = Field(default='http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000', alias='CORS_ORIGINS')

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(',') if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
