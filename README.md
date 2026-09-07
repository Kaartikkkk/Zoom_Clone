# Zoom Clone — Video Conferencing Platform

A full-stack video conferencing web application that replicates Zoom's design, user experience, and core meeting workflows.

![Zoom Clone](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 (App Router), TypeScript, CSS |
| **Backend** | Python 3.13, FastAPI, SQLAlchemy ORM |
| **Database** | SQLite |
| **Styling** | Vanilla CSS (Zoom Workplace 2025 design system) |

## Features

### Core Features
- **Landing Dashboard** — Zoom-style home with greeting, live clock, action cards
- **Instant Meeting Creation** — Generate unique meeting ID & shareable invite link
- **Join Meeting** — Join via Meeting ID or invite link with display name validation
- **Schedule Meetings** — Date/time picker, duration, description, auto-generated link
- **Upcoming Meetings** — Cards showing scheduled meetings with start/copy actions
- **Recent Meetings** — Table with meeting history, duration, participant counts

### Meeting Room
- Dark-themed meeting room (matching Zoom's aesthetic)
- Participant video grid (gallery view layout)
- Bottom toolbar: Mute, Video, Share Screen, Participants, Chat, Reactions, Record, End
- Participants side panel with host controls
- Meeting timer and encryption badge
- Simulated speaking indicators

### Bonus Features
- **Responsive design** — Mobile, tablet, and desktop layouts
- **Host controls** — Mute all, remove participant
- **Participant management** — Real-time mute/video status tracking

## Database Schema

```
┌─────────────┐     ┌──────────────┐     ┌────────────────────┐
│   users      │     │  meetings    │     │ scheduled_meetings │
├─────────────┤     ├──────────────┤     ├────────────────────┤
│ id (PK)     │──┐  │ id (PK)      │──┐  │ id (PK)           │
│ name        │  │  │ meeting_id   │  │  │ meeting_id (FK)   │
│ email       │  └──│ host_id (FK) │  └──│ description       │
│ avatar_url  │     │ title        │     │ scheduled_date    │
│ personal_id │     │ status       │     │ scheduled_time    │
│ created_at  │     │ type         │     │ duration_minutes  │
└─────────────┘     │ invite_link  │     │ timezone          │
                    │ created_at   │     │ recurring         │
                    │ started_at   │     └────────────────────┘
                    │ ended_at     │
                    │ duration_min │
                    └──────────────┘
                          │
                    ┌──────────────┐
                    │ participants │
                    ├──────────────┤
                    │ id (PK)      │
                    │ meeting_id   │
                    │ user_id (FK) │
                    │ display_name │
                    │ joined_at    │
                    │ left_at      │
                    │ is_host      │
                    │ is_muted     │
                    │ is_video_on  │
                    └──────────────┘
```

### Relationships
- `users` → `meetings`: One-to-Many (a user hosts many meetings)
- `meetings` → `participants`: One-to-Many (a meeting has many participants)
- `meetings` → `scheduled_meetings`: One-to-One (optional schedule details)
- `users` → `participants`: One-to-Many (a user can participate in many meetings)

## Setup Instructions

### Prerequisites
- **Node.js** 18+ and npm
- **Python** 3.10+ (3.13 recommended)

### Backend Setup

```bash
cd backend

# Create virtual environment
python3.13 -m venv venv
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Start the server (auto-creates DB and seeds data)
uvicorn app.main:app --reload --port 8000
```

The API runs at `http://localhost:8000`. Visit `/docs` for Swagger UI.

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The app runs at `http://localhost:3000`.

## Assumptions

1. **No authentication required** — A default user "Kartik" is assumed logged in
2. **No real video/audio** — The meeting room simulates video tiles with avatar placeholders; controls toggle state visually
3. **SQLite database** — Auto-created on first backend startup, seeded with sample data
4. **Meeting IDs** follow Zoom's format: `XXX-XXXX-XXXX` (e.g., `123-4567-8901`)
5. **Single user session** — All API calls use the default user (user_id=1)
6. **Timezone** defaults to `Asia/Kolkata` (IST) for scheduled meetings

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/meetings` | Create instant meeting |
| `GET` | `/api/meetings` | List meetings |
| `GET` | `/api/meetings/recent` | Get recent meetings |
| `GET` | `/api/meetings/upcoming` | Get upcoming meetings |
| `GET` | `/api/meetings/{id}` | Get meeting details |
| `PATCH` | `/api/meetings/{id}` | Update meeting status |
| `POST` | `/api/meetings/{id}/join` | Join meeting |
| `POST` | `/api/meetings/{id}/leave` | Leave meeting |
| `GET` | `/api/meetings/{id}/participants` | List participants |
| `PATCH` | `/api/meetings/{id}/participants/{pid}` | Update participant |
| `DELETE` | `/api/meetings/{id}/participants/{pid}` | Remove participant |
| `POST` | `/api/meetings/{id}/mute-all` | Mute all participants |
| `POST` | `/api/schedule` | Schedule meeting |
| `GET` | `/api/schedule` | List scheduled meetings |
| `DELETE` | `/api/schedule/{id}` | Cancel scheduled meeting |
| `GET` | `/api/users/me` | Get current user |

## Project Structure

```
zoom-clone/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py           # FastAPI app, CORS, startup
│   │   ├── database.py       # SQLAlchemy engine & session
│   │   ├── models.py         # ORM models (4 tables)
│   │   ├── schemas.py        # Pydantic request/response models
│   │   ├── seed.py           # Database seeder
│   │   ├── utils.py          # Meeting ID generator
│   │   └── routers/
│   │       ├── meetings.py   # Meeting CRUD & participant management
│   │       ├── schedule.py   # Schedule endpoints
│   │       └── users.py      # User endpoint
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css       # Full design system
│   │   │   ├── layout.tsx        # Root layout
│   │   │   ├── page.tsx          # Landing dashboard
│   │   │   └── meeting/[id]/
│   │   │       └── page.tsx      # Meeting room
│   │   ├── components/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── NewMeetingModal.tsx
│   │   │   ├── JoinMeetingModal.tsx
│   │   │   ├── ScheduleMeetingModal.tsx
│   │   │   ├── MeetingToolbar.tsx
│   │   │   └── ParticipantsPanel.tsx
│   │   └── lib/
│   │       └── api.ts            # API client
│   └── package.json
└── README.md
```
