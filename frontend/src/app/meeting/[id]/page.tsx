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

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelay',
      credential: 'openrelay',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelay',
      credential: 'openrelay',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelay',
      credential: 'openrelay',
    },
  ],
  iceCandidatePoolSize: 10,
};

const getWsUrl = (meetingId: string, participantId: number) => {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const cleanBase = apiBase.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const wsProto = apiBase.startsWith('https') ? 'wss' : 'ws';
  const cleanId = meetingId.replace(/-/g, '');
  return `${wsProto}://${cleanBase}/ws/meeting/${cleanId}/${participantId}`;
};

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
  const [mediaReady, setMediaReady] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [activeReactions, setActiveReactions] = useState<{ id: string; emoji: string; left: number }[]>([]);
  const [remoteStreamsMap, setRemoteStreamsMap] = useState<{ [id: string]: MediaStream }>({});
  const [audioBlocked, setAudioBlocked] = useState(false);

  const [needsNamePrompt, setNeedsNamePrompt] = useState(false);
  const [joinPromptName, setJoinPromptName] = useState('');
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const iceCandidateQueueRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const hasInitializedMediaRef = useRef(false);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const createPeerConnection = useCallback((targetPeerId: string) => {
    if (peerConnectionsRef.current.has(targetPeerId)) {
      return peerConnectionsRef.current.get(targetPeerId)!;
    }

    console.log(`[WebRTC] Creating RTCPeerConnection for peer ${targetPeerId}`);
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(targetPeerId, pc);

    // 1. Add local stream tracks
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, stream);
          console.log(`[WebRTC] Added local ${track.kind} track to peer ${targetPeerId}`);
        } catch (e) { /* ignore duplicate */ }
      });
    }

    // 2. Add recvonly transceivers if any media kind is missing from local stream
    // so SDP always negotiates receiving remote audio and video
    const senders = pc.getSenders();
    if (!senders.some((s) => s.track?.kind === 'audio')) {
      try { pc.addTransceiver('audio', { direction: 'recvonly' }); } catch (e) {}
    }
    if (!senders.some((s) => s.track?.kind === 'video')) {
      try { pc.addTransceiver('video', { direction: 'recvonly' }); } catch (e) {}
    }

    // 3. Handle incoming remote tracks
    pc.ontrack = (event) => {
      console.log(`[WebRTC] ontrack from peer ${targetPeerId}: kind=${event.track.kind}, id=${event.track.id}`);

      // Listen for when the track actually un-mutes (RTP packets start flowing)
      event.track.onunmute = () => {
        console.log(`[WebRTC] Track unmuted from ${targetPeerId}:`, event.track.kind);
        const currentStream = remoteStreamsRef.current.get(targetPeerId);
        if (currentStream) {
          const fresh = new MediaStream(currentStream.getTracks());
          remoteStreamsRef.current.set(targetPeerId, fresh);
          setRemoteStreamsMap((prev) => ({ ...prev, [targetPeerId]: fresh }));
        }
      };

      let existingStream = remoteStreamsRef.current.get(targetPeerId);
      if (!existingStream) {
        existingStream = new MediaStream();
        remoteStreamsRef.current.set(targetPeerId, existingStream);
      }

      if (!existingStream.getTracks().some((t) => t.id === event.track.id)) {
        existingStream.addTrack(event.track);
      }

      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((t) => {
          if (!existingStream!.getTracks().some((existing) => existing.id === t.id)) {
            existingStream!.addTrack(t);
          }
        });
      }

      // CRITICAL: Always construct a NEW MediaStream reference with all tracks
      // so React state triggers and HTML media elements (video/audio) re-bind and play!
      const freshStream = new MediaStream(existingStream.getTracks());
      remoteStreamsRef.current.set(targetPeerId, freshStream);
      setRemoteStreamsMap((prev) => ({
        ...prev,
        [targetPeerId]: freshStream,
      }));
    };

    // 4. Handle ICE candidates generated locally
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'candidate',
            target: targetPeerId,
            candidate: event.candidate,
          })
        );
      }
    };

    // 5. Connection state monitoring
    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE connection state with ${targetPeerId}:`, pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        try { pc.restartIce(); } catch (e) {}
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state with ${targetPeerId}:`, pc.connectionState);
      if (pc.connectionState === 'failed') {
        try { pc.restartIce(); } catch (e) {}
      }
    };

    return pc;
  }, []);

  // Request Camera & Microphone ONCE on mount
  useEffect(() => {
    if (hasInitializedMediaRef.current) return;
    hasInitializedMediaRef.current = true;

    async function initMedia() {
      if (typeof window === 'undefined') return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('getUserMedia is not supported on this browser or context.');
        setMediaReady(true);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        localStreamRef.current = stream;
        setLocalStream(stream);

        // Apply initial mute/video settings
        stream.getVideoTracks().forEach((track) => {
          track.enabled = isVideoOn;
        });
        stream.getAudioTracks().forEach((track) => {
          track.enabled = !isMuted;
        });

        // Add tracks to any already-created peer connections
        peerConnectionsRef.current.forEach((pc) => {
          stream.getTracks().forEach((track) => {
            const senders = pc.getSenders();
            const existing = senders.find((s) => s.track?.kind === track.kind);
            if (existing) {
              existing.replaceTrack(track);
            } else {
              try {
                pc.addTrack(track, stream);
              } catch (e) { /* ignore */ }
            }
          });
        });
      } catch (err: any) {
        console.warn('Camera/Mic permission failed, trying fallback:', err);
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
          localStreamRef.current = audioOnly;
          setLocalStream(audioOnly);
        } catch (e) {
          console.warn('Media unavailable:', e);
        }
      } finally {
        setMediaReady(true);
      }
    }

    initMedia();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Sync peer connection tracks when localStream updates
  useEffect(() => {
    if (!localStream || !myParticipantId) return;
    peerConnectionsRef.current.forEach((pc, targetPeerId) => {
      localStream.getTracks().forEach((track) => {
        const senders = pc.getSenders();
        const existing = senders.find((s) => s.track?.kind === track.kind);
        if (existing) {
          existing.replaceTrack(track);
        } else {
          try {
            pc.addTrack(track, localStream);
          } catch (e) { /* ignore */ }
        }
      });
    });
  }, [localStream, myParticipantId]);

  // WebRTC Signaling via WebSocket (only after media initialization is complete)
  useEffect(() => {
    if (!meeting || !myParticipantId || !mediaReady) return;

    const wsUrl = getWsUrl(meeting.meeting_id, myParticipantId);
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
    } catch (e) {
      console.warn('WebSocket connection failed:', e);
      return;
    }

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        const senderId = String(msg.sender);

        if (msg.type === 'peer-joined' || msg.type === 'room-peers') {
          const peerIds = msg.type === 'room-peers' ? (msg.peers || []) : [senderId];

          for (const peerId of peerIds) {
            const pIdStr = String(peerId);
            // Deterministic initiator: peer with lower ID creates offer to avoid glare
            const isInitiator = Number(myParticipantId) < Number(pIdStr);

            if (isInitiator) {
              console.log(`[WebRTC] Initiating offer to peer ${pIdStr}`);
              const pc = createPeerConnection(pIdStr);
              if (pc.signalingState === 'stable') {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(
                    JSON.stringify({
                      type: 'offer',
                      target: pIdStr,
                      offer,
                    })
                  );
                }
              }
            } else {
              console.log(`[WebRTC] Ready for incoming offer from peer ${pIdStr}`);
              createPeerConnection(pIdStr);
            }
          }
        } else if (msg.type === 'offer') {
          console.log(`[WebRTC] Received offer from peer ${senderId}`);
          const pc = createPeerConnection(senderId);

          try {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));

            // Drain queued ICE candidates
            const queue = iceCandidateQueueRef.current.get(senderId) || [];
            for (const cand of queue) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) { /* ignore */ }
            }
            iceCandidateQueueRef.current.delete(senderId);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'answer',
                  target: senderId,
                  answer,
                })
              );
              console.log(`[WebRTC] Sent answer to peer ${senderId}`);
            }
          } catch (err) {
            console.error(`[WebRTC] Failed handling offer from ${senderId}:`, err);
          }
        } else if (msg.type === 'answer') {
          console.log(`[WebRTC] Received answer from peer ${senderId}`);
          const pc = peerConnectionsRef.current.get(senderId);
          if (pc && pc.signalingState === 'have-local-offer') {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));

              // Drain queued ICE candidates
              const queue = iceCandidateQueueRef.current.get(senderId) || [];
              for (const cand of queue) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) { /* ignore */ }
              }
              iceCandidateQueueRef.current.delete(senderId);
            } catch (err) {
              console.error(`[WebRTC] Failed setting remote answer from ${senderId}:`, err);
            }
          }
        } else if (msg.type === 'candidate') {
          const pc = peerConnectionsRef.current.get(senderId);
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } catch (e) {
              // Ignore stale candidate errors
            }
          } else {
            const queue = iceCandidateQueueRef.current.get(senderId) || [];
            queue.push(msg.candidate);
            iceCandidateQueueRef.current.set(senderId, queue);
          }
        } else if (msg.type === 'participant-update') {
          setParticipants((prev) =>
            prev.map((p) => {
              if (p.id === Number(msg.participantId)) {
                return {
                  ...p,
                  ...(msg.is_muted !== undefined ? { is_muted: msg.is_muted } : {}),
                  ...(msg.is_video_on !== undefined ? { is_video_on: msg.is_video_on } : {}),
                };
              }
              return p;
            })
          );
        } else if (msg.type === 'peer-left') {
          console.log(`[WebRTC] Peer ${senderId} left the room`);
          const pc = peerConnectionsRef.current.get(senderId);
          if (pc) {
            pc.close();
            peerConnectionsRef.current.delete(senderId);
          }
          remoteStreamsRef.current.delete(senderId);
          setRemoteStreamsMap({ ...Object.fromEntries(remoteStreamsRef.current) });
          setParticipants((prev) => prev.filter((p) => String(p.id) !== senderId));
          showToast('A participant left the meeting');
        } else if (msg.type === 'meeting-ended') {
          showToast('The host has ended the meeting.');
          setTimeout(() => {
            window.location.href = '/';
          }, 1500);
        } else if (msg.type === 'removed-from-meeting') {
          showToast('You have been removed from the meeting by the host.');
          setTimeout(() => {
            window.location.href = '/';
          }, 1500);
        }
      } catch (err) {
        console.error('Signaling error:', err);
      }
    };

    return () => {
      ws.close();
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      remoteStreamsRef.current.clear();
      iceCandidateQueueRef.current.clear();
    };
  }, [meeting?.meeting_id, myParticipantId, mediaReady, createPeerConnection]);

  // Global Audio Unlocker for browser autoplay restrictions
  useEffect(() => {
    const unlockAudio = () => {
      document.querySelectorAll('audio').forEach((el) => {
        if (el.paused) {
          el.play().then(() => {
            setAudioBlocked(false);
          }).catch(() => {});
        }
      });
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

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
          } else if (average <= 15) {
            setSpeakingId((prev) => (prev === myParticipantId ? null : prev));
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
        audioContext.close().catch(() => {});
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

  // Load meeting & manage participant identity
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

      const cleanId = m.meeting_id.replace(/-/g, '');

      // Check session storage and URL query params
      let customName = '';
      let isHostFlag = false;
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        customName = urlParams.get('name') || sessionStorage.getItem(`zoom_name_${cleanId}`) || '';
        isHostFlag = urlParams.get('host') === 'true' || sessionStorage.getItem(`zoom_host_${cleanId}`) === 'true';
      }

      // 2. Fetch active participants from backend SQLite
      let parts: Participant[] = [];
      try {
        parts = await meetingApi.getParticipants(m.meeting_id);
      } catch (e) { /* ignore */ }

      // 3. Check if this browser tab already has an active participant ID stored
      let existingPid: number | null = null;
      if (typeof window !== 'undefined') {
        const savedPid = sessionStorage.getItem(`zoom_participant_${cleanId}`);
        if (savedPid) {
          const matched = parts.find((p) => p.id === Number(savedPid) && !p.left_at);
          if (matched) {
            existingPid = matched.id;
          }
        }
      }

      if (existingPid) {
        setMyParticipantId(existingPid);
        setParticipants(parts);
        return;
      }

      // 4. If host, connect to the host participant record
      if (isHostFlag) {
        const hostPart = parts.find((p) => p.is_host && !p.left_at);
        if (hostPart) {
          setMyParticipantId(hostPart.id);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(`zoom_participant_${cleanId}`, String(hostPart.id));
            sessionStorage.setItem(`zoom_host_${cleanId}`, 'true');
          }
          setParticipants(parts);
          return;
        }
      }

      // 5. If custom name provided (e.g. from homepage join modal), join immediately
      if (customName.trim()) {
        try {
          const newPart = await meetingApi.join(m.meeting_id, { display_name: customName.trim() });
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(`zoom_participant_${cleanId}`, String(newPart.id));
            sessionStorage.setItem(`zoom_name_${cleanId}`, customName.trim());
          }
          setMyParticipantId(newPart.id);
          parts = await meetingApi.getParticipants(m.meeting_id);
          setParticipants(parts);
          return;
        } catch (e) { /* fallback */ }
      }

      // 6. Direct link with no name -> prompt user to enter display name
      setParticipants(parts);
      setNeedsNamePrompt(true);
    } catch (err) {
      console.error('Meeting load error:', err);
      setError('Meeting not found. Please check the Meeting ID or invite link.');
    }
  }, [id]);

  useEffect(() => {
    loadMeeting();
  }, [loadMeeting]);

  const handleConfirmJoin = async () => {
    if (!meeting) return;
    setIsJoiningRoom(true);
    const cleanId = meeting.meeting_id.replace(/-/g, '');
    const finalName = joinPromptName.trim() || 'Guest';
    try {
      const newPart = await meetingApi.join(meeting.meeting_id, { display_name: finalName });
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`zoom_participant_${cleanId}`, String(newPart.id));
        sessionStorage.setItem(`zoom_name_${cleanId}`, finalName);
      }
      setMyParticipantId(newPart.id);
      const parts = await meetingApi.getParticipants(meeting.meeting_id);
      setParticipants(parts);
      setNeedsNamePrompt(false);
    } catch (e: any) {
      showToast(e.message || 'Failed to join meeting');
    } finally {
      setIsJoiningRoom(false);
    }
  };

  // Timer
  useEffect(() => {
    if (!meeting || meeting.status === 'ended') return;
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [meeting]);

  // Poll participants from database every 5s
  useEffect(() => {
    if (!meeting || needsNamePrompt) return;
    const interval = setInterval(async () => {
      try {
        const parts = await meetingApi.getParticipants(meeting.meeting_id);
        setParticipants(parts);
      } catch (e) { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [meeting, needsNamePrompt]);

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

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !newMuted));
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && myParticipantId) {
      wsRef.current.send(
        JSON.stringify({
          type: 'participant-update',
          participantId: myParticipantId,
          is_muted: newMuted,
        })
      );
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

    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = newVideo));
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && myParticipantId) {
      wsRef.current.send(
        JSON.stringify({
          type: 'participant-update',
          participantId: myParticipantId,
          is_video_on: newVideo,
        })
      );
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
    const me = participants.find((p) => p.id === myParticipantId) || participants[0];
    const newMsg: ChatMessage = {
      id: String(Date.now()),
      sender: me ? me.display_name : 'Me',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  // Reactions Handling
  const handleReaction = (emoji: string) => {
    const reactionId = String(Date.now()) + Math.random();
    const leftPercent = 20 + Math.random() * 60;
    setActiveReactions((prev) => [...prev, { id: reactionId, emoji, left: leftPercent }]);
    showToast(`Reaction sent: ${emoji}`);

    setTimeout(() => {
      setActiveReactions((prev) => prev.filter((r) => r.id !== reactionId));
    }, 2500);
  };

  // Live Recording Toggle
  const handleToggleRecord = () => {
    setIsRecording(!isRecording);
    showToast(!isRecording ? '● Recording started' : 'Recording stopped & saved');
  };

  useEffect(() => {
    const handleUnload = () => {
      if (meeting && myParticipantId) {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        navigator.sendBeacon(`${apiBase}/api/meetings/${meeting.meeting_id}/leave?participant_id=${myParticipantId}`);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [meeting, myParticipantId]);

  const handleEndMeeting = async () => {
    // 1. Stop local media streams immediately
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
    }

    // 2. Send graceful leave message over websocket before closing
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'leave', sender: String(myParticipantId) }));
      } catch (e) { /* ignore */ }
      wsRef.current.close();
    }

    // 3. Call backend leave API
    if (meeting && myParticipantId) {
      try {
        await meetingApi.leave(meeting.meeting_id, myParticipantId);
      } catch (e) { /* ignore */ }
    }

    // 4. If host, mark meeting ended
    const myParticipant = participants.find((p) => p.id === myParticipantId);
    if (meeting && myParticipant?.is_host) {
      try {
        await meetingApi.update(meeting.meeting_id, { status: 'ended' });
      } catch (e) { /* ignore */ }
    }

    // 5. Clean up session storage and hard redirect to home page
    if (typeof window !== 'undefined') {
      const cleanId = meeting?.meeting_id.replace(/-/g, '') || '';
      sessionStorage.removeItem(`zoom_participant_${cleanId}`);
      sessionStorage.removeItem(`zoom_name_${cleanId}`);
      sessionStorage.removeItem(`zoom_host_${cleanId}`);
      window.location.href = '/';
    }
  };

  const handleMuteAll = async () => {
    setParticipants((prev) =>
      prev.map((p) => (p.is_host ? p : { ...p, is_muted: true }))
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
    setParticipants((prev) =>
      prev.map((p) => (p.id === participantId ? { ...p, is_muted: isMutedNew } : p))
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
    setParticipants((prev) => prev.filter((p) => p.id !== participantId));
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
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
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
            onClick={() => { window.location.href = '/'; }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Pre-join Display Name Prompt (for direct invite links)
  if (needsNamePrompt && meeting) {
    return (
      <div className="meeting-room" style={{ alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: '#1A1A24', zIndex: 200 }}>
        <div style={{
          background: '#242435',
          padding: '36px 32px',
          borderRadius: '16px',
          width: '90%',
          maxWidth: '420px',
          textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'var(--zoom-blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'white', marginBottom: '6px' }}>Join Meeting</h2>
          <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '20px' }}>{meeting.title}</p>
          <div style={{ marginBottom: '20px', textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '6px', fontWeight: 500 }}>
              Your Display Name
            </label>
            <input
              type="text"
              value={joinPromptName}
              onChange={(e) => setJoinPromptName(e.target.value)}
              placeholder="e.g. Alex"
              style={{
                width: '100%',
                padding: '12px 14px',
                background: '#1A1A24',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                outline: 'none',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmJoin();
              }}
              autoFocus
            />
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 600, borderRadius: '8px', cursor: 'pointer' }}
            onClick={handleConfirmJoin}
            disabled={isJoiningRoom}
          >
            {isJoiningRoom ? 'Joining...' : 'Join Meeting'}
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

  const isCurrentHost = !!participants.find((p) => p.id === myParticipantId)?.is_host;

  return (
    <div className="meeting-room">
      {/* Autoplay blocked audio notification banner */}
      {audioBlocked && (
        <div
          onClick={() => {
            document.querySelectorAll('audio').forEach((el) => el.play().catch(() => {}));
            setAudioBlocked(false);
          }}
          style={{
            position: 'absolute',
            top: '60px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#0B5CFF',
            color: 'white',
            padding: '8px 20px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            zIndex: 300,
            boxShadow: '0 4px 14px rgba(11,92,255,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          🔊 Click anywhere to enable meeting audio
        </div>
      )}

      {/* Continuous, dedicated background audio playback for every remote peer */}
      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }} aria-hidden="true">
        {Object.entries(remoteStreamsMap).map(([peerId, stream]) => (
          <audio
            key={peerId}
            ref={(el) => {
              if (el && el.srcObject !== stream) {
                el.srcObject = stream;
                el.play().catch((err) => {
                  if (err.name === 'NotAllowedError') {
                    setAudioBlocked(true);
                  }
                });
              }
            }}
            autoPlay
            playsInline
          />
        ))}
      </div>

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
              const isMe = myParticipantId !== null && p.id === myParticipantId;
              const showLiveVideo = isMe && isVideoOn && localStream && localStream.getVideoTracks().some((t) => t.enabled);
              const pIdStr = String(p.id);
              const remoteStream = remoteStreamsMap[pIdStr];
              const hasRemoteVideo = !isMe && remoteStream && remoteStream.getVideoTracks().some((t) => t.enabled);
              const showRemoteVideo = !isMe && p.is_video_on !== false && hasRemoteVideo;

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
                  ) : showRemoteVideo ? (
                    <video
                      ref={(el) => {
                        if (el && el.srcObject !== remoteStream) {
                          el.srcObject = remoteStream;
                          el.play().catch(() => {});
                        }
                      }}
                      autoPlay
                      playsInline
                      muted
                      className="video-tile-video"
                      style={{ transform: 'none' }}
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
          isHost={isCurrentHost}
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
        isHost={isCurrentHost}
      />

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
