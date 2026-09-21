import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, X, AlertTriangle, CheckSquare, Square, Calendar, Clock, Loader2, Check } from 'lucide-react';
import { TimetableClass, DayOfWeek } from '../../types';

interface MultiDayClassDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetClass: TimetableClass | null;
  allClasses?: TimetableClass[];
  onConfirmDelete: (classIds: string[], summary: string) => Promise<void>;
}

export const MultiDayClassDeleteModal: React.FC<MultiDayClassDeleteModalProps> = ({
  isOpen,
  onClose,
  targetClass,
  allClasses = [],
  onConfirmDelete
}) => {
  if (!isOpen || !targetClass) return null;

  return (
    <MultiDayClassDeleteModalContent
      isOpen={isOpen}
      onClose={onClose}
      targetClass={targetClass}
      allClasses={allClasses || []}
      onConfirmDelete={onConfirmDelete}
    />
  );
};

interface MultiDayClassDeleteModalContentProps {
  isOpen: boolean;
  onClose: () => void;
  targetClass: TimetableClass;
  allClasses: TimetableClass[];
  onConfirmDelete: (classIds: string[], summary: string) => Promise<void>;
}

const MultiDayClassDeleteModalContent: React.FC<MultiDayClassDeleteModalContentProps> = ({
  isOpen,
  onClose,
  targetClass,
  allClasses,
  onConfirmDelete
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteScope, setDeleteScope] = useState<'selected' | 'all'>('selected');

  const safeAllClasses = allClasses || [];

  // Find all classes for this student with this tutor at this time slot (or all slots for this student & tutor)
  const relatedSlots = useMemo(() => {
    if (!targetClass) return [];
    // Prioritize slots with same time
    const sameTimeSlots = safeAllClasses.filter(
      c => c.studentId === targetClass.studentId &&
           c.tutorId === targetClass.tutorId &&
           c.startTimePKT === targetClass.startTimePKT
    );
    if (sameTimeSlots.length > 0) return sameTimeSlots;

    // Fallback to all slots for student & tutor
    return safeAllClasses.filter(
      c => c.studentId === targetClass.studentId && c.tutorId === targetClass.tutorId
    );
  }, [targetClass, safeAllClasses]);

  useEffect(() => {
    if (isOpen && targetClass) {
      // By default, select all related days if there are multiple days scheduled so the admin can 1-click delete all days, or choose
      if (relatedSlots.length > 1) {
        setSelectedIds(relatedSlots.map(s => s.id));
      } else {
        setSelectedIds([targetClass.id]);
      }
      setIsDeleting(false);
    }
  }, [isOpen, targetClass, relatedSlots]);

  if (!isOpen || !targetClass) return null;

  const toggleSelectId = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    setSelectedIds(relatedSlots.map(s => s.id));
  };

  const selectOnlyCurrent = () => {
    setSelectedIds([targetClass.id]);
  };

  const selectWeekdays = () => {
    const weekdays = relatedSlots.filter(s => s.dayOfWeek !== 'Saturday' && s.dayOfWeek !== 'Sunday');
    setSelectedIds(weekdays.map(s => s.id));
  };

  const handleDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsDeleting(true);
    try {
      const dayNames = relatedSlots
        .filter(s => selectedIds.includes(s.id))
        .map(s => s.dayOfWeek)
        .join(', ');
      const summary = `${targetClass.studentName} (${targetClass.tutorId}) on ${dayNames}`;
      await onConfirmDelete(selectedIds, summary);
      onClose();
    } catch (err) {
      console.error('Failed to delete slots:', err);
      setIsDeleting(false);
    }
  };

  const dayOrder: Record<DayOfWeek, number> = {
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
    Sunday: 7
  };

  const sortedSlots = [...relatedSlots].sort((a, b) => (dayOrder[a.dayOfWeek] || 0) - (dayOrder[b.dayOfWeek] || 0));

  return (
    <div className="fixed inset-0 bg-[#161F1A]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-[#E3DFD7] max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E3DFD7] bg-[#FAF9F7] shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#161F1A]">
                Remove Timetable Slot(s)
              </h3>
              <p className="text-[11px] text-[#5A6B61]">
                {targetClass.studentName} • {targetClass.tutorId} • {targetClass.startTimePKT} PKT
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 rounded-lg text-[#5A6B61] hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Multi-Day Slot Removal:</span> Select all days or specific days you wish to remove from the timetable calendar. You no longer have to delete slots one by one!
            </div>
          </div>

          {/* Quick Select Buttons */}
          {sortedSlots.length > 1 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-[#5A6B61] uppercase tracking-wider block">
                Quick Day Select
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={selectAll}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition-colors cursor-pointer ${
                    selectedIds.length === sortedSlots.length
                      ? 'bg-[#2D8B5C] text-white border-[#2D8B5C]'
                      : 'bg-white text-[#161F1A] border-[#D5D0C6] hover:bg-gray-50'
                  }`}
                >
                  All Days ({sortedSlots.length})
                </button>
                <button
                  type="button"
                  onClick={selectOnlyCurrent}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition-colors cursor-pointer ${
                    selectedIds.length === 1 && selectedIds[0] === targetClass.id
                      ? 'bg-[#2D8B5C] text-white border-[#2D8B5C]'
                      : 'bg-white text-[#161F1A] border-[#D5D0C6] hover:bg-gray-50'
                  }`}
                >
                  Only {targetClass.dayOfWeek}
                </button>
                {sortedSlots.some(s => s.dayOfWeek !== 'Saturday' && s.dayOfWeek !== 'Sunday') && (
                  <button
                    type="button"
                    onClick={selectWeekdays}
                    className="px-2.5 py-1 text-xs rounded-lg font-medium border border-[#D5D0C6] bg-white text-[#161F1A] hover:bg-gray-50 cursor-pointer"
                  >
                    Mon – Fri (Weekdays)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Day Slots List */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-[#5A6B61] uppercase tracking-wider block">
              Scheduled Days ({sortedSlots.length} Total)
            </span>
            <div className="space-y-1.5 border border-[#E3DFD7] rounded-xl p-2 bg-[#FAF9F7] max-h-56 overflow-y-auto">
              {sortedSlots.map((slot) => {
                const isSelected = selectedIds.includes(slot.id);
                const isTarget = slot.id === targetClass.id;
                return (
                  <div
                    key={slot.id}
                    onClick={() => toggleSelectId(slot.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-2xs'
                        : 'bg-white border-[#E3DFD7] text-[#161F1A] hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      {isSelected ? (
                        <div className="w-4 h-4 rounded bg-rose-600 text-white flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded border border-gray-300 bg-white" />
                      )}
                      <div>
                        <div className="font-semibold flex items-center gap-1.5">
                          <span>{slot.dayOfWeek}</span>
                          {isTarget && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                              Clicked Slot
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#5A6B61] flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-[#2D8B5C]" />
                          <span>{slot.startTimePKT} PKT ({slot.durationMinutes}m)</span>
                          <span>• Status: {slot.status}</span>
                        </div>
                      </div>
                    </div>

                    <span className={`text-[11px] font-bold ${isSelected ? 'text-rose-700' : 'text-gray-400'}`}>
                      {isSelected ? 'Will Delete' : 'Keep'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[11px] text-[#5A6B61]">
            Deleted slots are sent to the Admin Recovery Trash with 1-click restore protection.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 border-t border-[#E3DFD7] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-[#5A6B61] hover:bg-gray-200/60 rounded-lg cursor-pointer transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || selectedIds.length === 0}
            className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm flex items-center space-x-2 cursor-pointer transition-colors disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>
                  {selectedIds.length === sortedSlots.length && sortedSlots.length > 1
                    ? `Delete All ${sortedSlots.length} Days at Once`
                    : `Delete Selected (${selectedIds.length} Slot${selectedIds.length === 1 ? '' : 's'})`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
