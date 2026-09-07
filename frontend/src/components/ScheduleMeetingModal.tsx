'use client';

import { useState } from 'react';

interface ScheduleMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (data: {
    title: string;
    description: string;
    scheduled_date: string;
    scheduled_time: string;
    duration_minutes: number;
    timezone: string;
  }) => void;
  isLoading?: boolean;
}

export default function ScheduleMeetingModal({
  isOpen,
  onClose,
  onSchedule,
  isLoading,
}: ScheduleMeetingModalProps) {
  const getYYYYMMDD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getYYYYMMDD(tomorrow));
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState(60);
  const [timezone] = useState('Asia/Kolkata');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSchedule({
        title: title.trim(),
        description: description.trim(),
        scheduled_date: date,
        scheduled_time: time,
        duration_minutes: duration,
        timezone,
      });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Schedule Meeting</h2>
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
              <label className="form-label">Meeting Title *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Weekly Team Standup"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                placeholder="Add a description for your meeting..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={getYYYYMMDD(now)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Time *</label>
                <input
                  type="time"
                  className="form-input"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Duration</label>
                <select
                  className="form-select"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Timezone</label>
                <select className="form-select" value={timezone} disabled>
                  <option value="Asia/Kolkata">IST (Asia/Kolkata)</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">EST</option>
                  <option value="America/Los_Angeles">PST</option>
                </select>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!title.trim() || isLoading}
            >
              {isLoading ? (
                'Scheduling...'
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Schedule
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
