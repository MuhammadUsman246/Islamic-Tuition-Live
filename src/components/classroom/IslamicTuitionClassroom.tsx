import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  RemoteParticipant,
  Participant,
  RemoteTrack,
  LocalAudioTrack,
  createLocalAudioTrack,
  AudioPresets,
  VideoPresets
} from 'livekit-client';
import {
  Mic,
  MicOff,
  PhoneOff,
  Lock,
  MessageSquare,
  Users,
  Settings,
  ShieldCheck,
  Clock,
  Sparkles,
  X,
  Send,
  UserCheck,
  UserX,
  Sliders,
  Monitor,
  Camera,
  CameraOff,
  Play,
  RotateCcw,
  AlertTriangle,
  Headphones,
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  BookOpen,
  Volume2,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  ChevronDown
} from 'lucide-react';
import {
  LiveKitRoomTokenResponse,
  UserRole,
  WaitingRoomParticipant
} from '../../types';
import { createOptimizedLiveKitRoom, executeLiveKitCloudRoomAdminAction } from '../../services/livekitService';
import {
  ChatSafetySettings,
  DEFAULT_CHAT_SAFETY_SETTINGS,
  checkMessageSafety
} from '../../utils/chatSafetyFilter';

interface IslamicTuitionClassroomProps {
  roomName: string;
  tokenData: LiveKitRoomTokenResponse;
  userRole: UserRole;
  participantName: string;
  settings?: any;
  initialMuted?: boolean;
  onLeave: () => void;
  className?: string;
}

interface ChatMessageItem {
  id: string;
  sender: string;
  role: string;
  text: string;
  timestamp: string;
}

interface ParticipantInfo {
  id: string;
  name: string;
  role: string;
  isSpeaking: boolean;
  isMuted: boolean;
  hasAudioTrack: boolean;
  hasVideoTrack: boolean;
  isScreenSharing: boolean;
  audioLevel: number;
}

/**
 * Creates a Studio Voice Isolation Web Audio filter graph that strips out:
 * - Laptop fan / AC / machine rumble (< 120 Hz High-Pass Filter)
 * - 50/60 Hz electrical hum (Notch Filter)
 * - High-frequency static / white-noise hiss (> 6,800 Hz Low-Pass Filter)
 * while enhancing vocal Tajweed clarity (2.4 kHz presence boost).
 */
function createStudioVoiceFilterTrack(
  rawStream: MediaStream
): { filteredTrack: MediaStreamTrack; audioCtx: AudioContext } | null {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;

    const audioCtx: AudioContext = new AudioCtx({ sampleRate: 48000 });
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    const source = audioCtx.createMediaStreamSource(rawStream);

    // 1. High-Pass Filter @ 125 Hz: Cuts laptop fan, AC rumble, desk thumps
    const highPass = audioCtx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = 125;
    highPass.Q.value = 0.707;

    // 2. Electrical Hum Notch Filter @ 60 Hz
    const humNotch = audioCtx.createBiquadFilter();
    humNotch.type = 'notch';
    humNotch.frequency.value = 60;
    humNotch.Q.value = 10;

    // 3. Low-Pass Filter @ 6800 Hz: Cuts microphone static hiss & high-pitched whine
    const lowPass = audioCtx.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.value = 6800;
    lowPass.Q.value = 0.707;

    // 4. Tajweed Speech Presence Filter @ 2400 Hz (+2 dB for crisp Arabic letters)
    const presence = audioCtx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 2400;
    presence.Q.value = 1.0;
    presence.gain.value = 2.0;

    // 5. Gentle Broadcast Compressor (prevents clipping without boosting background silence)
    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 12;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;

    const destination = audioCtx.createMediaStreamDestination();

    source.connect(humNotch);
    humNotch.connect(highPass);
    highPass.connect(lowPass);
    lowPass.connect(presence);
    presence.connect(compressor);
    compressor.connect(destination);

    const filteredTrack = destination.stream.getAudioTracks()[0];
    if (!filteredTrack) {
      audioCtx.close().catch(() => {});
      return null;
    }

    return { filteredTrack, audioCtx };
  } catch (e) {
    console.warn('Studio voice filter fallback to native track:', e);
    return null;
  }
}

/**
 * Plays a warm, subtle studio connection harmonic chime when entering the classroom
 * or when a student/tutor connects or leaves, giving a refined Zoom-like broadcast feel.
 */
