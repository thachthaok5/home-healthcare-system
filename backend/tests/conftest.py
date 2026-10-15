import sys
from pathlib import Path
import pytest

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.db.session import SessionLocal


@pytest.fixture(scope="function")
def db_session():
    """Tạo database session cho mỗi test function và rollback sau khi xong"""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
