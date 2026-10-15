from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.security import verify_password, create_access_token
from app.models import User
from app.schemas.auth import LoginRequest, Token, UserOut

router = APIRouter(prefix="/auth", tags=["Authentication & RBAC"])


@router.post("/login", response_model=Token, summary="Đăng nhập và cấp JWT Token")
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.execute(
        select(User).where(User.username == login_data.username)
    ).scalar_one_or_none()

    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản này đã bị khóa hoặc ngừng hoạt động"
        )

    access_token = create_access_token(subject=user.username)
    return Token(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=UserOut, summary="Lấy thông tin người dùng hiện tại")
def get_me(current_user: User = Depends(get_current_user)):
    return UserOut(
        user_id=current_user.user_id,
        username=current_user.username,
        email=current_user.email,
        role_name=current_user.role.role_name,
        status=current_user.status
    )
