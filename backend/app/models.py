from sqlalchemy import (
    Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Date, Time
)
from sqlalchemy.orm import relationship
from datetime import datetime

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    avatar_url = Column(String(500), nullable=True)
    personal_meeting_id = Column(String(20), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    hosted_meetings = relationship("Meeting", back_populates="host")
    participations = relationship("Participant", back_populates="user")


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    meeting_id = Column(String(20), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False, default="Zoom Meeting")
    host_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), nullable=False, default="waiting")  # waiting, active, ended
    type = Column(String(20), nullable=False, default="instant")    # instant, scheduled
    invite_link = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, nullable=True)

    # Relationships
    host = relationship("User", back_populates="hosted_meetings")
    participants = relationship("Participant", back_populates="meeting", cascade="all, delete-orphan")
    schedule = relationship("ScheduledMeeting", back_populates="meeting", uselist=False, cascade="all, delete-orphan")


class ScheduledMeeting(Base):
    __tablename__ = "scheduled_meetings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    description = Column(Text, nullable=True)
    scheduled_date = Column(Date, nullable=False)
    scheduled_time = Column(Time, nullable=False)
    duration_minutes = Column(Integer, nullable=False, default=60)
    timezone = Column(String(50), nullable=False, default="UTC")
    recurring = Column(Boolean, default=False)

    # Relationships
    meeting = relationship("Meeting", back_populates="schedule")


class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Nullable for guest users
    display_name = Column(String(100), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
    left_at = Column(DateTime, nullable=True)
    is_host = Column(Boolean, default=False)
    is_muted = Column(Boolean, default=False)
    is_video_on = Column(Boolean, default=True)

    # Relationships
    meeting = relationship("Meeting", back_populates="participants")
    user = relationship("User", back_populates="participations")