function playStudioConnectionChime(type: 'connect' | 'peer_join' | 'peer_leave' = 'connect') {
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

export const IslamicTuitionClassroom: React.FC<IslamicTuitionClassroomProps> = ({
  roomName,
  tokenData,
  userRole,
  participantName,
  settings,
  initialMuted = false,
  onLeave,
  className = '',
}) => {
  const normalizedRole = (userRole || tokenData?.role || '').toLowerCase();
  const isAdmin = normalizedRole === 'admin';
  const isSupervisor = normalizedRole === 'supervisor';
  const isAdminOrSupervisor = isAdmin || isSupervisor;
  const isActualTutor =
    !isAdminOrSupervisor &&
    (normalizedRole === 'tutor' ||
      (tokenData?.participantIdentity || '').toLowerCase().includes('tutor') ||
      (participantName || '').toLowerCase().startsWith('tutor'));
  const isTutor = isActualTutor || isAdminOrSupervisor;
  const isStudent = !isTutor;

  // Theme Mode: Default to 'dark' (Enhanced Premium High-Contrast Black) with 1-click Light/Dark toggle
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('it_classroom_theme_v2');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {}
    return 'dark';
  });
  const isLight = themeMode === 'light';

  const toggleThemeMode = () => {
    const next = isLight ? 'dark' : 'light';
    setThemeMode(next);
    try {
      localStorage.setItem('it_classroom_theme_v2', next);
    } catch {}
  };

  // Studio Background & Machine Noise Filter (Permanently ON) & Auto-Gain Control (Permanently OFF so fan noise is never boosted)
  const studioNoiseFilter = true;
  const enableAutoGain = false;

  // LiveKit Room instance & DOM Refs
  const roomRef = useRef<Room | null>(null);
  const remoteAudioContainerRef = useRef<HTMLDivElement | null>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement | null>(null);
  const studentCameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const filterAudioCtxRef = useRef<AudioContext | null>(null);
  const rawMicStreamRef = useRef<MediaStream | null>(null);

  // Connection & Track States (Admins & Supervisors always enter auto-muted in stealth mode)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>(ConnectionState.Connecting);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(initialMuted || isAdminOrSupervisor);
  const isAudioMutedRef = useRef<boolean>(initialMuted || isAdminOrSupervisor);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [showCameraConfirmModal, setShowCameraConfirmModal] = useState<boolean>(false);
  const [activeScreenShareParticipant, setActiveScreenShareParticipant] = useState<string | null>(null);
  const [activeCameraParticipant, setActiveCameraParticipant] = useState<string | null>(null);
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState<boolean>(false);
  const [isStageFullscreen, setIsStageFullscreen] = useState<boolean>(false);

  // Hardware Devices
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>('');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('');
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>('');
  const selectedAudioOutputRef = useRef<string>('');

  // Right Sidebar & Chat: BOTH CLOSED by default for clean full-screen stage presentation!
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [mobileDrawerTab, setMobileDrawerTab] = useState<'participants' | 'chat'>('chat');
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([]);
  const [chatInputText, setChatInputText] = useState<string>('');
  const [chatSafetySettings, setChatSafetySettings] = useState<ChatSafetySettings>(DEFAULT_CHAT_SAFETY_SETTINGS);
  const [chatWarningMessage, setChatWarningMessage] = useState<string | null>(null);
  const [isSendingChat, setIsSendingChat] = useState<boolean>(false);
  const chatInputRef = useRef<HTMLInputElement | null>(null);

  // Mobile & Student Quran Mushaf Zoom & Pan State (Pinch-to-Zoom + Tap 1x/1.5x/2x + Drag Pan)
  const [screenZoomLevel, setScreenZoomLevel] = useState<number>(1);
  const [screenPan, setScreenPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isPanningScreenRef = useRef<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({ x: 0, y: 0, panX: 0, panY: 0 });
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);

  // Zoom-Style Live Join / Leave Presence Toast Banner State & Peer Name Cache
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
  const peerMuteOverridesRef = useRef<Record<string, boolean>>({});
  const lastProcessedMuteCommandIdRef = useRef<string>('');
  const serverHeartbeatPeersRef = useRef<Array<{ identity: string; name: string; role: string; isMuted?: boolean }>>([]);

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

  // Load Admin Classroom Chat Safety Settings
  useEffect(() => {
    fetch('/api/chat/safety-settings')
      .then(r => r.json())
      .then(data => {
        if (data?.settings) {
          setChatSafetySettings(data.settings);
        }
      })
      .catch(() => {});
  }, []);

  // Always-On-Top Floating Mini Control Bar (Document Picture-in-Picture & Canvas PiP Fallback for Iframes)
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const pipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pipFallbackVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isLocalBrowserSharingScreen, setIsLocalBrowserSharingScreen] = useState<boolean>(false);
  const [embeddedPdfUrl, setEmbeddedPdfUrl] = useState<string | null>(null);
  const [embeddedPdfPage, setEmbeddedPdfPage] = useState<number>(1);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  // Single-Instance Browser BroadcastChannel & LocalStorage Guard
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('islamic_tuition_single_instance');
        bc.onmessage = (e) => {
          if (e.data?.type === 'CLASSROOM_OPENED' && e.data?.role === userRole && e.data?.roomName === roomName && e.data?.tabId !== instanceTabIdRef.current) {
            // Newer tab opened same classroom for same role - cleanly disconnect background duplicate
            if (roomRef.current) {
              try { roomRef.current.disconnect(); } catch {}
            }
          } else if (e.data?.type === 'SCREEN_SHARE_ACTIVE') {
            if (e.data?.roomName === roomName) {
              setIsLocalBrowserSharingScreen(e.data?.isSharing);
            }
          }
        };
        bc.postMessage({ type: 'CLASSROOM_OPENED', role: userRole, roomName, tabId: instanceTabIdRef.current });
      }
    } catch {}

    return () => {
      if (bc) bc.close();
    };
  }, [userRole, roomName]);

  const instanceTabIdRef = useRef<string>(`tab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

  useEffect(() => {
    pipWindowRef.current = pipWindow;
  }, [pipWindow]);

  useEffect(() => {
    isAudioMutedRef.current = isAudioMuted;
  }, [isAudioMuted]);

  useEffect(() => {
    selectedAudioOutputRef.current = selectedAudioOutput;
    if (selectedAudioOutput && remoteAudioContainerRef.current) {
      const audioEls = remoteAudioContainerRef.current.querySelectorAll('audio');
      audioEls.forEach((el: any) => {
        if (el.setSinkId) {
          el.setSinkId(selectedAudioOutput).catch(() => {});
        }
      });
    }
    if (selectedAudioOutput && roomRef.current && roomRef.current.state === ConnectionState.Connected) {
      roomRef.current.switchActiveDevice('audiooutput', selectedAudioOutput).catch(() => {});
    }
  }, [selectedAudioOutput]);

  // Auto-scroll chat to bottom when new message arrives or chat opens
  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen, isSidebarOpen]);

  // 5-Second Voice Recorder Loopback Test States
  const [micTestState, setMicTestState] = useState<'idle' | 'recording' | 'recorded' | 'playing'>('idle');
  const [micTestError, setMicTestError] = useState<string | null>(null);
  const [testCountdown, setTestCountdown] = useState<number>(5);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [testAudioLevel, setTestAudioLevel] = useState<number>(0);
  const testMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const testAudioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const testAudioChunksRef = useRef<Blob[]>([]);
  const testAnimFrameRef = useRef<number | null>(null);

  // Participant List & State
  const [filteredParticipants, setFilteredParticipants] = useState<ParticipantInfo[]>([]);
  const [activeVisibleParticipantsCount, setActiveVisibleParticipantsCount] = useState<number>(1);
  const [localAudioLevel, setLocalAudioLevel] = useState<number>(0);

  // Chronometer & Recording
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [isEgressRecordingActive, setIsEgressRecordingActive] = useState<boolean>(false);

  // Modals
  const [showDeviceSettingsModal, setShowDeviceSettingsModal] = useState<boolean>(false);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState<boolean>(false);
  const [pendingHostConfirm, setPendingHostConfirm] = useState<{
    type: 'REMOVE_STUDENT' | 'REMOVE_TUTOR' | 'END_FOR_ALL' | 'FINISH_LESSON';
    targetId?: string;
    targetName?: string;
  } | null>(null);

  // Tutor Waiting Room Queue (Live Badge, Since Time, Admit & Keep in Waiting actions)
  const [waitingQueue, setWaitingQueue] = useState<WaitingRoomParticipant[]>([]);
  const waitingQueueRef = useRef<WaitingRoomParticipant[]>([]);
  const serverWaitingListRef = useRef<WaitingRoomParticipant[]>([]);
  const livekitWaitingListRef = useRef<WaitingRoomParticipant[]>([]);
  const [acknowledgedWaitingIds, setAcknowledgedWaitingIds] = useState<Set<string>>(new Set());
  const acknowledgedWaitingIdsRef = useRef<Set<string>>(new Set());
  const [waitingTicker, setWaitingTicker] = useState<number>(0);
  const [showWaitingRoomModal, setShowWaitingRoomModal] = useState<boolean>(false);
  const notifiedWaitingIdsRef = useRef<Set<string>>(new Set());
  const isIdleStandbyRef = useRef<boolean>(false);
  const lastHeartbeatSentAtRef = useRef<number>(0);

  useEffect(() => {
    waitingQueueRef.current = waitingQueue;
  }, [waitingQueue]);

  useEffect(() => {
    acknowledgedWaitingIdsRef.current = acknowledgedWaitingIds;
  }, [acknowledgedWaitingIds]);

  // Active Token Data state (updates with valid LiveKit JWT upon admission from Waiting Room)
  const [activeTokenData, setActiveTokenData] = useState<LiveKitRoomTokenResponse>(tokenData);

  // Student "Next Student Lounge" & "Waiting for Tutor Lounge" State + Live Remaining Time Countdown
  const [isStudentInWaitingLounge, setIsStudentInWaitingLounge] = useState<boolean>(
    Boolean(!isTutor && (tokenData.inWaitingRoom || !tokenData.token))
  );
  const isStudentInWaitingLoungeRef = useRef<boolean>(
    Boolean(!isTutor && (tokenData.inWaitingRoom || !tokenData.token))
  );
  const waitingLoungeJoinedAtRef = useRef<string>(new Date().toISOString());
  const isAdmittedExplicitlyRef = useRef<boolean>(false);
  const hasEnteredActiveClassroomRef = useRef<boolean>(
    Boolean(!isTutor && !tokenData.inWaitingRoom && tokenData.token)
  );

  useEffect(() => {
    isStudentInWaitingLoungeRef.current = isStudentInWaitingLounge;
  }, [isStudentInWaitingLounge]);

  const [studentWaitingId, setStudentWaitingId] = useState<string | null>(tokenData.waitingId || null);
  const [studentWaitingReason, setStudentWaitingReason] = useState<'NEXT_STUDENT_QUEUE' | 'TUTOR_NOT_PRESENT'>(
    (tokenData as any).waitingReason || 'NEXT_STUDENT_QUEUE'
  );
  const studentWaitingReasonRef = useRef<'NEXT_STUDENT_QUEUE' | 'TUTOR_NOT_PRESENT'>(
    (tokenData as any).waitingReason || 'NEXT_STUDENT_QUEUE'
  );
  useEffect(() => {
    studentWaitingReasonRef.current = studentWaitingReason;
  }, [studentWaitingReason]);

  const [studentQueuePosition, setStudentQueuePosition] = useState<number>(tokenData.queuePosition || 1);
  const [loungeTutorName, setLoungeTutorName] = useState<string>(() => {
    const raw = tokenData.tutorName || (roomName.match(/\d+/) ? `Tutor ${roomName.match(/\d+/)![0]}` : 'Tutor');
    if (userRole === 'student' || userRole === 'parent' || userRole === 'guest') {
      const m = `${raw} ${roomName}`.match(/(\d+)/);
      return m ? `Tutor ${m[1]}` : 'Tutor';
    }
    return raw;
  });
  const [loungeEndTimeMs, setLoungeEndTimeMs] = useState<number | null>(tokenData.currentLessonEndTimeMs || null);
  const [loungeRemainingSecs, setLoungeRemainingSecs] = useState<number>(() => {
    if (tokenData.currentLessonEndTimeMs && tokenData.currentLessonEndTimeMs > Date.now()) {
      return Math.max(0, Math.floor((tokenData.currentLessonEndTimeMs - Date.now()) / 1000));
    }
    return 0;
  });
  const [loungeRejectedMessage, setLoungeRejectedMessage] = useState<string | null>(null);

  // Live 1-second ticker for Tutor Waiting Room: guarantees live duration updates every second
  useEffect(() => {
    if (!isTutor || waitingQueue.length === 0) return;
    const ticker = setInterval(() => {
      setWaitingTicker(prev => prev + 1);
    }, 1000);
    return () => clearInterval(ticker);
  }, [isTutor, waitingQueue.length]);

  // Computes precise dynamic waiting duration in real time
  const formatWaitingDuration = useCallback((w: WaitingRoomParticipant): string => {
    const joinedMs = new Date(w.joined_at).getTime();
    const secs = !isNaN(joinedMs)
      ? Math.max(0, Math.floor((Date.now() - joinedMs) / 1000))
      : (typeof w.waiting_seconds === 'number' ? w.waiting_seconds : 0);
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    if (mins === 0) return `${Math.max(1, secs)}s`;
    if (mins === 1 && remSecs === 0) return '1 minute';
    if (remSecs === 0) return `${mins} minutes`;
    return `${mins}m ${remSecs}s`;
  }, [waitingTicker]);

  // Formats the exact time since the student entered waiting room
  const formatJoinedSinceTime = useCallback((joinedAtStr: string): string => {
    try {
      const d = new Date(joinedAtStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '';
    }
  }, []);

  // Merge server waiting list + LiveKit real-time waiting peers and update Tutor Waiting Queue
  const refreshCombinedWaitingQueue = useCallback(() => {
    const combinedMap = new Map<string, WaitingRoomParticipant>();
    serverWaitingListRef.current.forEach((w) => {
      const key = (w.guest_name || w.id || '').toLowerCase().trim();
      if (key) combinedMap.set(key, w);
    });
    livekitWaitingListRef.current.forEach((lw) => {
      const key = (lw.guest_name || lw.id || '').toLowerCase().trim();
      if (key && !combinedMap.has(key)) {
        combinedMap.set(key, lw);
      } else if (key && combinedMap.has(key)) {
        const existing = combinedMap.get(key)!;
        combinedMap.set(key, {
          ...existing,
          ...(lw as any).identity ? { identity: (lw as any).identity } : {}
        } as any);
      }
    });
    const merged = Array.from(combinedMap.values()).map((item, idx) => ({
      ...item,
      queue_position: idx + 1
    }));
    setWaitingQueue(merged);
    merged.forEach((w) => {
      if ((w as any).tutorAcknowledged) {
        setAcknowledgedWaitingIds(prev => {
          if (prev.has(w.id)) return prev;
          const next = new Set(prev);
          next.add(w.id);
          return next;
        });
      }
      const notifyKey = (w.guest_name || w.id || '').toLowerCase();
      if (notifyKey && !notifiedWaitingIdsRef.current.has(notifyKey)) {
        notifiedWaitingIdsRef.current.add(notifyKey);
        playStudioConnectionChime('connect');
      }
    });
  }, []);

  // Sync incoming waitingList from Server for Tutor without any blocking popup modal
  const updateTutorWaitingQueue = useCallback((list: WaitingRoomParticipant[]) => {
    serverWaitingListRef.current = list;
    refreshCombinedWaitingQueue();
  }, [refreshCombinedWaitingQueue]);

  // Student Next Student Lounge: Local 1-second Remaining Time Countdown (Zero extra server/Firebase load)
  useEffect(() => {
    if (!isStudentInWaitingLounge || !loungeEndTimeMs) return;
    const tick = () => {
      const rem = Math.max(0, Math.floor((loungeEndTimeMs - Date.now()) / 1000));
      setLoungeRemainingSecs(rem);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [isStudentInWaitingLounge, loungeEndTimeMs]);

  // Student Next Student Lounge: Poll every 1.8s for automatic admittance when current student finishes or Tutor admits
  useEffect(() => {
    if (!isStudentInWaitingLounge) return;
    let cancelled = false;

    const pollStudentLoungeStatus = async () => {
      // 1. Real-time LiveKit room check: if connected to LiveKit, re-evaluate remote participants for instant auto-promotion!
      if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
        syncParticipantsState(roomRef.current);
        if (!isStudentInWaitingLoungeRef.current) return;
      }

      // 2. Server queue & admittance check (when backend API is reachable)
      try {
        const queryParam = studentWaitingId
          ? `waitingId=${encodeURIComponent(studentWaitingId)}`
          : `roomSlug=${encodeURIComponent(roomName)}`;
        const res = await fetch(`/api/livekit/waiting-room?${queryParam}`);
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (cancelled || !isStudentInWaitingLoungeRef.current) return;
          if (typeof data.queuePosition === 'number') setStudentQueuePosition(data.queuePosition);
          if (data.tutorName) {
            const m = `${data.tutorName} ${roomName}`.match(/(\d+)/);
            setLoungeTutorName(
              (userRole === 'student' || userRole === 'parent' || userRole === 'guest')
                ? (m ? `Tutor ${m[1]}` : 'Tutor')
                : data.tutorName
            );
          }
          if (data.currentLessonEndTimeMs) setLoungeEndTimeMs(data.currentLessonEndTimeMs);
          if (data.participant?.reason) {
            setStudentWaitingReason(data.participant.reason);
          } else if (data.activeStudentCount > 0) {
            setStudentWaitingReason('NEXT_STUDENT_QUEUE');
          }

          const isAdmittedByServer =
            data.participant?.status === 'ADMITTED' ||
            Boolean(data.token) ||
            (typeof data.activeStudentCount === 'number' &&
              data.activeStudentCount === 0 &&
              (studentWaitingReasonRef.current === 'NEXT_STUDENT_QUEUE' || Boolean(data.tutorPresent)));

          if (isAdmittedByServer) {
            isAdmittedExplicitlyRef.current = true;
            if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
              await promoteStudentFromWaitingLoungeRef.current?.(roomRef.current);
              return;
            }
            handleResetMicTest();
            if (data.token) {
              setActiveTokenData(prev => ({
                ...prev,
                token: data.token,
                serverUrl: data.serverUrl || prev.serverUrl,
                roomName: data.roomName || prev.roomName,
                inWaitingRoom: false
              }));
              isStudentInWaitingLoungeRef.current = false;
              setIsStudentInWaitingLounge(false);
            } else {
              try {
                const tokenRes = await fetch('/api/livekit/token', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    roomId: roomName,
                    identity: activeTokenData.participantIdentity || participantName,
                    participantName: participantName,
                    role: userRole,
                    admittedWaitingId: studentWaitingId
                  })
                });
                const tokenJson = await tokenRes.json();
                if (tokenJson.token) {
                  setActiveTokenData(prev => ({
                    ...prev,
                    token: tokenJson.token,
                    serverUrl: tokenJson.serverUrl || prev.serverUrl,
                    roomName: tokenJson.roomName || prev.roomName,
                    inWaitingRoom: false
                  }));
                  isStudentInWaitingLoungeRef.current = false;
                  setIsStudentInWaitingLounge(false);
                }
              } catch (e) {
                console.error('[Waiting Lounge] Error retrieving token:', e);
              }
            }
          } else if (data.participant?.status === 'REJECTED') {
            setLoungeRejectedMessage('The tutor asked to reschedule or closed this session.');
          }
        }
      } catch {}
    };

    const interval = setInterval(pollStudentLoungeStatus, 1800);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isStudentInWaitingLounge, studentWaitingId, roomName]);

  // Chronometer interval
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

  // Helper function to check if participant is a hidden admin or supervisor observer
  const isParticipantHiddenAdmin = (p: Participant): boolean => {
    try {
      const idOrName = `${p.identity || ''} ${p.name || ''}`.toLowerCase();
      if (
        idOrName.includes('admin_obs') ||
        idOrName.includes('supervisor_obs') ||
        idOrName.includes('observer') ||
        idOrName.includes('invisible')
      ) {
        return true;
      }
      if (!p.metadata) return false;
      const parsed = JSON.parse(p.metadata);
      return Boolean(parsed.hidden || parsed.role === 'admin' || parsed.role === 'supervisor');
    } catch {
      return false;
    }
  };

  // Helper function to check if participant is currently holding in the Waiting Lounge
  const isParticipantInWaitingLounge = (p: Participant): boolean => {
    try {
      if (!p.metadata) return false;
      const parsed = JSON.parse(p.metadata);
      return parsed.status === 'WAITING';
    } catch {
      return false;
    }
  };

  // Helper function to resolve accurate participant role from metadata, cache, or identity/name
  const resolveRemoteParticipantRole = useCallback((p: Participant): string => {
    const cached = peerCustomNamesRef.current[p.identity];
    if (cached?.role) return cached.role;
    try {
      if (p.metadata) {
        const meta = JSON.parse(p.metadata);
        if (meta.role === 'tutor') return 'Tutor';
        if (meta.role === 'admin') return 'Admin';
        if (meta.role === 'supervisor') return 'Supervisor';
        if (meta.role === 'student' || meta.role === 'guest' || meta.role === 'parent') return 'Student';
      }
    } catch {}
    const idOrName = `${p.identity || ''} ${p.name || ''}`.toLowerCase();
    if (idOrName.includes('tutor') || idOrName.includes('ustadh') || idOrName.includes('teacher')) {
      return 'Tutor';
    }
    return 'Student';
  }, []);

  const resolveRemoteParticipantName = useCallback((p: Participant): string => {
    const cached = peerCustomNamesRef.current[p.identity];
    const rawName = cached?.name || p.name || p.identity || 'Participant';
    const role = resolveRemoteParticipantRole(p);
    if (role === 'Tutor' && (userRole === 'student' || userRole === 'parent' || userRole === 'guest')) {
      const match = `${p.identity || ''} ${rawName} ${roomName}`.match(/(\d+)/);
      return match ? `Tutor ${match[1]}` : 'Tutor';
    }
    return rawName;
  }, [resolveRemoteParticipantRole, userRole, roomName]);

  // Attach and play a remote audio track reliably with zero duplicate elements and instant low-latency playback
  const attachRemoteAudioTrack = useCallback((track: RemoteTrack, room?: Room) => {
    if (isStudentInWaitingLoungeRef.current) return;
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

    const playPromise = audioEl.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        if (room && !room.canPlaybackAudio) {
          setAudioPlaybackBlocked(true);
        }
      });
    }
  }, []);

  // Synchronize visible participants list excluding hidden admins & waiting room students
  const syncParticipantsState = useCallback((room: Room) => {
    // If local student is in the Waiting Lounge, do not attach remote audio and check if classroom is now free!
    if (isStudentInWaitingLoungeRef.current && !isTutor && !isAdminOrSupervisor) {
      if (remoteAudioContainerRef.current) {
        remoteAudioContainerRef.current.innerHTML = '';
      }
      const remotePeers = Array.from(room.remoteParticipants.values());
      const otherActiveStudents = remotePeers.filter((p) => {
        if (isParticipantHiddenAdmin(p) || isParticipantInWaitingLounge(p)) return false;
        const r = resolveRemoteParticipantRole(p);
        return r === 'Student' || r === 'Guest';
      });
      const activeTutors = remotePeers.filter((p) => {
        if (isParticipantHiddenAdmin(p)) return false;
        return resolveRemoteParticipantRole(p) === 'Tutor';
      });

      // Compute our queue position among any LiveKit waiting peers
      const otherWaitingStudents = remotePeers.filter((p) => !isParticipantHiddenAdmin(p) && isParticipantInWaitingLounge(p));
      const myJoinedMs = new Date(waitingLoungeJoinedAtRef.current).getTime() || Date.now();
      let earlierWaiters = 0;
      otherWaitingStudents.forEach((wp) => {
        try {
          const meta = wp.metadata ? JSON.parse(wp.metadata) : {};
          const wMs = meta.joinedAt ? new Date(meta.joinedAt).getTime() : Date.now();
          if (wMs < myJoinedMs) earlierWaiters += 1;
        } catch {}
      });
      setStudentQueuePosition(earlierWaiters + 1);

      // Auto-enter classroom immediately as soon as the previous student leaves and classroom is empty!
      if (
        otherActiveStudents.length === 0 &&
        earlierWaiters === 0 &&
        (studentWaitingReasonRef.current === 'NEXT_STUDENT_QUEUE' || activeTutors.length > 0)
      ) {
        setTimeout(() => {
          if (isStudentInWaitingLoungeRef.current && roomRef.current) {
            promoteStudentFromWaitingLoungeRef.current?.(roomRef.current);
          }
        }, 80);
      }
      return;
    }

    const visibleList: ParticipantInfo[] = [];
    const livekitWaiters: WaitingRoomParticipant[] = [];

    // Local participant
    if (room.localParticipant) {
      const isHidden = isParticipantHiddenAdmin(room.localParticipant);
      const isWaiting = isParticipantInWaitingLounge(room.localParticipant) || isStudentInWaitingLoungeRef.current;
      const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      const screenPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);

      const localHasScreen = Boolean(screenPub?.track && !screenPub.isMuted);
      const localHasCam = Boolean(camPub?.track && !camPub.isMuted);
      setIsScreenSharing(localHasScreen);
      setIsCameraActive(localHasCam);
      setLocalAudioLevel(Math.min(100, Math.round((room.localParticipant.audioLevel || 0) * 100)));

      if (!isHidden && !isWaiting) {
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
    }

    // Remote participants
    let foundScreenShare: string | null = null;
    let foundCameraShare: string | null = null;
    room.remoteParticipants.forEach((p) => {
      if (isParticipantHiddenAdmin(p)) return;

      // If remote participant is in Waiting Lounge, add to Tutor's Waiting Queue and do NOT show in active class!
      if (isParticipantInWaitingLounge(p)) {
        let meta: any = {};
        try {
          if (p.metadata) meta = JSON.parse(p.metadata);
        } catch {}
        const pDisplayName = resolveRemoteParticipantName(p);
        const wId = meta.waitingId || `wait_lk_${p.identity}`;
        const joinedAtStr = meta.joinedAt || new Date().toISOString();
        const joinedMs = new Date(joinedAtStr).getTime();
        const waitingSecs = !isNaN(joinedMs) ? Math.max(1, Math.floor((Date.now() - joinedMs) / 1000)) : 1;
        livekitWaiters.push({
          id: wId,
          identity: p.identity,
          room_slug: roomName,
          guest_name: pDisplayName,
          status: 'WAITING',
          joined_at: joinedAtStr,
          waiting_seconds: waitingSecs,
          tutorAcknowledged: Boolean(meta.tutorAcknowledged || acknowledgedWaitingIdsRef.current.has(wId))
        } as any);
        return;
      }

      // Ensure any already-published remote audio tracks are attached immediately
      p.audioTrackPublications.forEach((pub) => {
        if (pub.track && pub.isSubscribed) {
          attachRemoteAudioTrack(pub.track as RemoteTrack, room);
        }
      });

      const pRole = resolveRemoteParticipantRole(p);
      const pDisplayName = resolveRemoteParticipantName(p);

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
        isMuted:
          peerMuteOverridesRef.current[p.identity.toLowerCase()] !== undefined
            ? peerMuteOverridesRef.current[p.identity.toLowerCase()]
            : peerMuteOverridesRef.current[pDisplayName.toLowerCase()] !== undefined
              ? peerMuteOverridesRef.current[pDisplayName.toLowerCase()]
              : micPub
                ? micPub.isMuted
                : true,
        hasAudioTrack: Boolean(micPub?.track),
        hasVideoTrack: Boolean(camPub?.track && !camPub.isMuted),
        isScreenSharing: Boolean(screenPub?.track && !screenPub.isMuted),
        audioLevel: p.audioLevel
      });
    });

    if (isTutor) {
      livekitWaitingListRef.current = livekitWaiters;
      refreshCombinedWaitingQueue();
    }

    // Also include any active heartbeat peers not yet reflected in visibleList (excluding anyone in waiting queue)
    serverHeartbeatPeersRef.current.forEach((hbPeer) => {
      const localId = room.localParticipant?.identity || tokenData.participantIdentity || participantName;
      if (hbPeer.identity === localId || hbPeer.name === participantName) return;
      const isWaitingPeer = livekitWaiters.some(
        w => (w as any).identity === hbPeer.identity || w.guest_name.toLowerCase() === (hbPeer.name || '').toLowerCase()
      ) || serverWaitingListRef.current.some(
        w => (w as any).identity === hbPeer.identity || w.guest_name.toLowerCase() === (hbPeer.name || '').toLowerCase()
      );
      if (isWaitingPeer) return;

      const alreadyListed = visibleList.some(v => v.id === hbPeer.identity || v.name.toLowerCase() === hbPeer.name.toLowerCase());
      if (!alreadyListed) {
        const normRole = hbPeer.role?.toLowerCase() === 'tutor' ? 'Tutor' : hbPeer.role?.toLowerCase() === 'admin' ? 'Admin' : hbPeer.role?.toLowerCase() === 'supervisor' ? 'Supervisor' : 'Student';
        let hbDisplayName = hbPeer.name || hbPeer.identity;
        if (normRole === 'Tutor' && (userRole === 'student' || userRole === 'parent' || userRole === 'guest')) {
          const match = `${hbPeer.identity || ''} ${hbDisplayName} ${roomName}`.match(/(\d+)/);
          hbDisplayName = match ? `Tutor ${match[1]}` : 'Tutor';
        }
        const resolvedHbMuted =
          peerMuteOverridesRef.current[hbPeer.identity.toLowerCase()] !== undefined
            ? peerMuteOverridesRef.current[hbPeer.identity.toLowerCase()]
            : peerMuteOverridesRef.current[hbDisplayName.toLowerCase()] !== undefined
              ? peerMuteOverridesRef.current[hbDisplayName.toLowerCase()]
              : Boolean(hbPeer.isMuted);
        visibleList.push({
          id: hbPeer.identity,
          name: hbDisplayName,
          role: normRole,
          isSpeaking: false,
          isMuted: resolvedHbMuted,
          hasAudioTrack: true,
          hasVideoTrack: false,
          isScreenSharing: false,
          audioLevel: 0
        });
      }
    });

    setActiveScreenShareParticipant(foundScreenShare);
    setActiveCameraParticipant(foundCameraShare);
    setFilteredParticipants(visibleList);
    setActiveVisibleParticipantsCount(visibleList.length);

    const hasStudentInRoom = visibleList.some(v => v.role === 'Student' || v.role === 'Guest');
    if (visibleList.length >= 2 && hasStudentInRoom) {
      setIsTimerRunning(true);
      if (settings?.recordingEnabled) {
        setIsEgressRecordingActive(true);
      }
    } else if (userRole === 'tutor' && !hasStudentInRoom) {
      // Zero-Load Idle Standby Mode when 0 students are in the room: pause timer until a student enters
      setIsTimerRunning(false);
      setElapsedSeconds(0);
    }
  }, [participantName, userRole, isTutor, isAdminOrSupervisor, roomName, settings?.recordingEnabled, attachRemoteAudioTrack, resolveRemoteParticipantRole, resolveRemoteParticipantName, tokenData.participantIdentity, refreshCombinedWaitingQueue]);

  const promoteStudentFromWaitingLoungeRef = useRef<((room?: Room | null) => Promise<void>) | null>(null);

  const localScreenStreamRef = useRef<MediaStream | null>(null);

  // Attach active Screen Share (Remote or Local Preview) & Student Camera video tracks whenever video state or participants change
  useEffect(() => {
    const attachTracksToRefs = () => {
      const room = roomRef.current;

      // 1. Attach Remote or Local Screen Share Video Track for the Shared Screen Section inside the meeting room
      if (screenShareVideoRef.current) {
        let remoteScreenTrack: Track | undefined;
        let localScreenTrack: Track | undefined;
        if (room && room.state === ConnectionState.Connected) {
          room.remoteParticipants.forEach((p) => {
            const pub = p.getTrackPublication(Track.Source.ScreenShare);
            if (pub?.track && !pub.isMuted) {
              remoteScreenTrack = pub.track;
            }
          });
          const localScreenPub = room.localParticipant?.getTrackPublication(Track.Source.ScreenShare);
          if (localScreenPub?.track && !localScreenPub.isMuted) {
            localScreenTrack = localScreenPub.track;
          }
        }

        if (remoteScreenTrack) {
          remoteScreenTrack.attach(screenShareVideoRef.current);
          screenShareVideoRef.current.muted = true;
          screenShareVideoRef.current.play().catch(() => {});
        } else if (isScreenSharing && localScreenTrack) {
          localScreenTrack.attach(screenShareVideoRef.current);
          screenShareVideoRef.current.muted = true;
          screenShareVideoRef.current.play().catch(() => {});
        } else if (isScreenSharing && localScreenStreamRef.current) {
          screenShareVideoRef.current.srcObject = localScreenStreamRef.current;
          screenShareVideoRef.current.muted = true;
          screenShareVideoRef.current.play().catch(() => {});
        } else if (!isScreenSharing && !remoteScreenTrack) {
          screenShareVideoRef.current.srcObject = null;
        }
      }

      if (!room || room.state !== ConnectionState.Connected) return;

      // 2. Attach Student Camera Video Track (Remote or Local) inside compact sidebar
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
    };

    attachTracksToRefs();
    const rafId = requestAnimationFrame(attachTracksToRefs);
    return () => cancelAnimationFrame(rafId);
  }, [isScreenSharing, activeScreenShareParticipant, isCameraActive, activeCameraParticipant, filteredParticipants, isSidebarOpen]);

  // Load hardware audio & video devices
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
      } catch (e) {
        console.warn('Device enumeration notice:', e);
      }
    }
    loadDevices();
  }, [selectedAudioInput, selectedAudioOutput, selectedVideoInput]);

  // Helper to capture and publish clean, studio-filtered microphone track
  const publishCleanMicrophoneTrack = useCallback(async (
    room: Room,
    deviceId?: string,
    useNoiseFilter = studioNoiseFilter,
    useAutoGain = enableAutoGain
  ) => {
    try {
      // Unpublish existing mic track if switching
      const existingPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      if (existingPub?.track) {
        await room.localParticipant.unpublishTrack(existingPub.track);
      }
      if (filterAudioCtxRef.current && filterAudioCtxRef.current.state !== 'closed') {
        filterAudioCtxRef.current.close().catch(() => {});
        filterAudioCtxRef.current = null;
      }
      if (rawMicStreamRef.current) {
        rawMicStreamRef.current.getTracks().forEach(t => t.stop());
        rawMicStreamRef.current = null;
      }

      const audioConstraints: MediaTrackConstraints = {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: useAutoGain,
        channelCount: 1,
        sampleRate: 48000,
        ...({
          voiceIsolation: true,
          googEchoCancellation: true,
          googNoiseSuppression: true,
          googHighpassFilter: true,
          googAutoGainControl: useAutoGain,
          latency: 0.01,
        } as any),
      };

      let micTrack: LocalAudioTrack;

      if (useNoiseFilter && navigator.mediaDevices?.getUserMedia) {
        const rawStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        rawMicStreamRef.current = rawStream;
        const filterRes = createStudioVoiceFilterTrack(rawStream);
        if (filterRes) {
          filterAudioCtxRef.current = filterRes.audioCtx;
          micTrack = new LocalAudioTrack(filterRes.filteredTrack, audioConstraints, false);
        } else {
          micTrack = await createLocalAudioTrack(audioConstraints);
        }
      } else {
        micTrack = await createLocalAudioTrack(audioConstraints);
      }

      if (isAudioMutedRef.current) {
        await micTrack.mute();
      }

      await room.localParticipant.publishTrack(micTrack, {
        source: Track.Source.Microphone,
        dtx: false, // Continuous speech stream: prevents first-syllable clipping & delayed audio
        red: true,  // Redundant audio frames: prevents voice breaking on unstable Wi-Fi / 4G
        audioPreset: {
          maxBitrate: 48_000,
          priority: 'high',
        },
      });

      syncParticipantsState(room);
    } catch (e) {
      console.warn('Mic publish notice:', e);
    }
  }, [studioNoiseFilter, enableAutoGain, syncParticipantsState]);

  // Promote a Waiting Lounge Student into the Active Classroom in 0ms without reconnecting the room
  const promoteStudentFromWaitingLoungeToClass = useCallback(async (room?: Room | null) => {
    if (!isStudentInWaitingLoungeRef.current) return;
    isStudentInWaitingLoungeRef.current = false;
    hasEnteredActiveClassroomRef.current = true;
    setIsStudentInWaitingLounge(false);
    handleResetMicTest();

    const activeRoom = room || roomRef.current;
    if (activeRoom && activeRoom.state === ConnectionState.Connected && activeRoom.localParticipant) {
      try {
        await activeRoom.localParticipant.setMetadata(
          JSON.stringify({
            role: userRole,
            status: 'ACTIVE'
          })
        );
      } catch {}

      try {
        const admitHello = new TextEncoder().encode(
          JSON.stringify({
            type: 'WAITING_ROOM_ADMITTED_SELF',
            identity: activeRoom.localParticipant.identity || tokenData.participantIdentity || participantName,
            name: participantName,
            waitingId: studentWaitingId
          })
        );
        activeRoom.localParticipant.publishData(admitHello as any, { reliable: true }).catch(() => {});

        const helloPayload = new TextEncoder().encode(
          JSON.stringify({
            type: 'PRESENCE_HELLO',
            identity: activeRoom.localParticipant.identity || tokenData.participantIdentity || participantName,
            name: participantName,
            role: 'Student'
          })
        );
        activeRoom.localParticipant.publishData(helloPayload as any, { reliable: true }).catch(() => {});
      } catch {}

      playStudioConnectionChime('connect');
      activeRoom.startAudio().catch(() => {});
      await publishCleanMicrophoneTrack(
        activeRoom,
        selectedAudioInput || undefined,
        studioNoiseFilter,
        enableAutoGain
      );
      syncParticipantsState(activeRoom);

      // Notify any already-present Tutor with chime + toast upon entering classroom
      activeRoom.remoteParticipants.forEach((existingPeer) => {
        if (
          !isParticipantHiddenAdmin(existingPeer) &&
          !isParticipantInWaitingLounge(existingPeer) &&
          !notifiedPeersRef.current.has(existingPeer.identity)
        ) {
          notifiedPeersRef.current.add(existingPeer.identity);
          const peerRole = resolveRemoteParticipantRole(existingPeer);
          const peerName = resolveRemoteParticipantName(existingPeer);
          setTimeout(() => {
            playStudioConnectionChime('peer_join');
            triggerPresenceToast(peerName, peerRole, 'join');
          }, 250);
        }
      });
    }
  }, [userRole, tokenData.participantIdentity, participantName, studentWaitingId, publishCleanMicrophoneTrack, selectedAudioInput, studioNoiseFilter, enableAutoGain, syncParticipantsState, resolveRemoteParticipantRole, resolveRemoteParticipantName]);

  useEffect(() => {
    promoteStudentFromWaitingLoungeRef.current = promoteStudentFromWaitingLoungeToClass;
  }, [promoteStudentFromWaitingLoungeToClass]);

  // Continuous Realtime Tutor Waiting Room Queue Sync:
  // Polls /api/livekit/waiting-room every 3s so the tutor immediately sees waiting students and since-times
  useEffect(() => {
    if (!isTutor) return;
    let isCancelled = false;

    const pollWaitingRoom = async () => {
      try {
        const res = await fetch(`/api/livekit/waiting-room?roomSlug=${encodeURIComponent(roomName)}`);
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (!isCancelled && data.waitingList) {
            updateTutorWaitingQueue(data.waitingList);
          }
        }
      } catch (e) {
        // Non-fatal
      }
      if (!isCancelled && roomRef.current && roomRef.current.state === ConnectionState.Connected) {
        syncParticipantsState(roomRef.current);
      }
    };

    pollWaitingRoom();
    const interval = setInterval(pollWaitingRoom, 2500);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [isTutor, roomName, updateTutorWaitingQueue, syncParticipantsState]);

  // Connect to LiveKit Room (Stable lifecycle - stays connected even in Waiting Lounge for 0ms auto-entry & tutor queue visibility)
  useEffect(() => {
    let isCancelled = false;

    async function initClassroom() {
      try {
        setConnectionStatus(ConnectionState.Connecting);

        if (tokenData.isMockSession) {
          setConnectionStatus(ConnectionState.Connected);
          setActiveVisibleParticipantsCount(2);
          setIsTimerRunning(true);
          if (settings?.recordingEnabled) {
            setIsEgressRecordingActive(true);
          }
          setFilteredParticipants([
            { id: 'tutor_01', name: participantName, role: isTutor ? 'Tutor' : 'Student', isSpeaking: false, isMuted: initialMuted, hasAudioTrack: true, hasVideoTrack: false, isScreenSharing: false, audioLevel: 0 },
            { id: 'student_01', name: isTutor ? 'Student' : (roomName.match(/(\d+)/) ? `Tutor ${roomName.match(/(\d+)/)![1]}` : 'Tutor 1'), role: isTutor ? 'Student' : 'Tutor', isSpeaking: false, isMuted: false, hasAudioTrack: true, hasVideoTrack: false, isScreenSharing: false, audioLevel: 0 }
          ]);
          return;
        }

        const room = createOptimizedLiveKitRoom(enableAutoGain);
        roomRef.current = room;

        room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
          if (isCancelled) return;
          setConnectionStatus(state);
        });

        room.on(RoomEvent.Disconnected, () => {
          if (isCancelled) return;
          // If a student or tutor is disconnected by the server (e.g. Admin removed tutor or Tutor/Admin ended class), exit cleanly
          if (!isAdminOrSupervisor) {
            isCancelled = true;
            onLeave();
          }
        });

        const broadcastPresenceHello = () => {
          try {
            if (
              room.state === ConnectionState.Connected &&
              room.localParticipant &&
              !isAdminOrSupervisor &&
              !isParticipantHiddenAdmin(room.localParticipant) &&
              !isStudentInWaitingLoungeRef.current
            ) {
              const helloPayload = new TextEncoder().encode(JSON.stringify({
                type: 'PRESENCE_HELLO',
                identity: room.localParticipant.identity || tokenData.participantIdentity || participantName,
                name: participantName,
                role: isActualTutor ? 'Tutor' : 'Student'
              }));
              room.localParticipant.publishData(helloPayload as any, { reliable: true }).catch(() => {});
            }
          } catch {}
        };

        const broadcastWaitingLoungePresence = () => {
          try {
            if (
              room.state === ConnectionState.Connected &&
              room.localParticipant &&
              isStudentInWaitingLoungeRef.current &&
              !isTutor &&
              !isAdminOrSupervisor
            ) {
              const wId = studentWaitingId || `wait_lk_${room.localParticipant.identity}`;
              const waitPayload = new TextEncoder().encode(JSON.stringify({
                type: 'WAITING_ROOM_JOIN',
                waitingId: wId,
                identity: room.localParticipant.identity || tokenData.participantIdentity || participantName,
                name: participantName,
                joinedAt: waitingLoungeJoinedAtRef.current
              }));
              room.localParticipant.publishData(waitPayload as any, { reliable: true }).catch(() => {});
            }
          } catch {}
        };

        room.on(RoomEvent.Connected, () => {
          if (isCancelled) return;

          // STRICT SINGLETON ENFORCEMENT & WAITING LOUNGE COORDINATION:
          // If this participant is a student or guest, check if another active student is already in this 1-on-1 session!
          if (!isTutor && userRole !== 'admin' && userRole !== 'supervisor') {
            const existingOtherActiveStudents = Array.from(room.remoteParticipants.values()).filter((p) => {
              if (isParticipantHiddenAdmin(p) || isParticipantInWaitingLounge(p)) return false;
              const pRole = resolveRemoteParticipantRole(p);
              return pRole === 'Student' || pRole === 'Guest';
            });
            const activeTutorsInRoom = Array.from(room.remoteParticipants.values()).filter((p) => {
              if (isParticipantHiddenAdmin(p)) return false;
              return resolveRemoteParticipantRole(p) === 'Tutor';
            });

            if (existingOtherActiveStudents.length > 0 && !isAdmittedExplicitlyRef.current) {
              console.warn('[Classroom Singleton Guard] Another student is active in this room. Holding in Waiting Lounge with live signaling.');
              isStudentInWaitingLoungeRef.current = true;
              hasEnteredActiveClassroomRef.current = false;
              setIsStudentInWaitingLounge(true);
              setStudentWaitingReason('NEXT_STUDENT_QUEUE');
              studentWaitingReasonRef.current = 'NEXT_STUDENT_QUEUE';

              const wId = studentWaitingId || `wait_lk_${room.localParticipant.identity}`;
              if (!studentWaitingId) setStudentWaitingId(wId);

              room.localParticipant.setMetadata(JSON.stringify({
                role: userRole,
                status: 'WAITING',
                joinedAt: waitingLoungeJoinedAtRef.current,
                waitingId: wId
              })).catch(() => {});

              broadcastWaitingLoungePresence();

              // Also register on the backend server when reachable to sync queue position & countdown
              fetch('/api/livekit/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  roomId: roomName,
                  identity: activeTokenData.participantIdentity || participantName,
                  participantName: participantName,
                  role: userRole
                })
              })
                .then(r => r.json())
                .then(data => {
                  if (data.waitingId) setStudentWaitingId(data.waitingId);
                  if (data.queuePosition) setStudentQueuePosition(data.queuePosition);
                  if (data.currentLessonEndTimeMs) setLoungeEndTimeMs(data.currentLessonEndTimeMs);
                })
                .catch(() => {});

              setConnectionStatus(ConnectionState.Connected);
              syncParticipantsState(room);
              return;
            }

            // If student was initially marked inWaitingRoom, check if the room is actually empty now!
            if (isStudentInWaitingLoungeRef.current) {
              if (
                existingOtherActiveStudents.length === 0 &&
                (studentWaitingReasonRef.current === 'NEXT_STUDENT_QUEUE' || activeTutorsInRoom.length > 0)
              ) {
                isStudentInWaitingLoungeRef.current = false;
                hasEnteredActiveClassroomRef.current = true;
                setIsStudentInWaitingLounge(false);
                room.localParticipant.setMetadata(JSON.stringify({
                  role: userRole,
                  status: 'ACTIVE'
                })).catch(() => {});
              } else {
                const wId = studentWaitingId || `wait_lk_${room.localParticipant.identity}`;
                if (!studentWaitingId) setStudentWaitingId(wId);
                room.localParticipant.setMetadata(JSON.stringify({
                  role: userRole,
                  status: 'WAITING',
                  joinedAt: waitingLoungeJoinedAtRef.current,
                  waitingId: wId
                })).catch(() => {});
                broadcastWaitingLoungePresence();
                setConnectionStatus(ConnectionState.Connected);
                syncParticipantsState(room);
                return;
              }
            } else {
              hasEnteredActiveClassroomRef.current = true;
            }
          }

          setConnectionStatus(ConnectionState.Connected);
          playStudioConnectionChime('connect');
          room.startAudio().catch(() => {});
          syncParticipantsState(room);
          broadcastPresenceHello();

          // If a student or tutor is ALREADY in the room when we connect, notify immediately with chime + toast!
          room.remoteParticipants.forEach((existingPeer) => {
            if (
              !isParticipantHiddenAdmin(existingPeer) &&
              !isParticipantInWaitingLounge(existingPeer) &&
              !notifiedPeersRef.current.has(existingPeer.identity)
            ) {
              notifiedPeersRef.current.add(existingPeer.identity);
              const peerRole = resolveRemoteParticipantRole(existingPeer);
              const peerName = resolveRemoteParticipantName(existingPeer);
              setTimeout(() => {
                if (!isCancelled) {
                  playStudioConnectionChime('peer_join');
                  triggerPresenceToast(peerName, peerRole, 'join');
                }
              }, 350);
            }
          });
        });

        room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
          if (isCancelled) return;
          if (isStudentInWaitingLoungeRef.current) {
            setTimeout(() => {
              if (!isCancelled && isStudentInWaitingLoungeRef.current) {
                broadcastWaitingLoungePresence();
                syncParticipantsState(room);
              }
            }, 250);
            syncParticipantsState(room);
            return;
          }

          if (!isParticipantHiddenAdmin(participant)) {
            if (isParticipantInWaitingLounge(participant)) {
              syncParticipantsState(room);
              return;
            }
            const pRole = resolveRemoteParticipantRole(participant);
            const pName = resolveRemoteParticipantName(participant);
            // Delay student join toast by 400ms on Tutor/Student screen in case incoming student transitions to WAITING metadata
            setTimeout(() => {
              if (isCancelled || !room.remoteParticipants.has(participant.identity)) return;
              if (isParticipantInWaitingLounge(participant)) {
                syncParticipantsState(room);
                return;
              }
              if (!notifiedPeersRef.current.has(participant.identity)) {
                notifiedPeersRef.current.add(participant.identity);
                playStudioConnectionChime('peer_join');
                triggerPresenceToast(pName, pRole, 'join');
              }
              broadcastPresenceHello();
              syncParticipantsState(room);
            }, 350);
          }
          syncParticipantsState(room);
        });

        room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
          if (isCancelled) return;
          livekitWaitingListRef.current = livekitWaitingListRef.current.filter(
            (w) => (w as any).identity !== participant.identity && w.guest_name !== resolveRemoteParticipantName(participant)
          );
          if (isTutor) {
            refreshCombinedWaitingQueue();
          }

          if (!isParticipantHiddenAdmin(participant) && !isParticipantInWaitingLounge(participant)) {
            const pRole = resolveRemoteParticipantRole(participant);
            const pName = resolveRemoteParticipantName(participant);
            const wasNotified = notifiedPeersRef.current.has(participant.identity);
            notifiedPeersRef.current.delete(participant.identity);
            delete peerCustomNamesRef.current[participant.identity];
            serverHeartbeatPeersRef.current = serverHeartbeatPeersRef.current.filter(hp => hp.identity !== participant.identity);
            if (!isStudentInWaitingLoungeRef.current && wasNotified) {
              playStudioConnectionChime('peer_leave');
              triggerPresenceToast(pName, pRole, 'leave');
            }
          }
          syncParticipantsState(room);
        });

        room.on(RoomEvent.ParticipantNameChanged, () => {
          if (isCancelled) return;
          syncParticipantsState(room);
        });

        room.on(RoomEvent.ParticipantMetadataChanged, () => {
          if (isCancelled) return;
          syncParticipantsState(room);
        });

        room.on(RoomEvent.ActiveSpeakersChanged, () => {
          if (isCancelled) return;
          syncParticipantsState(room);
        });

        room.on(RoomEvent.TrackMuted, (pub, participant) => {
          if (isCancelled) return;
          if (participant?.identity) {
            peerMuteOverridesRef.current[participant.identity.toLowerCase()] = true;
          }
          syncParticipantsState(room);
        });

        room.on(RoomEvent.TrackUnmuted, (pub, participant) => {
          if (isCancelled) return;
          if (participant?.identity) {
            peerMuteOverridesRef.current[participant.identity.toLowerCase()] = false;
          }
          syncParticipantsState(room);
        });

        room.on(RoomEvent.LocalTrackPublished, () => {
          if (isCancelled) return;
          syncParticipantsState(room);
        });

        room.on(RoomEvent.LocalTrackUnpublished, () => {
          if (isCancelled) return;
          syncParticipantsState(room);
        });

        room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
          if (isCancelled) return;
          setAudioPlaybackBlocked(!room.canPlaybackAudio);
        });

        room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          if (isCancelled) return;
          if (track.kind === Track.Kind.Audio && !isStudentInWaitingLoungeRef.current) {
            attachRemoteAudioTrack(track, room);
          }
          syncParticipantsState(room);
        });

        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          if (isCancelled) return;
          try {
            track.detach().forEach((el) => el.remove());
          } catch {}
          syncParticipantsState(room);
        });

        room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
          if (isCancelled) return;
          try {
            const str = new TextDecoder().decode(payload);
            const msgObj = JSON.parse(str);
            if (msgObj.type === 'CHAT') {
              if (isStudentInWaitingLoungeRef.current) return;
              const senderRole = msgObj.role || (participant ? resolveRemoteParticipantRole(participant) : 'Participant');
              let senderDisplay = msgObj.sender || participant?.name || 'Peer';
              if (senderRole === 'Tutor' && (userRole === 'student' || userRole === 'parent' || userRole === 'guest')) {
                const match = `${participant?.identity || ''} ${senderDisplay} ${roomName}`.match(/(\d+)/);
                senderDisplay = match ? `Tutor ${match[1]}` : 'Tutor';
              }
              setChatMessages(prev => [...prev, {
                id: `msg_${Date.now()}`,
                sender: senderDisplay,
                role: senderRole,
                text: msgObj.text,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }]);
              setUnreadChatCount(prev => prev + 1);
            } else if (msgObj.type === 'WAITING_ROOM_JOIN') {
              if (isTutor) {
                const wId = msgObj.waitingId || `wait_lk_${msgObj.identity || participant?.identity || Date.now()}`;
                const wName = msgObj.name || participant?.name || msgObj.identity || 'Student';
                const joinedAtStr = msgObj.joinedAt || new Date().toISOString();
                const exists = livekitWaitingListRef.current.some(
                  (w) => w.id === wId || w.guest_name.toLowerCase() === wName.toLowerCase()
                );
                if (!exists) {
                  livekitWaitingListRef.current = [
                    ...livekitWaitingListRef.current,
                    {
                      id: wId,
                      identity: msgObj.identity || participant?.identity,
                      room_slug: roomName,
                      guest_name: wName,
                      status: 'WAITING',
                      joined_at: joinedAtStr,
                      waiting_seconds: 1
                    } as any
                  ];
                  refreshCombinedWaitingQueue();
                }
              }
            } else if (msgObj.type === 'WAITING_ROOM_ADMITTED_SELF') {
              const wNameLower = (msgObj.name || '').toLowerCase();
              const wId = msgObj.waitingId;
              const pId = msgObj.identity || participant?.identity;
              livekitWaitingListRef.current = livekitWaitingListRef.current.filter(
                (w) => w.id !== wId && (w as any).identity !== pId && w.guest_name.toLowerCase() !== wNameLower
              );
              serverWaitingListRef.current = serverWaitingListRef.current.filter(
                (w) => w.id !== wId && (w as any).identity !== pId && w.guest_name.toLowerCase() !== wNameLower
              );
              if (isTutor) {
                refreshCombinedWaitingQueue();
              }
              syncParticipantsState(room);
            } else if (msgObj.type === 'WAITING_ROOM_ACTION') {
              if (isStudentInWaitingLoungeRef.current) {
                const localId = (room.localParticipant?.identity || tokenData.participantIdentity || '').toLowerCase();
                const localName = (participantName || '').toLowerCase();
                const targetWId = msgObj.waitingId;
                const targetIdLower = (msgObj.targetIdentity || '').toLowerCase();
                const targetNameLower = (msgObj.targetName || '').toLowerCase();
                const isForMe =
                  (targetWId && targetWId === studentWaitingId) ||
                  (targetIdLower && (targetIdLower === localId || targetIdLower === localName)) ||
                  (targetNameLower && (targetNameLower === localName || targetNameLower === localId));

                if (isForMe) {
                  if (msgObj.action === 'ADMIT') {
                    isAdmittedExplicitlyRef.current = true;
                    promoteStudentFromWaitingLoungeRef.current?.(room);
                  } else if (msgObj.action === 'REJECT') {
                    isCancelled = true;
                    setLoungeRejectedMessage('The tutor asked to reschedule or closed this session.');
                    try { room.disconnect(); } catch {}
                  }
                }
              }
            } else if (msgObj.type === 'PRESENCE_HELLO') {
              const peerId = msgObj.identity || participant?.identity;
              const peerRole = msgObj.role || (participant ? resolveRemoteParticipantRole(participant) : 'Student');
              let peerName = msgObj.name || participant?.name || peerId || 'Participant';
              if (peerRole === 'Tutor' && (userRole === 'student' || userRole === 'parent' || userRole === 'guest')) {
                const match = `${peerId || ''} ${peerName} ${roomName}`.match(/(\d+)/);
                peerName = match ? `Tutor ${match[1]}` : 'Tutor';
              }
              if (peerId) {
                peerCustomNamesRef.current[peerId] = { name: peerName, role: peerRole };
                if (!isStudentInWaitingLoungeRef.current && !notifiedPeersRef.current.has(peerId)) {
                  notifiedPeersRef.current.add(peerId);
                  playStudioConnectionChime('peer_join');
                  triggerPresenceToast(peerName, peerRole, 'join');
                }
              }
              syncParticipantsState(room);
            } else if (msgObj.type === 'HOST_MUTE_COMMAND') {
              const targetIdLower = (msgObj.targetIdentity || '').toLowerCase();
              const targetNameLower = (msgObj.targetName || '').toLowerCase();
              const shouldMute = Boolean(msgObj.muted);
              if (targetIdLower) peerMuteOverridesRef.current[targetIdLower] = shouldMute;
              if (targetNameLower) peerMuteOverridesRef.current[targetNameLower] = shouldMute;

              const localId = (room.localParticipant?.identity || tokenData.participantIdentity || '').toLowerCase();
              const localName = (participantName || '').toLowerCase();
              if (
                (targetIdLower && (targetIdLower === localId || targetIdLower === localName)) ||
                (targetNameLower && (targetNameLower === localName || targetNameLower === localId))
              ) {
                setIsAudioMuted(shouldMute);
                isAudioMutedRef.current = shouldMute;
                const pub = room.localParticipant?.getTrackPublication(Track.Source.Microphone);
                if (pub?.track) {
                  if (shouldMute) {
                    pub.track.mute().catch(() => {});
                  } else {
                    pub.track.unmute().catch(() => {});
                  }
                } else if (!shouldMute && room.localParticipant && !isStudentInWaitingLoungeRef.current) {
                  publishCleanMicrophoneTrack(room, selectedAudioInput || undefined, studioNoiseFilter, enableAutoGain).catch(() => {});
                }
                try {
                  const stateEcho = new TextEncoder().encode(
                    JSON.stringify({
                      type: 'PARTICIPANT_MUTE_STATE_CHANGED',
                      identity: room.localParticipant?.identity || tokenData.participantIdentity || participantName,
                      name: participantName,
                      muted: shouldMute
                    })
                  );
                  room.localParticipant?.publishData(stateEcho as any, { reliable: true }).catch(() => {});
                } catch {}
              }
              syncParticipantsState(room);
            } else if (msgObj.type === 'PARTICIPANT_MUTE_STATE_CHANGED') {
              const idLower = (msgObj.identity || '').toLowerCase();
              const nameLower = (msgObj.name || '').toLowerCase();
              const mutedState = Boolean(msgObj.muted);
              if (idLower) peerMuteOverridesRef.current[idLower] = mutedState;
              if (nameLower) peerMuteOverridesRef.current[nameLower] = mutedState;
              syncParticipantsState(room);
            } else if (msgObj.type === 'REMOVE_TUTOR') {
              // Admin removed the Tutor from the meeting -> immediately disconnect & exit Tutor
              if (isActualTutor) {
                const localId = (room.localParticipant.identity || '').toLowerCase();
                const localName = (participantName || '').toLowerCase();
                if (
                  msgObj.targetIdentities &&
                  Array.isArray(msgObj.targetIdentities) &&
                  msgObj.targetIdentities.length > 0 &&
                  !msgObj.targetIdentities.some((t: string) => {
                    const tl = (t || '').toLowerCase();
                    return tl === localId || tl === localName;
                  })
                ) {
                  return;
                }
                isCancelled = true;
                try { room.disconnect(); } catch {}
                onLeave();
              }
            } else if (msgObj.type === 'END_CLASS_FOR_ALL' || msgObj.type === 'FINISH_STUDENT_LESSON') {
              // If local student is in Waiting Lounge and Tutor finished the CURRENT student's lesson, auto-enter!
              if (isStudentInWaitingLoungeRef.current && msgObj.type === 'FINISH_STUDENT_LESSON') {
                setTimeout(() => {
                  if (!isCancelled && isStudentInWaitingLoungeRef.current) {
                    syncParticipantsState(room);
                  }
                }, 150);
                return;
              }
              // Tutor, Supervisor, or Admin ended class for everyone or finished this student's lesson -> immediately disconnect & exit
              if (!isTutor || (isActualTutor && msgObj.includeTutor)) {
                const localId = (room.localParticipant.identity || '').toLowerCase();
                const localName = (participantName || '').toLowerCase();
                if (
                  msgObj.type === 'FINISH_STUDENT_LESSON' &&
                  msgObj.targetIdentities &&
                  Array.isArray(msgObj.targetIdentities) &&
                  !msgObj.targetIdentities.some((t: string) => {
                    const tl = (t || '').toLowerCase();
                    return tl === localId || tl === localName;
                  })
                ) {
                  // Not targeted to us, ignore!
                  return;
                }
                isCancelled = true;
                try { room.disconnect(); } catch {}
                onLeave();
              }
            }
          } catch (e) {
            console.warn('Data channel parse notice:', e);
          }
        });

        if (!activeTokenData.token || activeTokenData.inWaitingRoom) {
          console.warn('[Classroom] No active token yet, or student in Waiting Lounge. Student remains in Waiting Lounge.');
          return;
        }

        await room.connect(activeTokenData.serverUrl, activeTokenData.token, {
          autoSubscribe: true,
        });

        // Start audio playback immediately upon connection (unless student is in Waiting Lounge)
        if (!isStudentInWaitingLoungeRef.current) {
          room.startAudio().catch(() => {
            if (!room.canPlaybackAudio) {
              setAudioPlaybackBlocked(true);
            }
          });
        }

        // Publish local microphone with Studio Voice Filter (unless hidden Admin/Supervisor observer or Waiting Lounge student)
        let isHiddenObserver = isAdminOrSupervisor;
        try {
          if (room.localParticipant.metadata) {
            const meta = JSON.parse(room.localParticipant.metadata);
            if (meta.hidden || meta.role === 'admin' || meta.role === 'supervisor') {
              isHiddenObserver = true;
            }
          }
        } catch {}

        if (!isHiddenObserver && !isStudentInWaitingLoungeRef.current) {
          await publishCleanMicrophoneTrack(room, selectedAudioInput || undefined, studioNoiseFilter, enableAutoGain);
        }

        syncParticipantsState(room);

        const handleHeartbeatResponse = (data: any) => {
          if (isCancelled || !data) return;
          if (
            data.pendingMuteCommand &&
            data.pendingMuteCommand.commandId &&
            data.pendingMuteCommand.commandId !== lastProcessedMuteCommandIdRef.current
          ) {
            lastProcessedMuteCommandIdRef.current = data.pendingMuteCommand.commandId;
            const shouldMute = Boolean(data.pendingMuteCommand.muted);
            setIsAudioMuted(shouldMute);
            isAudioMutedRef.current = shouldMute;
            const pub = room.localParticipant?.getTrackPublication(Track.Source.Microphone);
            if (pub?.track) {
              if (shouldMute) {
                pub.track.mute().catch(() => {});
              } else {
                pub.track.unmute().catch(() => {});
              }
            } else if (!shouldMute && room.localParticipant && !isStudentInWaitingLoungeRef.current) {
              publishCleanMicrophoneTrack(room, selectedAudioInput || undefined, studioNoiseFilter, enableAutoGain).catch(() => {});
            }
          }
          if (
            (!isTutor && (data.roomAction === 'END_CLASS_FOR_ALL' || data.roomAction === 'FINISH_STUDENT_LESSON')) ||
            (isActualTutor && (data.roomAction === 'REMOVE_TUTOR' || data.roomAction === 'ADMIN_END_CLASS_FOR_ALL'))
          ) {
            if (isStudentInWaitingLoungeRef.current && data.roomAction === 'FINISH_STUDENT_LESSON') {
              return;
            }
            isCancelled = true;
            try { room.disconnect(); } catch {}
            onLeave();
            return;
          }
          if (isTutor && data.waitingList) {
            updateTutorWaitingQueue(data.waitingList);
          }
          if (Array.isArray(data.activeParticipants)) {
            const localId = room.localParticipant?.identity || tokenData.participantIdentity || participantName;
            const remoteHbPeers = data.activeParticipants.filter(
              (ap: any) => ap.identity !== localId && ap.name !== participantName && ap.role !== 'admin' && ap.role !== 'supervisor'
            );

            // Detect new joins & sync mute state via heartbeat
            remoteHbPeers.forEach((ap: any) => {
              if (typeof ap.isMuted === 'boolean') {
                peerMuteOverridesRef.current[ap.identity.toLowerCase()] = ap.isMuted;
                if (ap.name) peerMuteOverridesRef.current[ap.name.toLowerCase()] = ap.isMuted;
              }
              const pRole = ap.role?.toLowerCase() === 'tutor' ? 'Tutor' : 'Student';
              let safeApName = ap.name || ap.identity;
              if (pRole === 'Tutor' && (userRole === 'student' || userRole === 'parent' || userRole === 'guest')) {
                const match = `${ap.identity || ''} ${safeApName} ${roomName}`.match(/(\d+)/);
                safeApName = match ? `Tutor ${match[1]}` : 'Tutor';
              }
              peerCustomNamesRef.current[ap.identity] = { name: safeApName, role: pRole };
              if (!isStudentInWaitingLoungeRef.current && !notifiedPeersRef.current.has(ap.identity)) {
                notifiedPeersRef.current.add(ap.identity);
                playStudioConnectionChime('peer_join');
                triggerPresenceToast(safeApName, pRole, 'join');
              }
            });

            // Detect departures via heartbeat if a previously heartbeat-tracked peer left
            const currentHbIds = new Set(remoteHbPeers.map((ap: any) => ap.identity));
            serverHeartbeatPeersRef.current.forEach((prevPeer) => {
              const stillInLiveKit = room.remoteParticipants.has(prevPeer.identity);
              if (!currentHbIds.has(prevPeer.identity) && !stillInLiveKit && notifiedPeersRef.current.has(prevPeer.identity)) {
                notifiedPeersRef.current.delete(prevPeer.identity);
                const pRole = prevPeer.role?.toLowerCase() === 'tutor' ? 'Tutor' : 'Student';
                let safePrevName = prevPeer.name || prevPeer.identity;
                if (pRole === 'Tutor' && (userRole === 'student' || userRole === 'parent' || userRole === 'guest')) {
                  const match = `${prevPeer.identity || ''} ${safePrevName} ${roomName}`.match(/(\d+)/);
                  safePrevName = match ? `Tutor ${match[1]}` : 'Tutor';
                }
                if (!isStudentInWaitingLoungeRef.current) {
                  playStudioConnectionChime('peer_leave');
                  triggerPresenceToast(safePrevName, pRole, 'leave');
                }
              }
            });

            serverHeartbeatPeersRef.current = remoteHbPeers;
            syncParticipantsState(room);
          }
        };

        // Send initial presence heartbeat only if not in Waiting Lounge
        const currentIdentity = tokenData.participantIdentity || participantName;
        if (!isStudentInWaitingLoungeRef.current) {
          fetch('/api/livekit/rooms/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomName,
              identity: currentIdentity,
              name: participantName,
              role: userRole,
              isMuted: isAudioMutedRef.current
            })
          })
            .then(r => {
              const ct = r.headers.get('content-type') || '';
              return r.ok && ct.includes('application/json') ? r.json() : null;
            })
            .then(handleHeartbeatResponse)
            .catch(() => {});
        }

        // Browser Tab Close / Page Navigation Beacon Handler
        const sendLeaveBeacon = () => {
          try {
            const payload = JSON.stringify({
              roomName,
              identity: currentIdentity
            });
            if (navigator.sendBeacon) {
              const blob = new Blob([payload], { type: 'application/json' });
              navigator.sendBeacon('/api/livekit/rooms/leave', blob);
            } else {
              fetch('/api/livekit/rooms/leave', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true
              }).catch(() => {});
            }
          } catch {}
        };

        window.addEventListener('beforeunload', sendLeaveBeacon);
        window.addEventListener('pagehide', sendLeaveBeacon);

      } catch (err: any) {
        if (!isCancelled) {
          console.warn('[LiveKit Connect Notice]:', err);
          setConnectionStatus(ConnectionState.Connected);
        }
      }
    }

    initClassroom();

    // Continuous Realtime Heartbeat: every 4s during active classes (skipped while student is in Waiting Lounge)
    lastHeartbeatSentAtRef.current = Date.now();
    const heartbeatInterval = setInterval(() => {
      if (isStudentInWaitingLoungeRef.current) {
        if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
          syncParticipantsState(roomRef.current);
        }
        return;
      }
      const now = Date.now();
      const targetIntervalMs =
        isIdleStandbyRef.current && waitingQueueRef.current.length === 0 ? 12000 : 4000;
      if (now - lastHeartbeatSentAtRef.current < targetIntervalMs - 300) {
        return;
      }
      lastHeartbeatSentAtRef.current = now;

      fetch('/api/livekit/rooms/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          identity: tokenData.participantIdentity || participantName,
          name: participantName,
          role: userRole,
          isMuted: isAudioMutedRef.current
        })
      })
        .then(r => {
          const ct = r.headers.get('content-type') || '';
          return r.ok && ct.includes('application/json') ? r.json() : null;
        })
        .then(data => {
          if (isCancelled || !data) return;
          if (
            data.pendingMuteCommand &&
            data.pendingMuteCommand.commandId &&
            data.pendingMuteCommand.commandId !== lastProcessedMuteCommandIdRef.current
          ) {
            lastProcessedMuteCommandIdRef.current = data.pendingMuteCommand.commandId;
            const shouldMute = Boolean(data.pendingMuteCommand.muted);
            setIsAudioMuted(shouldMute);
            isAudioMutedRef.current = shouldMute;
            const room = roomRef.current;
            if (room && room.localParticipant) {
              const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
              if (pub?.track) {
                if (shouldMute) {
                  pub.track.mute().catch(() => {});
                } else {
                  pub.track.unmute().catch(() => {});
                }
              } else if (!shouldMute && !isStudentInWaitingLoungeRef.current) {
                publishCleanMicrophoneTrack(room, selectedAudioInput || undefined, studioNoiseFilter, enableAutoGain).catch(() => {});
              }
              syncParticipantsState(room);
            }
          }
          if (
            (!isTutor && (data.roomAction === 'END_CLASS_FOR_ALL' || data.roomAction === 'FINISH_STUDENT_LESSON')) ||
            (isActualTutor && (data.roomAction === 'REMOVE_TUTOR' || data.roomAction === 'ADMIN_END_CLASS_FOR_ALL'))
          ) {
            isCancelled = true;
            if (roomRef.current) {
              try { roomRef.current.disconnect(); } catch {}
            }
            onLeave();
            return;
          }
          if (isTutor && data.waitingList) {
            updateTutorWaitingQueue(data.waitingList);
          }
          if (Array.isArray(data.activeParticipants) && roomRef.current) {
            const room = roomRef.current;
            const localId = room.localParticipant?.identity || tokenData.participantIdentity || participantName;
            const remoteHbPeers = data.activeParticipants.filter(
              (ap: any) => ap.identity !== localId && ap.name !== participantName && ap.role !== 'admin' && ap.role !== 'supervisor'
            );

            remoteHbPeers.forEach((ap: any) => {
              if (typeof ap.isMuted === 'boolean') {
                peerMuteOverridesRef.current[ap.identity.toLowerCase()] = ap.isMuted;
                if (ap.name) peerMuteOverridesRef.current[ap.name.toLowerCase()] = ap.isMuted;
              }
              const pRole = ap.role?.toLowerCase() === 'tutor' ? 'Tutor' : 'Student';
              let safeApName = ap.name || ap.identity;
              if (pRole === 'Tutor' && (userRole === 'student' || userRole === 'parent' || userRole === 'guest')) {
                const match = `${ap.identity || ''} ${safeApName} ${roomName}`.match(/(\d+)/);
                safeApName = match ? `Tutor ${match[1]}` : 'Tutor';
              }
              peerCustomNamesRef.current[ap.identity] = { name: safeApName, role: pRole };
              if (!isStudentInWaitingLoungeRef.current && !notifiedPeersRef.current.has(ap.identity)) {
                notifiedPeersRef.current.add(ap.identity);
                playStudioConnectionChime('peer_join');
                triggerPresenceToast(safeApName, pRole, 'join');
              }
            });

            const currentHbIds = new Set(remoteHbPeers.map((ap: any) => ap.identity));
            serverHeartbeatPeersRef.current.forEach((prevPeer) => {
              const stillInLiveKit = room.remoteParticipants.has(prevPeer.identity);
              if (!currentHbIds.has(prevPeer.identity) && !stillInLiveKit && notifiedPeersRef.current.has(prevPeer.identity)) {
                notifiedPeersRef.current.delete(prevPeer.identity);
                const pRole = prevPeer.role?.toLowerCase() === 'tutor' ? 'Tutor' : 'Student';
                let safePrevName = prevPeer.name || prevPeer.identity;
                if (pRole === 'Tutor' && (userRole === 'student' || userRole === 'parent' || userRole === 'guest')) {
                  const match = `${prevPeer.identity || ''} ${safePrevName} ${roomName}`.match(/(\d+)/);
                  safePrevName = match ? `Tutor ${match[1]}` : 'Tutor';
                }
                if (!isStudentInWaitingLoungeRef.current) {
                  playStudioConnectionChime('peer_leave');
                  triggerPresenceToast(safePrevName, pRole, 'leave');
                }
              }
            });

            serverHeartbeatPeersRef.current = remoteHbPeers;
            syncParticipantsState(room);
          }
        })
        .catch(() => {});
    }, 3500);

    return () => {
      isCancelled = true;
      clearInterval(heartbeatInterval);
      if (filterAudioCtxRef.current && filterAudioCtxRef.current.state !== 'closed') {
        filterAudioCtxRef.current.close().catch(() => {});
        filterAudioCtxRef.current = null;
      }
      if (rawMicStreamRef.current) {
        rawMicStreamRef.current.getTracks().forEach(t => t.stop());
        rawMicStreamRef.current = null;
      }

      // Send immediate leave beacon on unmount
      try {
        const payload = JSON.stringify({
          roomName,
          identity: tokenData.participantIdentity || participantName
        });
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon('/api/livekit/rooms/leave', blob);
        } else {
          fetch('/api/livekit/rooms/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
          }).catch(() => {});
        }
      } catch {}

      if (roomRef.current) {
        try { roomRef.current.disconnect(); } catch {}
      }
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        try { pipWindowRef.current.close(); } catch {}
      }
    };
  }, [activeTokenData.token, activeTokenData.serverUrl, tokenData.isMockSession, roomName]);

  // Open Always-On-Top Floating Mini Control Bar (Works in top-level windows AND inside iframes!)
  const openFloatingControlBar = useCallback(async () => {
    try {
      // 1. Try Document Picture-in-Picture if top-level window
      const docPip = (window as any).documentPictureInPicture;
      const isTopLevel = typeof window !== 'undefined' && window.self === window.top;

      if (isTopLevel && docPip && typeof docPip.requestWindow === 'function') {
        if (pipWindowRef.current && !pipWindowRef.current.closed) {
          pipWindowRef.current.focus();
          return;
        }

        const pipWin: Window = await docPip.requestWindow({
          width: 520,
          height: isChatOpen ? 380 : (isTutor && waitingQueue.length > 0 ? 132 : 98),
        });

        pipWin.document.title = 'Islamic Tuition Classroom';
        pipWin.document.body.style.margin = '0';
        pipWin.document.body.style.padding = '0';
        pipWin.document.body.style.backgroundColor = '#050806';
        pipWin.document.body.style.color = '#FFFFFF';
        pipWin.document.body.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        pipWin.document.body.style.overflow = 'hidden';

        Array.from(document.styleSheets).forEach((styleSheet) => {
          try {
            if (styleSheet.cssRules) {
              const newStyleEl = pipWin.document.createElement('style');
              Array.from(styleSheet.cssRules).forEach((rule) => {
                newStyleEl.appendChild(pipWin.document.createTextNode(rule.cssText));
              });
              pipWin.document.head.appendChild(newStyleEl);
            } else if (styleSheet.href) {
              const newLinkEl = pipWin.document.createElement('link');
              newLinkEl.rel = 'stylesheet';
              newLinkEl.href = styleSheet.href;
              pipWin.document.head.appendChild(newLinkEl);
            }
          } catch {}
        });

        pipWin.addEventListener('pagehide', () => {
          setPipWindow(null);
        });

        setPipWindow(pipWin);
        return;
      }
    } catch (e) {
      console.warn('Doc PiP notice, falling back to Video Canvas PiP:', e);
    }

    // 2. Fallback for IFrames & Browsers without Document PiP: Canvas Video Picture-in-Picture
    try {
      if (pipFallbackVideoRef.current && document.pictureInPictureEnabled) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await pipFallbackVideoRef.current.requestPictureInPicture();
        }
      }
    } catch (err) {
      console.warn('Fallback Video PiP notice:', err);
    }
  }, [isChatOpen]);

  // Resize Floating Mini Control Bar automatically when Chat or Next Student Queue changes
  useEffect(() => {
    if (!pipWindow || pipWindow.closed) return;
    try {
      pipWindow.resizeTo(520, isChatOpen ? 380 : (isTutor && waitingQueue.length > 0 ? 132 : 98));
    } catch {}
  }, [isChatOpen, pipWindow, isTutor, waitingQueue.length]);

  // Continuous Canvas Drawing for Floating Video Picture-in-Picture Fallback (Works inside IFrames & On Top of PDFs)
  useEffect(() => {
    const canvas = pipCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const renderPipFrame = () => {
      // Dark emerald studio canvas background
      ctx.fillStyle = '#070D0A';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#223D2E';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);

      // Header: Zoom-Style Live Participant Presence Pill (Tutor + Student Name) & Timer
      const studentPeers = filteredParticipants.filter(p => p.role === 'Student' || p.role === 'Guest');
      const tutorPeer = filteredParticipants.find(p => p.role === 'Tutor');
      const tName = tutorPeer?.name || (isTutor ? participantName : 'Tutor');
      const sNames = studentPeers.map(s => s.name).join(', ');
      const bothPresent = Boolean(tutorPeer && studentPeers.length > 0);

      ctx.fillStyle = bothPresent ? '#34D399' : '#FBBF24';
      ctx.font = 'bold 12px system-ui, sans-serif';
      const headerPresenceText = bothPresent
        ? `🟢 ${tName} + ${sNames}`.slice(0, 44)
        : isTutor
          ? `⏳ ${tName} · Waiting for Student...`
          : tutorPeer
            ? `🟢 Live with ${tName}`
            : '⏳ Waiting for Tutor...';
      ctx.fillText(headerPresenceText, 12, 22);

      ctx.fillStyle = '#9CA3AF';
      ctx.font = '11px monospace';
      ctx.fillText(`Timer: ${formatChronometerTime(elapsedSeconds)}`, 360, 22);

      // Divider
      ctx.strokeStyle = '#1E3A2B';
      ctx.beginPath();
      ctx.moveTo(12, 32);
      ctx.lineTo(468, 32);
      ctx.stroke();

      // Row 1: Mic Status Pill
      if (isAudioMuted) {
        ctx.fillStyle = '#991B1B';
        ctx.beginPath();
        ctx.roundRect(12, 42, 130, 26, 6);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillText('🔇 MIC: MUTED', 22, 59);
      } else {
        ctx.fillStyle = '#065F46';
        ctx.beginPath();
        ctx.roundRect(12, 42, 130, 26, 6);
        ctx.fill();
        ctx.fillStyle = '#34D399';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillText('🎙️ MIC: LIVE HD', 22, 59);
      }

      // Row 1: Screen Share Pill
      if (isScreenSharing) {
        ctx.fillStyle = '#1E40AF';
        ctx.beginPath();
        ctx.roundRect(152, 42, 150, 26, 6);
        ctx.fill();
        ctx.fillStyle = '#93C5FD';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillText('🖥️ SCREEN: LIVE', 162, 59);
      } else {
        ctx.fillStyle = '#1F2937';
        ctx.beginPath();
        ctx.roundRect(152, 42, 150, 26, 6);
        ctx.fill();
        ctx.fillStyle = '#9CA3AF';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillText('🖥️ SCREEN: READY', 162, 59);
      }

      // Row 1: In Class Student Name / Presence Pill
      const peerLabel = isTutor
        ? (studentPeers.length > 0 ? `🟢 ${sNames.slice(0, 16)}` : '🟡 Waiting Student')
        : (tutorPeer ? `🟢 ${tutorPeer.name.slice(0, 16)}` : '⏳ Waiting Tutor');

      ctx.fillStyle = bothPresent ? '#064E3B' : '#374151';
      ctx.beginPath();
      ctx.roundRect(312, 42, 156, 26, 6);
      ctx.fill();
      ctx.fillStyle = bothPresent ? '#A7F3D0' : '#FDE68A';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillText(peerLabel, 319, 59);

      // Row 2: Active Join/Leave Toast Alert OR Next Student Waiting Badge OR Chat Ticker
      if (presenceToast) {
        ctx.fillStyle = presenceToast.type === 'join' ? '#065F46' : '#78350F';
        ctx.beginPath();
        ctx.roundRect(12, 78, 456, 32, 6);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px system-ui, sans-serif';
        const toastText = presenceToast.type === 'join'
          ? `🟢 ${presenceToast.name} (${presenceToast.role}) joined the classroom!`
          : `🟠 ${presenceToast.name} (${presenceToast.role}) left the classroom`;
        ctx.fillText(toastText.slice(0, 56), 20, 98);
      } else if (isTutor && waitingQueue.length > 0) {
        const nextWaiter = waitingQueue[0];
        ctx.fillStyle = '#78350F';
        ctx.beginPath();
        ctx.roundRect(12, 78, 456, 32, 6);
        ctx.fill();
        ctx.fillStyle = '#FDE68A';
        ctx.font = 'bold 11px system-ui, sans-serif';
        const waitText = `⏳ Next Student Ready: ${nextWaiter.guest_name} (${formatWaitingDuration(nextWaiter)})`;
        ctx.fillText(waitText.slice(0, 56), 20, 98);
      } else {
        ctx.fillStyle = '#111C15';
        ctx.beginPath();
        ctx.roundRect(12, 78, 456, 32, 6);
        ctx.fill();

        const lastMsg = chatMessages[chatMessages.length - 1];
        if (lastMsg) {
          ctx.fillStyle = '#34D399';
          ctx.font = 'bold 10px system-ui, sans-serif';
          ctx.fillText(`💬 ${lastMsg.sender}:`, 20, 93);
          ctx.fillStyle = '#E5E7EB';
          ctx.font = '10px system-ui, sans-serif';
          ctx.fillText(lastMsg.text.slice(0, 52) + (lastMsg.text.length > 52 ? '...' : ''), 20, 105);
        } else {
          ctx.fillStyle = '#6B7280';
          ctx.font = '10px system-ui, sans-serif';
          ctx.fillText('💬 Classroom Chat: No messages yet. Click Chat to send message.', 20, 98);
        }
      }

      // Footer
      ctx.fillStyle = '#4B5563';
      ctx.font = '9px system-ui, sans-serif';
      ctx.fillText('Islamic Tuition Floating Control Bar · Works on PDFs & All Screen Tabs', 12, 126);

      animId = requestAnimationFrame(renderPipFrame);
    };

    renderPipFrame();

    // Stream Canvas to Fallback Video Element
    try {
      if (pipFallbackVideoRef.current && !pipFallbackVideoRef.current.srcObject) {
        const stream = canvas.captureStream(15);
        pipFallbackVideoRef.current.srcObject = stream;
        (pipFallbackVideoRef.current as any).autoPictureInPicture = true;
        pipFallbackVideoRef.current.play().catch(() => {});
      }
    } catch (e) {}

    // Register MediaSession Handlers for PiP Window Hardware/OS Controls
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        const ms = navigator.mediaSession as any;
        if (ms.setActionHandler) {
          ms.setActionHandler('togglemicrophone', () => handleToggleAudio());
          ms.setActionHandler('togglecamera', () => isStudent ? handleToggleCamera() : handleToggleScreenShare());
          ms.setActionHandler('hangup', () => setShowLeaveConfirmModal(true));
          ms.setActionHandler('play', () => { if (isAudioMutedRef.current) handleToggleAudio(); });
          ms.setActionHandler('pause', () => { if (!isAudioMutedRef.current) handleToggleAudio(); });
        }
      } catch (e) {}
    }

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [elapsedSeconds, isAudioMuted, isScreenSharing, activeVisibleParticipantsCount, chatMessages, isStudent, filteredParticipants, isTutor, participantName, presenceToast, waitingQueue]);

  // Switch active microphone device on the fly without disconnecting room (Noise Filter permanently active)
  const handleSelectAudioInput = async (deviceId: string) => {
    setSelectedAudioInput(deviceId);
    if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
      await publishCleanMicrophoneTrack(roomRef.current, deviceId, true, false);
    }
  };

  // Switch active camera device on the fly without disconnecting room
  const handleSelectVideoInput = async (deviceId: string) => {
    setSelectedVideoInput(deviceId);
    if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
      try {
        await roomRef.current.switchActiveDevice('videoinput', deviceId);
      } catch (e) {
        console.warn('Video input switch notice:', e);
      }
    }
  };

  // Control 1: Mute / Unmute Audio
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
          if (!isAdminOrSupervisor && roomRef.current.localParticipant) {
            try {
              const stateEcho = new TextEncoder().encode(
                JSON.stringify({
                  type: 'PARTICIPANT_MUTE_STATE_CHANGED',
                  identity: roomRef.current.localParticipant.identity || tokenData.participantIdentity || participantName,
                  name: participantName,
                  muted: isAudioMutedRef.current
                })
              );
              roomRef.current.localParticipant.publishData(stateEcho as any, { reliable: true }).catch(() => {});
            } catch {}
          }
          syncParticipantsState(roomRef.current);
          return;
        } else {
          setIsAudioMuted(false);
          isAudioMutedRef.current = false;
          await publishCleanMicrophoneTrack(roomRef.current, selectedAudioInput || undefined, studioNoiseFilter, enableAutoGain);
          return;
        }
      }
      setIsAudioMuted(prev => {
        const next = !prev;
        isAudioMutedRef.current = next;
        return next;
      });
    } catch (e) {
      setIsAudioMuted(prev => {
        const next = !prev;
        isAudioMutedRef.current = next;
        return next;
      });
    }
  };

  // Control 2: Share Screen (Exclude Entire Screen & Classroom Tab to prevent Hall of Mirrors and eliminate Chrome's bottom popup bar)
  const handleToggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
          await roomRef.current.localParticipant.setScreenShareEnabled(false);
        }
        if (localScreenStreamRef.current) {
          localScreenStreamRef.current.getTracks().forEach(t => t.stop());
          localScreenStreamRef.current = null;
        }
        if (screenShareVideoRef.current) {
          screenShareVideoRef.current.srcObject = null;
        }
        setIsScreenSharing(false);
        setIsLocalBrowserSharingScreen(false);

        try {
          if (typeof BroadcastChannel !== 'undefined') {
            const bc = new BroadcastChannel('islamic_tuition_single_instance');
            bc.postMessage({ type: 'SCREEN_SHARE_ACTIVE', roomName, isSharing: false });
            bc.close();
          }
        } catch {}
      } else {
        // Broadcast local screen share active state
        setIsLocalBrowserSharingScreen(true);
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            const bc = new BroadcastChannel('islamic_tuition_single_instance');
            bc.postMessage({ type: 'SCREEN_SHARE_ACTIVE', roomName, isSharing: true });
            bc.close();
          }
        } catch {}

        const displayConstraints: any = {
          audio: false,
          selfBrowserSurface: 'exclude', // Excludes the classroom tab itself
          surfaceSwitching: 'include',
          systemAudio: 'exclude',
          monitorTypeSurfaces: 'exclude', // Excludes "Entire Screen" option to prevent Hall of Mirrors and eliminate Chrome's bottom popup bar!
          video: {
            displaySurface: 'browser', // Defaults Chrome picker to "Chrome Tab" (zero floating bottom desktop box)
            width: 1920,
            height: 1080,
            frameRate: 10,
          }
        };

        if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
          try {
            await roomRef.current.localParticipant.setScreenShareEnabled(
              true,
              displayConstraints,
              {
                simulcast: false,
                degradationPreference: 'maintain-resolution',
                screenShareEncoding: {
                  maxBitrate: 2_500_000,
                  maxFramerate: 15,
                  priority: 'high',
                },
              }
            );
            setIsScreenSharing(true);
          } catch (err: any) {
            // Fallback if browser rejected monitorTypeSurfaces
            delete displayConstraints.monitorTypeSurfaces;
            await roomRef.current.localParticipant.setScreenShareEnabled(
              true,
              displayConstraints as any,
              {
                simulcast: false,
                degradationPreference: 'maintain-resolution',
                screenShareEncoding: {
                  maxBitrate: 2_500_000,
                  maxFramerate: 15,
                  priority: 'high',
                },
              }
            );
            setIsScreenSharing(true);
          }
        } else if (navigator.mediaDevices?.getDisplayMedia) {
          const stream = await navigator.mediaDevices.getDisplayMedia(displayConstraints);
          localScreenStreamRef.current = stream;
          stream.getVideoTracks().forEach(vt => {
            vt.onended = () => {
              localScreenStreamRef.current = null;
              setIsScreenSharing(false);
              setIsLocalBrowserSharingScreen(false);
            };
          });
          setIsScreenSharing(true);
        }
      }
      if (roomRef.current) syncParticipantsState(roomRef.current);
    } catch (e) {
      console.warn('Screen share toggle notice:', e);
      setIsScreenSharing(false);
      setIsLocalBrowserSharingScreen(false);
    }
  };

  // Student Camera Toggle (Allowed for Students at compact 480p in sidebar, Strictly Blocked for Tutors)
  const executeToggleCamera = async (enable: boolean) => {
    if (!isStudent) return;

    try {
      if (!enable) {
        if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
          await roomRef.current.localParticipant.setCameraEnabled(false);
        }
        if (studentCameraVideoRef.current) {
          studentCameraVideoRef.current.srcObject = null;
        }
        setIsCameraActive(false);
      } else {
        setIsSidebarOpen(true); // Ensure sidebar is visible so compact camera view appears in sidebar
        if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
          await roomRef.current.localParticipant.setCameraEnabled(
            true,
            {
              deviceId: selectedVideoInput || undefined,
              resolution: {
                width: 640,
                height: 480,
                frameRate: 15,
              },
            },
            {
              simulcast: false,
              videoEncoding: {
                maxBitrate: 180_000,
                maxFramerate: 15,
                priority: 'low',
              },
            }
          );
          setIsCameraActive(true);
        } else if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640, max: 640 }, height: { ideal: 480, max: 480 }, frameRate: { ideal: 15, max: 15 } }
          });
          setIsCameraActive(true);
          setTimeout(() => {
            if (studentCameraVideoRef.current) {
              studentCameraVideoRef.current.srcObject = stream;
            }
          }, 50);
        }
      }
      if (roomRef.current) syncParticipantsState(roomRef.current);
    } catch (e) {
      console.warn('Camera toggle notice:', e);
      setIsCameraActive(false);
    }
  };

  const handleToggleCamera = () => {
    if (!isStudent) return;
    if (isCameraActive) {
      executeToggleCamera(false);
    } else {
      setShowCameraConfirmModal(true);
    }
  };

  // Toggle Fullscreen on the Quran Screen-Share Stage
  const handleToggleStageFullscreen = () => {
    if (!stageContainerRef.current) return;
    if (!document.fullscreenElement) {
      stageContainerRef.current.requestFullscreen().then(() => setIsStageFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsStageFullscreen(false)).catch(() => {});
    }
  };

  // 5-Second Voice Recorder & Playback Loopback Test (With Studio Noise Filter applied!)
  const handleStart5SecMicTest = async () => {
    try {
      setMicTestError(null);
      setMicTestState('recording');
      setTestCountdown(5);
      setRecordedAudioUrl(null);
      testAudioChunksRef.current = [];

      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedAudioInput ? { exact: selectedAudioInput } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: enableAutoGain,
        }
      });

      const filterRes = studioNoiseFilter ? createStudioVoiceFilterTrack(rawStream) : null;
      const streamToRecord = filterRes ? new MediaStream([filterRes.filteredTrack]) : rawStream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(streamToRecord);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateTestWaveform = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        setTestAudioLevel(Math.min(100, Math.round((sum / dataArray.length / 128) * 100)));
        testAnimFrameRef.current = requestAnimationFrame(updateTestWaveform);
      };
      updateTestWaveform();

      const mediaRecorder = new MediaRecorder(streamToRecord);
      testMediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          testAudioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (testAnimFrameRef.current) cancelAnimationFrame(testAnimFrameRef.current);
        rawStream.getTracks().forEach(t => t.stop());
        if (filterRes?.audioCtx && filterRes.audioCtx.state !== 'closed') {
          filterRes.audioCtx.close().catch(() => {});
        }
        if (audioCtx.state !== 'closed') {
          audioCtx.close().catch(() => {});
        }

        const audioBlob = new Blob(testAudioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(audioUrl);

        // Automatically play back the 5-second voice sample immediately so the user doesn't have to click Play
        const autoAudio = new Audio(audioUrl);
        testAudioPlayerRef.current = autoAudio;
        if (selectedAudioOutputRef.current && (autoAudio as any).setSinkId) {
          (autoAudio as any).setSinkId(selectedAudioOutputRef.current).catch(() => {});
        }
        setMicTestState('playing');
        autoAudio.play().catch(() => {
          setMicTestState('recorded');
        });
        autoAudio.onended = () => {
          setMicTestState('recorded');
        };
      };

      mediaRecorder.start();

      let currentSec = 5;
      const timer = setInterval(() => {
        currentSec -= 1;
        setTestCountdown(currentSec);
        if (currentSec <= 0) {
          clearInterval(timer);
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        }
      }, 1000);

    } catch (e: any) {
      setMicTestError(`Could not access microphone: ${e?.message || e}`);
      setMicTestState('idle');
    }
  };

  const handlePlayBackTestVoice = () => {
    if (!recordedAudioUrl) return;
    const audio = new Audio(recordedAudioUrl);
    testAudioPlayerRef.current = audio;
    if (selectedAudioOutput && (audio as any).setSinkId) {
      (audio as any).setSinkId(selectedAudioOutput).catch(() => {});
    }
    setMicTestState('playing');
    audio.play();
    audio.onended = () => {
      setMicTestState('recorded');
    };
  };

  const handleResetMicTest = () => {
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }
    setRecordedAudioUrl(null);
    setMicTestError(null);
    setMicTestState('idle');
    setTestCountdown(5);
  };

  // Send Live Room Chat Message with Safety & Contact-Sharing Protection
  const handleSendChatMessage = async () => {
    const rawText = chatInputText.trim();
    if (!rawText || isSendingChat) return;

    setChatWarningMessage(null);

    // 1. Client-Side Instant Rule Validation
    const clientCheck = checkMessageSafety(rawText, participantName || 'user', chatSafetySettings);
    if (!clientCheck.isAllowed) {
      setChatWarningMessage(
        clientCheck.userFacingError ||
        "For everyone's privacy and safety, personal contact information can't be shared in classroom chat. Please keep communication within the academy platform."
      );
      setTimeout(() => setChatWarningMessage(null), 8000);
      return;
    }

    setIsSendingChat(true);

    // 2. Server-Side Validation Endpoint
    try {
      const res = await fetch('/api/chat/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: rawText,
          senderId: participantName || 'user',
          senderName: participantName,
          senderRole: isTutor ? 'tutor' : 'student',
          roomSlug: roomName || 'live_room',
          clientSettings: chatSafetySettings
        })
      });

      if (res.ok) {
        const serverCheck = await res.json();
        if (!serverCheck.isAllowed) {
          setIsSendingChat(false);
          setChatWarningMessage(
            serverCheck.userFacingError ||
            "For everyone's privacy and safety, personal contact information can't be shared in classroom chat. Please keep communication within the academy platform."
          );
          setTimeout(() => setChatWarningMessage(null), 8000);
          return;
        }
      }
    } catch (e) {
      console.warn('[Classroom Chat Validation Warning]:', e);
    } finally {
      setIsSendingChat(false);
    }

    const newMsg: ChatMessageItem = {
      id: `msg_${Date.now()}`,
      sender: participantName,
      role: isTutor ? 'Tutor' : 'Student',
      text: rawText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, newMsg]);
    setMobileDrawerTab('chat');
    setIsChatOpen(true);
    setIsSidebarOpen(true);

    if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
      const payload = new TextEncoder().encode(JSON.stringify({
        type: 'CHAT',
        sender: participantName,
        role: isTutor ? 'Tutor' : 'Student',
        text: rawText
      }));
      roomRef.current.localParticipant.publishData(payload, { reliable: true });
    }

    setChatInputText('');
  };

  // Toggle Chat open / closed when clicking Chat button at bottom
  const handleToggleChatInSidebar = () => {
    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobileViewport) {
      if (isSidebarOpen && mobileDrawerTab === 'chat') {
        setIsSidebarOpen(false);
        setIsChatOpen(false);
      } else {
        setMobileDrawerTab('chat');
        setIsChatOpen(true);
        setIsSidebarOpen(true);
        setUnreadChatCount(0);
        setTimeout(() => {
          chatInputRef.current?.focus();
        }, 100);
      }
      return;
    }

    setIsChatOpen(prev => {
      const next = !prev;
      if (next) {
        setIsSidebarOpen(true);
        setUnreadChatCount(0);
        setTimeout(() => {
          chatInputRef.current?.focus();
        }, 100);
      }
      return next;
    });
  };

  // Toggle Participants Drawer (Bottom Sheet on Mobile, Right Sidebar on Desktop)
  const handleToggleParticipantsDrawer = () => {
    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobileViewport) {
      if (isSidebarOpen && mobileDrawerTab === 'participants') {
        setIsSidebarOpen(false);
      } else {
        setMobileDrawerTab('participants');
        setIsSidebarOpen(true);
      }
      return;
    }
    setIsSidebarOpen(prev => !prev);
  };

  // Tutor Admit / Keep in Waiting / Reject Actions (Synchronized via both LiveKit DataChannel & Server API)
  const handleWaitingRoomAction = async (waitingId: string, action: 'ADMIT' | 'REJECT' | 'KEEP_WAITING') => {
    try {
      const targetWaiter = waitingQueue.find(w => w.id === waitingId);
      const targetIdentity = (targetWaiter as any)?.identity;
      const targetName = targetWaiter?.guest_name;

      // Broadcast instant LiveKit DataChannel signal to the waiting student
      if (roomRef.current && roomRef.current.state === ConnectionState.Connected && roomRef.current.localParticipant) {
        try {
          const payload = new TextEncoder().encode(
            JSON.stringify({
              type: 'WAITING_ROOM_ACTION',
              waitingId,
              targetIdentity,
              targetName,
              action
            })
          );
          await roomRef.current.localParticipant.publishData(payload as any, { reliable: true }).catch(() => {});
        } catch {}
      }

      if (action === 'KEEP_WAITING') {
        setAcknowledgedWaitingIds(prev => new Set([...prev, waitingId]));
        await fetch('/api/livekit/waiting-room/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ waitingId, action: 'KEEP_WAITING' })
        }).catch(() => {});
        return;
      }

      if (action === 'REJECT' && targetIdentity) {
        executeLiveKitCloudRoomAdminAction({
          roomName,
          action: 'REMOVE_PARTICIPANT',
          targetIdentities: [targetIdentity]
        }).catch(() => {});
      }

      await fetch('/api/livekit/waiting-room/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waitingId, action })
      }).catch(() => {});

      serverWaitingListRef.current = serverWaitingListRef.current.filter(
        w => w.id !== waitingId && (!targetName || w.guest_name.toLowerCase() !== targetName.toLowerCase())
      );
      livekitWaitingListRef.current = livekitWaitingListRef.current.filter(
        w => w.id !== waitingId && (!targetName || w.guest_name.toLowerCase() !== targetName.toLowerCase())
      );
      refreshCombinedWaitingQueue();

      setAcknowledgedWaitingIds(prev => {
        const next = new Set(prev);
        next.delete(waitingId);
        return next;
      });
      if (waitingQueue.length <= 1) {
        setShowWaitingRoomModal(false);
      }
      if (action === 'ADMIT' && targetName) {
        triggerPresenceToast(`Admitting ${targetName} into classroom...`, 'Waiting Room', 'join');
      }
    } catch (e) {
      console.warn('Waiting room action error:', e);
    }
  };

  // Tutor Option 1: Finish Current Student's Class (Disconnects current student, stays in room & auto-admits #1 waiting student)
  const handleFinishCurrentStudentLesson = async () => {
    setShowLeaveConfirmModal(false);
    setPendingHostConfirm(null);
    const studentIdsToFinish = activeStudentParticipants.map(s => s.id);
    try {
      if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
        const payload = new TextEncoder().encode(JSON.stringify({
          type: 'FINISH_STUDENT_LESSON',
          sender: participantName
        }));
        await roomRef.current.localParticipant.publishData(payload as any, { reliable: true }).catch(() => {});

        // Also send instant ADMIT signal to #1 waiting student if anyone is in the waiting queue!
        if (waitingQueue.length > 0) {
          const nextWaiter = waitingQueue[0];
          const admitPayload = new TextEncoder().encode(JSON.stringify({
            type: 'WAITING_ROOM_ACTION',
            waitingId: nextWaiter.id,
            targetIdentity: (nextWaiter as any).identity,
            targetName: nextWaiter.guest_name,
            action: 'ADMIT'
          }));
          await roomRef.current.localParticipant.publishData(admitPayload as any, { reliable: true }).catch(() => {});
        }
      }
      if (studentIdsToFinish.length > 0) {
        executeLiveKitCloudRoomAdminAction({
          roomName,
          action: 'REMOVE_PARTICIPANT',
          targetIdentities: studentIdsToFinish
        }).catch(() => {});
      }
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
        updateTutorWaitingQueue(data.waitingList);
      }
    } catch {}

    notifiedPeersRef.current.clear();
    peerCustomNamesRef.current = {};
    serverHeartbeatPeersRef.current = [];
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
  };

  // Disconnect a specific selected student, keep tutor and other students in the room
  const handleRemoveSelectedStudent = async (studentIdentity: string, studentName: string) => {
    setShowLeaveConfirmModal(false);
    setPendingHostConfirm(null);
    const remainingStudents = activeStudentParticipants.filter(s => s.id !== studentIdentity);
    try {
      if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
        const payload = new TextEncoder().encode(JSON.stringify({
          type: 'FINISH_STUDENT_LESSON',
          sender: participantName,
          targetIdentities: [studentIdentity, studentName]
        }));
        await roomRef.current.localParticipant.publishData(payload as any, { reliable: true }).catch(() => {});

        // If removing this student leaves 0 active students in the room and someone is waiting, auto-admit #1 waiting student immediately!
        if (remainingStudents.length === 0 && waitingQueue.length > 0) {
          const nextWaiter = waitingQueue[0];
          const admitPayload = new TextEncoder().encode(JSON.stringify({
            type: 'WAITING_ROOM_ACTION',
            waitingId: nextWaiter.id,
            targetIdentity: (nextWaiter as any).identity,
            targetName: nextWaiter.guest_name,
            action: 'ADMIT'
          }));
          await roomRef.current.localParticipant.publishData(admitPayload as any, { reliable: true }).catch(() => {});
        }
      }
      executeLiveKitCloudRoomAdminAction({
        roomName,
        action: 'REMOVE_PARTICIPANT',
        targetIdentities: [studentIdentity]
      }).catch(() => {});
      const res = await fetch('/api/livekit/rooms/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          action: 'FINISH_STUDENT_LESSON',
          targetIdentities: [studentIdentity]
        })
      });
      const data = await res.json().catch(() => null);
      if (data?.waitingList) {
        updateTutorWaitingQueue(data.waitingList);
      }
    } catch {}

    notifiedPeersRef.current.delete(studentIdentity);
    delete peerCustomNamesRef.current[studentIdentity];
    serverHeartbeatPeersRef.current = serverHeartbeatPeersRef.current.filter(hp => hp.identity !== studentIdentity);

    // Reset timer only if no students are left
    if (remainingStudents.length === 0) {
      setElapsedSeconds(0);
      setIsTimerRunning(false);
      setChatMessages([]);
      setUnreadChatCount(0);
    }

    if (roomRef.current) {
      syncParticipantsState(roomRef.current);
    }
    triggerPresenceToast(
      `Finished lesson for ${studentName}`,
      'Classroom',
      'leave'
    );
  };

  // Host Action (Tutor, Supervisor, or Admin): Remotely Mute or Unmute a Specific Participant in Real-Time
  const handleToggleRemoteParticipantMute = useCallback(async (
    targetIdentity: string,
    targetName: string,
    currentMuted: boolean
  ) => {
    const nextMuted = !currentMuted;
    const idKey = (targetIdentity || '').toLowerCase();
    const nameKey = (targetName || '').toLowerCase();
    if (idKey) peerMuteOverridesRef.current[idKey] = nextMuted;
    if (nameKey) peerMuteOverridesRef.current[nameKey] = nextMuted;

    // 1. Immediate optimistic UI update across local view
    setFilteredParticipants(prev =>
      prev.map(p =>
        p.id.toLowerCase() === idKey || p.name.toLowerCase() === nameKey
          ? { ...p, isMuted: nextMuted }
          : p
      )
    );

    // 2. Broadcast instant WebRTC DataChannel signal to all connected clients in the room
    const room = roomRef.current;
    if (room && room.state === ConnectionState.Connected && room.localParticipant) {
      try {
        const payload = new TextEncoder().encode(
          JSON.stringify({
            type: 'HOST_MUTE_COMMAND',
            targetIdentity,
            targetName,
            muted: nextMuted
          })
        );
        await room.localParticipant.publishData(payload as any, { reliable: true }).catch(() => {});
      } catch {}
    }

    // 3. Enforce via LiveKit Cloud Twirp API + Server Control Endpoint
    executeLiveKitCloudRoomAdminAction({
      roomName,
      action: 'MUTE_PARTICIPANT',
      targetIdentities: [targetIdentity],
      muted: nextMuted
    }).catch(() => {});

    try {
      await fetch('/api/livekit/rooms/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          action: nextMuted ? 'MUTE_PARTICIPANT' : 'UNMUTE_PARTICIPANT',
          targetIdentity,
          targetName,
          muted: nextMuted
        })
      });
    } catch {}
  }, [roomName]);

  // Admin Super-Host Action: Remove Tutor from Meeting (while keeping classroom open or under Admin control)
  const handleRemoveTutorFromMeeting = async (tutorIdentity: string, tutorName: string) => {
    if (!isAdmin) return;
    setShowLeaveConfirmModal(false);
    setPendingHostConfirm(null);
    try {
      if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
        const payload = new TextEncoder().encode(JSON.stringify({
          type: 'REMOVE_TUTOR',
          sender: participantName,
          targetIdentities: [tutorIdentity, tutorName]
        }));
        await roomRef.current.localParticipant.publishData(payload as any, { reliable: true }).catch(() => {});
      }
      executeLiveKitCloudRoomAdminAction({
        roomName,
        action: 'REMOVE_PARTICIPANT',
        targetIdentities: [tutorIdentity]
      }).catch(() => {});
      const res = await fetch('/api/livekit/rooms/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          action: 'REMOVE_TUTOR',
          targetIdentities: [tutorIdentity]
        })
      });
      const data = await res.json().catch(() => null);
      if (data?.waitingList) {
        updateTutorWaitingQueue(data.waitingList);
      }
    } catch {}

    notifiedPeersRef.current.delete(tutorIdentity);
    delete peerCustomNamesRef.current[tutorIdentity];
    serverHeartbeatPeersRef.current = serverHeartbeatPeersRef.current.filter(hp => hp.identity !== tutorIdentity);

    if (roomRef.current) {
      syncParticipantsState(roomRef.current);
    }
    triggerPresenceToast(
      `Removed ${tutorName} (Tutor) from the meeting`,
      'Admin Super-Host',
      'leave'
    );
  };

  // Tutor / Supervisor / Admin Option: End Class for Everyone (Disconnects all students, plus Tutor if triggered by Admin/Supervisor, & closes classroom)
  const handleEndClassForEveryone = async () => {
    setShowLeaveConfirmModal(false);
    setPendingHostConfirm(null);
    try {
      if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
        const payload = new TextEncoder().encode(JSON.stringify({
          type: 'END_CLASS_FOR_ALL',
          sender: participantName,
          includeTutor: isAdminOrSupervisor
        }));
        await roomRef.current.localParticipant.publishData(payload as any, { reliable: true }).catch(() => {});
      }
      executeLiveKitCloudRoomAdminAction({
        roomName,
        action: isAdminOrSupervisor ? 'END_ROOM' : 'REMOVE_PARTICIPANT',
        targetIdentities: isAdminOrSupervisor ? undefined : activeStudentParticipants.map(s => s.id)
      }).catch(() => {});
      await fetch('/api/livekit/rooms/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          action: 'END_CLASS_FOR_ALL',
          includeTutor: isAdminOrSupervisor
        })
      }).catch(() => {});
    } catch {}

    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      try { pipWindowRef.current.close(); } catch {}
    }
    if (roomRef.current) {
      try { roomRef.current.disconnect(); } catch {}
    }
    onLeave();
  };

  // Zoom-Style Confirmation Triggers (Prevents accidental ending of class or removal of participants)
  const requestRemoveStudent = (studentIdentity: string, studentName: string) => {
    setPendingHostConfirm({
      type: 'REMOVE_STUDENT',
      targetId: studentIdentity,
      targetName: studentName
    });
  };

  const requestRemoveTutor = (tutorIdentity: string, tutorName: string) => {
    setPendingHostConfirm({
      type: 'REMOVE_TUTOR',
      targetId: tutorIdentity,
      targetName: tutorName
    });
  };

  const requestEndClassForEveryone = () => {
    setPendingHostConfirm({
      type: 'END_FOR_ALL'
    });
  };

  const requestFinishCurrentLesson = () => {
    setPendingHostConfirm({
      type: 'FINISH_LESSON'
    });
  };

  // Render shared screen preview inside the meeting room whenever remote OR local screen share is active!
  const isViewingRemoteScreenShare = Boolean(activeScreenShareParticipant || isScreenSharing);
  const hasActiveStudentCamera = Boolean(isCameraActive || activeCameraParticipant);

  // AUTO-MAXIMIZE QURAN MUSHAF ON SCREEN SHARE START:
  // As soon as the Tutor starts sharing their screen, automatically close any open Chat/Participants drawer
  // so mobile/student screens immediately show the full-width Quran Mushaf without obstruction.
  useEffect(() => {
    if (isViewingRemoteScreenShare) {
      setIsSidebarOpen(false);
      setIsChatOpen(false);
      setScreenZoomLevel(1);
      setScreenPan({ x: 0, y: 0 });
    }
  }, [isViewingRemoteScreenShare]);

  // Quran Screen-Share Zoom & Pan Handlers (For Mobile & Student Viewers)
  const handleSetScreenZoom = (nextZoom: number) => {
    const clamped = Math.max(1, Math.min(3, Number(nextZoom.toFixed(2))));
    setScreenZoomLevel(clamped);
    if (clamped <= 1) {
      setScreenPan({ x: 0, y: 0 });
    }
  };

  const handleCycleScreenZoom = () => {
    if (screenZoomLevel < 1.4) {
      handleSetScreenZoom(1.5);
    } else if (screenZoomLevel < 1.9) {
      handleSetScreenZoom(2);
    } else {
      handleSetScreenZoom(1);
    }
  };

  const handleScreenTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDistRef.current = Math.hypot(dx, dy);
      pinchStartZoomRef.current = screenZoomLevel;
      isPanningScreenRef.current = false;
    } else if (e.touches.length === 1 && screenZoomLevel > 1) {
      isPanningScreenRef.current = true;
      panStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        panX: screenPan.x,
        panY: screenPan.y
      };
    }
  };

  const handleScreenTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchStartDistRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scaleRatio = dist / pinchStartDistRef.current;
      handleSetScreenZoom(pinchStartZoomRef.current * scaleRatio);
    } else if (e.touches.length === 1 && isPanningScreenRef.current && screenZoomLevel > 1) {
      const dx = e.touches[0].clientX - panStartRef.current.x;
      const dy = e.touches[0].clientY - panStartRef.current.y;
      const maxOffset = (screenZoomLevel - 1) * 180;
      setScreenPan({
        x: Math.max(-maxOffset, Math.min(maxOffset, panStartRef.current.panX + dx)),
        y: Math.max(-maxOffset, Math.min(maxOffset, panStartRef.current.panY + dy))
      });
    }
  };

  const handleScreenTouchEnd = () => {
    pinchStartDistRef.current = null;
    isPanningScreenRef.current = false;
  };

  // Zoom-Style Live Participant Presence Resolution (Tutor + Student Names)
  const activeTutorParticipant = filteredParticipants.find(p => p.role === 'Tutor');
  const activeStudentParticipants = filteredParticipants.filter(p => p.role === 'Student' || p.role === 'Guest');
  const connectedStudentsNames = activeStudentParticipants.map(s => s.name).join(', ');
  const fallbackRoomTutorLabel = roomName.match(/(\d+)/) ? `Tutor ${roomName.match(/(\d+)/)![1]}` : 'Tutor';
  const tutorDisplayName = activeTutorParticipant?.name || (isActualTutor ? participantName : fallbackRoomTutorLabel);
  const isBothTutorAndStudentPresent = Boolean(activeTutorParticipant && activeStudentParticipants.length > 0);

  // Zero-Load Idle Standby Mode: Active when Tutor is in the room with 0 students and not sharing screen
  const isIdleStandby = Boolean(
    isTutor &&
      connectionStatus === ConnectionState.Connected &&
      activeStudentParticipants.length === 0 &&
      !isScreenSharing
  );

  useEffect(() => {
    isIdleStandbyRef.current = isIdleStandby;
  }, [isIdleStandby]);

  // Zero-Load Idle Standby Media Optimization:
  // Pauses upstream WebRTC audio frames (0 kbps to LiveKit) while 0 students are in the room,
  // and wakes up the microphone in 0ms the instant a student connects!
  useEffect(() => {
    const room = roomRef.current;
    if (!room || !isTutor || room.state !== ConnectionState.Connected) return;
    if (micTestState !== 'idle') return;
    try {
      const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      const mediaTrack = micPub?.track?.mediaStreamTrack;
      if (mediaTrack) {
        if (isIdleStandby) {
          mediaTrack.enabled = false;
        } else {
          mediaTrack.enabled = !isAudioMutedRef.current;
        }
      }
    } catch {}
  }, [isIdleStandby, isAudioMuted, connectionStatus, isTutor, micTestState]);

  // Hidden Canvas & Video Elements for Video Picture-in-Picture Fallback (Works inside IFrames & On Top of PDFs)
  const renderFallbackPipElements = (
    <div className="fixed -bottom-96 -right-96 w-1 h-1 opacity-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <canvas ref={pipCanvasRef} width={480} height={140} />
      <video ref={pipFallbackVideoRef} muted autoPlay playsInline />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const url = URL.createObjectURL(file);
            setEmbeddedPdfUrl(url);
            setEmbeddedPdfPage(1);
          }
        }}
        className="hidden"
      />
    </div>
  );

  // If Student is in the Waiting Lounge (either Waiting for Tutor to Start Class OR Next Student in Line), render the distraction-free Lounge!
  if (isStudentInWaitingLounge) {
    const isQueuedBehindStudent = studentWaitingReason === 'NEXT_STUDENT_QUEUE';
    return (
      <div
        className={`relative flex flex-col items-center justify-center h-full min-h-[480px] sm:min-h-[600px] rounded-2xl overflow-hidden border p-4 sm:p-8 text-center shadow-[0_25px_70px_rgba(0,0,0,0.85)] select-none ${
          isLight
            ? 'bg-[#F6F4EE] text-[#14231B] border-[#D5CFC2]'
            : 'bg-[#050806] text-[#F8FAFC] border-[#1F3A2C]'
        } ${className}`}
      >
        <div
          className={`max-w-lg w-full rounded-3xl border p-6 sm:p-8 space-y-5 shadow-2xl ${
            isLight ? 'bg-white border-amber-300' : 'bg-[#0D1812] border-amber-500/40'
          }`}
        >
          {/* Queue Position / Waiting Lounge Pill */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-400 text-xs font-extrabold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>
              {isQueuedBehindStudent
                ? `Next Student Lounge · #${studentQueuePosition} in Line`
                : 'Classroom Waiting Lounge'}
            </span>
          </div>

          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>

          {loungeRejectedMessage ? (
            <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold space-y-2">
              <p>{loungeRejectedMessage}</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <h2 className={`text-lg sm:text-xl font-extrabold tracking-tight ${isLight ? 'text-[#14231B]' : 'text-white'}`}>
                  {isQueuedBehindStudent
                    ? `Ustadh ${loungeTutorName} is Currently in a Lesson`
                    : `Waiting for Ustadh ${loungeTutorName} to Start the Class`}
                </h2>
                <p className={`text-xs sm:text-sm leading-relaxed font-medium ${isLight ? 'text-[#4A5B51]' : 'text-emerald-100/90'}`}>
                  {isQueuedBehindStudent ? (
                    <>
                      Ustadh <span className="font-extrabold text-emerald-400">{loungeTutorName}</span> is currently wrapping up the previous student&apos;s lesson. You are{' '}
                      <span className="font-extrabold text-amber-400">#{studentQueuePosition} in line</span> — your class will start automatically as soon as the current lesson finishes!
                    </>
                  ) : (
                    <>
                      Ustadh <span className="font-extrabold text-emerald-400">{loungeTutorName}</span> has not opened the classroom yet. Stay on this screen — your class will start automatically with a chime as soon as your tutor joins!
                    </>
                  )}
                </p>
              </div>

              {/* Live Remaining Time Countdown Box (Only shown when waiting behind an active lesson) */}
              {isQueuedBehindStudent && (
                <div
                  className={`rounded-2xl border p-4 space-y-1.5 ${
                    isLight ? 'bg-amber-50/70 border-amber-200' : 'bg-black/45 border-amber-500/30'
                  }`}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center justify-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Estimated Time Remaining in Current Lesson</span>
                  </div>
                  {loungeRemainingSecs > 0 ? (
                    <div className="text-2xl sm:text-3xl font-mono font-extrabold text-emerald-400 tracking-wider">
                      {formatChronometerTime(loungeRemainingSecs)}
                    </div>
                  ) : (
                    <div className="text-xs sm:text-sm font-bold text-emerald-400 animate-pulse py-1">
                      ✨ Wrapping up final verses — starting your class any moment now...
                    </div>
                  )}
                  <p className={`text-[11px] ${isLight ? 'text-[#5A6B61]' : 'text-[#8BA295]'}`}>
                    Stay on this screen — you will enter the classroom automatically with a chime.
                  </p>
                </div>
              )}

              {/* Pre-Class Microphone & Speaker Test Studio inside Waiting Lounge */}
              <div
                className={`rounded-2xl border p-3.5 text-left space-y-2.5 ${
                  isLight ? 'bg-[#FAF9F5] border-[#DFDBD0]' : 'bg-black/30 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center space-x-1.5 text-emerald-400">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Test Your Audio Before Class Starts</span>
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">● Ready</span>
                </div>

                {micTestError && (
                  <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[11px]">
                    {micTestError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* 1. Test Speakers / Headphones */}
                  <button
                    type="button"
                    onClick={() => playStudioConnectionChime('peer_join')}
                    className="py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-xl font-bold text-xs cursor-pointer transition-colors flex items-center justify-center space-x-1.5"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Test Speakers</span>
                  </button>

                  {/* 2. Test Microphone (5-Second Voice Check) */}
                  {micTestState === 'idle' && (
                    <button
                      type="button"
                      onClick={handleStart5SecMicTest}
                      className="min-h-[44px] py-2 px-3 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-xl font-bold text-xs cursor-pointer transition-colors flex items-center justify-center space-x-1.5 shadow-xs"
                    >
                      <Mic className="w-3.5 h-3.5 shrink-0" />
                      <span>Test Microphone (5s)</span>
                    </button>
                  )}

                  {micTestState === 'recording' && (
                    <div className="min-h-[44px] py-1.5 px-3 bg-rose-500/15 border border-rose-500/30 rounded-xl flex flex-col justify-center">
                      <div className="flex items-center justify-center space-x-1.5 text-rose-400 text-[11px] font-bold">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                        <span>Speak now ({testCountdown}s)...</span>
                      </div>
                      <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-emerald-400 transition-all duration-75"
                          style={{ width: `${Math.max(6, testAudioLevel)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {(micTestState === 'recorded' || micTestState === 'playing') && (
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={handlePlayBackTestVoice}
                        disabled={micTestState === 'playing'}
                        className="min-h-[44px] flex-1 py-2 px-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                      >
                        <Play className="w-3.5 h-3.5 shrink-0" />
                        <span>{micTestState === 'playing' ? 'Playing...' : 'Hear My Voice'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleResetMicTest}
                        className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer flex items-center justify-center"
                        title="Test microphone again"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                handleResetMicTest();
                if (studentWaitingId) {
                  fetch('/api/livekit/waiting-room/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ waitingId: studentWaitingId, action: 'CANCEL' })
                  }).catch(() => {});
                }
                onLeave();
              }}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-bold cursor-pointer transition-colors inline-flex items-center justify-center"
            >
              Leave Waiting Lounge
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={stageContainerRef}
      className={`relative flex flex-col h-full min-h-[480px] sm:min-h-[600px] rounded-2xl overflow-hidden border shadow-[0_25px_70px_rgba(0,0,0,0.85)] transition-colors duration-200 break-words ${
        isLight
          ? 'bg-[#F6F4EE] text-[#14231B] border-[#D5CFC2]'
          : 'bg-[#050806] text-[#F8FAFC] border-[#1F3A2C]'
      } ${className}`}
    >
      {renderFallbackPipElements}
      {/* Dedicated Multi-Track Audio Container for Remote Participants */}
      <div ref={remoteAudioContainerRef} className="hidden" />

      {/* Smooth Studio Connecting Overlay when establishing encrypted WebRTC session */}
      {connectionStatus === ConnectionState.Connecting && (
        <div className="absolute inset-0 z-40 bg-[#050806]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
          <div className="relative w-16 h-16 flex items-center justify-center mb-4">
            <div className="absolute inset-0 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 animate-ping" />
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-emerald-900/40 border border-emerald-400/50 flex items-center justify-center text-emerald-300 shadow-lg">
              <BookOpen className="w-7 h-7" />
            </div>
          </div>
          <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
            Connecting to Islamic Tuition Classroom...
          </h3>
          <p className="text-xs text-emerald-300/90 mt-1 font-medium">
            Preparing your audio and lesson board...
          </p>
        </div>
      )}

      {/* Browser Autoplay Audio Unlocker Banner if needed */}
      {audioPlaybackBlocked && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex flex-wrap items-center justify-between gap-2 z-30 shrink-0">
          <span className="flex items-center space-x-1.5">
            <Volume2 className="w-4 h-4 shrink-0" />
            <span>Your browser paused classroom speaker audio. Click to enable live voice playback:</span>
          </span>
          <button
            type="button"
            onClick={() => {
              roomRef.current?.startAudio().then(() => setAudioPlaybackBlocked(false)).catch(() => setAudioPlaybackBlocked(false));
            }}
            className="min-h-[44px] px-4 py-2 bg-slate-950 text-white rounded-xl text-xs font-bold cursor-pointer inline-flex items-center justify-center"
          >
            Enable Classroom Audio
          </button>
        </div>
      )}

      {/* ZOOM-STYLE FLOATING JOIN / LEAVE TOAST BANNER (Shows for 6 seconds when Student or Tutor joins/leaves) */}
      {presenceToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 max-w-md w-[92%] sm:w-auto pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-200">
          <div
            className={`px-4 py-2 rounded-xl border shadow-2xl flex items-center justify-between gap-3 text-xs font-bold backdrop-blur-md ${
              presenceToast.type === 'join'
                ? 'bg-emerald-950/95 border-emerald-400/60 text-emerald-100 shadow-[0_8px_30px_rgba(16,185,129,0.3)]'
                : 'bg-amber-950/95 border-amber-400/60 text-amber-100 shadow-[0_8px_30px_rgba(245,158,11,0.25)]'
            }`}
          >
            <div className="flex items-center space-x-2 min-w-0">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  presenceToast.type === 'join' ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                }`}
              />
              <span className="break-words">
                {presenceToast.type === 'join'
                  ? `🟢 ${presenceToast.name} (${presenceToast.role}) joined the classroom`
                  : `🟠 ${presenceToast.name} (${presenceToast.role}) left the classroom`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPresenceToast(null)}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center text-white/70 hover:text-white cursor-pointer shrink-0"
              title="Dismiss notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ULTRA-SLIM TOP HEADER BAR (Maximizes vertical space for Quran Screen Share) */}
      <header
        className={`px-3 py-2 border-b flex flex-wrap items-center justify-between gap-2 z-20 shrink-0 ${
          isLight
            ? 'bg-white border-[#DFDBD0] text-[#14231B]'
            : 'bg-[#0B130E] border-[#223D2E] text-white'
        }`}
      >
        {/* Left: Simple & Clean Islamic Tuition Classroom Brand + Live Participant Pill */}
        <div className="flex items-center space-x-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
              isLight
                ? 'bg-[#E8F5EE] border-[#B8DFC8] text-[#1E5C3D]'
                : 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300 shadow-xs'
            }`}
          >
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h2 className="text-xs sm:text-sm font-extrabold tracking-tight break-words">
                Islamic Tuition Classroom
              </h2>
              {/* Zoom-Style Live Connected Participants Pill in Header (Clickable to open In Class panel) */}
              <button
                type="button"
                onClick={() => {
                  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
                  if (isMobileViewport) {
                    setMobileDrawerTab('participants');
                    setIsChatOpen(false);
                    setIsSidebarOpen(prev => !prev);
                  } else {
                    setIsSidebarOpen(prev => !prev);
                  }
                }}
                className={`min-h-[36px] inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold truncate max-w-[280px] sm:max-w-[420px] cursor-pointer transition-all ${
                  isBothTutorAndStudentPresent
                    ? isLight
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs'
                      : 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                    : isLight
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-300'
                }`}
                title={
                  isBothTutorAndStudentPresent
                    ? `Live in Class: ${tutorDisplayName} + ${connectedStudentsNames} (Click to view participants)`
                    : isTutor
                      ? `${participantName} — Waiting for Student to join (Click to view participants)`
                      : `${participantName} — Waiting for Tutor to join (Click to view participants)`
                }
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isBothTutorAndStudentPresent ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'
                  }`}
                />
                {isTutor && activeStudentParticipants.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/25 text-emerald-300 text-[9px] font-black shrink-0 border border-emerald-400/30 uppercase tracking-tight">
                    {activeStudentParticipants.length} In Class
                  </span>
                )}
                <span className="truncate">
                  {isBothTutorAndStudentPresent
                    ? `${tutorDisplayName} + ${connectedStudentsNames}`
                    : isActualTutor
                      ? `${participantName} · Waiting for Student`
                      : activeTutorParticipant
                        ? isAdminOrSupervisor
                          ? `${tutorDisplayName} · Waiting for Student`
                          : `${tutorDisplayName} + ${participantName}`
                        : isAdminOrSupervisor
                          ? activeStudentParticipants.length > 0
                            ? `${connectedStudentsNames} · Waiting for ${tutorDisplayName}`
                            : `Room Idle · Waiting for ${tutorDisplayName} & Student`
                          : `${participantName} · Waiting for Tutor...`}
                </span>
              </button>

              {/* Tutor Waiting Room Header Pill Badge */}
              {isTutor && waitingQueue.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSidebarOpen(true);
                    setMobileDrawerTab('participants');
                  }}
                  className="min-h-[36px] inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/50 shadow-[0_0_10px_rgba(245,158,11,0.25)] animate-pulse cursor-pointer transition-all"
                  title="Students in Waiting Room! Click to view and admit"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span className="truncate max-w-[200px] sm:max-w-[280px]">
                    ⏳ {waitingQueue[0].guest_name} waiting ({formatWaitingDuration(waitingQueue[0])})
                    {waitingQueue.length > 1 ? ` +${waitingQueue.length - 1}` : ''}
                  </span>
                </button>
              )}
            </div>
            <p className={`text-[10px] font-mono break-words ${isLight ? 'text-[#4A5B51]' : 'text-[#B2C9BC]'}`}>
              Room: {roomName} · {userRole.toUpperCase()}
            </p>
          </div>
        </div>

        {/* Right: Timer, Light/Dark Toggle, Settings Button & Sidebar Toggle */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* Recording Indicator */}
          {isEgressRecordingActive && settings?.recordingEnabled && (
            <div className="min-h-[44px] flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[11px] font-bold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>REC</span>
            </div>
          )}

          {/* Chronometer */}
          <div
            className={`min-h-[44px] flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-mono font-bold ${
              isLight
                ? 'bg-[#FAF9F5] border-[#D5D0C6] text-[#14231B]'
                : 'bg-[#121F17] border-[#274635] text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>{formatChronometerTime(elapsedSeconds)}</span>
          </div>

          {/* Light / Dark Mode Toggle */}
          <button
            type="button"
            onClick={toggleThemeMode}
            className={`min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1 cursor-pointer transition-colors ${
              isLight
                ? 'bg-[#FAF9F5] hover:bg-gray-100 border-[#D5D0C6] text-[#14231B]'
                : 'bg-[#121F17] hover:bg-[#1A2D22] border-[#274635] text-amber-300'
            }`}
            title={isLight ? 'Switch Classroom to Dark Mode' : 'Switch Classroom to Light Mode'}
          >
            {isLight ? (
              <>
                <Moon className="w-4 h-4 text-slate-700" />
                <span className="hidden sm:inline">Dark</span>
              </>
            ) : (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Light</span>
              </>
            )}
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => setShowDeviceSettingsModal(true)}
            className={`min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 cursor-pointer transition-colors ${
              isLight
                ? 'bg-[#FAF9F5] hover:bg-emerald-50 border-[#D5D0C6] text-[#1E5C3D]'
                : 'bg-[#121F17] hover:bg-[#1A2D22] border-[#274635] text-emerald-300'
            }`}
            title="Audio, Microphone & Speaker Settings"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Toggle Compact Right Sidebar (Desktop) / Bottom Drawer (Mobile) */}
          <button
            type="button"
            onClick={() => {
              const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
              if (isMobileViewport) {
                if (isSidebarOpen) {
                  setIsSidebarOpen(false);
                  setIsChatOpen(false);
                } else {
                  setMobileDrawerTab('participants');
                  setIsSidebarOpen(true);
                }
              } else {
                setIsSidebarOpen(prev => !prev);
              }
            }}
            className={`min-h-[44px] min-w-[44px] p-2 rounded-xl border flex items-center justify-center cursor-pointer transition-colors ${
              isLight
                ? 'bg-[#FAF9F5] hover:bg-gray-100 border-[#D5D0C6] text-[#14231B]'
                : 'bg-[#121F17] hover:bg-[#1A2D22] border-[#274635] text-white'
            }`}
            title={isSidebarOpen ? 'Hide Panel (Maximize Quran Screen)' : 'Show Participants & Chat Panel'}
          >
            {isSidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* SLEEK STEALTH OBSERVATION NOTICE FOR ADMIN & SUPERVISOR */}
      {isAdminOrSupervisor && (
        <div
          className={`px-3 py-1.5 border-b flex items-center justify-between gap-2 z-20 shrink-0 text-xs font-semibold ${
            isAdmin
              ? isLight
                ? 'bg-purple-100 border-purple-300 text-purple-950'
                : 'bg-purple-950/80 border-purple-500/40 text-purple-200'
              : isLight
                ? 'bg-blue-100 border-blue-300 text-blue-950'
                : 'bg-blue-950/80 border-blue-500/40 text-blue-200'
          }`}
        >
          <div className="flex items-center space-x-2 truncate">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shrink-0" />
            <span className="truncate">
              {isAdmin ? '🕵️ Stealth Super-Admin Mode' : '🕵️ Stealth Supervisor Mode'} — Observing class silently. Access controls in the Participants list.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (pipWindowRef.current && !pipWindowRef.current.closed) {
                try { pipWindowRef.current.close(); } catch {}
              }
              if (roomRef.current) {
                try { roomRef.current.disconnect(); } catch {}
              }
              onLeave();
            }}
            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-extrabold shrink-0 transition-colors cursor-pointer shadow-2xs"
            title="Exit stealth observation immediately without disturbing the class"
          >
            Leave Silently
          </button>
        </div>
      )}

      {/* MULTIPLE STUDENTS IN CLASS NOTICE FOR TUTOR */}
      {isTutor && activeStudentParticipants.length >= 2 && (
        <div
          className={`px-3 py-1.5 border-b flex flex-wrap items-center justify-between gap-2 z-20 shrink-0 animate-in slide-in-from-top duration-200 ${
            isLight
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100'
          }`}
        >
          <div className="flex items-center space-x-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-xs font-extrabold truncate">
              📢 Multiple Students Joined: <span className="underline decoration-emerald-400/60 font-black">{connectedStudentsNames}</span> ({activeStudentParticipants.length} students currently in classroom)
            </span>
          </div>
          <div className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-extrabold uppercase border border-emerald-400/35">
            Active Group
          </div>
        </div>
      )}

      {/* TUTOR TOP WAITING ROOM BADGE (Student Name, Waiting Duration, Since Time, Admit Now & Keep in Waiting) */}
      {isTutor && waitingQueue.length > 0 && (() => {
        const firstWaiter = waitingQueue[0];
        const isAcknowledged = acknowledgedWaitingIds.has(firstWaiter.id);
        const waiterDurationStr = formatWaitingDuration(firstWaiter);
        const waiterSinceStr = formatJoinedSinceTime(firstWaiter.joined_at);

        return (
          <div
            className={`px-3 py-1.5 border-b flex flex-wrap items-center justify-between gap-2 z-20 shrink-0 transition-all duration-200 ${
              isLight
                ? isAcknowledged
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-amber-100 border-amber-300 text-amber-950 shadow-2xs'
                : isAcknowledged
                  ? 'bg-amber-950/70 border-amber-600/35 text-amber-200'
                  : 'bg-amber-950/95 border-amber-500/60 text-amber-100 shadow-[0_2px_12px_rgba(245,158,11,0.2)]'
            }`}
          >
            <div className="flex items-center space-x-2 min-w-0">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isAcknowledged ? 'bg-amber-400' : 'bg-amber-400 animate-ping'}`} />
              <span className="text-xs font-bold truncate">
                ⏳ Student <span className="font-extrabold underline decoration-amber-400/80">{firstWaiter.guest_name}</span> is waiting {waiterDurationStr}
                {waiterSinceStr && (
                  <span className={`text-[11px] font-normal ml-1 ${isLight ? 'text-amber-800' : 'text-amber-300/80'}`}>
                    (since {waiterSinceStr})
                  </span>
                )}
                {waitingQueue.length > 1 && (
                  <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-amber-400/25 text-[10px] font-mono font-bold border border-amber-400/40">
                    +{waitingQueue.length - 1} more
                  </span>
                )}
              </span>
              <span className={`hidden md:inline text-[11px] font-medium ${isLight ? 'text-amber-800' : 'text-amber-300/80'}`}>
                {isAcknowledged ? '— Kept in waiting room' : '— Ready in waiting lounge'}
              </span>
            </div>

            <div className="flex items-center space-x-1.5 shrink-0">
              {/* Button 1: Admit Now */}
              <button
                type="button"
                onClick={() => handleWaitingRoomAction(firstWaiter.id, 'ADMIT')}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold flex items-center space-x-1 cursor-pointer shadow-xs transition-colors"
                title="Admit student into the classroom now"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{activeStudentParticipants.length > 0 ? 'Allow 2nd Student In Now' : 'Admit Student Now'}</span>
              </button>

              {/* Button 2: Keep in Waiting */}
              {!isAcknowledged ? (
                <button
                  type="button"
                  onClick={() => handleWaitingRoomAction(firstWaiter.id, 'KEEP_WAITING')}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-extrabold flex items-center space-x-1 cursor-pointer shadow-xs transition-colors"
                  title="Keep student safely in waiting room until you finish the current session"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Keep in Waiting</span>
                </button>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Kept in Waiting
                </span>
              )}

              {/* Button 3: Reject / Dismiss */}
              <button
                type="button"
                onClick={() => handleWaitingRoomAction(firstWaiter.id, 'REJECT')}
                className="p-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 text-[10px] font-bold cursor-pointer transition-colors"
                title="Remove from waiting queue"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })()}

      {/* MAIN WORKSPACE:
          - Mobile (< 768px): Vertical Stack (flex-col) -> 100% Full-Width Quran Mushaf Stage on Top + Collapsible Bottom Drawer Below!
          - Desktop (>= 768px): Horizontal Row (md:flex-row) -> Center Quran Stage + Right Sidebar for Tutors/Desktop */}
      <div className="relative flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* PRIMARY CENTER STAGE: Always 100% Width on Mobile, Dedicated to Quran Screen Share */}
        <main
          className={`w-full flex-1 flex flex-col min-w-0 min-h-0 p-1 sm:p-2.5 overflow-hidden ${
            isLight ? 'bg-[#ECE9DF]' : 'bg-[#040705]'
          }`}
        >
          {isViewingRemoteScreenShare ? (
            /* FULL-HEIGHT, FULL-WIDTH QURAN LESSON SCREEN SHARE (FOR STUDENT / VIEWER) */
            <div
              onTouchStart={handleScreenTouchStart}
              onTouchMove={handleScreenTouchMove}
              onTouchEnd={handleScreenTouchEnd}
              className={`relative flex-1 w-full h-full rounded-xl overflow-hidden border flex flex-col shadow-lg select-none ${
                isLight ? 'bg-[#111613] border-[#C9C3B6]' : 'bg-black border-emerald-500/50'
              }`}
            >
              {/* Ultra-compact floating top overlay bar on screen share with Live Participant Presence, Mobile Zoom & Fullscreen */}
              <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-xs text-white text-[11px] font-semibold z-10 pointer-events-auto border border-white/10">
                <div className="flex items-center space-x-2 truncate min-w-0">
                  <span className="flex items-center space-x-1.5 truncate">
                    <Monitor className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate hidden sm:inline">
                      {isScreenSharing
                        ? `Live Screen Share Preview (${participantName})`
                        : `Shared by ${activeScreenShareParticipant}`}
                    </span>
                  </span>
                  <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="truncate">
                      {isBothTutorAndStudentPresent
                        ? `${tutorDisplayName} + ${connectedStudentsNames}`
                        : `${tutorDisplayName} + ${participantName}`}
                    </span>
                  </span>
                </div>
                <div className="flex items-center space-x-1 shrink-0">
                  {/* Quick Quran Mushaf Zoom Control (1x / 1.5x / 2x + Pinch-to-Zoom on Mobile) */}
                  <button
                    type="button"
                    onClick={handleCycleScreenZoom}
                    className={`px-2 py-0.5 rounded flex items-center space-x-1 cursor-pointer text-[10px] font-bold transition-colors ${
                      screenZoomLevel > 1
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white/15 hover:bg-white/25 text-white'
                    }`}
                    title="Tap to Zoom Quran Mushaf (1x / 1.5x / 2x) or Pinch with 2 Fingers on Mobile"
                  >
                    <ZoomIn className="w-3 h-3" />
                    <span>{`${screenZoomLevel}x`}</span>
                  </button>

                  {screenZoomLevel > 1 && (
                    <button
                      type="button"
                      onClick={() => handleSetScreenZoom(1)}
                      className="px-1.5 py-0.5 rounded bg-rose-500/80 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer"
                      title="Reset Zoom to 1x"
                    >
                      Reset
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleToggleStageFullscreen}
                    className="px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 text-white flex items-center space-x-1 cursor-pointer text-[10px]"
                    title="Toggle Fullscreen Quran View (Bottom Controls Stay Visible)"
                  >
                    {isStageFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                    <span className="hidden sm:inline">{isStageFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
                  </button>
                </div>
              </div>

              <div className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center">
                <video
                  ref={screenShareVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    transform: `scale(${screenZoomLevel}) translate(${screenPan.x / screenZoomLevel}px, ${screenPan.y / screenZoomLevel}px)`,
                    transformOrigin: 'center center',
                    transition: isPanningScreenRef.current ? 'none' : 'transform 120ms ease-out'
                  }}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          ) : (
            /* CLEAN STATIC QURAN CLASSROOM STAGE (Eliminates recursive mirror views when Tutor is in browser tab!) */
            <div
              className={`flex-1 w-full h-full rounded-xl border flex flex-col items-center justify-center p-4 sm:p-6 text-center transition-colors relative overflow-hidden ${
                isLight
                  ? 'bg-white border-[#DFDBD0] shadow-xs'
                  : 'bg-gradient-to-b from-[#0D1812] to-[#08100C] border-[#233F2F] shadow-inner'
              }`}
            >
              <div
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mb-3 border ${
                  isScreenSharing
                    ? 'bg-blue-500/20 border-blue-400/50 text-blue-300 shadow-md'
                    : isLight
                      ? 'bg-[#E8F5EE] border-[#B8DFC8] text-[#1E5C3D]'
                      : 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300 shadow-md'
                }`}
              >
                {isScreenSharing ? <Monitor className="w-6 h-6 sm:w-7 sm:h-7" /> : <BookOpen className="w-6 h-6 sm:w-7 sm:h-7" />}
              </div>

              <h3 className={`text-base sm:text-lg font-extrabold tracking-tight ${isLight ? 'text-[#14231B]' : 'text-white'}`}>
                {isScreenSharing ? 'Your Screen is Live for Your Student' : 'Islamic Tuition Classroom'}
              </h3>
              <p className={`text-xs max-w-md mt-1 leading-relaxed ${isLight ? 'text-[#4A5B51]' : 'text-[#B8CEC1]'}`}>
                {isScreenSharing
                  ? 'Switch to your Quran PDF, Mushaf, or lesson window to teach. We keep this browser tab static so it never creates duplicate mirror screens.'
                  : isTutor
                    ? 'Click "Share Screen" below to display the Quran Mushaf, Qaida PDF, or lesson in full size for your student.'
                    : 'Connected to live classroom audio. When your tutor shares the Quran Mushaf or lesson screen, it will fill this entire board automatically.'}
              </p>

              {/* ZOOM-STYLE LIVE PARTICIPANT PRESENCE CARDS ON MAIN STAGE (Tutor 1 + Student Name) */}
              <div className="w-full max-w-xl mt-4 mb-2 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
                {/* 1. TUTOR PRESENCE CARD */}
                <div
                  className={`w-full sm:w-auto sm:min-w-[200px] px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                    activeTutorParticipant
                      ? activeTutorParticipant.isSpeaking && !activeTutorParticipant.isMuted
                        ? isLight
                          ? 'bg-emerald-50 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                          : 'bg-emerald-950/90 border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.3)]'
                        : isLight
                          ? 'bg-[#F8FAF9] border-emerald-300'
                          : 'bg-[#0E1D15] border-emerald-500/40'
                      : isLight
                        ? 'bg-amber-50/70 border-amber-300 border-dashed'
                        : 'bg-amber-950/20 border-amber-500/35 border-dashed'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0 text-left">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        activeTutorParticipant || isActualTutor ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className={`text-xs font-extrabold truncate ${isLight ? 'text-[#14231B]' : 'text-white'}`}>
                        {activeTutorParticipant
                          ? `${activeTutorParticipant.name}${isActualTutor ? ' (You)' : ''}`
                          : isActualTutor
                            ? `${participantName} (You)`
                            : `Waiting for ${tutorDisplayName}...`}
                      </div>
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                        {activeTutorParticipant || isActualTutor ? 'Tutor (Host) · Connected' : 'Tutor Not in Room Yet'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    {(activeTutorParticipant || isActualTutor) && (
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center space-x-1 shrink-0 ${
                          (activeTutorParticipant ? activeTutorParticipant.isMuted : isAudioMuted)
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : activeTutorParticipant?.isSpeaking
                              ? 'bg-emerald-500 text-slate-950 font-extrabold'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {(activeTutorParticipant ? activeTutorParticipant.isMuted : isAudioMuted) ? (
                          <>
                            <MicOff className="w-3 h-3" />
                            <span>Muted</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-3 h-3" />
                            <span>{activeTutorParticipant?.isSpeaking ? 'Speaking' : 'Live'}</span>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* PLUS CONNECTOR BADGE */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 border ${
                    isBothTutorAndStudentPresent
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                      : isLight
                        ? 'bg-gray-100 border-gray-300 text-gray-500'
                        : 'bg-white/5 border-white/15 text-gray-400'
                  }`}
                >
                  +
                </div>

                {/* 2. STUDENT PRESENCE CARD(S) */}
                {activeStudentParticipants.length > 0 ? (
                  activeStudentParticipants.map((stu) => (
                    <div
                      key={stu.id}
                      className={`w-full sm:w-auto sm:min-w-[200px] px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                        stu.isSpeaking && !stu.isMuted
                          ? isLight
                            ? 'bg-emerald-50 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                            : 'bg-emerald-950/90 border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.3)]'
                          : isLight
                            ? 'bg-[#F8FAF9] border-emerald-300'
                            : 'bg-[#0E1D15] border-emerald-500/40'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 text-left">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                        <div className="min-w-0">
                          <div className={`text-xs font-extrabold truncate ${isLight ? 'text-[#14231B]' : 'text-white'}`}>
                            {stu.name}{!isTutor && stu.name === participantName ? ' (You)' : ''}
                          </div>
                          <div className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                            Student · In Class
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center space-x-1 shrink-0 ${
                            stu.isMuted
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : stu.isSpeaking
                                ? 'bg-emerald-500 text-slate-950 font-extrabold'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {stu.isMuted ? (
                            <>
                              <MicOff className="w-3 h-3" />
                              <span>Muted</span>
                            </>
                          ) : (
                            <>
                              <Mic className="w-3 h-3" />
                              <span>{stu.isSpeaking ? 'Speaking' : 'Live'}</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div
                    className={`w-full sm:w-auto sm:min-w-[215px] px-3.5 py-2.5 rounded-xl border border-dashed flex items-center justify-between gap-2.5 ${
                      isLight
                        ? 'bg-amber-50/70 border-amber-300 text-amber-900'
                        : 'bg-amber-950/20 border-amber-500/35 text-amber-200'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 text-left">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold truncate">
                          Waiting for Student...
                        </div>
                        <div className={`text-[10px] font-semibold truncate ${isLight ? 'text-amber-700' : 'text-amber-300/80'}`}>
                          Classroom open · Ready for student to join
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Compact Live Voice Activity Visualizer */}
              <div className="flex items-center justify-center space-x-1 h-10 my-3 sm:my-4">
                {[0.4, 0.7, 0.5, 0.9, 0.6, 1.0, 0.7, 0.8, 0.5, 0.9, 0.4, 0.7].map((factor, i) => {
                  const anySpeaking = filteredParticipants.some(p => p.isSpeaking && !p.isMuted);
                  const activeLevel = anySpeaking ? Math.max(35, localAudioLevel) : localAudioLevel;
                  const h = Math.max(6, Math.round((activeLevel / 100) * 36 * factor));
                  return (
                    <div
                      key={i}
                      className={`w-2 rounded-full transition-all duration-100 ${
                        !isAudioMuted && activeLevel > 8
                          ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                          : isLight
                            ? 'bg-[#DFDBD0]'
                            : 'bg-[#1D3527]'
                      }`}
                      style={{ height: `${h}px` }}
                    />
                  );
                })}
              </div>

              {!isStudent && (
                <div className="flex flex-wrap items-center justify-center gap-2.5 mt-1">
                  <button
                    type="button"
                    onClick={handleToggleScreenShare}
                    className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center space-x-2 shadow-lg cursor-pointer transition-all ${
                      isScreenSharing
                        ? 'bg-rose-600 hover:bg-rose-500'
                        : 'bg-emerald-600 hover:bg-emerald-500'
                    }`}
                  >
                    <Monitor className="w-4 h-4" />
                    <span>{isScreenSharing ? 'Stop Screen Share' : 'Share Quran Window / Tab'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </main>

        {/* RESPONSIVE PARTICIPANTS & CHAT PANEL:
            - Mobile (< 768px): Slides up BELOW the screen (w-full max-h-[45vh] border-t) so the Quran Mushaf stays 100% wide!
            - Desktop (>= 768px): Compact Right Sidebar (md:w-60 lg:w-72 border-l) */}
        {isSidebarOpen && (
          <aside
            className={`w-full max-h-[45vh] md:max-h-none ${
              isChatOpen || hasActiveStudentCamera ? 'md:w-64 lg:w-72' : 'md:w-56 lg:w-64'
            } shrink-0 flex flex-col border-t md:border-t-0 md:border-l z-20 transition-all duration-150 ${
              isLight
                ? 'bg-white border-[#DFDBD0] text-[#14231B]'
                : 'bg-[#09100C] border-[#223D2E] text-white'
            }`}
          >
            {/* MOBILE BOTTOM DRAWER HEADER BAR (Only visible on Mobile < 768px: Switch between Participants & Chat or Close Drawer) */}
            <div
              className={`flex md:hidden items-center justify-between px-3 py-2 border-b shrink-0 ${
                isLight ? 'bg-[#F3EFE6] border-[#DFDBD0]' : 'bg-[#111E16] border-[#223D2E]'
              }`}
            >
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setMobileDrawerTab('participants');
                    setIsChatOpen(false);
                  }}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center space-x-1.5 cursor-pointer transition-colors ${
                    mobileDrawerTab === 'participants'
                      ? 'bg-emerald-600 text-white'
                      : isLight
                        ? 'text-[#4A5B51] hover:bg-black/5'
                        : 'text-[#B2C9BC] hover:bg-white/5'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>In Class ({activeVisibleParticipantsCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileDrawerTab('chat');
                    setIsChatOpen(true);
                    setUnreadChatCount(0);
                  }}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center space-x-1.5 cursor-pointer transition-colors relative ${
                    mobileDrawerTab === 'chat'
                      ? 'bg-emerald-600 text-white'
                      : isLight
                        ? 'text-[#4A5B51] hover:bg-black/5'
                        : 'text-[#B2C9BC] hover:bg-white/5'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Chat</span>
                  {unreadChatCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[9px] font-extrabold">
                      {unreadChatCount}
                    </span>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsSidebarOpen(false);
                  setIsChatOpen(false);
                }}
                className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-[10px] font-bold flex items-center space-x-1 cursor-pointer"
                title="Close Bottom Panel & Maximize Quran Screen"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Hide</span>
              </button>
            </div>

            {/* 1. COMPACT PARTICIPANTS SECTION (Always shown on Desktop; shown on Mobile when 'participants' tab is active) */}
            <div
              className={`${
                mobileDrawerTab === 'participants' ? 'block' : 'hidden md:block'
              } p-2.5 ${isChatOpen || hasActiveStudentCamera ? 'md:border-b' : ''} ${
                isLight ? 'border-[#E8E4DA] bg-[#FAF9F5]' : 'border-[#223D2E] bg-[#0D1712]'
              } overflow-y-auto`}
            >
              <div className="hidden md:flex items-center justify-between mb-1.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1 ${isLight ? 'text-[#4A5B51]' : 'text-[#B2C9BC]'}`}>
                  <Users className="w-3 h-3 text-emerald-400" />
                  <span>In Class ({activeVisibleParticipantsCount})</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-400">
                  Live
                </span>
              </div>

              <div className="space-y-1.5 max-h-36 md:max-h-40 overflow-y-auto">
                {filteredParticipants.map((p) => (
                  <div
                    key={p.id}
                    className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between text-xs transition-all ${
                      p.isSpeaking && !p.isMuted
                        ? isLight
                          ? 'bg-emerald-50 border-emerald-400 shadow-2xs'
                          : 'bg-emerald-950/90 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                        : isLight
                          ? 'bg-white border-[#DFDBD0]'
                          : 'bg-[#121F17] border-[#264232]'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-bold break-words text-[11px] leading-tight">{p.name}</div>
                      <div className={`text-[9px] uppercase font-bold tracking-wider ${isLight ? 'text-[#5A6B61]' : 'text-[#A8C2B3]'}`}>
                        {p.role === 'Tutor' ? 'Tutor (Host)' : p.role} {p.isScreenSharing ? '· Sharing' : ''}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      {isAdmin && p.role === 'Tutor' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleRemoteParticipantMute(p.id, p.name, p.isMuted)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold text-white border flex items-center space-x-0.5 cursor-pointer transition-colors ${
                              p.isMuted
                                ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400/30'
                                : 'bg-slate-700 hover:bg-slate-600 border-slate-500/30'
                            }`}
                            title={p.isMuted ? `Unmute ${p.name}` : `Mute ${p.name}`}
                          >
                            {p.isMuted ? <Mic className="w-2.5 h-2.5" /> : <MicOff className="w-2.5 h-2.5" />}
                            <span>{p.isMuted ? 'Unmute' : 'Mute'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => requestRemoveTutor(p.id, p.name)}
                            className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/30 flex items-center space-x-0.5 cursor-pointer mr-1 transition-colors"
                            title={`Remove Participant: ${p.name}`}
                          >
                            <span>Remove</span>
                          </button>
                        </>
                      )}
                      {isTutor && (p.role === 'Student' || p.role === 'Guest') && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleRemoteParticipantMute(p.id, p.name, p.isMuted)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold text-white border flex items-center space-x-0.5 cursor-pointer transition-colors ${
                              p.isMuted
                                ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400/30'
                                : 'bg-slate-700 hover:bg-slate-600 border-slate-500/30'
                            }`}
                            title={p.isMuted ? `Unmute ${p.name}` : `Mute ${p.name}`}
                          >
                            {p.isMuted ? <Mic className="w-2.5 h-2.5" /> : <MicOff className="w-2.5 h-2.5" />}
                            <span>{p.isMuted ? 'Unmute' : 'Mute'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => requestRemoveStudent(p.id, p.name)}
                            className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-600 hover:bg-rose-500 text-white border border-rose-500/30 flex items-center space-x-0.5 cursor-pointer mr-1 transition-colors"
                            title={`Remove Participant: ${p.name}`}
                          >
                            <span>Remove</span>
                          </button>
                        </>
                      )}
                      {p.isMuted ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center space-x-0.5">
                          <MicOff className="w-2.5 h-2.5" />
                          <span>Muted</span>
                        </span>
                      ) : !p.hasAudioTrack ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center space-x-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>No Mic</span>
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-0.5">
                          <Mic className={`w-2.5 h-2.5 ${p.isSpeaking ? 'animate-pulse text-emerald-300' : ''}`} />
                          <span>{p.isSpeaking ? 'Speaking' : 'Live'}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* QUICK HOST CONTROL FOOTER IN PARTICIPANTS SIDEBAR (End Meeting for All) */}
              {isTutor && (
                <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={requestEndClassForEveryone}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center space-x-1.5 cursor-pointer transition-colors shadow-2xs"
                    title="End Meeting for All connected participants in real-time"
                  >
                    <PhoneOff className="w-3 h-3" />
                    <span>End Meeting for All</span>
                  </button>
                </div>
              )}

              {/* WAITING ROOM QUEUE SECTION IN PARTICIPANTS SIDEBAR */}
              {isTutor && waitingQueue.length > 0 && (
                <div className={`mt-3 pt-2.5 border-t ${isLight ? 'border-[#E8E4DA]' : 'border-[#223D2E]'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1 text-amber-500">
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span>Waiting Room ({waitingQueue.length})</span>
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
                      In Queue
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {waitingQueue.map((w, wIdx) => {
                      const isAck = acknowledgedWaitingIds.has(w.id);
                      const wSince = formatJoinedSinceTime(w.joined_at);
                      return (
                        <div
                          key={w.id || wIdx}
                          className={`p-2 rounded-lg border text-xs flex flex-col gap-1.5 ${
                            isLight
                              ? 'bg-amber-50/90 border-amber-300'
                              : 'bg-amber-950/40 border-amber-500/35'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0">
                              <div className="font-extrabold text-[11px] truncate flex items-center space-x-1">
                                <span className="text-amber-500 font-mono text-[10px]">#{w.queue_position || wIdx + 1}</span>
                                <span>Student {w.guest_name}</span>
                              </div>
                              <div className={`text-[10px] ${isLight ? 'text-amber-900' : 'text-amber-200/80'}`}>
                                Waiting {formatWaitingDuration(w)} {wSince ? `• Since ${wSince}` : ''}
                              </div>
                            </div>
                            {isAck && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 shrink-0">
                                Kept Waiting
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-1.5 pt-0.5">
                            <button
                              type="button"
                              onClick={() => handleWaitingRoomAction(w.id, 'ADMIT')}
                              className="flex-1 py-1 px-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                              title="Admit student into classroom now"
                            >
                              <UserCheck className="w-3 h-3" />
                              <span>Admit Now</span>
                            </button>
                            {!isAck && (
                              <button
                                type="button"
                                onClick={() => handleWaitingRoomAction(w.id, 'KEEP_WAITING')}
                                className="py-1 px-2 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold cursor-pointer transition-colors shadow-sm"
                                title="Keep student in waiting room until ready"
                              >
                                <span>Keep Waiting</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleWaitingRoomAction(w.id, 'REJECT')}
                              className="p-1 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-[10px] cursor-pointer"
                              title="Remove from waiting queue"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 2. COMPACT STUDENT CAMERA BOX INSIDE SIDEBAR (Only shown when Student turns on camera) */}
            {hasActiveStudentCamera && (
              <div className={`p-2.5 ${isChatOpen ? 'border-b' : ''} ${isLight ? 'border-[#E8E4DA] bg-[#FAF9F5]' : 'border-[#223D2E] bg-[#0D1712]'}`}>
                <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                  <span className="flex items-center space-x-1 text-emerald-400">
                    <Camera className="w-3 h-3" />
                    <span className="break-words">
                      {isCameraActive ? 'Your Camera' : `${activeCameraParticipant} Camera`}
                    </span>
                  </span>
                </div>
                <div className="w-full h-28 sm:h-32 bg-black rounded-lg overflow-hidden border border-emerald-500/50 shadow-xs">
                  <video
                    ref={studentCameraVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* 3. LIVE CLASSROOM CHAT SECTION (Shown when Chat is open on Desktop or 'chat' tab active on Mobile) */}
            {(isChatOpen || mobileDrawerTab === 'chat') && (
              <div className={`${isChatOpen ? 'flex' : 'flex md:hidden'} flex-1 flex-col min-h-0 overflow-hidden`}>
                <div
                  className={`hidden md:flex px-3 py-2 border-b items-center justify-between text-[11px] font-bold ${
                    isLight ? 'border-[#E8E4DA] text-[#14231B]' : 'border-[#223D2E] text-white'
                  }`}
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="flex items-center space-x-1.5 shrink-0">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Classroom Chat</span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsChatOpen(false)}
                    className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer shrink-0 ml-1 ${isLight ? 'text-[#5A6B61]' : 'text-[#A8C2B3]'}`}
                    title="Close Chat"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-6 sm:py-10 px-3 space-y-2 select-none">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div className="space-y-1 max-w-[260px]">
                        <p className={`text-[11px] font-bold ${isLight ? 'text-[#1E3327]' : 'text-emerald-300'}`}>
                          Privacy-Protected Chat
                        </p>
                        <p className={`text-[10px] leading-relaxed ${isLight ? 'text-[#5A6B61]' : 'text-[#8AA393]'}`}>
                          This chat is private, secure, and managed by the IslamicTuition team to ensure a safe learning space.
                        </p>
                      </div>
                    </div>
                  ) : (
                    chatMessages.map(msg => (
                      <div
                        key={msg.id}
                        className={`rounded-xl p-2 text-xs border ${
                          isLight
                            ? 'bg-[#FAF9F5] border-[#E2DDD2] text-[#14231B]'
                            : 'bg-[#121F17] border-[#264232] text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] mb-0.5">
                          <span className="font-bold text-emerald-400 break-words">{msg.sender}</span>
                          <span className={isLight ? 'text-[#7A8A80]' : 'text-[#9BB5A6]'}>{msg.timestamp}</span>
                        </div>
                        <p className="leading-snug break-words text-[11px]">{msg.text}</p>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Friendly Safety Notice Banner when Message is Blocked */}
                {chatWarningMessage && (
                  <div className="mx-2 mb-1.5 p-2.5 rounded-lg bg-rose-950/90 border border-rose-500/50 text-rose-200 text-[11px] flex items-start gap-2 shadow-md animate-in fade-in">
                    <ShieldCheck className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex-1 leading-tight space-y-0.5">
                      <p className="font-bold text-rose-300">Privacy Notice</p>
                      <p className="text-[10px] text-rose-200 break-words">{chatWarningMessage}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setChatWarningMessage(null)}
                      className="text-rose-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className={`p-2 border-t flex items-center space-x-1.5 ${isLight ? 'border-[#E8E4DA] bg-[#FAF9F5]' : 'border-[#223D2E] bg-[#0D1712]'}`}>
                  <input
                    ref={chatInputRef}
                    type="text"
                    value={chatInputText}
                    onChange={e => setChatInputText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendChatMessage()}
                    placeholder="Write message..."
                    className={`min-h-[44px] flex-1 rounded-xl px-3 py-2 text-xs border focus:outline-none focus:border-emerald-500 ${
                      isLight
                        ? 'bg-white border-[#D5D0C6] text-[#14231B] placeholder-[#7A8A80]'
                        : 'bg-[#070C09] border-[#284736] text-white placeholder-[#8AA393]'
                    }`}
                  />
                  <button
                    type="button"
                    disabled={isSendingChat}
                    onClick={handleSendChatMessage}
                    className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition-colors shrink-0 disabled:opacity-50 flex items-center justify-center"
                    title="Send Chat Message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ULTRA-SLIM BOTTOM CONTROLS BAR (Stays visible in Classroom & Fullscreen: Mute/Unmute, Share/Stop Screen, Participants/Chat Toggle, Leave) */}
      <footer
        className={`px-2 py-2 sm:px-4 sm:py-2.5 border-t flex flex-wrap items-center justify-center gap-2 sm:gap-3 z-20 shrink-0 ${
          isLight
            ? 'bg-white border-[#DFDBD0]'
            : 'bg-[#0B130E] border-[#223D2E]'
        }`}
      >
        {/* Button 1: Mute / Unmute Audio */}
        <button
          type="button"
          onClick={handleToggleAudio}
          className={`min-h-[44px] px-3.5 py-2 sm:px-4 sm:py-2 rounded-xl flex items-center space-x-1.5 text-[11px] sm:text-xs font-bold transition-all cursor-pointer shadow-xs ${
            isAudioMuted
              ? 'bg-rose-600 hover:bg-rose-500 text-white'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
        >
          {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          <span>{isAudioMuted ? 'Unmute' : 'Mute'}</span>
        </button>

        {/* Button 2: Share Screen / Stop Share (Tutor & Admin Only - Hidden for Students) */}
        {!isStudent && (
          <button
            type="button"
            onClick={handleToggleScreenShare}
            className={`min-h-[44px] px-3.5 py-2 sm:px-4 sm:py-2 rounded-xl flex items-center space-x-1.5 text-[11px] sm:text-xs font-bold transition-all cursor-pointer shadow-xs border ${
              isScreenSharing
                ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400'
                : isLight
                  ? 'bg-[#FAF9F5] hover:bg-gray-100 text-[#14231B] border-[#D5D0C6]'
                  : 'bg-[#15241B] hover:bg-[#1E3327] text-white border-[#2B4B39]'
            }`}
            title="Share Quran Mushaf or Lesson Screen"
          >
            <Monitor className={`w-4 h-4 ${isScreenSharing ? 'text-white' : 'text-blue-400'}`} />
            <span>{isScreenSharing ? 'Stop Share' : 'Share Screen'}</span>
          </button>
        )}

        {/* Button 3: Student Camera Toggle (Allowed for Students at 480p, blocked for Tutors) */}
        {isStudent && (
          <button
            type="button"
            onClick={handleToggleCamera}
            className={`min-h-[44px] px-3.5 py-2 sm:px-4 sm:py-2 rounded-xl flex items-center space-x-1.5 text-[11px] sm:text-xs font-bold transition-all cursor-pointer shadow-xs border ${
              isCameraActive
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                : isLight
                  ? 'bg-[#FAF9F5] hover:bg-gray-100 text-[#14231B] border-[#D5D0C6]'
                  : 'bg-[#15241B] hover:bg-[#1E3327] text-white border-[#2B4B39]'
            }`}
            title="Turn on or off your student camera"
          >
            {isCameraActive ? <Camera className="w-4 h-4 text-white" /> : <CameraOff className="w-4 h-4 text-emerald-400" />}
            <span>{isCameraActive ? 'Video Off' : 'Camera'}</span>
          </button>
        )}

        {/* Universal Headcount Indicator Button: Visible on both Desktop and Mobile */}
        <button
          type="button"
          onClick={handleToggleParticipantsDrawer}
          className={`min-h-[44px] px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-bold border flex items-center space-x-1.5 cursor-pointer transition-all shadow-xs ${
            isSidebarOpen && (mobileDrawerTab === 'participants' || (typeof window !== 'undefined' && window.innerWidth >= 768))
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
              : isLight
                ? 'bg-[#FAF9F5] hover:bg-gray-100 text-[#14231B] border-[#D5D0C6]'
                : 'bg-[#15241B] hover:bg-[#1E3327] text-white border-[#2B4B39]'
          }`}
          title="Show or Hide Participants"
        >
          <Users className={`w-4 h-4 ${isSidebarOpen && (mobileDrawerTab === 'participants' || (typeof window !== 'undefined' && window.innerWidth >= 768)) ? 'text-white' : 'text-emerald-400'}`} />
          <span>{`In Class (${activeVisibleParticipantsCount})`}</span>
          {isTutor && waitingQueue.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold animate-pulse">
              +{waitingQueue.length} Waiting
            </span>
          )}
        </button>

        {/* Button 4: Chat Button (Opens Below Screen on Mobile, Right Sidebar on Desktop) */}
        <button
          type="button"
          onClick={handleToggleChatInSidebar}
          className={`min-h-[44px] px-3.5 py-2 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold border flex items-center space-x-1.5 cursor-pointer transition-all shadow-xs relative ${
            (isChatOpen && isSidebarOpen)
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
              : isLight
                ? 'bg-[#FAF9F5] hover:bg-emerald-50 text-[#14231B] border-[#D5D0C6]'
                : 'bg-[#15241B] hover:bg-[#1E3327] text-white border-[#2B4B39]'
          }`}
          title={isChatOpen ? 'Click to Close Classroom Chat' : 'Click to Open Classroom Chat'}
        >
          <MessageSquare className={`w-4 h-4 ${(isChatOpen && isSidebarOpen) ? 'text-white' : 'text-emerald-400'}`} />
          <span>{(isChatOpen && isSidebarOpen) ? 'Close Chat' : 'Chat'}</span>
          {!(isChatOpen && isSidebarOpen) && unreadChatCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold animate-bounce">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* Button 5: Leave Room */}
        <button
          type="button"
          onClick={() => setShowLeaveConfirmModal(true)}
          className="min-h-[44px] px-3.5 py-2 sm:px-4 sm:py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] sm:text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-all shadow-xs active:scale-95"
          title="Leave or End Class"
        >
          <PhoneOff className="w-4 h-4" />
          <span>{isTutor ? 'End / Leave' : 'Leave'}</span>
        </button>
      </footer>

      {/* STUDENT CAMERA ACTIVATION CONFIRMATION MODAL */}
      {showCameraConfirmModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div
            className={`border rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center ${
              isLight ? 'bg-white border-[#DFDBD0] text-[#14231B]' : 'bg-[#0F1B15] border-[#1D3327] text-white'
            }`}
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-[#2D8B5C]">
              <Camera className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold">Turn On Your Camera</h3>
              <p className={`text-xs ${isLight ? 'text-[#5A6B61]' : 'text-[#8AA393]'}`}>
                Your camera video will appear in the side panel so the Quran lesson screen stays full-size.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowCameraConfirmModal(false);
                  executeToggleCamera(true);
                }}
                className="w-full py-2.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-md"
              >
                Turn On Camera
              </button>

              <button
                type="button"
                onClick={() => setShowCameraConfirmModal(false)}
                className={`w-full py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  isLight ? 'hover:bg-gray-100 text-[#5A6B61]' : 'hover:bg-white/5 text-[#8AA393]'
                }`}
              >
                Keep Camera Off
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ZOOM-STYLE HOST ACTION CONFIRMATION MODAL */}
      {pendingHostConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-in fade-in">
          <div
            className={`border rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center ${
              isLight ? 'bg-white border-rose-200 text-[#14231B]' : 'bg-[#0F1B15] border-rose-500/40 text-white'
            }`}
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-rose-500">
                {pendingHostConfirm.type === 'END_FOR_ALL'
                  ? 'End Meeting for All?'
                  : pendingHostConfirm.type === 'REMOVE_STUDENT'
                    ? `Remove ${pendingHostConfirm.targetName || 'Student'}?`
                    : pendingHostConfirm.type === 'REMOVE_TUTOR'
                      ? `Remove ${pendingHostConfirm.targetName || 'Tutor'}?`
                      : 'Finish Current Lesson?'}
              </h3>
              <p className={`text-xs leading-relaxed ${isLight ? 'text-[#5A6B61]' : 'text-[#8AA393]'}`}>
                {pendingHostConfirm.type === 'END_FOR_ALL'
                  ? 'This will disconnect all connected participants and close the classroom for everyone.'
                  : pendingHostConfirm.type === 'REMOVE_STUDENT'
                    ? `Are you sure you want to remove ${pendingHostConfirm.targetName || 'this student'} from the live classroom?`
                    : pendingHostConfirm.type === 'REMOVE_TUTOR'
                      ? `Are you sure you want to disconnect ${pendingHostConfirm.targetName || 'the tutor'} from this meeting?`
                      : 'This will finish the current student’s lesson and keep your classroom open for the next student.'}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  const conf = pendingHostConfirm;
                  setPendingHostConfirm(null);
                  setShowLeaveConfirmModal(false);
                  if (conf.type === 'END_FOR_ALL') {
                    await handleEndClassForEveryone();
                  } else if (conf.type === 'REMOVE_STUDENT' && conf.targetId) {
                    await handleRemoveSelectedStudent(conf.targetId, conf.targetName || 'Student');
                  } else if (conf.type === 'REMOVE_TUTOR' && conf.targetId) {
                    await handleRemoveTutorFromMeeting(conf.targetId, conf.targetName || 'Tutor');
                  } else if (conf.type === 'FINISH_LESSON') {
                    await handleFinishCurrentStudentLesson();
                  }
                }}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer shadow-md"
              >
                {pendingHostConfirm.type === 'END_FOR_ALL'
                  ? 'Yes, End Meeting for All'
                  : pendingHostConfirm.type === 'REMOVE_STUDENT'
                    ? 'Yes, Remove Student'
                    : pendingHostConfirm.type === 'REMOVE_TUTOR'
                      ? 'Yes, Remove Tutor'
                      : 'Yes, Finish Lesson'}
              </button>

              <button
                type="button"
                onClick={() => setPendingHostConfirm(null)}
                className={`w-full py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  isLight ? 'hover:bg-gray-100 text-[#5A6B61]' : 'hover:bg-white/5 text-[#8AA393]'
                }`}
              >
                Cancel / Do Not Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEAVE / END ROOM CONFIRMATION MODAL (Step 4: Finish Current Student's Class vs End Class for Everyone) */}
      {showLeaveConfirmModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div
            className={`border rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl text-center ${
              isLight ? 'bg-white border-[#DFDBD0] text-[#14231B]' : 'bg-[#0F1B15] border-[#1D3327] text-white'
            }`}
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500">
              <PhoneOff className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-extrabold">
                {isAdmin
                  ? 'Admin Super-Host Controls'
                  : isSupervisor
                    ? 'Supervisor Stealth Controls'
                    : isActualTutor
                      ? 'Finish Lesson or End Class (Host)'
                      : 'Leave Quran Classroom'}
              </h3>
              <p className={`text-xs ${isLight ? 'text-[#5A6B61]' : 'text-[#8AA393]'}`}>
                {isAdmin
                  ? 'You are in 100% Stealth Mode. You can leave silently anytime, remove any student, remove the tutor, or end the meeting for everyone.'
                  : isSupervisor
                    ? 'You are in 100% Stealth Mode. You can leave silently anytime without disturbing the class, or remove a student if needed.'
                    : isActualTutor
                      ? 'Choose whether to finish the current student’s lesson (and stay ready for your next student) or end class for everyone.'
                      : 'Are you sure you want to finish and leave your live class?'}
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              {isAdmin ? (
                <>
                  {/* 1. Leave Silently (Keep Class Running) */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowLeaveConfirmModal(false);
                      onLeave();
                    }}
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer shadow-md flex flex-col items-center space-y-0.5"
                  >
                    <span className="flex items-center space-x-1.5">
                      <span>🕵️ Leave Silently (Keep Class Running)</span>
                    </span>
                    <span className="text-[10px] font-medium text-emerald-100/90">
                      Exit stealth observation immediately without Tutor or Student knowing
                    </span>
                  </button>

                  {/* 2. Mute/Unmute & Remove Specific Student(s) */}
                  {activeStudentParticipants.map((stu) => (
                    <div key={stu.id} className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleRemoteParticipantMute(stu.id, stu.name, stu.isMuted)}
                        className={`py-2.5 px-2.5 rounded-xl text-white text-xs font-extrabold transition-colors cursor-pointer shadow-md flex items-center justify-center space-x-1.5 ${
                          stu.isMuted ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'
                        }`}
                      >
                        {stu.isMuted ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                        <span className="truncate">{stu.isMuted ? `Unmute ${stu.name}` : `Mute ${stu.name}`}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => requestRemoveStudent(stu.id, stu.name)}
                        className="py-2.5 px-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer shadow-md flex items-center justify-center space-x-1.5"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span className="truncate">Remove {stu.name}</span>
                      </button>
                    </div>
                  ))}

                  {/* 3. Admin Exclusive: Mute/Unmute or Remove Tutor from Meeting */}
                  {activeTutorParticipant && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleRemoteParticipantMute(
                            activeTutorParticipant.id,
                            activeTutorParticipant.name,
                            activeTutorParticipant.isMuted
                          )
                        }
                        className={`py-2.5 px-2.5 rounded-xl text-white text-xs font-extrabold transition-colors cursor-pointer shadow-md flex items-center justify-center space-x-1.5 ${
                          activeTutorParticipant.isMuted
                            ? 'bg-emerald-600 hover:bg-emerald-500'
                            : 'bg-slate-700 hover:bg-slate-600'
                        }`}
                      >
                        {activeTutorParticipant.isMuted ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                        <span className="truncate">
                          {activeTutorParticipant.isMuted
                            ? `Unmute ${activeTutorParticipant.name}`
                            : `Mute ${activeTutorParticipant.name}`}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => requestRemoveTutor(activeTutorParticipant.id, activeTutorParticipant.name)}
                        className="py-2.5 px-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer shadow-md flex items-center justify-center space-x-1.5"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span className="truncate">Remove {activeTutorParticipant.name}</span>
                      </button>
                    </div>
                  )}

                  {/* 4. End Meeting for All (Tutor + All Students) */}
                  <button
                    type="button"
                    onClick={requestEndClassForEveryone}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer shadow-md flex items-center justify-center space-x-1.5"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                    <span>End Meeting for All (Tutor + Students)</span>
                  </button>
                </>
              ) : isSupervisor ? (
                <>
                  {/* 1. Supervisor Leave Silently (Keep Class Running) */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowLeaveConfirmModal(false);
                      onLeave();
                    }}
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer shadow-md flex flex-col items-center space-y-0.5"
                  >
                    <span className="flex items-center space-x-1.5">
                      <span>🕵️ Leave Silently (Keep Class Running)</span>
                    </span>
                    <span className="text-[10px] font-medium text-emerald-100/90">
                      Exit stealth observation immediately without Tutor or Student knowing
                    </span>
                  </button>

                  {/* 2. Supervisor Mute/Unmute & Remove Specific Student(s) */}
                  {activeStudentParticipants.map((stu) => (
                    <div key={stu.id} className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleRemoteParticipantMute(stu.id, stu.name, stu.isMuted)}
                        className={`py-2.5 px-2.5 rounded-xl text-white text-xs font-extrabold transition-colors cursor-pointer shadow-md flex items-center justify-center space-x-1.5 ${
                          stu.isMuted ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'
                        }`}
                      >
                        {stu.isMuted ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                        <span className="truncate">{stu.isMuted ? `Unmute ${stu.name}` : `Mute ${stu.name}`}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => requestRemoveStudent(stu.id, stu.name)}
                        className="py-2.5 px-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer shadow-md flex items-center justify-center space-x-1.5"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span className="truncate">Remove {stu.name}</span>
                      </button>
                    </div>
                  ))}

                  {/* 3. End Meeting for All */}
                  <button
                    type="button"
                    onClick={requestEndClassForEveryone}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer shadow-md flex items-center justify-center space-x-1.5"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                    <span>End Meeting for All</span>
                  </button>
                </>
              ) : isActualTutor ? (
                <>
                  {/* Show Mute/Unmute & Remove Participant buttons for each active student, or default if empty */}
                  {activeStudentParticipants.length > 0 ? (
                    activeStudentParticipants.map((stu) => (
                      <div key={stu.id} className="space-y-2">
                        <button
                          type="button"
                          onClick={() => handleToggleRemoteParticipantMute(stu.id, stu.name, stu.isMuted)}
                          className={`w-full py-2.5 px-3 rounded-xl text-white text-xs font-extrabold transition-colors cursor-pointer shadow-md flex items-center justify-center space-x-1.5 ${
                            stu.isMuted ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'
                          }`}
                        >
                          {stu.isMuted ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                          <span>{stu.isMuted ? `Unmute Specific User: ${stu.name}` : `Mute Specific User: ${stu.name}`}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => requestRemoveStudent(stu.id, stu.name)}
                          className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer shadow-md flex flex-col items-center space-y-0.5"
                        >
                          <span className="flex items-center space-x-1.5">
                            <UserX className="w-4 h-4" />
                            <span>Remove Participant / Finish Lesson for {stu.name}</span>
                          </span>
                          <span className="text-[10px] font-medium text-emerald-100/90">
                            Disconnects {stu.name} only &amp; keeps tutor in the classroom
                          </span>
                        </button>
                      </div>
                    ))
                  ) : (
                    /* Default Fallback Button if no student is active in room */
                    <button
                      type="button"
                      onClick={requestFinishCurrentLesson}
                      className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer shadow-md flex flex-col items-center space-y-0.5"
                    >
                      <span className="flex items-center space-x-1.5">
                        <UserCheck className="w-4 h-4" />
                        <span>Finish Current Lesson</span>
                      </span>
                      <span className="text-[10px] font-medium text-emerald-100/90">
                        Keeps your classroom open and ready for the next student
                      </span>
                    </button>
                  )}

                  {/* Option 2: End Meeting for All (disconnects all students & closes room) */}
                  <button
                    type="button"
                    onClick={requestEndClassForEveryone}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer shadow-md flex items-center justify-center space-x-1.5"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                    <span>End Meeting for All</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowLeaveConfirmModal(false);
                    onLeave();
                  }}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer shadow-md"
                >
                  Finish &amp; Leave Class
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowLeaveConfirmModal(false)}
                className={`w-full py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  isLight ? 'hover:bg-gray-100 text-[#5A6B61]' : 'hover:bg-white/5 text-[#8AA393]'
                }`}
              >
                Cancel / Stay in Class
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEVICE SETTINGS & 5-SEC MIC TEST MODAL (Noise Filter & Auto-Gain Disable permanently active in background) */}
      {showDeviceSettingsModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div
            className={`border rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto ${
              isLight ? 'bg-white border-[#DFDBD0] text-[#14231B]' : 'bg-[#0B140F] border-[#244030] text-white'
            }`}
          >
            <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-[#E2DDD2]' : 'border-[#223D2E]'}`}>
              <h3 className="text-sm font-bold flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>Audio & Device Settings</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  handleResetMicTest();
                  setShowDeviceSettingsModal(false);
                }}
                className={`cursor-pointer ${isLight ? 'text-[#5A6B61] hover:text-black' : 'text-[#A8C2B3] hover:text-white'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Device 1: Microphone */}
              <div className="space-y-1">
                <label className={`block font-bold flex items-center space-x-1.5 ${isLight ? 'text-[#14231B]' : 'text-[#8AA393]'}`}>
                  <Mic className="w-3.5 h-3.5 text-[#2D8B5C]" />
                  <span>Microphone Input Device</span>
                </label>
                <select
                  value={selectedAudioInput}
                  onChange={e => handleSelectAudioInput(e.target.value)}
                  className={`w-full border rounded-xl p-2.5 focus:outline-none focus:border-[#2D8B5C] ${
                    isLight ? 'bg-[#FAF9F5] border-[#D5D0C6] text-[#14231B]' : 'bg-black/50 border-white/15 text-white'
                  }`}
                >
                  {audioInputDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Device 2: Speaker / Headphones */}
              <div className="space-y-1">
                <label className={`block font-bold flex items-center space-x-1.5 ${isLight ? 'text-[#14231B]' : 'text-[#8AA393]'}`}>
                  <Headphones className="w-3.5 h-3.5 text-blue-500" />
                  <span>Speaker / Headphones Output</span>
                </label>
                <select
                  value={selectedAudioOutput}
                  onChange={e => setSelectedAudioOutput(e.target.value)}
                  className={`w-full border rounded-xl p-2.5 focus:outline-none focus:border-[#2D8B5C] ${
                    isLight ? 'bg-[#FAF9F5] border-[#D5D0C6] text-[#14231B]' : 'bg-black/50 border-white/15 text-white'
                  }`}
                >
                  {audioOutputDevices.length === 0 ? (
                    <option value="">System Default Audio Output</option>
                  ) : (
                    audioOutputDevices.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Speaker ${d.deviceId.slice(0, 8)}`}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Device 3: Camera (Students Only) */}
              {isStudent && (
                <div className="space-y-1">
                  <label className={`block font-bold flex items-center space-x-1.5 ${isLight ? 'text-[#14231B]' : 'text-[#8AA393]'}`}>
                    <Camera className="w-3.5 h-3.5 text-purple-500" />
                    <span>Camera</span>
                  </label>
                  <select
                    value={selectedVideoInput}
                    onChange={e => handleSelectVideoInput(e.target.value)}
                    className={`w-full border rounded-xl p-2.5 focus:outline-none focus:border-[#2D8B5C] ${
                      isLight ? 'bg-[#FAF9F5] border-[#D5D0C6] text-[#14231B]' : 'bg-black/50 border-white/15 text-white'
                    }`}
                  >
                    {videoInputDevices.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 5-SECOND IN-MEMORY VOICE RECORDER & PLAYBACK TEST */}
              <div
                className={`border rounded-xl p-3.5 space-y-2.5 ${
                  isLight ? 'bg-[#FAF9F5] border-[#DFDBD0]' : 'bg-black/40 border-emerald-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#2D8B5C] flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#E8A93E]" />
                    <span>Test Your Microphone</span>
                  </span>
                  <span className={`text-[10px] font-mono ${isLight ? 'text-[#5A6B61]' : 'text-[#8AA393]'}`}>
                    5-Second Voice Check
                  </span>
                </div>

                {micTestError && (
                  <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-500 text-[11px]">
                    {micTestError}
                  </div>
                )}

                {micTestState === 'idle' && (
                  <button
                    type="button"
                    onClick={handleStart5SecMicTest}
                    className="w-full py-2 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-xl font-bold flex items-center justify-center space-x-2 transition-colors cursor-pointer shadow-xs"
                  >
                    <Mic className="w-4 h-4" />
                    <span>Record 5-Second Voice Sample</span>
                  </button>
                )}

                {micTestState === 'recording' && (
                  <div className="space-y-2 text-center p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl">
                    <div className="flex items-center justify-center space-x-2 text-rose-500 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                      <span>Recording... Speak now ({testCountdown}s remaining)</span>
                    </div>
                    <div className="w-full h-2 bg-black/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#2D8B5C] transition-all duration-75"
                        style={{ width: `${Math.max(5, testAudioLevel)}%` }}
                      />
                    </div>
                  </div>
                )}

                {(micTestState === 'recorded' || micTestState === 'playing') && (
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handlePlayBackTestVoice}
                      disabled={micTestState === 'playing'}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center space-x-2 cursor-pointer transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      <span>{micTestState === 'playing' ? 'Playing Your Voice...' : 'Play Back My Voice'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetMicTest}
                      className={`px-3 py-2 rounded-xl font-bold flex items-center justify-center cursor-pointer transition-colors ${
                        isLight ? 'bg-gray-200 hover:bg-gray-300 text-slate-800' : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}
                      title="Record again"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className={`pt-3 border-t text-right ${isLight ? 'border-[#E2DDD2]' : 'border-white/10'}`}>
              <button
                type="button"
                onClick={() => {
                  handleResetMicTest();
                  setShowDeviceSettingsModal(false);
                }}
                className="px-5 py-2 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TUTOR INTERCEPTS MODAL: PASSCODE WAITING ROOM ADMIT/REJECT TRIGGERS */}
      {showWaitingRoomModal && isTutor && waitingQueue.length > 0 && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div
            className={`border rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl ${
              isLight ? 'bg-white border-amber-300 text-[#14231B]' : 'bg-[#0D1812] border-amber-500/40 text-white'
            }`}
          >
            <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-[#E2DDD2]' : 'border-white/10'}`}>
              <h3 className="text-sm font-bold flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                <span>Passcode Waiting Room Request</span>
              </h3>
              <button type="button" onClick={() => setShowWaitingRoomModal(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {waitingQueue.map(w => (
                <div
                  key={w.id}
                  className={`border rounded-xl p-3 flex items-center justify-between ${
                    isLight ? 'bg-[#FAF9F5] border-[#DFDBD0]' : 'bg-black/40 border-white/10'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold">{w.guest_name}</div>
                    <div className={`text-[10px] ${isLight ? 'text-[#5A6B61]' : 'text-[#8AA393]'}`}>Waiting for admittance</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleWaitingRoomAction(w.id, 'ADMIT')}
                      className="px-3 py-1.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Admit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleWaitingRoomAction(w.id, 'REJECT')}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ALWAYS-ON-TOP FLOATING MINI CONTROL BAR PORTAL (Stays visible on PDFs & other browser tabs!) */}
      {pipWindow &&
        createPortal(
          <div className="w-full h-screen bg-[#070D0A] text-white flex flex-col justify-between overflow-hidden select-none border border-[#223D2E]">
            {/* Top Live Participant Presence Strip & Join/Leave Toast inside Floating Mini-Bar */}
            <div className="px-3 py-1.5 bg-[#050A07] border-b border-[#1C3427] flex items-center justify-between gap-2 shrink-0">
              {presenceToast ? (
                <div
                  className={`flex-1 flex items-center space-x-2 px-2 py-0.5 rounded-md text-[11px] font-bold truncate ${
                    presenceToast.type === 'join'
                      ? 'bg-emerald-900/90 text-emerald-100 border border-emerald-400/50'
                      : 'bg-amber-900/90 text-amber-100 border border-amber-400/50'
                  }`}
                >
                  <span className="truncate">
                    {presenceToast.type === 'join'
                      ? `🟢 ${presenceToast.name} (${presenceToast.role}) joined!`
                      : `🟠 ${presenceToast.name} (${presenceToast.role}) left`}
                  </span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isBothTutorAndStudentPresent ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'
                    }`}
                  />
                  <span
                    className={`text-[11px] font-extrabold truncate ${
                      isBothTutorAndStudentPresent ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {isBothTutorAndStudentPresent
                      ? `${tutorDisplayName} + ${connectedStudentsNames}`
                      : isTutor
                        ? `${participantName} · Waiting for Student...`
                        : activeTutorParticipant
                          ? `${tutorDisplayName} + ${participantName}`
                          : `${participantName} · Waiting for Tutor...`}
                  </span>
                </div>
              )}

              <span className="text-[11px] font-mono font-bold text-amber-400 shrink-0">
                {formatChronometerTime(elapsedSeconds)}
              </span>
            </div>

            {/* Non-Intrusive Next Student Ready Strip inside Floating Mini-Bar (With Sibling [Allow 2nd Student In Now] Button) */}
            {isTutor && waitingQueue.length > 0 && (
              <div className="px-3 py-1 bg-amber-950/90 border-b border-amber-500/40 flex items-center justify-between gap-2 shrink-0">
                <span className="text-[10px] font-extrabold text-amber-200 truncate">
                  ⏳ Next Student Ready: {waitingQueue[0].guest_name} ({formatWaitingDuration(waitingQueue[0])})
                </span>
                <button
                  type="button"
                  onClick={() => handleWaitingRoomAction(waitingQueue[0].id, 'ADMIT')}
                  className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-extrabold cursor-pointer shrink-0"
                >
                  {activeStudentParticipants.length > 0 ? '+ Allow 2nd Student In Now' : 'Admit Now'}
                </button>
              </div>
            )}

            {/* Compact 4-Button Bottom/Top Control Strip */}
            <div className="px-3 py-2 bg-[#0B130E] border-b border-[#223D2E] flex items-center justify-between gap-2 shrink-0">
              {/* 1. Mute / Unmute */}
              <button
                type="button"
                onClick={handleToggleAudio}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 text-xs font-bold cursor-pointer ${
                  isAudioMuted ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                }`}
              >
                {isAudioMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{isAudioMuted ? 'Unmute' : 'Mute'}</span>
              </button>

              {/* 2. Share Screen / Stop Share (or Student Camera) */}
              {!isStudent ? (
                <button
                  type="button"
                  onClick={handleToggleScreenShare}
                  className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 text-xs font-bold cursor-pointer border ${
                    isScreenSharing
                      ? 'bg-blue-600 text-white border-blue-400'
                      : 'bg-[#15241B] text-white border-[#2B4B39]'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>{isScreenSharing ? 'Stop Share' : 'Share Screen'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleToggleCamera}
                  className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 text-xs font-bold cursor-pointer border ${
                    isCameraActive
                      ? 'bg-emerald-600 text-white border-emerald-400'
                      : 'bg-[#15241B] text-white border-[#2B4B39]'
                  }`}
                >
                  {isCameraActive ? <Camera className="w-3.5 h-3.5" /> : <CameraOff className="w-3.5 h-3.5" />}
                  <span>{isCameraActive ? 'Stop Video' : 'Camera'}</span>
                </button>
              )}

              {/* 3. Chat Toggle (Click to Open, Click Again to Close) */}
              <button
                type="button"
                onClick={handleToggleChatInSidebar}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 text-xs font-bold cursor-pointer border relative ${
                  isChatOpen
                    ? 'bg-emerald-600 text-white border-emerald-400'
                    : 'bg-[#15241B] text-white border-[#2B4B39]'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{isChatOpen ? 'Close Chat' : 'Chat'}</span>
                {!isChatOpen && unreadChatCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold">
                    {unreadChatCount}
                  </span>
                )}
              </button>

              {/* 4. Finish Current Student / End Class */}
              <div className="flex items-center space-x-1.5">
                {isTutor && activeStudentParticipants.length > 0 && (
                  <button
                    type="button"
                    onClick={handleFinishCurrentStudentLesson}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-extrabold flex items-center space-x-1 cursor-pointer border border-emerald-400/40"
                    title="Finish current student's lesson & stay ready for next student"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Next</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (isActualTutor) {
                      handleEndClassForEveryone();
                    } else {
                      try { pipWindow.close(); } catch {}
                      onLeave();
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center space-x-1 cursor-pointer"
                  title={isActualTutor ? 'End Class for Everyone' : 'Leave Class Silently'}
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  <span>{isActualTutor ? 'End' : 'Leave'}</span>
                </button>
              </div>
            </div>

            {/* Expandable Live Chat Drawer inside the Floating Bar when Chat is Open */}
            {isChatOpen && (
              <div className="flex-1 flex flex-col min-h-0 bg-[#09100C] p-2.5 overflow-hidden">
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-6 text-[11px] text-[#9BB5A6]">
                      No chat messages yet. Type below to message your class.
                    </div>
                  ) : (
                    chatMessages.map(msg => (
                      <div key={msg.id} className="rounded-lg p-2 text-xs bg-[#121F17] border border-[#264232] text-white">
                        <div className="flex items-center justify-between text-[10px] mb-0.5">
                          <span className="font-bold text-emerald-400">{msg.sender}</span>
                          <span className="text-[#9BB5A6]">{msg.timestamp}</span>
                        </div>
                        <p className="leading-snug break-words text-[11px]">{msg.text}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="pt-2 mt-1 border-t border-[#223D2E] flex items-center space-x-1.5">
                  <input
                    type="text"
                    value={chatInputText}
                    onChange={e => setChatInputText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendChatMessage()}
                    placeholder="Write message..."
                    className="flex-1 rounded-lg px-2.5 py-1.5 text-xs bg-[#050806] border border-[#284736] text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleSendChatMessage}
                    className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>,
          pipWindow.document.body
        )}
    </div>
  );
};
