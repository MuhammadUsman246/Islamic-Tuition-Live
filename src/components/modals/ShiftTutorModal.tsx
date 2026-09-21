import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Video, Calendar, BookOpen, AlertCircle, CheckCircle, Loader2, Users } from 'lucide-react';
import { Student, Tutor, TimetableClass } from '../../types';

interface ShiftTutorModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  tutors?: Tutor[];
  classes?: TimetableClass[];
  onShiftTutor?: (params: {
    studentId: string;
    oldTutorId: string;
    newTutorId: string;
    notes?: string;
  }) => Promise<void>;
  onConfirmShift?: (params: {
    studentId: string;
    oldTutorId: string;
    newTutorId: string;
    notes?: string;
  }) => Promise<void>;
}

export const ShiftTutorModal: React.FC<ShiftTutorModalProps> = ({
  isOpen,
  onClose,
  student,
  tutors = [],
  classes = [],
  onShiftTutor,
  onConfirmShift
}) => {
  if (!isOpen || !student) return null;

  return (
    <ShiftTutorModalContent
      isOpen={isOpen}
      onClose={onClose}
      student={student}
      tutors={tutors || []}
      classes={classes || []}
      onShiftTutor={onShiftTutor || onConfirmShift || (async () => {})}
    />
  );
};

interface ShiftTutorModalContentProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  tutors: Tutor[];
  classes: TimetableClass[];
  onShiftTutor: (params: {
    studentId: string;
    oldTutorId: string;
    newTutorId: string;
    notes?: string;
  }) => Promise<void>;
}

