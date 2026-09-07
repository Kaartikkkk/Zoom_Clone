from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from typing import Optional, List

from ..database import get_db
from ..models import Meeting, Participant, User, ScheduledMeeting
from ..schemas import (
    MeetingCreate, MeetingResponse, MeetingUpdate,
    JoinMeetingRequest, ParticipantResponse, ParticipantUpdate,
    MessageResponse
)
from ..utils import generate_meeting_id, generate_invite_link
from ..websocket_manager import manager
import asyncio

router = APIRouter(prefix="/api/meetings", tags=["meetings"])



def _build_meeting_response(meeting: Meeting, db: Session) -> dict:
    """Build a meeting response dict with host name and participant count."""
    host = db.query(User).filter(User.id == meeting.host_id).first()
    if meeting.status == "ended":
        participant_count = db.query(Participant).filter(
            Participant.meeting_id == meeting.id
        ).count()
    else:
        participant_count = db.query(Participant).filter(
            Participant.meeting_id == meeting.id,
            Participant.left_at.is_(None)
        ).count()
        if participant_count == 0 and meeting.status in ("active", "waiting"):
            participant_count = 1

    return {
        "id": meeting.id,
        "meeting_id": meeting.meeting_id,
        "title": meeting.title or "Zoom Meeting",
        "host_id": meeting.host_id or 1,
        "host_name": host.name if host else "Kartik",
        "status": meeting.status or "active",
        "type": meeting.type or "instant",
        "invite_link": meeting.invite_link if (meeting.invite_link and meeting.invite_link.startswith("http")) else generate_invite_link(meeting.meeting_id),
        "created_at": meeting.created_at or datetime.utcnow(),
        "started_at": meeting.started_at,
        "ended_at": meeting.ended_at,
        "duration_minutes": meeting.duration_minutes,
        "participant_count": participant_count,
    }


