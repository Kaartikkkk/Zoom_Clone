'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import NewMeetingModal from '@/components/NewMeetingModal';
import JoinMeetingModal from '@/components/JoinMeetingModal';
import ScheduleMeetingModal from '@/components/ScheduleMeetingModal';
import AuthModal from '@/components/AuthModal';
import { meetingApi, scheduleApi, authApi, type Meeting, type UpcomingMeeting, type User } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [upcomingMeetings, setUpcomingMeetings] = useState<UpcomingMeeting[]>([]);
  const [recentMeetings, setRecentMeetings] = useState<Meeting[]>([]);
  const [dashboardTab, setDashboardTab] = useState<'upcoming' | 'recent'>('upcoming');
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [showJoinMeeting, setShowJoinMeeting] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [newMeetingLink, setNewMeetingLink] = useState('');
  const [newMeetingId, setNewMeetingId] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [apiError, setApiError] = useState<string | null>(null);

  // Fetch data
  const loadData = useCallback(async () => {
    try {
      setApiError(null);
      const [upcoming, recent, user] = await Promise.all([
        meetingApi.getUpcoming(),
        meetingApi.getRecent(),
        authApi.me().catch(() => null),
      ]);
      setUpcomingMeetings(upcoming);
      setRecentMeetings(recent);
      if (user) {
        setCurrentUser(user);
      }
    } catch (err: unknown) {
      console.error('Failed to load data:', err);
      setApiError('Unable to load meetings from server. Please check your connection.');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Show toast
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  // Create instant meeting
  const handleOpenNewMeeting = async () => {
    setIsLoading(true);
    try {
      const hostName = currentUser?.name || 'Kartik';
      const meeting = await meetingApi.create({ title: `${hostName}'s Zoom Meeting`, host_id: currentUser?.id || 1 });
      const cleanId = (meeting.meeting_id || String(meeting.id)).replace(/-/g, '');
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://frontend-sable-rho-u2nzn8l17o.vercel.app';
      const fullUrl = meeting.invite_link?.startsWith('http')
        ? meeting.invite_link
        : `${origin}/meeting/${cleanId}`;
      setNewMeetingId(meeting.meeting_id);
      setNewMeetingLink(fullUrl);
      setShowNewMeeting(true);
    } catch (err) {
      console.error('Failed to create instant meeting:', err);
      showToast('Failed to create instant meeting. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartMeeting = (withVideo: boolean) => {
    if (newMeetingId) {
      const cleanId = newMeetingId.replace(/-/g, '');
      setShowNewMeeting(false);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`zoom_host_${cleanId}`, 'true');
      }
      router.push(`/meeting/${cleanId}?name=Kartik&host=true`);
    } else {
      handleOpenNewMeeting();
    }
  };

  // Join meeting
  const handleJoinMeeting = async (meetingInput: string, displayName: string) => {
    setIsLoading(true);
    setJoinError('');
    try {
      let cleanId = meetingInput.trim();
      if (cleanId.includes('/meeting/')) {
        cleanId = cleanId.split('/meeting/').pop() || cleanId;
      } else if (cleanId.includes('/j/')) {
        cleanId = cleanId.split('/j/').pop() || cleanId;
      }
      cleanId = cleanId.split('?')[0].split('#')[0].replace(/-/g, '');

      if (!cleanId) {
        setJoinError('Please enter a valid Meeting ID or invite link.');
        return;
      }

      // 1. Validate meeting existence in database
      const meeting = await meetingApi.get(cleanId);
      if (!meeting) {
        setJoinError('Meeting not found. Please check the Meeting ID or invite link.');
        return;
      }

      // 2. Join meeting as participant
      const newPart = await meetingApi.join(cleanId, { display_name: displayName });
      if (typeof window !== 'undefined' && newPart?.id) {
        sessionStorage.setItem(`zoom_participant_${cleanId}`, String(newPart.id));
        sessionStorage.setItem(`zoom_name_${cleanId}`, displayName);
      }

      // 3. Navigate to meeting room
      setShowJoinMeeting(false);
      router.push(`/meeting/${cleanId}?name=${encodeURIComponent(displayName)}`);
    } catch (err: unknown) {
      const error = err as Error;
      setJoinError(error.message || 'Meeting not found. Please check the Meeting ID or invite link.');
    } finally {
      setIsLoading(false);
    }
  };

  const getYYYYMMDD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Schedule meeting
  const handleScheduleMeeting = async (data: {
    title: string;
    description: string;
    scheduled_date: string;
    scheduled_time: string;
    duration_minutes: number;
    timezone: string;
  }) => {
    setIsLoading(true);
    try {
      await scheduleApi.create(data);
      setShowSchedule(false);
      showToast('Meeting scheduled successfully!');
      if (data.scheduled_date) {
        const parts = data.scheduled_date.split('-').map(Number);
        if (parts.length === 3) {
          setSelectedDate(new Date(parts[0], parts[1] - 1, parts[2]));
        }
      }
      await loadData();
    } catch (err: unknown) {
      const error = err as Error;
      showToast(error.message || 'Failed to schedule meeting');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAuth = (tab: 'login' | 'signup' = 'login') => {
    setAuthModalTab(tab);
    setShowAuthModal(true);
  };

  const handleLogout = async () => {
    await authApi.logout();
    setCurrentUser(null);
    showToast('Signed out. Defaulting to standard profile.');
    await loadData();
  };

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    showToast(`Signed in as ${user.name}`);
    loadData();
  };

  const handleCancelSchedule = async (meetingId: number | string) => {
    try {
      const numId = typeof meetingId === 'number' ? meetingId : parseInt(String(meetingId), 10);
      if (!isNaN(numId)) {
        await scheduleApi.cancel(numId);
      }
      setUpcomingMeetings(prev => prev.filter(m => m.id !== numId));
      showToast('Scheduled meeting cancelled.');
      await loadData();
    } catch (e) {
      showToast('Scheduled meeting cancelled.');
    }
  };

  const formatTime = (date: Date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutesStr} ${ampm}`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };


  const formatMeetingTime = (timeStr?: string, isoStr?: string) => {
    if (isoStr) {
      const d = new Date(isoStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      }
    }
    if (!timeStr) return '10:00 AM';
    if (timeStr.includes(':')) {
      const [h, m] = timeStr.split(':');
      const date = new Date();
      date.setHours(parseInt(h, 10), parseInt(m, 10));
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    return timeStr;
  };

  const formatMeetingDate = (dateStr?: string, isoStr?: string) => {
    let date: Date;
    if (isoStr) {
      date = new Date(isoStr);
    } else if (dateStr) {
      date = new Date(dateStr + 'T00:00:00');
    } else {
      date = new Date();
    }
    if (isNaN(date.getTime())) date = new Date();

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '--';
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  };


  const formatMeetingId = (idStr?: string) => {
    if (!idStr) return '';
    const digits = idStr.replace(/\D/g, '');
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return idStr;
  };

  const formatRecentDate = (dateStr?: string | null) => {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="app-layout">
      <Navbar
        onNewMeeting={() => handleOpenNewMeeting()}
        onJoinMeeting={() => {
          setJoinError('');
          setShowJoinMeeting(true);
        }}
        onSchedule={() => setShowSchedule(true)}
        currentUser={currentUser}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
      />

      <div className="app-body">
        <Sidebar />

        <main className="main-content">
          <div className="page-content">
            <div className="dashboard-center-container">
              {apiError && (
                <div className="api-error-banner" style={{
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  color: '#991B1B',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '14px',
                }}>
                  <span>{apiError}</span>
                  <button
                    onClick={() => loadData()}
                    style={{
                      background: '#EF4444',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '13px',
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}
              {/* Center Clock & Date */}
              <div className="zoom-clock-container" suppressHydrationWarning>
                <div className="zoom-clock-time" suppressHydrationWarning>{mounted ? formatTime(currentTime) : ''}</div>
                <div className="zoom-clock-date" suppressHydrationWarning>{mounted ? formatDate(currentTime) : ''}</div>
              </div>

            {/* 5 Iconic Squircle Action Tiles */}
            <div className="action-tiles-row">
              <div className="action-tile-wrapper">
                <button
                  className="action-tile orange"
                  onClick={() => handleOpenNewMeeting()}
                >
                  <div className="tile-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <rect x="2" y="5" width="13" height="14" rx="3" />
                      <polygon points="17 8.5 22 5 22 19 17 15.5" />
                    </svg>
                  </div>
                </button>
                <div className="tile-label-row">
                  <span>New meeting</span>
                  <svg className="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              <div className="action-tile-wrapper">
                <button
                  className="action-tile blue"
                  onClick={() => {
                    setJoinError('');
                    setShowJoinMeeting(true);
                  }}
                >
                  <div className="tile-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </div>
                </button>
                <div className="tile-label-row">
                  <span>Join</span>
                </div>
              </div>

              <div className="action-tile-wrapper">
                <button
                  className="action-tile blue"
                  onClick={() => setShowSchedule(true)}
                >
                  <div className="tile-icon tile-calendar-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="3" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="9" x2="21" y2="9" />
                      <text x="12" y="17" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none">19</text>
                    </svg>
                  </div>
                </button>
                <div className="tile-label-row">
                  <span>Schedule</span>
                </div>
              </div>

              <div className="action-tile-wrapper">
                <button
                  className="action-tile blue"
                  onClick={() => showToast('Enter Meeting ID to share screen')}
                >
                  <div className="tile-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="16" rx="3" />
                      <path d="M12 16V8M8 12l4-4 4 4" />
                    </svg>
                  </div>
                </button>
                <div className="tile-label-row">
                  <span>Share screen</span>
                </div>
              </div>

              <div className="action-tile-wrapper">
                <button
                  className="action-tile blue"
                  onClick={() => showToast('My Notes opening...')}
                >
                  <div className="tile-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14.06 2.54a1.5 1.5 0 012.12 0l5.28 5.28a1.5 1.5 0 010 2.12l-9.5 9.5a1.5 1.5 0 01-.71.39l-4.5 1.13a1 1 0 01-1.22-1.22l1.13-4.5a1.5 1.5 0 01.39-.71l9.51-9.51z" />
                      <path d="M4 4l1.2 2.4L7.6 7.6 5.2 8.8 4 11.2 2.8 8.8 0.4 7.6 2.8 6.4 4 4z" />
                    </svg>
                  </div>
                </button>
                <div className="tile-label-row">
                  <span>My Notes</span>
                </div>
              </div>

            </div>

            {/* Light Schedule Container Card */}
            <div id="upcoming" className="schedule-card-container">
              <div className="schedule-card-header">
                <div className="schedule-tabs-toggle">
                  <button
                    className={`schedule-tab-btn ${dashboardTab === 'upcoming' ? 'active' : ''}`}
                    onClick={() => setDashboardTab('upcoming')}
                  >
                    Upcoming ({upcomingMeetings.length})
                  </button>
                  <button
                    className={`schedule-tab-btn ${dashboardTab === 'recent' ? 'active' : ''}`}
                    onClick={() => setDashboardTab('recent')}
                  >
                    Recent ({recentMeetings.length})
                  </button>
                </div>

                {dashboardTab === 'upcoming' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button className="schedule-add-btn" onClick={() => setShowSchedule(true)} title="Add Meeting">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                    <button className="schedule-date-dropdown" onClick={() => setSelectedDate(new Date())}>
                      <span suppressHydrationWarning>
                        {mounted && (selectedDate.toDateString() === new Date().toDateString()
                          ? `Today, ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                          : selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))}
                      </span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    className="schedule-action-btn"
                    style={{ margin: 0, padding: '4px 10px', fontSize: '12px' }}
                    onClick={() => handleOpenNewMeeting()}
                  >
                    + New Meeting
                  </button>
                )}
              </div>

              {dashboardTab === 'upcoming' && (
                <div className="schedule-card-nav">
                  <button className="nav-today-btn" onClick={() => setSelectedDate(new Date())}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                    </svg>
                    Today
                  </button>
                  <div className="nav-arrows">
                    <button
                      className="arrow-btn"
                      title="Previous Day"
                      onClick={() => {
                        const prev = new Date(selectedDate);
                        prev.setDate(prev.getDate() - 1);
                        setSelectedDate(prev);
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                    <button
                      className="arrow-btn"
                      title="Next Day"
                      onClick={() => {
                        const next = new Date(selectedDate);
                        next.setDate(next.getDate() + 1);
                        setSelectedDate(next);
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>
                  <button className="more-opt-btn" onClick={() => loadData()} title="Refresh meetings">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="1" />
                      <circle cx="19" cy="12" r="1" />
                      <circle cx="5" cy="12" r="1" />
                    </svg>
                  </button>
                </div>
              )}

              <div className="schedule-card-body">
                {dashboardTab === 'recent' ? (
                  recentMeetings.length === 0 ? (
                    <div className="schedule-empty-state">
                      <p className="empty-text">No recent meetings yet.</p>
                      <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                        Completed or ended meetings will appear here automatically.
                      </p>
                      <button className="schedule-action-btn" onClick={() => handleOpenNewMeeting()}>
                        Start a new meeting
                      </button>
                    </div>
                  ) : (
                    <div className="meeting-list-items">
                      {recentMeetings.map((meeting) => {
                        const mId = meeting.meeting_id || (meeting as any).meeting_code || String(meeting.id);
                        const cleanId = mId.replace(/-/g, '');
                        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://frontend-sable-rho-u2nzn8l17o.vercel.app';
                        const inviteUrl = meeting.invite_link?.startsWith('http')
                          ? meeting.invite_link
                          : `${origin}/meeting/${cleanId}`;

                        return (
                          <div key={meeting.id} className="zoom-meeting-row">
                            <div className="meeting-time-col">
                              <span className="time-str">
                                {formatRecentDate(meeting.ended_at || meeting.started_at || meeting.created_at || (meeting as any).start_time)}
                              </span>
                              <span className="date-str">
                                {formatDuration(meeting.duration_minutes)}
                              </span>
                            </div>
                            <div className="meeting-details-col">
                              <h4>{meeting.title}</h4>
                              <p>ID: {formatMeetingId(mId)} • {meeting.participant_count || 1} participant{(meeting.participant_count || 1) > 1 ? 's' : ''}</p>
                            </div>
                            <div className="meeting-btns-col" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <button
                                className="zoom-start-btn"
                                onClick={() => {
                                  if (typeof window !== 'undefined') {
                                    sessionStorage.setItem(`zoom_host_${cleanId}`, 'true');
                                  }
                                  router.push(`/meeting/${cleanId}?name=Kartik&host=true`);
                                }}
                                title="Re-open meeting"
                              >
                                Re-open
                              </button>
                              <button
                                className="zoom-copy-btn"
                                onClick={async () => {
                                  await navigator.clipboard.writeText(inviteUrl);
                                  showToast('Shareable invite link copied to clipboard!');
                                }}
                                title="Copy meeting link"
                              >
                                Copy Link
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  (() => {
                    const dateStr = getYYYYMMDD(selectedDate);
                    const dayMeetings = upcomingMeetings.filter(
                      (m) => m.scheduled_date && m.scheduled_date.startsWith(dateStr)
                    );
                    const activeMeetings = dayMeetings.length > 0 ? dayMeetings : upcomingMeetings;

                    if (activeMeetings.length === 0) {
                      return (
                        <div className="schedule-empty-state">
                          <div className="umbrella-illustration">
                            <svg width="140" height="110" viewBox="0 0 200 180" fill="none">
                              <ellipse cx="115" cy="155" rx="75" ry="22" fill="#F0F3FC" />
                              <polygon points="80,140 155,140 188,154 113,154" fill="#D3DCF8" />
                              <polygon points="98,140 110,140 143,154 131,154" fill="#F0F3FC" />
                              <polygon points="126,140 138,140 171,154 159,154" fill="#F0F3FC" />
                              <polygon points="105,58 109,59 88,168 84,167" fill="#C4D0F5" />
                              <polygon points="25,42 112,18 105,58" fill="#BCC8F2" />
                              <polygon points="25,42 105,58 182,84" fill="#A0B2E8" />
                              <polygon points="112,18 182,84 105,58" fill="#E6EEFE" />
                            </svg>
                          </div>
                          <p className="empty-text">No meetings scheduled.</p>
                          <button className="schedule-action-btn" onClick={() => setShowSchedule(true)}>
                            + Schedule a meeting
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="meeting-list-items">
                        {activeMeetings.map((meeting) => {
                          const mId = meeting.meeting_id || meeting.meeting_code || String(meeting.id);
                          const cleanId = mId.replace(/-/g, '');
                          const origin = typeof window !== 'undefined' ? window.location.origin : 'https://frontend-sable-rho-u2nzn8l17o.vercel.app';
                          const inviteUrl = meeting.invite_link?.startsWith('http')
                            ? meeting.invite_link
                            : `${origin}/meeting/${cleanId}`;

                          return (
                            <div key={meeting.id} className="zoom-meeting-row">
                              <div className="meeting-time-col">
                                <span className="time-str">
                                  {formatMeetingTime(meeting.scheduled_time, meeting.start_time)}
                                </span>
                                <span className="date-str">
                                  {formatMeetingDate(meeting.scheduled_date, meeting.start_time)}
                                </span>
                              </div>
                              <div className="meeting-details-col">
                                <h4>{meeting.title}</h4>
                                <p>ID: {formatMeetingId(mId)} • {formatDuration(meeting.duration_minutes)}</p>
                                {meeting.description && (
                                  <p className="meeting-desc-sub" style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                                    {meeting.description}
                                  </p>
                                )}
                              </div>
                              <div className="meeting-btns-col" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                  className="zoom-start-btn"
                                  onClick={() => {
                                    if (typeof window !== 'undefined') {
                                      sessionStorage.setItem(`zoom_host_${cleanId}`, 'true');
                                    }
                                    router.push(`/meeting/${cleanId}?name=Kartik&host=true`);
                                  }}
                                >
                                  Start
                                </button>
                                <button
                                  className="zoom-copy-btn"
                                  onClick={async () => {
                                    await navigator.clipboard.writeText(inviteUrl);
                                    showToast('Shareable invite link copied to clipboard!');
                                  }}
                                >
                                  Copy Link
                                </button>
                                <button
                                  className="zoom-cancel-btn"
                                  onClick={() => handleCancelSchedule(meeting.id)}
                                  title="Cancel Scheduled Meeting"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </div>

              <div className="schedule-card-footer">
                {dashboardTab === 'upcoming' ? (
                  <button
                    onClick={() => {
                      setDashboardTab('recent');
                      const el = document.getElementById('recent');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="open-recordings-link"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    View past & recent meetings ({recentMeetings.length}) <span>&rsaquo;</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setDashboardTab('upcoming')}
                    className="open-recordings-link"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    View upcoming scheduled meetings ({upcomingMeetings.length}) <span>&rsaquo;</span>
                  </button>
                )}
              </div>
            </div>

            {/* Recent Meetings Table */}
            <section id="recent" className="section dark-recent-section">
              <div className="section-header">
                <h2 className="section-title">Recent Meetings</h2>
              </div>
              {recentMeetings.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#475569', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', fontSize: '14px' }}>
                  No recent meetings yet. Completed or ended meetings will appear here automatically.
                </div>
              ) : (
                <table className="recent-table dark-table">
                  <thead>
                    <tr>
                      <th>Meeting</th>
                      <th>Date</th>
                      <th>Duration</th>
                      <th>Participants</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentMeetings.map((meeting) => {
                      const rawId = meeting.meeting_id || (meeting as any).meeting_code || String(meeting.id);
                      const displayId = formatMeetingId(rawId);
                      return (
                        <tr key={meeting.id}>
                          <td>
                            <div className="meeting-title-cell">
                              <div className="meeting-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                  <rect x="2" y="5" width="13" height="14" rx="3" />
                                  <polygon points="17 8.5 22 5 22 19 17 15.5" />
                                </svg>
                              </div>
                              <div className="meeting-title-meta">
                                <div className="meeting-title-text">{meeting.title}</div>
                                <div className="meeting-id-sub">
                                  ID: {displayId}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>{formatRecentDate(meeting.ended_at || meeting.started_at || meeting.created_at || (meeting as any).start_time)}</td>
                          <td>{formatDuration(meeting.duration_minutes)}</td>
                          <td>{meeting.participant_count || 1}</td>
                          <td>
                            <span className={`status-badge ${meeting.status}`}>
                              <span className="dot"></span>
                              {meeting.status ? meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1) : 'Ended'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
            </div>
          </div>

        </main>
      </div>

      {/* Modals */}
      <NewMeetingModal
        isOpen={showNewMeeting}
        onClose={() => setShowNewMeeting(false)}
        onStartMeeting={handleStartMeeting}
        meetingId={newMeetingId}
        meetingLink={newMeetingLink}
        isLoading={isLoading}
      />

      <JoinMeetingModal
        isOpen={showJoinMeeting}
        onClose={() => setShowJoinMeeting(false)}
        onJoin={handleJoinMeeting}
        error={joinError}
        isLoading={isLoading}
      />

      <ScheduleMeetingModal
        isOpen={showSchedule}
        onClose={() => setShowSchedule(false)}
        onSchedule={handleScheduleMeeting}
        isLoading={isLoading}
      />

      <AuthModal
        isOpen={showAuthModal}
        initialTab={authModalTab}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

