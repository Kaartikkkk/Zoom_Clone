from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from .models import User, Meeting, Participant
from .utils import generate_meeting_id, generate_invite_link


def seed_database(db: Session):
    """Ensure default host user and initial sample recent meetings exist."""
    user = db.query(User).first()
    if not user:
        from .routers.auth import hash_password
        user = User(
            name="Kartik",
            email="kartik@zoom.us",
            avatar_url=None,
            password_hash=hash_password("password123"),
            personal_meeting_id="248-679-1350",
            created_at=datetime.utcnow(),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print("✅ Initial host user created successfully!")
    elif not user.password_hash:
        from .routers.auth import hash_password
        user.password_hash = hash_password("password123")
        db.commit()

    # Seed sample recent meetings if no meetings exist yet
    existing_meeting = db.query(Meeting).first()
    if not existing_meeting:
        now = datetime.utcnow()
        # Meeting 1: Yesterday
        m1_id = generate_meeting_id()
        m1_start = now - timedelta(days=1, hours=2)
        m1_end = m1_start + timedelta(minutes=35)
        m1 = Meeting(
            meeting_id=m1_id,
            title="Engineering Sync & Demo",
            host_id=user.id,
            status="ended",
            type="instant",
            invite_link=generate_invite_link(m1_id),
            created_at=m1_start,
            started_at=m1_start,
            ended_at=m1_end,
            duration_minutes=35,
        )
        db.add(m1)
        db.flush()

        p1 = Participant(meeting_id=m1.id, user_id=user.id, display_name=user.name, is_host=True, joined_at=m1_start, left_at=m1_end)
        p2 = Participant(meeting_id=m1.id, display_name="Sarah Miller", is_host=False, joined_at=m1_start, left_at=m1_end)
        p3 = Participant(meeting_id=m1.id, display_name="Alex Chen", is_host=False, joined_at=m1_start, left_at=m1_end)
        db.add_all([p1, p2, p3])

        # Meeting 2: 2 days ago
        m2_id = generate_meeting_id()
        m2_start = now - timedelta(days=2, hours=4)
        m2_end = m2_start + timedelta(minutes=45)
        m2 = Meeting(
            meeting_id=m2_id,
            title="Sprint Planning & Retrospective",
            host_id=user.id,
            status="ended",
            type="instant",
            invite_link=generate_invite_link(m2_id),
            created_at=m2_start,
            started_at=m2_start,
            ended_at=m2_end,
            duration_minutes=45,
        )
        db.add(m2)
        db.flush()

        p4 = Participant(meeting_id=m2.id, user_id=user.id, display_name=user.name, is_host=True, joined_at=m2_start, left_at=m2_end)
        p5 = Participant(meeting_id=m2.id, display_name="David Patel", is_host=False, joined_at=m2_start, left_at=m2_end)
        db.add_all([p4, p5])

        db.commit()
        print("✅ Initial sample recent meetings seeded successfully!")

