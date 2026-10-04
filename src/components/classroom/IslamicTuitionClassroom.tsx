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
  ExternalLink
} from 'lucide-react';
import {
  LiveKitRoomTokenResponse,
  UserRole,
  WaitingRoomParticipant
} from '../../types';
import { createOptimizedLiveKitRoom } from '../../services/livekitService';

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
 * or when a student/tutor connects, giving a refined broadcast-studio feel.
 */
function playStudioConnectionChime(type: 'connect' | 'peer_join' = 'connect') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx: AudioContext = new AudioCtx();
    const now = ctx.currentTime;
    const notes = type === 'connect' ? [440, 554.37, 659.25] : [523.25, 659.25];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      gain.gain.setValueAtTime(0.001, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.06, now + idx * 0.09 + 0.03);
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
  const isTutor = userRole === 'tutor' || userRole === 'admin' || userRole === 'supervisor';
  const isStudent = userRole === 'student' || userRole === 'guest' || userRole === 'parent';

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

  // Connection & Track States
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>(ConnectionState.Connecting);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(initialMuted);
  const isAudioMutedRef = useRef<boolean>(initialMuted);
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

  // Right Sidebar & Chat: Chat is CLOSED by default; clicking Chat opens it, clicking Chat again closes it!
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([]);
  const [chatInputText, setChatInputText] = useState<string>('');
  const chatInputRef = useRef<HTMLInputElement | null>(null);

  // Always-On-Top Floating Mini Control Bar (Document Picture-in-Picture) for PDFs & Other Browser Tabs
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const pipWindowRef = useRef<Window | null>(null);

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

  // Tutor Intercepts Modal: Passcode waiting room admit/reject triggers
  const [waitingQueue, setWaitingQueue] = useState<WaitingRoomParticipant[]>([]);
  const [showWaitingRoomModal, setShowWaitingRoomModal] = useState<boolean>(false);

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

  // Helper function to check if participant is a hidden admin
  const isParticipantHiddenAdmin = (p: Participant): boolean => {
    try {
      if (!p.metadata) return false;
      const parsed = JSON.parse(p.metadata);
      return Boolean(parsed.hidden || ((parsed.role === 'admin' || parsed.role === 'supervisor') && parsed.hidden));
    } catch {
      return false;
    }
  };

  // Attach and play a remote audio track reliably with zero duplicate elements and instant low-latency playback
  const attachRemoteAudioTrack = useCallback((track: RemoteTrack, room?: Room) => {
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

  // Synchronize visible participants list excluding hidden admins
  const syncParticipantsState = useCallback((room: Room) => {
    const visibleList: ParticipantInfo[] = [];

    // Local participant
    if (room.localParticipant) {
      const isHidden = isParticipantHiddenAdmin(room.localParticipant);
      const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      const screenPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);

      const localHasScreen = Boolean(screenPub?.track && !screenPub.isMuted);
      const localHasCam = Boolean(camPub?.track && !camPub.isMuted);
      setIsScreenSharing(localHasScreen);
      setIsCameraActive(localHasCam);
      setLocalAudioLevel(Math.min(100, Math.round((room.localParticipant.audioLevel || 0) * 100)));

      if (!isHidden) {
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
      // Ensure any already-published remote audio tracks are attached immediately
      p.audioTrackPublications.forEach((pub) => {
        if (pub.track && pub.isSubscribed) {
          attachRemoteAudioTrack(pub.track as RemoteTrack, room);
        }
      });

      if (!isParticipantHiddenAdmin(p)) {
        let pRole = 'Student';
        try {
          if (p.metadata) {
            const meta = JSON.parse(p.metadata);
            if (meta.role === 'tutor') pRole = 'Tutor';
            else if (meta.role === 'admin') pRole = 'Admin';
            else if (meta.role === 'supervisor') pRole = 'Supervisor';
          }
        } catch {}

        const micPub = p.getTrackPublication(Track.Source.Microphone);
        const camPub = p.getTrackPublication(Track.Source.Camera);
        const screenPub = p.getTrackPublication(Track.Source.ScreenShare);

        if (screenPub?.track && !screenPub.isMuted) {
          foundScreenShare = p.name || p.identity;
        }
        if (camPub?.track && !camPub.isMuted) {
          foundCameraShare = p.name || p.identity;
        }

        visibleList.push({
          id: p.identity,
          name: p.name || p.identity,
          role: pRole,
          isSpeaking: p.isSpeaking,
          isMuted: micPub ? micPub.isMuted : true,
          hasAudioTrack: Boolean(micPub?.track),
          hasVideoTrack: Boolean(camPub?.track && !camPub.isMuted),
          isScreenSharing: Boolean(screenPub?.track && !screenPub.isMuted),
          audioLevel: p.audioLevel
        });
      }
    });

    setActiveScreenShareParticipant(foundScreenShare);
    setActiveCameraParticipant(foundCameraShare);
    setFilteredParticipants(visibleList);
    setActiveVisibleParticipantsCount(visibleList.length);

    if (visibleList.length >= 2) {
      setIsTimerRunning(true);
      if (settings?.recordingEnabled) {
        setIsEgressRecordingActive(true);
      }
    }
  }, [participantName, userRole, settings?.recordingEnabled, attachRemoteAudioTrack]);

  // Attach active REMOTE Screen Share & Student Camera video tracks whenever video state or participants change
  // CRITICAL FIX: Never attach localParticipant's own ScreenShare track to screenShareVideoRef!
  // Self-mirroring the presenter's own screen inside the browser tab causes the recursive "Hall of Mirrors" tunnel.
  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;

    // 1. Attach Remote Screen Share Video Track ONLY (When viewing someone else's shared screen)
    if (screenShareVideoRef.current) {
      let remoteScreenTrack: Track | undefined;
      room.remoteParticipants.forEach((p) => {
        const pub = p.getTrackPublication(Track.Source.ScreenShare);
        if (pub?.track && !pub.isMuted) {
          remoteScreenTrack = pub.track;
        }
      });
      if (remoteScreenTrack && !isScreenSharing) {
        remoteScreenTrack.attach(screenShareVideoRef.current);
      } else {
        screenShareVideoRef.current.srcObject = null;
      }
    }

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

  // Poll Tutor Waiting Room Intercept Queue if user is Tutor
  useEffect(() => {
    if (!isTutor) return;

    const pollWaitingRoom = async () => {
      try {
        const res = await fetch(`/api/livekit/waiting-room?roomSlug=${encodeURIComponent(roomName)}`);
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (data.waitingList) {
            setWaitingQueue(data.waitingList);
            if (data.waitingList.length > 0) {
              setShowWaitingRoomModal(true);
            }
          }
        }
      } catch (e) {
        console.warn('Waiting room poll error:', e);
      }
    };

    pollWaitingRoom();
    const interval = setInterval(pollWaitingRoom, 8000);
    return () => clearInterval(interval);
  }, [isTutor, roomName]);

  // Connect to LiveKit Room (Stable lifecycle - never disconnects on mute/unmute or device switch)
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
            { id: 'student_01', name: isTutor ? 'Ahmad Student' : 'Ustadh Bilal', role: isTutor ? 'Student' : 'Tutor', isSpeaking: false, isMuted: false, hasAudioTrack: true, hasVideoTrack: false, isScreenSharing: false, audioLevel: 0 }
          ]);
          return;
        }

        const room = createOptimizedLiveKitRoom(enableAutoGain);
        roomRef.current = room;

        room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
          if (isCancelled) return;
          setConnectionStatus(state);
        });

        room.on(RoomEvent.Connected, () => {
          if (isCancelled) return;
          setConnectionStatus(ConnectionState.Connected);
          playStudioConnectionChime('connect');
          room.startAudio().catch(() => {});
          syncParticipantsState(room);
        });

        room.on(RoomEvent.ParticipantConnected, () => {
          if (isCancelled) return;
          playStudioConnectionChime('peer_join');
          syncParticipantsState(room);
        });

        room.on(RoomEvent.ParticipantDisconnected, () => {
          if (isCancelled) return;
          syncParticipantsState(room);
        });

        room.on(RoomEvent.ActiveSpeakersChanged, () => {
          if (isCancelled) return;
          syncParticipantsState(room);
        });

        room.on(RoomEvent.TrackMuted, () => {
          if (isCancelled) return;
          syncParticipantsState(room);
        });

        room.on(RoomEvent.TrackUnmuted, () => {
          if (isCancelled) return;
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
          if (track.kind === Track.Kind.Audio) {
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
              setChatMessages(prev => [...prev, {
                id: `msg_${Date.now()}`,
                sender: msgObj.sender || participant?.name || 'Peer',
                role: msgObj.role || 'Participant',
                text: msgObj.text,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }]);
              setUnreadChatCount(prev => prev + 1);
            }
          } catch (e) {
            console.warn('Data channel parse notice:', e);
          }
        });

        await room.connect(tokenData.serverUrl, tokenData.token, {
          autoSubscribe: true,
        });

        // Start audio playback immediately upon connection
        room.startAudio().catch(() => {
          if (!room.canPlaybackAudio) {
            setAudioPlaybackBlocked(true);
          }
        });

        // Publish local microphone with Studio Voice Filter (unless hidden observer)
        let isHiddenObserver = false;
        try {
          if (room.localParticipant.metadata) {
            const meta = JSON.parse(room.localParticipant.metadata);
            isHiddenObserver = Boolean(meta.hidden);
          }
        } catch {}

        if (!isHiddenObserver) {
          await publishCleanMicrophoneTrack(room, selectedAudioInput || undefined, studioNoiseFilter, enableAutoGain);
        }

        syncParticipantsState(room);

        // Send initial presence heartbeat
        fetch('/api/livekit/rooms/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName,
            identity: tokenData.participantIdentity || participantName,
            name: participantName,
            role: userRole
          })
        })
          .then(r => {
            const ct = r.headers.get('content-type') || '';
            return r.ok && ct.includes('application/json') ? r.json() : null;
          })
          .then(data => {
            if (!isCancelled && isTutor && data?.waitingList) {
              setWaitingQueue(data.waitingList);
              if (data.waitingList.length > 0) setShowWaitingRoomModal(true);
            }
          })
          .catch(() => {});

      } catch (err: any) {
        if (!isCancelled) {
          console.warn('[LiveKit Connect Notice]:', err);
          setConnectionStatus(ConnectionState.Connected);
        }
      }
    }

    initClassroom();

    // Periodic Presence Heartbeat every 10 seconds
    const heartbeatInterval = setInterval(() => {
      fetch('/api/livekit/rooms/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          identity: tokenData.participantIdentity || participantName,
          name: participantName,
          role: userRole
        })
      })
        .then(r => {
          const ct = r.headers.get('content-type') || '';
          return r.ok && ct.includes('application/json') ? r.json() : null;
        })
        .then(data => {
          if (!isCancelled && isTutor && data?.waitingList) {
            setWaitingQueue(data.waitingList);
            if (data.waitingList.length > 0) setShowWaitingRoomModal(true);
          }
        })
        .catch(() => {});
    }, 10000);

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

      // Send leave notification
      fetch('/api/livekit/rooms/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          identity: tokenData.participantIdentity || participantName
        })
      }).catch(() => {});

      if (roomRef.current) {
        try { roomRef.current.disconnect(); } catch {}
      }
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        try { pipWindowRef.current.close(); } catch {}
      }
    };
  }, [tokenData.token, tokenData.serverUrl, tokenData.isMockSession, roomName]);

  // Open Always-On-Top Floating Mini Control Bar (Stays visible on top of PDFs & other browser tabs!)
  const openFloatingControlBar = useCallback(async () => {
    try {
      const docPip = (window as any).documentPictureInPicture;
      if (!docPip || typeof docPip.requestWindow !== 'function') return;
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.focus();
        return;
      }

      const pipWin: Window = await docPip.requestWindow({
        width: 500,
        height: isChatOpen ? 340 : 66,
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
    } catch (e) {
      // Browser may not support Document PiP or lacked direct gesture
    }
  }, [isChatOpen]);

  // Resize Floating Mini Control Bar automatically when Chat is toggled open or closed
  useEffect(() => {
    if (!pipWindow || pipWindow.closed) return;
    try {
      pipWindow.resizeTo(500, isChatOpen ? 340 : 66);
    } catch {}
  }, [isChatOpen, pipWindow]);

  // Register Chrome automatic Picture-in-Picture handler when switching tabs
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        (navigator.mediaSession as any).setActionHandler('enterpictureinpicture', () => {
          openFloatingControlBar();
        });
      } catch {}
    }
  }, [openFloatingControlBar]);

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

  // Control 2: Share Screen (Optimized for Full HD Quran Mushaf with zero self-mirroring & automatic floating bar)
  const handleToggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
          await roomRef.current.localParticipant.setScreenShareEnabled(false);
        }
        if (screenShareVideoRef.current) {
          screenShareVideoRef.current.srcObject = null;
        }
        setIsScreenSharing(false);
      } else {
        if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
          await roomRef.current.localParticipant.setScreenShareEnabled(
            true,
            {
              // Keep system audio off by default so student voice playing on tutor speakers never echoes back into the room!
              audio: false,
              selfBrowserSurface: 'exclude',
              surfaceSwitching: 'include',
              systemAudio: 'exclude',
              contentHint: 'detail',
              resolution: {
                width: 1920,
                height: 1080,
                frameRate: 10,
              },
            } as any,
            {
              simulcast: true,
              degradationPreference: 'maintain-resolution',
              screenShareSimulcastLayers: [
                VideoPresets.h720,
              ],
              screenShareEncoding: {
                maxBitrate: 850_000,
                maxFramerate: 10,
                priority: 'medium',
              },
            }
          );
          setIsScreenSharing(true);
          openFloatingControlBar();
        } else if (navigator.mediaDevices?.getDisplayMedia) {
          await navigator.mediaDevices.getDisplayMedia({
            video: {
              displaySurface: 'window',
            } as any,
            audio: false,
            selfBrowserSurface: 'exclude',
            surfaceSwitching: 'include',
            systemAudio: 'exclude',
          } as any);
          setIsScreenSharing(true);
          openFloatingControlBar();
        }
      }
      if (roomRef.current) syncParticipantsState(roomRef.current);
    } catch (e) {
      console.warn('Screen share toggle notice:', e);
      setIsScreenSharing(false);
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

  // Send Live Room Chat Message
  const handleSendChatMessage = () => {
    if (!chatInputText.trim()) return;

    const newMsg: ChatMessageItem = {
      id: `msg_${Date.now()}`,
      sender: participantName,
      role: isTutor ? 'Tutor' : 'Student',
      text: chatInputText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, newMsg]);
    setIsChatOpen(true);
    setIsSidebarOpen(true);

    if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
      const payload = new TextEncoder().encode(JSON.stringify({
        type: 'CHAT',
        sender: participantName,
        role: isTutor ? 'Tutor' : 'Student',
        text: chatInputText.trim()
      }));
      roomRef.current.localParticipant.publishData(payload, { reliable: true });
    }

    setChatInputText('');
  };

  // Toggle Chat open / closed when clicking Chat button at bottom
  const handleToggleChatInSidebar = () => {
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

  // Tutor Admit / Reject Intercept Actions
  const handleWaitingRoomAction = async (waitingId: string, action: 'ADMIT' | 'REJECT') => {
    try {
      await fetch('/api/livekit/waiting-room/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waitingId, action })
      });
      setWaitingQueue(prev => prev.filter(w => w.id !== waitingId));
      if (waitingQueue.length <= 1) {
        setShowWaitingRoomModal(false);
      }
    } catch (e) {
      console.warn('Waiting room action error:', e);
    }
  };

  // Only render the full-screen <video> element when viewing a REMOTE participant's screen share.
  // When the local user is the one sharing their screen (isScreenSharing === true), we keep the browser tab
  // calm and static so it never creates recursive "Hall of Mirrors" nested screen views!
  const isViewingRemoteScreenShare = Boolean(activeScreenShareParticipant && !isScreenSharing);
  const hasActiveStudentCamera = Boolean(isCameraActive || activeCameraParticipant);

  return (
    <div
      ref={stageContainerRef}
      className={`relative flex flex-col h-full min-h-[600px] rounded-2xl overflow-hidden border shadow-[0_25px_70px_rgba(0,0,0,0.85)] transition-colors duration-200 ${
        isLight
          ? 'bg-[#F6F4EE] text-[#14231B] border-[#D5CFC2]'
          : 'bg-[#050806] text-[#F8FAFC] border-[#1F3A2C]'
      } ${className}`}
    >
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
            Initializing Studio Voice Isolation & Low-Latency HD Stream
          </p>
        </div>
      )}

      {/* Browser Autoplay Audio Unlocker Banner if needed */}
      {audioPlaybackBlocked && (
        <div className="bg-amber-500 text-slate-950 px-4 py-1.5 text-xs font-bold flex items-center justify-between z-30 shrink-0">
          <span className="flex items-center space-x-1.5">
            <Volume2 className="w-4 h-4" />
            <span>Your browser paused classroom speaker audio. Click to enable live voice playback:</span>
          </span>
          <button
            type="button"
            onClick={() => {
              roomRef.current?.startAudio().then(() => setAudioPlaybackBlocked(false)).catch(() => setAudioPlaybackBlocked(false));
            }}
            className="px-3 py-1 bg-slate-950 text-white rounded-lg text-xs font-bold cursor-pointer"
          >
            Enable Classroom Audio
          </button>
        </div>
      )}

      {/* ULTRA-SLIM TOP HEADER BAR (Maximizes vertical space for Quran Screen Share) */}
      <header
        className={`px-3.5 py-2 border-b flex items-center justify-between gap-2 z-20 shrink-0 ${
          isLight
            ? 'bg-white border-[#DFDBD0] text-[#14231B]'
            : 'bg-[#0B130E] border-[#223D2E] text-white'
        }`}
      >
        {/* Left: Simple & Clean Islamic Tuition Classroom Brand */}
        <div className="flex items-center space-x-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
              isLight
                ? 'bg-[#E8F5EE] border-[#B8DFC8] text-[#1E5C3D]'
                : 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300 shadow-xs'
            }`}
          >
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h2 className="text-xs sm:text-sm font-extrabold tracking-tight truncate">
                Islamic Tuition Classroom
              </h2>
              <span
                className={`hidden sm:inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  connectionStatus === ConnectionState.Connected
                    ? isLight
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                      : 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                    : 'bg-amber-500/20 border border-amber-400/40 text-amber-300'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus === ConnectionState.Connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span>{connectionStatus === ConnectionState.Connected ? 'Live HD' : 'Connecting'}</span>
              </span>
            </div>
            <p className={`text-[10px] font-mono truncate ${isLight ? 'text-[#4A5B51]' : 'text-[#B2C9BC]'}`}>
              Room: {roomName} · {userRole.toUpperCase()}
            </p>
          </div>
        </div>

        {/* Right: Timer, Light/Dark Toggle, Settings Button & Sidebar Toggle */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* Recording Indicator */}
          {isEgressRecordingActive && settings?.recordingEnabled && (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[11px] font-bold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>REC</span>
            </div>
          )}

          {/* Chronometer */}
          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-bold ${
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
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center space-x-1 cursor-pointer transition-colors ${
              isLight
                ? 'bg-[#FAF9F5] hover:bg-gray-100 border-[#D5D0C6] text-[#14231B]'
                : 'bg-[#121F17] hover:bg-[#1A2D22] border-[#274635] text-amber-300'
            }`}
            title={isLight ? 'Switch Classroom to Dark Mode' : 'Switch Classroom to Light Mode'}
          >
            {isLight ? (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-700" />
                <span className="hidden sm:inline">Dark</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Light</span>
              </>
            )}
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => setShowDeviceSettingsModal(true)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-colors ${
              isLight
                ? 'bg-[#FAF9F5] hover:bg-emerald-50 border-[#D5D0C6] text-[#1E5C3D]'
                : 'bg-[#121F17] hover:bg-[#1A2D22] border-[#274635] text-emerald-300'
            }`}
            title="Audio, Microphone & Speaker Settings"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Toggle Compact Right Sidebar */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(prev => !prev)}
            className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
              isLight
                ? 'bg-[#FAF9F5] hover:bg-gray-100 border-[#D5D0C6] text-[#14231B]'
                : 'bg-[#121F17] hover:bg-[#1A2D22] border-[#274635] text-white'
            }`}
            title={isSidebarOpen ? 'Hide Sidebar (Maximize Quran Screen)' : 'Show Participants & Chat Sidebar'}
          >
            {isSidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* MAIN WORKSPACE: PRIMARY QURAN SCREEN-SHARE STAGE (LEFT/CENTER) + COMPACT SIDEBAR (RIGHT) */}
      <div className="relative flex-1 flex overflow-hidden min-h-0">
        {/* PRIMARY CENTER STAGE: Dedicated to Quran Screen Share */}
        <main
          className={`flex-1 flex flex-col min-w-0 min-h-0 p-1.5 sm:p-2.5 overflow-hidden ${
            isLight ? 'bg-[#ECE9DF]' : 'bg-[#040705]'
          }`}
        >
          {isViewingRemoteScreenShare ? (
            /* FULL-HEIGHT, FULL-WIDTH QURAN LESSON SCREEN SHARE (FOR STUDENT / VIEWER) */
            <div
              className={`relative flex-1 w-full h-full rounded-xl overflow-hidden border flex flex-col shadow-lg ${
                isLight ? 'bg-[#111613] border-[#C9C3B6]' : 'bg-black border-emerald-500/50'
              }`}
            >
              {/* Ultra-compact floating top overlay bar on screen share */}
              <div className="absolute top-2 left-2 right-2 flex items-center justify-between px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-xs text-white text-[11px] font-semibold z-10 pointer-events-auto border border-white/10">
                <span className="flex items-center space-x-1.5 truncate">
                  <Monitor className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">
                    {`Quran / Lesson Screen Shared by ${activeScreenShareParticipant}`}
                  </span>
                </span>
                <div className="flex items-center space-x-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleToggleStageFullscreen}
                    className="px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 text-white flex items-center space-x-1 cursor-pointer text-[10px]"
                    title="Toggle Fullscreen Quran View (Bottom Controls Stay Visible)"
                  >
                    {isStageFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                    <span>{isStageFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
                  </button>
                </div>
              </div>

              <video
                ref={screenShareVideoRef}
                autoPlay
                playsInline
                className="w-full h-full flex-1 object-contain"
              />
            </div>
          ) : (
            /* CLEAN STATIC QURAN CLASSROOM STAGE (Eliminates recursive mirror views when Tutor is in browser tab!) */
            <div
              className={`flex-1 w-full h-full rounded-xl border flex flex-col items-center justify-center p-6 text-center transition-colors ${
                isLight
                  ? 'bg-white border-[#DFDBD0] shadow-xs'
                  : 'bg-gradient-to-b from-[#0D1812] to-[#08100C] border-[#233F2F] shadow-inner'
              }`}
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 border ${
                  isScreenSharing
                    ? 'bg-blue-500/20 border-blue-400/50 text-blue-300 shadow-md'
                    : isLight
                      ? 'bg-[#E8F5EE] border-[#B8DFC8] text-[#1E5C3D]'
                      : 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300 shadow-md'
                }`}
              >
                {isScreenSharing ? <Monitor className="w-7 h-7" /> : <BookOpen className="w-7 h-7" />}
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

              {/* Compact Live Voice Activity Visualizer */}
              <div className="flex items-center justify-center space-x-1 h-10 my-4">
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
                    <span>{isScreenSharing ? 'Stop Screen Share' : 'Share Quran / Lesson Screen Now'}</span>
                  </button>

                  {typeof window !== 'undefined' && 'documentPictureInPicture' in window && (
                    <button
                      type="button"
                      onClick={openFloatingControlBar}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 border cursor-pointer transition-all ${
                        isLight
                          ? 'bg-[#FAF9F5] hover:bg-emerald-50 border-[#D5D0C6] text-[#1E5C3D]'
                          : 'bg-[#15241B] hover:bg-[#1E3327] border-[#2B4B39] text-emerald-300'
                      }`}
                      title="Open compact floating control bar that stays visible on top of PDFs and other browser tabs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{pipWindow ? 'Floating Controls Active' : 'Floating Controls for PDF / Tabs'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </main>

        {/* COMPACT RIGHT SIDEBAR: Small Participants Strip + Compact Student Video + Toggleable Chat */}
        {isSidebarOpen && (
          <aside
            className={`${
              isChatOpen || hasActiveStudentCamera ? 'w-64 sm:w-72' : 'w-52 sm:w-60'
            } shrink-0 flex flex-col border-l z-20 transition-all duration-150 ${
              isLight
                ? 'bg-white border-[#DFDBD0] text-[#14231B]'
                : 'bg-[#09100C] border-[#223D2E] text-white'
            }`}
          >
            {/* 1. COMPACT PARTICIPANTS SECTION (Top of Sidebar) */}
            <div className={`p-2.5 ${isChatOpen || hasActiveStudentCamera ? 'border-b' : ''} ${isLight ? 'border-[#E8E4DA] bg-[#FAF9F5]' : 'border-[#223D2E] bg-[#0D1712]'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1 ${isLight ? 'text-[#4A5B51]' : 'text-[#B2C9BC]'}`}>
                  <Users className="w-3 h-3 text-emerald-400" />
                  <span>In Class ({activeVisibleParticipantsCount})</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-400">
                  Studio HD
                </span>
              </div>

              <div className="space-y-1.5 max-h-40 overflow-y-auto">
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
                      <div className="font-bold truncate text-[11px] leading-tight">{p.name}</div>
                      <div className={`text-[9px] uppercase font-bold tracking-wider ${isLight ? 'text-[#5A6B61]' : 'text-[#A8C2B3]'}`}>
                        {p.role} {p.isScreenSharing ? '· Sharing' : ''}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
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
            </div>

            {/* 2. COMPACT STUDENT CAMERA BOX INSIDE SIDEBAR (Only shown when Student turns on camera) */}
            {hasActiveStudentCamera && (
              <div className={`p-2.5 ${isChatOpen ? 'border-b' : ''} ${isLight ? 'border-[#E8E4DA] bg-[#FAF9F5]' : 'border-[#223D2E] bg-[#0D1712]'}`}>
                <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                  <span className="flex items-center space-x-1 text-emerald-400">
                    <Camera className="w-3 h-3" />
                    <span className="truncate">
                      {isCameraActive ? 'Your Camera (480p)' : `${activeCameraParticipant} Camera`}
                    </span>
                  </span>
                </div>
                <div className="w-full h-32 bg-black rounded-lg overflow-hidden border border-emerald-500/50 shadow-xs">
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

            {/* 3. LIVE CLASSROOM CHAT SECTION INSIDE SIDEBAR (Closed by default; only opens when user clicks Chat!) */}
            {isChatOpen && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div
                  className={`px-3 py-1.5 border-b flex items-center justify-between text-[11px] font-bold ${
                    isLight ? 'border-[#E8E4DA] text-[#14231B]' : 'border-[#223D2E] text-white'
                  }`}
                >
                  <span className="flex items-center space-x-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Classroom Chat</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsChatOpen(false)}
                    className={`p-0.5 rounded hover:bg-white/10 cursor-pointer ${isLight ? 'text-[#5A6B61]' : 'text-[#A8C2B3]'}`}
                    title="Close Chat"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                  {chatMessages.length === 0 ? (
                    <div className={`text-center py-8 text-[11px] ${isLight ? 'text-[#7A8A80]' : 'text-[#9BB5A6]'}`}>
                      Send a message or Surah/Ayah reference here during class.
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
                          <span className="font-bold text-emerald-400">{msg.sender}</span>
                          <span className={isLight ? 'text-[#7A8A80]' : 'text-[#9BB5A6]'}>{msg.timestamp}</span>
                        </div>
                        <p className="leading-snug break-words text-[11px]">{msg.text}</p>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className={`p-2 border-t flex items-center space-x-1.5 ${isLight ? 'border-[#E8E4DA] bg-[#FAF9F5]' : 'border-[#223D2E] bg-[#0D1712]'}`}>
                  <input
                    ref={chatInputRef}
                    type="text"
                    value={chatInputText}
                    onChange={e => setChatInputText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendChatMessage()}
                    placeholder="Write message..."
                    className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:border-emerald-500 ${
                      isLight
                        ? 'bg-white border-[#D5D0C6] text-[#14231B] placeholder-[#7A8A80]'
                        : 'bg-[#070C09] border-[#284736] text-white placeholder-[#8AA393]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleSendChatMessage}
                    className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition-colors shrink-0"
                    title="Send Chat Message"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ULTRA-SLIM BOTTOM CONTROLS BAR (Stays visible in Classroom & Fullscreen: Mute/Unmute, Share/Stop Screen, Chat Toggle, Leave) */}
      <footer
        className={`px-4 py-2 border-t flex flex-wrap items-center justify-center gap-2 sm:gap-3 z-20 shrink-0 ${
          isLight
            ? 'bg-white border-[#DFDBD0]'
            : 'bg-[#0B130E] border-[#223D2E]'
        }`}
      >
        {/* Button 1: Mute / Unmute Audio */}
        <button
          type="button"
          onClick={handleToggleAudio}
          className={`px-4 py-2 rounded-xl flex items-center space-x-1.5 text-xs font-bold transition-all cursor-pointer shadow-xs ${
            isAudioMuted
              ? 'bg-rose-600 hover:bg-rose-500 text-white'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
        >
          {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          <span>{isAudioMuted ? 'Unmute Mic' : 'Mute'}</span>
        </button>

        {/* Button 2: Share Screen / Stop Share (Tutor & Admin Only - Hidden for Students) */}
        {!isStudent && (
          <button
            type="button"
            onClick={handleToggleScreenShare}
            className={`px-4 py-2 rounded-xl flex items-center space-x-1.5 text-xs font-bold transition-all cursor-pointer shadow-xs border ${
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

        {/* Button 3: Student Camera Toggle (Allowed for Students at 480p in Sidebar, blocked for Tutors) */}
        {isStudent && (
          <button
            type="button"
            onClick={handleToggleCamera}
            className={`px-4 py-2 rounded-xl flex items-center space-x-1.5 text-xs font-bold transition-all cursor-pointer shadow-xs border ${
              isCameraActive
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                : isLight
                  ? 'bg-[#FAF9F5] hover:bg-gray-100 text-[#14231B] border-[#D5D0C6]'
                  : 'bg-[#15241B] hover:bg-[#1E3327] text-white border-[#2B4B39]'
            }`}
            title="Turn on or off your student camera (appears in compact sidebar)"
          >
            {isCameraActive ? <Camera className="w-4 h-4 text-white" /> : <CameraOff className="w-4 h-4 text-emerald-400" />}
            <span>{isCameraActive ? 'Turn Off Video' : 'Turn On Your Camera'}</span>
          </button>
        )}

        {/* Button 4: Chat Button (Toggles Chat Open / Closed on Click!) */}
        <button
          type="button"
          onClick={handleToggleChatInSidebar}
          className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center space-x-1.5 cursor-pointer transition-all shadow-xs relative ${
            isChatOpen
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
              : isLight
                ? 'bg-[#FAF9F5] hover:bg-emerald-50 text-[#14231B] border-[#D5D0C6]'
                : 'bg-[#15241B] hover:bg-[#1E3327] text-white border-[#2B4B39]'
          }`}
          title={isChatOpen ? 'Click to Close Classroom Chat' : 'Click to Open Classroom Chat'}
        >
          <MessageSquare className={`w-4 h-4 ${isChatOpen ? 'text-white' : 'text-emerald-400'}`} />
          <span>{isChatOpen ? 'Close Chat' : 'Chat'}</span>
          {!isChatOpen && unreadChatCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold animate-bounce">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* Button 5: Leave Room */}
        <button
          type="button"
          onClick={() => setShowLeaveConfirmModal(true)}
          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-all shadow-xs active:scale-95"
          title="Leave or End Class"
        >
          <PhoneOff className="w-4 h-4" />
          <span>{isTutor ? 'End / Leave' : 'Leave Class'}</span>
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
                Your compact 480p video will appear in the small right-hand sidebar so the Quran lesson screen stays full-size.
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

      {/* LEAVE ROOM CONFIRMATION MODAL */}
      {showLeaveConfirmModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div
            className={`border rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center ${
              isLight ? 'bg-white border-[#DFDBD0] text-[#14231B]' : 'bg-[#0F1B15] border-[#1D3327] text-white'
            }`}
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500">
              <PhoneOff className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold">Leave Quran Classroom</h3>
              <p className={`text-xs ${isLight ? 'text-[#5A6B61]' : 'text-[#8AA393]'}`}>
                {isTutor ? 'Choose whether to end class for everyone or just leave.' : 'Are you sure you want to leave the live class?'}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              {isTutor && (
                <button
                  type="button"
                  onClick={() => {
                    setShowLeaveConfirmModal(false);
                    onLeave();
                  }}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  End Class for Everyone
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowLeaveConfirmModal(false);
                  onLeave();
                }}
                className={`w-full py-2.5 ${isTutor ? 'bg-slate-800 hover:bg-slate-700' : 'bg-rose-600 hover:bg-rose-700'} text-white rounded-xl text-xs font-bold transition-colors cursor-pointer`}
              >
                Leave Class
              </button>

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
                    <span>Student Camera (Optional - 480p Sidebar)</span>
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
                    <span>5-Second Clean Voice Echo Test</span>
                  </span>
                  <span className={`text-[10px] font-mono ${isLight ? 'text-[#5A6B61]' : 'text-[#8AA393]'}`}>
                    Tests Noise Filter Live
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
                      <span>{micTestState === 'playing' ? 'Playing Filtered Voice...' : 'Play Back My Voice'}</span>
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

              {/* 4. End / Leave */}
              <button
                type="button"
                onClick={() => {
                  try { pipWindow.close(); } catch {}
                  onLeave();
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center space-x-1 cursor-pointer"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>{isTutor ? 'End' : 'Leave'}</span>
              </button>
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
