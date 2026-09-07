'use client';

import { useState } from 'react';

interface NewMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartMeeting: (withVideo: boolean) => void;
  meetingId?: string;
  meetingLink?: string;
  isLoading?: boolean;
}

export default function NewMeetingModal({
  isOpen,
  onClose,
  onStartMeeting,
  meetingId,
  meetingLink,
  isLoading,
}: NewMeetingModalProps) {
  const [withVideo, setWithVideo] = useState(true);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (meetingLink) {
      await navigator.clipboard.writeText(meetingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Meeting</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="toggle-row">
            <span>Start with video</span>
            <label className="toggle">
              <input
                type="checkbox"
                checked={withVideo}
                onChange={(e) => setWithVideo(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="toggle-row">
            <span>Waiting room</span>
            <label className="toggle">
              <input type="checkbox" defaultChecked />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {meetingId && (
            <div style={{ marginTop: '16px' }}>
              <div className="form-label" style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Meeting ID
              </div>
              <div style={{
                padding: '10px 14px',
                background: '#F8FAFC',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                fontWeight: 600,
                fontSize: '15px',
                color: '#0F172A',
                letterSpacing: '0.5px'
              }}>
                {meetingId}
              </div>
            </div>
          )}

          {meetingLink && (
            <div style={{ marginTop: '14px' }}>
              <div className="form-label" style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Shareable Invite Link
              </div>
              <div className="invite-link-box">
                <span className="link-text">{meetingLink}</span>
                <button type="button" className="copy-btn" onClick={handleCopy}>
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onStartMeeting(withVideo)}
            disabled={isLoading}
          >
            {isLoading ? (
              <span>Creating...</span>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
                Start Meeting
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
