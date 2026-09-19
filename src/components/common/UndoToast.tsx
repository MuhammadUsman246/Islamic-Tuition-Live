import React, { useEffect, useState } from 'react';
import { Undo2, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { TrashRecord } from '../../types';

export interface UndoToastItem {
  trashId: string;
  title: string;
  itemType: string;
}

interface UndoToastProps {
  toast: UndoToastItem | null;
  onUndo: (trashId: string) => Promise<void>;
  onDismiss: () => void;
  durationSeconds?: number;
}

export const UndoToast: React.FC<UndoToastProps> = ({
  toast,
  onUndo,
  onDismiss,
  durationSeconds = 12
}) => {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) {
      setTimeLeft(durationSeconds);
      setIsRestoring(false);
      setRestoreSuccess(null);
      setRestoreError(null);
      return;
    }

    setTimeLeft(durationSeconds);
    setIsRestoring(false);
    setRestoreSuccess(null);
    setRestoreError(null);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [toast, durationSeconds, onDismiss]);

  if (!toast) return null;

  const handleUndo = async () => {
    if (isRestoring) return;
    setIsRestoring(true);
    setRestoreError(null);
    try {
      await onUndo(toast.trashId);
      setRestoreSuccess('Record successfully restored!');
      setTimeout(() => {
        onDismiss();
      }, 1800);
    } catch (err: any) {
      console.error('Failed to undo deletion:', err);
      setRestoreError(err.message || 'Failed to restore record');
      setIsRestoring(false);
    }
  };

  const progressPercent = (timeLeft / durationSeconds) * 100;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md w-full px-4 sm:px-0">
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-700/80 flex flex-col space-y-2 animate-in slide-in-from-bottom-5 duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm shrink-0 border border-rose-500/30">
              {restoreSuccess ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Undo2 className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  {restoreSuccess ? 'Restored' : 'Accidental Deletion Protection'}
                </span>
                {!restoreSuccess && (
                  <span className="text-[10px] text-amber-300 font-mono font-semibold">
                    ({timeLeft}s)
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-white truncate max-w-[220px]">
                {restoreSuccess || `Deleted: ${toast.title}`}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {!restoreSuccess && (
              <button
                type="button"
                onClick={handleUndo}
                disabled={isRestoring}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Restoring...</span>
                  </>
                ) : (
                  <>
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Undo</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onDismiss}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Dismiss toast"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {restoreError && (
          <div className="bg-rose-950/80 border border-rose-800/80 rounded-lg p-2 text-[11px] text-rose-200 flex items-start space-x-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            <span>{restoreError}</span>
          </div>
        )}

        {/* Progress timer bar */}
        {!restoreSuccess && (
          <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all ease-linear duration-1000"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
