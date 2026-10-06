import { Tutor, TimetableClass, Student } from '../types';
import { LiveRoomStatusItem, WaitingQueueDetailItem } from '../services/livekitService';
import { getCurrentTeachingDay } from './timezone';

export type DynamicClassroomStatus = 'running' | 'tutor_waiting' | 'student_waiting' | 'scheduled_now' | 'idle';

export interface ClassroomComputedStatus {
  status: DynamicClassroomStatus;
  statusBadgeText: string;
  statusColor: 'emerald' | 'amber' | 'orange' | 'blue' | 'gray';
  activeScheduledClass: TimetableClass | null;
  nextScheduledClass: TimetableClass | null;
  todayClasses: TimetableClass[];
  isBusy: boolean;
  participantCount: number;
  tutorNameInRoom: string | null;
  studentsInRoom: string[];
  waitingCount: number;
  waitingStudents: string[];
  waitingDetails: WaitingQueueDetailItem[];
  hasStudentWaitingInQueue: boolean;
  scheduledStudentName: string | null;
  scheduledCourse: string | null;
  scheduledTimeText: string | null;
}

/**
 * Converts "HH:MM" or "H:MM AM/PM" string to minutes from midnight
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim().toUpperCase();
  const isPM = clean.includes('PM');
  const isAM = clean.includes('AM');
  const timePart = clean.replace(/AM|PM|PKT/gi, '').trim();
  const parts = timePart.split(':');
  let h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;
  return h * 60 + m;
}

/**
 * Get current Pakistan Time (PKT) in minutes from midnight and current teaching day
 */
export function getCurrentPKTTimeInfo(): {
  currentMinutes: number;
  currentDay: string;
  pktCalendarDay: string;
  currentTimeStr: string;
} {
  const now = new Date();
  const pktString = now.toLocaleString('en-US', { timeZone: 'Asia/Karachi' });
  const pktDate = new Date(pktString);
  const currentMinutes = pktDate.getHours() * 60 + pktDate.getMinutes();
  const currentTimeStr = `${pktDate.getHours().toString().padStart(2, '0')}:${pktDate.getMinutes().toString().padStart(2, '0')}`;
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const pktCalendarDay = DAYS[pktDate.getDay()] || getCurrentTeachingDay();
  const currentDay = getCurrentTeachingDay();
  return { currentMinutes, currentDay, pktCalendarDay, currentTimeStr };
}

/**
 * Formats waiting seconds into a concise badge string (e.g. "Waiting 2m" or "Waiting 35s")
 */
export function formatWaitingBadgeDuration(seconds?: number): string {
  const secs = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(secs / 60);
  if (mins >= 1) {
    return `Waiting ${mins}m`;
  }
  return `Waiting ${secs}s`;
}

/**
 * Evaluates real-time running/waiting/scheduled status for a tutor's classroom
 */
