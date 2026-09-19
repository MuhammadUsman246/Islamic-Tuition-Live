import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ShieldCheck,
  Maximize2,
  Minimize2,
  ScreenShare,
  ScreenShareOff,
  Radio,
  Sparkles
} from 'lucide-react';
import { ActiveCallSession, UserRole } from '../../types';
import {
  updateCallSession,
  endCallSession,
  subscribeToCallSession,
  addCallerIceCandidate,
  addReceiverIceCandidate,
  subscribeToCallerIceCandidates,
  subscribeToReceiverIceCandidates
} from '../../services/dataService';
import {
  startOutgoingRingtone,
  startIncomingRingtone,
  playCallConnectedTone,
  playCallEndTone,
  getCleanAudioConstraints,
  createCleanAudioStream
} from '../../utils/chatMediaUtils';

interface LiveCallModalProps {
  callSession: ActiveCallSession;
  currentUserId: string;
  currentUserRole: UserRole;
  currentUserName: string;
  onClose: () => void;
}

const RTC_PEER_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
  ]
};

export const LiveCallModal: React.FC<LiveCallModalProps> = ({
  callSession,
  currentUserId,
  currentUserRole,
  currentUserName,
  onClose
}) => {
  const [currentCall, setCurrentCall] = useState<ActiveCallSession>(callSession);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callSession.type === 'video');
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isWebRtcConnected, setIsWebRtcConnected] = useState(false);
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const cleanAudioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  const screenStreamRef = useRef<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const callTimerRef = useRef<any>(null);
  const stopRingtoneRef = useRef<(() => void) | null>(null);
  const unsubscribeCandidatesRef = useRef<(() => void) | null>(null);

  const isCaller = currentCall.callerId === currentUserId;
  const isIncoming = !isCaller && currentCall.status === 'calling';
  const otherPartyName = isCaller ? currentCall.receiverName : currentCall.callerName;
  const otherPartyRole = isCaller ? currentCall.receiverRole : currentCall.callerRole;

  // Initialize or get RTCPeerConnection
  const getOrCreatePeerConnection = () => {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    const pc = new RTCPeerConnection(RTC_PEER_CONFIG);
    peerConnectionRef.current = pc;

    // Handle remote track arriving (supports both unified plan and standard streams)
    pc.ontrack = (event) => {
      console.log('WebRTC remote track received:', event.track.kind, event.track.id);
      
      // 1. Direct track registration to prevent dropping tracks when streams array is empty
      if (event.track) {
        if (!remoteStreamRef.current.getTracks().some((t) => t.id === event.track.id)) {
          remoteStreamRef.current.addTrack(event.track);
        }
      }

      // 2. Stream tracks registration
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((track) => {
          if (!remoteStreamRef.current.getTracks().some((t) => t.id === track.id)) {
            remoteStreamRef.current.addTrack(track);
          }
        });
      }

      // 3. Attach and play remote audio element
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
        remoteAudioRef.current.play().then(() => {
          setAudioPlaybackBlocked(false);
        }).catch((e) => {
          console.warn('Audio play request notice:', e);
          setAudioPlaybackBlocked(true);
        });
      }

      // 4. Attach and play remote video element
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
        remoteVideoRef.current.play().catch(() => {});
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      console.log('WebRTC connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setIsWebRtcConnected(true);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.play().then(() => setAudioPlaybackBlocked(false)).catch(() => setAudioPlaybackBlocked(true));
        }
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setIsWebRtcConnected(false);
      }
    };

    return pc;
  };

  // 1. Live subscription to Firestore Call Session state
  useEffect(() => {
    const unsub = subscribeToCallSession(callSession.id, async (updated) => {
      if (!updated || updated.status === 'ended' || updated.status === 'rejected' || updated.status === 'missed') {
        playCallEndTone();
        cleanupMedia();
        onClose();
        return;
      }

      setCurrentCall(updated);

      // Caller handling answer from receiver
      if (isCaller && updated.answer && peerConnectionRef.current) {
        const pc = peerConnectionRef.current;
        if (!pc.currentRemoteDescription) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(updated.answer as RTCSessionDescriptionInit));
            console.log('Caller set remote description (answer) successfully');
          } catch (err) {
            console.warn('Error setting caller remote description:', err);
          }
        }
      }
    });

    return () => {
      unsub();
      cleanupMedia();
    };
  }, [callSession.id, isCaller]);

  // 2. Manage Audio Ringing Tones
  useEffect(() => {
    if (stopRingtoneRef.current) {
      stopRingtoneRef.current();
      stopRingtoneRef.current = null;
    }

    if (currentCall.status === 'calling' || currentCall.status === 'ringing') {
      if (isCaller) {
        stopRingtoneRef.current = startOutgoingRingtone();
      } else {
        stopRingtoneRef.current = startIncomingRingtone();
      }
    } else if (currentCall.status === 'connected') {
      playCallConnectedTone();
    }

    return () => {
      if (stopRingtoneRef.current) {
        stopRingtoneRef.current();
        stopRingtoneRef.current = null;
      }
    };
  }, [currentCall.status, isCaller]);

  // 3. Stopwatch Duration Timer when Connected
  useEffect(() => {
    if (currentCall.status === 'connected') {
      if (!callTimerRef.current) {
        callTimerRef.current = setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
      }
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    };
  }, [currentCall.status]);

  // 4. Initialize Local Media Stream & WebRTC Caller Offer Setup
  useEffect(() => {
    let active = true;

    async function initMedia() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          return;
        }

        const constraints: MediaStreamConstraints = {
          audio: getCleanAudioConstraints(),
          video: callSession.type === 'video'
        };

        const rawStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) {
          rawStream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = rawStream;

        // Apply Web Audio noise reduction and clarity filter
        const { cleanStream, audioContext } = createCleanAudioStream(rawStream);
        cleanAudioStreamRef.current = cleanStream;
        audioContextRef.current = audioContext;

        if (localVideoRef.current && callSession.type === 'video') {
          localVideoRef.current.srcObject = rawStream;
        }

        const pc = getOrCreatePeerConnection();

        // Always ensure a video transceiver is negotiated so screen share works immediately in both audio and video calls
        try {
          if (!pc.getTransceivers().some((t) => t.receiver.track?.kind === 'video')) {
            pc.addTransceiver('video', { direction: 'sendrecv' });
          }
        } catch (e) {
          console.warn('Video transceiver setup notice:', e);
        }

        // Add hardware-processed clean audio track directly
        rawStream.getAudioTracks().forEach((track) => {
          if (!pc.getSenders().some((s) => s.track?.id === track.id)) {
            pc.addTrack(track, rawStream);
          }
        });

        // Add video tracks if video call
        rawStream.getVideoTracks().forEach((track) => {
          if (!pc.getSenders().some((s) => s.track?.id === track.id)) {
            pc.addTrack(track, rawStream);
          }
        });

        // If caller and status is calling/ringing, generate offer
        if (isCaller) {
          pc.onicecandidate = (event) => {
            if (event.candidate) {
              addCallerIceCandidate(callSession.id, event.candidate.toJSON());
            }
          };

          // Listen for receiver candidates
          unsubscribeCandidatesRef.current = subscribeToReceiverIceCandidates(callSession.id, async (cand) => {
            if (peerConnectionRef.current && cand) {
              try {
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {
                console.warn('Error adding receiver ice candidate:', e);
              }
            }
          });

          // Create SDP Offer
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          await updateCallSession(callSession.id, {
            offer: { type: offer.type, sdp: offer.sdp },
            status: 'ringing'
          });
        }
      } catch (err: any) {
        console.warn('Live call media acquisition notice:', err);
        setMediaError('Microphone or Camera permission was blocked or device is in use.');
      }
    }

    initMedia();

    return () => {
      active = false;
    };
  }, [callSession.type, isCaller, callSession.id]);

  const cleanupMedia = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (cleanAudioStreamRef.current) {
      cleanAudioStreamRef.current.getTracks().forEach((t) => t.stop());
      cleanAudioStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (unsubscribeCandidatesRef.current) {
      unsubscribeCandidatesRef.current();
      unsubscribeCandidatesRef.current = null;
    }
    if (stopRingtoneRef.current) {
      stopRingtoneRef.current();
      stopRingtoneRef.current = null;
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  // Toggle Microphone Mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((prev) => !prev);
    } else {
      setIsMuted((prev) => !prev);
    }
  };

  // Toggle Video Camera
  const toggleVideo = async () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks.forEach((track) => {
          track.enabled = !track.enabled;
        });
        setIsVideoEnabled((prev) => !prev);
      } else {
        // Request video track if not present
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const newVideoTrack = videoStream.getVideoTracks()[0];
          localStreamRef.current.addTrack(newVideoTrack);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
          if (peerConnectionRef.current) {
            peerConnectionRef.current.addTrack(newVideoTrack, localStreamRef.current);
          }
          setIsVideoEnabled(true);
        } catch {
          setIsVideoEnabled(false);
        }
      }
    } else {
      setIsVideoEnabled((prev) => !prev);
    }
  };

  // Screen Sharing Toggle (Supports seamless screen presentation in both audio & video calls)
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);

      if (peerConnectionRef.current) {
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        const camTrack = localStreamRef.current?.getVideoTracks()[0] || null;
        if (videoSender) {
          try {
            await videoSender.replaceTrack(camTrack);
          } catch (err) {
            console.warn('replaceTrack cam error:', err);
          }
        }
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      await updateCallSession(currentCall.id, {
        isScreenSharing: false,
        screenSharingUserId: undefined,
        screenSharingUserName: undefined
      });
    } else {
      try {
        let screenStream: MediaStream;
        try {
          screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false
          });
        } catch (displayErr) {
          screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' } as any });
        }

        screenStreamRef.current = screenStream;
        const screenVideoTrack = screenStream.getVideoTracks()[0];

        // Handle user stopping screen share via native browser floating pill
        screenVideoTrack.onended = () => {
          toggleScreenShare();
        };

        if (peerConnectionRef.current) {
          const senders = peerConnectionRef.current.getSenders();
          let videoSender = senders.find((s) => s.track?.kind === 'video');
          if (videoSender) {
            await videoSender.replaceTrack(screenVideoTrack);
          } else {
            peerConnectionRef.current.addTrack(screenVideoTrack, screenStream);
          }
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        setIsScreenSharing(true);
        await updateCallSession(currentCall.id, {
          isScreenSharing: true,
          screenSharingUserId: currentUserId,
          screenSharingUserName: currentUserName
        });
      } catch (err: any) {
        console.warn('Screen share cancelled or blocked:', err);
        if (err.name !== 'NotAllowedError') {
          setMediaError('Screen share note: ' + (err.message || 'Permission denied'));
        }
      }
    }
  };

  // Accept Incoming Call & Establish WebRTC Handshake
  const handleAcceptCall = async () => {
    try {
      const pc = getOrCreatePeerConnection();

      // Ensure local tracks are attached to peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          if (!pc.getSenders().some((s) => s.track?.id === track.id)) {
            pc.addTrack(track, localStreamRef.current!);
          }
        });
        if (currentCall.type === 'video') {
          localStreamRef.current.getVideoTracks().forEach((track) => {
            if (!pc.getSenders().some((s) => s.track?.id === track.id)) {
              pc.addTrack(track, localStreamRef.current!);
            }
          });
        }
      }

      // Ensure video transceiver is available for screen share presentation
      try {
        if (!pc.getTransceivers().some((t) => t.receiver.track?.kind === 'video')) {
          pc.addTransceiver('video', { direction: 'sendrecv' });
        }
      } catch (e) {
        console.warn('Receiver video transceiver notice:', e);
      }

      // Listen for caller candidates
      unsubscribeCandidatesRef.current = subscribeToCallerIceCandidates(currentCall.id, async (cand) => {
        if (peerConnectionRef.current && cand) {
          try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(cand));
          } catch (e) {
            console.warn('Receiver adding caller ice candidate notice:', e);
          }
        }
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addReceiverIceCandidate(currentCall.id, event.candidate.toJSON());
        }
      };

      // Set caller offer as remote description
      if (currentCall.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(currentCall.offer as RTCSessionDescriptionInit));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await updateCallSession(currentCall.id, {
          answer: { type: answer.type, sdp: answer.sdp },
          status: 'connected',
          connectedAt: new Date().toISOString()
        });
      } else {
        await updateCallSession(currentCall.id, {
          status: 'connected',
          connectedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.warn('Error accepting call with WebRTC:', err);
      await updateCallSession(currentCall.id, {
        status: 'connected',
        connectedAt: new Date().toISOString()
      });
    }
  };

  // Reject Incoming Call
  const handleRejectCall = async () => {
    try {
      await endCallSession(currentCall.id, 0, 'rejected', currentCall.threadId, currentUserName, currentCall.type);
    } finally {
      cleanupMedia();
      onClose();
    }
  };

  // Hangup / End Active Call
  const handleEndCall = async () => {
    try {
      const finalStatus = currentCall.status === 'connected' ? 'ended' : 'missed';
      await endCallSession(
        currentCall.id,
        callDuration,
        finalStatus,
        currentCall.threadId,
        currentUserName,
        currentCall.type
      );
    } finally {
      cleanupMedia();
      onClose();
    }
  };

  // Format Call Duration Seconds -> MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isRemoteScreenSharing = Boolean(currentCall.isScreenSharing && currentCall.screenSharingUserId !== currentUserId);

  return (
    <div
      id="live-call-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md transition-all animate-in fade-in duration-200"
    >
      {/* Hidden audio element to guarantee remote speaker audio playback */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        muted={isSpeakerMuted}
        className="hidden"
      />

      <div
        id="live-call-container"
        className={`relative w-full ${
          isFullScreen ? 'h-full max-w-none' : 'max-w-2xl h-[620px] max-h-[94vh]'
        } bg-[#111B21] text-white rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col justify-between`}
      >
        {/* Top Bar Header */}
        <div className="px-6 py-3.5 flex items-center justify-between border-b border-white/10 z-20 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#25D366] animate-pulse" />
            <div className="flex items-center space-x-1.5 text-xs text-white/90 font-medium">
              <ShieldCheck className="w-4 h-4 text-[#25D366]" />
              <span>Academy P2P Live Call</span>
              {isWebRtcConnected && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] border border-emerald-500/30 flex items-center gap-1">
                  <Radio className="w-3 h-3 animate-pulse" />
                  HD Audio Connected
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              id="live-call-fullscreen-btn"
              type="button"
              onClick={() => setIsFullScreen((prev) => !prev)}
              className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
              title={isFullScreen ? 'Exit full screen' : 'Full screen'}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Autoplay unblock prompt */}
        {audioPlaybackBlocked && currentCall.status === 'connected' && (
          <div className="mx-6 mt-3 p-3 bg-emerald-600 text-white rounded-xl flex items-center justify-between text-xs z-30 shadow-lg animate-pulse">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 shrink-0" />
              <span className="font-semibold">Browser restricted audio autoplay. Click to unmute incoming speaker.</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (remoteAudioRef.current) {
                  remoteAudioRef.current.play().then(() => setAudioPlaybackBlocked(false)).catch(() => {});
                }
              }}
              className="px-3 py-1 bg-white text-emerald-800 font-bold rounded-lg cursor-pointer hover:bg-emerald-50 shrink-0"
            >
              Enable Speaker
            </button>
          </div>
        )}

        {/* Main Body Stage */}
        <div className="flex-1 relative flex flex-col items-center justify-center p-6 text-center z-10 overflow-hidden">
          {/* Active Screen Sharing View (Local or Remote) */}
          {(isScreenSharing || isRemoteScreenSharing) ? (
            <div className="absolute inset-0 w-full h-full bg-[#0A1014] flex flex-col items-center justify-center p-4">
              <div className="relative w-full h-full rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl flex items-center justify-center">
                <video
                  ref={isRemoteScreenSharing ? remoteVideoRef : localVideoRef}
                  autoPlay
                  playsInline
                  muted={!isRemoteScreenSharing}
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-3 left-3 px-3 py-1.5 rounded-xl bg-black/70 backdrop-blur-md text-xs font-medium text-emerald-400 border border-emerald-500/30 flex items-center gap-2">
                  <ScreenShare className="w-4 h-4" />
                  <span>
                    {isRemoteScreenSharing
                      ? `${currentCall.screenSharingUserName || otherPartyName} is presenting screen`
                      : 'You are sharing your screen'}
                  </span>
                </div>
              </div>
            </div>
          ) : currentCall.type === 'video' && isVideoEnabled ? (
            /* Video Stream Stage */
            <div className="absolute inset-0 w-full h-full bg-[#0A1014] flex items-center justify-center overflow-hidden">
              {/* Remote Video Element */}
              <div className="w-full h-full flex flex-col items-center justify-center relative bg-gradient-to-b from-[#1E2C33] to-[#111B21]">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {/* Fallback avatar if remote video track hasn't begun streaming yet */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -z-0">
                  <div className="w-24 h-24 rounded-full bg-[#00A884] text-white flex items-center justify-center text-3xl font-bold shadow-2xl mb-4">
                    {otherPartyName.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-wide">{otherPartyName}</h3>
                  <p className="text-xs text-[#8696A0] uppercase tracking-wider font-semibold mt-1">
                    {otherPartyRole}
                  </p>
                </div>

                {currentCall.status === 'connected' && (
                  <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-emerald-400 font-mono text-xs border border-emerald-500/20">
                    Live Video Feed ({formatDuration(callDuration)})
                  </div>
                )}
              </div>

              {/* Local PiP Video Box */}
              <div className="absolute bottom-4 right-4 w-32 h-44 sm:w-44 sm:h-56 rounded-2xl overflow-hidden bg-black/70 border-2 border-white/20 shadow-2xl z-20">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white font-mono">
                  You
                </div>
              </div>
            </div>
          ) : (
            /* Voice Audio Call Stage */
            <div className="flex flex-col items-center space-y-6 max-w-sm">
              {/* Pulsing Avatar Container */}
              <div className="relative">
                {currentCall.status !== 'connected' && (
                  <>
                    <div className="absolute inset-0 -m-3 rounded-full border-2 border-[#25D366]/30 animate-ping opacity-60" />
                    <div className="absolute inset-0 -m-6 rounded-full border border-[#25D366]/20 animate-pulse" />
                  </>
                )}
                <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-[#1E5C3D] to-[#00A884] text-white flex items-center justify-center text-4xl font-bold shadow-2xl border-4 border-white/10 relative z-10">
                  {otherPartyName.charAt(0).toUpperCase()}
                </div>
              </div>

              {/* Contact Name & Role */}
              <div className="space-y-1.5">
                <h3 className="text-2xl font-bold tracking-tight text-white">{otherPartyName}</h3>
                <div className="flex items-center justify-center gap-1.5 text-xs text-[#8696A0]">
                  <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white/90 uppercase font-mono font-bold text-[10px]">
                    {otherPartyRole}
                  </span>
                  <span>Direct Line</span>
                </div>
              </div>

              {/* Status & Live Duration Counter */}
              <div className="pt-1">
                {currentCall.status === 'calling' && (
                  <p className="text-sm font-medium text-emerald-400 animate-pulse">
                    {isCaller ? 'Calling...' : 'Incoming Call...'}
                  </p>
                )}
                {currentCall.status === 'ringing' && (
                  <p className="text-sm font-medium text-emerald-400 animate-pulse">
                    {isCaller ? 'Ringing...' : 'Incoming Call...'}
                  </p>
                )}
                {currentCall.status === 'connected' && (
                  <div className="space-y-3">
                    <div className="px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-emerald-400 font-mono text-base font-bold tabular-nums inline-block shadow-inner">
                      {formatDuration(callDuration)}
                    </div>

                    {/* Animated Audio Frequency Waveforms */}
                    <div className="flex items-center justify-center space-x-1.5 h-8">
                      {[35, 65, 95, 55, 85, 45, 75, 50, 90, 60, 80, 40, 70, 30].map((height, i) => (
                        <div
                          key={i}
                          className={`w-1 rounded-full bg-[#25D366] transition-all duration-300 ${
                            isMuted ? 'h-1 opacity-20' : 'animate-pulse'
                          }`}
                          style={{
                            height: isMuted ? '4px' : `${Math.max(6, (height * 0.28))}px`,
                            animationDelay: `${i * 60}ms`
                          }}
                        />
                      ))}
                    </div>

                    <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-300/80">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Noise Cancellation & Clear Voice Active</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Media Error Notification */}
              {mediaError && (
                <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs">
                  {mediaError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Call Controls Toolbar */}
        <div className="p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent border-t border-white/10 z-20">
          {/* Case 1: Incoming Call waiting for answer */}
          {isIncoming ? (
            <div className="flex items-center justify-center space-x-12">
              {/* Decline Button */}
              <div className="flex flex-col items-center space-y-1.5">
                <button
                  id="decline-call-btn"
                  type="button"
                  onClick={handleRejectCall}
                  className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white flex items-center justify-center shadow-xl transition-transform cursor-pointer"
                  title="Decline Call"
                >
                  <PhoneOff className="w-7 h-7" />
                </button>
                <span className="text-xs text-white/80 font-medium">Decline</span>
              </div>

              {/* Accept Button */}
              <div className="flex flex-col items-center space-y-1.5">
                <button
                  id="accept-call-btn"
                  type="button"
                  onClick={handleAcceptCall}
                  className="w-16 h-16 rounded-full bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 text-white flex items-center justify-center shadow-xl transition-transform animate-bounce cursor-pointer"
                  title="Accept Call"
                >
                  <Phone className="w-7 h-7" />
                </button>
                <span className="text-xs text-white/80 font-medium">Accept</span>
              </div>
            </div>
          ) : (
            /* Case 2: Outgoing or Connected Call Controls */
            <div className="flex items-center justify-center space-x-3 sm:space-x-5">
              {/* Mute Mic Toggle */}
              <button
                id="toggle-mic-btn"
                type="button"
                onClick={toggleMute}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isMuted
                    ? 'bg-white text-[#111B21] shadow-lg'
                    : 'bg-white/15 hover:bg-white/25 text-white'
                }`}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff className="w-5 h-5 text-red-600" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Video Camera Toggle */}
              <button
                id="toggle-video-btn"
                type="button"
                onClick={toggleVideo}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  !isVideoEnabled
                    ? 'bg-white/15 hover:bg-white/25 text-white/70'
                    : 'bg-white text-[#111B21] shadow-lg'
                }`}
                title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                {isVideoEnabled ? <Video className="w-5 h-5 text-[#00A884]" /> : <VideoOff className="w-5 h-5" />}
              </button>

              {/* Screen Sharing Toggle */}
              <button
                id="toggle-screen-share-btn"
                type="button"
                onClick={toggleScreenShare}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isScreenSharing
                    ? 'bg-emerald-500 text-white shadow-lg ring-2 ring-emerald-300'
                    : 'bg-white/15 hover:bg-white/25 text-white'
                }`}
                title={isScreenSharing ? 'Stop sharing screen' : 'Share your screen'}
              >
                {isScreenSharing ? <ScreenShareOff className="w-5 h-5 text-white" /> : <ScreenShare className="w-5 h-5" />}
              </button>

              {/* Speaker Output Toggle */}
              <button
                id="toggle-speaker-btn"
                type="button"
                onClick={() => setIsSpeakerMuted((prev) => !prev)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isSpeakerMuted
                    ? 'bg-white text-[#111B21] shadow-lg'
                    : 'bg-white/15 hover:bg-white/25 text-white'
                }`}
                title={isSpeakerMuted ? 'Unmute speaker' : 'Mute speaker'}
              >
                {isSpeakerMuted ? <VolumeX className="w-5 h-5 text-amber-600" /> : <Volume2 className="w-5 h-5" />}
              </button>

              {/* End Call Button */}
              <button
                id="end-call-btn"
                type="button"
                onClick={handleEndCall}
                className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white flex items-center justify-center shadow-xl transition-transform cursor-pointer ml-2"
                title="End Call"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
