'use client';

import { Participant } from '@/lib/api';

interface ParticipantsPanelProps {
  participants: Participant[];
  isOpen: boolean;
  onClose: () => void;
  onMuteAll: () => void;
  onToggleMute: (participantId: number, isMuted: boolean) => void;
  onRemove: (participantId: number) => void;
  isHost: boolean;
}

export default function ParticipantsPanel({
  participants,
  isOpen,
  onClose,
  onMuteAll,
  onToggleMute,
  onRemove,
  isHost,
}: ParticipantsPanelProps) {
  if (!isOpen) return null;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="participants-panel">
      <div className="participants-panel-header">
        <h3>
          Participants
          <span className="count">({participants.length})</span>
        </h3>
        <button className="participants-panel-close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {isHost && (
        <div className="participants-panel-actions">
          <button onClick={onMuteAll}>Mute All</button>
          <button>Invite</button>
        </div>
      )}

      <div className="participants-list">
        {participants.map((p) => (
          <div key={p.id} className="participant-item">
            <div className="participant-avatar">
              {getInitials(p.display_name)}
            </div>
            <div className="participant-info">
              <div className="participant-name">
                {p.display_name.replace(/\s*\(Host\)$/i, '')}
                {p.is_host && ' (Host)'}
              </div>
              <div className="participant-role">
                {p.is_host ? 'Host' : 'Participant'}
              </div>
            </div>
            <div className="participant-controls">
              {/* Mic status */}
              <button
                className={`participant-control-btn ${p.is_muted ? 'is-muted' : ''}`}
                onClick={() => onToggleMute(p.id, !p.is_muted)}
                title={p.is_muted ? 'Unmute' : 'Mute'}
              >
                {p.is_muted ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
                    <path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .74-.11 1.45-.33 2.12" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                    <path d="M19 10v2a7 7 0 01-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                )}
              </button>

              {/* Video status */}
              <button className="participant-control-btn" title={p.is_video_on ? 'Camera on' : 'Camera off'}>
                {p.is_video_on ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                )}
              </button>

              {/* Remove button (host only, not for self) */}
              {isHost && !p.is_host && (
                <button
                  className="participant-control-btn"
                  onClick={() => onRemove(p.id)}
                  title="Remove"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
