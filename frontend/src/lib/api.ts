const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }

  return res.json();
}

// ─── Local Storage Fallback Helpers ──────────────────────
const getStoredMeetings = (): Meeting[] => {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem('zoom_clone_meetings');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveStoredMeeting = (meeting: Meeting) => {
  if (typeof window === 'undefined') return;
  try {
    const meetings = getStoredMeetings();
    const existingIdx = meetings.findIndex(m => m.meeting_id === meeting.meeting_id || m.id === meeting.id);
    if (existingIdx >= 0) {
      meetings[existingIdx] = { ...meetings[existingIdx], ...meeting };
    } else {
      meetings.unshift(meeting);
    }
    localStorage.setItem('zoom_clone_meetings', JSON.stringify(meetings));
  } catch { /* ignore */ }
};

const getStoredScheduled = (): ScheduledMeeting[] => {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem('zoom_clone_scheduled');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveStoredScheduled = (scheduled: ScheduledMeeting) => {
  if (typeof window === 'undefined') return;
  try {
    const list = getStoredScheduled();
    list.unshift(scheduled);
    localStorage.setItem('zoom_clone_scheduled', JSON.stringify(list));
  } catch { /* ignore */ }
};

// ─── Interfaces ──────────────────────────────────────────
export interface Meeting {
  id: number;
  meeting_id: string;
  title: string;
  host_id: number;
  host_name: string | null;
  status: 'waiting' | 'active' | 'ended';
  type: 'instant' | 'scheduled';
  invite_link: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  participant_count: number;
}

export interface ScheduledMeeting {
  id: number;
  meeting_id: string;
  title: string;
  description: string | null;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  timezone: string;
  recurring: boolean;
  invite_link: string;
  status: string;
  host_name: string | null;
  created_at: string;
}

export interface UpcomingMeeting {
  id: number;
  meeting_id?: string;
  meeting_code?: string;
  title: string;
  host_name?: string | null;
  status: string;
  invite_link?: string;
  invite_token?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  start_time?: string;
  duration_minutes: number;
  description?: string | null;
  timezone?: string;
  recurring?: boolean;
}

export interface Participant {
  id: number;
  meeting_id: number;
  user_id: number | null;
  display_name: string;
  joined_at: string;
  left_at: string | null;
  is_host: boolean;
  is_muted: boolean;
  is_video_on: boolean;
}

export interface User {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
  personal_meeting_id: string;
  created_at: string;
}

// ─── Meeting API ──────────────────────────────────────────
export const meetingApi = {
  create: async (data: { title?: string; host_id?: number } = {}): Promise<Meeting> => {
    try {
      const meeting = await apiFetch<Meeting>('/api/meetings', { method: 'POST', body: JSON.stringify(data) });
      saveStoredMeeting(meeting);
      return meeting;
    } catch (e) {
      console.warn('Backend unavailable, generating client fallback meeting:', e);
      const rand1 = Math.floor(100 + Math.random() * 900);
      const rand2 = Math.floor(1000 + Math.random() * 9000);
      const rand3 = Math.floor(1000 + Math.random() * 9000);
      const meetingIdStr = `${rand1}-${rand2}-${rand3}`;
      const cleanId = meetingIdStr.replace(/-/g, '');
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const fallbackMeeting: Meeting = {
        id: Date.now(),
        meeting_id: meetingIdStr,
        title: data.title || "Kartik's Zoom Meeting",
        host_id: data.host_id || 1,
        host_name: 'Kartik',
        status: 'waiting',
        type: 'instant',
        invite_link: `${origin}/meeting/${cleanId}`,
        created_at: new Date().toISOString(),
        started_at: null,
        ended_at: null,
        duration_minutes: null,
        participant_count: 1,
      };
      saveStoredMeeting(fallbackMeeting);
      return fallbackMeeting;
    }
  },

  list: (params?: { status?: string; type?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return apiFetch<Meeting[]>(`/api/meetings${query ? `?${query}` : ''}`).catch(() => getStoredMeetings());
  },

  get: async (meetingId: string): Promise<Meeting> => {
    try {
      return await apiFetch<Meeting>(`/api/meetings/${meetingId}`);
    } catch (e) {
      const cleanInput = meetingId.replace(/-/g, '');
      const stored = getStoredMeetings().find(m =>
        m.meeting_id.replace(/-/g, '') === cleanInput || String(m.id) === cleanInput
      );
      if (stored) return stored;

      const formattedId = cleanInput.length === 11 
        ? `${cleanInput.slice(0, 3)}-${cleanInput.slice(3, 7)}-${cleanInput.slice(7)}` 
        : (cleanInput.length === 10 ? `${cleanInput.slice(0, 3)}-${cleanInput.slice(3, 6)}-${cleanInput.slice(6)}` : meetingId);
      
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const fallback: Meeting = {
        id: Date.now(),
        meeting_id: formattedId,
        title: "Kartik's Zoom Meeting",
        host_id: 1,
        host_name: 'Kartik',
        status: 'active',
        type: 'instant',
        invite_link: `${origin}/meeting/${cleanInput}`,
        created_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        ended_at: null,
        duration_minutes: null,
        participant_count: 3,
      };
      saveStoredMeeting(fallback);
      return fallback;
    }
  },

  update: async (meetingId: string, data: { status?: string; title?: string }): Promise<Meeting> => {
    try {
      const updated = await apiFetch<Meeting>(`/api/meetings/${meetingId}`, { method: 'PATCH', body: JSON.stringify(data) });
      saveStoredMeeting(updated);
      return updated;
    } catch (e) {
      const m = await meetingApi.get(meetingId);
      if (data.status) m.status = data.status as any;
      if (data.title) m.title = data.title;
      saveStoredMeeting(m);
      return m;
    }
  },

  join: async (meetingId: string, data: { display_name: string; user_id?: number }): Promise<Participant> => {
    try {
      return await apiFetch<Participant>(`/api/meetings/${meetingId}/join`, { method: 'POST', body: JSON.stringify(data) });
    } catch (e) {
      return {
        id: Date.now(),
        meeting_id: Date.now(),
        user_id: data.user_id || null,
        display_name: data.display_name,
        joined_at: new Date().toISOString(),
        left_at: null,
        is_host: false,
        is_muted: false,
        is_video_on: true,
      };
    }
  },

  leave: (meetingId: string, participantId: number) =>
    apiFetch(`/api/meetings/${meetingId}/leave?participant_id=${participantId}`, { method: 'POST' }).catch(() => null),

  getParticipants: (meetingId: string) =>
    apiFetch<Participant[]>(`/api/meetings/${meetingId}/participants`).catch(() => []),

  updateParticipant: (meetingId: string, participantId: number, data: { is_muted?: boolean; is_video_on?: boolean }) =>
    apiFetch<Participant>(`/api/meetings/${meetingId}/participants/${participantId}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }).catch(() => ({
      id: participantId,
      meeting_id: 1,
      user_id: null,
      display_name: 'Participant',
      joined_at: new Date().toISOString(),
      left_at: null,
      is_host: false,
      is_muted: !!data.is_muted,
      is_video_on: data.is_video_on !== undefined ? data.is_video_on : true,
    })),

  removeParticipant: (meetingId: string, participantId: number) =>
    apiFetch(`/api/meetings/${meetingId}/participants/${participantId}`, { method: 'DELETE' }).catch(() => null),

  muteAll: (meetingId: string) =>
    apiFetch(`/api/meetings/${meetingId}/mute-all`, { method: 'POST' }).catch(() => null),

  getRecent: async (): Promise<Meeting[]> => {
    try {
      return await apiFetch<Meeting[]>('/api/meetings/recent');
    } catch (e) {
      const stored = getStoredMeetings();
      if (stored.length > 0) return stored;
      return [
        {
          id: 101,
          meeting_id: '123-4567-8901',
          title: 'Sprint Planning',
          host_id: 1,
          host_name: 'Kartik',
          status: 'ended',
          type: 'instant',
          invite_link: '',
          created_at: new Date(Date.now() - 86400000).toISOString(),
          started_at: new Date(Date.now() - 86400000).toISOString(),
          ended_at: new Date(Date.now() - 82800000).toISOString(),
          duration_minutes: 60,
          participant_count: 5,
        },
      ];
    }
  },

  getUpcoming: async (): Promise<UpcomingMeeting[]> => {
    try {
      return await apiFetch<UpcomingMeeting[]>('/api/meetings/upcoming');
    } catch (e) {
      const scheduled = getStoredScheduled();
      const todayStr = new Date().toISOString().split('T')[0];
      const items: UpcomingMeeting[] = scheduled.map(s => ({
        id: s.id,
        meeting_id: s.meeting_id,
        title: s.title,
        scheduled_date: s.scheduled_date,
        scheduled_time: s.scheduled_time,
        duration_minutes: s.duration_minutes,
        status: s.status,
        invite_link: s.invite_link,
      }));

      if (items.length === 0) {
        items.push(
          {
            id: 1,
            meeting_id: '987-6543-2109',
            title: 'Weekly Engineering Sync',
            scheduled_date: todayStr,
            scheduled_time: '14:00',
            duration_minutes: 45,
            status: 'scheduled',
          },
          {
            id: 2,
            meeting_id: '456-7890-1234',
            title: 'Product Design Review',
            scheduled_date: todayStr,
            scheduled_time: '16:30',
            duration_minutes: 30,
            status: 'scheduled',
          }
        );
      }
      return items;
    }
  },
};

export const scheduleApi = {
  create: async (data: {
    title: string;
    description?: string;
    scheduled_date: string;
    scheduled_time: string;
    duration_minutes?: number;
    timezone?: string;
  }): Promise<ScheduledMeeting> => {
    try {
      const scheduled = await apiFetch<ScheduledMeeting>('/api/schedule', { method: 'POST', body: JSON.stringify(data) });
      saveStoredScheduled(scheduled);
      return scheduled;
    } catch (e) {
      const rand1 = Math.floor(100 + Math.random() * 900);
      const rand2 = Math.floor(1000 + Math.random() * 9000);
      const rand3 = Math.floor(1000 + Math.random() * 9000);
      const meetingIdStr = `${rand1}-${rand2}-${rand3}`;
      const cleanId = meetingIdStr.replace(/-/g, '');
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const fallback: ScheduledMeeting = {
        id: Date.now(),
        meeting_id: meetingIdStr,
        title: data.title,
        description: data.description || null,
        scheduled_date: data.scheduled_date,
        scheduled_time: data.scheduled_time,
        duration_minutes: data.duration_minutes || 30,
        timezone: data.timezone || 'Asia/Kolkata',
        recurring: false,
        invite_link: `${origin}/meeting/${cleanId}`,
        status: 'scheduled',
        host_name: 'Kartik',
        created_at: new Date().toISOString(),
      };
      saveStoredScheduled(fallback);
      return fallback;
    }
  },

  list: () => apiFetch<ScheduledMeeting[]>('/api/schedule').catch(() => getStoredScheduled()),

  cancel: (id: number) => apiFetch(`/api/schedule/${id}`, { method: 'DELETE' }).catch(() => null),
};

export const userApi = {
  me: () =>
    apiFetch<User>('/api/users/me').catch(() => ({
      id: 1,
      name: 'Kartik',
      email: 'kartik@example.com',
      avatar_url: null,
      personal_meeting_id: '123-456-7890',
      created_at: new Date().toISOString(),
    })),
};