export function computeTutorClassroomStatus(
  tutor: Tutor,
  allClasses: TimetableClass[],
  allStudents: Student[],
  liveItem?: LiveRoomStatusItem | null
): ClassroomComputedStatus {
  const { currentMinutes, currentDay, pktCalendarDay } = getCurrentPKTTimeInfo();
  const targetTutorIdLower = (tutor.tutorId || '').trim().toLowerCase();

  // All active classes for this tutor on the current teaching day
  let tutorClassesToday = allClasses
    .filter(
      (c) =>
        (c.tutorId || '').trim().toLowerCase() === targetTutorIdLower &&
        c.status !== 'Cancelled' &&
        c.dayOfWeek === currentDay
    )
    .sort((a, b) => timeStringToMinutes(a.startTimePKT) - timeStringToMinutes(b.startTimePKT));

  // If no classes matched currentDay (e.g. classes entered under PKT calendar day), fall back to pktCalendarDay
  if (tutorClassesToday.length === 0 && pktCalendarDay !== currentDay) {
    tutorClassesToday = allClasses
      .filter(
        (c) =>
          (c.tutorId || '').trim().toLowerCase() === targetTutorIdLower &&
          c.status !== 'Cancelled' &&
          c.dayOfWeek === pktCalendarDay
      )
      .sort((a, b) => timeStringToMinutes(a.startTimePKT) - timeStringToMinutes(b.startTimePKT));
  }

  // Find if there is a class scheduled right now
  let activeScheduledClass: TimetableClass | null = null;
  let nextScheduledClass: TimetableClass | null = null;

  for (const c of tutorClassesToday) {
    const startMin = timeStringToMinutes(c.startTimePKT);
    const duration = c.durationMinutes || 30;
    const endMin = startMin + duration;

    // Active window (includes 5-minute pre-class buffer for tutor setup)
    if (currentMinutes >= startMin - 5 && currentMinutes < endMin) {
      activeScheduledClass = c;
      break;
    } else if (startMin > currentMinutes && !nextScheduledClass) {
      nextScheduledClass = c;
    }
  }

  const liveStatus = liveItem?.status || 'idle';
  const participantCount = liveItem?.participantCount || 0;
  const tutorNameInRoom = liveItem?.tutorName || tutor.realName || tutor.displayName || tutor.tutorId || null;
  const studentsInRoom = liveItem?.students || [];
  const waitingStudents = liveItem?.waitingStudents || [];
  const waitingDetails: WaitingQueueDetailItem[] =
    liveItem?.waitingDetails && liveItem.waitingDetails.length > 0
      ? liveItem.waitingDetails
      : waitingStudents.map((name, idx) => ({
          id: `wait_${idx}`,
          name,
          waitingSeconds: 30,
          reason: liveStatus === 'running' ? 'NEXT_STUDENT_QUEUE' : 'TUTOR_NOT_PRESENT',
          queuePosition: idx + 1,
        }));
  const waitingCount = waitingDetails.length;
  const hasStudentWaitingInQueue = waitingCount > 0 || liveStatus === 'student_waiting';

  let status: DynamicClassroomStatus = 'idle';
  let statusBadgeText = 'Room Ready / Idle';
  let statusColor: 'emerald' | 'amber' | 'orange' | 'blue' | 'gray' = 'gray';

  if (liveStatus === 'running') {
    status = 'running';
    const studentsStr =
      studentsInRoom.length > 0 ? studentsInRoom.join(', ') : activeScheduledClass?.studentName || 'Student';
    statusBadgeText =
      waitingCount > 0
        ? `🟢 Class Running (${tutor.tutorId} & ${studentsStr}) · ⏳ +${waitingCount} Waiting in Queue`
        : `🟢 Class Running (${participantCount} in Room: Tutor & ${studentsStr})`;
    statusColor = 'emerald';
  } else if (liveStatus === 'tutor_waiting') {
    status = 'tutor_waiting';
    const targetStudent = activeScheduledClass?.studentName || 'Student';
    statusBadgeText = `🟡 Tutor in Room (Waiting for ${targetStudent})`;
    statusColor = 'amber';
  } else if (liveStatus === 'student_waiting') {
    status = 'student_waiting';
    const waitName = waitingStudents[0] || studentsInRoom[0] || activeScheduledClass?.studentName || 'Student';
    statusBadgeText = `🟠 Student Waiting (${waitName} waiting for Tutor)`;
    statusColor = 'orange';
  } else if (activeScheduledClass) {
    status = 'scheduled_now';
    statusBadgeText = `🔵 Scheduled Now: ${activeScheduledClass.studentName} (${activeScheduledClass.startTimePKT} PKT)`;
    statusColor = 'blue';
  } else {
    status = 'idle';
    if (nextScheduledClass) {
      statusBadgeText = `⚪ Idle (Next: ${nextScheduledClass.studentName} at ${nextScheduledClass.startTimePKT} PKT)`;
    } else {
      statusBadgeText = `⚪ Idle (No further classes today)`;
    }
    statusColor = 'gray';
  }

  const scheduledStudentObj = activeScheduledClass
    ? allStudents.find((s) => s.studentId === activeScheduledClass?.studentId)
    : null;

  return {
    status,
    statusBadgeText,
    statusColor,
    activeScheduledClass,
    nextScheduledClass,
    todayClasses: tutorClassesToday,
    isBusy:
      status === 'running' ||
      status === 'tutor_waiting' ||
      status === 'student_waiting' ||
      status === 'scheduled_now',
    participantCount,
    tutorNameInRoom,
    studentsInRoom,
    waitingCount,
    waitingStudents,
    waitingDetails,
    hasStudentWaitingInQueue,
    scheduledStudentName: activeScheduledClass?.studentName || scheduledStudentObj?.name || null,
    scheduledCourse: scheduledStudentObj?.courseType || null,
    scheduledTimeText: activeScheduledClass
      ? `${activeScheduledClass.startTimePKT} PKT (${activeScheduledClass.durationMinutes || 30} mins)`
      : null,
  };
}
