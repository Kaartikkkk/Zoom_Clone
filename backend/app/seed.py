from datetime import datetime, timedelta, date, time
from sqlalchemy.orm import Session

from .models import User, Meeting, ScheduledMeeting, Participant
from .utils import generate_meeting_id, generate_invite_link


def seed_database(db: Session):
    """Seed the database with sample data."""

    # Check if already seeded
    existing_user = db.query(User).first()
    if existing_user:
        return

    # ─── Create Default User ──────────────────────────────────
    user = User(
        name="Kartik",
        email="kartik@zoom.us",
        avatar_url=None,
        personal_meeting_id="248-679-1350",
        created_at=datetime.utcnow(),
    )
    db.add(user)
    db.flush()

    # ─── Create Sample Users (for participant variety) ────────
    sample_users = [
        User(name="Priya Sharma", email="priya@zoom.us", personal_meeting_id="315-842-9067"),
        User(name="Rahul Verma", email="rahul@zoom.us", personal_meeting_id="472-651-8034"),
        User(name="Ananya Gupta", email="ananya@zoom.us", personal_meeting_id="589-203-7461"),
        User(name="Vikram Singh", email="vikram@zoom.us", personal_meeting_id="603-917-2845"),
        User(name="Neha Patel", email="neha@zoom.us", personal_meeting_id="734-508-6192"),
    ]
    db.add_all(sample_users)
    db.flush()

    # ─── Create Recent (Ended) Meetings ───────────────────────
    now = datetime.utcnow()

    recent_meetings_data = [
        {
            "title": "Sprint Planning - Q3 Review",
            "started_delta": timedelta(hours=-26),
            "duration": 45,
            "participants": ["Kartik", "Priya Sharma", "Rahul Verma", "Ananya Gupta"],
        },
        {
            "title": "Design System Workshop",
            "started_delta": timedelta(days=-2, hours=-3),
            "duration": 60,
            "participants": ["Kartik", "Vikram Singh", "Neha Patel"],
        },
        {
            "title": "Client Presentation - Project Alpha",
            "started_delta": timedelta(days=-3, hours=-5),
            "duration": 30,
            "participants": ["Kartik", "Priya Sharma", "Rahul Verma", "Vikram Singh", "Neha Patel"],
        },
        {
            "title": "Weekly Team Standup",
            "started_delta": timedelta(days=-5, hours=-1),
            "duration": 15,
            "participants": ["Kartik", "Ananya Gupta", "Rahul Verma"],
        },
    ]

    for data in recent_meetings_data:
        mid = generate_meeting_id()
        started_at = now + data["started_delta"]
        ended_at = started_at + timedelta(minutes=data["duration"])

        meeting = Meeting(
            meeting_id=mid,
            title=data["title"],
            host_id=user.id,
            status="ended",
            type="instant",
            invite_link=generate_invite_link(mid),
            created_at=started_at - timedelta(minutes=5),
            started_at=started_at,
            ended_at=ended_at,
            duration_minutes=data["duration"],
        )
        db.add(meeting)
        db.flush()

        # Add participants
        all_users = {u.name: u for u in [user] + sample_users}
        for i, name in enumerate(data["participants"]):
            p_user = all_users.get(name)
            participant = Participant(
                meeting_id=meeting.id,
                user_id=p_user.id if p_user else None,
                display_name=name,
                joined_at=started_at + timedelta(seconds=i * 30),
                left_at=ended_at,
                is_host=(name == "Kartik"),
                is_muted=False,
                is_video_on=True,
            )
            db.add(participant)

    # ─── Create Upcoming Scheduled Meetings ───────────────────
    today = date.today()

    scheduled_data = [
        {
            "title": "Product Roadmap Discussion",
            "description": "Discuss Q4 product roadmap priorities, feature backlog, and resource allocation for the upcoming quarter.",
            "date": today + timedelta(days=1),
            "time": time(10, 0),
            "duration": 60,
        },
        {
            "title": "Engineering Sync",
            "description": "Weekly engineering team sync to discuss blockers, code reviews, and deployment schedules.",
            "date": today + timedelta(days=2),
            "time": time(14, 30),
            "duration": 45,
        },
        {
            "title": "Investor Update Meeting",
            "description": "Monthly update for investors covering key metrics, product milestones, and financial overview.",
            "date": today + timedelta(days=4),
            "time": time(11, 0),
            "duration": 90,
        },
    ]

    for data in scheduled_data:
        mid = generate_meeting_id()
        meeting = Meeting(
            meeting_id=mid,
            title=data["title"],
            host_id=user.id,
            status="waiting",
            type="scheduled",
            invite_link=generate_invite_link(mid),
            created_at=now,
        )
        db.add(meeting)
        db.flush()

        schedule = ScheduledMeeting(
            meeting_id=meeting.id,
            description=data["description"],
            scheduled_date=data["date"],
            scheduled_time=data["time"],
            duration_minutes=data["duration"],
            timezone="Asia/Kolkata",
            recurring=False,
        )
        db.add(schedule)

    db.commit()
    print("✅ Database seeded successfully!")
