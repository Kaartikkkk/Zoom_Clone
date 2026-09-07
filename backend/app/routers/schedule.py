from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List

from ..database import get_db
from ..models import Meeting, ScheduledMeeting, User
from ..schemas import ScheduleMeetingCreate, ScheduleMeetingResponse, MessageResponse
from ..utils import generate_meeting_id, generate_invite_link

router = APIRouter(prefix="/api/schedule", tags=["schedule"])


@router.post("", response_model=ScheduleMeetingResponse)
def schedule_meeting(data: ScheduleMeetingCreate, db: Session = Depends(get_db)):
    """Schedule a new meeting."""
    meeting_id = generate_meeting_id()
    invite_link = generate_invite_link(meeting_id)

    # Create the base meeting record
    meeting = Meeting(
        meeting_id=meeting_id,
        title=data.title,
        host_id=data.host_id or 1,
        status="waiting",
        type="scheduled",
        invite_link=invite_link,
        created_at=datetime.utcnow(),
    )
    db.add(meeting)
    db.flush()  # Get the meeting.id before committing

    # Create the schedule details
    schedule = ScheduledMeeting(
        meeting_id=meeting.id,
        description=data.description,
        scheduled_date=data.scheduled_date,
        scheduled_time=data.scheduled_time,
        duration_minutes=data.duration_minutes,
        timezone=data.timezone,
        recurring=data.recurring,
    )
    db.add(schedule)
    db.commit()
    db.refresh(meeting)
    db.refresh(schedule)

    host = db.query(User).filter(User.id == meeting.host_id).first()

    return {
        "id": schedule.id,
        "meeting_id": meeting.meeting_id,
        "title": meeting.title,
        "description": schedule.description,
        "scheduled_date": schedule.scheduled_date,
        "scheduled_time": schedule.scheduled_time,
        "duration_minutes": schedule.duration_minutes,
        "timezone": schedule.timezone,
        "recurring": schedule.recurring,
        "invite_link": meeting.invite_link if (meeting.invite_link and meeting.invite_link.startswith("http")) else generate_invite_link(meeting.meeting_id),
        "status": meeting.status,
        "host_name": host.name if host else None,
        "created_at": meeting.created_at,
    }


@router.get("", response_model=List[ScheduleMeetingResponse])
def list_scheduled_meetings(db: Session = Depends(get_db)):
    """List all scheduled meetings."""
    results = (
        db.query(Meeting, ScheduledMeeting)
        .join(ScheduledMeeting, ScheduledMeeting.meeting_id == Meeting.id)
        .filter(Meeting.type == "scheduled")
        .order_by(ScheduledMeeting.scheduled_date, ScheduledMeeting.scheduled_time)
        .all()
    )
    response = []
    for meeting, schedule in results:
        host = db.query(User).filter(User.id == meeting.host_id).first()
        response.append({
            "id": schedule.id,
            "meeting_id": meeting.meeting_id,
            "title": meeting.title,
            "description": schedule.description,
            "scheduled_date": schedule.scheduled_date,
            "scheduled_time": schedule.scheduled_time,
            "duration_minutes": schedule.duration_minutes,
            "timezone": schedule.timezone,
            "recurring": schedule.recurring,
            "invite_link": meeting.invite_link if (meeting.invite_link and meeting.invite_link.startswith("http")) else generate_invite_link(meeting.meeting_id),
            "status": meeting.status,
            "host_name": host.name if host else None,
            "created_at": meeting.created_at,
        })
    return response


@router.delete("/{schedule_id}", response_model=MessageResponse)
def cancel_scheduled_meeting(schedule_id: str, db: Session = Depends(get_db)):
    """Cancel a scheduled meeting by schedule ID, meeting ID, or meeting code."""
    schedule = None
    try:
        num_id = int(schedule_id)
        schedule = db.query(ScheduledMeeting).filter(
            (ScheduledMeeting.id == num_id) | (ScheduledMeeting.meeting_id == num_id)
        ).first()
    except ValueError:
        pass

    if not schedule:
        clean_id = schedule_id.replace("-", "")
        meetings = db.query(Meeting).all()
        for m in meetings:
            if m.meeting_id.replace("-", "") == clean_id:
                schedule = db.query(ScheduledMeeting).filter(ScheduledMeeting.meeting_id == m.id).first()
                break

    if not schedule:
        raise HTTPException(status_code=404, detail="Scheduled meeting not found")

    meeting = db.query(Meeting).filter(Meeting.id == schedule.meeting_id).first()
    if meeting:
        meeting.status = "cancelled"
        meeting.ended_at = datetime.utcnow()

    db.delete(schedule)
    db.commit()
    return {"message": "Scheduled meeting cancelled"}