@router.post("", response_model=MeetingResponse)
@router.post("/", response_model=MeetingResponse)
@router.post("/create", response_model=MeetingResponse)
def create_meeting(data: MeetingCreate, db: Session = Depends(get_db)):
    """Create an instant meeting."""
    meeting_id = data.meeting_id or generate_meeting_id()
    invite_link = generate_invite_link(meeting_id)

    meeting = Meeting(
        meeting_id=meeting_id,
        title=data.title or "Zoom Meeting",
        host_id=data.host_id or 1,
        status="waiting",
        type="instant",
        invite_link=invite_link,
        created_at=datetime.utcnow(),
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    # Auto-add host as first participant
    host = db.query(User).filter(User.id == meeting.host_id).first()
    if host:
        participant = Participant(
            meeting_id=meeting.id,
            user_id=host.id,
            display_name=host.name,
            is_host=True,
            is_muted=False,
            is_video_on=True,
            joined_at=datetime.utcnow(),
        )
        db.add(participant)
        db.commit()

    return _build_meeting_response(meeting, db)


@router.get("", response_model=List[MeetingResponse])
def list_meetings(
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """List meetings, optionally filtered by status and type."""
    query = db.query(Meeting)
    if status:
        query = query.filter(Meeting.status == status)
    if type:
        query = query.filter(Meeting.type == type)
    query = query.order_by(Meeting.created_at.desc())
    meetings = query.all()
    return [_build_meeting_response(m, db) for m in meetings]


@router.get("/recent", response_model=List[MeetingResponse])
def get_recent_meetings(db: Session = Depends(get_db)):
    """Get recent ended meetings (last 7 days)."""
    meetings = (
        db.query(Meeting)
        .filter(Meeting.status == "ended")
        .order_by(Meeting.ended_at.desc())
        .limit(10)
        .all()
    )
    return [_build_meeting_response(m, db) for m in meetings]


@router.get("/upcoming", response_model=List[dict])
def get_upcoming_meetings(db: Session = Depends(get_db)):
    """Get upcoming scheduled meetings."""
    today = datetime.utcnow().date()
    results = (
        db.query(Meeting, ScheduledMeeting)
        .join(ScheduledMeeting, ScheduledMeeting.meeting_id == Meeting.id)
        .filter(
            Meeting.status.in_(["waiting", "active"]),
            ScheduledMeeting.scheduled_date >= today,
        )
        .order_by(ScheduledMeeting.scheduled_date, ScheduledMeeting.scheduled_time)
        .all()
    )
    response = []
    for meeting, schedule in results:
        host = db.query(User).filter(User.id == meeting.host_id).first()
        response.append({
            "id": meeting.id,
            "meeting_id": meeting.meeting_id,
            "title": meeting.title,
            "host_name": host.name if host else None,
            "status": meeting.status,
            "invite_link": meeting.invite_link if (meeting.invite_link and meeting.invite_link.startswith("http")) else generate_invite_link(meeting.meeting_id),
            "scheduled_date": schedule.scheduled_date.isoformat(),
            "scheduled_time": schedule.scheduled_time.isoformat(),
            "duration_minutes": schedule.duration_minutes,
            "description": schedule.description,
            "timezone": schedule.timezone,
            "recurring": schedule.recurring,
        })
    return response


@router.get("/{meeting_id}", response_model=MeetingResponse)
def get_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """Get meeting by meeting_id."""
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        clean_id = meeting_id.replace("-", "")
        meetings = db.query(Meeting).all()
        for m in meetings:
            if m.meeting_id.replace("-", "") == clean_id:
                meeting = m
                break

    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found. Please check the Meeting ID or invite link."
        )

    return _build_meeting_response(meeting, db)


@router.patch("/{meeting_id}", response_model=MeetingResponse)
def update_meeting(meeting_id: str, data: MeetingUpdate, db: Session = Depends(get_db)):
    """Update meeting status or title."""
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        clean_id = meeting_id.replace("-", "")
        meetings = db.query(Meeting).all()
        for m in meetings:
            if m.meeting_id.replace("-", "") == clean_id:
                meeting = m
                break
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")

    if data.status:
        meeting.status = data.status
        if data.status == "active" and not meeting.started_at:
            meeting.started_at = datetime.utcnow()
        elif data.status == "ended":
            meeting.ended_at = datetime.utcnow()
            if meeting.started_at:
                delta = meeting.ended_at - meeting.started_at
                meeting.duration_minutes = int(delta.total_seconds() / 60)
            db.query(Participant).filter(
                Participant.meeting_id == meeting.id,
                Participant.left_at.is_(None)
            ).update({"left_at": datetime.utcnow()})
            clean_id = meeting.meeting_id.replace("-", "")
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(manager.broadcast_to_room(
                        clean_id,
                        {"type": "meeting-ended"},
                        "host"
                    ))
            except Exception:
                pass

    if data.title:
        meeting.title = data.title

    db.commit()
    db.refresh(meeting)
    return _build_meeting_response(meeting, db)


@router.post("/{meeting_id}/join", response_model=ParticipantResponse)
def join_meeting(meeting_id: str, data: JoinMeetingRequest, db: Session = Depends(get_db)):
    """Join a meeting as a participant."""
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        clean_id = meeting_id.replace("-", "")
        meetings = db.query(Meeting).all()
        for m in meetings:
            if m.meeting_id.replace("-", "") == clean_id:
                meeting = m
                break
    if not meeting:
        raise HTTPException(
            status_code=404,
            detail="Meeting not found. Please check the Meeting ID or invite link."
        )

    if meeting.status == "ended":
        raise HTTPException(
            status_code=400,
            detail="This meeting has ended."
        )

    # Set meeting to active if it's waiting
    if meeting.status == "waiting":
        meeting.status = "active"
        meeting.started_at = datetime.utcnow()

    participant = Participant(
        meeting_id=meeting.id,
        user_id=data.user_id,
        display_name=data.display_name,
        is_host=False,
        is_muted=True,
        is_video_on=True,
        joined_at=datetime.utcnow(),
    )
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return participant


@router.post("/{meeting_id}/leave", response_model=MessageResponse)
def leave_meeting(meeting_id: str, participant_id: int = Query(...), db: Session = Depends(get_db)):
    """Leave a meeting."""
    participant = db.query(Participant).filter(Participant.id == participant_id).first()
    if not participant:
        return {"message": "Left meeting"}
    participant.left_at = datetime.utcnow()
    db.commit()

    clean_id = meeting_id.replace("-", "")
    manager.disconnect(clean_id, str(participant_id))
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(manager.broadcast_to_room(
                clean_id,
                {"type": "peer-left", "sender": str(participant_id)},
                str(participant_id)
            ))
    except Exception:
        pass

    return {"message": "Left meeting successfully"}


@router.get("/{meeting_id}/participants", response_model=List[ParticipantResponse])
def get_participants(meeting_id: str, db: Session = Depends(get_db)):
    """Get all active participants in a meeting."""
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        clean_id = meeting_id.replace("-", "")
        meetings = db.query(Meeting).all()
        for m in meetings:
            if m.meeting_id.replace("-", "") == clean_id:
                meeting = m
                break
    if not meeting:
        return []

    participants = (
        db.query(Participant)
        .filter(
            Participant.meeting_id == meeting.id,
            Participant.left_at.is_(None)
        )
        .all()
    )
    return participants


@router.patch("/{meeting_id}/participants/{participant_id}", response_model=ParticipantResponse)
def update_participant(
    meeting_id: str,
    participant_id: int,
    data: ParticipantUpdate,
    db: Session = Depends(get_db),
):
    """Update participant status (mute/video)."""
    participant = db.query(Participant).filter(Participant.id == participant_id).first()
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    if data.is_muted is not None:
        participant.is_muted = data.is_muted
    if data.is_video_on is not None:
        participant.is_video_on = data.is_video_on

    db.commit()
    db.refresh(participant)
    return participant


@router.delete("/{meeting_id}/participants/{participant_id}", response_model=MessageResponse)
def remove_participant(meeting_id: str, participant_id: int, db: Session = Depends(get_db)):
    """Remove a participant from the meeting (host control)."""
    participant = db.query(Participant).filter(Participant.id == participant_id).first()
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")
    participant.left_at = datetime.utcnow()
    db.commit()

    clean_id = meeting_id.replace("-", "")
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(manager.send_to_peer(
                clean_id,
                str(participant_id),
                {"type": "removed-from-meeting"}
            ))
            loop.create_task(manager.broadcast_to_room(
                clean_id,
                {"type": "peer-left", "sender": str(participant_id)},
                str(participant_id)
            ))
    except Exception:
        pass

    return {"message": f"Removed {participant.display_name} from the meeting"}


@router.post("/{meeting_id}/mute-all", response_model=MessageResponse)
def mute_all_participants(meeting_id: str, db: Session = Depends(get_db)):
    """Mute all participants (host control)."""
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        clean_id = meeting_id.replace("-", "")
        meetings = db.query(Meeting).all()
        for m in meetings:
            if m.meeting_id.replace("-", "") == clean_id:
                meeting = m
                break
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    db.query(Participant).filter(
        Participant.meeting_id == meeting.id,
        Participant.left_at.is_(None),
        Participant.is_host == False
    ).update({"is_muted": True})
    db.commit()
    return {"message": "All participants muted"}
