export const getApiBase = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1' && !host.startsWith('192.168.') && !host.startsWith('10.')) {
      return 'https://zoom-clone-xwp5.onrender.com';
    }
  }
  return 'http://localhost:8000';
};

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getApiBase()}${endpoint}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('zoom_auth_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }

  return res.json();
}

// ─── Meeting API ──────────────────────────────────────────
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
  avatar_url?: string | null;
  personal_meeting_id: string;
  created_at?: string;
}

export const meetingApi = {
  create: (data: { title?: string; host_id?: number } = {}) =>
    apiFetch<Meeting>('/api/meetings', { method: 'POST', body: JSON.stringify(data) }),

  list: (params?: { status?: string; type?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return apiFetch<Meeting[]>(`/api/meetings${query ? `?${query}` : ''}`);
  },

  get: (meetingId: string) =>
    apiFetch<Meeting>(`/api/meetings/${meetingId}`),

  update: (meetingId: string, data: { status?: string; title?: string }) =>
    apiFetch<Meeting>(`/api/meetings/${meetingId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  join: (meetingId: string, data: { display_name: string; user_id?: number }) =>
    apiFetch<Participant>(`/api/meetings/${meetingId}/join`, { method: 'POST', body: JSON.stringify(data) }),

  leave: (meetingId: string, participantId: number) =>
    apiFetch(`/api/meetings/${meetingId}/leave?participant_id=${participantId}`, { method: 'POST' }),

  getParticipants: (meetingId: string) =>
    apiFetch<Participant[]>(`/api/meetings/${meetingId}/participants`),

  updateParticipant: (meetingId: string, participantId: number, data: { is_muted?: boolean; is_video_on?: boolean }) =>
    apiFetch<Participant>(`/api/meetings/${meetingId}/participants/${participantId}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),

  removeParticipant: (meetingId: string, participantId: number) =>
    apiFetch(`/api/meetings/${meetingId}/participants/${participantId}`, { method: 'DELETE' }),

  muteAll: (meetingId: string) =>
    apiFetch(`/api/meetings/${meetingId}/mute-all`, { method: 'POST' }),

  getRecent: () => apiFetch<Meeting[]>('/api/meetings/recent'),

  getUpcoming: () => apiFetch<UpcomingMeeting[]>('/api/meetings/upcoming'),
};

export const scheduleApi = {
  create: (data: {
    title: string;
    description?: string;
    scheduled_date: string;
    scheduled_time: string;
    duration_minutes?: number;
    timezone?: string;
  }) => apiFetch<ScheduledMeeting>('/api/schedule', { method: 'POST', body: JSON.stringify(data) }),

  list: () => apiFetch<ScheduledMeeting[]>('/api/schedule'),

  cancel: (id: number) => apiFetch(`/api/schedule/${id}`, { method: 'DELETE' }),
};

export interface AuthResponse {
  user: User;
  token: string;
  message: string;
}

export const authApi = {
  signup: async (data: { name: string; email: string; password: string }) => {
    const res = await apiFetch<AuthResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (typeof window !== 'undefined' && res.token) {
      localStorage.setItem('zoom_auth_token', res.token);
      localStorage.setItem('zoom_auth_user', JSON.stringify(res.user));
    }
    return res;
  },

  login: async (data: { email: string; password: string }) => {
    const res = await apiFetch<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (typeof window !== 'undefined' && res.token) {
      localStorage.setItem('zoom_auth_token', res.token);
      localStorage.setItem('zoom_auth_user', JSON.stringify(res.user));
    }
    return res;
  },

  me: () => apiFetch<User>('/api/auth/me'),

  logout: async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('zoom_auth_token');
      localStorage.removeItem('zoom_auth_user');
    }
    try {
      await apiFetch<{ message: string }>('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // ignore
    }
  },
};

export const userApi = {
  me: () => apiFetch<User>('/api/users/me'),
};
