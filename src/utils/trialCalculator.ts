import { Student, TimetableClass, Lesson, AttendanceRecord } from '../types';

export interface TrialProgressResult {
  daysCompleted: number;
  totalTrialDays: number;
  percentage: number;
  isFinished: boolean;
  stageLabel: string;
  stageBadgeColor: string;
}

/**
 * Calculates auto trial progress for students in the 5-Day Trial Class program.
 * 
 * Computes progress by:
 * 1. Attended lesson reports & attendance marks
 * 2. Scheduled class calendar days that have already passed since trial start / joining date
 * 3. Explicitly logged trial sessions
 */
export function calculateStudentTrialProgress(
  student: Student,
  allClasses: TimetableClass[] = [],
  allLessons: Lesson[] = [],
  allAttendance: AttendanceRecord[] = []
): TrialProgressResult {
  const totalTrialDays = 5;

  if (!student) {
    return {
      daysCompleted: 0,
      totalTrialDays,
      percentage: 0,
      isFinished: false,
      stageLabel: 'Day 1',
      stageBadgeColor: 'bg-blue-100 text-blue-800 border-blue-200'
    };
  }

  const sId = student.studentId?.toLowerCase().trim();
  const dId = student.id?.toLowerCase().trim();
  const sName = student.name?.toLowerCase().trim();

  const isMatch = (targetIdOrName?: string) => {
    if (!targetIdOrName) return false;
    const t = targetIdOrName.toLowerCase().trim();
    if (sId && (t === sId || t.replace(/[^a-z0-9]/g, '') === sId.replace(/[^a-z0-9]/g, ''))) return true;
    if (dId && (t === dId || t.replace(/[^a-z0-9]/g, '') === dId.replace(/[^a-z0-9]/g, ''))) return true;
    if (sName && t === sName) return true;
    return false;
  };

  // 1. Lessons completed for this student (attended)
  const studentLessons = allLessons.filter(l => l && (isMatch(l.studentId) || isMatch(l.studentName)));
  const attendedLessonsCount = studentLessons.filter(l => l.attendanceStatus !== 'Absent').length;

  // 2. Attendance records for this student
  const studentAtt = allAttendance.filter(a => a && (isMatch(a.studentId) || isMatch(a.studentName)));
  const attendedAttendanceCount = studentAtt.filter(a => a.status === 'Present').length;

  const loggedSessionsCount = Math.max(attendedLessonsCount, attendedAttendanceCount);

  // 3. Auto-calculate scheduled calendar days that have passed since joining / trial start
  let scheduledPassedCount = 0;
  const studentClasses = allClasses.filter(c => c && (isMatch(c.studentId) || isMatch(c.studentName)) && c.status !== 'Cancelled');
  const startDateStr = student.trialStartDate || student.joiningDate || student.createdAt?.slice(0, 10);

  if (startDateStr && studentClasses.length > 0) {
    try {
      const startDate = new Date(startDateStr);
      startDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const scheduledDayIndexes = new Set(
        studentClasses.map(c => dayNames.indexOf(c.dayOfWeek)).filter(idx => idx !== -1)
      );

      if (scheduledDayIndexes.size > 0 && !isNaN(startDate.getTime())) {
        const cur = new Date(startDate);
        while (cur <= today && scheduledPassedCount < totalTrialDays) {
          if (scheduledDayIndexes.has(cur.getDay())) {
            scheduledPassedCount++;
          }
          cur.setDate(cur.getDate() + 1);
        }
      }
    } catch (_) {}
  }

  // Combine signals: attended logs, scheduled days passed, and stored explicit count
  const explicitStored = student.trialSessionsCompleted || 0;
  const daysCompleted = Math.min(totalTrialDays, Math.max(loggedSessionsCount, scheduledPassedCount, explicitStored));
  const percentage = Math.min(100, Math.round((daysCompleted / totalTrialDays) * 100));
  const isFinished = daysCompleted >= totalTrialDays;

  let stageLabel = 'Day 1';
  let stageBadgeColor = 'bg-blue-100 text-blue-800 border-blue-200';

  if (daysCompleted === 0) {
    stageLabel = 'Day 1';
    stageBadgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
  } else if (daysCompleted === 1) {
    stageLabel = 'Day 1 Done';
    stageBadgeColor = 'bg-indigo-100 text-indigo-800 border-indigo-200';
  } else if (daysCompleted < totalTrialDays) {
    stageLabel = `Day ${daysCompleted} Done`;
    stageBadgeColor = 'bg-purple-100 text-purple-800 border-purple-200';
  } else {
    stageLabel = '5/5 Done (Decision Pending)';
    stageBadgeColor = 'bg-amber-100 text-amber-900 border-amber-300';
  }

  return {
    daysCompleted,
    totalTrialDays,
    percentage,
    isFinished,
    stageLabel,
    stageBadgeColor
  };
}
