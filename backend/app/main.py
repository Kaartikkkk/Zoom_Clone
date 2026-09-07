from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, SessionLocal, Base
from .models import User, Meeting, ScheduledMeeting, Participant
from .routers import meetings, schedule, users
from .seed import seed_database

# Create the FastAPI application
app = FastAPI(
    title="Zoom Clone API",
    description="Backend API for Zoom Clone Video Conferencing Platform",
    version="1.0.0",
)

# CORS Configuration — allow frontend to communicate
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(meetings.router)
app.include_router(schedule.router)
app.include_router(users.router)


@app.on_event("startup")
def startup_event():
    """Create database tables and seed data on startup."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "zoom-clone-api"}
