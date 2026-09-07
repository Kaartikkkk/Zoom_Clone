import sys
from datetime import datetime, date, time, timedelta
from sqlalchemy.orm import Session

from .models import User, Meeting, ScheduledMeeting, Participant
from .utils import generate_meeting_id, generate_invite_link
from .database import SessionLocal, engine, Base


def seed_database(db: Session, force: bool = False):
    """Seed the database with rich, realistic sample data for users, scheduled meetings, and recent meetings."""
    from .routers.auth import hash_password

    if force:
        print("🧹 Cleaning up existing data for fresh seed...")
        db.query(Participant).delete()
        db.query(ScheduledMeeting).delete()
        db.query(Meeting).delete()
        db.query(User).delete()
        db.commit()

    # 1. Seed Users
    users_data = [
        {
            "name": "Kartik",
            "email": "kartik@zoom.us",
            "password": "password123",
            "personal_meeting_id": "248-679-1350",
            "avatar_url": None,
        },
        {
            "name": "Sarah Miller",
            "email": "sarah.miller@zoom.us",
            "password": "password123",
            "personal_meeting_id": "389-452-1920",
            "avatar_url": None,
        },
        {
            "name": "Alex Chen",
            "email": "alex.chen@zoom.us",
            "password": "password123",
            "personal_meeting_id": "512-680-4391",
            "avatar_url": None,
        },
        {
            "name": "David Patel",
            "email": "david.patel@zoom.us",
            "password": "password123",
            "personal_meeting_id": "674-820-3158",
            "avatar_url": None,
        },
        {
            "name": "Emily Rodriguez",
            "email": "emily.r@zoom.us",
            "password": "password123",
            "personal_meeting_id": "839-204-7164",
            "avatar_url": None,
        },
    ]

    seeded_users = {}
    for u in users_data:
        existing = db.query(User).filter(User.email == u["email"]).first()
        if not existing:
            new_user = User(
                name=u["name"],
                email=u["email"],
                avatar_url=u["avatar_url"],
                password_hash=hash_password(u["password"]),
                personal_meeting_id=u["personal_meeting_id"],
                created_at=datetime.utcnow() - timedelta(days=30),
            )
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            seeded_users[u["name"]] = new_user
        else:
            if not existing.password_hash:
                existing.password_hash = hash_password(u["password"])
                db.commit()
            seeded_users[u["name"]] = existing

    kartik = seeded_users.get("Kartik") or db.query(User).first()
    sarah = seeded_users.get("Sarah Miller")
    alex = seeded_users.get("Alex Chen")
    david = seeded_users.get("David Patel")
    emily = seeded_users.get("Emily Rodriguez")

    now = datetime.utcnow()
    today = now.date()

    # 2. Seed Upcoming Scheduled Meetings (if none exist or forced)
    existing_schedules = db.query(ScheduledMeeting).count()
    if existing_schedules == 0:
        print("📅 Seeding upcoming scheduled meetings...")
        schedules_to_create = [
            {
                "title": "All-Hands: Q4 Architecture & Infrastructure Roadmap",
                "description": "Quarterly engineering review covering WebRTC scaling, zero-latency audio transceivers, and 2026 feature deliverables.",
                "scheduled_date": today,
                "scheduled_time": time(16, 30),
                "duration_minutes": 45,
                "timezone": "Asia/Kolkata",
                "host": kartik,
            },
            {
                "title": "Engineering Sync & Code Walkthrough",
                "description": "Weekly technical alignment discussing WebRTC media pipelines, ICE restart resilience, and pull requests.",
                "scheduled_date": today + timedelta(days=1),
                "scheduled_time": time(10, 0),
                "duration_minutes": 30,
                "timezone": "Asia/Kolkata",
                "host": sarah or kartik,
            },
            {
                "title": "Design System & UI Components Review",
                "description": "Deep dive into Zoom Workplace white/dark responsive layout, keyboard accessibility, and mobile 100dvh viewport testing.",
                "scheduled_date": today + timedelta(days=2),
                "scheduled_time": time(14, 0),
                "duration_minutes": 60,
                "timezone": "Asia/Kolkata",
                "host": emily or kartik,
            },
            {
                "title": "Customer Feedback & Sprint Backlog Refinement",
                "description": "Sprint planning and story pointing based on user feedback telemetry, crash reports, and backlog requests.",
                "scheduled_date": today + timedelta(days=4),
                "scheduled_time": time(11, 30),
                "duration_minutes": 45,
                "timezone": "Asia/Kolkata",
                "host": david or kartik,
            },
        ]

        for s in schedules_to_create:
            m_id = generate_meeting_id()
            meeting = Meeting(
                meeting_id=m_id,
                title=s["title"],
                host_id=s["host"].id,
                status="waiting",
                type="scheduled",
                invite_link=generate_invite_link(m_id),
                created_at=now,
            )
            db.add(meeting)
            db.flush()

            sched = ScheduledMeeting(
                meeting_id=meeting.id,
                description=s["description"],
                scheduled_date=s["scheduled_date"],
                scheduled_time=s["scheduled_time"],
                duration_minutes=s["duration_minutes"],
                timezone=s["timezone"],
                recurring=False,
            )
            db.add(sched)

            # Add host participant
            p = Participant(
                meeting_id=meeting.id,
                user_id=s["host"].id,
                display_name=s["host"].name,
                is_host=True,
                joined_at=now,
            )
            db.add(p)

        db.commit()
        print("✅ Sample scheduled upcoming meetings seeded successfully!")

    # 3. Seed Past Recent (Ended) Meetings (if fewer than 2 exist)
    recent_count = db.query(Meeting).filter(Meeting.status == "ended").count()
    if recent_count < 2:
        print("🕒 Seeding past completed recent meetings...")
        past_meetings = [
            {
                "title": "Sprint Planning & Retrospective",
                "start": now - timedelta(days=1, hours=3),
                "duration": 45,
                "host": kartik,
                "participants": [
                    (kartik.name, kartik.id, True),
                    ("Sarah Miller", sarah.id if sarah else None, False),
                    ("Alex Chen", alex.id if alex else None, False),
                    ("David Patel", david.id if david else None, False),
                ],
            },
            {
                "title": "Engineering Sync & Live WebRTC Demo",
                "start": now - timedelta(days=2, hours=5),
                "duration": 35,
                "host": kartik,
                "participants": [
                    (kartik.name, kartik.id, True),
                    ("Sarah Miller", sarah.id if sarah else None, False),
                    ("Alex Chen", alex.id if alex else None, False),
                ],
            },
            {
                "title": "Security Audit & Penetration Testing Review",
                "start": now - timedelta(days=3, hours=2),
                "duration": 50,
                "host": alex or kartik,
                "participants": [
                    (alex.name if alex else "Alex Chen", alex.id if alex else None, True),
                    (kartik.name, kartik.id, False),
                    ("Sarah Miller", sarah.id if sarah else None, False),
                    ("David Patel", david.id if david else None, False),
                    ("Emily Rodriguez", emily.id if emily else None, False),
                ],
            },
            {
                "title": "Customer Discovery & Technical Onboarding",
                "start": now - timedelta(days=4, hours=6),
                "duration": 25,
                "host": kartik,
                "participants": [
                    (kartik.name, kartik.id, True),
                    ("David Patel", david.id if david else None, False),
                ],
            },
        ]

        for pm in past_meetings:
            m_id = generate_meeting_id()
            m_start = pm["start"]
            m_end = m_start + timedelta(minutes=pm["duration"])

            m = Meeting(
                meeting_id=m_id,
                title=pm["title"],
                host_id=pm["host"].id,
                status="ended",
                type="instant",
                invite_link=generate_invite_link(m_id),
                created_at=m_start,
                started_at=m_start,
                ended_at=m_end,
                duration_minutes=pm["duration"],
            )
            db.add(m)
            db.flush()

            for p_name, u_id, is_host in pm["participants"]:
                part = Participant(
                    meeting_id=m.id,
                    user_id=u_id,
                    display_name=p_name,
                    is_host=is_host,
                    joined_at=m_start,
                    left_at=m_end,
                )
                db.add(part)

        db.commit()
        print("✅ Sample past completed meetings seeded successfully!")

    print("🎉 Database seeding complete!")


if __name__ == "__main__":
    force_reset = "--reset" in sys.argv or "--force" in sys.argv
    Base.metadata.create_all(bind=engine)
    db_session = SessionLocal()
    try:
        seed_database(db_session, force=force_reset)
    finally:
        db_session.close()
