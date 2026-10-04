import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  ConnectionQuality,
  RemoteParticipant,
  Participant,
  RemoteTrackPublication,
  RemoteTrack,
  LocalAudioTrack,
  LocalVideoTrack,
  createLocalAudioTrack,
  createLocalVideoTrack,
  AudioPresets,
  VideoPresets
} from 'livekit-client';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  Radio,
  Lock,
  MessageSquare,
  Users,
  Settings,
  ShieldCheck,
  Clock,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Send,
  UserCheck,
  UserX,
  Sliders,
  Share2,
  Monitor,
  Camera,
  CameraOff,
  Play,
  Square,
  RotateCcw,
  AlertTriangle,
  Headphones,
  CheckCircle2,
  Info
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

  // LiveKit Room instance & DOM Refs
  const roomRef = useRef<Room | null>(null);
  const remoteAudioContainerRef = useRef<HTMLDivElement | null>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement | null>(null);
  const studentCameraVideoRef = useRef<HTMLVideoElement | null>(null);

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

  // Hardware Devices
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>('');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('');
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>('');
  const selectedAudioOutputRef = useRef<string>('');

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

  // Audio Visualizer waveform level (0 - 100)
  const [localAudioLevel, setLocalAudioLevel] = useState<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // Chronometer & Recording
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [isEgressRecordingActive, setIsEgressRecordingActive] = useState<boolean>(false);

  // Collapsible Drawer (Chat & Participants)
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'chat' | 'participants'>('chat');
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([]);
  const [chatInputText, setChatInputText] = useState<string>('');

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

    // Trigger chronometer & automated recording status when active visible count >= 2
    if (visibleList.length >= 2) {
      setIsTimerRunning(true);
      if (settings?.recordingEnabled) {
        setIsEgressRecordingActive(true);
      }
    }
  }, [participantName, userRole, settings?.recordingEnabled]);

  // Attach active Screen Share & Student Camera video tracks whenever video state or participants change
  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;

    // 1. Attach Screen Share Video Track (Remote or Local)
    if (screenShareVideoRef.current) {
      let screenTrack: Track | undefined;
      room.remoteParticipants.forEach((p) => {
        const pub = p.getTrackPublication(Track.Source.ScreenShare);
        if (pub?.track && !pub.isMuted) {
          screenTrack = pub.track;
        }
      });
      if (!screenTrack && room.localParticipant) {
        const localPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
        if (localPub?.track && !localPub.isMuted) {
          screenTrack = localPub.track;
        }
      }
      if (screenTrack) {
        screenTrack.attach(screenShareVideoRef.current);
      }
    }

    // 2. Attach Student Camera Video Track (Remote or Local)
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
  }, [isScreenSharing, activeScreenShareParticipant, isCameraActive, activeCameraParticipant, filteredParticipants]);

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

  // Poll Tutor Waiting Room Intercept Queue if user is Tutor
  useEffect(() => {
    if (!isTutor) return;

    const pollWaitingRoom = async () => {
      try {
        const res = await fetch(`/api/livekit/waiting-room?roomSlug=${encodeURIComponent(roomName)}`);
        if (res.ok) {
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
    let activeAudioCtx: AudioContext | null = null;

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

        const room = createOptimizedLiveKitRoom();
        roomRef.current = room;

        room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
          if (isCancelled) return;
          setConnectionStatus(state);
        });

        room.on(RoomEvent.Connected, () => {
          if (isCancelled) return;
          setConnectionStatus(ConnectionState.Connected);
          syncParticipantsState(room);
        });

        room.on(RoomEvent.ParticipantConnected, () => {
          if (isCancelled) return;
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
          if (track.kind === Track.Kind.Audio && remoteAudioContainerRef.current) {
            const audioEl = track.attach();
            audioEl.autoplay = true;
            if (selectedAudioOutputRef.current && (audioEl as any).setSinkId) {
              (audioEl as any).setSinkId(selectedAudioOutputRef.current).catch(() => {});
            }
            remoteAudioContainerRef.current.appendChild(audioEl);
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
            }
          } catch (e) {
            console.warn('Data channel parse notice:', e);
          }
        });

        await room.connect(tokenData.serverUrl, tokenData.token, {
          autoSubscribe: true,
        });

        if (!room.canPlaybackAudio) {
          setAudioPlaybackBlocked(true);
        }

        // Capture local microphone with high-definition noise cancellation
        try {
          const micTrack = await createLocalAudioTrack({
            deviceId: selectedAudioInput || undefined,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000,
            sampleSize: 16,
          });

          if (initialMuted) {
            await micTrack.mute();
            setIsAudioMuted(true);
            isAudioMutedRef.current = true;
          }

          await room.localParticipant.publishTrack(micTrack, {
            dtx: true, // Cuts background noise when participant is silent
            audioPreset: AudioPresets.speech,
            red: true, // Redundant Audio Data for zero packet loss
          });

          syncParticipantsState(room);

          // Measure local volume level for waveform (throttled to ~5Hz to prevent 60fps React re-render storm)
          const trackStream = new MediaStream([micTrack.mediaStreamTrack]);
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          const audioCtx = new AudioCtx();
          activeAudioCtx = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          const source = audioCtx.createMediaStreamSource(trackStream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          let lastWaveformUpdateMs = 0;
          let lastReportedLevel = -1;
          const updateWaveform = (nowMs: number) => {
            if (isCancelled) return;
            if (nowMs - lastWaveformUpdateMs >= 200) {
              lastWaveformUpdateMs = nowMs;
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
              const avg = sum / dataArray.length;
              const nextLevel = Math.min(100, Math.round((avg / 128) * 100));
              if (Math.abs(nextLevel - lastReportedLevel) >= 3 || (nextLevel === 0 && lastReportedLevel !== 0)) {
                lastReportedLevel = nextLevel;
                setLocalAudioLevel(nextLevel);
              }
            }
            animFrameRef.current = requestAnimationFrame(updateWaveform);
          };
          animFrameRef.current = requestAnimationFrame(updateWaveform);
        } catch (e) {
          console.warn('Mic auto-publish notice:', e);
        }

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
          .then(r => (r.ok ? r.json() : null))
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
          setActiveVisibleParticipantsCount(2);
          setIsTimerRunning(true);
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
        .then(r => (r.ok ? r.json() : null))
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
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (activeAudioCtx && activeAudioCtx.state !== 'closed') {
        activeAudioCtx.close().catch(() => {});
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
    };
  }, [tokenData.token, tokenData.serverUrl, tokenData.isMockSession, roomName]);

  // Switch active microphone device on the fly without disconnecting room
  const handleSelectAudioInput = async (deviceId: string) => {
    setSelectedAudioInput(deviceId);
    if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
      try {
        await roomRef.current.switchActiveDevice('audioinput', deviceId);
      } catch (e) {
        console.warn('Audio input switch notice:', e);
      }
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
          // If microphone was not yet published, publish it now
          await roomRef.current.localParticipant.setMicrophoneEnabled(isAudioMuted);
          const nextMuted = !isAudioMuted;
          setIsAudioMuted(nextMuted);
          isAudioMutedRef.current = nextMuted;
          syncParticipantsState(roomRef.current);
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

  // Control 2: Share Screen (With System Audio Shared Automatically)
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
              audio: true,
              selfBrowserSurface: 'include',
              contentHint: 'detail',
              resolution: {
                width: 1920,
                height: 1080,
                frameRate: 10,
              },
            },
            {
              simulcast: true,
              degradationPreference: 'balanced',
              screenShareSimulcastLayers: [
                VideoPresets.h720,
              ],
              screenShareEncoding: {
                maxBitrate: 800_000,
                maxFramerate: 10,
                priority: 'medium',
              },
            }
          );
          setIsScreenSharing(true);
        } else if (navigator.mediaDevices?.getDisplayMedia) {
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
          setIsScreenSharing(true);
          setTimeout(() => {
            if (screenShareVideoRef.current) {
              screenShareVideoRef.current.srcObject = stream;
            }
          }, 50);
        }
      }
      if (roomRef.current) syncParticipantsState(roomRef.current);
    } catch (e) {
      console.warn('Screen share toggle notice:', e);
      setIsScreenSharing(false);
    }
  };

  // Student Camera Toggle (Allowed for Students, Strictly Blocked for Tutors)
  const executeToggleCamera = async (enable: boolean) => {
    if (!isStudent) return; // Tutors do NOT have camera option (Islamic Tuition privacy)

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
      // Direct turn off
      executeToggleCamera(false);
    } else {
      // Require explicit confirmation to prevent accidental camera activation
      setShowCameraConfirmModal(true);
    }
  };

  // 5-Second Voice Recorder & Playback Loopback Test
  const handleStart5SecMicTest = async () => {
    try {
      setMicTestError(null);
      setMicTestState('recording');
      setTestCountdown(5);
      setRecordedAudioUrl(null);
      testAudioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedAudioInput ? { deviceId: { exact: selectedAudioInput } } : true
      });

      // Local test audio level analyser
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
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

      const mediaRecorder = new MediaRecorder(stream);
      testMediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          testAudioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (testAnimFrameRef.current) cancelAnimationFrame(testAnimFrameRef.current);
        stream.getTracks().forEach(t => t.stop());

        const audioBlob = new Blob(testAudioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(audioUrl);
        setMicTestState('recorded');
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

  return (
    <div className={`relative flex flex-col h-full min-h-[600px] bg-[#0A110D] text-white rounded-2xl overflow-hidden border border-[#18291F] shadow-2xl ${className}`}>
      {/* Dedicated Multi-Track Audio Container for Remote Participants & Screen Share Audio */}
      <div ref={remoteAudioContainerRef} className="hidden" />

      {/* Browser Autoplay Audio Unlocker Banner if needed */}
      {audioPlaybackBlocked && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between z-30">
          <span>Your browser paused classroom speaker audio. Click to enable live audio playback:</span>
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

      {/* TOP BAR & STATUS */}
      <header className="px-5 py-3 bg-[#0F1A14] border-b border-[#1A2E22] flex items-center justify-between gap-4 z-20">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-white tracking-tight">1-on-1 Virtual Classroom</h2>
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>Encrypted</span>
              </span>
            </div>
            <p className="text-xs text-[#8AA393] font-mono">
              Room: {roomName} • Role: {userRole.toUpperCase()}
            </p>
          </div>
        </div>

        {/* DATA METRICS */}
        <div className="flex items-center space-x-3">
          {/* Recording Indicator */}
          {isEgressRecordingActive && settings?.recordingEnabled && (
            <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>REC</span>
            </div>
          )}

          {/* Chronometer */}
          <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-black/40 border border-white/10 text-xs font-mono font-bold text-white">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>{formatChronometerTime(elapsedSeconds)}</span>
          </div>

          {/* Drawer Toggle */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(prev => !prev)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white cursor-pointer transition-colors relative"
            title="Open Chat & Attendees Drawer"
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            {chatMessages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-[10px] font-bold text-slate-950 flex items-center justify-center">
                {chatMessages.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* MAIN STAGE / WORKSPACE */}
      <div className="relative flex-1 flex overflow-hidden bg-gradient-to-b from-[#080E0B] to-[#0D1712]">
        <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 space-y-6 overflow-y-auto">
          
          {/* Active Screen Share Stage if Screen Share is Active */}
          {(isScreenSharing || activeScreenShareParticipant) ? (
            <div className="w-full max-w-4xl bg-black rounded-2xl border border-emerald-500/40 p-2 shadow-2xl space-y-2">
              <div className="flex items-center justify-between px-2 text-xs font-bold text-emerald-400">
                <span className="flex items-center space-x-1.5">
                  <Monitor className="w-4 h-4" />
                  <span>{isScreenSharing ? 'Your Screen Share (Quran / Lesson Material)' : `Screen Share from ${activeScreenShareParticipant}`}</span>
                </span>
                <span className="text-[10px] text-white/70 font-mono">Real-time WebRTC Stream</span>
              </div>
              <div className="relative aspect-video bg-black/80 rounded-xl overflow-hidden flex items-center justify-center">
                <video ref={screenShareVideoRef} autoPlay playsInline muted={isScreenSharing} className="w-full h-full object-contain" />
              </div>
            </div>
          ) : null}

          {/* AUDIO BRIDGE & PARTICIPANTS CONTAINER */}
          <div className="w-full max-w-2xl bg-[#0F1B15] border border-[#1D3327] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
            <div className="flex items-center justify-between text-xs text-emerald-400/80 uppercase tracking-widest font-mono border-b border-white/10 pb-3">
              <span className="flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Live Audio Studio Bridge</span>
              </span>
              <span className="text-[10px] text-white/60">
                {activeVisibleParticipantsCount} Active in Class
              </span>
            </div>

            {/* Fluid Audio Waveform Component driven natively by volume level */}
            <div className="flex items-center justify-center space-x-1.5 h-16 py-2">
              {[0.4, 0.7, 0.3, 0.9, 0.5, 1.0, 0.6, 0.8, 0.4, 0.9, 0.3, 0.7].map((heightFactor, i) => {
                const dynamicHeight = Math.max(10, Math.round((localAudioLevel / 100) * 56 * heightFactor));
                return (
                  <div
                    key={i}
                    className={`w-2.5 rounded-full transition-all duration-75 ${
                      !isAudioMuted && localAudioLevel > 10
                        ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-md shadow-emerald-500/20'
                        : 'bg-emerald-950 border border-emerald-800/40'
                    }`}
                    style={{ height: `${dynamicHeight}px` }}
                  />
                );
              })}
            </div>

            {/* Participants Cards with Live Mic Status, Mute Indicator & Volume Bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {filteredParticipants.map((p) => (
                <div
                  key={p.id}
                  className={`p-4 rounded-xl border transition-all text-left ${
                    p.isSpeaking && !p.isMuted
                      ? 'bg-emerald-500/15 border-emerald-500/60 ring-2 ring-emerald-500/30 shadow-lg'
                      : 'bg-black/30 border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#8AA393] uppercase tracking-wider">{p.role}</span>
                    
                    {/* Live Mic Status Indicator */}
                    <div className="flex items-center space-x-1.5">
                      {p.isMuted ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center space-x-1">
                          <MicOff className="w-3 h-3 text-rose-400" />
                          <span>Muted</span>
                        </span>
                      ) : !p.hasAudioTrack ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center space-x-1">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          <span>No Mic</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center space-x-1">
                          <Mic className={`w-3 h-3 ${p.isSpeaking ? 'text-emerald-400 animate-pulse' : 'text-emerald-300'}`} />
                          <span>{p.isSpeaking ? 'Speaking' : 'Live'}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-sm font-bold text-white truncate">{p.name}</div>
                  
                  {/* Status & Camera/Screen Indicators */}
                  <div className="flex items-center justify-between text-[11px] text-[#8AA393] font-mono mt-2 pt-2 border-t border-white/10">
                    <span>
                      {p.isMuted ? 'Microphone muted' : p.isSpeaking ? '● Voice active' : 'Connected'}
                    </span>
                    <div className="flex items-center space-x-1 text-[10px]">
                      {p.hasVideoTrack && <Camera className="w-3.5 h-3.5 text-emerald-400" title="Student Camera Active" />}
                      {p.isScreenSharing && <Monitor className="w-3.5 h-3.5 text-blue-400" title="Screen Sharing" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Student Camera Video Feed (Visible to Both Tutor & Student when Student Camera is Active) */}
            {(isCameraActive || activeCameraParticipant) && (
              <div className="pt-3 border-t border-white/10 text-left">
                <div className="text-xs font-bold text-emerald-400 mb-2 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    <span>{isCameraActive ? 'Your Student Camera Video' : `Student Camera (${activeCameraParticipant})`}</span>
                  </span>
                  <span className="text-[10px] text-white/60 font-mono">Live Video Stream</span>
                </div>
                <div className="w-48 h-36 bg-black rounded-xl overflow-hidden border border-emerald-500/40 shadow-lg">
                  <video ref={studentCameraVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                </div>
              </div>
            )}
          </div>
        </main>

        {/* COLLAPSIBLE DRAWER (Chat + Attendees List) */}
        {isDrawerOpen && (
          <aside className="w-80 bg-[#0C1510] border-l border-[#1A2E22] flex flex-col z-30 shadow-2xl animate-in slide-in-from-right">
            <div className="p-3 border-b border-[#1A2E22] flex items-center justify-between">
              <div className="flex items-center space-x-1 bg-black/40 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveDrawerTab('chat')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    activeDrawerTab === 'chat' ? 'bg-[#1E3628] text-white' : 'text-[#8AA393] hover:text-white'
                  }`}
                >
                  Chat
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDrawerTab('participants')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    activeDrawerTab === 'participants' ? 'bg-[#1E3628] text-white' : 'text-[#8AA393] hover:text-white'
                  }`}
                >
                  Participants ({activeVisibleParticipantsCount})
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="text-[#8AA393] hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeDrawerTab === 'chat' ? (
              <div className="flex-1 flex flex-col justify-between p-3 overflow-hidden">
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-10 text-xs text-[#8AA393]">
                      No messages yet in classroom chat.
                    </div>
                  ) : (
                    chatMessages.map(msg => (
                      <div key={msg.id} className="bg-black/30 border border-white/10 rounded-xl p-2.5 text-xs">
                        <div className="flex items-center justify-between text-[10px] text-[#8AA393] mb-1">
                          <span className="font-bold text-emerald-400">{msg.sender} ({msg.role})</span>
                          <span>{msg.timestamp}</span>
                        </div>
                        <p className="text-white/90 leading-relaxed">{msg.text}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center space-x-2">
                  <input
                    type="text"
                    value={chatInputText}
                    onChange={e => setChatInputText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendChatMessage()}
                    placeholder="Type message..."
                    className="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-[#8AA393] focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleSendChatMessage}
                    className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 p-3 overflow-y-auto space-y-2">
                {filteredParticipants.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/10 text-xs">
                    <div>
                      <div className="font-bold text-white">{p.name}</div>
                      <div className="text-[10px] text-emerald-400 flex items-center space-x-1">
                        <span>{p.role}</span>
                        {p.isScreenSharing && <span className="text-blue-400">• Screen Sharing</span>}
                      </div>
                    </div>
                    <div>
                      {p.isMuted ? (
                        <span className="text-rose-400 flex items-center text-[10px] font-bold"><MicOff className="w-3.5 h-3.5 mr-1" /> Muted</span>
                      ) : (
                        <span className="text-emerald-400 flex items-center text-[10px] font-bold"><Mic className="w-3.5 h-3.5 mr-1" /> Live</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* FOOTER CONTROLS PANEL */}
      <footer className="px-6 py-3.5 bg-[#0F1A14] border-t border-[#1A2E22] flex flex-wrap items-center justify-center gap-3 z-20">
        {/* Button 1: Mute / Unmute Audio */}
        <button
          type="button"
          onClick={handleToggleAudio}
          className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl flex items-center space-x-2 text-xs font-bold transition-all cursor-pointer shadow-lg ${
            isAudioMuted
              ? 'bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-400/30'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
        >
          {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          <span>{isAudioMuted ? 'Unmute' : 'Mute'}</span>
        </button>

        {/* Button 2: Share Screen (Tutor & Admin Only - Hidden for Students) */}
        {!isStudent && (
          <button
            type="button"
            onClick={handleToggleScreenShare}
            className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl flex items-center space-x-2 text-xs font-bold transition-all cursor-pointer shadow-lg ${
              isScreenSharing
                ? 'bg-blue-600 hover:bg-blue-500 text-white ring-2 ring-blue-400/30'
                : 'bg-[#1B2F23] hover:bg-[#253F2F] text-white border border-white/15'
            }`}
            title="Share Quran Mushaf or Screen with Audio"
          >
            <Monitor className="w-4 h-4 text-blue-400" />
            <span>{isScreenSharing ? 'Stop Screen' : 'Share Screen'}</span>
          </button>
        )}

        {/* Button 3: Student Camera Toggle (Allowed for Students with Confirmation, blocked for Tutors) */}
        {isStudent && (
          <button
            type="button"
            onClick={handleToggleCamera}
            className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl flex items-center space-x-2 text-xs font-bold transition-all cursor-pointer shadow-lg ${
              isCameraActive
                ? 'bg-emerald-700 hover:bg-emerald-600 text-white ring-2 ring-emerald-400/30'
                : 'bg-[#1B2F23] hover:bg-[#253F2F] text-white border border-white/15'
            }`}
            title="Open or close student video camera"
          >
            {isCameraActive ? <Camera className="w-4 h-4 text-emerald-400" /> : <CameraOff className="w-4 h-4 text-gray-400" />}
            <span>{isCameraActive ? 'Turn Off Video' : 'Turn On Your Camera'}</span>
          </button>
        )}

        {/* Button 4: Device Settings Matrix & 5-Sec Mic Test */}
        <button
          type="button"
          onClick={() => setShowDeviceSettingsModal(true)}
          className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl bg-[#1B2F23] hover:bg-[#253F2F] text-white text-xs font-bold border border-white/15 flex items-center space-x-2 cursor-pointer transition-all shadow-lg"
          title="Configure Microphone, Speaker and Test Voice"
        >
          <Settings className="w-4 h-4 text-emerald-400" />
          <span>Device Settings</span>
        </button>

        {/* Button 5: Leave Room (With Zoom-Style Confirmation) */}
        <button
          type="button"
          onClick={() => setShowLeaveConfirmModal(true)}
          className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center space-x-2 cursor-pointer transition-all shadow-lg active:scale-95"
          title="Leave or End Class"
        >
          <PhoneOff className="w-4 h-4" />
          <span>{isTutor ? 'End / Leave' : 'Leave Class'}</span>
        </button>
      </footer>

      {/* STUDENT CAMERA ACTIVATION CONFIRMATION MODAL */}
      {showCameraConfirmModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-[#0F1B15] border border-[#1D3327] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Camera className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Turn On Your Camera</h3>
              <p className="text-xs text-[#8AA393]">
                Are you sure you want to turn on your camera? Your video stream will be visible to your tutor during the lesson.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowCameraConfirmModal(false);
                  executeToggleCamera(true);
                }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-md"
              >
                Turn On Camera
              </button>

              <button
                type="button"
                onClick={() => setShowCameraConfirmModal(false)}
                className="w-full py-2 bg-transparent hover:bg-white/5 text-[#8AA393] hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Keep Camera Off
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ZOOM-STYLE LEAVE ROOM CONFIRMATION MODAL */}
      {showLeaveConfirmModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-[#0F1B15] border border-[#1D3327] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <PhoneOff className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Leave Classroom Session</h3>
              <p className="text-xs text-[#8AA393]">
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
                className="w-full py-2 bg-transparent hover:bg-white/5 text-[#8AA393] hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel / Stay in Class
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEVICE SETTINGS & 5-SEC MIC LOOPBACK TEST MODAL */}
      {showDeviceSettingsModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-[#0D1812] border border-[#1A2E22] rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>Audio & Video Device Settings</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  handleResetMicTest();
                  setShowDeviceSettingsModal(false);
                }}
                className="text-[#8AA393] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Device 1: Microphone */}
              <div className="space-y-1">
                <label className="block text-[#8AA393] font-bold flex items-center space-x-1.5">
                  <Mic className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Microphone Input Device</span>
                </label>
                <select
                  value={selectedAudioInput}
                  onChange={e => handleSelectAudioInput(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
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
                <label className="block text-[#8AA393] font-bold flex items-center space-x-1.5">
                  <Headphones className="w-3.5 h-3.5 text-blue-400" />
                  <span>Speaker / Headphones Output</span>
                </label>
                <select
                  value={selectedAudioOutput}
                  onChange={e => setSelectedAudioOutput(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
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
                  <label className="block text-[#8AA393] font-bold flex items-center space-x-1.5">
                    <Camera className="w-3.5 h-3.5 text-purple-400" />
                    <span>Student Camera (Optional)</span>
                  </label>
                  <select
                    value={selectedVideoInput}
                    onChange={e => handleSelectVideoInput(e.target.value)}
                    className="w-full bg-black/50 border border-white/15 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
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
              <div className="bg-black/40 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-300 flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#E8A93E]" />
                    <span>5-Second Voice Echo Test (Local & Private)</span>
                  </span>
                  <span className="text-[10px] text-[#8AA393] font-mono">0 server load</span>
                </div>

                <p className="text-[11px] text-[#8AA393]">
                  Speak for 5 seconds into your microphone, then listen to your own voice to verify crystal-clear sound quality before or during class.
                </p>

                {micTestError && (
                  <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px]">
                    {micTestError}
                  </div>
                )}

                {micTestState === 'idle' && (
                  <button
                    type="button"
                    onClick={handleStart5SecMicTest}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center space-x-2 transition-colors cursor-pointer shadow-md"
                  >
                    <Mic className="w-4 h-4" />
                    <span>Record 5-Second Voice Sample</span>
                  </button>
                )}

                {micTestState === 'recording' && (
                  <div className="space-y-2 text-center p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl">
                    <div className="flex items-center justify-center space-x-2 text-rose-300 font-bold">
                      <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                      <span>Recording... Speak now ({testCountdown}s remaining)</span>
                    </div>
                    {/* Live Test Volume Bar */}
                    <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-rose-500 transition-all duration-75"
                        style={{ width: `${Math.max(5, testAudioLevel)}%` }}
                      />
                    </div>
                  </div>
                )}

                {(micTestState === 'recorded' || micTestState === 'playing') && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={handlePlayBackTestVoice}
                        disabled={micTestState === 'playing'}
                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center space-x-2 cursor-pointer shadow-md transition-colors"
                      >
                        <Play className="w-4 h-4" />
                        <span>{micTestState === 'playing' ? 'Playing Your Voice...' : 'Play Back My Voice'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleResetMicTest}
                        className="px-3 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold flex items-center justify-center cursor-pointer transition-colors"
                        title="Record again"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-[10px] text-emerald-400 font-mono text-center">
                      ✓ Sample recorded in-memory. Audio is deleted when you close this window.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 text-right">
              <button
                type="button"
                onClick={() => {
                  handleResetMicTest();
                  setShowDeviceSettingsModal(false);
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TUTOR INTERCEPTS MODAL: PASSCODE WAITING ROOM ADMIT/REJECT TRIGGERS */}
      {showWaitingRoomModal && isTutor && waitingQueue.length > 0 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-[#0D1812] border border-amber-500/40 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Passcode Waiting Room Request</span>
              </h3>
              <button type="button" onClick={() => setShowWaitingRoomModal(false)} className="text-[#8AA393] hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {waitingQueue.map(w => (
                <div key={w.id} className="bg-black/40 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">{w.guest_name}</div>
                    <div className="text-[10px] text-[#8AA393]">Waiting for admittance</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleWaitingRoomAction(w.id, 'ADMIT')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer"
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
    </div>
  );
};
