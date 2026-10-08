import React, { useState, useEffect, useRef } from 'react';
import { Lock, Radio, Clock, ShieldCheck, AlertCircle, Sparkles, UserCheck, Mic, Volume2, Play, RotateCcw } from 'lucide-react';
import { IslamicTuitionClassroom } from './IslamicTuitionClassroom';
import { LiveKitRoomTokenResponse } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { joinClassroomBySlugOrPasscode } from '../../services/livekitService';
import { getTutorDisplayId } from '../../utils/tutorPrivacy';

export const PermanentSlugRoute: React.FC = () => {
  const { userProfile, activeRole } = useAuth();
  const [slug, setSlug] = useState<string>('');
  const [passcode, setPasscode] = useState<string>('');
  const [guestName, setGuestName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Waiting Room / Next Student Lounge state
  const [inWaitingRoom, setInWaitingRoom] = useState<boolean>(false);
  const [waitingId, setWaitingId] = useState<string | null>(null);
  const [waitingReason, setWaitingReason] = useState<'NEXT_STUDENT_QUEUE' | 'TUTOR_NOT_PRESENT'>('NEXT_STUDENT_QUEUE');
  const [queuePosition, setQueuePosition] = useState<number>(1);
  const [loungeTutorName, setLoungeTutorName] = useState<string>('Tutor 1');
  const [loungeEndTimeMs, setLoungeEndTimeMs] = useState<number | null>(null);
  const [loungeRemainingSecs, setLoungeRemainingSecs] = useState<number>(0);
  const [waitingMessage, setWaitingMessage] = useState<string>('Tutor will admit you shortly...');

  // 5-Second Mic Voice Check in Waiting Lounge
  const [micTestState, setMicTestState] = useState<'idle' | 'recording' | 'recorded' | 'playing'>('idle');
  const [micTestCountdown, setMicTestCountdown] = useState<number>(5);
  const [micTestLevel, setMicTestLevel] = useState<number>(0);
  const [micTestAudioUrl, setMicTestAudioUrl] = useState<string | null>(null);
  const [micTestError, setMicTestError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const playTestChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.14);
        gain.gain.setValueAtTime(0.18, now + idx * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.14);
        osc.stop(now + idx * 0.14 + 0.4);
      });
    } catch (e) {}
  };

  const handleStartMicTest = async () => {
    setMicTestError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const levelInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setMicTestLevel(Math.min(100, Math.round((avg / 128) * 100)));
      }, 80);

      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onstop = () => {
        clearInterval(levelInterval);
        audioCtx.close().catch(() => {});
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setMicTestAudioUrl(URL.createObjectURL(blob));
        setMicTestState('recorded');
      };

      recorder.start();
      setMicTestState('recording');
      setMicTestCountdown(5);

      let sec = 5;
      const countTimer = setInterval(() => {
        sec -= 1;
        setMicTestCountdown(sec);
        if (sec <= 0) {
          clearInterval(countTimer);
          if (recorder.state === 'recording') recorder.stop();
        }
      }, 1000);
    } catch (err: any) {
      setMicTestError('Please allow microphone access in your browser to test your voice.');
      setMicTestState('idle');
    }
  };

  const handlePlayMicTest = () => {
    if (!micTestAudioUrl) return;
    setMicTestState('playing');
    const audio = new Audio(micTestAudioUrl);
    audio.onended = () => setMicTestState('recorded');
    audio.onerror = () => setMicTestState('recorded');
    audio.play().catch(() => setMicTestState('recorded'));
  };

  const handleResetMicTest = () => {
    if (micTestAudioUrl) URL.revokeObjectURL(micTestAudioUrl);
    setMicTestAudioUrl(null);
    setMicTestState('idle');
    setMicTestLevel(0);
  };

  // Classroom Session
  const [tokenData, setTokenData] = useState<LiveKitRoomTokenResponse | null>(null);

  // Local 1-second countdown timer for Next Student Lounge (Zero extra server/Firebase load)
  useEffect(() => {
    if (!inWaitingRoom || !loungeEndTimeMs) return;
    const tick = () => {
      const rem = Math.max(0, Math.floor((loungeEndTimeMs - Date.now()) / 1000));
      setLoungeRemainingSecs(rem);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [inWaitingRoom, loungeEndTimeMs]);

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pathSegments = window.location.pathname.split('/').filter(Boolean);
      if (pathSegments.length >= 2 && (pathSegments[0] === 'c' || pathSegments[0] === 'class')) {
        const raw = pathSegments[1].toLowerCase();
        const numMatch = raw.match(/\d+/);
        const resolvedSlug = numMatch ? `tutor-${parseInt(numMatch[0], 10)}` : (raw === 'tutor' ? 'tutor-1' : pathSegments[1]);
        setSlug(resolvedSlug);
      } else {
        setSlug('tutor-1');
      }
    }
  }, []);

  // Set default display name from logged in profile if available
  useEffect(() => {
    if (userProfile?.displayName) {
      setGuestName(userProfile.displayName);
    }
  }, [userProfile]);

  const isAdminOrSupervisor = activeRole === 'admin' || userProfile?.role === 'admin' || activeRole === 'supervisor' || userProfile?.role === 'supervisor';
  const isTutorRole = activeRole === 'tutor' || userProfile?.role === 'tutor';
  const isStaff = isAdminOrSupervisor || isTutorRole;

  // Auto-connect logged-in staff instantly (Tutor, Admin, Supervisor)
  useEffect(() => {
    if (slug && userProfile && isStaff && !tokenData && !isLoading && !errorMessage) {
      handleJoinClassroom('');
    }
  }, [slug, userProfile, isStaff]);

  // Poll waiting room status if in waiting room
  useEffect(() => {
    if (!inWaitingRoom || !waitingId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/livekit/waiting-room?waitingId=${waitingId}`);
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (typeof data.queuePosition === 'number') setQueuePosition(data.queuePosition);
          if (data.tutorName) setLoungeTutorName(getTutorDisplayId(data.tutorName));
          if (data.currentLessonEndTimeMs) setLoungeEndTimeMs(data.currentLessonEndTimeMs);
          if (data.waitingReason) setWaitingReason(data.waitingReason);

          if (data.participant?.status === 'ADMITTED' || data.token) {
            setInWaitingRoom(false);
            if (data.token) {
              setTokenData({
                token: data.token,
                serverUrl: data.serverUrl || 'wss://islamictuition-xi2wjy78.livekit.cloud',
                roomName: data.roomName || slug,
                participantIdentity: data.participant?.identity || `student_${Date.now()}`,
                participantName: data.participant?.guest_name || guestName || 'Student',
                role: 'student',
                classId: null,
                isMockSession: false,
                expiresInSeconds: 43200,
                isOverrideActive: false
              });
            } else {
              handleJoinClassroom(passcode, waitingId);
            }
          } else if (data.participant?.status === 'REJECTED') {
            setInWaitingRoom(false);
            setErrorMessage('The tutor asked to reschedule or closed this classroom session.');
          }
        }
      } catch (e) {
        console.warn('Waiting status poll error:', e);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [inWaitingRoom, waitingId, passcode]);

  const handleJoinClassroom = async (enteredCode?: string, admittedId?: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const codeToSubmit = enteredCode !== undefined ? enteredCode : passcode;

      const data = await joinClassroomBySlugOrPasscode({
        roomSlug: slug,
        passcode: codeToSubmit,
        sessionUserId: isAdminOrSupervisor
          ? `${(activeRole || userProfile?.role || 'admin').toLowerCase()}_obs_${Date.now()}`
          : (userProfile?.uid || userProfile?.tutorId || userProfile?.studentId || ''),
        userRole: activeRole || userProfile?.role || 'guest',
        guestName: guestName || userProfile?.displayName || (isAdminOrSupervisor ? 'Stealth Observer' : 'Guest Student'),
        isObserveMode: isAdminOrSupervisor,
        admittedWaitingId: admittedId
      });

      if (data.token) {
        setTokenData(data as LiveKitRoomTokenResponse);
      } else if (data.inWaitingRoom) {
        setInWaitingRoom(true);
        setWaitingId(data.waitingId || null);
        setWaitingReason((data as any).waitingReason || 'NEXT_STUDENT_QUEUE');
        setQueuePosition((data as any).queuePosition || 1);
        setLoungeTutorName(getTutorDisplayId((data as any).tutorName || (slug.match(/\d+/) ? `Tutor ${slug.match(/\d+/)![0]}` : 'Tutor')));
        setLoungeEndTimeMs((data as any).currentLessonEndTimeMs || null);
        setWaitingMessage(data.message || 'Your class will start automatically as soon as the current lesson finishes!');
        setIsLoading(false);
        return;
      } else {
        setErrorMessage('Could not connect to the classroom. Please check your passcode.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  if (tokenData) {
    return (
      <div className="w-full h-screen p-2 bg-slate-950">
        <IslamicTuitionClassroom
          roomName={tokenData.roomName}
          tokenData={tokenData}
          userRole={tokenData.role}
          participantName={tokenData.participantName}
          initialMuted={isAdminOrSupervisor}
          onLeave={() => {
            setTokenData(null);
            if (typeof window !== 'undefined') {
              window.location.href = '/';
            }
          }}
        />
      </div>
    );
  }

  // Next Student Lounge View with Live Remaining Time Countdown & Pre-Class Media Test Studio
  if (inWaitingRoom) {
    return (
      <div className="min-h-screen bg-[#070D0A] flex items-center justify-center p-4 text-white">
        <div className="bg-[#0F1B15] border border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl text-center space-y-5">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-400 text-xs font-extrabold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>
              {waitingReason === 'NEXT_STUDENT_QUEUE'
                ? `Next Student Lounge · #${queuePosition} in Line`
                : 'Classroom Waiting Lounge'}
            </span>
          </div>

          <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-extrabold tracking-tight text-white">
              {waitingReason === 'NEXT_STUDENT_QUEUE'
                ? `Ustadh ${loungeTutorName} is Currently in a Lesson`
                : `Waiting for Ustadh ${loungeTutorName} to Start the Class`}
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed font-medium">
              {waitingReason === 'NEXT_STUDENT_QUEUE' ? (
                <>
                  Ustadh <span className="font-extrabold text-emerald-400">{loungeTutorName}</span> is currently wrapping up the previous student&apos;s lesson. You are{' '}
                  <span className="font-extrabold text-amber-400">#{queuePosition} in line</span> — your class will start automatically as soon as the current lesson finishes!
                </>
              ) : (
                <>
                  Ustadh <span className="font-extrabold text-emerald-400">{loungeTutorName}</span> has not opened the classroom yet. Stay on this screen — your class will start automatically with a chime as soon as your tutor joins!
                </>
              )}
            </p>
          </div>

          {/* Live Remaining Time Countdown Box */}
          {waitingReason === 'NEXT_STUDENT_QUEUE' && (
            <div className="rounded-2xl bg-black/45 border border-amber-500/30 p-4 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center justify-center space-x-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Estimated Time Remaining in Current Lesson</span>
              </div>
              {loungeRemainingSecs > 0 ? (
                <div className="text-2xl sm:text-3xl font-mono font-extrabold text-emerald-400 tracking-wider">
                  {formatCountdown(loungeRemainingSecs)}
                </div>
              ) : (
                <div className="text-xs sm:text-sm font-bold text-emerald-400 animate-pulse py-1">
                  ✨ Wrapping up final verses — starting your class any moment now...
                </div>
              )}
              <p className="text-[11px] text-[#8BA295]">
                Stay on this screen — you will enter the classroom automatically with a chime.
              </p>
            </div>
          )}

          {/* Interactive Pre-Class Media Test Studio */}
          <div className="bg-black/40 border border-white/10 p-4 rounded-2xl space-y-3 text-left">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
              <span className="flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Test Your Audio Before Class Starts</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">● Ready</span>
            </div>

            {micTestError && (
              <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px]">
                {micTestError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
              {/* 1. Speaker Test Chime Button */}
              <button
                type="button"
                onClick={playTestChime}
                className="py-2 px-3 bg-emerald-900/40 hover:bg-emerald-800/50 border border-emerald-500/30 text-emerald-200 rounded-xl font-bold text-xs cursor-pointer transition-colors flex items-center justify-center space-x-1.5"
              >
                <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Test Speakers</span>
              </button>

              {/* 2. 5-Second Mic Voice Check */}
              {micTestState === 'idle' && (
                <button
                  type="button"
                  onClick={handleStartMicTest}
                  className="py-2 px-3 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-xl font-bold text-xs cursor-pointer transition-colors flex items-center justify-center space-x-1.5 shadow-xs"
                >
                  <Mic className="w-3.5 h-3.5 shrink-0" />
                  <span>Test Microphone (5s)</span>
                </button>
              )}

              {micTestState === 'recording' && (
                <div className="py-1.5 px-3 bg-rose-500/15 border border-rose-500/30 rounded-xl flex flex-col justify-center">
                  <div className="flex items-center justify-center space-x-1.5 text-rose-400 text-[11px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    <span>Speak now ({micTestCountdown}s)...</span>
                  </div>
                  <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-75"
                      style={{ width: `${Math.max(6, micTestLevel)}%` }}
                    />
                  </div>
                </div>
              )}

              {(micTestState === 'recorded' || micTestState === 'playing') && (
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={handlePlayMicTest}
                    disabled={micTestState === 'playing'}
                    className="flex-1 py-2 px-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 shrink-0" />
                    <span>{micTestState === 'playing' ? 'Playing...' : 'Hear My Voice'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetMicTest}
                    className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl cursor-pointer transition-colors"
                    title="Record Again"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="text-[11px] font-mono text-[#8BA295] bg-black/40 p-2.5 rounded-xl border border-white/10 flex items-center justify-between">
            <span>Classroom Link:</span>
            <span className="text-white font-bold">{slug}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (waitingId) {
                fetch('/api/livekit/waiting-room/action', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ waitingId, action: 'CANCEL' })
                }).catch(() => {});
              }
              setInWaitingRoom(false);
            }}
            className="text-xs text-rose-400 hover:underline font-bold cursor-pointer"
          >
            Leave Waiting Lounge
          </button>
        </div>
      </div>
    );
  }

  // Secure Passcode Entry View
  return (
    <div className="min-h-screen bg-[#070D0A] flex items-center justify-center p-4 text-white select-none">
      <div className="bg-[#0F1B15] border border-[#1B2F23] rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">Live Classroom Portal</h1>
          <p className="text-xs text-[#8AA393]">
            URL: <span className="font-mono text-emerald-400 font-bold">app.islamictuition.us/class/{slug}</span>
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleJoinClassroom();
          }}
          className="space-y-4"
        >
          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#8AA393]">Your Display Name</label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="e.g. Ahmad (Student)"
              className="w-full bg-black/50 border border-white/15 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#8AA393]">Room Passcode</label>
            <input
              type="password"
              maxLength={12}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="e.g. 12345"
              className="w-full bg-black/50 border border-white/15 rounded-xl p-3 text-center text-lg font-mono tracking-widest text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !passcode}
            className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg transition-all cursor-pointer"
          >
            {isLoading ? 'Verifying Code...' : 'Connect to Live Classroom'}
          </button>
        </form>
      </div>
    </div>
  );
};
