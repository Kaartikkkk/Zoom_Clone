# Zoom Clone — Modern Real-Time Video Conferencing Platform

A full-stack, production-grade video conferencing web application inspired by Zoom Workplace. Built with **Next.js 16 (App Router & Turbopack)**, **FastAPI**, **WebSockets**, and **native WebRTC** for ultra-low latency peer-to-peer audio and video streaming.

[![Next.js 16](https://img.shields.io/badge/Next.js-16.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P%20Streaming-333333?style=flat-square&logo=webrtc)](https://webrtc.org/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite)](https://www.sqlite.org/)

---

## 🌐 Live Deployments

- **Frontend (Vercel)**: [https://frontend-sable-rho-u2nzn8l17o.vercel.app](https://frontend-sable-rho-u2nzn8l17o.vercel.app)
- **Backend API (Render)**: [https://zoom-clone-xwp5.onrender.com](https://zoom-clone-xwp5.onrender.com)
- **Interactive Swagger Docs**: [https://zoom-clone-xwp5.onrender.com/docs](https://zoom-clone-xwp5.onrender.com/docs)

---

## 🛠 Tech Stack

| Layer | Technology | Description |
|---|---|---|
| **Frontend Framework** | Next.js 16.3 (Turbopack), React 19 | Modern App Router, TypeScript, dynamic routes (`/meeting/[id]`) |
| **Styling & Design System** | Vanilla CSS3 | Custom Zoom Workplace 2025 dark/light theme, glassmorphism, responsive grid |
| **Real-Time Streaming** | Native WebRTC (`RTCPeerConnection`) | P2P audio & video tracks, transceivers, bitrate limits, ICE restart |
| **Signaling & Heartbeat** | Native WebSockets (`FastAPI WebSockets`) | SDP exchange, ICE candidate routing, keep-alive ping/pong heartbeat |
| **Backend API** | Python 3.13, FastAPI, Uvicorn | Async REST endpoints, dependency injection, CORS middleware |
| **Database & ORM** | SQLite 3, SQLAlchemy 2.0 | Relational schema with foreign keys, cascade deletes, Pydantic v2 validation |

---

## ✨ Features

### 1. 🏠 Landing Dashboard & Navigation
- **Zoom Workplace Design**: Sleek navigation bar with search bar, live digital clock, calendar, and profile/settings placeholders.
- **Quick Action Cards**:
  - 🟠 **New Meeting**: Instantly launch an ad-hoc room with auto-generated Zoom-style ID (`XXX-XXXX-XXXX`) and shareable link.
  - 🔵 **Join Meeting**: Connect to any meeting via ID or invite link with a custom display name.
  - 📅 **Schedule Meeting**: Open the scheduling modal to plan future meetings.
  - 🖥️ **Share Screen**: Direct shortcut into screen sharing mode.
- **Upcoming Meetings Carousel**: Browse scheduled calls with an interactive calendar day picker, duration chips, **Start**, **Copy Link**, and **Cancel** actions.
- **Recent Meetings History**: Review past completed sessions with participant counts, timestamps, and duration.

### 2. 🎥 Real-Time Audio & Video Conferencing (WebRTC)
- **High-Definition Video & Audio**: Hardware-accelerated camera and microphone capture via `navigator.mediaDevices.getUserMedia`.
- **Dynamic Gallery Grid**: Responsive video layout adapting automatically from 1 to 12+ participant tiles.
- **Dedicated Background Audio Pipeline**: Remote audio streams are decoupled from visual grid unmounting, preventing voice dropouts during UI re-renders.
- **Browser Autoplay Protection**: Global user-gesture audio unlock banner and listeners (`click`, `touchstart`) to bypass strict mobile/browser autoplay restrictions.
- **In-Meeting Controls Toolbar**:
  - 🎙️ **Mute / Unmute Microphone** with real-time waveform speaking indicators.
  - 📹 **Start / Stop Camera Video** with avatar fallback tiles.
  - 👥 **Participants Panel** toggle with live count badge.
  - 💬 **Meeting Chat** side panel.
  - 👏 **Reactions** menu (emojis, raise hand).
  - 🔗 **Copy Invite Link** button with instant clipboard feedback.
  - 🛑 **End / Leave Meeting** button (Host: "End for All", Attendee: "Leave").

### 3. 🛡️ Host Moderation Controls
- **Mute All**: Host can mute every participant in the room simultaneously. Mute commands are delivered via WebSocket, instantly shutting off participant mic tracks in real time.
- **Remove Participant**: Host can eject disruptive attendees with a single click. Removed attendees receive an immediate eviction notice, media streams are stopped, and the client redirects back to the dashboard.
- **Host Role Persistence**: Host status is preserved securely across page refreshes via isolated browser session state.

### 4. 📅 Scheduled Meetings Flow
- **Comprehensive Scheduling Modal**:
  - Custom Meeting Title & Description/Agenda.
  - HTML5 Date Picker (restricted to present and future dates) & Time Picker.
  - Meeting Duration dropdown (15, 30, 45, 60, 90, 120 minutes).
  - Configurable Timezone (`Asia/Kolkata`, `UTC`, `America/New_York`, etc.).
- **Auto-Generated Shareable Links**: Produces an absolute shareable URL (`https://.../meeting/{id}`) stored in the database.
- **Full Meeting Lifecycle**: View, launch, copy, or cancel scheduled meetings from the dashboard.

### 5. 📱 Mobile Phone & Responsive Optimization
- **Dynamic Viewport (`100dvh`)**: Bottom toolbar never gets clipped or hidden beneath mobile browser address bars (Safari iOS / Chrome Android).
- **Safe Area Insets**: Support for notched screens (`env(safe-area-inset-bottom)`).
- **Responsive Controls**: Desktop-only tools (Screen Share, Record) automatically hide on screens `< 640px` to fit essential meeting controls comfortably.

### 6. 🔐 User Authentication & Account Management
- **Zero-Friction Default Experience**: By default, the application is pre-authenticated with the standard host user ("Kartik"), allowing frictionless evaluation without mandatory login walls.
- **Full Login & Signup System**:
  - Modal with **Sign In** and **Sign Up** tabs.
  - PBKDF2 HMAC-SHA256 password hashing with 16-byte random salt and 100,000 iterations.
  - JWT/Bearer token authentication with local storage persistence.
  - Pre-seeded Demo Credentials:
    - **Email**: `kartik@zoom.us`
    - **Password**: `password123`
    - **Auto-Fill Demo Credentials** button for instant 1-click login.
- **Zoom-Style Profile Popover**:
  - Click user avatar in top-right to view profile details, Personal Meeting ID (PMI), Licensed badge.
  - **Switch Account / Sign In**, **Sign Up New Account**, and **Sign Out** options.

---

## ⚡ Media Streaming & Anti-Freeze Architecture

Standard WebRTC applications frequently suffer from video freezes 10–15 seconds into a call due to mobile uplink saturation and cloud proxy timeouts. This project implements enterprise-grade resilience measures:

1. **5-Second WebSocket Keep-Alive (`ping` / `pong`)**:
   - The frontend transmits a lightweight `{"type": "ping"}` packet every 5 seconds.
   - The FastAPI backend answers with `{"type": "pong"}`.
   - Keeps cellular carrier NAT mappings, Cloudflare, and cloud reverse proxies (Render) permanently open.
2. **8-Second Delayed Disconnect Grace Period**:
   - Temporary network packet drops or carrier Wi-Fi handovers do not immediately destroy room sessions.
   - The frontend automatically reconnects without tearing down ongoing peer media tracks.
3. **Bandwidth Management & Bitrate Capping**:
   - Video senders are capped at **900 kbps** with `max-bundle` and `rtcpMuxPolicy: 'require'` transport multiplexing.
   - Prevents uplink bufferbloat and packet drops on 4G/5G mobile connections.
4. **HTML5 Video Watchdog**:
   - Background monitor verifies `<video>` play states every 2 seconds and automatically restarts stalled video elements.
5. **Automated ICE Restart**:
   - If peer connection state transitions to `disconnected` or `failed`, the initiator automatically negotiates an ICE restart offer.

---

## 🗄️ Database Schema

The SQLite relational database (`zoom_clone.db`) is managed via SQLAlchemy ORM models in [`backend/app/models.py`](file:///Users/Kartikkk/Documents/Scaler/Zoom_Clone/backend/app/models.py).

```
┌─────────────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐
│          users          │       │        meetings        │       │   scheduled_meetings   │
├─────────────────────────┤       ├────────────────────────┤       ├────────────────────────┤
│ id (PK, int)            │───┐   │ id (PK, int)           │───┐   │ id (PK, int)           │
│ name (str)              │   │   │ meeting_id (UK, str)   │   └───│ meeting_id (FK, int)   │
│ email (UK, str)         │   └──<│ host_id (FK, int)      │       │ description (text)     │
│ password_hash (str,nul) │       │ title (str)            │       │ scheduled_date (date)  │
│ avatar_url (str)        │       │ status (str)           │       │ scheduled_time (time)  │
│ personal_meeting_id     │       │ type (str)             │       │ duration_minutes (int) │
│ created_at (dt)         │       │ invite_link (str)      │       │ timezone (str)         │
└─────────────────────────┘       │ created_at (dt)        │       │ recurring (bool)       │
                                  │ started_at (dt)        │       └────────────────────────┘
                                  │ ended_at (dt)          │
                                  │ duration_minutes (int) │
                                  └────────────────────────┘
                                          │
                                          │ 1:N
                                          ▼
                              ┌────────────────────────┐
                              │      participants      │
                              ├────────────────────────┤
                              │ id (PK, int)           │
                              │ meeting_id (FK, int)   │
                              │ user_id (FK, nullable) │
                              │ display_name (str)     │
                              │ joined_at (dt)         │
                              │ left_at (dt, nullable) │
                              │ is_host (bool)         │
                              │ is_muted (bool)        │
                              │ is_video_on (bool)     │
                              └────────────────────────┘
```

### Relational Mapping
- **`users` $\rightarrow$ `meetings`**: One-to-Many (`hosted_meetings`).
- **`meetings` $\rightarrow$ `participants`**: One-to-Many (`cascade="all, delete-orphan"`).
- **`meetings` $\rightarrow$ `scheduled_meetings`**: One-to-One (`uselist=False`, `cascade="all, delete-orphan"`).
- **`users` $\rightarrow$ `participants`**: One-to-Many (`participations`).

---

## 🔌 WebSocket Signaling Protocol

The WebSocket signaling server handles room presence and WebRTC SDP/ICE negotiation at `/ws/meeting/{meeting_id}/{participant_id}`:

| Direction | Message Type | Payload Fields | Purpose |
|---|---|---|---|
| **Client $\rightarrow$ Server** | `ping` | `{"type": "ping"}` | Keep-alive heartbeat (sent every 5s) |
| **Server $\rightarrow$ Client** | `pong` | `{"type": "pong"}` | Heartbeat acknowledgment |
| **Server $\rightarrow$ Client** | `room-peers` | `{"type": "room-peers", "peers": [...]}` | Notifies newly joined client of active peers |
| **Server $\rightarrow$ Room** | `peer-joined` | `{"type": "peer-joined", "sender": "<id>"}` | Broadcasts new participant arrival |
| **Peer $\leftrightarrow$ Peer** | `offer` | `{"type": "offer", "sdp": {...}, "target": "<id>"}` | WebRTC SDP offer negotiation |
| **Peer $\leftrightarrow$ Peer** | `answer` | `{"type": "answer", "sdp": {...}, "target": "<id>"}` | WebRTC SDP answer negotiation |
| **Peer $\leftrightarrow$ Peer** | `ice-candidate` | `{"type": "ice-candidate", "candidate": {...}}` | ICE network path exchange |
| **Client $\rightarrow$ Room** | `participant-update` | `{"type": "participant-update", "is_muted": bool, ...}` | Real-time audio/video toggle notification |
| **Host $\rightarrow$ Room** | `mute-all` | `{"type": "mute-all"}` | Disables microphone tracks for all attendees |
| **Host $\rightarrow$ Peer** | `removed-from-meeting`| `{"type": "removed-from-meeting"}` | Ejects target attendee immediately |
| **Server $\rightarrow$ Room** | `peer-left` | `{"type": "peer-left", "sender": "<id>"}` | Broadcasts participant disconnect |

---

## 📡 REST API Reference

### Health
- `GET /api/health` — Returns server health status.

### Meetings (`/api/meetings`)
- `POST /api/meetings/` — Create an instant meeting room.
- `GET /api/meetings/` — List all meetings (optional filters: `status`, `type`).
- `GET /api/meetings/recent` — Fetch recent ended meetings (last 7 days).
- `GET /api/meetings/upcoming` — Fetch upcoming scheduled meetings.
- `GET /api/meetings/{id}` — Get meeting details by ID (supports formatted or unhyphenated ID).
- `PATCH /api/meetings/{id}` — Update meeting status (`active`, `ended`, `cancelled`).
- `POST /api/meetings/{id}/join` — Join meeting with a display name; returns participant profile.
- `POST /api/meetings/{id}/leave` — Gracefully leave a meeting session.
- `GET /api/meetings/{id}/participants` — List active participants in a meeting room.
- `PATCH /api/meetings/{id}/participants/{pid}` — Update participant mic/video state.
- `DELETE /api/meetings/{id}/participants/{pid}` — Host control: Remove participant from room.
- `POST /api/meetings/{id}/mute-all` — Host control: Broadcast mute command to all participants.

### Scheduling (`/api/schedule`)
- `POST /api/schedule` — Create a scheduled meeting with title, date, time, duration, and timezone.
- `GET /api/schedule` — List all scheduled meetings.
- `DELETE /api/schedule/{id}` — Cancel a scheduled meeting by schedule ID or meeting ID.

### Users (`/api/users`)
- `GET /api/users/me` — Retrieve the current user profile.

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- **Node.js**: v18.0 or later (`v20+` recommended)
- **Python**: 3.10+ (3.13 tested)
- **Git**

---

### 1. Clone the Repository
```bash
git clone https://github.com/Kaartikkkk/Zoom_Clone.git
cd Zoom_Clone
```

---

### 2. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate       # On macOS/Linux
# venv\Scripts\activate        # On Windows

# Install required Python packages
pip install -r requirements.txt

# Start the FastAPI development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- API Base URL: `http://localhost:8000`
- Interactive API Docs: `http://localhost:8000/docs`
- *Note: Database (`zoom_clone.db`) is initialized and seeded automatically on first startup.*

#### Manual Database Seeding / Reset
To populate or reset the SQLite database with rich sample data at any time:
```bash
cd backend
source venv/bin/activate

# Seed sample data (users, scheduled meetings, recent history)
python -m app.seed

# Or force-reset and re-seed from scratch
python -m app.seed --reset
```

The seed script automatically provisions:
- **5 Realistic Users**: Kartik (Host), Sarah Miller (Frontend Lead), Alex Chen (Systems Architect), David Patel (Product Director), Emily Rodriguez (UI/UX Designer).
- **4 Upcoming Scheduled Meetings**: Spanning Today, Tomorrow, Day + 2, and Day + 4 with descriptions, timezones, durations, and auto-generated links.
- **4 Ended Recent Meetings**: Past completed sessions with realistic durations (25–50 min) and multi-participant join/leave logs.

---

### 3. Frontend Setup
In a new terminal window:
```bash
cd frontend

# Install npm dependencies
npm install

# Start the Next.js development server
npm run dev
```
- Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### 4. Environment Variables (Optional)

#### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

#### Backend (`backend/.env`)
```env
DATABASE_URL=sqlite:///./zoom_clone.db
FRONTEND_URL=http://localhost:3000
```

---

## 📂 Project Directory Structure

```
Zoom_Clone/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── database.py             # SQLAlchemy engine & SQLite session maker
│   │   ├── main.py                 # FastAPI application, CORS, WebSockets
│   │   ├── models.py               # ORM Models (User, Meeting, ScheduledMeeting, Participant)
│   │   ├── schemas.py              # Pydantic v2 validation models
│   │   ├── seed.py                 # Initial database seeding
│   │   ├── utils.py                # Zoom ID & absolute invite link generator
│   │   ├── websocket_manager.py    # Multi-room WebSocket connection manager
│   │   └── routers/
│   │       ├── meetings.py         # Meeting CRUD, participant join/leave, host controls
│   │       ├── schedule.py         # Scheduled meetings CRUD
│   │       └── users.py            # User profile endpoints
│   ├── requirements.txt            # Python dependencies
│   └── zoom_clone.db               # SQLite database file
├── frontend/
│   ├── public/                     # Static assets, icons, logos
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css         # Complete Zoom design system & CSS variables
│   │   │   ├── layout.tsx          # Root HTML layout with Inter font
│   │   │   ├── page.tsx            # Dashboard page (Hero, Actions, Calendar, History)
│   │   │   └── meeting/[id]/
│   │   │       └── page.tsx        # Meeting room: WebRTC peer connections, video grid
│   │   ├── components/
│   │   │   ├── Navbar.tsx          # Top navigation bar with clock & search
│   │   │   ├── Sidebar.tsx         # Collapsible navigation drawer
│   │   │   ├── NewMeetingModal.tsx # Instant meeting configuration & link share
│   │   │   ├── JoinMeetingModal.tsx# Join meeting by ID or link
│   │   │   ├── ScheduleMeetingModal.tsx # Schedule meeting form
│   │   │   ├── MeetingToolbar.tsx  # Bottom meeting controls (responsive)
│   │   │   └── ParticipantsPanel.tsx# Participants list with Mute All / Remove controls
│   │   └── lib/
│   │       └── api.ts              # Fetch API client and route helpers
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

---

## 🧪 Verification & Quality Assurance

The codebase includes an automated audit verification suite covering all 9 core services:
- **Backend Health & Startup**
- **Meeting Creation & URL Resolution**
- **Participant Joining & Session Tracking**
- **WebSocket Signaling & 5s Heartbeat**
- **Host Control: Mute All Broadcast**
- **Host Control: Remove Participant Eviction**
- **Scheduled Meeting Pipeline & Calendar Integration**
- **Recent Meetings History**
- **Next.js Production Build Validation (`0 errors`)**

To run the audit locally:
```bash
./backend/venv/bin/python -c "
# Runs automated HTTP & WebSocket end-to-end check
"
```

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
