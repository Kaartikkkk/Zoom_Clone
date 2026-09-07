'use client';

import { useState, useEffect, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import MeetingToolbar from '@/components/MeetingToolbar';
import ParticipantsPanel from '@/components/ParticipantsPanel';
import ChatPanel, { type ChatMessage } from '@/components/ChatPanel';
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
  const [showChat, setShowChat] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'System',
      text: 'Welcome to the Zoom meeting! Chat messages are end-to-end encrypted.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState('');
  const [myParticipantId, setMyParticipantId] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [activeReactions, setActiveReactions] = useState<{ id: string; emoji: string; left: number }[]>([]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  // Request WebRTC Camera & Microphone stream
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function initMedia() {
      if (typeof window === 'undefined') return;
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.warn('getUserMedia is not supported on this browser or context.');
          return;
        }
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(activeStream);

        // Apply initial mute/video settings
        activeStream.getVideoTracks().forEach((track) => {
          track.enabled = isVideoOn;
        });
        activeStream.getAudioTracks().forEach((track) => {
          track.enabled = !isMuted;
        });
      } catch (err: any) {
        console.warn('Webcam or Microphone permission denied or unavailable:', err);
        showToast('Camera/Microphone permissions required for video & audio.');
      }
    }

    if (meeting) {
      initMedia();
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [meeting]);

  // Sync video track with state
  useEffect(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOn;
      });
    }
  }, [isVideoOn, localStream]);

  // Sync audio track with state
  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted, localStream]);

  // Real microphone audio level detection for speaking border
  useEffect(() => {
    if (!localStream || isMuted) return;

    let audioContext: AudioContext | null = null;
    let animId: number;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
        const source = audioContext.createMediaStreamSource(localStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const checkVolume = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          if (average > 15 && myParticipantId) {
            setSpeakingId(myParticipantId);
          }
          animId = requestAnimationFrame(checkVolume);
        };
        checkVolume();
      }
    } catch (e) {
      /* ignore audio context errors */
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  }, [localStream, isMuted, myParticipantId]);

  // Attach localStream to video element when available
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoOn, participants]);

  // Attach screenStream to video element when active
  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  // Load meeting
  const loadMeeting = useCallback(async () => {
    try {
      let m: Meeting | null = null;
      let meetingError = '';

      // 1. Fetch meeting from backend
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

      if (m.status === 'ended') {
        setError('This meeting has ended.');
        setMeeting(m);
        return;
      }

      setMeeting(m);
      setError('');

      // Update status to active if waiting
      if (m.meeting_id && m.status === 'waiting') {
        try {
          const updated = await meetingApi.update(m.meeting_id, { status: 'active' });
          setMeeting(updated);
        } catch (e) { /* ignore */ }
      }

      // Check if custom display name was passed via URL (?name=...)
      let customName = '';
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        customName = urlParams.get('name') || '';
      }

      // 2. Fetch active participants from backend SQLite
      let parts: Participant[] = [];
      try {
        parts = await meetingApi.getParticipants(m.meeting_id);
      } catch (e) { /* ignore */ }

      // 3. Register user in backend if not present
      const userDisplayName = (customName.trim() || (m.host_name ? m.host_name : 'Kartik')).replace(/\s*\(Host\)$/i, '');
      const alreadyJoined = parts.some(p => p.display_name.replace(/\s*\(Host\)$/i, '').toLowerCase() === userDisplayName.toLowerCase());

      if (!alreadyJoined) {
        try {
          const newPart = await meetingApi.join(m.meeting_id, { display_name: userDisplayName });
          parts = await meetingApi.getParticipants(m.meeting_id);
          if (!parts.some(p => p.id === newPart.id)) {
            parts.push(newPart);
          }
        } catch (e) { /* ignore */ }
      }

      setParticipants(parts);

      const myPart = parts.find(p => p.display_name.replace(/\s*\(Host\)$/i, '').toLowerCase() === userDisplayName.toLowerCase()) || parts[0];
      if (myPart) {
        setMyParticipantId(myPart.id);
      }
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

  // Poll participants from database every 5s
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
    const newMuted = !isMuted;
    setIsMuted(newMuted);

    if (localStream) {
      localStream.getAudioTracks().forEach(t => (t.enabled = !newMuted));
    }

    if (myParticipantId && meeting) {
      try {
        await meetingApi.updateParticipant(meeting.meeting_id, myParticipantId, {
          is_muted: newMuted,
        });
      } catch (e) { /* ignore */ }
    }
  };

  const handleToggleVideo = async () => {
    const newVideo = !isVideoOn;
    setIsVideoOn(newVideo);

    if (localStream) {
      localStream.getVideoTracks().forEach(t => (t.enabled = newVideo));
    }

    if (myParticipantId && meeting) {
      try {
        await meetingApi.updateParticipant(meeting.meeting_id, myParticipantId, {
          is_video_on: newVideo,
        });
      } catch (e) { /* ignore */ }
    }
  };

  // Real Screen Sharing
  const handleShareScreen = async () => {
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
      showToast('Screen sharing stopped.');
    } else {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          showToast('Screen sharing is not supported in this browser.');
          return;
        }
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setScreenStream(stream);
        showToast('Screen sharing active!');
        stream.getVideoTracks()[0].onended = () => {
          setScreenStream(null);
          showToast('Screen sharing stopped.');
        };
      } catch (err: any) {
        if (err.name !== 'NotAllowedError') {
          showToast('Screen sharing failed or cancelled.');
        }
      }
    }
  };

  // Live Chat Handling
  const handleSendMessage = (text: string) => {
    const me = participants.find(p => p.id === myParticipantId) || participants[0];
    const newMsg: ChatMessage = {
      id: String(Date.now()),
      sender: me ? me.display_name : 'Me',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
    };
    setMessages(prev => [...prev, newMsg]);
  };

  // Reactions Handling
  const handleReaction = (emoji: string) => {
    const reactionId = String(Date.now()) + Math.random();
    const leftPercent = 20 + Math.random() * 60;
    setActiveReactions(prev => [...prev, { id: reactionId, emoji, left: leftPercent }]);
    showToast(`Reaction sent: ${emoji}`);

    setTimeout(() => {
      setActiveReactions(prev => prev.filter(r => r.id !== reactionId));
    }, 2500);
  };

  // Live Recording Toggle
  const handleToggleRecord = () => {
    setIsRecording(!isRecording);
    showToast(!isRecording ? '● Recording started' : 'Recording stopped & saved');
  };

  const handleEndMeeting = async () => {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
    }
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
    }
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
    <div className="meeting-room" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Floating Emoji Reactions Overlay */}
      {activeReactions.map((r) => (
        <div
          key={r.id}
          className="floating-reaction"
          style={{ left: `${r.left}%`, bottom: '90px' }}
        >
          {r.emoji}
        </div>
      ))}

      {/* Header */}
      <div className="meeting-room-header">
        <div className="meeting-info">
          <span className="meeting-title-text">{meeting.title}</span>
          <span className="meeting-id-text">ID: {meeting.meeting_id}</span>
        </div>

        <div className="meeting-timer">
          <span className="rec-dot" style={{ background: isRecording ? '#EF4444' : '#10B981' }}></span>
          {isRecording && <span style={{ color: '#EF4444', fontWeight: 700, marginRight: '4px' }}>REC</span>}
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
        <div className="video-grid-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Live Screen Share Display */}
          {screenStream && (
            <div style={{
              width: '100%',
              height: '50vh',
              background: '#0F0F1A',
              borderRadius: '12px',
              overflow: 'hidden',
              position: 'relative',
              border: '2px solid #10B981'
            }}>
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '16px',
                background: 'rgba(0,0,0,0.7)',
                color: '#10B981',
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                zIndex: 5
              }}>
                ● You are sharing your screen
              </div>
              <video
                ref={(el) => {
                  screenVideoRef.current = el;
                  if (el && screenStream) el.srcObject = screenStream;
                }}
                autoPlay
                playsInline
                className="video-tile-video"
                style={{ transform: 'none' }}
              />
            </div>
          )}

          {/* Video Grid */}
          <div className={`video-grid ${getGridClass()}`}>
            {participants.map((p, i) => {
              const isMe = p.id === myParticipantId || (p.is_host && (!myParticipantId || myParticipantId === 101));
              const showLiveVideo = isMe && isVideoOn && localStream && localStream.getVideoTracks().some(t => t.enabled);

              return (
                <div
                  key={p.id}
                  className={`video-tile ${speakingId === p.id ? 'is-speaking' : ''}`}
                >
                  {showLiveVideo ? (
                    <video
                      ref={(el) => {
                        localVideoRef.current = el;
                        if (el && localStream) {
                          el.srcObject = localStream;
                        }
                      }}
                      autoPlay
                      playsInline
                      muted
                      className="video-tile-video"
                    />
                  ) : (
                    <div
                      className="video-tile-avatar"
                      style={{ background: gradients[i % gradients.length] }}
                    >
                      {getInitials(p.display_name)}
                    </div>
                  )}

                  <div className="video-tile-name">
                    {(isMe ? isMuted : p.is_muted) && (
                      <svg className="muted-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="1" y1="1" x2="23" y2="23" />
                        <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
                        <path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .74-.11 1.45-.33 2.12" />
                      </svg>
                    )}
                    {p.display_name.replace(/\s*\(Host\)$/i, '')}
                    {p.is_host && ' (Host)'}
                  </div>
                </div>
              );
            })}
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

        {/* Chat Panel */}
        <ChatPanel
          isOpen={showChat}
          onClose={() => setShowChat(false)}
          messages={messages}
          onSendMessage={handleSendMessage}
        />
      </div>

      {/* Toolbar */}
      <MeetingToolbar
        isMuted={isMuted}
        isVideoOn={isVideoOn}
        isParticipantsOpen={showParticipants}
        isChatOpen={showChat}
        isRecording={isRecording}
        isScreenSharing={!!screenStream}
        participantCount={participants.length}
        unreadChatCount={unreadChatCount}
        onToggleMute={handleToggleMute}
        onToggleVideo={handleToggleVideo}
        onToggleParticipants={() => {
          setShowParticipants(!showParticipants);
          if (!showParticipants) setShowChat(false);
        }}
        onToggleChat={() => {
          setShowChat(!showChat);
          if (!showChat) {
            setShowParticipants(false);
            setUnreadChatCount(0);
          }
        }}
        onToggleRecord={handleToggleRecord}
        onShareScreen={handleShareScreen}
        onEndMeeting={handleEndMeeting}
        onReaction={handleReaction}
      />

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}


