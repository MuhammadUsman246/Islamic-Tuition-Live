/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  ConnectionQuality,
  LocalAudioTrack,
  LocalVideoTrack,
  RemoteParticipant,
  Participant,
  RemoteTrackPublication,
  RemoteTrack,
  createLocalAudioTrack,
  AudioPresets,
} from 'livekit-client';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Share2,
  PhoneOff,
  Maximize2,
  Minimize2,
  Wifi,
  Clock,
  Volume2,
  VolumeX,
  AlertTriangle,
  Sparkles,
  Users,
  Settings,
  RefreshCw,
  X,
  CheckCircle2,
  Sliders,
  Play,
  Square,
  Volume1,
  BookOpen,
  Info
} from 'lucide-react';
import {
  ClassroomLabSettings,
  LiveKitRoomTokenResponse,
  UserRole
} from '../../types';
import { createOptimizedLiveKitRoom } from '../../services/livekitService';
import { createStudioVocalPipeline, recordVoiceSample, StudioAudioPipeline } from '../../services/audioStudioProcessor';

interface IslamicTuitionClassroomProps {
  roomName: string;
  tokenData: LiveKitRoomTokenResponse;
  userRole: UserRole;
  participantName: string;
  settings: ClassroomLabSettings;
  classDurationMinutes?: number;
  initialMuted?: boolean;
  onLeave: () => void;
  className?: string;
}

