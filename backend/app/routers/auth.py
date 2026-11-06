"""Authentication endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..deps import CurrentUser, current_user, get_db
from ..errors import RuleError
from ..config import JWT_EXPIRE_MINUTES
from ..models import Student, Teacher
from ..schemas import LoginIn
from ..security import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _public_user(user, role: str):
    return {"id": user.id, "role": role, "name": user.name}


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    model = Teacher if body.role == "teacher" else Student
    user = db.get(model, body.userId)
    if user is None or not verify_password(body.password, user.password_hash):
        raise RuleError("invalid_credentials", "Invalid role, user ID, or password.")
    return {
        "accessToken": create_access_token(user.id, body.role),
        "tokenType": "bearer",
        "expiresIn": 60 * JWT_EXPIRE_MINUTES,
        "user": _public_user(user, body.role),
    }


@router.get("/me")
def me(me: CurrentUser = Depends(current_user)):
    return _public_user(me.user, me.role)
