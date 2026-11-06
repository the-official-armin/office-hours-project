"""Authentication endpoints."""
from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from ..deps import get_db
from ..errors import RuleError
from ..config import JWT_EXPIRE_MINUTES
from ..models import Student, Teacher
from ..schemas import LoginIn
from ..security import create_access_token, decode_access_token, verify_password
from jwt import InvalidTokenError

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
def me(authorization: str = Header(default=""), db: Session = Depends(get_db)):
    if not authorization.lower().startswith("bearer "):
        raise RuleError("unauthorized", "A bearer token is required.")
    try:
        claims = decode_access_token(authorization[7:].strip())
    except InvalidTokenError as exc:
        raise RuleError("unauthorized", "Invalid or expired access token.") from exc
    role = claims.get("role")
    if role not in ("teacher", "student") or not claims.get("sub"):
        raise RuleError("unauthorized", "Invalid or expired access token.")
    model = Teacher if role == "teacher" else Student
    user = db.get(model, claims.get("sub"))
    if user is None:
        raise RuleError("unauthorized", "User no longer exists.")
    return _public_user(user, role)
