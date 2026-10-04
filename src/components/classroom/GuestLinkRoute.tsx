import React, { useState, useEffect } from 'react';
import { UserCheck, Sparkles, AlertCircle, Radio } from 'lucide-react';
import { IslamicTuitionClassroom } from './IslamicTuitionClassroom';
import { LiveKitRoomTokenResponse } from '../../types';
import { generateBrowserLiveKitToken } from '../../services/livekitService';

export const GuestLinkRoute: React.FC = () => {
  const [tokenParam, setTokenParam] = useState<string>('');
  const [guestName, setGuestName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [tokenData, setTokenData] = useState<LiveKitRoomTokenResponse | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      if (token) {
        setTokenParam(token);
      }
    }
  }, []);

  const handleRedeemGuestLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenParam) {
      setErrorMessage('Missing guest token parameter');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/guest/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenParam,
          guestName: guestName || 'Trial Student',
        }),
      });

      const ct = response.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data = await response.json();

        if (!response.ok) {
          setErrorMessage(data.error || 'Guest link invalid or already used');
          setIsLoading(false);
          return;
        }

        if (data.token) {
          setTokenData(data);
          return;
        }
      }

      // Fallback for static hosting where /api/guest/join is not served by Node
      const fallbackToken = await generateBrowserLiveKitToken({
        roomId: 'room_tutor_1',
        identity: `guest_${Date.now()}`,
        participantName: guestName || 'Trial Student',
        role: 'guest',
      });
      setTokenData(fallbackToken);
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
          userRole="guest"
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

  return (
    <div className="min-h-screen bg-[#070D0A] flex items-center justify-center p-4 text-white select-none">
      <div className="bg-[#0F1B15] border border-[#1B2F23] rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">One-Time Guest Trial Link</h1>
          <p className="text-xs text-[#8AA393]">
            Short-lived 2-Hour Trial Token Verification
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleRedeemGuestLink} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#8AA393]">Enter Your Display Name</label>
            <input
              type="text"
              required
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="e.g. Zayd (Trial Student)"
              className="w-full bg-black/50 border border-white/15 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !guestName}
            className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg transition-all cursor-pointer"
          >
            {isLoading ? 'Redeeming Trial Token...' : 'Redeem Token & Join Class'}
          </button>
        </form>
      </div>
    </div>
  );
};
