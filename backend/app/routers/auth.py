import hashlib
import secrets
import base64
import json
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import UserSignupRequest, UserLoginRequest, AuthResponse, UserResponse
from ..utils import generate_meeting_id

router = APIRouter(prefix="/api/auth", tags=["auth"])

SECRET_KEY = b"zoom_clone_auth_secret_key_2026"


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"{salt}${key.hex()}"


def verify_password(password: str, stored_hash: Optional[str]) -> bool:
    if not stored_hash:
        # If user has no password set (e.g. seeded default user), allow default password 'password123' or 'kartik'
        return password in ("password123", "kartik", "zoom123")
    try:
        salt, key_hex = stored_hash.split("$", 1)
        check_key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
        return secrets.compare_digest(key_hex, check_key.hex())
    except Exception:
        return False


def create_token(user_id: int) -> str:
    payload = {"sub": user_id, "iat": int(datetime.utcnow().timestamp())}
    dumped = json.dumps(payload)
    sig = hashlib.sha256(dumped.encode("utf-8") + SECRET_KEY).hexdigest()
    raw = f"{dumped}###{sig}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("utf-8")


def decode_token(token: str) -> Optional[int]:
    try:
        raw = base64.urlsafe_b64decode(token.encode("utf-8")).decode("utf-8")
        dumped, sig = raw.split("###", 1)
        check_sig = hashlib.sha256(dumped.encode("utf-8") + SECRET_KEY).hexdigest()
        if not secrets.compare_digest(sig, check_sig):
            return None
        data = json.loads(dumped)
        return data.get("sub")
    except Exception:
        return None


@router.post("/signup", response_model=AuthResponse)
def signup(data: UserSignupRequest, db: Session = Depends(get_db)):
    """Register a new Zoom Clone user."""
    clean_email = data.email.lower().strip()
    existing = db.query(User).filter(User.email == clean_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email is already registered. Please sign in.")

    # Generate unique PMI
    pmi = generate_meeting_id()

    new_user = User(
        name=data.name.strip(),
        email=clean_email,
        password_hash=hash_password(data.password),
        personal_meeting_id=pmi,
        created_at=datetime.utcnow(),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_token(new_user.id)
    return {
        "user": new_user,
        "token": token,
        "message": "Account created successfully.",
    }


@router.post("/login", response_model=AuthResponse)
def login(data: UserLoginRequest, db: Session = Depends(get_db)):
    """Sign in to existing account."""
    clean_email = data.email.lower().strip()
    user = db.query(User).filter(User.email == clean_email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_token(user.id)
    return {
        "user": user,
        "token": token,
        "message": "Signed in successfully.",
    }


@router.get("/me", response_model=UserResponse)
def get_authenticated_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Get current authenticated user, or fallback to default user."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        user_id = decode_token(token)
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                return user

    # Fallback to first user (default host)
    default_user = db.query(User).first()
    if default_user:
        return default_user

    return {
        "id": 1,
        "name": "Kartik",
        "email": "kartik@zoom.us",
        "avatar_url": None,
        "personal_meeting_id": "248-679-1350",
        "created_at": datetime.utcnow(),
    }


@router.post("/logout")
def logout():
    """Sign out user."""
    return {"message": "Signed out successfully."}
