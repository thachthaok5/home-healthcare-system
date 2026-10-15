from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings

# Khởi tạo SQLAlchemy Engine với connection pooling chuẩn và driver Psycopg 3
engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    pool_pre_ping=True,  # Kiểm tra kết nối còn sống trước khi cấp session
    pool_size=10,
    max_overflow=20,
    echo=False,
)

# Quản lý Database Session
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI Dependency: Cấp phát session database theo vòng đời request HTTP,
    đảm bảo luôn đóng session an toàn sau khi hoàn thành.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
