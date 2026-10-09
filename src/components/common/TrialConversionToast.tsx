import React, { useEffect } from 'react';
import { Sparkles, CheckCircle2, X, ArrowRight, UserCheck } from 'lucide-react';
import { playNotificationChime, sendDesktopNotification, isDesktopNotificationPermitted } from '../../utils/chatMediaUtils';

export interface TrialCompletedNotificationData {
  studentId: string;
  studentName: string;
  tutorId?: string;
  courseType?: string;
  parentName?: string;
  parentPhone?: string;
  trialSessionsCompleted: number;
}

interface TrialConversionToastProps {
  data: TrialCompletedNotificationData;
  onReviewTrials: () => void;
  onDismiss: () => void;
}

export const TrialConversionToast: React.FC<TrialConversionToastProps> = ({
  data,
  onReviewTrials,
  onDismiss
}) => {
  useEffect(() => {
    // Play gentle audio chime
    playNotificationChime();

    // Trigger native desktop push notification if browser permissions granted
    if (isDesktopNotificationPermitted()) {
      sendDesktopNotification(
        `trial_5_${data.studentId}`,
        `⭐ Trial 5/5 Completed: ${data.studentName}`,
        `Completed all 5 free trial sessions with ${data.tutorId || 'tutor'}. Ready for enrolment confirmation!`,
        undefined,
        'trial_milestone'
      );
    }

    // Auto dismiss after 10 seconds
    const timer = setTimeout(() => {
      onDismiss();
    }, 10000);

    return () => clearTimeout(timer);
  }, [data, onDismiss]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-4 right-4 sm:top-5 sm:right-6 z-50 max-w-md w-full animate-in slide-in-from-top-4 fade-in duration-300 drop-shadow-xl"
    >
      <div className="bg-gradient-to-r from-[#FFF9ED] via-white to-emerald-50/60 border-2 border-[#E8A93E] rounded-2xl p-4 sm:p-4.5 shadow-xl space-y-3 relative overflow-hidden">
        {/* Subtle decorative glowing corner accent */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />

        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-[#C98A1E] text-white flex items-center justify-center shrink-0 shadow-sm relative">
              <Sparkles className="w-5 h-5 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500 text-white shadow-2xs">
                  ⭐ 5/5 Sessions Done
                </span>
                <span className="text-[11px] font-bold text-amber-900">
                  Trial Completed
                </span>
              </div>
              <h4 className="text-sm font-extrabold text-[#161F1A] mt-1">
                {data.studentName}{' '}
                <span className="font-mono text-xs font-semibold text-[#5A6B61]">
                  ({data.studentId})
                </span>
              </h4>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-700 p-1 rounded-lg transition-colors cursor-pointer"
            title="Dismiss notification"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-xs text-[#161F1A] pl-1 relative z-10">
          <p>
            Has completed all <strong>5 free trial classes</strong> with{' '}
            <strong className="text-[#2D8B5C]">{data.tutorId || 'assigned faculty'}</strong>
            {data.courseType ? ` in ${data.courseType}` : ''}.
          </p>
          <p className="text-[11px] text-[#5A6B61] mt-0.5">
            Parent confirmation and formal enrolment ready for finalization.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-200/70 relative z-10">
          <button
            type="button"
            onClick={onDismiss}
            className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg transition-colors cursor-pointer"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={onReviewTrials}
            className="px-3.5 py-1.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs active:scale-95"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Review &amp; Enroll</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
