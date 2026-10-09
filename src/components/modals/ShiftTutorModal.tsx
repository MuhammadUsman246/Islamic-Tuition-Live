import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ArrowRight,
  Video,
  Calendar,
  BookOpen,
  AlertCircle,
  CheckCircle,
  Loader2,
  Users,
  Clock,
  Globe,
  CalendarDays,
  Sparkles,
  AlertTriangle,
  Eye,
  Check
} from 'lucide-react';
import { Student, Tutor, TimetableClass, DayOfWeek, ClassDuration, PKT_TIME_SLOTS } from '../../types';
import { SearchableSelect } from '../common/SearchableSelect';
import { isRemoteCustomShiftTutor } from '../../utils/tutorPrivacy';
import { convertPKTToStudentTime, formatPKTTime, getTimezoneShortCode } from '../../utils/timezone';
import { isSameTutor, ShiftStudentTutorParams, ShiftStudentTutorScheduleUpdate } from '../../services/dataService';
import { TutorScheduleViewModal } from './TutorScheduleViewModal';

interface ShiftTutorModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  tutors?: Tutor[];
  classes?: TimetableClass[];
  students?: Student[];
  onShiftTutor?: (params: ShiftStudentTutorParams) => Promise<void>;
  onConfirmShift?: (params: ShiftStudentTutorParams) => Promise<void>;
}