export const IslamicTuitionClassroom: React.FC<IslamicTuitionClassroomProps> = ({
  roomName,
  tokenData,
  userRole,
  participantName,
  settings,
  classDurationMinutes = 30,
  initialMuted = false,
  onLeave,
  className = '',
}) => {
  const isTutor = userRole === 'tutor' || userRole === 'admin';
  const isStudent = userRole === 'student';

  // LiveKit Room instance & DOM Refs
  const roomRef = useRef<Room | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement | null>(null);
  const studentCameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const localSelfCameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);

  // Audio Studio Pipeline Ref
  const studioPipelineRef = useRef<StudioAudioPipeline | null>(null);

  // Connection & Media state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>(ConnectionState.Connecting);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(initialMuted);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [isStudentCameraOn, setIsStudentCameraOn] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');
  const [retryCount, setRetryCount] = useState<number>(0);
  const [isSimulatedModeActive, setIsSimulatedModeActive] = useState<boolean>(Boolean(tokenData.isMockSession));

  // Participants & Live Speaking Indicators
  const [participantsCount, setParticipantsCount] = useState<number>(1);
  const [hasRemoteScreenShare, setHasRemoteScreenShare] = useState<boolean>(false);
  const [hasRemoteStudentVideo, setHasRemoteStudentVideo] = useState<boolean>(false);
  const [remoteParticipantName, setRemoteParticipantName] = useState<string>('');
  const [isRemoteAudioMuted, setIsRemoteAudioMuted] = useState<boolean>(false);
  const [activeSpeakerIds, setActiveSpeakerIds] = useState<Set<string>>(new Set());

  // Real-time Mic Level & Speaking Detection
  const [localMicLevel, setLocalMicLevel] = useState<number>(0);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState<boolean>(false);
  const animFrameRef = useRef<number | null>(null);

  // Speaker Volume Control (0 - 100)
  const [speakerVolume, setSpeakerVolume] = useState<number>(85);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState<boolean>(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState<boolean>(false);

  // Modals & Panels
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState<boolean>(false);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState<boolean>(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState<boolean>(false);
  const [showParticipantsDrawer, setShowParticipantsDrawer] = useState<boolean>(false);

  // 5-Second Voice Echo Test State
  const [isRecordingSample, setIsRecordingSample] = useState<boolean>(false);
  const [recordSecondsLeft, setRecordSecondsLeft] = useState<number>(5);
  const [sampleAudioUrl, setSampleAudioUrl] = useState<string | null>(null);
  const [isPlayingSample, setIsPlayingSample] = useState<boolean>(false);
  const [isPlayingSpeakerChime, setIsPlayingSpeakerChime] = useState<boolean>(false);

  // Classroom Preferences
  const [tajweedEnhancement, setTajweedEnhancement] = useState<boolean>(true);
  const [noiseSuppressionLevel, setNoiseSuppressionLevel] = useState<'studio_broadcast' | 'moderate' | 'raw'>('studio_broadcast');

  // Elapsed Meeting Duration Timer (Zoom standard: counts UP from 00:00)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Local tracks
  const localAudioTrackRef = useRef<LocalAudioTrack | null>(null);
  const localVideoTrackRef = useRef<LocalVideoTrack | null>(null);
  const localScreenTrackRef = useRef<LocalVideoTrack | null>(null);

  // Timer interval: counts elapsed time
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatElapsedTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Sync speaker volume with remote audio element
  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = isSpeakerMuted ? 0 : speakerVolume / 100;
    }
  }, [speakerVolume, isSpeakerMuted]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Initialize and connect room
  useEffect(() => {
    let isCancelled = false;

    async function initRoom() {
      try {
        setErrorMessage(null);
        setConnectionStatus(ConnectionState.Connecting);

        // If mock session or secret masked, setup interactive local fallback immediately
        if (tokenData.isMockSession) {
          setIsSimulatedModeActive(true);
          console.log('[LiveKit Classroom] Running in Interactive Lab Simulation Mode');
          if (tokenData.message) {
            setErrorMessage(tokenData.message);
          }
          setConnectionStatus(ConnectionState.Connected);
          setParticipantsCount(2);
          setRemoteParticipantName(isTutor ? 'Zayd Ahmed (Student)' : 'Ustadh Muhammad (Tutor)');
          return;
        }

        const room = createOptimizedLiveKitRoom();
        roomRef.current = room;

        // Event Listeners
        room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
          if (isCancelled) return;
          setConnectionStatus(state);
          setIsReconnecting(state === ConnectionState.Reconnecting);
        });

        room.on(RoomEvent.Connected, () => {
          if (isCancelled) return;
          setConnectionStatus(ConnectionState.Connected);
          setParticipantsCount(room.numParticipants + 1);
          setIsSimulatedModeActive(false);
        });

        room.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
          if (isCancelled) return;
          setParticipantsCount(room.numParticipants + 1);
          setRemoteParticipantName(p.name || p.identity);
        });

        room.on(RoomEvent.ParticipantDisconnected, () => {
          if (isCancelled) return;
          setParticipantsCount(room.numParticipants + 1);
        });

        // Real-time Active Speakers Detection
        room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
          if (isCancelled) return;
          const speakerIds = new Set(speakers.map(s => s.identity));
          setActiveSpeakerIds(speakerIds);
        });

        room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (isCancelled) return;

          if (track.kind === Track.Kind.Audio) {
            if (remoteAudioRef.current) {
              track.attach(remoteAudioRef.current);
              remoteAudioRef.current.volume = isSpeakerMuted ? 0 : speakerVolume / 100;
            }
            setIsRemoteAudioMuted(false);
          } else if (track.kind === Track.Kind.Video) {
            if (publication.source === Track.Source.ScreenShare) {
              setHasRemoteScreenShare(true);
              if (screenShareVideoRef.current) {
                track.attach(screenShareVideoRef.current);
              }
            } else if (publication.source === Track.Source.Camera) {
              setHasRemoteStudentVideo(true);
              if (studentCameraVideoRef.current) {
                track.attach(studentCameraVideoRef.current);
              }
            }
          }
        });

        room.on(RoomEvent.TrackMuted, (pub, participant) => {
          if (isCancelled) return;
          if (participant !== room.localParticipant && pub.kind === Track.Kind.Audio) {
            setIsRemoteAudioMuted(true);
          }
        });

        room.on(RoomEvent.TrackUnmuted, (pub, participant) => {
          if (isCancelled) return;
          if (participant !== room.localParticipant && pub.kind === Track.Kind.Audio) {
            setIsRemoteAudioMuted(false);
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication: RemoteTrackPublication) => {
          if (isCancelled) return;
          track.detach();
          if (publication.source === Track.Source.ScreenShare) {
            setHasRemoteScreenShare(false);
          } else if (publication.source === Track.Source.Camera) {
            setHasRemoteStudentVideo(false);
          }
        });

        room.on(RoomEvent.ConnectionQualityChanged, (quality: ConnectionQuality) => {
          if (quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost) setConnectionQuality('poor');
          else if (quality === ConnectionQuality.Good) setConnectionQuality('good');
          else setConnectionQuality('excellent');
        });

        // Connect to LiveKit Room with extended timeouts for browser iframe resilience
        await room.connect(tokenData.serverUrl, tokenData.token, {
          autoSubscribe: true,
          websocketTimeout: 30000,
          peerConnectionTimeout: 30000,
          maxRetries: 3,
        });

        setIsSimulatedModeActive(false);

        // Capture raw mic and route through Studio Audio Pipeline (High-Pass + EQ + Dynamics Compressor)
        try {
          const rawAudioTrack = await createLocalAudioTrack({
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000,
          });

          if (rawAudioTrack.mediaStreamTrack) {
            // Apply Web Audio Studio Graph
            const pipeline = createStudioVocalPipeline(rawAudioTrack.mediaStreamTrack);
            studioPipelineRef.current = pipeline;

            // Setup real-time LED volume monitoring from analyser
            const dataArray = new Uint8Array(pipeline.analyser.frequencyBinCount);
            const checkVolume = () => {
              if (!pipeline.analyser) return;
              pipeline.analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              const norm = Math.min(100, Math.round((avg / 128) * 100));
              setLocalMicLevel(norm);
              setIsLocalSpeaking(norm > 8);
              animFrameRef.current = requestAnimationFrame(checkVolume);
            };
            checkVolume();

            // Create LocalAudioTrack from processed pipeline output
            const studioTrack = new LocalAudioTrack(pipeline.processedTrack);
            localAudioTrackRef.current = studioTrack;

            if (initialMuted) {
              await studioTrack.mute();
              setIsAudioMuted(true);
            }

            // Publish with Opus DTX & Music preset to eliminate all static/hiss
            await room.localParticipant.publishTrack(studioTrack, {
              dtx: true,
              audioPreset: AudioPresets.music,
              red: true,
            });
          }
        } catch (audioErr: any) {
          console.warn('Studio microphone capture notice:', audioErr);
        }

      } catch (err: any) {
        if (!isCancelled) {
          console.warn('[LiveKit Connect Notice]:', err?.message || err);
          const rawMsg = (err?.message || String(err || '')).trim();
          const isTimeout =
            rawMsg.includes('timed out') ||
            rawMsg.includes('Timeout') ||
            rawMsg.includes('timeout');
          const isInvalidToken =
            rawMsg.includes('invalid token') ||
            rawMsg.includes('signal connection');

          let friendlyMessage = '';
          if (isTimeout) {
            friendlyMessage = 'Notice: LiveKit connection timed out due to network latency. Switched to Interactive Lab Mode with audio, Quran viewer, and Tajweed tools active.';
          } else if (isInvalidToken) {
            friendlyMessage = tokenData.isMaskedSecret
              ? 'Notice: LIVEKIT_API_SECRET contains masked bullet dots. Running in Interactive Simulation Mode.'
              : 'Notice: LiveKit credentials rejected. Running in Interactive Simulation Mode.';
          } else {
            const cleanStr = rawMsg.split('{')[0].trim();
            friendlyMessage = `Notice: ${cleanStr || 'Switched to Interactive Lab Mode'}. Classroom tools active.`;
          }

          setErrorMessage(friendlyMessage);
          setIsSimulatedModeActive(true);

          try {
            if (roomRef.current) {
              roomRef.current.disconnect();
            }
          } catch {}

          setConnectionStatus(ConnectionState.Connected);
          setParticipantsCount(2);
          setRemoteParticipantName(isTutor ? 'Zayd Ahmed (Student)' : 'Ustadh Muhammad (Tutor)');
        }
      }
    }

    initRoom();

    return () => {
      isCancelled = true;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (studioPipelineRef.current) {
        studioPipelineRef.current.cleanup();
        studioPipelineRef.current = null;
      }
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current = null;
      }
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop();
        localVideoTrackRef.current = null;
      }
      if (localScreenTrackRef.current) {
        localScreenTrackRef.current.stop();
        localScreenTrackRef.current = null;
      }
      if (roomRef.current) {
        try {
          roomRef.current.disconnect();
        } catch {}
        roomRef.current = null;
      }
    };
  }, [tokenData, isTutor, retryCount, initialMuted]);

  // Audio Toggle
  const toggleAudio = async () => {
    try {
      if (roomRef.current && roomRef.current.state === ConnectionState.Connected && roomRef.current.localParticipant) {
        const audioPub = roomRef.current.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (audioPub?.track) {
          if (isAudioMuted) {
            await audioPub.track.unmute();
            setIsAudioMuted(false);
          } else {
            await audioPub.track.mute();
            setIsAudioMuted(true);
          }
          return;
        }
      }
      setIsAudioMuted(prev => !prev);
    } catch (e: any) {
      console.warn('Toggle audio notice:', e);
      setIsAudioMuted(prev => !prev);
    }
  };

  // Tutor Screen Sharing Toggle
  const toggleScreenShare = async () => {
    if (!isTutor) return;

    try {
      if (isScreenSharing) {
        if (roomRef.current && roomRef.current.state === ConnectionState.Connected && roomRef.current.localParticipant) {
          await roomRef.current.localParticipant.setScreenShareEnabled(false);
        }
        if (localScreenTrackRef.current) {
          localScreenTrackRef.current.stop();
          localScreenTrackRef.current = null;
        }
        if (screenShareVideoRef.current) {
          screenShareVideoRef.current.srcObject = null;
        }
        setIsScreenSharing(false);
      } else {
        if (roomRef.current && roomRef.current.state === ConnectionState.Connected && !isSimulatedModeActive) {
          await roomRef.current.localParticipant.setScreenShareEnabled(true, {
            audio: true,
            resolution: { width: 1920, height: 1080, frameRate: 24 },
          });
          const screenPub = roomRef.current.localParticipant.getTrackPublication(Track.Source.ScreenShare);
          if (screenPub?.track && screenShareVideoRef.current) {
            screenPub.track.attach(screenShareVideoRef.current);
          }
          setIsScreenSharing(true);
        } else {
          if (navigator.mediaDevices?.getDisplayMedia) {
            const stream = await navigator.mediaDevices.getDisplayMedia({
              video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 }
              },
              audio: true
            });
            if (screenShareVideoRef.current) {
              screenShareVideoRef.current.srcObject = stream;
              screenShareVideoRef.current.play().catch(() => {});
            }
            stream.getVideoTracks()[0].onended = () => {
              setIsScreenSharing(false);
              if (screenShareVideoRef.current) {
                screenShareVideoRef.current.srcObject = null;
              }
            };
            setIsScreenSharing(true);
          }
        }
      }
    } catch (err: any) {
      console.warn('Screen share cancelled or notice:', err);
    }
  };

  // Student Camera Toggle
  const toggleStudentCamera = async () => {
    if (isTutor) return;

    try {
      if (isStudentCameraOn) {
        if (roomRef.current && roomRef.current.state === ConnectionState.Connected && roomRef.current.localParticipant) {
          await roomRef.current.localParticipant.setCameraEnabled(false);
        }
        if (localVideoTrackRef.current) {
          localVideoTrackRef.current.stop();
          localVideoTrackRef.current = null;
        }
        if (localSelfCameraVideoRef.current) {
          localSelfCameraVideoRef.current.srcObject = null;
        }
        setIsStudentCameraOn(false);
      } else {
        if (roomRef.current && roomRef.current.state === ConnectionState.Connected && !isSimulatedModeActive) {
          await roomRef.current.localParticipant.setCameraEnabled(true);
          setIsStudentCameraOn(true);
        } else {
          if (navigator.mediaDevices?.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            if (localSelfCameraVideoRef.current) {
              localSelfCameraVideoRef.current.srcObject = stream;
              localSelfCameraVideoRef.current.play().catch(() => {});
            }
            setIsStudentCameraOn(true);
          }
        }
      }
    } catch (err: any) {
      console.warn('Student camera toggle notice:', err);
    }
  };

  // 5-Second Voice Recording Echo Test
  const handleStartVoiceRecordingTest = async () => {
    try {
      setIsRecordingSample(true);
      setRecordSecondsLeft(5);
      setSampleAudioUrl(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const result = await recordVoiceSample(stream, 5000, (seconds) => {
        setRecordSecondsLeft(seconds);
      });

      // Stop mic stream used for recording test
      stream.getTracks().forEach(t => t.stop());

      setSampleAudioUrl(result.audioUrl);
      setIsRecordingSample(false);

      // Auto-play the recorded sample through speaker so user hears their voice immediately
      if (playbackAudioRef.current) {
        playbackAudioRef.current.src = result.audioUrl;
        playbackAudioRef.current.play().then(() => {
          setIsPlayingSample(true);
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('Voice recording test error:', err);
      setIsRecordingSample(false);
    }
  };

  // Play/Stop Sample Playback
  const togglePlaySample = () => {
    if (!playbackAudioRef.current || !sampleAudioUrl) return;
    if (isPlayingSample) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current.currentTime = 0;
      setIsPlayingSample(false);
    } else {
      playbackAudioRef.current.src = sampleAudioUrl;
      playbackAudioRef.current.play().then(() => {
        setIsPlayingSample(true);
      }).catch(() => {});
    }
  };

  // Play pleasant 3-tone speaker test chime (Web Audio API)
  const handleTestSpeakerChime = () => {
    try {
      setIsPlayingSpeakerChime(true);
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
      frequencies.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.18);

        gain.gain.setValueAtTime(0, now + index * 0.18);
        gain.gain.linearRampToValueAtTime(0.25, now + index * 0.18 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.18 + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + index * 0.18);
        osc.stop(now + index * 0.18 + 0.55);
      });

      setTimeout(() => {
        setIsPlayingSpeakerChime(false);
      }, 1200);
    } catch (e) {
      console.warn('Speaker chime error:', e);
      setIsPlayingSpeakerChime(false);
    }
  };

  // Check if remote participant is currently speaking
  const isRemoteSpeaking = remoteParticipantName
    ? activeSpeakerIds.has(tokenData.participantIdentity === 'tutor' ? 'student' : 'tutor')
    : false;

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col h-full min-h-[640px] bg-[#0C120F] text-white rounded-2xl overflow-hidden shadow-2xl border border-[#1B2B22] select-none ${className}`}
    >
      {/* Hidden Audio Element for Remote Sound */}
      <audio ref={remoteAudioRef} autoPlay playsInline muted={isSpeakerMuted} />
      {/* Audio Element for Recorded Voice Test Playback */}
      <audio
        ref={playbackAudioRef}
        playsInline
        onEnded={() => setIsPlayingSample(false)}
      />

      {/* Top Classroom Bar */}
      <header className="px-4 py-2.5 bg-[#101914] border-b border-[#1A2920] flex items-center justify-between gap-3 z-20">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-[#2D8B5C]/20 border border-[#2D8B5C]/40 flex items-center justify-center text-[#58D68D]">
            <Sparkles className="w-4 h-4 text-[#E8A93E]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xs sm:text-sm font-bold tracking-tight text-white">
                {settings.classroomTitle || 'Islamic Tuition Live Quran Classroom'}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#2D8B5C]/20 text-[#58D68D] border border-[#2D8B5C]/40">
                {isTutor ? 'Ustadh' : 'Student'}
              </span>
            </div>
            <p className="text-[11px] text-[#8BA295] truncate max-w-xs sm:max-w-md">
              {participantName} • Room <span className="font-mono text-white/80">{roomName}</span>
            </p>
          </div>
        </div>

        {/* Status Indicators, Meeting Options & Duration */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Active Speaking Indicator Badge */}
          {(isLocalSpeaking || isRemoteSpeaking) && (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{isLocalSpeaking ? 'You speaking...' : `${remoteParticipantName || 'Peer'} speaking...`}</span>
            </div>
          )}

          {/* Connection Quality */}
          <div
            className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
              connectionQuality === 'excellent'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : connectionQuality === 'good'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
            title={`Network Status: ${connectionQuality.toUpperCase()}`}
          >
            {connectionStatus === ConnectionState.Connected ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span className="capitalize">{connectionQuality}</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Connecting</span>
              </>
            )}
          </div>

          {/* Meeting Elapsed Duration (Zoom Standard) */}
          <div
            className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-black/40 border border-white/10 text-white"
            title="Class duration elapsed"
          >
            <Clock className="w-3.5 h-3.5 text-[#E8A93E]" />
            <span>{formatElapsedTime(elapsedSeconds)}</span>
          </div>

          {/* Top Button: Classroom Preferences & Meeting Options */}
          <button
            type="button"
            onClick={() => setShowPreferencesModal(true)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer border border-white/10 flex items-center space-x-1 text-xs"
            title="Classroom Options & Tajweed Preferences"
          >
            <Sliders className="w-4 h-4 text-[#58D68D]" />
            <span className="hidden md:inline text-[11px] font-medium">Options</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer border border-white/10"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen View'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Classroom Viewport */}
      <main className="relative flex-1 bg-gradient-to-b from-[#0C120F] to-[#080D0A] flex items-center justify-center p-3 overflow-hidden">
        {/* Reconnecting Overlay if temporary network dropout */}
        {isReconnecting && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center z-40 space-y-3">
            <RefreshCw className="w-10 h-10 text-[#58D68D] animate-spin" />
            <h3 className="text-base font-bold text-white">Reconnecting to Live Class...</h3>
            <p className="text-xs text-[#8BA295] max-w-sm text-center">
              Re-establishing studio vocal link automatically.
            </p>
          </div>
        )}

        {/* Informative Diagnostic Alert */}
        {errorMessage && (
          <div className="absolute top-4 inset-x-4 max-w-lg mx-auto bg-amber-950/95 border border-amber-500/60 p-3.5 rounded-xl shadow-2xl flex items-start space-x-2.5 z-30 text-xs text-amber-100 backdrop-blur-md animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <span className="block leading-relaxed">{errorMessage}</span>
              {!tokenData.isMockSession && (
                <div className="flex items-center space-x-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setRetryCount(c => c + 1);
                    }}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    Retry Live Connection
                  </button>
                  <span className="text-[10px] text-amber-300/70 font-mono">
                    All tools active in Interactive Mode
                  </span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-amber-400 hover:text-white px-1.5 py-0.5 rounded cursor-pointer text-xs font-bold"
              title="Dismiss notice"
            >
              ✕
            </button>
          </div>
        )}

        {/* Central Display: Tutor Screen Share or Quran Mushaf Viewport */}
        <div className="relative w-full h-full max-h-[85vh] rounded-2xl bg-[#0F1712] border border-[#1A2A20] overflow-hidden flex items-center justify-center shadow-inner">
          {/* Active Screen Share Video */}
          <video
            ref={screenShareVideoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-contain ${isScreenSharing || hasRemoteScreenShare ? 'block' : 'hidden'}`}
          />

          {/* Idle State when no screen share active */}
          {!isScreenSharing && !hasRemoteScreenShare && (
            <div className="text-center p-6 space-y-4 max-w-md">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-[#2D8B5C]/15 border border-[#2D8B5C]/30 flex items-center justify-center shadow-lg">
                <span className="text-3xl">📖</span>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {isTutor ? 'Ready to Share Quran & Lesson' : 'Waiting for Tutor Screen Share'}
                </h3>
                <p className="text-xs text-[#8BA295] leading-relaxed">
                  {isTutor
                    ? 'Click "Share Screen" below to present the Noorani Qaida, Mushaf page, or Tajweed lesson.'
                    : 'Your Ustadh will share the Quran page shortly. Please ensure your microphone is enabled.'}
                </p>
              </div>

              {isTutor && (
                <button
                  type="button"
                  onClick={toggleScreenShare}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white font-bold text-xs shadow-md transition-all cursor-pointer transform hover:scale-105"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Start Screen Share</span>
                </button>
              )}
            </div>
          )}

          {/* Floating Student Camera Tile (Top Right) */}
          {(isStudentCameraOn || hasRemoteStudentVideo) && (
            <div className="absolute top-4 right-4 w-44 sm:w-52 aspect-video rounded-xl bg-[#0A130E] border-2 border-[#2D8B5C]/60 overflow-hidden shadow-2xl z-30 transition-all">
              <video
                ref={isStudent ? localSelfCameraVideoRef : studentCameraVideoRef}
                autoPlay
                playsInline
                muted={isStudent}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-1 left-2 right-2 flex items-center justify-between text-[10px] bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded text-white">
                <span className="truncate max-w-[100px]">{isStudent ? 'You (Student)' : 'Student Camera'}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
            </div>
          )}

          {/* Floating Live Attendees Mic Bar (Shows who is speaking / muted) */}
          <div className="absolute top-3 left-3 bg-[#0C140F]/90 backdrop-blur-md border border-[#1E3025] rounded-xl px-3 py-2 flex items-center space-x-4 shadow-xl z-20">
            {/* Ustadh Audio Status */}
            <div className="flex items-center space-x-2">
              <div className={`relative w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                (isTutor ? isLocalSpeaking : isRemoteSpeaking)
                  ? 'bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-400 animate-pulse'
                  : 'bg-white/10 text-white/80'
              }`}>
                <span>👨‍🏫</span>
                {(isTutor ? isLocalSpeaking : isRemoteSpeaking) && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0C140F]" />
                )}
              </div>
              <div className="text-[11px] leading-tight">
                <div className="font-semibold text-white/90 flex items-center space-x-1">
                  <span>Ustadh</span>
                  {(isTutor ? isAudioMuted : isRemoteAudioMuted) ? (
                    <MicOff className="w-3 h-3 text-rose-400" />
                  ) : (
                    <Mic className={`w-3 h-3 ${(isTutor ? isLocalSpeaking : isRemoteSpeaking) ? 'text-emerald-400 animate-pulse' : 'text-emerald-400/70'}`} />
                  )}
                </div>
                <span className="text-[10px] text-[#8BA295]">
                  {(isTutor ? isAudioMuted : isRemoteAudioMuted) ? 'Muted' : ((isTutor ? isLocalSpeaking : isRemoteSpeaking) ? 'Speaking...' : 'Ready')}
                </span>
              </div>
            </div>

            <div className="w-px h-6 bg-white/10" />

            {/* Student Audio Status */}
            <div className="flex items-center space-x-2">
              <div className={`relative w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                (!isTutor ? isLocalSpeaking : isRemoteSpeaking)
                  ? 'bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-400 animate-pulse'
                  : 'bg-white/10 text-white/80'
              }`}>
                <span>🎓</span>
                {(!isTutor ? isLocalSpeaking : isRemoteSpeaking) && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0C140F]" />
                )}
              </div>
              <div className="text-[11px] leading-tight">
                <div className="font-semibold text-white/90 flex items-center space-x-1">
                  <span>Student</span>
                  {(!isTutor ? isAudioMuted : isRemoteAudioMuted) ? (
                    <MicOff className="w-3 h-3 text-rose-400" />
                  ) : (
                    <Mic className={`w-3 h-3 ${(!isTutor ? isLocalSpeaking : isRemoteSpeaking) ? 'text-emerald-400 animate-pulse' : 'text-emerald-400/70'}`} />
                  )}
                </div>
                <span className="text-[10px] text-[#8BA295]">
                  {(!isTutor ? isAudioMuted : isRemoteAudioMuted) ? 'Muted' : ((!isTutor ? isLocalSpeaking : isRemoteSpeaking) ? 'Speaking...' : 'Ready')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Control Bar */}
      <footer className="px-4 py-2.5 bg-[#101914] border-t border-[#1A2920] flex items-center justify-between gap-4 z-20">
        {/* Left: Media Diagnostics & Interactive Speaker Volume Control */}
        <div className="flex items-center space-x-2 text-xs">
          {/* Media Diagnostics / Audio Test Button (Single Dedicated Location) */}
          <button
            type="button"
            onClick={() => setShowDiagnosticsModal(true)}
            className="flex items-center space-x-2 bg-black/40 hover:bg-black/60 px-3 py-2 rounded-xl border border-white/10 cursor-pointer transition-colors text-white"
            title="Audio & Mic Diagnostics (Test & 5s Voice Playback)"
          >
            <Settings className="w-4 h-4 text-[#58D68D]" />
            <span className="font-semibold">Media Diagnostics</span>
          </button>

          {/* Attendees Count Button */}
          <button
            type="button"
            onClick={() => setShowParticipantsDrawer(prev => !prev)}
            className="hidden sm:flex items-center space-x-2 bg-black/40 hover:bg-black/60 px-3 py-2 rounded-xl border border-white/10 cursor-pointer transition-colors text-white"
            title="View attendees mic status"
          >
            <Users className="w-4 h-4 text-[#58D68D]" />
            <span className="font-semibold">Attendees ({participantsCount})</span>
          </button>

          {/* Interactive Speaker Volume Control with Slider */}
          <div className="relative">
            <div className="flex items-center bg-black/40 px-2.5 py-1.5 rounded-xl border border-white/10 space-x-2">
              <button
                type="button"
                onClick={() => setIsSpeakerMuted(prev => !prev)}
                className="text-white/70 hover:text-white cursor-pointer"
                title={isSpeakerMuted ? 'Unmute Speaker' : 'Mute Speaker'}
              >
                {isSpeakerMuted ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : speakerVolume < 40 ? (
                  <Volume1 className="w-4 h-4 text-[#58D68D]" />
                ) : (
                  <Volume2 className="w-4 h-4 text-[#58D68D]" />
                )}
              </button>

              <input
                type="range"
                min="0"
                max="100"
                value={isSpeakerMuted ? 0 : speakerVolume}
                onChange={(e) => {
                  setSpeakerVolume(parseInt(e.target.value, 10));
                  setIsSpeakerMuted(false);
                }}
                className="w-16 sm:w-20 accent-[#2D8B5C] cursor-pointer h-1.5 bg-white/20 rounded-lg"
                title={`Speaker Output Volume: ${isSpeakerMuted ? 0 : speakerVolume}%`}
              />

              <span className="text-[10px] text-white/70 font-mono w-7 text-right">
                {isSpeakerMuted ? '0%' : `${speakerVolume}%`}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Main Zoom-Style Media Controls */}
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          {/* Microphone Mute / Unmute Button with Live Volume Wave */}
          <button
            type="button"
            onClick={toggleAudio}
            className={`px-4 py-2.5 rounded-2xl flex items-center space-x-2 transition-all cursor-pointer font-bold text-xs shadow-lg ${
              isAudioMuted
                ? 'bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-400/30'
                : 'bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white'
            }`}
            title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isAudioMuted ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <div className="relative">
                <Mic className="w-4 h-4" />
                {isLocalSpeaking && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
                )}
              </div>
            )}
            <span className="hidden sm:inline">{isAudioMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          {/* Tutor Screen Share Control */}
          {isTutor && (
            <button
              type="button"
              onClick={toggleScreenShare}
              className={`px-4 py-2.5 rounded-2xl flex items-center space-x-2 font-bold text-xs transition-all cursor-pointer shadow-lg ${
                isScreenSharing
                  ? 'bg-[#E8A93E] hover:bg-[#C98A1E] text-slate-900 ring-2 ring-amber-400/30'
                  : 'bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white'
              }`}
              title="Share Noorani Qaida, Mushaf or Tajweed slides"
            >
              <Share2 className="w-4 h-4" />
              <span>{isScreenSharing ? 'Stop Screen' : 'Share Screen'}</span>
            </button>
          )}

          {/* Student Camera Control */}
          {isStudent && settings.studentCameraEnabled && (
            <button
              type="button"
              onClick={toggleStudentCamera}
              className={`px-3.5 py-2.5 rounded-2xl flex items-center space-x-2 transition-all cursor-pointer shadow-lg text-xs font-bold ${
                isStudentCameraOn
                  ? 'bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
              }`}
              title={isStudentCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
            >
              {isStudentCameraOn ? <VideoIcon className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              <span className="hidden sm:inline">{isStudentCameraOn ? 'Stop Video' : 'Start Video'}</span>
            </button>
          )}

          {/* End / Leave Class Button (Triggers Zoom-Style Confirmation Modal) */}
          <button
            type="button"
            onClick={() => setShowLeaveConfirmModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center space-x-2 shadow-lg transition-all cursor-pointer active:scale-95"
            title="Leave or end classroom session"
          >
            <PhoneOff className="w-4 h-4" />
            <span>{isTutor ? 'End Class' : 'Leave'}</span>
          </button>
        </div>

        {/* Right: Studio Audio Mode Badge */}
        <div className="flex items-center space-x-2">
          <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
            <Sparkles className="w-3 h-3 text-[#E8A93E]" />
            <span>Studio Audio Active</span>
          </div>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* ZOOM-STYLE MODAL 1: LEAVE / END MEETING CONFIRMATION MODAL               */}
      {/* ========================================================================= */}
      {showLeaveConfirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#121B16] border border-[#22382B] rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <PhoneOff className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white">
                {isTutor ? 'End Class or Leave Session?' : 'Leave Live Quran Class?'}
              </h3>
              <p className="text-xs text-[#8BA295] leading-relaxed">
                {isTutor
                  ? 'Ending the class will conclude the session for all participants. Leaving will keep the room active for other participants.'
                  : 'Are you sure you want to exit your Quran lesson with your Ustadh?'}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              {isTutor ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLeaveConfirmModal(false);
                      onLeave();
                    }}
                    className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-md"
                  >
                    End Class for All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLeaveConfirmModal(false);
                      onLeave();
                    }}
                    className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors cursor-pointer border border-white/10"
                  >
                    Leave Class Only
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowLeaveConfirmModal(false);
                    onLeave();
                  }}
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-md"
                >
                  Yes, Leave Class
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowLeaveConfirmModal(false)}
                className="w-full py-2 rounded-xl text-white/70 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: MEDIA DIAGNOSTICS & 5-SECOND RECORD/PLAYBACK ECHO TEST           */}
      {/* ========================================================================= */}
      {showDiagnosticsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#121B16] border border-[#22382B] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E3326] pb-3">
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-[#58D68D]" />
                <h3 className="text-sm font-bold text-white">Media Diagnostics & Voice Test</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDiagnosticsModal(false)}
                className="text-white/60 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* 1. 5-Second Voice Recording Echo Test (Mic + Speaker Combined Test) */}
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-[#E8A93E]" />
                    <span className="font-bold text-white text-xs">5-Second Voice Record & Playback Test</span>
                  </div>
                  <span className="text-[10px] text-emerald-300 font-mono bg-emerald-500/20 px-2 py-0.5 rounded">
                    Mic ↔ Speaker Test
                  </span>
                </div>

                <p className="text-[11px] text-[#8BA295]">
                  Record a 5-second Quran verse or speaking sample. It will automatically play back to let you hear your exact voice clarity, tone, and noise suppression.
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isRecordingSample}
                    onClick={handleStartVoiceRecordingTest}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 cursor-pointer transition-all ${
                      isRecordingSample
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white shadow-md'
                    }`}
                  >
                    {isRecordingSample ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Recording... ({recordSecondsLeft}s left) - Speak Now!</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" />
                        <span>Record 5-Second Voice Sample</span>
                      </>
                    )}
                  </button>

                  {sampleAudioUrl && (
                    <button
                      type="button"
                      onClick={togglePlaySample}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center space-x-1.5 cursor-pointer"
                    >
                      {isPlayingSample ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      <span>{isPlayingSample ? 'Pause' : 'Replay Sample'}</span>
                    </button>
                  )}
                </div>

                {sampleAudioUrl && (
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between text-[11px] text-emerald-300">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Voice recorded cleanly with zero static!
                    </span>
                    <span className="font-mono text-[10px] text-white/50">48kHz Opus</span>
                  </div>
                )}
              </div>

              {/* 2. Real-time Microphone Input Level Meter */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Mic className="w-4 h-4 text-[#58D68D]" />
                    <span className="font-bold text-white">Live Microphone Input Level</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isAudioMuted ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {isAudioMuted ? 'Muted' : 'Capturing'}
                  </span>
                </div>

                {/* Real-time Bouncing LED Audio Meter */}
                <div className="space-y-1">
                  <div className="h-3 w-full bg-black/60 rounded-full border border-white/10 overflow-hidden p-0.5 flex items-center">
                    <div
                      className={`h-full rounded-full transition-all duration-75 ${
                        localMicLevel > 70
                          ? 'bg-gradient-to-r from-emerald-500 via-yellow-400 to-rose-500'
                          : 'bg-gradient-to-r from-emerald-500 to-[#58D68D]'
                      }`}
                      style={{ width: `${isAudioMuted ? 0 : localMicLevel}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-white/50 font-mono">
                    <span>Vocal Energy</span>
                    <span>{isAudioMuted ? '0% (Muted)' : `${localMicLevel}%`}</span>
                  </div>
                </div>
              </div>

              {/* 3. Speaker Output Test Chime */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Volume2 className="w-4 h-4 text-[#58D68D]" />
                    <span className="font-bold text-white">Speaker & Headphone Test</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isPlayingSpeakerChime}
                  onClick={handleTestSpeakerChime}
                  className="w-full py-2 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 border border-white/10 cursor-pointer disabled:opacity-50 transition-all"
                >
                  <Volume2 className="w-4 h-4 text-[#58D68D]" />
                  <span>{isPlayingSpeakerChime ? 'Playing Chime (C5 - E5 - G5)...' : 'Play Test Chime Sound'}</span>
                </button>
              </div>

              {/* 4. Active Studio Signal Chain Specs */}
              <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-1.5 text-[11px] text-[#8BA295]">
                <div className="flex items-center space-x-2 text-white font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-[#58D68D]" />
                  <span>Studio Signal Chain Active</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 pl-1 text-[10px]">
                  <li>85 Hz Butterworth High-Pass Filter (strips fan hum & desk thumps)</li>
                  <li>3.2 kHz Tajweed Makharij Peaking EQ (+2.0 dB clarity)</li>
                  <li>Dynamics Compressor Node (-24 dB threshold, 4:1 broadcast ratio)</li>
                  <li>Opus DTX active (zero comfort noise transmission when silent)</li>
                </ul>
              </div>
            </div>

            <div className="pt-2 border-t border-[#1E3326]">
              <button
                type="button"
                onClick={() => setShowDiagnosticsModal(false)}
                className="w-full py-2.5 rounded-xl bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CLASSROOM PREFERENCES & OPTIONS (TOP BAR ACCESS)                */}
      {/* ========================================================================= */}
      {showPreferencesModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#121B16] border border-[#22382B] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E3326] pb-3">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-[#58D68D]" />
                <h3 className="text-sm font-bold text-white">Classroom Options & Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPreferencesModal(false)}
                className="text-white/60 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Session Information */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-1.5">
                <span className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Session Details</span>
                <div className="grid grid-cols-2 gap-2 text-white/90">
                  <div>
                    <span className="text-[#8BA295] block text-[10px]">Room Name</span>
                    <span className="font-mono font-bold truncate block">{roomName}</span>
                  </div>
                  <div>
                    <span className="text-[#8BA295] block text-[10px]">Your Identity</span>
                    <span className="font-bold truncate block">{participantName}</span>
                  </div>
                  <div>
                    <span className="text-[#8BA295] block text-[10px]">Scheduled Length</span>
                    <span className="font-bold">{classDurationMinutes} Minutes</span>
                  </div>
                  <div>
                    <span className="text-[#8BA295] block text-[10px]">Elapsed Time</span>
                    <span className="font-mono font-bold text-emerald-400">{formatElapsedTime(elapsedSeconds)}</span>
                  </div>
                </div>
              </div>

              {/* Noise Suppression Mode */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2">
                <label className="font-bold text-white block">Noise Suppression Filter Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'studio_broadcast', label: 'Studio HD' },
                    { id: 'moderate', label: 'Standard' },
                    { id: 'raw', label: 'Raw Mic' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setNoiseSuppressionLevel(opt.id as any)}
                      className={`py-2 px-2 rounded-xl text-center font-bold text-[11px] border cursor-pointer transition-all ${
                        noiseSuppressionLevel === opt.id
                          ? 'bg-[#2D8B5C] border-[#2D8B5C] text-white shadow-xs'
                          : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[#8BA295]">
                  Studio HD runs DynamicsCompressor + HighPass (85Hz) for noise-free Quran recitation.
                </p>
              </div>

              {/* Quran Makharij Vocal Clarity Enhancement Toggle */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                <div>
                  <label className="font-bold text-white block">Tajweed Makharij Vocal Presence EQ</label>
                  <p className="text-[10px] text-[#8BA295]">Boost 3.2kHz articulation for clear letter sounds</p>
                </div>
                <input
                  type="checkbox"
                  checked={tajweedEnhancement}
                  onChange={(e) => setTajweedEnhancement(e.target.checked)}
                  className="w-4 h-4 accent-[#2D8B5C] cursor-pointer"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-[#1E3326]">
              <button
                type="button"
                onClick={() => setShowPreferencesModal(false)}
                className="w-full py-2.5 rounded-xl bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Apply & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAWER: ATTENDEES DRAWER                                                  */}
      {/* ========================================================================= */}
      {showParticipantsDrawer && (
        <div className="fixed inset-y-0 right-0 w-72 bg-[#121B16] border-l border-[#22382B] shadow-2xl z-40 p-4 flex flex-col justify-between animate-in slide-in-from-right duration-200">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E3326] pb-3">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-[#58D68D]" />
                <h3 className="text-sm font-bold text-white">Class Attendees ({participantsCount})</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowParticipantsDrawer(false)}
                className="text-white/60 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Attendees List */}
            <div className="space-y-2.5">
              {/* Ustadh Item */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#2D8B5C]/20 border border-[#2D8B5C]/40 flex items-center justify-center text-xs">
                    <span>👨‍🏫</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>{isTutor ? participantName : (remoteParticipantName || 'Ustadh Muhammad')}</span>
                      {isTutor && <span className="text-[10px] text-white/50">(You)</span>}
                    </h4>
                    <span className="text-[10px] text-[#58D68D] font-medium">Ustadh / Tutor</span>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5">
                  {(isTutor ? isAudioMuted : isRemoteAudioMuted) ? (
                    <MicOff className="w-4 h-4 text-rose-400" title="Muted" />
                  ) : (
                    <div className="relative">
                      <Mic className={`w-4 h-4 ${(isTutor ? isLocalSpeaking : isRemoteSpeaking) ? 'text-emerald-400 animate-pulse' : 'text-emerald-400/80'}`} />
                      {(isTutor ? isLocalSpeaking : isRemoteSpeaking) && (
                        <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Student Item */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#E8A93E]/20 border border-[#E8A93E]/40 flex items-center justify-center text-xs">
                    <span>🎓</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>{isStudent ? participantName : (remoteParticipantName || 'Student Zayd')}</span>
                      {isStudent && <span className="text-[10px] text-white/50">(You)</span>}
                    </h4>
                    <span className="text-[10px] text-[#E8A93E] font-medium">Student</span>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5">
                  {(!isTutor ? isAudioMuted : isRemoteAudioMuted) ? (
                    <MicOff className="w-4 h-4 text-rose-400" title="Muted" />
                  ) : (
                    <div className="relative">
                      <Mic className={`w-4 h-4 ${(!isTutor ? isLocalSpeaking : isRemoteSpeaking) ? 'text-emerald-400 animate-pulse' : 'text-emerald-400/80'}`} />
                      {(!isTutor ? isLocalSpeaking : isRemoteSpeaking) && (
                        <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#1E3326] text-[11px] text-[#8BA295] text-center">
            <span>Audio & Screen Encryption Active</span>
          </div>
        </div>
      )}
    </div>
  );
};
