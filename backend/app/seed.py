from datetime import datetime
from sqlalchemy.orm import Session

from .models import User


def seed_database(db: Session):
    """Ensure default host user exists in database without creating fake meetings or mock participants."""

    existing_user = db.query(User).first()
    if existing_user:
        return

    # Create Default User (Host)
    user = User(
        name="Kartik",
        email="kartik@zoom.us",
        avatar_url=None,
        personal_meeting_id="248-679-1350",
        created_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    print("✅ Initial host user created successfully!")