export const ShiftTutorModal: React.FC<ShiftTutorModalProps> = ({
  isOpen,
  onClose,
  student,
  tutors = [],
  classes = [],
  students = [],
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
      students={students || []}
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
  students: Student[];
  onShiftTutor: (params: ShiftStudentTutorParams) => Promise<void>;
}

const ALL_DAYS_LIST: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

const PRESETS: Array<{ label: string; days: DayOfWeek[] }> = [
  { label: 'Mon-Wed-Fri', days: ['Monday', 'Wednesday', 'Friday'] },
  { label: 'Tue-Thu-Sat', days: ['Tuesday', 'Thursday', 'Saturday'] },
  { label: 'Mon-Thu (4d)', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'] },
  { label: 'Mon-Fri (5d)', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
  { label: 'Weekend (Sat-Sun)', days: ['Saturday', 'Sunday'] }
];

const ShiftTutorModalContent: React.FC<ShiftTutorModalContentProps> = ({
  isOpen,
  onClose,
  student,
  tutors,
  classes,
  students,
  onShiftTutor
}) => {
  const [selectedNewTutorId, setSelectedNewTutorId] = useState<string>('');
  const [shiftFilter, setShiftFilter] = useState<'in_office' | 'remote' | 'all'>('in_office');
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Time shift options
  const [timeShiftMode, setTimeShiftMode] = useState<'keep' | 'change'>('keep');
  const [newStartTimePKT, setNewStartTimePKT] = useState<string>('01:00');
  const [isCustomTime, setIsCustomTime] = useState<boolean>(false);
  const [customTimeInput, setCustomTimeInput] = useState<string>('01:00');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(['Monday', 'Wednesday', 'Friday']);
  const [durationMinutes, setDurationMinutes] = useState<ClassDuration>(30);
  const [isScheduleInspectorOpen, setIsScheduleInspectorOpen] = useState<boolean>(false);

  const safeTutors = tutors || [];
  const safeClasses = classes || [];

  const currentTutorId = student?.assignedTutorId || 'Unassigned';
  const currentTutor = safeTutors.find(t => isSameTutor(t.tutorId, currentTutorId));

  // Scheduled classes for this student
  const studentClasses = useMemo(() => {
    return safeClasses.filter(c => c.studentId === student.studentId && c.status !== 'Cancelled');
  }, [safeClasses, student.studentId]);

  // Current schedule breakdown
  const currentScheduleSummary = useMemo(() => {
    if (studentClasses.length === 0) {
      return {
        hasClasses: false,
        days: [] as DayOfWeek[],
        time: '01:00',
        duration: 30 as ClassDuration,
        summaryText: 'No scheduled timetable classes yet',
        localTimeText: ''
      };
    }
    const days: DayOfWeek[] = Array.from(new Set(studentClasses.map(c => c.dayOfWeek)));
    const primaryTime = studentClasses[0].startTimePKT || '01:00';
    const duration = (studentClasses[0].durationMinutes || 30) as ClassDuration;

    const sampleDay: DayOfWeek = days[0] || 'Monday';
    const converted = convertPKTToStudentTime(sampleDay, primaryTime, student.timezone || 'Asia/Karachi');

    return {
      hasClasses: true,
      days,
      time: primaryTime,
      duration,
      summaryText: `${days.join(', ')} at ${formatPKTTime(primaryTime)} (${duration}m)`,
      localTimeText: `${converted.localTime} ${converted.shortTz} in student's timezone`
    };
  }, [studentClasses, student.timezone]);

  const inOfficeTutors = useMemo(() => safeTutors.filter(t => !isRemoteCustomShiftTutor(t.tutorId)), [safeTutors]);
  const remoteTutors = useMemo(() => safeTutors.filter(t => isRemoteCustomShiftTutor(t.tutorId)), [safeTutors]);

  useEffect(() => {
    if (isOpen && student) {
      const isCurRemote = isRemoteCustomShiftTutor(student.assignedTutorId);
      const initialShift = isCurRemote ? 'remote' : 'in_office';
      setShiftFilter(initialShift);

      const pool = initialShift === 'remote' ? remoteTutors : inOfficeTutors;
      const otherTutors = pool.filter(t => !isSameTutor(t.tutorId, student.assignedTutorId));
      if (otherTutors.length > 0) {
        setSelectedNewTutorId(otherTutors[0].tutorId);
      } else if (pool.length > 0) {
        setSelectedNewTutorId(pool[0].tutorId);
      } else if (safeTutors.length > 0) {
        setSelectedNewTutorId(safeTutors[0].tutorId);
      }

      // Initialize schedule preferences
      if (currentScheduleSummary.hasClasses) {
        setTimeShiftMode('keep');
        setNewStartTimePKT(currentScheduleSummary.time);
        setCustomTimeInput(currentScheduleSummary.time);
        setSelectedDays(currentScheduleSummary.days);
        setDurationMinutes(currentScheduleSummary.duration);
        const isStandard = (PKT_TIME_SLOTS as readonly string[]).includes(currentScheduleSummary.time);
        setIsCustomTime(!isStandard);
      } else {
        setTimeShiftMode('change');
        setNewStartTimePKT('01:00');
        setCustomTimeInput('01:00');
        setSelectedDays(['Monday', 'Wednesday', 'Friday']);
        setDurationMinutes(30);
        setIsCustomTime(false);
      }

      setTransferNotes('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, student, safeTutors, inOfficeTutors, remoteTutors, currentScheduleSummary]);

  const displayedTutors = useMemo(() => {
    if (shiftFilter === 'in_office') return inOfficeTutors;
    if (shiftFilter === 'remote') return remoteTutors;
    return safeTutors;
  }, [shiftFilter, inOfficeTutors, remoteTutors, safeTutors]);

  const tutorOptions = useMemo(() => {
    return [...displayedTutors]
      .sort((a, b) => (a.tutorId || '').localeCompare(b.tutorId || '', undefined, { numeric: true, sensitivity: 'base' }))
      .map(t => {
        const isRemote = isRemoteCustomShiftTutor(t.tutorId);
        const isCurrent = isSameTutor(t.tutorId, currentTutorId);
        return {
          value: t.tutorId,
          label: `${t.tutorId} (${t.realName || t.displayName || t.tutorId})`,
          subLabel: isCurrent
            ? 'Currently Assigned'
            : `${isRemote ? '🌐 Remote Shift' : '🏢 In-Office (1am-7am)'}${t.email ? ` • ${t.email}` : ''}`,
          disabled: isCurrent,
          badge: isCurrent ? 'Current' : (isRemote ? 'Remote' : 'In-Office'),
          badgeColor: isCurrent
            ? 'bg-amber-100 text-amber-800'
            : (isRemote ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'),
        };
      });
  }, [displayedTutors, currentTutorId]);

  const targetTutor = safeTutors.find(t => isSameTutor(t.tutorId, selectedNewTutorId));

  // Converted time in student's timezone
  const effectiveStartTime = isCustomTime ? customTimeInput : newStartTimePKT;
  const convertedStudentTime = useMemo(() => {
    const sampleDay = selectedDays[0] || 'Monday';
    return convertPKTToStudentTime(sampleDay, effectiveStartTime, student.timezone || 'Asia/Karachi');
  }, [selectedDays, effectiveStartTime, student.timezone]);

  // Check for conflicts on the destination tutor's calendar
  const conflictingClasses = useMemo(() => {
    if (timeShiftMode !== 'change' || !selectedNewTutorId || !effectiveStartTime) return [];
    return safeClasses.filter(c =>
      isSameTutor(c.tutorId, selectedNewTutorId) &&
      c.startTimePKT === effectiveStartTime &&
      selectedDays.includes(c.dayOfWeek) &&
      c.status !== 'Cancelled' &&
      c.studentId !== student.studentId
    );
  }, [timeShiftMode, selectedNewTutorId, effectiveStartTime, selectedDays, safeClasses, student.studentId]);

  const toggleDay = (day: DayOfWeek) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length === 1) return; // Keep at least 1 day
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleConfirmShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNewTutorId) {
      setError('Please select a destination tutor.');
      return;
    }

    if (isSameTutor(selectedNewTutorId, currentTutorId)) {
      setError('Student is already assigned to this tutor. Please choose a different tutor.');
      return;
    }

    if (timeShiftMode === 'change') {
      if (selectedDays.length === 0) {
        setError('Please select at least one day for the new class schedule.');
        return;
      }
      if (!effectiveStartTime || !effectiveStartTime.includes(':')) {
        setError('Please specify a valid start time (HH:MM).');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const scheduleUpdate: ShiftStudentTutorScheduleUpdate | undefined = timeShiftMode === 'change'
        ? {
            changeTime: true,
            newStartTimePKT: effectiveStartTime,
            selectedDays,
            durationMinutes
          }
        : undefined;

      await onShiftTutor({
        studentId: student.studentId,
        oldTutorId: currentTutorId,
        newTutorId: selectedNewTutorId,
        notes: transferNotes.trim(),
        scheduleUpdate
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to shift student tutor:', err);
      setError(err.message || 'Failed to shift tutor. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-[#161F1A]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl border border-[#E3DFD7] max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E3DFD7] bg-[#FAF9F7] shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#161F1A]">
                  Shift Student & Assign Schedule
                </h3>
                <p className="text-[11px] text-[#5A6B61]">
                  Transfer tutor assignment, adjust class timing, and preserve full academic records
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-lg text-[#5A6B61] hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleConfirmShift} className="p-5 sm:p-6 overflow-y-auto space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Student Info Card */}
            <div className="p-3 bg-[#FAF9F7] border border-[#E3DFD7] rounded-xl flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#161F1A]">{student.name}</span>
                  <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-[#D5D0C6] text-[#5A6B61]">
                    {student.studentId}
                  </span>
                </div>
                <div className="text-[11px] text-[#5A6B61] mt-0.5">
                  Course: <strong>{student.courseType}</strong> • Status: <strong>{student.status}</strong>
                  {student.country && ` • ${student.country}`}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block">
                  Timezone
                </span>
                <span className="text-xs font-bold text-[#161F1A]">
                  {getTimezoneShortCode(student.timezone)}
                </span>
              </div>
            </div>

            {/* From -> To Comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              {/* Current Tutor */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">
                  Current Tutor (Releasing)
                </span>
                <div className="text-xs font-bold text-gray-900 truncate">
                  {currentTutorId} {currentTutor?.realName ? `(${currentTutor.realName})` : ''}
                </div>
                <div className="text-[10px] text-gray-500 truncate flex items-center gap-1">
                  <Video className="w-3 h-3 text-blue-600 shrink-0" />
                  <span>{currentTutor?.zoomLink ? 'Custom Zoom Assigned' : 'Zoom Active'}</span>
                </div>
              </div>

              {/* Target Tutor */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                  New Tutor (Receiving)
                </span>
                <div className="text-xs font-bold text-emerald-950 truncate">
                  {targetTutor?.tutorId} {targetTutor?.realName ? `(${targetTutor.realName})` : ''}
                </div>
                <div className="text-[10px] text-emerald-700 truncate flex items-center gap-1">
                  <Video className="w-3 h-3 text-[#2D8B5C] shrink-0" />
                  <span className="truncate">{targetTutor?.zoomLink || 'Zoom Assigned'}</span>
                </div>
              </div>
            </div>

            {/* Destination Tutor Selector with Shift Filter & Searchable Dropdown */}
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-[#161F1A]">
                  Select Destination Tutor <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] text-gray-500 font-medium">
                  {tutorOptions.length} tutors available
                </span>
              </div>

              {/* Shift Filter Pills */}
              <div className="flex items-center gap-1.5 p-1 bg-[#FAF9F7] rounded-lg border border-[#E3DFD7]">
                <button
                  type="button"
                  onClick={() => {
                    setShiftFilter('in_office');
                    const other = inOfficeTutors.filter(t => !isSameTutor(t.tutorId, currentTutorId));
                    if (other.length > 0 && isRemoteCustomShiftTutor(selectedNewTutorId)) {
                      setSelectedNewTutorId(other[0].tutorId);
                    }
                  }}
                  className={`flex-1 py-1 px-2 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    shiftFilter === 'in_office'
                      ? 'bg-[#2D8B5C] text-white shadow-2xs'
                      : 'text-[#5A6B61] hover:text-[#161F1A] hover:bg-white'
                  }`}
                >
                  🏢 In-Office ({inOfficeTutors.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShiftFilter('remote');
                    const other = remoteTutors.filter(t => !isSameTutor(t.tutorId, currentTutorId));
                    if (other.length > 0 && !isRemoteCustomShiftTutor(selectedNewTutorId)) {
                      setSelectedNewTutorId(other[0].tutorId);
                    }
                  }}
                  className={`flex-1 py-1 px-2 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    shiftFilter === 'remote'
                      ? 'bg-purple-700 text-white shadow-2xs'
                      : 'text-purple-700 hover:text-purple-900 hover:bg-purple-50'
                  }`}
                >
                  🌐 Remote Shift ({remoteTutors.length})
                </button>
                <button
                  type="button"
                  onClick={() => setShiftFilter('all')}
                  className={`py-1 px-2.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    shiftFilter === 'all'
                      ? 'bg-[#161F1A] text-white shadow-2xs'
                      : 'text-[#5A6B61] hover:text-[#161F1A] hover:bg-white'
                  }`}
                >
                  All ({safeTutors.length})
                </button>
              </div>

              <SearchableSelect
                value={selectedNewTutorId}
                onChange={setSelectedNewTutorId}
                options={tutorOptions}
                placeholder="Select destination tutor..."
                searchPlaceholder="Search tutor (e.g. Tutor 2, Usman)..."
              />
            </div>

            {/* Timing & Schedule Assignment Section */}
            <div className="p-3.5 bg-slate-50/75 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CalendarClockIcon className="w-4 h-4 text-emerald-700" />
                  <span className="text-xs font-bold text-[#161F1A]">
                    Class Timing & Schedule Options
                  </span>
                </div>
                {targetTutor && (
                  <button
                    type="button"
                    onClick={() => setIsScheduleInspectorOpen(true)}
                    className="px-2.5 py-1 bg-white border border-slate-300 hover:border-emerald-500 hover:text-emerald-700 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    title={`View weekly schedule matrix for ${targetTutor.tutorId}`}
                  >
                    <Eye className="w-3 h-3 text-emerald-600" />
                    <span>View {targetTutor.tutorId} Timetable</span>
                  </button>
                )}
              </div>

              {/* Mode Selection Segmented Control */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTimeShiftMode('keep')}
                  disabled={!currentScheduleSummary.hasClasses}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    timeShiftMode === 'keep'
                      ? 'bg-white border-emerald-600 shadow-xs ring-1 ring-emerald-600'
                      : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">
                      Keep Existing Time
                    </span>
                    {timeShiftMode === 'keep' && (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 line-clamp-1">
                    {currentScheduleSummary.hasClasses
                      ? currentScheduleSummary.summaryText
                      : 'No existing classes to retain'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTimeShiftMode('change')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    timeShiftMode === 'change'
                      ? 'bg-white border-emerald-600 shadow-xs ring-1 ring-emerald-600'
                      : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                      <span>Assign Different Time</span>
                      <Sparkles className="w-3 h-3 text-amber-500" />
                    </span>
                    {timeShiftMode === 'change' && (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Change class hour, duration, or days
                  </p>
                </button>
              </div>

              {/* Keep Mode Information Banner */}
              {timeShiftMode === 'keep' && currentScheduleSummary.hasClasses && (
                <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-[11px] text-emerald-900 flex items-center justify-between">
                  <div>
                    <span>Current Slot: <strong>{currentScheduleSummary.summaryText}</strong></span>
                    {currentScheduleSummary.localTimeText && (
                      <span className="block text-[10px] text-emerald-700 mt-0.5">
                        🌍 {currentScheduleSummary.localTimeText}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                    Preserving
                  </span>
                </div>
              )}

              {/* Change Mode Configuration Panel */}
              {timeShiftMode === 'change' && (
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-3">
                  {/* Start Time (PKT) Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-600" />
                        <span>Class Start Time (PKT)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsCustomTime(!isCustomTime)}
                        className="text-[10px] text-emerald-700 hover:underline font-semibold cursor-pointer"
                      >
                        {isCustomTime ? 'Switch to Standard Slots' : 'Enter Custom Hour (24/7)'}
                      </button>
                    </div>

                    {!isCustomTime ? (
                      <select
                        value={newStartTimePKT}
                        onChange={(e) => {
                          setNewStartTimePKT(e.target.value);
                          setCustomTimeInput(e.target.value);
                        }}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                      >
                        {PKT_TIME_SLOTS.map(slot => (
                          <option key={slot} value={slot}>
                            {slot} PKT ({formatPKTTime(slot)})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={customTimeInput}
                          onChange={(e) => {
                            setCustomTimeInput(e.target.value);
                            setNewStartTimePKT(e.target.value);
                          }}
                          className="flex-1 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-600"
                        />
                        <span className="text-xs text-slate-500 font-mono">PKT</span>
                      </div>
                    )}

                    {/* Converted Student Local Time Display */}
                    <div className="mt-1.5 p-2 bg-blue-50/60 border border-blue-100 rounded-lg flex items-center justify-between text-[11px] text-blue-900">
                      <span className="flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>
                          Student's Local Time: <strong>{convertedStudentTime.localTime} ({convertedStudentTime.shortTz})</strong>
                        </span>
                      </span>
                      <span className="text-[10px] text-blue-700 font-mono">
                        {student.timezone || 'Asia/Karachi'}
                      </span>
                    </div>
                  </div>

                  {/* Days of Week Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <CalendarDays className="w-3 h-3 text-emerald-600" />
                        <span>Scheduled Days ({selectedDays.length} selected)</span>
                      </label>
                    </div>

                    {/* Presets */}
                    <div className="flex items-center gap-1 flex-wrap mb-2">
                      {PRESETS.map(preset => {
                        const isMatch =
                          preset.days.length === selectedDays.length &&
                          preset.days.every(d => selectedDays.includes(d));
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setSelectedDays(preset.days)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                              isMatch
                                ? 'bg-emerald-700 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Day Pills */}
                    <div className="grid grid-cols-7 gap-1">
                      {ALL_DAYS_LIST.map(day => {
                        const isSelected = selectedDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleDay(day)}
                            className={`py-1.5 px-1 rounded-lg text-[10px] font-bold text-center transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-700 text-white shadow-2xs ring-1 ring-emerald-800'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                            title={day}
                          >
                            {day.slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Class Duration Selection */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Class Duration
                    </label>
                    <div className="flex items-center gap-2">
                      {([30, 45, 60] as ClassDuration[]).map(dur => (
                        <button
                          key={dur}
                          type="button"
                          onClick={() => setDurationMinutes(dur)}
                          className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            durationMinutes === dur
                              ? 'bg-slate-900 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {dur} Mins
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Live Conflict & Availability Banner */}
                  {conflictingClasses.length > 0 ? (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-bold text-[11px]">
                          ⚠️ Potential Slot Conflict Detected on {targetTutor?.tutorId}
                        </p>
                        <p className="text-[10px] text-amber-800 mt-0.5">
                          {targetTutor?.tutorId} already has a class on{' '}
                          <strong>{conflictingClasses.map(c => c.dayOfWeek).join(', ')}</strong> at{' '}
                          <strong>{effectiveStartTime} PKT</strong> with student "
                          {conflictingClasses[0].studentName || conflictingClasses[0].studentId}".
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsScheduleInspectorOpen(true)}
                          className="mt-1 text-[10px] font-bold text-amber-900 underline hover:text-amber-950 cursor-pointer"
                        >
                          Inspect {targetTutor?.tutorId}'s full timetable to select a free slot →
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-900 flex items-center justify-between">
                      <span className="flex items-center gap-1 font-medium">
                        <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>
                          {targetTutor?.tutorId || 'Destination tutor'} is available on all {selectedDays.length} selected days at {formatPKTTime(effectiveStartTime)}.
                        </span>
                      </span>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                        Available
                      </span>
                    </div>
                  )}
                </div>
              )}
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
                    {timeShiftMode === 'change' ? (
                      <>
                        <strong>{selectedDays.length} Weekly Classes</strong> assigned to {selectedNewTutorId} at <strong>{formatPKTTime(effectiveStartTime)}</strong> ({selectedDays.join(', ')}).
                      </>
                    ) : (
                      <>
                        <strong>{studentClasses.length} Scheduled Weekly Slot{studentClasses.length === 1 ? '' : 's'}</strong> transferred to {selectedNewTutorId}'s calendar.
                      </>
                    )}
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
                    Full historical lesson reports, recitation notes, and attendance preserved.
                  </span>
                </li>
                <li className="flex items-center gap-1.5 text-[#161F1A]">
                  <Users className="w-3.5 h-3.5 text-[#2D8B5C] shrink-0" />
                  <span>
                    Transferred from {currentTutorId}'s active roster to {selectedNewTutorId}.
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
                placeholder="e.g. Schedule adjustment, student requested morning slot with Tutor 2"
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white text-[#161F1A] focus:outline-none focus:ring-1 focus:ring-emerald-600"
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
                disabled={isSubmitting || !selectedNewTutorId || isSameTutor(selectedNewTutorId, currentTutorId)}
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
                    <span>
                      Confirm Transfer to {selectedNewTutorId}
                      {timeShiftMode === 'change' ? ` at ${effectiveStartTime} PKT` : ''}
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Tutor Schedule Matrix Inspector Modal */}
      {isScheduleInspectorOpen && targetTutor && (
        <TutorScheduleViewModal
          isOpen={isScheduleInspectorOpen}
          onClose={() => setIsScheduleInspectorOpen(false)}
          tutor={targetTutor}
          classes={safeClasses}
          students={students}
          onSelectSlotToBook={(_tutorId, day, slot) => {
            setTimeShiftMode('change');
            setNewStartTimePKT(slot);
            setCustomTimeInput(slot);
            setIsCustomTime(!((PKT_TIME_SLOTS as readonly string[]).includes(slot)));
            if (!selectedDays.includes(day)) {
              setSelectedDays([...selectedDays, day]);
            }
            setIsScheduleInspectorOpen(false);
          }}
        />
      )}
    </>
  );
};

// Helper icon component
const CalendarClockIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" />
    <path d="M16 2v4" />
    <path d="M8 2v4" />
    <path d="M3 10h5" />
    <circle cx="16" cy="16" r="6" />
    <polyline points="16 14 16 16 18 18" />
  </svg>
);
