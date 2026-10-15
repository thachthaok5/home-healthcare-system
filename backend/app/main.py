from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.core.config import settings
from app.api.v1.router import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="""
    Hệ thống thông tin quản lý dịch vụ chăm sóc sức khỏe tại nhà tích hợp AI hỗ trợ lập lịch và điều phối nhân sự y tế.
    
    Đồ án tốt nghiệp ngành Hệ thống thông tin quản lý (MIS).
    Sinh viên: Nguyễn Thạch Thảo - Lớp 65.TTQL_1
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Middleware cho phép kết nối Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", include_in_schema=False)
def root():
    """Chuyển hướng người dùng tự động tới giao diện tài liệu tương tác Swagger UI"""
    return RedirectResponse(url="/docs")


@app.get("/health", tags=["Health Check"], summary="Kiểm tra trạng thái hệ thống")
def health_check():
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "database": settings.DB_NAME
    }


# Đăng ký toàn bộ các API Router v1
app.include_router(api_router, prefix=settings.API_V1_STR)
