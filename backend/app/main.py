import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, SessionLocal, Base
from .models import User, Meeting, ScheduledMeeting, Participant
from .routers import meetings, schedule, users
from .seed import seed_database
from .websocket_manager import manager

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
    "https://frontend-sable-rho-u2nzn8l17o.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
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


@app.websocket("/ws/meeting/{meeting_id}/{participant_id}")
async def websocket_endpoint(websocket: WebSocket, meeting_id: str, participant_id: str):
    clean_id = meeting_id.replace("-", "")
    await manager.connect(clean_id, str(participant_id), websocket)

    # Notify room that a new peer joined
    await manager.broadcast_to_room(
        clean_id,
        {"type": "peer-joined", "sender": str(participant_id)},
        str(participant_id)
    )

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            msg["sender"] = str(participant_id)
            target = msg.get("target")

            if target:
                await manager.send_to_peer(clean_id, str(target), msg)
            else:
                await manager.broadcast_to_room(clean_id, msg, str(participant_id))

    except WebSocketDisconnect:
        manager.disconnect(clean_id, str(participant_id))
        
        # Mark participant left_at in SQLite database
        try:
            pid = int(participant_id)
            db = SessionLocal()
            try:
                db.query(Participant).filter(Participant.id == pid).update({"left_at": datetime.utcnow()})
                db.commit()
            finally:
                db.close()
        except Exception:
            pass

        await manager.broadcast_to_room(
            clean_id,
            {"type": "peer-left", "sender": str(participant_id)},
            str(participant_id)
        )

