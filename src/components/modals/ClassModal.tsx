import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, AlertCircle, CheckCircle, Clock, Trash2, Eye, UserPlus, Users, Sparkles, CreditCard, Key } from 'lucide-react';
import {
  TimetableClass,
  Tutor,
  Student,
  DayOfWeek,
  ClassDuration,
  PKT_TIME_SLOTS,
  StudentStatus,
  CourseType,
  AllowedCurrency
} from '../../types';
import { SearchableSelect } from '../common/SearchableSelect';
import { isRemoteCustomShiftTutor } from '../../utils/tutorPrivacy';
import {
  isSameTutor,
  getNextSequentialStudentId,
  registerUserAccount
} from '../../services/dataService';
import { generateStudentEmail, generateParentEmail } from '../../utils/studentEmail';
import { COMMON_TIMEZONES, SUPPORTED_COUNTRIES } from '../../utils/timezone';
import { ALLOWED_CURRENCIES, getCurrencySymbol } from '../../utils/currency';
import { TutorScheduleViewModal } from './TutorScheduleViewModal';

interface ClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    classData: Omit<TimetableClass, 'id'>,
    id?: string,
    additionalDays?: DayOfWeek[]
  ) => Promise<void>;
  onRegisterStudent?: (studentData: Omit<Student, 'id'>, id?: string) => Promise<void>;
  tutors: Tutor[];
  students: Student[];
  initialSlot?: { day: DayOfWeek; time: string; tutorId?: string };
  initialClass?: TimetableClass | null;
  existingClasses?: TimetableClass[];
  onDelete?: (id: string) => Promise<void> | void;
  defaultTutorId?: string;
  preselectedStudentId?: string | null;
}

const DAYS: DayOfWeek[] = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

