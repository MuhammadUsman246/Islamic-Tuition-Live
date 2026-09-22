import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle, CheckCircle, Clock, Trash2 } from 'lucide-react';
import { TimetableClass, Tutor, Student, DayOfWeek, ClassDuration, PKT_TIME_SLOTS } from '../../types';

interface ClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    classData: Omit<TimetableClass, 'id'>,
    id?: string,
    additionalDays?: DayOfWeek[]
  ) => Promise<void>;
  tutors: Tutor[];
  students: Student[];
  initialSlot?: { day: DayOfWeek; time: string };
  initialClass?: TimetableClass | null;
  existingClasses?: TimetableClass[];
  onDelete?: (id: string) => Promise<void> | void;
  defaultTutorId?: string;
}

const DAYS: DayOfWeek[] = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

const PRESETS: { label: string; days: DayOfWeek[] }[] = [
  { label: 'Mon / Wed / Fri', days: ['Monday', 'Wednesday', 'Friday'] },
  { label: 'Tue / Thu / Sat', days: ['Tuesday', 'Thursday', 'Saturday'] },
  { label: 'Mon – Fri (Daily)', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
  { label: 'Sat / Sun (Weekend)', days: ['Saturday', 'Sunday'] }
];

const SLOT_12H_LABELS: Record<string, string> = {
  '01:00': '01:00 (1:00 AM PKT)',
  '01:30': '01:30 (1:30 AM PKT)',
  '02:00': '02:00 (2:00 AM PKT)',
  '02:30': '02:30 (2:30 AM PKT)',
  '03:00': '03:00 (3:00 AM PKT)',
  '03:30': '03:30 (3:30 AM PKT)',
  '04:00': '04:00 (4:00 AM PKT)',
  '04:30': '04:30 (4:30 AM PKT)',
  '05:00': '05:00 (5:00 AM PKT)',
  '05:30': '05:30 (5:30 AM PKT)',
  '06:00': '06:00 (6:00 AM PKT)',
  '06:30': '06:30 (6:30 AM PKT)'
};

export const ClassModal: React.FC<ClassModalProps> = ({
  isOpen,
  onClose,
  onSave,
  tutors,
  students,
  initialSlot,
  initialClass,
  existingClasses = [],
  onDelete,
  defaultTutorId
}) => {
  const [tutorId, setTutorId] = useState<string>('Tutor 1');
  const [studentId, setStudentId] = useState<string>('');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(['Monday']);
  const [startTimePKT, setStartTimePKT] = useState<string>('01:00');
  const [isCustomTime, setIsCustomTime] = useState<boolean>(false);
  const [durationMinutes, setDurationMinutes] = useState<ClassDuration>(30);
  const [status, setStatus] = useState<'Scheduled' | 'Completed' | 'Cancelled' | 'Make-up' | 'Student on Leave' | 'Student on Leave (Weekly)'>('Scheduled');
  const [isRecurring, setIsRecurring] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (initialClass) {
      setTutorId(initialClass.tutorId);
      setStudentId(initialClass.studentId);
      setSelectedDays([initialClass.dayOfWeek]);
      setStartTimePKT(initialClass.startTimePKT);
      setDurationMinutes(initialClass.durationMinutes);
      setStatus(initialClass.status);
      setIsRecurring(initialClass.isRecurring);
      setNotes(initialClass.notes || '');

      const isStd = PKT_TIME_SLOTS.includes(initialClass.startTimePKT as any);
      setIsCustomTime(!isStd);
    } else {
      if (defaultTutorId) {
        setTutorId(defaultTutorId);
      } else if (tutors.length > 0) {
        setTutorId(tutors[0].tutorId);
      }
      if (students.length > 0) setStudentId(students[0].studentId);
      if (initialSlot) {
        setSelectedDays([initialSlot.day]);
        setStartTimePKT(initialSlot.time);
        const isStd = PKT_TIME_SLOTS.includes(initialSlot.time as any);
        setIsCustomTime(!isStd);
      } else {
        setSelectedDays(['Monday']);
        setStartTimePKT('01:00');
        setIsCustomTime(false);
      }
    }
  }, [initialClass, initialSlot, tutors, students, isOpen, defaultTutorId]);

  if (!isOpen) return null;

  const toggleDay = (day: DayOfWeek) => {
    if (initialClass) {
      // Editing single class slot
      setSelectedDays([day]);
      return;
    }
    if (selectedDays.includes(day)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter(d => d !== day));
      }
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const applyPreset = (days: DayOfWeek[]) => {
    setSelectedDays(days);
    setIsRecurring(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const selectedStudent = students.find(s => s.studentId === studentId);
    if (!selectedStudent) {
      setError("Please select a valid student.");
      return;
    }

    if (selectedDays.length === 0) {
      setError("Please select at least one class day.");
      return;
    }

    // Check for double booking conflict for this tutor
    const conflictTutor = tutors.find(t => t.tutorId === tutorId);
    const tutorName = conflictTutor ? conflictTutor.realName : tutorId;

    for (const day of selectedDays) {
      const conflict = existingClasses.find(c => 
        c.tutorId === tutorId &&
        c.dayOfWeek === day &&
        c.startTimePKT === startTimePKT &&
        c.status !== 'Cancelled' &&
        c.id !== initialClass?.id
      );

      if (conflict) {
        setError(`Tutor "${tutorName}" is already booked on ${day} at ${startTimePKT} for student "${conflict.studentName}". Double booking is not allowed.`);
        return;
      }
    }

    setSaving(true);
    try {
      const primaryDay = selectedDays[0];
      const additionalDays = selectedDays.slice(1);

      await onSave(
        {
          tutorId,
          studentId,
          studentName: selectedStudent.name,
          dayOfWeek: primaryDay,
          startTimePKT,
          durationMinutes,
          status,
          isRecurring,
          isWeekend: primaryDay === 'Saturday' || primaryDay === 'Sunday',
          notes
        },
        initialClass?.id,
        initialClass ? undefined : additionalDays
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'Conflict detected or booking error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg border border-[#E3DFD7] max-h-[92vh] sm:max-h-[85vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-[#2D8B5C] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-[#E8A93E]" />
            <h3 className="font-bold text-sm sm:text-base">
              {initialClass ? 'Edit Timetable Class' : 'Schedule Timetable Class'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

          {/* Tutor & Student */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Assigned Tutor ID
              </label>
              <select
                id="modal_tutor_select"
                value={tutorId}
                onChange={(e) => setTutorId(e.target.value)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
              >
                {tutors.map((t, idx) => (
                  <option key={`${t.id || t.tutorId}_${idx}`} value={t.tutorId}>
                    {t.tutorId} ({t.realName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Student
              </label>
              <select
                id="modal_student_select"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
              >
                {students.map(s => (
                  <option key={s.id} value={s.studentId}>
                    {s.name} ({s.studentId}) • {s.status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Recurring Schedule Days & Presets */}
          <div className="space-y-2 p-3 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7]">
            {!initialClass && (
              <div>
                <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                  Recurring Day Presets
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PRESETS.map(p => {
                    const isMatches = p.days.length === selectedDays.length && p.days.every(d => selectedDays.includes(d));
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => applyPreset(p.days)}
                        className={`px-2.5 py-1 rounded-md text-[11px] transition-colors border cursor-pointer ${
                          isMatches
                            ? 'bg-[#2D8B5C] text-white border-[#2D8B5C] font-bold shadow-2xs'
                            : 'bg-white text-[#5A6B61] border-[#D5D0C6] hover:bg-gray-100 font-medium'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                {initialClass ? 'Class Day' : 'Class Days (Click to toggle)'}
              </label>
              <div className="grid grid-cols-7 gap-1">
                {DAYS.map(d => {
                  const isSelected = selectedDays.includes(d);
                  const isWeekend = d === 'Saturday' || d === 'Sunday';
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      className={`py-1.5 px-1 rounded-md text-center text-xs font-semibold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#2D8B5C] text-white border-[#2D8B5C] shadow-2xs scale-[1.02]'
                          : isWeekend
                          ? 'bg-[#FFF9EE] text-[#8C5D08] border-[#E8A93E]/40 hover:bg-[#FFF3DB]'
                          : 'bg-white text-[#161F1A] border-[#D5D0C6] hover:bg-gray-50'
                      }`}
                      title={d}
                    >
                      {d.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
              {!initialClass && selectedDays.length > 1 && (
                <p className="text-[11px] text-[#1E5C3D] font-medium mt-1">
                  ✓ Automatically schedules {selectedDays.length} sessions weekly: {selectedDays.join(', ')}
                </p>
              )}
            </div>
          </div>

          {/* Time Slot & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-[#161F1A]">
                  Time Slot (PKT)
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomTime(!isCustomTime)}
                  className="text-[10px] font-bold text-[#2D8B5C] hover:text-[#1E5C3D] underline cursor-pointer"
                >
                  {isCustomTime ? 'Use Standard Slots' : 'Enter Custom Time'}
                </button>
              </div>

              {isCustomTime ? (
                <div className="flex space-x-2">
                  <input
                    type="time"
                    value={startTimePKT}
                    onChange={(e) => setStartTimePKT(e.target.value)}
                    className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none font-mono"
                    required
                  />
                  <span className="text-[10px] bg-emerald-50 text-[#1E5C3D] px-2.5 py-2 rounded-lg border border-emerald-100/50 font-bold self-center shrink-0">
                    Custom
                  </span>
                </div>
              ) : (
                <select
                  value={startTimePKT}
                  onChange={(e) => setStartTimePKT(e.target.value)}
                  className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
                  required
                >
                  {PKT_TIME_SLOTS.map(slot => (
                    <option key={slot} value={slot}>
                      {SLOT_12H_LABELS[slot] || `${slot} PKT`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Session Duration
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) as ClassDuration)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
              >
                <option value={30}>30 Minutes (Standard)</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes</option>
              </select>
            </div>
          </div>

          {/* Status & Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
              >
                <option value="Scheduled">Scheduled</option>
                <option value="Completed">Completed</option>
                <option value="Make-up">Make-up Class</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Student on Leave">Student on Leave (Today)</option>
                <option value="Student on Leave (Weekly)">Student on Leave (Weekly)</option>
              </select>
            </div>

            <div className="flex items-center space-x-2 pt-6">
              <input
                id="modal_recurring_checkbox"
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="rounded border-[#D5D0C6] text-[#2D8B5C] focus:ring-[#2D8B5C]"
              />
              <label htmlFor="modal_recurring_checkbox" className="text-xs text-[#161F1A] font-medium">
                Recurring weekly class
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#161F1A] mb-1">
              Class Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Free trial session, Nazra revision, etc."
              className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
            />
          </div>

          </div>

          {/* Footer Actions */}
          <div className="p-3 sm:px-6 sm:py-3.5 bg-gray-50 border-t border-[#E3DFD7] flex items-center justify-between shrink-0">
            <div>
              {initialClass && onDelete && (
                <button
                  type="button"
                  onClick={async () => {
                    const idToDelete = initialClass.id;
                    onClose();
                    await onDelete(idToDelete);
                  }}
                  className="px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer transition-colors flex items-center space-x-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Class</span>
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-[#5A6B61] hover:bg-gray-200/60 rounded-lg cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                id="submit_class_button"
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-xs font-semibold text-white bg-[#2D8B5C] hover:bg-[#1E5C3D] rounded-lg shadow-sm flex items-center space-x-2 cursor-pointer transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{saving ? 'Validating & Saving...' : 'Save Class'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
