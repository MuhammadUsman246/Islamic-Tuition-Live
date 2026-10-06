import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Room, RoomEvent, ConnectionState, RemoteTrack, Track, LocalAudioTrack, createLocalAudioTrack, VideoPresets, Participant, RemoteParticipant } from 'livekit-client';
import { LiveKitRoomTokenResponse, ChatMessageItem, ParticipantInfo, WaitingRoomParticipant } from '../types';
import { createOptimizedLiveKitRoom } from '../services/livekitService';
import { checkMessageSafety, DEFAULT_CHAT_SAFETY_SETTINGS, ChatSafetySettings } from '../utils/chatSafetyFilter';

interface ClassroomContextType {
  // Session State
  tokenData: LiveKitRoomTokenResponse | null;
  roomName: string;
  userRole: string;
  participantName: string;
  connectionStatus: ConnectionState;
  isActive: boolean;
  isMinimized: boolean;

  // Audio / Video / Screen States
  isAudioMuted: boolean;
  isScreenSharing: boolean;
  isCameraActive: boolean;
  isLocalBrowserSharingScreen: boolean;
  activeScreenShareParticipant: string | null;
  activeCameraParticipant: string | null;
  audioPlaybackBlocked: boolean;
  localAudioLevel: number;

  // Theme & Layout
  themeMode: 'dark' | 'light';
  isLight: boolean;
  toggleThemeMode: () => void;

  // Controls & Action Handlers
  joinClassroomSession: (tokenData: LiveKitRoomTokenResponse, userRole: string, participantName: string) => Promise<void>;
  leaveClassroomSession: () => void;
  finishCurrentStudentLesson: () => Promise<void>;
  endClassForEveryone: () => Promise<void>;
  handleToggleAudio: () => Promise<void>;
  handleToggleScreenShare: () => Promise<void>;
  handleToggleCamera: () => Promise<void>;
  openFloatingControlBar: () => Promise<void>;

  // Chat
  isChatOpen: boolean;
  unreadChatCount: number;
  chatMessages: ChatMessageItem[];
  chatInputText: string;
  setChatInputText: (text: string) => void;
  handleSendChatMessage: () => void;
  handleToggleChatInSidebar: () => void;
  setIsChatOpen: (val: boolean) => void;
  chatSafetySettings: ChatSafetySettings;
  chatWarningMessage: string | null;
  setChatWarningMessage: (msg: string | null) => void;

  // Embedded PDF Stage Viewer
  embeddedPdfUrl: string | null;
  setEmbeddedPdfUrl: (url: string | null) => void;

  // Participants & Timer
  filteredParticipants: ParticipantInfo[];
  activeVisibleParticipantsCount: number;
  elapsedSeconds: number;
  formatChronometerTime: (secs: number) => string;
  presenceToast: {
    id: string;
    name: string;
    role: string;
    type: 'join' | 'leave';
    timestamp: string;
  } | null;
  setPresenceToast: (val: any) => void;
  waitingQueue: WaitingRoomParticipant[];
  handleWaitingRoomAction: (waitingId: string, action: 'ADMIT' | 'REJECT') => Promise<void>;

  // Hardware & Modals
  audioInputDevices: MediaDeviceInfo[];
  audioOutputDevices: MediaDeviceInfo[];
  videoInputDevices: MediaDeviceInfo[];
  selectedAudioInput: string;
  selectedAudioOutput: string;
  selectedVideoInput: string;
  setSelectedAudioInput: (id: string) => void;
  setSelectedAudioOutput: (id: string) => void;
  setSelectedVideoInput: (id: string) => void;
  showDeviceSettingsModal: boolean;
  setShowDeviceSettingsModal: (val: boolean) => void;
  showLeaveConfirmModal: boolean;
  setShowLeaveConfirmModal: (val: boolean) => void;

  pipWindow: Window | null;
  // Refs for Video & Audio Elements
  stageContainerRef: React.RefObject<HTMLDivElement | null>;
  remoteAudioContainerRef: React.RefObject<HTMLDivElement | null>;
  screenShareVideoRef: React.RefObject<HTMLVideoElement | null>;
  studentCameraVideoRef: React.RefObject<HTMLVideoElement | null>;
  pipCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  pipFallbackVideoRef: React.RefObject<HTMLVideoElement | null>;
}

const ClassroomContext = createContext<ClassroomContextType | null>(null);

function playContextStudioChime(type: 'connect' | 'peer_join' | 'peer_leave' = 'connect') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx: AudioContext = new AudioCtx();
    const now = ctx.currentTime;
    const notes =
      type === 'connect'
        ? [440, 554.37, 659.25]
        : type === 'peer_join'
          ? [523.25, 659.25, 783.99]
          : [587.33, 440];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      gain.gain.setValueAtTime(0.001, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.065, now + idx * 0.09 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.09 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.48);
    });
    setTimeout(() => {
      if (ctx.state !== 'closed') ctx.close().catch(() => {});
    }, 1200);
  } catch {}
}

