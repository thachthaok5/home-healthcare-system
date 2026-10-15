import sys
from sqlalchemy import text
from app.db.session import engine
from app.core.config import settings

def test_db():
    print(f"Connecting to database '{settings.DB_NAME}' at {settings.DB_HOST}:{settings.DB_PORT} as '{settings.DB_USER}'...")
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version();"))
            db_version = result.scalar()
            print("DATABASE CONNECTION SUCCESSFUL!")
            print(f"PostgreSQL Version: {db_version}")
            
            # Check current database name
            cur_db = conn.execute(text("SELECT current_database();")).scalar()
            print(f"Current Database: {cur_db}")
            return True
    except Exception as e:
        print(f"CONNECTION FAILED: {e}")
        return False

if __name__ == "__main__":
    success = test_db()
    sys.exit(0 if success else 1)
