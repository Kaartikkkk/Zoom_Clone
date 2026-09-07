'use client';

interface MeetingToolbarProps {
  isMuted: boolean;
  isVideoOn: boolean;
  isParticipantsOpen: boolean;
  participantCount: number;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleParticipants: () => void;
  onEndMeeting: () => void;
  onShareScreen: () => void;
}

export default function MeetingToolbar({
  isMuted,
  isVideoOn,
  isParticipantsOpen,
  participantCount,
  onToggleMute,
  onToggleVideo,
  onToggleParticipants,
  onEndMeeting,
  onShareScreen,
}: MeetingToolbarProps) {
  return (
    <div className="meeting-toolbar">
      {/* Mute/Unmute */}
      <button
        className={`toolbar-btn ${isMuted ? 'muted' : ''}`}
        onClick={onToggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          <div className="toolbar-btn-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
              <path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .74-.11 1.45-.33 2.12" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
            <path d="M19 10v2a7 7 0 01-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
        <span>{isMuted ? 'Unmute' : 'Mute'}</span>
      </button>

      {/* Video On/Off */}
      <button
        className={`toolbar-btn ${!isVideoOn ? 'muted' : ''}`}
        onClick={onToggleVideo}
        title={isVideoOn ? 'Stop Video' : 'Start Video'}
      >
        {!isVideoOn ? (
          <div className="toolbar-btn-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          </div>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        )}
        <span>{isVideoOn ? 'Stop Video' : 'Start Video'}</span>
      </button>

      <div className="toolbar-separator" />

      {/* Share Screen */}
      <button className="toolbar-btn" onClick={onShareScreen} title="Share Screen">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 16V4a2 2 0 012-2h16a2 2 0 012 2v12" />
          <line x1="2" y1="20" x2="22" y2="20" />
          <polyline points="12 12 12 6" />
          <polyline points="9 9 12 6 15 9" />
        </svg>
        <span>Share Screen</span>
      </button>

      {/* Participants */}
      <button
        className={`toolbar-btn ${isParticipantsOpen ? 'active' : ''}`}
        onClick={onToggleParticipants}
        title="Participants"
        style={{ position: 'relative' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
        <span>Participants</span>
        {participantCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '4px',
            right: '8px',
            background: 'var(--zoom-blue)',
            color: 'white',
            fontSize: '10px',
            fontWeight: '600',
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {participantCount}
          </span>
        )}
      </button>

      {/* Chat */}
      <button className="toolbar-btn" title="Chat">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        <span>Chat</span>
      </button>

      {/* Reactions */}
      <button className="toolbar-btn" title="Reactions">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
        <span>Reactions</span>
      </button>

      <div className="toolbar-separator" />

      {/* Record */}
      <button className="toolbar-btn" title="Record">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
        <span>Record</span>
      </button>

      {/* End Call */}
      <button className="toolbar-btn-end" onClick={onEndMeeting}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91" />
          <line x1="23" y1="1" x2="1" y2="23" />
        </svg>
        End
      </button>
    </div>
  );
}