export const ClassroomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Session Identity
  const [tokenData, setTokenData] = useState<LiveKitRoomTokenResponse | null>(null);
  const [roomName, setRoomName] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('student');
  const [participantName, setParticipantName] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [isActive, setIsActive] = useState<boolean>(false);

  // Audio / Video / Screen States
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const isAudioMutedRef = useRef<boolean>(false);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isLocalBrowserSharingScreen, setIsLocalBrowserSharingScreen] = useState<boolean>(false);
  const [activeScreenShareParticipant, setActiveScreenShareParticipant] = useState<string | null>(null);
  const [activeCameraParticipant, setActiveCameraParticipant] = useState<string | null>(null);
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState<boolean>(false);
  const [localAudioLevel, setLocalAudioLevel] = useState<number>(0);

  // Theme
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const isLight = themeMode === 'light';
  const toggleThemeMode = () => setThemeMode(prev => (prev === 'light' ? 'dark' : 'light'));

  // Chat
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([]);
  const [chatInputText, setChatInputText] = useState<string>('');
  const [chatSafetySettings, setChatSafetySettings] = useState<ChatSafetySettings>(DEFAULT_CHAT_SAFETY_SETTINGS);
  const [chatWarningMessage, setChatWarningMessage] = useState<string | null>(null);

  // Load Chat Safety Settings from server
  useEffect(() => {
    fetch('/api/chat/safety-settings')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.settings) {
          setChatSafetySettings(data.settings);
        }
      })
      .catch(() => {});
  }, [isActive]);

  // Embedded PDF Stage Viewer
  const [embeddedPdfUrl, setEmbeddedPdfUrl] = useState<string | null>(null);

  // Timer & Participants
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [filteredParticipants, setFilteredParticipants] = useState<ParticipantInfo[]>([]);
  const [activeVisibleParticipantsCount, setActiveVisibleParticipantsCount] = useState<number>(1);
  const [presenceToast, setPresenceToast] = useState<{
    id: string;
    name: string;
    role: string;
    type: 'join' | 'leave';
    timestamp: string;
  } | null>(null);
  const presenceToastTimerRef = useRef<any>(null);
  const notifiedPeersRef = useRef<Set<string>>(new Set());
  const peerCustomNamesRef = useRef<Record<string, { name: string; role: string }>>({});
  const [waitingQueue, setWaitingQueue] = useState<WaitingRoomParticipant[]>([]);
  const notifiedWaitingIdsRef = useRef<Set<string>>(new Set());

  const handleWaitingRoomAction = useCallback(async (waitingId: string, action: 'ADMIT' | 'REJECT') => {
    try {
      await fetch('/api/livekit/waiting-room/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waitingId, action })
      });
      setWaitingQueue(prev => prev.filter(w => w.id !== waitingId));
    } catch (e) {}
  }, []);

  // Periodic heartbeat while ClassroomContext session is active (keeps live status & waiting queue synced even when minimized)
  useEffect(() => {
    if (!isActive || !roomName || tokenData?.isMockSession) return;
    let cancelled = false;

    const sendContextHeartbeat = () => {
      fetch('/api/livekit/rooms/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          identity: tokenData?.participantIdentity || participantName,
          name: participantName,
          role: userRole
        })
      })
        .then(r => {
          const ct = r.headers.get('content-type') || '';
          return r.ok && ct.includes('application/json') ? r.json() : null;
        })
        .then(data => {
          if (cancelled || !data) return;
          if (userRole !== 'tutor' && (data.roomAction === 'END_CLASS_FOR_ALL' || data.roomAction === 'FINISH_STUDENT_LESSON')) {
            if (roomRef.current) {
              try { roomRef.current.disconnect(); } catch {}
            }
            if (pipWindowRef.current && !pipWindowRef.current.closed) {
              try { pipWindowRef.current.close(); } catch {}
            }
            setTokenData(null);
            setIsActive(false);
            setWaitingQueue([]);
            setConnectionStatus(ConnectionState.Disconnected);
            setElapsedSeconds(0);
            setIsTimerRunning(false);
            return;
          }
          if (userRole === 'tutor' && Array.isArray(data.waitingList)) {
            setWaitingQueue(data.waitingList);
            data.waitingList.forEach((w: WaitingRoomParticipant) => {
              if (!notifiedWaitingIdsRef.current.has(w.id)) {
                notifiedWaitingIdsRef.current.add(w.id);
                playContextStudioChime('connect');
              }
            });
          }
        })
        .catch(() => {});
    };

    sendContextHeartbeat();
    const interval = setInterval(sendContextHeartbeat, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isActive, roomName, tokenData, participantName, userRole]);

  const triggerPresenceToast = useCallback((name: string, roleLabel: string, type: 'join' | 'leave') => {
    if (presenceToastTimerRef.current) {
      clearTimeout(presenceToastTimerRef.current);
    }
    setPresenceToast({
      id: `toast_${Date.now()}`,
      name,
      role: roleLabel,
      type,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    presenceToastTimerRef.current = setTimeout(() => {
      setPresenceToast(null);
    }, 6500);
  }, []);

  // Hardware
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>('');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('');
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>('');
  const selectedAudioOutputRef = useRef<string>('');

  // Modals & PiP Window
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [showDeviceSettingsModal, setShowDeviceSettingsModal] = useState<boolean>(false);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState<boolean>(false);

  // Refs
  const roomRef = useRef<Room | null>(null);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const remoteAudioContainerRef = useRef<HTMLDivElement | null>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement | null>(null);
  const studentCameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const pipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pipFallbackVideoRef = useRef<HTMLVideoElement | null>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const filterAudioCtxRef = useRef<AudioContext | null>(null);
  const rawMicStreamRef = useRef<MediaStream | null>(null);
  const instanceTabIdRef = useRef<string>(`tab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

  useEffect(() => {
    isAudioMutedRef.current = isAudioMuted;
  }, [isAudioMuted]);

  useEffect(() => {
    selectedAudioOutputRef.current = selectedAudioOutput;
  }, [selectedAudioOutput]);

  // Chronometer Interval
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  const formatChronometerTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // BroadcastChannel & sessionStorage Single-Instance Guard
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('islamic_tuition_single_instance');
        bc.onmessage = (e) => {
          if (e.data?.type === 'CLASSROOM_OPENED' && e.data?.role === userRole && e.data?.roomName === roomName && e.data?.tabId !== instanceTabIdRef.current) {
            // Newer tab opened same classroom for same role - disconnect duplicate background
            if (roomRef.current) {
              try { roomRef.current.disconnect(); } catch {}
            }
          } else if (e.data?.type === 'SCREEN_SHARE_ACTIVE') {
            if (e.data?.roomName === roomName) {
              setIsLocalBrowserSharingScreen(e.data?.isSharing);
            }
          }
        };
      }
    } catch {}

    return () => {
      if (bc) bc.close();
    };
  }, [userRole, roomName]);

  // Attach and play remote audio track
  const attachRemoteAudioTrack = useCallback((track: RemoteTrack) => {
    if (track.kind !== Track.Kind.Audio || !remoteAudioContainerRef.current) return;
    const trackId = track.sid || `audio_${Math.random()}`;
    const existing = remoteAudioContainerRef.current.querySelector(`audio[data-track-sid="${trackId}"]`);
    if (existing) return;

    const audioEl = track.attach() as HTMLAudioElement;
    audioEl.setAttribute('data-track-sid', trackId);
    audioEl.autoplay = true;
    (audioEl as any).playsInline = true;
    audioEl.volume = 1.0;

    if (selectedAudioOutputRef.current && (audioEl as any).setSinkId) {
      (audioEl as any).setSinkId(selectedAudioOutputRef.current).catch(() => {});
    }

    remoteAudioContainerRef.current.appendChild(audioEl);
    audioEl.play().catch(() => {
      setAudioPlaybackBlocked(true);
    });
  }, []);

  // Synchronize participants list
  const syncParticipantsState = useCallback((room: Room) => {
    const visibleList: ParticipantInfo[] = [];

    if (room.localParticipant) {
      const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      const screenPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);

      const localHasScreen = Boolean(screenPub?.track && !screenPub.isMuted);
      const localHasCam = Boolean(camPub?.track && !camPub.isMuted);
      setIsScreenSharing(localHasScreen);
      setIsCameraActive(localHasCam);
      setLocalAudioLevel(Math.min(100, Math.round((room.localParticipant.audioLevel || 0) * 100)));

      visibleList.push({
        id: room.localParticipant.identity,
        name: participantName || room.localParticipant.identity,
        role: userRole === 'tutor' ? 'Tutor' : userRole === 'admin' ? 'Admin' : userRole === 'supervisor' ? 'Supervisor' : 'Student',
        isSpeaking: room.localParticipant.isSpeaking,
        isMuted: micPub ? micPub.isMuted : isAudioMutedRef.current,
        hasAudioTrack: Boolean(micPub?.track),
        hasVideoTrack: localHasCam,
        isScreenSharing: localHasScreen,
        audioLevel: room.localParticipant.audioLevel
      });
    }

    let foundScreenShare: string | null = null;
    let foundCameraShare: string | null = null;
    room.remoteParticipants.forEach((p) => {
      p.audioTrackPublications.forEach((pub) => {
        if (pub.track && pub.isSubscribed) {
          attachRemoteAudioTrack(pub.track as RemoteTrack);
        }
      });

      let isHidden = false;
      let pRole = 'Student';
      try {
        if (p.metadata) {
          const meta = JSON.parse(p.metadata);
          isHidden = Boolean(meta.hidden || ((meta.role === 'admin' || meta.role === 'supervisor') && meta.hidden));
          if (meta.role === 'tutor') pRole = 'Tutor';
          else if (meta.role === 'admin') pRole = 'Admin';
          else if (meta.role === 'supervisor') pRole = 'Supervisor';
        }
      } catch {}
      if (isHidden) return;

      const cached = peerCustomNamesRef.current[p.identity];
      if (cached?.role) pRole = cached.role;
      else if (pRole === 'Student') {
        const idOrName = `${p.identity || ''} ${p.name || ''}`.toLowerCase();
        if (idOrName.includes('tutor') || idOrName.includes('ustadh') || idOrName.includes('teacher')) {
          pRole = 'Tutor';
        }
      }
      let pDisplayName = cached?.name || p.name || p.identity;
      if (pRole === 'Tutor' && (userRole === 'student' || userRole === 'parent' || userRole === 'guest')) {
        const match = `${p.identity || ''} ${pDisplayName} ${roomName}`.match(/(\d+)/);
        pDisplayName = match ? `Tutor ${match[1]}` : 'Tutor';
      }

      const micPub = p.getTrackPublication(Track.Source.Microphone);
      const camPub = p.getTrackPublication(Track.Source.Camera);
      const screenPub = p.getTrackPublication(Track.Source.ScreenShare);

      if (screenPub?.track && !screenPub.isMuted) {
        foundScreenShare = pDisplayName;
      }
      if (camPub?.track && !camPub.isMuted) {
        foundCameraShare = pDisplayName;
      }

      visibleList.push({
        id: p.identity,
        name: pDisplayName,
        role: pRole,
        isSpeaking: p.isSpeaking,
        isMuted: micPub ? micPub.isMuted : true,
        hasAudioTrack: Boolean(micPub?.track),
        hasVideoTrack: Boolean(camPub?.track && !camPub.isMuted),
        isScreenSharing: Boolean(screenPub?.track && !screenPub.isMuted),
        audioLevel: p.audioLevel
      });
    });

    setActiveScreenShareParticipant(foundScreenShare);
    setActiveCameraParticipant(foundCameraShare);
    setFilteredParticipants(visibleList);
    setActiveVisibleParticipantsCount(visibleList.length);

    if (visibleList.length >= 2) {
      setIsTimerRunning(true);
    }
  }, [participantName, userRole, roomName, attachRemoteAudioTrack]);

  // Load Devices
  useEffect(() => {
    async function loadDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter(d => d.kind === 'audioinput');
        const outputs = devices.filter(d => d.kind === 'audiooutput');
        const videos = devices.filter(d => d.kind === 'videoinput');

        setAudioInputDevices(inputs);
        setAudioOutputDevices(outputs);
        setVideoInputDevices(videos);

        if (inputs.length > 0 && !selectedAudioInput) setSelectedAudioInput(inputs[0].deviceId);
        if (outputs.length > 0 && !selectedAudioOutput) setSelectedAudioOutput(outputs[0].deviceId);
        if (videos.length > 0 && !selectedVideoInput) setSelectedVideoInput(videos[0].deviceId);
      } catch (e) {}
    }
    loadDevices();
  }, [selectedAudioInput, selectedAudioOutput, selectedVideoInput]);

  // Attach Remote or Local Screen Share & Camera Video tracks
  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;

    if (screenShareVideoRef.current) {
      let remoteScreenTrack: Track | undefined;
      room.remoteParticipants.forEach((p) => {
        const pub = p.getTrackPublication(Track.Source.ScreenShare);
        if (pub?.track && !pub.isMuted) {
          remoteScreenTrack = pub.track;
        }
      });
      const localScreenPub = room.localParticipant?.getTrackPublication(Track.Source.ScreenShare);
      const localScreenTrack = localScreenPub?.track && !localScreenPub.isMuted ? localScreenPub.track : undefined;

      if (remoteScreenTrack) {
        remoteScreenTrack.attach(screenShareVideoRef.current);
        screenShareVideoRef.current.muted = true;
      } else if (isScreenSharing && localScreenTrack) {
        localScreenTrack.attach(screenShareVideoRef.current);
        screenShareVideoRef.current.muted = true;
      } else {
        screenShareVideoRef.current.srcObject = null;
      }
    }

    if (studentCameraVideoRef.current) {
      let camTrack: Track | undefined;
      room.remoteParticipants.forEach((p) => {
        const pub = p.getTrackPublication(Track.Source.Camera);
        if (pub?.track && !pub.isMuted) {
          camTrack = pub.track;
        }
      });
      if (!camTrack && room.localParticipant) {
        const localPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        if (localPub?.track && !localPub.isMuted) {
          camTrack = localPub.track;
        }
      }
      if (camTrack) {
        camTrack.attach(studentCameraVideoRef.current);
      }
    }
  }, [isScreenSharing, activeScreenShareParticipant, isCameraActive, activeCameraParticipant, userRole, isLocalBrowserSharingScreen]);

  // Sleek 340x50 Canvas Micro-Pill Drawing Loop for Video Picture-in-Picture
  useEffect(() => {
    const canvas = pipCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const renderMicroPillFrame = () => {
      // Dark emerald studio pill
      ctx.fillStyle = '#060B08';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#1D3B2B';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);

      // Line 1: Live Participant Presence Pill & Timer
      const studentPeers = filteredParticipants.filter(p => p.role === 'Student' || p.role === 'Guest');
      const tutorPeer = filteredParticipants.find(p => p.role === 'Tutor');
      const tName = tutorPeer?.name || (userRole === 'tutor' ? participantName : 'Tutor');
      const sNames = studentPeers.map(s => s.name).join(', ');
      const bothPresent = Boolean(tutorPeer && studentPeers.length > 0);

      ctx.fillStyle = bothPresent ? '#34D399' : '#FBBF24';
      ctx.font = 'bold 11px system-ui, sans-serif';
      const line1Text = bothPresent
        ? `🟢 ${tName} + ${sNames}`.slice(0, 34)
        : userRole === 'tutor'
          ? `⏳ ${tName} · Waiting Student`
          : `⏳ Waiting Tutor...`;
      ctx.fillText(line1Text, 10, 18);

      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(formatChronometerTime(elapsedSeconds), 280, 18);

      // Line 2: Mic Status & Toast / Chat
      if (isAudioMuted) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillText('🔇 MUTED', 10, 38);
      } else {
        ctx.fillStyle = '#10B981';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillText('🎙️ MIC LIVE', 10, 38);
      }

      if (presenceToast) {
        ctx.fillStyle = presenceToast.type === 'join' ? '#34D399' : '#FBBF24';
        ctx.font = 'bold 10px system-ui, sans-serif';
        const tMsg = presenceToast.type === 'join' ? `🟢 ${presenceToast.name} joined!` : `🟠 ${presenceToast.name} left`;
        ctx.fillText(tMsg.slice(0, 28), 100, 38);
      } else {
        const lastMsg = chatMessages[chatMessages.length - 1];
        if (lastMsg) {
          ctx.fillStyle = '#9CA3AF';
          ctx.font = '10px system-ui, sans-serif';
          ctx.fillText(`💬 ${lastMsg.sender}: ${lastMsg.text.slice(0, 24)}`, 100, 38);
        } else {
          ctx.fillStyle = '#6B7280';
          ctx.font = '10px system-ui, sans-serif';
          ctx.fillText(`💬 In Class (${activeVisibleParticipantsCount})`, 100, 38);
        }
      }

      animId = requestAnimationFrame(renderMicroPillFrame);
    };

    renderMicroPillFrame();

    try {
      if (pipFallbackVideoRef.current && !pipFallbackVideoRef.current.srcObject) {
        const stream = canvas.captureStream(15);
        pipFallbackVideoRef.current.srcObject = stream;
        (pipFallbackVideoRef.current as any).autoPictureInPicture = true;
        pipFallbackVideoRef.current.play().catch(() => {});
      }
    } catch (e) {}

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [elapsedSeconds, isAudioMuted, isScreenSharing, activeVisibleParticipantsCount, chatMessages, filteredParticipants, userRole, participantName, presenceToast]);
  const joinClassroomSession = useCallback(async (
    tokenRes: LiveKitRoomTokenResponse,
    roleStr: string,
    pName: string
  ) => {
    try {
      setTokenData(tokenRes);
      setRoomName(tokenRes.roomName);
      setUserRole(roleStr);
      setParticipantName(pName);
      setIsActive(true);
      setConnectionStatus(ConnectionState.Connecting);

      if (tokenRes.isMockSession) {
        setConnectionStatus(ConnectionState.Connected);
        setActiveVisibleParticipantsCount(2);
        setIsTimerRunning(true);
        setFilteredParticipants([
          { id: 'tutor_01', name: pName, role: roleStr === 'tutor' ? 'Tutor' : 'Student', isSpeaking: false, isMuted: false, hasAudioTrack: true, hasVideoTrack: false, isScreenSharing: false, audioLevel: 0 },
          { id: 'student_01', name: roleStr === 'tutor' ? 'Ahmad Student' : 'Ustadh Bilal', role: roleStr === 'tutor' ? 'Student' : 'Tutor', isSpeaking: false, isMuted: false, hasAudioTrack: true, hasVideoTrack: false, isScreenSharing: false, audioLevel: 0 }
        ]);
        return;
      }

      const room = createOptimizedLiveKitRoom(false);
      roomRef.current = room;

      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        setConnectionStatus(state);
      });

      const broadcastPresenceHello = () => {
        try {
          if (room.state === ConnectionState.Connected && room.localParticipant) {
            const helloPayload = new TextEncoder().encode(JSON.stringify({
              type: 'PRESENCE_HELLO',
              identity: room.localParticipant.identity || pName,
              name: pName,
              role: roleStr === 'tutor' ? 'Tutor' : 'Student'
            }));
            room.localParticipant.publishData(helloPayload as any, { reliable: true }).catch(() => {});
          }
        } catch {}
      };

      room.on(RoomEvent.Connected, () => {
        setConnectionStatus(ConnectionState.Connected);
        playContextStudioChime('connect');
        room.startAudio().catch(() => {});
        syncParticipantsState(room);
        broadcastPresenceHello();
      });

      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        let isHidden = false;
        let pRole = 'Student';
        try {
          if (participant.metadata) {
            const meta = JSON.parse(participant.metadata);
            isHidden = Boolean(meta.hidden);
            if (meta.role === 'tutor') pRole = 'Tutor';
          }
        } catch {}
        if (!isHidden && !notifiedPeersRef.current.has(participant.identity)) {
          notifiedPeersRef.current.add(participant.identity);
          playContextStudioChime('peer_join');
          triggerPresenceToast(participant.name || participant.identity || 'Participant', pRole, 'join');
          setTimeout(() => broadcastPresenceHello(), 200);
        }
        syncParticipantsState(room);
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        let isHidden = false;
        let pRole = 'Student';
        try {
          if (participant.metadata) {
            const meta = JSON.parse(participant.metadata);
            isHidden = Boolean(meta.hidden);
            if (meta.role === 'tutor') pRole = 'Tutor';
          }
        } catch {}
        if (!isHidden) {
          notifiedPeersRef.current.delete(participant.identity);
          const pNameDisplay = peerCustomNamesRef.current[participant.identity]?.name || participant.name || participant.identity || 'Participant';
          delete peerCustomNamesRef.current[participant.identity];
          playContextStudioChime('peer_leave');
          triggerPresenceToast(pNameDisplay, pRole, 'leave');
        }
        syncParticipantsState(room);
      });
      room.on(RoomEvent.ActiveSpeakersChanged, () => syncParticipantsState(room));
      room.on(RoomEvent.TrackMuted, () => syncParticipantsState(room));
      room.on(RoomEvent.TrackUnmuted, () => syncParticipantsState(room));
      room.on(RoomEvent.LocalTrackPublished, () => syncParticipantsState(room));
      room.on(RoomEvent.LocalTrackUnpublished, () => syncParticipantsState(room));

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) {
          attachRemoteAudioTrack(track);
        }
        syncParticipantsState(room);
      });

      room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
        try {
          const str = new TextDecoder().decode(payload);
          const msgObj = JSON.parse(str);
          if (msgObj.type === 'CHAT') {
            setChatMessages(prev => [...prev, {
              id: `msg_${Date.now()}`,
              sender: msgObj.sender || participant?.name || 'Peer',
              role: msgObj.role || 'Participant',
              text: msgObj.text,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
            setUnreadChatCount(prev => prev + 1);
          } else if (msgObj.type === 'PRESENCE_HELLO') {
            const peerId = msgObj.identity || participant?.identity;
            const peerName = msgObj.name || participant?.name || peerId || 'Participant';
            const peerRole = msgObj.role || 'Student';
            if (peerId) {
              peerCustomNamesRef.current[peerId] = { name: peerName, role: peerRole };
              if (!notifiedPeersRef.current.has(peerId)) {
                notifiedPeersRef.current.add(peerId);
                playContextStudioChime('peer_join');
                triggerPresenceToast(peerName, peerRole, 'join');
              }
            }
            syncParticipantsState(room);
          } else if (msgObj.type === 'END_CLASS_FOR_ALL' || msgObj.type === 'FINISH_STUDENT_LESSON') {
            if (roleStr !== 'tutor') {
              try { room.disconnect(); } catch {}
              if (pipWindowRef.current && !pipWindowRef.current.closed) {
                try { pipWindowRef.current.close(); } catch {}
              }
              setTokenData(null);
              setIsActive(false);
              setWaitingQueue([]);
              setConnectionStatus(ConnectionState.Disconnected);
              setElapsedSeconds(0);
              setIsTimerRunning(false);
            }
          }
        } catch (e) {}
      });

      await room.connect(tokenRes.serverUrl, tokenRes.token, { autoSubscribe: true });
      room.startAudio().catch(() => setAudioPlaybackBlocked(true));
      syncParticipantsState(room);

      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('islamic_tuition_single_instance');
          bc.postMessage({ type: 'CLASSROOM_OPENED', role: roleStr, roomName: tokenRes.roomName, tabId: instanceTabIdRef.current });
          bc.close();
        }
      } catch (e) {}

    } catch (err: any) {
      console.warn('[Classroom Context Join Notice]:', err);
      setConnectionStatus(ConnectionState.Connected);
    }
  }, [syncParticipantsState, attachRemoteAudioTrack]);

  // Leave Session
  const leaveClassroomSession = useCallback(() => {
    if (roomName) {
      fetch('/api/livekit/rooms/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          identity: tokenData?.participantIdentity || participantName
        })
      }).catch(() => {});
    }
    if (roomRef.current) {
      try { roomRef.current.disconnect(); } catch {}
    }
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      try { pipWindowRef.current.close(); } catch {}
    }
    setTokenData(null);
    setIsActive(false);
    setWaitingQueue([]);
    setConnectionStatus(ConnectionState.Disconnected);
    setElapsedSeconds(0);
    setIsTimerRunning(false);
  }, [roomName, tokenData, participantName]);

  // Tutor Option 1: Finish Current Student's Class & Stay Ready for Next Student
  const finishCurrentStudentLesson = useCallback(async () => {
    setShowLeaveConfirmModal(false);
    try {
      if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
        const payload = new TextEncoder().encode(JSON.stringify({
          type: 'FINISH_STUDENT_LESSON',
          sender: participantName
        }));
        await roomRef.current.localParticipant.publishData(payload as any, { reliable: true }).catch(() => {});
      }
      if (roomName) {
        const res = await fetch('/api/livekit/rooms/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName,
            action: 'FINISH_STUDENT_LESSON'
          })
        });
        const data = await res.json().catch(() => null);
        if (data?.waitingList) {
          setWaitingQueue(data.waitingList);
        }
      }
    } catch {}

    notifiedPeersRef.current.clear();
    peerCustomNamesRef.current = {};
    setElapsedSeconds(0);
    setIsTimerRunning(false);
    setChatMessages([]);
    setUnreadChatCount(0);
    if (roomRef.current) {
      syncParticipantsState(roomRef.current);
    }
    triggerPresenceToast(
      waitingQueue.length > 0
        ? `Lesson finished — Auto-admitting ${waitingQueue[0].guest_name}...`
        : 'Lesson finished — Standby ready for next student',
      'Classroom',
      'join'
    );
  }, [roomName, participantName, syncParticipantsState, triggerPresenceToast, waitingQueue]);

  // Tutor Option 2: End Class for Everyone
  const endClassForEveryone = useCallback(async () => {
    setShowLeaveConfirmModal(false);
    try {
      if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
        const payload = new TextEncoder().encode(JSON.stringify({
          type: 'END_CLASS_FOR_ALL',
          sender: participantName
        }));
        await roomRef.current.localParticipant.publishData(payload as any, { reliable: true }).catch(() => {});
      }
      if (roomName) {
        await fetch('/api/livekit/rooms/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName,
            action: 'END_CLASS_FOR_ALL'
          })
        }).catch(() => {});
      }
    } catch {}

    if (roomRef.current) {
      try { roomRef.current.disconnect(); } catch {}
    }
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      try { pipWindowRef.current.close(); } catch {}
    }
    setTokenData(null);
    setIsActive(false);
    setWaitingQueue([]);
    setConnectionStatus(ConnectionState.Disconnected);
    setElapsedSeconds(0);
    setIsTimerRunning(false);
  }, [roomName, participantName]);

  // Audio Toggle
  const handleToggleAudio = async () => {
    try {
      if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
        const pub = roomRef.current.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (pub?.track) {
          if (isAudioMuted) {
            await pub.track.unmute();
            setIsAudioMuted(false);
            isAudioMutedRef.current = false;
          } else {
            await pub.track.mute();
            setIsAudioMuted(true);
            isAudioMutedRef.current = true;
          }
          syncParticipantsState(roomRef.current);
          return;
        }
      }
      setIsAudioMuted(prev => !prev);
    } catch (e) {
      setIsAudioMuted(prev => !prev);
    }
  };

  // Screen Share Toggle
  const handleToggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
          await roomRef.current.localParticipant.setScreenShareEnabled(false);
        }
        setIsScreenSharing(false);
        setIsLocalBrowserSharingScreen(false);
      } else {
        setIsLocalBrowserSharingScreen(true);
        const displayConstraints: any = {
          audio: false,
          selfBrowserSurface: 'exclude',
          surfaceSwitching: 'include',
          systemAudio: 'exclude',
          monitorTypeSurfaces: 'exclude',
          video: {
            displaySurface: 'browser',
            width: 1920,
            height: 1080,
            frameRate: 10,
          }
        };

        if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
          try {
            await roomRef.current.localParticipant.setScreenShareEnabled(true, displayConstraints, {
              simulcast: true,
              degradationPreference: 'maintain-resolution',
            });
            setIsScreenSharing(true);
          } catch (err: any) {
            delete displayConstraints.monitorTypeSurfaces;
            await roomRef.current.localParticipant.setScreenShareEnabled(true, displayConstraints as any);
            setIsScreenSharing(true);
          }
        } else if (navigator.mediaDevices?.getDisplayMedia) {
          await navigator.mediaDevices.getDisplayMedia(displayConstraints);
          setIsScreenSharing(true);
        }
      }
      if (roomRef.current) syncParticipantsState(roomRef.current);
    } catch (e) {
      setIsScreenSharing(false);
      setIsLocalBrowserSharingScreen(false);
    }
  };

  // Camera Toggle
  const handleToggleCamera = async () => {
    try {
      if (isCameraActive) {
        if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
          await roomRef.current.localParticipant.setCameraEnabled(false);
        }
        setIsCameraActive(false);
      } else {
        if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
          await roomRef.current.localParticipant.setCameraEnabled(true);
          setIsCameraActive(true);
        }
      }
      if (roomRef.current) syncParticipantsState(roomRef.current);
    } catch (e) {
      setIsCameraActive(false);
    }
  };

  // Open Floating Control Bar (Top-level Document PiP OR Canvas Video PiP for IFrames)
  const openFloatingControlBar = useCallback(async () => {
    try {
      const docPip = (window as any).documentPictureInPicture;
      const isTopLevel = typeof window !== 'undefined' && window.self === window.top;

      if (isTopLevel && docPip && typeof docPip.requestWindow === 'function') {
        if (pipWindowRef.current && !pipWindowRef.current.closed) {
          pipWindowRef.current.focus();
          return;
        }

        const pipWin: Window = await docPip.requestWindow({
          width: 500,
          height: isChatOpen ? 340 : 66,
        });

        pipWin.document.title = 'Islamic Tuition Floating Bar';
        pipWin.document.body.style.margin = '0';
        pipWin.document.body.style.backgroundColor = '#050806';
        pipWin.document.body.style.color = '#FFFFFF';
        pipWin.document.body.style.overflow = 'hidden';

        pipWin.addEventListener('pagehide', () => setPipWindow(null));
        setPipWindow(pipWin);
        return;
      }
    } catch (e) {}

    try {
      if (pipFallbackVideoRef.current && document.pictureInPictureEnabled) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await pipFallbackVideoRef.current.requestPictureInPicture();
        }
      }
    } catch (err) {}
  }, [isChatOpen]);

  // Send Chat Message with Server-Side & Client-Side Safety Validation
  const handleSendChatMessage = async () => {
    const rawText = chatInputText.trim();
    if (!rawText) return;

    setChatWarningMessage(null);

    // 1. Client-side Instant Safety Filter
    const clientCheck = checkMessageSafety(rawText, participantName || 'user', chatSafetySettings);
    if (!clientCheck.isAllowed) {
      setChatWarningMessage(clientCheck.userFacingError || "For everyone's privacy and safety, personal contact information can't be shared in classroom chat. Please keep communication within the academy platform.");
      setTimeout(() => setChatWarningMessage(null), 8000);
      return;
    }

    // 2. Server-side Validation Endpoint (`/api/chat/validate`)
    try {
      const res = await fetch('/api/chat/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: rawText,
          senderId: participantName || 'user',
          senderName: participantName,
          senderRole: userRole === 'tutor' ? 'tutor' : 'student',
          roomSlug: roomName || 'live_room',
          clientSettings: chatSafetySettings
        })
      });

      if (res.ok) {
        const serverCheck = await res.json();
        if (!serverCheck.isAllowed) {
          setChatWarningMessage(serverCheck.userFacingError || "For everyone's privacy and safety, personal contact information can't be shared in classroom chat. Please keep communication within the academy platform.");
          setTimeout(() => setChatWarningMessage(null), 8000);
          return;
        }
      }
    } catch (e) {
      console.warn('[Server Chat Validate Notice]:', e);
    }

    // 3. Allowed Message Dispatch
    const newMsg: ChatMessageItem = {
      id: `msg_${Date.now()}`,
      sender: participantName,
      role: userRole === 'tutor' ? 'Tutor' : 'Student',
      text: rawText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, newMsg]);
    setIsChatOpen(true);

    if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
      const payload = new TextEncoder().encode(JSON.stringify({
        type: 'CHAT',
        sender: participantName,
        role: userRole === 'tutor' ? 'Tutor' : 'Student',
        text: rawText
      }));
      roomRef.current.localParticipant.publishData(payload, { reliable: true });
    }
    setChatInputText('');
  };

  const handleToggleChatInSidebar = () => {
    setIsChatOpen(prev => {
      const next = !prev;
      if (next) setUnreadChatCount(0);
      return next;
    });
  };

  return (
    <ClassroomContext.Provider
      value={{
        tokenData,
        roomName,
        userRole,
        participantName,
        connectionStatus,
        isActive,

        isAudioMuted,
        isScreenSharing,
        isCameraActive,
        isLocalBrowserSharingScreen,
        activeScreenShareParticipant,
        activeCameraParticipant,
        audioPlaybackBlocked,
        localAudioLevel,

        themeMode,
        isLight,
        toggleThemeMode,

        joinClassroomSession,
        leaveClassroomSession,
        finishCurrentStudentLesson,
        endClassForEveryone,
        handleToggleAudio,
        handleToggleScreenShare,
        handleToggleCamera,
        openFloatingControlBar,

        isChatOpen,
        unreadChatCount,
        chatMessages,
        chatInputText,
        setChatInputText,
        handleSendChatMessage,
        handleToggleChatInSidebar,
        setIsChatOpen,
        chatSafetySettings,
        chatWarningMessage,
        setChatWarningMessage,

        embeddedPdfUrl,
        setEmbeddedPdfUrl,

        filteredParticipants,
        activeVisibleParticipantsCount,
        elapsedSeconds,
        formatChronometerTime,
        presenceToast,
        setPresenceToast,
        waitingQueue,
        handleWaitingRoomAction,

        audioInputDevices,
        audioOutputDevices,
        videoInputDevices,
        selectedAudioInput,
        selectedAudioOutput,
        selectedVideoInput,
        setSelectedAudioInput,
        setSelectedAudioOutput,
        setSelectedVideoInput,
        showDeviceSettingsModal,
        setShowDeviceSettingsModal,
        showLeaveConfirmModal,
        setShowLeaveConfirmModal,

        pipWindow,
        stageContainerRef,
        remoteAudioContainerRef,
        screenShareVideoRef,
        studentCameraVideoRef,
        pipCanvasRef,
        pipFallbackVideoRef,
      }}
    >
      {children}
    </ClassroomContext.Provider>
  );
};

export const useClassroom = () => {
  const context = useContext(ClassroomContext);
  if (!context) {
    throw new Error('useClassroom must be used within a ClassroomProvider');
  }
  return context;
};
