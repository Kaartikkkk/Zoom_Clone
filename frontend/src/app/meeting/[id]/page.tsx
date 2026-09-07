'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import MeetingToolbar from '@/components/MeetingToolbar';
import ParticipantsPanel from '@/components/ParticipantsPanel';
import { meetingApi, type Meeting, type Participant } from '@/lib/api';

interface MeetingPageProps {
  params: Promise<{ id: string }>;
}

export default function MeetingRoom({ params }: MeetingPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState('');
  const [myParticipantId, setMyParticipantId] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [speakingId, setSpeakingId] = useState<number | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  // Load meeting
  const loadMeeting = useCallback(async () => {
    try {
      let m: Meeting | null = null;
      let meetingError = '';

      // 1. Try to fetch existing meeting from backend
      try {
        m = await meetingApi.get(id);
      } catch (err: unknown) {
        const error = err as Error;
        meetingError = error.message || 'Meeting not found. Please check the Meeting ID or invite link.';
      }

      if (!m) {
        setError(meetingError || 'Meeting not found. Please check the Meeting ID or invite link.');
        return;
      }

      setMeeting(m);
      setError('');

      // Try updating backend status if waiting/ended
      if (m.meeting_id && (m.status === 'waiting' || m.status === 'ended')) {
        try {
          const updated = await meetingApi.update(m.meeting_id, { status: 'active' });
          setMeeting(updated);
        } catch (e) { /* ignore */ }
      }

      // Try fetching participants from backend
      let parts: Participant[] = [];
      if (m.meeting_id) {
        try {
          parts = await meetingApi.getParticipants(m.meeting_id);
        } catch (e) { /* ignore */ }
      }

      // Check if custom display name was passed via query string (from Join Meeting)
      let customName = '';
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        customName = urlParams.get('name') || '';
      }

      // Seed default participants if empty so room displays active tiles
      if (!parts || parts.length === 0) {
        const myName = customName || (m.host_name ? `${m.host_name} (Host)` : 'Kartik (Host)');
        parts = [
          {
            id: 101,
            meeting_id: m.id || 1,
            user_id: 1,
            display_name: myName,
            joined_at: new Date().toISOString(),
            left_at: null,
            is_host: true,
            is_muted: false,
            is_video_on: true,
          },
          {
            id: 102,
            meeting_id: m.id || 1,
            user_id: 2,
            display_name: 'Priya Sharma',
            joined_at: new Date().toISOString(),
            left_at: null,
            is_host: false,
            is_muted: true,
            is_video_on: true,
          },
          {
            id: 103,
            meeting_id: m.id || 1,
            user_id: 3,
            display_name: 'Rahul Verma',
            joined_at: new Date().toISOString(),
            left_at: null,
            is_host: false,
            is_muted: false,
            is_video_on: true,
          },
        ];
      } else if (customName) {
        // Ensure custom user display name is visible in participant list
        const exists = parts.some(p => p.display_name.toLowerCase() === customName.toLowerCase());
        if (!exists) {
          parts.unshift({
            id: Date.now(),
            meeting_id: m.id || 1,
            user_id: null,
            display_name: customName,
            joined_at: new Date().toISOString(),
            left_at: null,
            is_host: false,
            is_muted: false,
            is_video_on: true,
          });
        }
      }

      setParticipants(parts);
      const myPart = customName 
        ? parts.find(p => p.display_name.toLowerCase() === customName.toLowerCase()) || parts[0]
        : (parts.find(p => p.is_host) || parts[0]);
      setMyParticipantId(myPart ? myPart.id : 101);
    } catch (err) {
      console.error('Meeting load error:', err);
      setError('Meeting not found. Please check the Meeting ID or invite link.');
    }
  }, [id]);

  useEffect(() => {
    loadMeeting();
  }, [loadMeeting]);

  // Timer
  useEffect(() => {
    if (!meeting || meeting.status === 'ended') return;
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [meeting]);

  // Simulate random speaking
  useEffect(() => {
    if (participants.length === 0) return;
    const interval = setInterval(() => {
      const randomIdx = Math.floor(Math.random() * participants.length);
      setSpeakingId(participants[randomIdx]?.id || null);
      setTimeout(() => setSpeakingId(null), 2000 + Math.random() * 3000);
    }, 4000 + Math.random() * 4000);
    return () => clearInterval(interval);
  }, [participants]);

  // Poll participants
  useEffect(() => {
    if (!meeting) return;
    const interval = setInterval(async () => {
      try {
        const parts = await meetingApi.getParticipants(meeting.meeting_id);
        setParticipants(parts);
      } catch (e) { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [meeting]);

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleToggleMute = async () => {
    setIsMuted(!isMuted);
    if (myParticipantId && meeting) {
      try {
        await meetingApi.updateParticipant(meeting.meeting_id, myParticipantId, {
          is_muted: !isMuted,
        });
      } catch (e) { /* ignore */ }
    }
  };

  const handleToggleVideo = async () => {
    setIsVideoOn(!isVideoOn);
    if (myParticipantId && meeting) {
      try {
        await meetingApi.updateParticipant(meeting.meeting_id, myParticipantId, {
          is_video_on: !isVideoOn,
        });
      } catch (e) { /* ignore */ }
    }
  };

  const handleEndMeeting = async () => {
    if (meeting) {
      try {
        await meetingApi.update(meeting.meeting_id, { status: 'ended' });
      } catch (e) { /* ignore */ }
    }
    router.push('/');
  };

  const handleMuteAll = async () => {
    setParticipants(prev =>
      prev.map(p => (p.is_host ? p : { ...p, is_muted: true }))
    );
    showToast('All participants muted');

    if (meeting) {
      try {
        await meetingApi.muteAll(meeting.meeting_id);
        const parts = await meetingApi.getParticipants(meeting.meeting_id);
        if (parts && parts.length > 0) setParticipants(parts);
      } catch (e) { /* ignore */ }
    }
  };

  const handleToggleParticipantMute = async (participantId: number, isMutedNew: boolean) => {
    setParticipants(prev =>
      prev.map(p => (p.id === participantId ? { ...p, is_muted: isMutedNew } : p))
    );

    if (meeting) {
      try {
        await meetingApi.updateParticipant(meeting.meeting_id, participantId, {
          is_muted: isMutedNew,
        });
        const parts = await meetingApi.getParticipants(meeting.meeting_id);
        if (parts && parts.length > 0) setParticipants(parts);
      } catch (e) { /* ignore */ }
    }
  };

  const handleRemoveParticipant = async (participantId: number) => {
    setParticipants(prev => prev.filter(p => p.id !== participantId));
    showToast('Participant removed');

    if (meeting) {
      try {
        await meetingApi.removeParticipant(meeting.meeting_id, participantId);
        const parts = await meetingApi.getParticipants(meeting.meeting_id);
        if (parts && parts.length > 0) setParticipants(parts);
      } catch (e) { /* ignore */ }
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getGridClass = () => {
    const count = participants.length;
    if (count <= 1) return 'grid-1';
    if (count <= 2) return 'grid-2';
    if (count <= 4) return 'grid-4';
    return 'grid-6';
  };

  const gradients = [
    'linear-gradient(135deg, #0B5CFF, #7B61FF)',
    'linear-gradient(135deg, #F26D21, #FF8A47)',
    'linear-gradient(135deg, #0E9AA7, #36C7D4)',
    'linear-gradient(135deg, #7B61FF, #B794F6)',
    'linear-gradient(135deg, #E02828, #FF6B6B)',
    'linear-gradient(135deg, #2D8C41, #4ADE80)',
  ];

  if (error) {
    return (
      <div className="meeting-room" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <h2 style={{ marginTop: '16px', fontSize: '20px', fontWeight: 500 }}>{error}</h2>
          <button
            className="btn btn-primary"
            style={{ marginTop: '24px' }}
            onClick={() => router.push('/')}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="meeting-room" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(255,255,255,0.2)',
            borderTopColor: 'var(--zoom-blue)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p>Connecting to meeting...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div className="meeting-room">
      {/* Header */}
      <div className="meeting-room-header">
        <div className="meeting-info">
          <span className="meeting-title-text">{meeting.title}</span>
          <span className="meeting-id-text">ID: {meeting.meeting_id}</span>
        </div>

        <div className="meeting-timer">
          <span className="rec-dot"></span>
          <span>{formatElapsed(elapsedTime)}</span>
        </div>

        <div className="header-controls">
          <div className="shield-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Encrypted
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="meeting-room-body">
        <div className="video-grid-container">
          <div className={`video-grid ${getGridClass()}`}>
            {participants.map((p, i) => (
              <div
                key={p.id}
                className={`video-tile ${speakingId === p.id ? 'is-speaking' : ''}`}
              >
                <div
                  className="video-tile-avatar"
                  style={{ background: gradients[i % gradients.length] }}
                >
                  {getInitials(p.display_name)}
                </div>
                <div className="video-tile-name">
                  {p.is_muted && (
                    <svg className="muted-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
                      <path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .74-.11 1.45-.33 2.12" />
                    </svg>
                  )}
                  {p.display_name}
                  {p.is_host && ' (Host)'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Participants Panel */}
        <ParticipantsPanel
          participants={participants}
          isOpen={showParticipants}
          onClose={() => setShowParticipants(false)}
          onMuteAll={handleMuteAll}
          onToggleMute={handleToggleParticipantMute}
          onRemove={handleRemoveParticipant}
          isHost={true}
        />
      </div>

      {/* Toolbar */}
      <MeetingToolbar
        isMuted={isMuted}
        isVideoOn={isVideoOn}
        isParticipantsOpen={showParticipants}
        participantCount={participants.length}
        onToggleMute={handleToggleMute}
        onToggleVideo={handleToggleVideo}
        onToggleParticipants={() => setShowParticipants(!showParticipants)}
        onEndMeeting={handleEndMeeting}
        onShareScreen={() => showToast('Screen sharing is a placeholder feature')}
      />

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
