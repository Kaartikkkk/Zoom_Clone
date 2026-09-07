from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import UserResponse

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
def get_current_user(db: Session = Depends(get_db)):
    """Get the default logged-in user."""
    user = db.query(User).filter(User.id == 1).first()
    if not user:
        # Return a fallback if seed hasn't run
        return {
            "id": 0,
            "name": "Guest User",
            "email": "guest@zoom.us",
            "avatar_url": None,
            "personal_meeting_id": "000-000-0000",
            "created_at": "2024-01-01T00:00:00",
        }
    return user
