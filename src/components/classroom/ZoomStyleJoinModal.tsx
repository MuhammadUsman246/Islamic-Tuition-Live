import React, { useState, useEffect } from 'react';
import { useClassroom } from '../../context/ClassroomContext';
import { Video, Lock, User, AlertCircle, X, Sparkles, ExternalLink, Copy, Check, Clock } from 'lucide-react';
import { IslamicTuitionClassroom } from './IslamicTuitionClassroom';
import { LiveKitRoomTokenResponse, UserRole } from '../../types';
import { joinClassroomBySlugOrPasscode, getSavedCustomPasscodes } from '../../services/livekitService';
import { getTutorDisplayId } from '../../utils/tutorPrivacy';

export interface AssignedTutorRoomOption {
  tutorId: string;
  tutorName?: string;
  slug: string;
  studentName?: string;
  courseType?: string;
}

interface ZoomStyleJoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserRole?: UserRole;
  currentUserName?: string;
  currentUserId?: string;
  defaultTutorSlug?: string;
  assignedTutors?: AssignedTutorRoomOption[];
}

export const ZoomStyleJoinModal: React.FC<ZoomStyleJoinModalProps> = ({
  isOpen,
  onClose,
  currentUserRole = 'student',
  currentUserName = 'Academy Member',
  currentUserId = '',
  defaultTutorSlug,
  assignedTutors = []
}) => {
  const initialSlug = defaultTutorSlug || assignedTutors[0]?.slug || 'tutor-1';
  const [meetingIdOrSlug, setMeetingIdOrSlug] = useState<string>(initialSlug);
  const [passcode, setPasscode] = useState<string>('12345');
  const [displayName, setDisplayName] = useState<string>(currentUserName);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [roomPasscodesMap, setRoomPasscodesMap] = useState<Record<string, string>>({});

  // Sync default assigned tutor slug & user display name when modal opens or user switches
  useEffect(() => {
    const resolvedSlug = defaultTutorSlug || assignedTutors[0]?.slug || 'tutor-1';
    setMeetingIdOrSlug(resolvedSlug);
    if (roomPasscodesMap[resolvedSlug]) {
      setPasscode(roomPasscodesMap[resolvedSlug]);
    }
  }, [defaultTutorSlug, assignedTutors, isOpen]);

  useEffect(() => {
    if (currentUserName) {
      setDisplayName(currentUserName);
    }
  }, [currentUserName]);

  // Fetch permanent rooms passcodes so enrolled students/parents always have their assigned tutor's current passcode
  useEffect(() => {
    if (!isOpen) return;
    const localCustomMap = getSavedCustomPasscodes();
    setRoomPasscodesMap(prev => ({ ...localCustomMap, ...prev }));

    fetch('/api/livekit/rooms/permanent')
      .then(res => {
        const ct = res.headers.get('content-type') || '';
        return res.ok && ct.includes('application/json') ? res.json() : null;
      })
      .then(data => {
        if (data?.rooms && Array.isArray(data.rooms)) {
          const map: Record<string, string> = { ...localCustomMap };
          data.rooms.forEach((r: any) => {
            if (r.room_slug && r.passcode) {
              map[r.room_slug.toLowerCase()] = String(r.passcode);
            }
          });
          setRoomPasscodesMap(map);
          const currentSlug = (defaultTutorSlug || assignedTutors[0]?.slug || meetingIdOrSlug || 'tutor-1').toLowerCase();
          if (map[currentSlug]) {
            setPasscode(map[currentSlug]);
          }
        }
      })
      .catch(() => {});
  }, [isOpen]);

  // Active Session state
  const [tokenData, setTokenData] = useState<LiveKitRoomTokenResponse | null>(null);

  // Waiting Room / Next Student Lounge state
  const [inWaitingRoom, setInWaitingRoom] = useState<boolean>(false);
  const [waitingId, setWaitingId] = useState<string | null>(null);
  const [waitingReason, setWaitingReason] = useState<'NEXT_STUDENT_QUEUE' | 'TUTOR_NOT_PRESENT'>('NEXT_STUDENT_QUEUE');
  const [queuePosition, setQueuePosition] = useState<number>(1);
  const [loungeTutorName, setLoungeTutorName] = useState<string>('Tutor 1');
  const [loungeEndTimeMs, setLoungeEndTimeMs] = useState<number | null>(null);
  const [loungeRemainingSecs, setLoungeRemainingSecs] = useState<number>(0);
  const [waitingMessage, setWaitingMessage] = useState<string>('Tutor will admit you shortly...');

  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const { joinClassroomSession } = useClassroom();

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

  const submitJoinRequest = async (admittedId?: string) => {
    if (!meetingIdOrSlug.trim()) {
      setErrorMessage('Please enter a Tutor ID or Classroom Link');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await joinClassroomBySlugOrPasscode({
        roomSlug: meetingIdOrSlug.trim(),
        passcode: passcode.trim(),
        sessionUserId: currentUserId,
        userRole: (currentUserRole || 'guest') as UserRole,
        guestName: displayName || currentUserName,
        admittedWaitingId: admittedId
      });

      if (data.inWaitingRoom) {
        setInWaitingRoom(true);
        setWaitingId(data.waitingId || null);
        setWaitingReason((data as any).waitingReason || 'NEXT_STUDENT_QUEUE');
        setQueuePosition((data as any).queuePosition || 1);
        setLoungeTutorName(
          getTutorDisplayId(
            (data as any).tutorName ||
              (meetingIdOrSlug.match(/\d+/) ? `Tutor ${meetingIdOrSlug.match(/\d+/)![0]}` : 'Tutor')
          )
        );
        setLoungeEndTimeMs((data as any).currentLessonEndTimeMs || null);
        setWaitingMessage(data.message || 'Your class will start automatically as soon as the current lesson finishes!');
        setIsLoading(false);
        return;
      }

      if (data.token) {
        setInWaitingRoom(false);
        setTokenData(data as LiveKitRoomTokenResponse);
        await joinClassroomSession(data as LiveKitRoomTokenResponse, currentUserRole, displayName || currentUserName);
      } else {
        setErrorMessage('Failed to issue access token');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error connecting to classroom server');
    } finally {
      setIsLoading(false);
    }
  };

  // Poll waiting room status when student/guest is waiting in the Next Student Lounge
  useEffect(() => {
    if (!isOpen || !inWaitingRoom || !waitingId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/livekit/waiting-room?waitingId=${encodeURIComponent(waitingId)}`);
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (typeof data.queuePosition === 'number') setQueuePosition(data.queuePosition);
          if (data.tutorName) setLoungeTutorName(getTutorDisplayId(data.tutorName));
          if (data.currentLessonEndTimeMs) setLoungeEndTimeMs(data.currentLessonEndTimeMs);

          if (data.participant?.status === 'ADMITTED' || data.token) {
            setInWaitingRoom(false);
            if (data.token) {
              const resTokenData: LiveKitRoomTokenResponse = {
                token: data.token,
                serverUrl: data.serverUrl || 'wss://islamictuition-xi2wjy78.livekit.cloud',
                roomName: data.roomName || meetingIdOrSlug.trim(),
                participantIdentity: data.participant?.identity || `student_${Date.now()}`,
                participantName: data.participant?.guest_name || displayName || currentUserName,
                role: (currentUserRole || 'student') as UserRole,
                classId: null,
                isMockSession: false,
                expiresInSeconds: 43200,
                isOverrideActive: false
              };
              setTokenData(resTokenData);
              await joinClassroomSession(resTokenData, currentUserRole, displayName || currentUserName);
            } else {
              submitJoinRequest(waitingId);
            }
          } else if (data.participant?.status === 'REJECTED') {
            setInWaitingRoom(false);
            setErrorMessage('The tutor asked to reschedule or closed this classroom session.');
          }
        }
      } catch (e) {
        console.warn('Waiting status poll notice:', e);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isOpen, inWaitingRoom, waitingId]);

  if (!isOpen) return null;

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitJoinRequest();
  };

  const handleCopyVanityUrl = () => {
    const url = `${window.location.origin}/class/${meetingIdOrSlug.trim() || 'tutor-1'}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  if (tokenData) {
    return (
      <div className="fixed inset-0 bg-black/95 z-50 p-2 sm:p-4 flex flex-col justify-center animate-in fade-in">
        <div className="w-full h-full max-w-7xl mx-auto flex flex-col">
          <IslamicTuitionClassroom
            roomName={tokenData.roomName}
            tokenData={tokenData}
            userRole={tokenData.role}
            participantName={tokenData.participantName}
            onLeave={() => {
              setTokenData(null);
              onClose();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
      <div className="bg-[#0F1B15] border border-[#1D3327] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#1D3327] pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Join Live Classroom</h2>
              <p className="text-xs text-[#8AA393]">Tutor ID & 5-Digit Passcode</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#8AA393] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {inWaitingRoom ? (
          /* Next Student Lounge Intercept with Live Remaining Time Countdown */
          <div className="text-center space-y-4 py-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-400 text-xs font-extrabold">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>
                {waitingReason === 'NEXT_STUDENT_QUEUE'
                  ? `Next Student Lounge · #${queuePosition} in Line`
                  : 'Classroom Waiting Lounge'}
              </span>
            </div>

            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Clock className="w-7 h-7 animate-pulse" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-white">
                {waitingReason === 'NEXT_STUDENT_QUEUE'
                  ? `Ustadh ${loungeTutorName} is Currently in a Lesson`
                  : `Waiting for Ustadh ${loungeTutorName}`}
              </h3>
              <p className="text-xs text-emerald-100/90 leading-relaxed">
                {waitingReason === 'NEXT_STUDENT_QUEUE' ? (
                  <>
                    Ustadh <span className="font-extrabold text-emerald-400">{loungeTutorName}</span> is currently wrapping up the previous student&apos;s lesson. You are{' '}
                    <span className="font-extrabold text-amber-400">#{queuePosition} in line</span> — your class will start automatically as soon as the current lesson finishes!
                  </>
                ) : (
                  waitingMessage
                )}
              </p>
            </div>

            {waitingReason === 'NEXT_STUDENT_QUEUE' && (
              <div className="rounded-2xl bg-black/45 border border-amber-500/30 p-3.5 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center justify-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>Estimated Time Remaining in Current Lesson</span>
                </div>
                {loungeRemainingSecs > 0 ? (
                  <div className="text-2xl font-mono font-extrabold text-emerald-400 tracking-wider">
                    {formatCountdown(loungeRemainingSecs)}
                  </div>
                ) : (
                  <div className="text-xs font-bold text-emerald-400 animate-pulse py-0.5">
                    ✨ Wrapping up final verses — starting your class any moment now...
                  </div>
                )}
                <p className="text-[10px] text-[#8BA295]">
                  Stay on this screen — your class will open automatically.
                </p>
              </div>
            )}

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
        ) : (
          /* Join Form */
          <form onSubmit={handleJoin} className="space-y-4">
            {errorMessage && (
              <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-200 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Assigned Tutor Quick Card for Logged-in Students & Parents */}
            {assignedTutors.length > 0 && (
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    {assignedTutors.length > 1 ? 'Your Assigned Tutors' : 'Your Assigned Tutor'}
                  </span>
                  <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">
                    Auto-Linked
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {assignedTutors.map((item, idx) => {
                    const isSelected = meetingIdOrSlug.trim().toLowerCase() === item.slug.toLowerCase() ||
                      meetingIdOrSlug.trim().toLowerCase() === item.tutorId.toLowerCase();
                    return (
                      <button
                        key={`${item.slug}_${idx}`}
                        type="button"
                        onClick={() => {
                          setMeetingIdOrSlug(item.slug);
                          const code = roomPasscodesMap[item.slug.toLowerCase()];
                          if (code) setPasscode(code);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-600/25 border-emerald-400 text-white shadow-xs'
                            : 'bg-black/30 border-white/10 text-[#8AA393] hover:text-white hover:border-white/25'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-bold text-white truncate">
                            {getTutorDisplayId(item.tutorId)}
                          </div>
                          <div className="text-[10px] text-emerald-300/90 truncate">
                            {item.studentName ? `Learner: ${item.studentName}` : 'Assigned Instructor'}
                            {item.courseType ? ` • ${item.courseType}` : ''}
                          </div>
                        </div>
                        <span className="font-mono text-[11px] px-2 py-1 rounded-lg bg-black/40 border border-emerald-500/30 text-emerald-300 shrink-0">
                          {item.slug}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Field 1: Tutor / Classroom ID */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#8AA393] flex items-center justify-between">
                <span>Assigned Tutor ID or Classroom Link</span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {assignedTutors[0]?.slug ? `Assigned: ${assignedTutors[0].slug}` : `e.g. ${initialSlug}`}
                </span>
              </label>
              <input
                type="text"
                required
                value={meetingIdOrSlug}
                onChange={e => {
                  const val = e.target.value;
                  setMeetingIdOrSlug(val);
                  const cleanKey = val.trim().toLowerCase();
                  if (roomPasscodesMap[cleanKey]) {
                    setPasscode(roomPasscodesMap[cleanKey]);
                  }
                }}
                placeholder={`e.g. ${initialSlug}`}
                className="w-full bg-black/50 border border-white/15 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            {/* Field 2: Passcode */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#8AA393]">Room Passcode</label>
              <input
                type="text"
                maxLength={12}
                value={passcode}
                onChange={e => setPasscode(e.target.value)}
                placeholder="Enter passcode (e.g. 12345)"
                className="w-full bg-black/50 border border-white/15 rounded-xl p-3 text-center text-lg font-mono tracking-widest text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Field 3: Display Name */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#8AA393]">Your Display Name</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your Name (e.g. Student Ahmad)"
                className="w-full bg-black/50 border border-white/15 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Quick Share Link Preview */}
            <div className="pt-2 flex items-center justify-between text-xs text-[#8AA393] bg-black/30 p-2.5 rounded-xl border border-white/10">
              <span className="truncate max-w-[220px] font-mono text-[11px] text-emerald-300">
                {window.location.origin}/class/{meetingIdOrSlug.trim() || initialSlug}
              </span>
              <button
                type="button"
                onClick={handleCopyVanityUrl}
                className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 font-bold cursor-pointer shrink-0"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied Link' : 'Copy Link'}</span>
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !meetingIdOrSlug.trim()}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2"
            >
              <Video className="w-4 h-4" />
              <span>
                {isLoading
                  ? 'Connecting to Classroom...'
                  : currentUserRole === 'parent'
                    ? 'Observe Live Class'
                    : `Join ${meetingIdOrSlug.trim() || initialSlug} Classroom`}
              </span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
