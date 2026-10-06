import React from 'react';
import { createPortal } from 'react-dom';
import {
  Mic,
  MicOff,
  Monitor,
  MessageSquare,
  PhoneOff,
  Send,
  X,
  Lock,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { useClassroom } from '../../context/ClassroomContext';

export const PersistentClassroomOverlay: React.FC = () => {
  const {
    isActive,
    isAudioMuted,
    isScreenSharing,
    userRole,
    handleToggleAudio,
    handleToggleScreenShare,
    handleToggleCamera,

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

    filteredParticipants,
    participantName,
    elapsedSeconds,
    formatChronometerTime,
    presenceToast,
    setPresenceToast,
    waitingQueue,
    handleWaitingRoomAction,

    showLeaveConfirmModal,
    setShowLeaveConfirmModal,
    leaveClassroomSession,
    finishCurrentStudentLesson,
    endClassForEveryone,

    pipWindow
  } = useClassroom();

  if (!isActive) return null;

  const isStudent = userRole === 'student' || userRole === 'parent';
  const isTutor = userRole === 'tutor';

  const activeTutorParticipant = filteredParticipants.find(p => p.role === 'Tutor');
  const activeStudentParticipants = filteredParticipants.filter(p => p.role === 'Student' || p.role === 'Guest');
  const connectedStudentsNames = activeStudentParticipants.map(s => s.name).join(', ');
  const tutorDisplayName = activeTutorParticipant?.name || (isTutor ? participantName : 'Tutor');
  const isBothTutorAndStudentPresent = Boolean(activeTutorParticipant && activeStudentParticipants.length > 0);

  const formatWaitingDuration = (w: any) => {
    const secs =
      typeof w.waiting_seconds === 'number'
        ? w.waiting_seconds
        : Math.max(0, Math.floor((Date.now() - new Date(w.joined_at).getTime()) / 1000));
    if (secs < 60) return `Waiting ${Math.max(1, secs)}s`;
    return `Waiting ${Math.floor(secs / 60)}m`;
  };

  // 1. TOP FLOATING CONTROL BAR (Renders ONLY inside Picture-in-Picture window OUTSIDE Chrome!)
  const topFloatingBarContent = (
    <div className="bg-[#09100C] text-white p-3 flex flex-col items-center justify-center space-y-2 select-none font-sans min-h-screen border border-[#223D2E] rounded-2xl shadow-2xl">
      <div className="flex items-center justify-between w-full gap-2 text-xs font-medium text-slate-300">
        {presenceToast ? (
          <div
            className={`flex-1 flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold truncate ${
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
                isBothTutorAndStudentPresent ? 'bg-emerald-400 animate-ping' : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span
              className={`font-bold text-xs truncate ${
                isBothTutorAndStudentPresent ? 'text-emerald-300' : 'text-amber-300'
              }`}
            >
              {isBothTutorAndStudentPresent
                ? `${tutorDisplayName} + ${connectedStudentsNames}`
                : isTutor
                  ? `${participantName} · Waiting for Student...`
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
        <div className="w-full px-2.5 py-1 rounded-lg bg-amber-950/90 border border-amber-500/40 flex items-center justify-between gap-2">
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

      <div className="flex items-center space-x-2">
        {/* Green Mute / Unmute */}
        <button
          type="button"
          onClick={handleToggleAudio}
          className={`px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5 text-xs font-bold transition-all cursor-pointer shadow-md ${
            isAudioMuted ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-[#00B074] hover:bg-[#009A65] text-white'
          }`}
          title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isAudioMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          <span>{isAudioMuted ? 'Unmute' : 'Mute'}</span>
        </button>

        {/* Blue Stop Share / Share Screen */}
        {!isStudent && (
          <button
            type="button"
            onClick={handleToggleScreenShare}
            className={`px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5 text-xs font-bold transition-all cursor-pointer shadow-md ${
              isScreenSharing ? 'bg-[#1B6EF3] hover:bg-[#155ECB] text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>{isScreenSharing ? 'Stop Share' : 'Share Screen'}</span>
          </button>
        )}

        {/* Dark Chat Toggle */}
        <button
          type="button"
          onClick={handleToggleChatInSidebar}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-md transition-all ${
            isChatOpen ? 'bg-emerald-600 text-white' : 'bg-[#15241B] hover:bg-[#1E3327] text-white border border-[#2B4B39]'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
          <span>Chat</span>
          {!isChatOpen && unreadChatCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold animate-bounce">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* Red End / Leave */}
        <button
          type="button"
          onClick={() => setShowLeaveConfirmModal(true)}
          className="px-3.5 py-1.5 rounded-xl bg-[#FF2D55] hover:bg-[#E02447] text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-md"
          title="End / Leave Class"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          <span>{isTutor ? 'End' : 'Leave'}</span>
        </button>
      </div>

      {/* Live Chat inside Floating Window */}
      {isChatOpen && (
        <div className="w-full bg-[#050806] border border-[#223D2E] rounded-xl p-2.5 flex flex-col space-y-2 text-xs">
          <div className="flex items-center justify-between border-b border-[#223D2E] pb-1.5 font-bold text-white text-xs">
            <div className="flex items-center space-x-2">
              <span className="flex items-center space-x-1.5 text-emerald-400">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Live Class Chat</span>
              </span>

              {/* Subtle Privacy Badge */}
              {chatSafetySettings?.showPrivacyBadge && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 select-none cursor-help"
                  title={chatSafetySettings.badgeTooltip || 'Classroom chat includes automatic privacy and safety protection to help keep communication secure.'}
                >
                  <Lock className="w-2 h-2 text-emerald-400 shrink-0" />
                  <span>{chatSafetySettings.badgeText || '🔒 Privacy Protected'}</span>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsChatOpen(false)}
              className="text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
            {chatMessages.length === 0 ? (
              <div className="text-center py-4 text-[11px] text-[#9BB5A6]">No messages yet.</div>
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

          {/* Friendly Safety Notice Banner */}
          {chatWarningMessage && (
            <div className="p-2 rounded bg-rose-950/90 border border-rose-500/40 text-rose-200 text-[10px] flex items-start gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              <p className="flex-1 leading-tight">{chatWarningMessage}</p>
            </div>
          )}

          <div className="pt-1 border-t border-[#223D2E] flex items-center space-x-1.5">
            <input
              type="text"
              value={chatInputText}
              onChange={e => setChatInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendChatMessage()}
              placeholder="Write message..."
              className="flex-1 rounded-lg px-2.5 py-1 text-xs bg-[#050806] border border-[#284736] text-white focus:outline-none focus:border-emerald-500"
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
    </div>
  );

  // 2. MAIN TAB OVERLAY (Rendered inside document.body inside Chrome tab: ONLY leave modal)
  const mainTabOverlayContent = (
    <div className="select-none font-sans">
      {/* LEAVE / END CONFIRMATION MODAL OVERLAY */}
      {showLeaveConfirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-[10000] animate-in fade-in">
          <div className="bg-[#0F1B15] border border-[#1D3327] text-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500">
              <PhoneOff className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-extrabold">
                {isTutor ? 'Finish Lesson or End Class' : 'Leave Quran Classroom'}
              </h3>
              <p className="text-xs text-[#8AA393]">
                {isTutor
                  ? 'Choose whether to finish the current student’s lesson (and stay ready for your next student) or end class for everyone.'
                  : 'Are you sure you want to finish and leave your live class?'}
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              {isTutor ? (
                <>
                  <button
                    type="button"
                    onClick={finishCurrentStudentLesson}
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer shadow-md flex flex-col items-center space-y-0.5"
                  >
                    <span className="flex items-center space-x-1.5">
                      <UserCheck className="w-4 h-4" />
                      <span>Finish Current Student&apos;s Class</span>
                    </span>
                    <span className="text-[10px] font-medium text-emerald-100/90">
                      {waitingQueue.length > 0
                        ? `Auto-admits ${waitingQueue[0].guest_name} & keeps classroom open`
                        : 'Keeps your classroom open and ready for the next student'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={endClassForEveryone}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer shadow-md flex items-center justify-center space-x-1.5"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                    <span>End Class for Everyone</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowLeaveConfirmModal(false);
                    leaveClassroomSession();
                  }}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer shadow-md"
                >
                  Finish &amp; Leave Class
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowLeaveConfirmModal(false)}
                className="w-full py-2 text-xs text-[#8AA393] hover:text-white transition-colors cursor-pointer"
              >
                Cancel / Stay in Class
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {createPortal(mainTabOverlayContent, document.body)}
      {pipWindow && pipWindow.document && pipWindow.document.body
        ? createPortal(topFloatingBarContent, pipWindow.document.body)
        : null}
    </>
  );
};
