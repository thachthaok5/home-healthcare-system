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
    # Múi giờ nghiệp vụ: mọi timestamptz trả về và hàm date() trong SQL đều tính theo giờ Việt Nam,
    # để ràng buộc ca làm việc H3 (so sánh giờ địa phương) không phụ thuộc múi giờ của máy chủ CSDL.
    connect_args={"options": "-c timezone=Asia/Ho_Chi_Minh"},
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
