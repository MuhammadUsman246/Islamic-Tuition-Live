import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, X, ShieldAlert, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { TrashItemType } from '../../types';

interface StrictDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: TrashItemType;
  title: string;
  subtitle?: string;
  details?: Record<string, string | number | undefined | boolean | null>;
  onConfirm: () => Promise<void> | void;
}

export const StrictDeleteModal: React.FC<StrictDeleteModalProps> = ({
  isOpen,
  onClose,
  itemType,
  title,
  subtitle,
  details,
  onConfirm
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConfirmText('');
      setIsDeleting(false);
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfirmed = itemType === 'class' ? true : confirmText.trim() === 'DELETE';

  const getItemLabel = (type: TrashItemType) => {
    switch (type) {
      case 'class':
        return 'Timetable Slot & Class Schedule';
      case 'student':
        return 'Student Enrollment Record';
      case 'tutor':
        return 'Tutor & Faculty Profile';
      case 'user':
        return 'User Account & Login Access';
      case 'referral':
        return 'Referral Entry';
      case 'announcement':
        return 'Academy Announcement';
      case 'tutor_attendance':
        return 'Tutor Attendance Entry';
      default:
        return 'Record';
    }
  };

  const handleExecuteDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed || isDeleting) return;

    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      console.error('Failed to execute deletion:', err);
      setErrorMessage(err.message || 'Failed to delete record. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-rose-200 shadow-2xl max-w-lg w-full overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-50 to-red-50 px-6 py-4 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shadow-xs shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 bg-rose-200/60 px-2 py-0.5 rounded">
                  Strict Confirmation Required
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                Delete {getItemLabel(itemType)}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-rose-100/50 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleExecuteDelete} className="p-6 space-y-4">
          {/* Target Item Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Target Record to Delete
                </span>
                <h4 className="text-sm font-bold text-slate-900 mt-0.5">{title}</h4>
                {subtitle && <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>}
              </div>
            </div>

            {/* Details attributes grid */}
            {details && Object.keys(details).length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200/80 grid grid-cols-2 gap-2 text-xs">
                {Object.entries(details).map(([key, val]) => {
                  if (val === undefined || val === null) return null;
                  return (
                    <div key={key} className="bg-white/80 p-2 rounded border border-slate-200/60">
                      <span className="text-[10px] text-slate-500 block uppercase font-medium">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <strong className="text-slate-900 font-semibold truncate block">
                        {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val)}
                      </strong>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Safety Notice & Recovery assurance */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-start space-x-2.5 text-xs text-emerald-900">
            <ShieldAlert className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block">Accidental Deletion Protection Active</strong>
              <span>
                A recovery snapshot will be preserved in <strong>Recently Deleted</strong>. You will be able to restore this {itemType} at any time or use the instant Undo action.
              </span>
            </div>
          </div>

          {/* Confirmation Input Field (Only for non-class critical items) */}
          {itemType !== 'class' ? (
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-semibold text-slate-800">
                Type <strong className="text-rose-600 font-black tracking-wider bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">DELETE</strong> in capital letters to confirm:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  autoFocus
                  disabled={isDeleting}
                  className={`w-full px-3.5 py-2.5 text-sm font-mono font-bold tracking-wider rounded-xl border focus:outline-none transition-all ${
                    isConfirmed
                      ? 'border-emerald-500 bg-emerald-50/40 text-emerald-900 ring-2 ring-emerald-500/20'
                      : confirmText.length > 0
                      ? 'border-amber-400 bg-amber-50/20 text-slate-900 focus:border-amber-500'
                      : 'border-slate-300 bg-white text-slate-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                  }`}
                />
                {isConfirmed && (
                  <div className="absolute right-3 top-2.5 text-emerald-600 flex items-center space-x-1 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmed</span>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                This safeguard prevents accidental clicks on critical student profiles, faculty members, and user credentials.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-rose-50/60 border border-rose-200/60 rounded-xl text-xs text-slate-700">
              Are you sure you want to remove this timetable slot? You can instantly restore it after deletion using the Undo system.
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              {errorMessage}
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel & Keep Record
            </button>
            <button
              type="submit"
              disabled={!isConfirmed || isDeleting}
              className={`px-5 py-2 text-xs font-bold text-white rounded-xl transition-all flex items-center space-x-1.5 shadow-sm ${
                isConfirmed && !isDeleting
                  ? 'bg-rose-600 hover:bg-rose-700 cursor-pointer shadow-rose-600/20'
                  : 'bg-slate-300 cursor-not-allowed opacity-70'
              }`}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Confirm Deletion</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
