from typing import Optional
from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    # Project Info
    PROJECT_NAME: str = "Home Healthcare Management System"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"

    # Database Configuration
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "262005"
    DB_NAME: str = "home_healthcare_db"
    DATABASE_URL: Optional[str] = None

    # Security & JWT
    SECRET_KEY: str = "9a2b8e3f4c1d7a5b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    @computed_field
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> URL | str:
        """
        Tạo kết nối SQLAlchemy URL chuẩn xác bằng URL.create()
        hoặc chuỗi DATABASE_URL được cung cấp từ biến môi trường.
        Sử dụng driver Psycopg 3: postgresql+psycopg
        """
        if self.DATABASE_URL:
            uri = self.DATABASE_URL
            if uri.startswith("postgresql://") and not uri.startswith("postgresql+psycopg://"):
                uri = uri.replace("postgresql://", "postgresql+psycopg://", 1)
            return uri

        return URL.create(
            drivername="postgresql+psycopg",
            username=self.DB_USER,
            password=self.DB_PASSWORD,
            host=self.DB_HOST,
            port=self.DB_PORT,
            database=self.DB_NAME,
        )


settings = Settings()
