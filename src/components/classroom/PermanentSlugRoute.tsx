import React, { useState, useEffect } from 'react';
import { Lock, Radio, Clock, ShieldCheck, AlertCircle, Sparkles, UserCheck } from 'lucide-react';
import { IslamicTuitionClassroom } from './IslamicTuitionClassroom';
import { LiveKitRoomTokenResponse } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const PermanentSlugRoute: React.FC = () => {
  const { userProfile, activeRole } = useAuth();
  const [slug, setSlug] = useState<string>('');
  const [passcode, setPasscode] = useState<string>('');
  const [guestName, setGuestName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Waiting Room state
  const [inWaitingRoom, setInWaitingRoom] = useState<boolean>(false);
  const [waitingId, setWaitingId] = useState<string | null>(null);
  const [waitingMessage, setWaitingMessage] = useState<string>('Tutor will admit you shortly...');

  // Classroom Session
  const [tokenData, setTokenData] = useState<LiveKitRoomTokenResponse | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pathSegments = window.location.pathname.split('/').filter(Boolean);
      if (pathSegments.length >= 2 && (pathSegments[0] === 'c' || pathSegments[0] === 'class')) {
        setSlug(pathSegments[1]);
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

  // Auto-connect logged-in users instantly (Tutor, Student, Admin)
  useEffect(() => {
    if (slug && userProfile && !tokenData && !isLoading && !errorMessage) {
      handleJoinClassroom('');
    }
  }, [slug, userProfile]);

  // Poll waiting room status if in waiting room
  useEffect(() => {
    if (!inWaitingRoom || !waitingId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/livekit/waiting-room?waitingId=${waitingId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.participant) {
            if (data.participant.status === 'ADMITTED') {
              setInWaitingRoom(false);
              // Submit slug access again with admittedWaitingId to fetch token immediately
              handleJoinClassroom(passcode, waitingId);
            } else if (data.participant.status === 'REJECTED') {
              setInWaitingRoom(false);
              setErrorMessage('The tutor rejected admittance to this session.');
            }
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

      const response = await fetch('/api/c/slug-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomSlug: slug,
          passcode: codeToSubmit,
          sessionUserId: userProfile?.uid || userProfile?.tutorId || userProfile?.studentId || '',
          userRole: activeRole || userProfile?.role || 'guest',
          guestName: guestName || userProfile?.displayName || 'Guest Student',
          admittedWaitingId: admittedId
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || 'Access denied');
        setIsLoading(false);
        return;
      }

      if (data.inWaitingRoom) {
        setInWaitingRoom(true);
        setWaitingId(data.waitingId);
        setWaitingMessage(data.message || 'Tutor will admit you');
        setIsLoading(false);
        return;
      }

      if (data.token) {
        setTokenData(data);
      } else {
        setErrorMessage('Failed to receive LiveKit token');
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

  // Waiting Room Isolation View with Interactive Media Test Studio
  if (inWaitingRoom) {
    return (
      <div className="min-h-screen bg-[#070D0A] flex items-center justify-center p-4 text-white">
        <div className="bg-[#0F1B15] border border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-white">Passcode Waiting Room</h2>
            <p className="text-xs text-amber-200/90 leading-relaxed font-medium">
              {waitingMessage || 'Your tutor is currently in another session and will admit you shortly.'}
            </p>
          </div>

          {/* Interactive Pre-Class Media Test Studio */}
          <div className="bg-black/40 border border-white/10 p-4 rounded-2xl space-y-3 text-left">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
              <span className="flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Pre-Class Equipment Test</span>
              </span>
              <span className="text-[10px] text-[#8BA295] font-mono">Test before entering</span>
            </div>

            <div className="space-y-2 pt-1 text-xs">
              <div className="flex items-center justify-between text-[#8BA295]">
                <span>Microphone Status</span>
                <span className="text-emerald-400 font-bold">● Active</span>
              </div>

              {/* Speaker Test Chime Button */}
              <button
                type="button"
                onClick={() => {
                  try {
                    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                    const ctx = new AudioCtx();
                    const now = ctx.currentTime;
                    [523.25, 659.25, 783.99].forEach((freq, idx) => {
                      const osc = ctx.createOscillator();
                      const gain = ctx.createGain();
                      osc.type = 'sine';
                      osc.frequency.setValueAtTime(freq, now + idx * 0.15);
                      gain.gain.setValueAtTime(0.2, now + idx * 0.15);
                      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.4);
                      osc.connect(gain);
                      gain.connect(ctx.destination);
                      osc.start(now + idx * 0.15);
                      osc.stop(now + idx * 0.15 + 0.45);
                    });
                  } catch (e) {}
                }}
                className="w-full py-2 bg-emerald-900/40 hover:bg-emerald-800/50 border border-emerald-500/30 text-emerald-200 rounded-xl font-bold text-xs cursor-pointer transition-colors flex items-center justify-center space-x-2"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span>Test Headphones / Speakers (Play Sound)</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] font-mono text-[#8BA295] bg-black/40 p-2.5 rounded-xl border border-white/10 flex items-center justify-between">
            <span>Meeting Slot:</span>
            <span className="text-white font-bold">{slug}</span>
          </div>

          <button
            type="button"
            onClick={() => setInWaitingRoom(false)}
            className="text-xs text-rose-400 hover:underline font-bold cursor-pointer"
          >
            Cancel & Exit Waiting Room
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
            <label className="block text-xs font-bold text-[#8AA393]">5-Digit Room Passcode</label>
            <input
              type="password"
              maxLength={5}
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

        <div className="text-[11px] text-[#8AA393] text-center font-mono pt-2">
          EdTech LiveKit Audio Classroom Pipeline
        </div>
      </div>
    </div>
  );
};