const ShiftTutorModalContent: React.FC<ShiftTutorModalContentProps> = ({
  isOpen,
  onClose,
  student,
  tutors,
  classes,
  onShiftTutor
}) => {
  const [selectedNewTutorId, setSelectedNewTutorId] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safeTutors = tutors || [];
  const safeClasses = classes || [];

  const currentTutorId = student?.assignedTutorId || 'Unassigned';
  const currentTutor = safeTutors.find(t => t.tutorId === currentTutorId);

  // Scheduled classes for this student
  const studentClasses = safeClasses.filter(c => c.studentId === student.studentId);

  useEffect(() => {
    if (isOpen && student) {
      // Pick first tutor that is not the current tutor
      const otherTutors = safeTutors.filter(t => t.tutorId !== student.assignedTutorId);
      if (otherTutors.length > 0) {
        setSelectedNewTutorId(otherTutors[0].tutorId);
      } else if (safeTutors.length > 0) {
        setSelectedNewTutorId(safeTutors[0].tutorId);
      }
      setTransferNotes('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, student, safeTutors]);

  const targetTutor = safeTutors.find(t => t.tutorId === selectedNewTutorId);

  const handleConfirmShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNewTutorId) {
      setError('Please select a target tutor.');
      return;
    }

    if (selectedNewTutorId === currentTutorId) {
      setError('Student is already assigned to this tutor. Please choose a different tutor.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onShiftTutor({
        studentId: student.studentId,
        oldTutorId: currentTutorId,
        newTutorId: selectedNewTutorId,
        notes: transferNotes.trim()
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to shift student tutor:', err);
      setError(err.message || 'Failed to shift tutor. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#161F1A]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-[#E3DFD7] max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E3DFD7] bg-[#FAF9F7] shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#161F1A]">
                Shift Student to New Tutor
              </h3>
              <p className="text-[11px] text-[#5A6B61]">
                Seamlessly transfer timetable slots, live Zoom link, and full lesson history
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-[#5A6B61] hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConfirmShift} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Student Info Card */}
          <div className="p-3 bg-[#FAF9F7] border border-[#E3DFD7] rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#161F1A]">{student.name}</span>
              <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-[#D5D0C6] text-[#5A6B61]">
                {student.studentId}
              </span>
            </div>
            <div className="text-[11px] text-[#5A6B61]">
              Course: <strong>{student.courseType}</strong> • Status: <strong>{student.status}</strong>
            </div>
          </div>

          {/* From -> To Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            {/* Current Tutor */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">
                Current Tutor (Will Remove)
              </span>
              <div className="text-xs font-bold text-gray-900">
                {currentTutorId} {currentTutor?.realName ? `(${currentTutor.realName})` : ''}
              </div>
              <div className="text-[10px] text-gray-500 truncate flex items-center gap-1">
                <Video className="w-3 h-3 text-blue-600" />
                <span>{currentTutor?.zoomLink ? 'Custom Zoom Assigned' : 'No Zoom'}</span>
              </div>
            </div>

            {/* Target Tutor */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                New Tutor (Will Assign)
              </span>
              <div className="text-xs font-bold text-emerald-950">
                {targetTutor?.tutorId} {targetTutor?.realName ? `(${targetTutor.realName})` : ''}
              </div>
              <div className="text-[10px] text-emerald-700 truncate flex items-center gap-1">
                <Video className="w-3 h-3 text-[#2D8B5C]" />
                <span className="truncate">{targetTutor?.zoomLink || 'Zoom Assigned'}</span>
              </div>
            </div>
          </div>

          {/* New Tutor Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#161F1A] mb-1">
              Select Destination Tutor
            </label>
            <select
              value={selectedNewTutorId}
              onChange={(e) => setSelectedNewTutorId(e.target.value)}
              className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white text-[#161F1A] font-medium"
            >
              {tutors.map((t) => (
                <option
                  key={t.id}
                  value={t.tutorId}
                  disabled={t.tutorId === currentTutorId}
                >
                  {t.tutorId} ({t.realName}) {t.tutorId === currentTutorId ? '— (Current)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Transfer Details Breakdown */}
          <div className="space-y-2 bg-[#FAF9F7] p-3 rounded-xl border border-[#E3DFD7]">
            <span className="text-[11px] font-bold text-[#161F1A] block">
              Automated Synchronizations Performed:
            </span>
            <ul className="text-xs space-y-1 text-[#5A6B61]">
              <li className="flex items-center gap-1.5 text-[#161F1A]">
                <Calendar className="w-3.5 h-3.5 text-[#2D8B5C] shrink-0" />
                <span>
                  <strong>{studentClasses.length} Scheduled Weekly Slot{studentClasses.length === 1 ? '' : 's'}</strong> transferred to {selectedNewTutorId}'s calendar.
                </span>
              </li>
              <li className="flex items-center gap-1.5 text-[#161F1A]">
                <Video className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>
                  Student & Parent portals updated with <strong>{selectedNewTutorId}'s Zoom link</strong>.
                </span>
              </li>
              <li className="flex items-center gap-1.5 text-[#161F1A]">
                <BookOpen className="w-3.5 h-3.5 text-[#E8A93E] shrink-0" />
                <span>
                  Full historical lesson reports and recitation progress preserved.
                </span>
              </li>
              <li className="flex items-center gap-1.5 text-[#161F1A]">
                <Users className="w-3.5 h-3.5 text-[#2D8B5C] shrink-0" />
                <span>
                  Removed from {currentTutorId}'s active student roster and assigned to {selectedNewTutorId}.
                </span>
              </li>
            </ul>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#161F1A] mb-1">
              Transfer Reason / Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Tutor 2 schedule adjustment, student requested morning slot"
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
              className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white text-[#161F1A]"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#E3DFD7] flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#5A6B61] hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedNewTutorId || selectedNewTutorId === currentTutorId}
              className="px-5 py-2 text-xs font-bold text-white bg-[#2D8B5C] hover:bg-[#1E5C3D] rounded-lg shadow-sm flex items-center space-x-2 cursor-pointer transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Transferring Student...</span>
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  <span>Confirm Transfer to {selectedNewTutorId}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
