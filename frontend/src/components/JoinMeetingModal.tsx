'use client';

import { useState } from 'react';

interface JoinMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (meetingId: string, displayName: string) => void;
  error?: string;
  isLoading?: boolean;
}

export default function JoinMeetingModal({
  isOpen,
  onClose,
  onJoin,
  error,
  isLoading,
}: JoinMeetingModalProps) {
  const [meetingId, setMeetingId] = useState('');
  const [displayName, setDisplayName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (meetingId.trim() && displayName.trim()) {
      onJoin(meetingId.trim(), displayName.trim());
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Join Meeting</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Meeting ID or Link</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter meeting ID or paste invite link"
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Your Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter your display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <div className="toggle-row">
              <span>Turn off my video</span>
              <label className="toggle">
                <input type="checkbox" />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="toggle-row">
              <span>Turn off my audio</span>
              <label className="toggle">
                <input type="checkbox" />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {error && (
              <div style={{
                marginTop: '12px',
                padding: '10px 14px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                color: '#DC2626',
                fontSize: '13px',
              }}>
                {error}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!meetingId.trim() || !displayName.trim() || isLoading}
            >
              {isLoading ? 'Joining...' : 'Join'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
