from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date, time


# ─── User Schemas ─────────────────────────────────────────────

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    avatar_url: Optional[str] = None
    personal_meeting_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Meeting Schemas ──────────────────────────────────────────

class MeetingCreate(BaseModel):
    title: Optional[str] = "Zoom Meeting"
    host_id: Optional[int] = 1
    meeting_id: Optional[str] = None


class MeetingResponse(BaseModel):
    id: int
    meeting_id: str
    title: str
    host_id: int
    host_name: Optional[str] = None
    status: str
    type: str
    invite_link: str
    created_at: datetime
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    participant_count: Optional[int] = 0

    class Config:
        from_attributes = True


class MeetingUpdate(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None


# ─── Schedule Schemas ─────────────────────────────────────────

class ScheduleMeetingCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    scheduled_date: date
    scheduled_time: time
    duration_minutes: int = Field(default=60, ge=15, le=480)
    timezone: str = "Asia/Kolkata"
    recurring: bool = False
    host_id: Optional[int] = 1


class ScheduleMeetingResponse(BaseModel):
    id: int
    meeting_id: str
    title: str
    description: Optional[str] = None
    scheduled_date: date
    scheduled_time: time
    duration_minutes: int
    timezone: str
    recurring: bool
    invite_link: str
    status: str
    host_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Participant Schemas ──────────────────────────────────────

class JoinMeetingRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=100)
    user_id: Optional[int] = None


class ParticipantResponse(BaseModel):
    id: int
    meeting_id: int
    user_id: Optional[int] = None
    display_name: str
    joined_at: datetime
    left_at: Optional[datetime] = None
    is_host: bool
    is_muted: bool
    is_video_on: bool

    class Config:
        from_attributes = True


class ParticipantUpdate(BaseModel):
    is_muted: Optional[bool] = None
    is_video_on: Optional[bool] = None


# ─── Generic Response ─────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str
    data: Optional[dict] = None
