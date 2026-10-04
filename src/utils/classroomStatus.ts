import { Tutor, TimetableClass, Student } from '../types';
import { LiveRoomStatusItem } from '../services/livekitService';
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
  studentsInRoom: string[];
  waitingStudents: string[];
  scheduledStudentName: string | null;
  scheduledCourse: string | null;
  scheduledTimeText: string | null;
}

/**
 * Converts "HH:MM" string to minutes from midnight
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * Get current Pakistan Time (PKT) in minutes from midnight and current teaching day
 */
export function getCurrentPKTTimeInfo(): { currentMinutes: number; currentDay: string; currentTimeStr: string } {
  const now = new Date();
  const pktString = now.toLocaleString('en-US', { timeZone: 'Asia/Karachi' });
  const pktDate = new Date(pktString);
  const currentMinutes = pktDate.getHours() * 60 + pktDate.getMinutes();
  const currentTimeStr = `${pktDate.getHours().toString().padStart(2, '0')}:${pktDate.getMinutes().toString().padStart(2, '0')}`;
  const currentDay = getCurrentTeachingDay();
  return { currentMinutes, currentDay, currentTimeStr };
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
  const { currentMinutes, currentDay } = getCurrentPKTTimeInfo();

  // All active classes for this tutor today
  const tutorClassesToday = allClasses.filter(c => 
    c.tutorId === tutor.tutorId && 
    c.status !== 'Cancelled' && 
    c.dayOfWeek === currentDay
  ).sort((a, b) => a.startTimePKT.localeCompare(b.startTimePKT));

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
  const studentsInRoom = liveItem?.students || [];
  const waitingStudents = liveItem?.waitingStudents || [];

  let status: DynamicClassroomStatus = 'idle';
  let statusBadgeText = 'Room Ready / Idle';
  let statusColor: 'emerald' | 'amber' | 'orange' | 'blue' | 'gray' = 'gray';

  if (liveStatus === 'running') {
    status = 'running';
    const studentsStr = studentsInRoom.length > 0 ? studentsInRoom.join(', ') : (activeScheduledClass?.studentName || 'Student');
    statusBadgeText = `🟢 Class Running (${participantCount} in Room: Tutor & ${studentsStr})`;
    statusColor = 'emerald';
  } else if (liveStatus === 'tutor_waiting') {
    status = 'tutor_waiting';
    const targetStudent = activeScheduledClass?.studentName || 'Student';
    statusBadgeText = `🟡 Tutor in Room (Waiting for ${targetStudent})`;
    statusColor = 'amber';
  } else if (liveStatus === 'student_waiting') {
    status = 'student_waiting';
    const waitName = waitingStudents[0] || activeScheduledClass?.studentName || 'Student';
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
    ? allStudents.find(s => s.studentId === activeScheduledClass?.studentId) 
    : null;

  return {
    status,
    statusBadgeText,
    statusColor,
    activeScheduledClass,
    nextScheduledClass,
    todayClasses: tutorClassesToday,
    isBusy: status === 'running' || status === 'tutor_waiting' || status === 'student_waiting' || status === 'scheduled_now',
    participantCount,
    studentsInRoom,
    waitingStudents,
    scheduledStudentName: activeScheduledClass?.studentName || scheduledStudentObj?.name || null,
    scheduledCourse: scheduledStudentObj?.courseType || null,
    scheduledTimeText: activeScheduledClass ? `${activeScheduledClass.startTimePKT} PKT (${activeScheduledClass.durationMinutes || 30} mins)` : null
  };
}