const PRESETS: { label: string; days: DayOfWeek[] }[] = [
  { label: 'Mon – Fri (Daily)', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
  { label: 'Mon / Wed / Fri', days: ['Monday', 'Wednesday', 'Friday'] },
  { label: 'Tue / Thu / Sat', days: ['Tuesday', 'Thursday', 'Saturday'] },
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
  onRegisterStudent,
  tutors,
  students,
  initialSlot,
  initialClass,
  existingClasses = [],
  onDelete,
  defaultTutorId,
  preselectedStudentId
}) => {
  const [bookingMode, setBookingMode] = useState<'existing' | 'register_new'>('existing');
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
  const [presetNotice, setPresetNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [isTutorScheduleModalOpen, setIsTutorScheduleModalOpen] = useState<boolean>(false);

  // 1-Step New Student Registration State (Tab B)
  const [newStudentId, setNewStudentId] = useState<string>('');
  const [newStudentName, setNewStudentName] = useState<string>('');
  const [newStudentAge, setNewStudentAge] = useState<number | ''>('');
  const [newStudentStatus, setNewStudentStatus] = useState<StudentStatus>('Trial');
  const [newCourseType, setNewCourseType] = useState<CourseType>('Quran Reading / Nazra');
  const [newParentName, setNewParentName] = useState<string>('');
  const [newParentPhone, setNewParentPhone] = useState<string>('');
  const [newParentEmail, setNewParentEmail] = useState<string>('');
  const [newCountry, setNewCountry] = useState<string>('United States');
  const [newTimezone, setNewTimezone] = useState<string>('America/New_York');
  const [newMonthlyFee, setNewMonthlyFee] = useState<number | ''>('');
  const [newFeeCurrency, setNewFeeCurrency] = useState<AllowedCurrency>('USD');
  const [newCreateLogins, setNewCreateLogins] = useState<boolean>(true);

  const isUnassignedStudent = (s: Student) => {
    return !s.assignedTutorId || s.assignedTutorId === 'Unassigned' || s.assignedTutorId.trim() === '';
  };

  useEffect(() => {
    setError(null);
    setPresetNotice(null);
    if (initialClass) {
      setBookingMode('existing');
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
      setBookingMode('existing');
      // Reset 1-step registration fields
      setNewStudentId(getNextSequentialStudentId(students));
      setNewStudentName('');
      setNewStudentAge('');
      setNewStudentStatus('Trial');
      setNewCourseType('Quran Reading / Nazra');
      setNewParentName('');
      setNewParentPhone('');
      setNewParentEmail('');
      setNewCountry('United States');
      setNewTimezone('America/New_York');
      setNewMonthlyFee('');
      setNewFeeCurrency('USD');
      setNewCreateLogins(true);

      // Determine default student (prioritize preselectedStudentId, then unassigned students, then first student)
      const unassignedList = students.filter(isUnassignedStudent);
      const defaultStu =
        (preselectedStudentId ? students.find(s => s.studentId === preselectedStudentId) : undefined) ||
        unassignedList[0] ||
        students[0];

      if (defaultStu) {
        setStudentId(defaultStu.studentId);
      } else {
        setStudentId('');
      }

      // Determine tutor: prioritize slot's tutorId -> defaultTutorId -> student's assigned tutor (if not Unassigned) -> first tutor
      let initialTutor = initialSlot?.tutorId || defaultTutorId;
      if (
        !initialTutor &&
        defaultStu &&
        defaultStu.assignedTutorId &&
        defaultStu.assignedTutorId !== 'Unassigned'
      ) {
        initialTutor = defaultStu.assignedTutorId;
      }
      if (!initialTutor && tutors.length > 0) {
        initialTutor = tutors[0].tutorId;
      }
      if (initialTutor) {
        setTutorId(initialTutor);
      }

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
  }, [initialClass, initialSlot, tutors, students, isOpen, defaultTutorId, preselectedStudentId]);

  const handleStudentSelect = (newStuId: string) => {
    setStudentId(newStuId);
    // Only auto-switch tutor if we did NOT open from a specific tutor's slot and the selected student has an assigned tutor
    if (!initialClass && !initialSlot?.tutorId && !defaultTutorId) {
      const match = students.find(s => s.studentId === newStuId);
      if (match?.assignedTutorId && match.assignedTutorId !== 'Unassigned') {
        setTutorId(match.assignedTutorId);
      }
    }
  };

  // Map of days where the selected tutor is already booked at startTimePKT
  const busyDayConflictsMap = useMemo(() => {
    const map = new Map<DayOfWeek, TimetableClass>();
    existingClasses.forEach(c => {
      if (
        isSameTutor(c.tutorId, tutorId) &&
        c.startTimePKT === startTimePKT &&
        c.status !== 'Cancelled' &&
        c.id !== initialClass?.id
      ) {
        map.set(c.dayOfWeek, c);
      }
    });
    return map;
  }, [existingClasses, tutorId, startTimePKT, initialClass]);

  // Naturally sorted tutor options for SearchableSelect
  const tutorOptions = useMemo(() => {
    return [...tutors]
      .sort((a, b) => (a.tutorId || '').localeCompare(b.tutorId || '', undefined, { numeric: true, sensitivity: 'base' }))
      .map(t => {
        const isRemote = isRemoteCustomShiftTutor(t.tutorId);
        return {
          value: t.tutorId,
          label: `${t.tutorId} (${t.realName || t.displayName || t.tutorId})`,
          subLabel: `${isRemote ? '🌐 Remote Shift' : '🏢 In-Office (1am-7am)'}${t.email ? ` • ${t.email}` : ''}`,
          badge: isRemote ? 'Remote' : 'In-Office',
          badgeColor: isRemote ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800',
        };
      });
  }, [tutors]);

  // Student options with Unassigned / Newly Registered students pinned at the very top
  const studentOptions = useMemo(() => {
    const unassigned = students
      .filter(isUnassignedStudent)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || a.name.localeCompare(b.name));
    const assigned = students
      .filter(s => !isUnassignedStudent(s))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    const buildOption = (s: Student, isUnassigned: boolean) => ({
      value: s.studentId,
      label: `${s.name} (${s.studentId})`,
      subLabel: `${s.courseType || 'Quran'} • ${isUnassigned ? '⏳ Unassigned (Needs Slot)' : `Assigned: ${s.assignedTutorId}`}`,
      badge: isUnassigned ? 'Unassigned' : s.status,
      badgeColor: isUnassigned
        ? 'bg-amber-100 text-amber-900 border border-amber-300'
        : s.status === 'Active'
        ? 'bg-emerald-50 text-emerald-700'
        : s.status === 'Trial'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-gray-100 text-gray-600',
      group: isUnassigned
        ? '⏳ Newly Registered / Unassigned Students'
        : '📚 Active & Assigned Students'
    });

    return [
      ...unassigned.map(s => buildOption(s, true)),
      ...assigned.map(s => buildOption(s, false))
    ];
  }, [students]);

  const unassignedCount = useMemo(
    () => students.filter(isUnassignedStudent).length,
    [students]
  );

  if (!isOpen) return null;

  const toggleDay = (day: DayOfWeek) => {
    setPresetNotice(null);
    if (initialClass) {
      setSelectedDays([day]);
      return;
    }
    const conflict = busyDayConflictsMap.get(day);
    if (conflict && !selectedDays.includes(day)) {
      setError(`${tutorId} is already booked on ${day} at ${startTimePKT} PKT (${conflict.studentName}).`);
      return;
    }
    setError(null);
    if (selectedDays.includes(day)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter(d => d !== day));
      }
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  // Conflict-safe day preset application
  const applyPreset = (days: DayOfWeek[], label: string) => {
    setError(null);
    const freeDays = days.filter(d => !busyDayConflictsMap.has(d));
    const busyDays = days.filter(d => busyDayConflictsMap.has(d));

    if (freeDays.length === 0) {
      setError(`${tutorId} has no free slots at ${startTimePKT} PKT across ${label}.`);
      return;
    }

    setSelectedDays(freeDays);
    setIsRecurring(true);
    if (busyDays.length > 0) {
      setPresetNotice(
        `Conflict-safe preset applied: Selected ${freeDays.map(d => d.slice(0, 3)).join(', ')} (skipped ${busyDays.map(d => d.slice(0, 3)).join(', ')} — already booked).`
      );
    } else {
      setPresetNotice(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedDays.length === 0) {
      setError('Please select at least one class day.');
      return;
    }

    // Check for double booking conflict for this tutor
    const conflictTutor = tutors.find(t => t.tutorId === tutorId);
    const tutorName = conflictTutor ? conflictTutor.realName : tutorId;

    for (const day of selectedDays) {
      const conflict = existingClasses.find(
        c =>
          isSameTutor(c.tutorId, tutorId) &&
          c.dayOfWeek === day &&
          c.startTimePKT === startTimePKT &&
          c.status !== 'Cancelled' &&
          c.id !== initialClass?.id
      );

      if (conflict) {
        setError(
          `Tutor "${tutorName}" is already booked on ${day} at ${startTimePKT} for student "${conflict.studentName}". Double booking is not allowed.`
        );
        return;
      }
    }

    setSaving(true);
    try {
      let targetStudentId = studentId;
      let targetStudentName = '';

      if (!initialClass && bookingMode === 'register_new') {
        if (!newStudentName.trim()) {
          setError('Please enter the new student full name.');
          setSaving(false);
          return;
        }
        if (!newParentName.trim()) {
          setError('Please enter the parent / guardian name.');
          setSaving(false);
          return;
        }
        if (!onRegisterStudent) {
          setError('Student registration handler is unavailable.');
          setSaving(false);
          return;
        }

        const cleanStuId = newStudentId.trim() || getNextSequentialStudentId(students);
        const todayIso = new Date().toISOString().slice(0, 10);
        const finalStudentEmail = generateStudentEmail(newStudentName, cleanStuId);
        const finalParentEmail =
          newParentEmail.trim() || generateParentEmail(newParentName, cleanStuId);

        await onRegisterStudent({
          studentId: cleanStuId,
          name: newStudentName.trim(),
          age: newStudentAge === '' ? undefined : Number(newStudentAge),
          joiningDate: todayIso,
          trialStartDate: todayIso,
          email: finalStudentEmail,
          phone: newParentPhone.trim(),
          parentName: newParentName.trim(),
          parentEmail: finalParentEmail,
          parentPhone: newParentPhone.trim(),
          assignedTutorId: tutorId,
          status: newStudentStatus,
          courseType: newCourseType,
          country: newCountry,
          timezone: newTimezone,
          monthlyFee: newMonthlyFee === '' ? undefined : Number(newMonthlyFee),
          feeCurrency: newFeeCurrency || 'USD',
          trialSessionsCompleted: 0,
          trialSessionsTotal: 5,
          trialStatus: newStudentStatus === 'Trial' ? 'In Progress' : 'Converted',
          showFeeToStudent: true,
          notes: notes || `Registered & booked directly on ${tutorId}'s timetable (${startTimePKT} PKT)`,
          createdAt: new Date().toISOString()
        });

        if (newCreateLogins) {
          await registerUserAccount({
            email: finalStudentEmail,
            password: 'quran123',
            displayName: newStudentName.trim(),
            role: 'student',
            status: 'active',
            studentId: cleanStuId
          });
          await registerUserAccount({
            email: finalParentEmail,
            password: 'parent123',
            displayName: newParentName.trim() || `${newStudentName.trim()}'s Parent`,
            role: 'parent',
            status: 'active',
            studentId: cleanStuId
          });
        }

        targetStudentId = cleanStuId;
        targetStudentName = newStudentName.trim();
      } else {
        const selectedStudent = students.find(s => s.studentId === studentId);
        if (!selectedStudent) {
          setError('Please select a valid student.');
          setSaving(false);
          return;
        }
        targetStudentId = selectedStudent.studentId;
        targetStudentName = selectedStudent.name;
      }

      const primaryDay = selectedDays[0];
      const additionalDays = selectedDays.slice(1);

      await onSave(
        {
          tutorId,
          studentId: targetStudentId,
          studentName: targetStudentName,
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

  const activeTutorObj = tutors.find(t => isSameTutor(t.tutorId, tutorId) || isSameTutor(t.id, tutorId));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-xl border border-[#E3DFD7] max-h-[94vh] sm:max-h-[88vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-[#2D8B5C] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-[#E8A93E]" />
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight">
                {initialClass ? 'Edit Timetable Class' : 'Master Timetable Slot Booking'}
              </h3>
              {!initialClass && (
                <p className="text-[11px] text-emerald-100">
                  1-Click Slot Assignment & Instant Two-Way Tutor Sync
                </p>
              )}
            </div>
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
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Auto-Fetched Slot Details Top Banner */}
            {!initialClass && (
              <div className="p-3 bg-[#E8F5EE] border border-emerald-300/80 rounded-xl flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#2D8B5C] text-white flex items-center justify-center font-bold text-xs shrink-0">
                    <Clock className="w-4 h-4 text-[#E8A93E]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-extrabold text-[#161F1A]">
                        {tutorId} {activeTutorObj?.realName ? `(${activeTutorObj.realName})` : ''}
                      </span>
                      <span className="text-emerald-700 font-bold">•</span>
                      <span className="text-xs font-mono font-bold text-[#1E5C3D] bg-white px-2 py-0.5 rounded border border-emerald-200">
                        {SLOT_12H_LABELS[startTimePKT] || `${startTimePKT} PKT`}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#1E5C3D] font-medium mt-0.5">
                      Selected Days: <strong>{selectedDays.map(d => d.slice(0, 3)).join(', ')}</strong> ({selectedDays.length}x/week)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTutorScheduleModalOpen(true)}
                  className="text-[11px] font-bold text-[#1E5C3D] bg-white hover:bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  title="View selected tutor's full 7-day weekly timetable schedule"
                >
                  <Eye className="w-3.5 h-3.5 text-[#2D8B5C]" />
                  <span>Tutor Schedule</span>
                </button>
              </div>
            )}

            {/* Two Clean Mode Tabs Inside the Slot Modal (when adding a new slot) */}
            {!initialClass && (
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#FAF9F7] border border-[#E3DFD7] rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setBookingMode('existing');
                    setError(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    bookingMode === 'existing'
                      ? 'bg-[#2D8B5C] text-white shadow-xs'
                      : 'text-[#5A6B61] hover:text-[#161F1A] hover:bg-white/60'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Select Existing Student</span>
                  {unassignedCount > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                        bookingMode === 'existing'
                          ? 'bg-[#E8A93E] text-[#161F1A]'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                      title={`${unassignedCount} unassigned student(s) ready at top of list`}
                    >
                      {unassignedCount} New
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBookingMode('register_new');
                    setError(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    bookingMode === 'register_new'
                      ? 'bg-[#2D8B5C] text-white shadow-xs'
                      : 'text-[#5A6B61] hover:text-[#161F1A] hover:bg-white/60'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Register New Student & Book</span>
                </button>
              </div>
            )}

            {/* TAB A: Select Existing Student OR Editing Existing Class */}
            {(initialClass || bookingMode === 'existing') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tutor Selection */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-[#161F1A]">
                      Assigned Tutor <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] text-gray-500 font-medium">
                      {tutorOptions.length} tutors
                    </span>
                  </div>
                  <SearchableSelect
                    id="modal_tutor_select"
                    value={tutorId}
                    onChange={setTutorId}
                    options={tutorOptions}
                    placeholder="Select tutor..."
                    searchPlaceholder="Search tutor (e.g. Tutor 1, Usman)..."
                  />
                  {(() => {
                    const currentStudent = students.find(s => s.studentId === studentId);
                    if (!currentStudent) return null;
                    if (isUnassignedStudent(currentStudent)) {
                      return (
                        <p className="mt-1.5 text-[11px] font-medium text-emerald-700 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-[#2D8B5C] shrink-0" />
                          <span>Booking will auto-assign <strong>{tutorId}</strong> to {currentStudent.name}</span>
                        </p>
                      );
                    }
                    const isMatching = currentStudent.assignedTutorId === tutorId;
                    return (
                      <p className={`mt-1.5 text-[11px] font-medium flex items-center gap-1 ${isMatching ? 'text-emerald-700' : 'text-amber-700'}`}>
                        <span>{isMatching ? '✓ Matched to assigned tutor:' : '↻ Will update assigned tutor from:'}</span>
                        <span className="font-bold underline">{currentStudent.assignedTutorId}</span>
                      </p>
                    );
                  })()}
                </div>

                {/* Student Selection (with Unassigned pinned at top) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-[#161F1A]">
                      Student <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] text-[#1E5C3D] font-bold">
                      {unassignedCount > 0 ? `⏳ ${unassignedCount} unassigned at top` : `${studentOptions.length} students`}
                    </span>
                  </div>
                  <SearchableSelect
                    id="modal_student_select"
                    value={studentId}
                    onChange={handleStudentSelect}
                    options={studentOptions}
                    placeholder="Select student..."
                    searchPlaceholder="Search student (unassigned pinned first)..."
                  />
                </div>
              </div>
            )}

            {/* TAB B: + Register New Student & Book Here (1-Step) */}
            {!initialClass && bookingMode === 'register_new' && (
              <div className="p-3.5 bg-[#FAF9F7] border border-emerald-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-[#E3DFD7] pb-2">
                  <div className="flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-[#2D8B5C]" />
                    <span className="text-xs font-bold text-[#1E5C3D]">
                      1-Step Student Registration & Slot Booking
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-emerald-200 text-[#1E5C3D]">
                    Auto-Tutor: {tutorId}
                  </span>
                </div>

                {/* Student Identity Row */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#161F1A] mb-1">Student ID</label>
                    <input
                      type="text"
                      value={newStudentId}
                      onChange={e => setNewStudentId(e.target.value)}
                      className="w-full border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold bg-white"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-[#161F1A] mb-1">
                      Student Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newStudentName}
                      onChange={e => setNewStudentName(e.target.value)}
                      placeholder="e.g. Zayd Al-Farooqi"
                      className="w-full border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 text-xs bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#161F1A] mb-1">Age</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={newStudentAge}
                      onChange={e => setNewStudentAge(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10) || 0))}
                      placeholder="e.g. 9"
                      className="w-full border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 text-xs bg-white"
                    />
                  </div>
                </div>

                {/* Parent Info Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#161F1A] mb-1">
                      Parent Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newParentName}
                      onChange={e => setNewParentName(e.target.value)}
                      placeholder="e.g. Farooq Ahmed"
                      className="w-full border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 text-xs bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#161F1A] mb-1">Parent Phone / WhatsApp</label>
                    <input
                      type="text"
                      value={newParentPhone}
                      onChange={e => setNewParentPhone(e.target.value)}
                      placeholder="+1 555 987 6543"
                      className="w-full border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#161F1A] mb-1">Parent Email</label>
                    <input
                      type="email"
                      value={newParentEmail}
                      onChange={e => setNewParentEmail(e.target.value)}
                      placeholder="parent@example.com"
                      className="w-full border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 text-xs bg-white"
                    />
                  </div>
                </div>

                {/* Course, Status, Country & Timezone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#161F1A] mb-1">Academic Status</label>
                    <select
                      value={newStudentStatus}
                      onChange={e => setNewStudentStatus(e.target.value as StudentStatus)}
                      className="w-full border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 text-xs bg-white"
                    >
                      <option value="Active">Active</option>
                      <option value="Trial">Trial (5 Free Sessions)</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#161F1A] mb-1">Course Type</label>
                    <select
                      value={newCourseType}
                      onChange={e => setNewCourseType(e.target.value as CourseType)}
                      className="w-full border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 text-xs bg-white"
                    >
                      <option value="Noorani Qaida">Noorani Qaida</option>
                      <option value="Quran Reading / Nazra">Quran Reading / Nazra</option>
                      <option value="Hifz">Hifz</option>
                      <option value="Tajweed">Tajweed</option>
                      <option value="Salah / Daily Prayers">Salah / Daily Prayers</option>
                      <option value="Duas">Duas</option>
                      <option value="Ahadith">Ahadith</option>
                      <option value="Islamic Studies">Islamic Studies</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#161F1A] mb-1">Country</label>
                    <select
                      value={newCountry}
                      onChange={e => {
                        const cName = e.target.value;
                        setNewCountry(cName);
                        const matched = SUPPORTED_COUNTRIES.find(c => c.name === cName);
                        if (matched) setNewTimezone(matched.defaultTimezone);
                      }}
                      className="w-full border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 text-xs bg-white"
                    >
                      {SUPPORTED_COUNTRIES.map(c => (
                        <option key={c.code} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#161F1A] mb-1">Timezone</label>
                    <select
                      value={newTimezone}
                      onChange={e => setNewTimezone(e.target.value)}
                      className="w-full border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 text-xs bg-white font-mono"
                    >
                      {COMMON_TIMEZONES.map(tz => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Monthly Fee & Currency + Auto Login */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#161F1A] mb-1 flex items-center gap-1">
                      <CreditCard className="w-3 h-3 text-[#2D8B5C]" />
                      <span>Monthly Fee ({getCurrencySymbol(newFeeCurrency)})</span>
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={newMonthlyFee}
                        onChange={e => setNewMonthlyFee(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="e.g. 60"
                        className="w-full border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white"
                      />
                      <select
                        value={newFeeCurrency}
                        onChange={e => setNewFeeCurrency(e.target.value as AllowedCurrency)}
                        className="border border-[#D5D0C6] rounded-lg px-2 py-1.5 text-xs font-semibold bg-white"
                      >
                        {ALLOWED_CURRENCIES.map(c => (
                          <option key={c.code} value={c.code}>{c.code}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-end">
                    <label className="w-full flex items-center gap-2 p-2 bg-white border border-[#D5D0C6] rounded-lg cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={newCreateLogins}
                        onChange={e => setNewCreateLogins(e.target.checked)}
                        className="rounded border-[#D5D0C6] text-[#2D8B5C] focus:ring-[#2D8B5C]"
                      />
                      <Key className="w-3.5 h-3.5 text-[#2D8B5C] shrink-0" />
                      <span className="font-semibold text-[#161F1A] text-[11px]">
                        Auto-create Student & Parent Portal Logins
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Recurring Schedule Days & Conflict-Safe Presets */}
            <div className="space-y-2 p-3 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7]">
              {!initialClass && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-[#161F1A]">
                      1-Click Conflict-Safe Day Presets
                    </label>
                    <span className="text-[10px] text-[#5A6B61]">
                      Only selects days where {tutorId} is free at {startTimePKT}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {PRESETS.map(p => {
                      const freeDaysInPreset = p.days.filter(d => !busyDayConflictsMap.has(d));
                      const isMatches =
                        freeDaysInPreset.length > 0 &&
                        freeDaysInPreset.length === selectedDays.length &&
                        freeDaysInPreset.every(d => selectedDays.includes(d));
                      return (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => applyPreset(p.days, p.label)}
                          className={`px-2.5 py-1 rounded-md text-[11px] transition-colors border cursor-pointer flex items-center gap-1 ${
                            isMatches
                              ? 'bg-[#2D8B5C] text-white border-[#2D8B5C] font-bold shadow-2xs'
                              : 'bg-white text-[#5A6B61] border-[#D5D0C6] hover:bg-gray-100 font-medium'
                          }`}
                        >
                          <span>{p.label}</span>
                          {freeDaysInPreset.length < p.days.length && (
                            <span className={`text-[9px] px-1 rounded ${isMatches ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
                              {freeDaysInPreset.length}/{p.days.length} free
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {presetNotice && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1 mb-2">
                      {presetNotice}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                  {initialClass ? 'Class Day' : 'Class Days (Click to toggle — busy days locked)'}
                </label>
                <div className="grid grid-cols-7 gap-1">
                  {DAYS.map(d => {
                    const isSelected = selectedDays.includes(d);
                    const isWeekend = d === 'Saturday' || d === 'Sunday';
                    const conflict = busyDayConflictsMap.get(d);
                    const isBusy = Boolean(conflict) && !isSelected;
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={isBusy}
                        onClick={() => toggleDay(d)}
                        className={`py-1.5 px-1 rounded-md text-center text-xs font-semibold border transition-all flex flex-col items-center justify-center ${
                          isSelected
                            ? 'bg-[#2D8B5C] text-white border-[#2D8B5C] shadow-2xs scale-[1.02] cursor-pointer'
                            : isBusy
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-70'
                            : isWeekend
                            ? 'bg-[#FFF9EE] text-[#8C5D08] border-[#E8A93E]/40 hover:bg-[#FFF3DB] cursor-pointer'
                            : 'bg-white text-[#161F1A] border-[#D5D0C6] hover:bg-gray-50 cursor-pointer'
                        }`}
                        title={
                          conflict
                            ? `Occupied on ${d} at ${startTimePKT} by ${conflict.studentName}`
                            : `${d} — Free`
                        }
                      >
                        <span>{d.slice(0, 3)}</span>
                        {isBusy && (
                          <span className="text-[8px] font-bold text-rose-500 leading-none mt-0.5">
                            Booked
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {!initialClass && selectedDays.length > 0 && (
                  <p className="text-[11px] text-[#1E5C3D] font-medium mt-1.5">
                    ✓ Books {selectedDays.length} weekly session(s) on <strong>{selectedDays.join(', ')}</strong> & syncs <strong>{tutorId}</strong> to student profile
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
                <span>
                  {saving
                    ? 'Saving & Syncing...'
                    : initialClass
                    ? 'Save Class'
                    : bookingMode === 'register_new'
                    ? 'Register & Book Slot'
                    : 'Book Slot & Sync Tutor'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Tutor Schedule Inspector Modal */}
      <TutorScheduleViewModal
        isOpen={isTutorScheduleModalOpen}
        onClose={() => setIsTutorScheduleModalOpen(false)}
        tutor={activeTutorObj || null}
        classes={existingClasses}
        students={students}
        onSelectSlotToBook={(_tId, day, slot) => {
          setSelectedDays([day]);
          setStartTimePKT(slot);
        }}
      />
    </div>
  );
};
