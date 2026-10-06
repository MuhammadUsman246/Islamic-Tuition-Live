import React, { useState, useMemo } from 'react';
import { useClassroom } from '../../context/ClassroomContext';
import { AnnouncementsList } from '../common/AnnouncementsList';
import {
  Video,
  Calendar,
  BookOpen,
  Users,
  CheckCircle,
  Plus,
  Sparkles,
  ExternalLink,
  Download,
  AlertCircle,
  Bell,
  X,
  FileText,
  FileSpreadsheet,
  Filter,
  Palmtree,
  Edit3,
  Lock,
  Clock,
  Radio,
  Share2,
  Eye,
  Play,
  Maximize2
} from 'lucide-react';
import {
  Tutor,
  Student,
  TimetableClass,
  Lesson,
  AttendanceRecord,
  TutorStudentView,
  Announcement,
  LiveKitRoomTokenResponse
} from '../../types';
import { TimetableGrid } from '../common/TimetableGrid';
import { LessonModal } from '../modals/LessonModal';
import { StudentMonthReportModal } from '../modals/StudentMonthReportModal';
import { TutorsTrainingPortal } from '../common/TutorsTrainingPortal';
import { launchTutorZoomDesktop } from '../../utils/zoomUtils';
import { getLocalClassroomSettings, fetchLiveKitToken, getCanonicalRoomName, getTutorSlug } from '../../services/livekitService';
import { IslamicTuitionClassroom } from '../classroom/IslamicTuitionClassroom';
import { sanitizeStudentForTutor, addLesson, updateLesson, addAttendanceRecord, updateClass, isSameTutor, normalizeTutorId, getCanonicalTutorDocId, loadOlderLessonsArchive, dismissNewStudentAssignmentForTutor, getDismissedTutorAssignmentKeys, getPendingTutorAssignmentKeys } from '../../services/dataService';
import { generateLessonReportPDF, generateStudentReportPDF } from '../../utils/pdfGenerator';
import { exportLessonsToCSV } from '../../utils/csvExporter';
import { useAuth } from '../../context/AuthContext';
import { getCurrentOperationalDate, isLessonInDateRange, getRelativeOperationalDate, normalizeDateString } from '../../utils/timezone';

interface TutorDashboardProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentTutorId: string;
  tutors: Tutor[];
  students: Student[];
  classes: TimetableClass[];
  lessons: Lesson[];
  attendance: AttendanceRecord[];
  announcements: Announcement[];
  onRefreshData: () => Promise<void>;
}

export const TutorDashboard: React.FC<TutorDashboardProps> = ({
  currentTab,
  setCurrentTab,
  currentTutorId,
  tutors,
  students,
  classes,
  lessons,
  attendance,
  announcements,
  onRefreshData
}) => {
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [editingLessonForTutor, setEditingLessonForTutor] = useState<Lesson | null>(null);
  const [selectedStudentForLesson, setSelectedStudentForLesson] = useState<string>('');
  const [selectedStudentForMonthReport, setSelectedStudentForMonthReport] = useState<Student | null>(null);
  const [selectedTrainingVideoIndex, setSelectedTrainingVideoIndex] = useState<number>(0);

  const TUTOR_TRAINING_PLAYLIST = [
    { index: 0, number: 1, id: '7YKnLGE1HCc', title: 'Training 1: قاعدہ پڑھانے کا طریقہ', description: 'Qaida Teaching Methodology — Part 1' },
    { index: 1, number: 2, id: '1kzjgukAIK8', title: 'Training 2: قاعدہ پڑھانے کا طریقہ', description: 'Qaida Teaching Methodology — Part 2' },
    { index: 2, number: 3, id: 'bN7obzrwghI', title: 'Training 3: قاعدہ پڑھانے کا طریقہ', description: 'Qaida Teaching Methodology — Part 3' },
    { index: 3, number: 4, id: 'uTAkl2uHYmg', title: 'Training 4: قاعدہ پڑھانے کا طریقہ', description: 'Qaida Teaching Methodology — Part 4' },
    { index: 4, number: 5, id: 'EkbjoJ3ON9E', title: 'Training 5: عَمَّ پارہ پڑھانے کا طریقہ', description: 'Amma Para Teaching Methodology' },
    { index: 5, number: 6, id: 'BK-sxzyf_gg', title: 'Training 6: الٓمٓ پارہ پڑھانے کا طریقہ', description: 'Alif Lam Meem Para Teaching Methodology' },
    { index: 6, number: 7, id: 'hJ9OboLX-uc', title: 'Training 7: قرآن پاک پڑھانے کا طریقہ', description: 'Holy Quran Recitation & Nazra Methodology' },
    { index: 7, number: 8, id: 'tS16QyZMmuA', title: 'Training 8: Memorization Lesson and Islamic Studies', description: 'Hifz, Daily Duas & Islamic Studies Guide' },
    { index: 8, number: 9, id: 'W4MgdwaprRo', title: 'Training 9: Trial Classes & Lesson Sheet', description: 'Conducting Trial Classes & Sheet Logging' },
    { index: 9, number: 10, id: 'gApxPYC_9N8', title: 'Training 10: Lesson Sheet Logging', description: 'Accurate Lesson Entry & Daily Tracking' },
    { index: 10, number: 11, id: 'Caj3-9sds7I', title: 'Training 11: Rules & Regulations 1', description: 'Faculty Discipline & Shift Protocol — Part 1' },
    { index: 11, number: 12, id: 'F3yX19erj3g', title: 'Training 12: Rules & Regulations 2', description: 'Faculty Discipline & Shift Protocol — Part 2' },
  ];
  const [isMonthReportModalOpen, setIsMonthReportModalOpen] = useState<boolean>(false);

  const { userProfile, adminViewingRole, adminViewingTargetId } = useAuth();

  // Identify current tutor with role/persona safety
  const tutor = React.useMemo(() => {
    if (adminViewingRole === 'tutor' && adminViewingTargetId) {
      const match = tutors.find(t => isSameTutor(t.tutorId, adminViewingTargetId));
      if (match) return match;
    }
    const directMatch = tutors.find(t =>
      (currentTutorId && isSameTutor(t.tutorId, currentTutorId)) ||
      (userProfile?.tutorId && isSameTutor(t.tutorId, userProfile.tutorId)) ||
      (userProfile?.email && t.email && t.email.toLowerCase().trim() === userProfile.email.toLowerCase().trim())
    );
    if (directMatch) return directMatch;

    const activeTutorId = currentTutorId || userProfile?.tutorId;
    if (activeTutorId) {
      const norm = normalizeTutorId(activeTutorId);
      return {
        id: getCanonicalTutorDocId(norm),
        tutorId: norm,
        realName: userProfile?.displayName || norm,
        displayName: userProfile?.displayName || norm,
        email: userProfile?.email || '',
        phone: userProfile?.phone || '',
        zoomLink: (userProfile as any)?.zoomLink || 'https://zoom.us',
        status: 'Active',
        availabilityStatus: 'Available',
        monthlySalaryPKR: 23000,
        hourlyRatePKR: 575,
        assignedStudentIds: [],
        createdAt: new Date().toISOString()
      } as Tutor;
    }

    return tutors[0];
  }, [tutors, currentTutorId, userProfile, adminViewingRole, adminViewingTargetId]);

  // Filter classes for this tutor
  const myClasses = classes.filter(c => isSameTutor(c.tutorId, tutor?.tutorId));

  // STRICT ALLOW-LIST PRIVACY: Filter and sanitize active students currently assigned to or scheduled with this tutor
  const classStudentIds = new Set(myClasses.map(c => c.studentId));
  const myAssignedStudents: TutorStudentView[] = students
    .filter(s => {
      // Exclude inactive / left / discontinued students
      if (s.status === 'Inactive' || s.status === 'Left' || s.status === 'Discontinued' || s.status === 'Withdrawn') {
        return false;
      }

      const isAssignedToMe = isSameTutor(s.assignedTutorId, tutor?.tutorId);
      const hasClassWithMe = classStudentIds.has(s.studentId);

      // If student has active class(es) on this tutor's schedule, include them
      if (hasClassWithMe) return true;

      // If student has classes with ANOTHER tutor, they were transferred/scheduled elsewhere
      const hasClassesWithOthers = classes.some(c => c.studentId === s.studentId && !isSameTutor(c.tutorId, tutor?.tutorId));
      if (hasClassesWithOthers) return false;

      // If student is assigned to this tutor AND has NO classes anywhere yet, keep them as a new assignment
      // (Unless assignedTutorId is 'Unassigned' or empty)
      return isAssignedToMe && !!s.assignedTutorId && s.assignedTutorId !== 'Unassigned';
    })
    .map(sanitizeStudentForTutor);

  // Filter lessons ONLY for currently active assigned students on this tutor's schedule
  const activeStudentIds = new Set(myAssignedStudents.map(s => s.studentId));
  const myLessons = lessons.filter(l => 
    isSameTutor(l.tutorId, tutor?.tutorId) && activeStudentIds.has(l.studentId)
  );

  // Time Period & Student Filter state for Tutor Lesson Reports (Defaults to Last 7 Days)
  const [reportTimeMode, setReportTimeMode] = useState<'all' | 'monthly' | '60days' | 'weekly' | 'custom'>('weekly');
  const [isLoadingOlderLessons, setIsLoadingOlderLessons] = useState<boolean>(false);
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>('all');
  const [tutorStartDate, setTutorStartDate] = useState<string>(() => getRelativeOperationalDate(-30));
  const [tutorEndDate, setTutorEndDate] = useState<string>(() => getCurrentOperationalDate());

  const filteredTutorLessons = useMemo(() => {
    return myLessons.filter(l => {
      if (selectedStudentFilter !== 'all' && l.studentId !== selectedStudentFilter) {
        return false;
      }
      return isLessonInDateRange(l.date, reportTimeMode, tutorStartDate, tutorEndDate);
    });
  }, [myLessons, selectedStudentFilter, reportTimeMode, tutorStartDate, tutorEndDate]);

  // Unified Attendance Tracking State & Computation (Auto-picked from Lesson Reports + Quick Attendance)
  const [attendanceStudentFilter, setAttendanceStudentFilter] = useState<string>('all');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<string>('all');

  const unifiedAttendanceRecords = useMemo(() => {
    const recordMap = new Map<string, {
      id: string;
      studentId: string;
      studentName: string;
      date: string;
      status: 'Present' | 'Late' | 'Absent' | 'Student on Leave';
      details?: string;
      source: 'Lesson Report' | 'Quick Attendance';
      timestamp?: string;
    }>();

    // 1. Add quick attendance records for this tutor
    attendance
      .filter(a => isSameTutor(a.tutorId, tutor?.tutorId))
      .forEach(a => {
        const key = `${a.studentId}_${a.date}`;
        recordMap.set(key, {
          id: `att_${a.id}`,
          studentId: a.studentId,
          studentName: a.studentName || a.studentId,
          date: a.date,
          status: a.status === 'Absent' ? 'Absent' : 'Present',
          details: a.notes || 'Verified quick attendance check',
          source: 'Quick Attendance',
          timestamp: a.markedAt
        });
      });

    // 2. Auto-pick & prioritize attendance records from Lesson Reports
    myLessons.forEach(l => {
      const key = `${l.studentId}_${l.date}`;
      const status = (l.attendanceStatus as any) || 'Present';
      let details = l.lessonType;
      if (status === 'Late' && l.lateMinutes) {
        details = `Late by ${l.lateMinutes} mins — ${l.lessonType}`;
      } else if (status === 'Absent') {
        details = l.absentReason ? `Absent: ${l.absentReason}` : 'Student Absent';
      } else if (l.lessonCovered && l.lessonCovered !== 'Absent') {
        details = l.lessonCovered;
      }

      recordMap.set(key, {
        id: `les_att_${l.id}`,
        studentId: l.studentId,
        studentName: l.studentName || l.studentId,
        date: l.date,
        status,
        details,
        source: 'Lesson Report',
        timestamp: l.createdAt
      });
    });

    return Array.from(recordMap.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [attendance, myLessons, tutor?.tutorId]);

  const filteredAttendance = useMemo(() => {
    return unifiedAttendanceRecords.filter(r => {
      if (attendanceStudentFilter !== 'all' && r.studentId !== attendanceStudentFilter) {
        return false;
      }
      if (attendanceStatusFilter !== 'all' && r.status !== attendanceStatusFilter) {
        return false;
      }
      return true;
    });
  }, [unifiedAttendanceRecords, attendanceStudentFilter, attendanceStatusFilter]);

  const attendanceStats = useMemo(() => {
    const base = attendanceStudentFilter === 'all'
      ? unifiedAttendanceRecords
      : unifiedAttendanceRecords.filter(r => r.studentId === attendanceStudentFilter);
    const total = base.length;
    const present = base.filter(r => r.status === 'Present').length;
    const late = base.filter(r => r.status === 'Late').length;
    const absent = base.filter(r => r.status === 'Absent').length;
    const onLeave = base.filter(r => r.status === 'Student on Leave').length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;
    return { total, present, late, absent, onLeave, rate };
  }, [unifiedAttendanceRecords, attendanceStudentFilter]);

  // One-time New Student Notifications tracking for Tutor (ONLY newly added/assigned students, never existing roster)
  const normActiveTutorId = normalizeTutorId(tutor?.tutorId || currentTutorId || 'Tutor 1');
  const [dismissedStudentKeys, setDismissedStudentKeys] = useState<string[]>(() => getDismissedTutorAssignmentKeys());
  const [pendingNewAssignmentKeys, setPendingNewAssignmentKeys] = useState<string[]>(() => getPendingTutorAssignmentKeys());

  React.useEffect(() => {
    setDismissedStudentKeys(getDismissedTutorAssignmentKeys());
    setPendingNewAssignmentKeys(getPendingTutorAssignmentKeys());
  }, [normActiveTutorId, students.length, classes.length]);

  const isStudentDismissed = (studentId?: string, studentName?: string) => {
    const idUpper = (studentId || '').trim().toUpperCase();
    const nameLower = (studentName || '').trim().toLowerCase();
    return (
      (idUpper && (dismissedStudentKeys.includes(`${normActiveTutorId}__${idUpper}`) || dismissedStudentKeys.includes(idUpper))) ||
      (nameLower && (dismissedStudentKeys.includes(`${normActiveTutorId}__${nameLower}`) || dismissedStudentKeys.includes(nameLower)))
    );
  };

  const isStudentNewlyAddedForTutor = (st?: TutorStudentView | Student, studentId?: string, studentName?: string) => {
    const idUpper = (st?.studentId || studentId || '').trim().toUpperCase();
    const nameLower = (st?.name || studentName || '').trim().toLowerCase();
    if (isStudentDismissed(idUpper, nameLower)) return false;

    const inPendingLocal =
      (idUpper && pendingNewAssignmentKeys.includes(`${normActiveTutorId}__${idUpper}`)) ||
      (nameLower && pendingNewAssignmentKeys.includes(`${normActiveTutorId}__${nameLower}`));

    return Boolean(st?.isNewTutorAssignment || inPendingLocal);
  };

  // Group ONLY newly added & unacknowledged students (1 small notification per newly added student)
  const groupedNewAssignments = useMemo(() => {
    const dayOrder: Record<string, number> = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };
    const results: Array<{
      studentKey: string;
      studentName: string;
      studentId: string;
      studentAge?: number;
      time: string;
      daysLabel: string;
      scheduleSummary: string;
      identifiers: string[];
    }> = [];

    myAssignedStudents.forEach(st => {
      if (!isStudentNewlyAddedForTutor(st, st.studentId, st.name)) return;

      const studentClasses = myClasses.filter(
        c => (c.studentId && c.studentId === st.studentId) || (c.studentName && c.studentName.toLowerCase() === st.name.toLowerCase())
      );

      if (studentClasses.length > 0) {
        const first = studentClasses[0];
        const sortedDays = Array.from(new Set<string>(studentClasses.map(c => String(c.dayOfWeek)))).sort((a, b) => (dayOrder[a] || 99) - (dayOrder[b] || 99));
        let daysLabel = sortedDays.join(', ');
        if (sortedDays.length >= 3 && sortedDays[0] === 'Monday' && sortedDays[sortedDays.length - 1] === 'Friday') {
          daysLabel = 'Mon - Fri';
        } else if (sortedDays.length === 2 && sortedDays[0] === 'Saturday' && sortedDays[1] === 'Sunday') {
          daysLabel = 'Weekends';
        }
        const daysCount = sortedDays.length;
        const scheduleSummary = daysCount === 1
          ? `1 day/week (${sortedDays[0]})`
          : `${daysCount} days/week (${daysLabel})`;

        results.push({
          studentKey: st.studentId || st.name,
          studentName: st.name,
          studentId: st.studentId,
          studentAge: st.age,
          time: `${first.startTimePKT} PKT`,
          daysLabel,
          scheduleSummary,
          identifiers: [st.studentId, st.name]
        });
      } else {
        results.push({
          studentKey: st.studentId || st.name,
          studentName: st.name,
          studentId: st.studentId,
          studentAge: st.age,
          time: 'Schedule Pending',
          daysLabel: 'Pending Schedule',
          scheduleSummary: 'New Student Assigned',
          identifiers: [st.studentId, st.name]
        });
      }
    });

    return results;
  }, [myAssignedStudents, myClasses, dismissedStudentKeys, pendingNewAssignmentKeys, normActiveTutorId]);

  const handleAcknowledgeStudentGroup = (identifiers: string[]) => {
    dismissNewStudentAssignmentForTutor(normActiveTutorId, identifiers);
    setDismissedStudentKeys(getDismissedTutorAssignmentKeys());
    setPendingNewAssignmentKeys(getPendingTutorAssignmentKeys());
    onRefreshData().catch(() => {});
  };

  const handleAcknowledgeAll = () => {
    const allIdentifiers = groupedNewAssignments.flatMap(g => g.identifiers);
    dismissNewStudentAssignmentForTutor(normActiveTutorId, allIdentifiers);
    setDismissedStudentKeys(getDismissedTutorAssignmentKeys());
    setPendingNewAssignmentKeys(getPendingTutorAssignmentKeys());
    onRefreshData().catch(() => {});
  };

  const handleSaveLesson = async (lessonData: Omit<Lesson, 'id'>) => {
    await addLesson({
      ...lessonData,
      tutorId: tutor?.tutorId || 'Tutor 6'
    });
    await onRefreshData();
  };

  const handleUpdateLesson = async (id: string, updates: Partial<Lesson>) => {
    await updateLesson(id, {
      ...updates,
      isEdited: true,
      updatedAt: new Date().toISOString()
    });
    await onRefreshData();
  };

  const handleQuickAttendance = async (studentId: string, studentName: string, status: 'Present' | 'Absent') => {
    await addAttendanceRecord({
      classId: 'tutor_quick',
      studentId,
      studentName,
      tutorId: tutor?.tutorId || 'Tutor 6',
      date: new Date().toISOString().slice(0, 10),
      status,
      markedBy: tutor?.tutorId || 'Tutor',
      markedAt: new Date().toISOString()
    });
    alert(`Marked ${status} for ${studentName}`);
    await onRefreshData();
  };

  const handleLaunchZoomDesktop = (e: React.MouseEvent) => {
    e.preventDefault();
    launchTutorZoomDesktop(tutor?.zoomLink);
  };

  // LiveKit Pilot Classroom Integration for Tutors
  const [isLiveKitModalOpen, setIsLiveKitModalOpen] = useState<boolean>(false);
  const [liveKitTokenData, setLiveKitTokenData] = useState<LiveKitRoomTokenResponse | null>(null);
  const [isJoiningLiveKit, setIsJoiningLiveKit] = useState<boolean>(false);
  const [customRoomCode, setCustomRoomCode] = useState<string>('');
  const classroomSettings = useMemo(() => getLocalClassroomSettings(), []);
  const isAllowedTestTutor = useMemo(() => {
    if (!classroomSettings.classroomEnabled) return true;
    const currentId = tutor?.tutorId || currentTutorId;
    if (!currentId) return true;
    if (classroomSettings.allowedTestTutorIds.includes('all')) return true;
    return classroomSettings.allowedTestTutorIds.includes(currentId);
  }, [classroomSettings, tutor?.tutorId, currentTutorId]);

  const { joinClassroomSession } = useClassroom();

  const handleJoinLiveKitTestClass = async (targetStudentId?: string, overrideRoomCode?: string) => {
    try {
      setIsJoiningLiveKit(true);
      const activeTutorId = normalizeTutorId(tutor?.tutorId || currentTutorId || 'Tutor 1');
      const roomName = getCanonicalRoomName(activeTutorId, targetStudentId, overrideRoomCode || customRoomCode);
      const tokenRes = await fetchLiveKitToken({
        roomId: roomName,
        identity: `tutor_${getTutorSlug(activeTutorId)}`,
        participantName: activeTutorId,
        role: 'tutor',
        customServerUrl: classroomSettings.livekitServerUrl || undefined,
      });
      setLiveKitTokenData(tokenRes);
      setIsLiveKitModalOpen(true);
    } catch (err: any) {
      alert(`Could not launch Live Classroom: ${err?.message || err}`);
    } finally {
      setIsJoiningLiveKit(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* LiveKit Classroom Modal for Allowed Test Tutors */}
      {isLiveKitModalOpen && liveKitTokenData && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 p-2 sm:p-4 md:p-6 flex flex-col justify-center animate-in fade-in duration-200">
          <div className="w-full h-full max-w-7xl mx-auto flex flex-col">
            <IslamicTuitionClassroom
              roomName={liveKitTokenData.roomName}
              tokenData={liveKitTokenData}
              userRole="tutor"
              participantName={normalizeTutorId(tutor?.tutorId || currentTutorId || 'Tutor 1')}
              settings={classroomSettings}
              onLeave={() => setIsLiveKitModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Top Banner: Permanent Zoom Classroom & Quick Log Lesson */}
      <div className="bg-[#1E5C3D] text-white p-6 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#E8A93E] text-white text-[10px] font-bold uppercase tracking-wider">
              {tutor?.tutorId || 'Tutor'} · Assigned ID
            </span>
            <span className="text-xs text-[#b8dbca]">Schedule Timezone: Pakistan Time (PKT)</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            Assalamu Alaykum, {tutor?.realName || 'Ustadh'}{' '}
            <span className="text-sm font-semibold text-emerald-200">({tutor?.tutorId || currentTutorId})</span>
          </h2>
          <p className="text-xs text-[#d2e8dd] max-w-xl">
            Welcome to your teaching hub. Launch your permanent Zoom classroom link to conduct classes and submit structured reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* IslamicTuition Live Classroom Start Button */}
          <button
            type="button"
            id="tutor_livekit_launch_button"
            onClick={() => handleJoinLiveKitTestClass()}
            disabled={isJoiningLiveKit}
            className="px-5 py-2.5 rounded-xl bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white font-bold text-xs transition-colors flex items-center space-x-2 shadow-md cursor-pointer ring-2 ring-emerald-400/30 active:scale-95"
            title="Start your live audio Quran classroom"
          >
            <Radio className="w-4 h-4 text-[#E8A93E] animate-pulse" />
            <span>{isJoiningLiveKit ? 'Connecting...' : 'Start Live Classroom'}</span>
          </button>

          {/* Permanent Zoom Fallback Action Button */}
          <button
            type="button"
            id="tutor_zoom_launch_button"
            onClick={handleLaunchZoomDesktop}
            className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 font-semibold text-xs transition-colors flex items-center space-x-2 border border-slate-600/50 shadow-xs cursor-pointer"
            title="Launch Zoom classroom as fallback"
          >
            <Video className="w-3.5 h-3.5 text-blue-400" />
            <span>Zoom (Fallback)</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </button>

          {/* Quick Log Lesson Button */}
          <button
            id="tutor_log_lesson_button"
            onClick={() => {
              setEditingLessonForTutor(null);
              setSelectedStudentForLesson(myAssignedStudents[0]?.studentId || '');
              setIsLessonModalOpen(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-[#1E5C3D] font-semibold text-xs transition-colors flex items-center space-x-2 shadow-xs cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-[#2D8B5C]" />
            <span>Record Lesson Report</span>
          </button>
        </div>
      </div>

      {/* Active Academy Announcements Banner */}
      {announcements && announcements.length > 0 && (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <div
              key={ann.id}
              className="bg-[#FFF9EE] border border-[#E8A93E]/60 p-4 rounded-2xl shadow-xs space-y-2 border-l-4 border-l-[#E8A93E]"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E8A93E] animate-pulse" />
                  <h4 className="text-xs font-bold text-[#161F1A] uppercase tracking-wider">
                    📢 Academy Notice: {ann.title}
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-[#8C5D08] bg-white px-2 py-0.5 rounded font-bold border border-[#E8A93E]/30">
                  By {ann.authorName} {ann.endDate ? `• Expires: ${ann.endDate}` : ''}
                </span>
              </div>
              <p className="text-xs text-[#161F1A] leading-relaxed whitespace-pre-wrap font-medium pt-1">
                {ann.content}
              </p>
            </div>
          ))}
        </div>
      )}


      {/* Small Compact One-Time Notification for Newly Added Students */}
      {groupedNewAssignments.length > 0 && (
        <div className="bg-[#EEF8F3] border border-[#2D8B5C]/40 px-4 py-2.5 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center space-x-2.5 min-w-0">
            <span className="w-6 h-6 rounded-full bg-[#2D8B5C] text-white flex items-center justify-center shrink-0">
              <Bell className="w-3.5 h-3.5" />
            </span>
            <div className="text-xs text-[#161F1A] truncate">
              <span className="font-extrabold text-[#1E5C3D] mr-1.5">New Student Added:</span>
              {groupedNewAssignments.map((ga, i) => (
                <span key={ga.studentKey} className="font-semibold">
                  {i > 0 ? ' • ' : ''}
                  {ga.studentName} ({ga.studentId}) — {ga.scheduleSummary} ({ga.time})
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={handleAcknowledgeAll}
            className="px-3 py-1 rounded-lg bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-[11px] font-bold transition-colors cursor-pointer shrink-0 flex items-center space-x-1"
          >
            <span>Dismiss</span>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}



      {/* TAB 1: WEEKLY TIMETABLE */}
      {currentTab === 'tutor_timetable' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#161F1A]">My Weekly Teaching Schedule</h3>
              <p className="text-xs text-[#5A6B61]">
                Your weekly class schedule in Pakistan Time (PKT). 30-minute standard sessions.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-[#2D8B5C]/10 text-[#1E5C3D]">
              {myClasses.length} Scheduled Sessions / Week
            </span>
          </div>

          <TimetableGrid
            classes={myClasses}
            role="tutor"
            currentTutorId={tutor?.tutorId}
            students={students}
            tutors={tutors}
            onCancelClass={async (classId, newStatus) => {
              await updateClass(classId, { status: newStatus });
              await onRefreshData();
            }}
            onLogLesson={(studentId) => {
              setEditingLessonForTutor(null);
              setSelectedStudentForLesson(studentId);
              setIsLessonModalOpen(true);
            }}
          />
        </div>
      )}

      {/* TAB 2: ASSIGNED STUDENTS */}
      {currentTab === 'tutor_students' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-[#161F1A]">My Assigned Students</h3>
            <p className="text-xs text-[#5A6B61]">
              Directory of students assigned to your classes for Quran, Qaida, and Islamic studies.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myAssignedStudents.map((st) => (
              <div key={st.studentId} className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold text-[#2D8B5C]">{st.studentId}</span>
                      {st.age !== undefined && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#E8F5EE] text-[#1E5C3D] border border-emerald-200">
                          Age: {st.age}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-[#161F1A]">{st.name}</h4>
                  </div>
                  {st.status === 'Trial' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF9ED] text-[#8C5D08] border border-[#E8A93E]/40 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Trial ({st.trialSessionsCompleted || 0}/5)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      {st.status}
                    </span>
                  )}
                  {st.isOnLeave && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1" title={`${st.leaveReason || 'On leave'} (${st.leaveStartDate || ''} to ${st.leaveEndDate || 'indefinite'})`}>
                      <Palmtree className="w-3 h-3 text-amber-700" /> On Leave
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs bg-[#FAF9F7] p-3 rounded-lg border border-[#E3DFD7]">
                  <p><strong>Course:</strong> {st.courseType}</p>
                  <p><strong>Student Age:</strong> {st.age !== undefined ? `${st.age} years old` : 'Not specified'}</p>
                  <p className="text-[#5A6B61]"><strong>Schedule Timezone:</strong> Pakistan Time (PKT)</p>
                  {st.status === 'Trial' && (
                    <p className="text-[#8C5D08]">
                      <strong>Trial Progress:</strong> {st.trialSessionsCompleted} of 5 completed
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-[#EAE6DE] grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setEditingLessonForTutor(null);
                      setSelectedStudentForLesson(st.studentId);
                      setIsLessonModalOpen(true);
                    }}
                    className="py-2 px-2 text-xs font-semibold text-white bg-[#2D8B5C] hover:bg-[#1E5C3D] rounded-lg transition-colors flex items-center justify-center space-x-1 shadow-2xs cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Log Lesson</span>
                  </button>

                  <button
                    onClick={() => {
                      const fullStudentObj = students.find(s => s.studentId === st.studentId) || null;
                      setSelectedStudentForMonthReport(fullStudentObj);
                      setIsMonthReportModalOpen(true);
                    }}
                    className="py-2 px-2 text-xs font-semibold text-[#1E5C3D] bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center justify-center space-x-1 border border-emerald-200 cursor-pointer"
                    title="View student's 30-day lesson progression history"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#2D8B5C]" />
                    <span>30-Day Report</span>
                  </button>
                </div>


              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: LESSON REPORTS */}
      {currentTab === 'tutor_lessons' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white p-4 rounded-xl border border-[#E3DFD7] shadow-xs">
            <div>
              <h3 className="text-base font-bold text-[#161F1A]">Lesson Reports History</h3>
              <p className="text-xs text-[#5A6B61]">
                Structured reports submitted by you for student evaluations.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  if (filteredTutorLessons.length === 0) {
                    alert("No completed lessons match your selected filter range to export.");
                    return;
                  }
                  const studentObj = selectedStudentFilter !== 'all' ? students.find(s => s.studentId === selectedStudentFilter) : null;
                  const activeTutorLabel = tutor?.tutorId || currentTutorId || 'Tutor';
                  const label = studentObj ? `${studentObj.name} Lessons` : `${activeTutorLabel} Lessons`;
                  exportLessonsToCSV(
                    label,
                    filteredTutorLessons,
                    `Filter (${reportTimeMode.toUpperCase()})`,
                    { tutorName: activeTutorLabel, studentName: studentObj?.name }
                  );
                }}
                className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => {
                  if (filteredTutorLessons.length === 0) {
                    alert("No completed lessons match your selected filter range to export.");
                    return;
                  }
                  const studentObj = selectedStudentFilter !== 'all' ? students.find(s => s.studentId === selectedStudentFilter) : null;
                  if (studentObj) {
                    generateStudentReportPDF(studentObj, filteredTutorLessons, `Tutor Report (${reportTimeMode})`);
                  } else {
                    // Export first lesson or summary
                    generateLessonReportPDF(filteredTutorLessons[0]);
                  }
                }}
                className="px-3 py-1.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Export PDF</span>
              </button>

              <button
                onClick={() => {
                  setSelectedStudentForLesson(myAssignedStudents[0]?.studentId || '');
                  setIsLessonModalOpen(true);
                }}
                className="px-4 py-1.5 bg-[#161F1A] text-white text-xs font-semibold rounded-lg hover:bg-[#2A3830] flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Record New Lesson</span>
              </button>
            </div>
          </div>

          {/* Filtering Control Panel */}
          <div className="bg-[#FAF9F7] p-3.5 rounded-xl border border-[#E3DFD7] space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Student Dropdown */}
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-[#5A6B61]" />
                <span className="text-xs font-bold text-[#161F1A]">Student:</span>
                <select
                  value={selectedStudentFilter}
                  onChange={(e) => setSelectedStudentFilter(e.target.value)}
                  className="text-xs border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white font-medium focus:ring-1 focus:ring-[#2D8B5C] outline-none"
                >
                  <option value="all">All Assigned Students ({myAssignedStudents.length})</option>
                  {myAssignedStudents.map(s => (
                    <option key={s.studentId} value={s.studentId}>{s.name} ({s.studentId})</option>
                  ))}
                </select>
              </div>

              {/* Time Mode Pills */}
              <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-lg border border-[#E3DFD7]">
                {(['weekly', 'monthly', '60days', 'custom', 'all'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    disabled={isLoadingOlderLessons}
                    onClick={async () => {
                      setReportTimeMode(mode);
                      if (mode === 'monthly' || mode === '60days' || mode === 'all' || mode === 'custom') {
                        setIsLoadingOlderLessons(true);
                        try {
                          const days = mode === 'monthly' ? 35 : mode === '60days' ? 65 : mode === 'custom' ? 180 : 365;
                          await loadOlderLessonsArchive({ tutorId: tutor?.tutorId || currentTutorId, daysBack: days });
                          await onRefreshData();
                        } finally {
                          setIsLoadingOlderLessons(false);
                        }
                      }
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                      reportTimeMode === mode
                        ? 'bg-[#2D8B5C] text-white shadow-xs'
                        : 'text-[#5A6B61] hover:text-[#161F1A] hover:bg-gray-100'
                    }`}
                  >
                    {mode === 'weekly'
                      ? 'Last 7 Days'
                      : mode === 'monthly'
                      ? 'Last 30 Days'
                      : mode === '60days'
                      ? 'Last 60 Days'
                      : mode === 'custom'
                      ? 'Custom Range'
                      : isLoadingOlderLessons
                      ? 'Loading Older...'
                      : 'All Time'}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Inputs if mode === 'custom' */}
            {reportTimeMode === 'custom' && (
              <div className="flex items-center space-x-3 pt-2 border-t border-[#E3DFD7]">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-[#5A6B61] font-bold">From:</span>
                  <input
                    type="date"
                    value={tutorStartDate}
                    onChange={(e) => setTutorStartDate(e.target.value)}
                    className="border border-[#D5D0C6] rounded-lg px-2 py-1 text-xs bg-white font-mono outline-none"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-[#5A6B61] font-bold">To:</span>
                  <input
                    type="date"
                    value={tutorEndDate}
                    onChange={(e) => setTutorEndDate(e.target.value)}
                    className="border border-[#D5D0C6] rounded-lg px-2 py-1 text-xs bg-white font-mono outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {filteredTutorLessons.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-[#E3DFD7] text-center text-xs text-[#5A6B61] italic">
                No completed lesson reports found matching your selected student and date filters.
              </div>
            ) : (
              filteredTutorLessons.map(lesson => {
                const nowMs = Date.now();
                const createdMs = lesson.createdAt
                  ? new Date(lesson.createdAt).getTime()
                  : (lesson.date ? new Date(lesson.date).getTime() : 0);
                const hoursAgo = createdMs > 0 ? (nowMs - createdMs) / (1000 * 60 * 60) : 999;
                const isWithinGrace = createdMs > 0 && hoursAgo >= 0 && hoursAgo <= 10;
                const remainingMinsTotal = isWithinGrace ? Math.max(0, Math.floor((10 * 60) - (hoursAgo * 60))) : 0;
                const remHours = Math.floor(remainingMinsTotal / 60);
                const remMins = remainingMinsTotal % 60;

                return (
                <div key={lesson.id} className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-xs font-bold text-[#161F1A]">
                          {lesson.studentName} ({lesson.studentId}) — {lesson.lessonType}
                        </h4>
                        {lesson.attendanceStatus === 'Absent' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                            Absent
                          </span>
                        )}
                        {lesson.attendanceStatus === 'Late' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Late ({lesson.lateMinutes || 10} min)
                          </span>
                        )}
                        {lesson.attendanceStatus === 'Present' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Present
                          </span>
                        )}
                        {lesson.isEdited && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200"
                            title={`Edited on ${lesson.updatedAt ? new Date(lesson.updatedAt).toLocaleString() : 'recently'}`}
                          >
                            Edited
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#5A6B61]">{lesson.date} ({lesson.month})</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {isWithinGrace ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLessonForTutor(lesson);
                            setSelectedStudentForLesson(lesson.studentId);
                            setIsLessonModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-[#1E5C3D] bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center space-x-1.5 border border-emerald-200 cursor-pointer shadow-2xs"
                          title={`Editable for another ${remHours}h ${remMins}m`}
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#2D8B5C]" />
                          <span>Edit ({remHours}h {remMins}m left)</span>
                        </button>
                      ) : (
                        <span
                          className="px-2 py-0.5 text-[10px] font-medium text-gray-400 bg-gray-50 rounded border border-gray-200 flex items-center space-x-1"
                          title="10-hour tutor grace period expired. Contact supervisor or admin to make changes."
                        >
                          <Lock className="w-3 h-3 text-gray-400" />
                          <span>Locked (10h expired)</span>
                        </span>
                      )}
                      <button
                        onClick={() => generateLessonReportPDF(lesson)}
                        className="p-1 text-[#2D8B5C] hover:bg-gray-100 rounded cursor-pointer"
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                {lesson.attendanceStatus === 'Absent' ? (
                  <div className="bg-red-50/70 p-3 rounded-lg border border-red-200 text-xs text-red-700">
                    <span className="font-semibold block">Student Absent:</span>
                    <p className="text-[11px] text-red-600 mt-0.5">
                      {lesson.absentReason || 'No lesson conducted due to student absence.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-[#FAF9F7] p-3 rounded-lg border border-[#E3DFD7]">
                    <div>
                      <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Portion Recited</span>
                      <p className="font-medium text-[#161F1A] mt-0.5">{lesson.lessonCovered}</p>
                      {(lesson.mushafPage || lesson.quranDetails?.mushafPage) && (
                        <span className="inline-block mt-1 text-[10px] font-bold bg-[#E8F5EE] text-[#1E5C3D] px-2 py-0.5 rounded">
                          Page: {lesson.mushafPage || lesson.quranDetails?.mushafPage}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Memorization</span>
                      <p className="font-medium text-[#B87314] mt-0.5">{lesson.memorization || '—'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Adaab & Manners</span>
                      <p className="font-medium text-[#2D8B5C] mt-0.5">{lesson.adaabManners || '—'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Revision</span>
                      <p className="font-medium text-[#161F1A] mt-0.5">{lesson.revision || 'None'}</p>
                    </div>
                  </div>
                )}

                {lesson.screenshots && lesson.screenshots.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">
                      Lesson Pages / Screenshots ({lesson.screenshots.length}):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {lesson.screenshots.map((scr, idx) => (
                        <a
                          key={idx}
                          href={scr.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative block w-16 h-16 rounded-lg overflow-hidden border border-[#D5D0C6] hover:border-[#2D8B5C] shadow-2xs transition-all"
                        >
                          <img
                            src={scr.url}
                            alt={scr.name || `Screenshot ${idx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                </div>
                );
              }))}
          </div>
        </div>
      )}

      {/* TAB 4: UNIFIED ATTENDANCE TRACKING */}
      {currentTab === 'tutor_attendance' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-[#E3DFD7] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#161F1A]">Unified Class Attendance Log</h3>
                <p className="text-xs text-[#5A6B61]">
                  Attendance auto-picked in real-time from lesson submissions and quick-logs.
                </p>
              </div>

              {/* Student Filter Dropdown */}
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-[#5A6B61]" />
                <span className="text-xs font-bold text-[#161F1A]">Student:</span>
                <select
                  value={attendanceStudentFilter}
                  onChange={(e) => setAttendanceStudentFilter(e.target.value)}
                  className="text-xs border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white font-medium focus:ring-1 focus:ring-[#2D8B5C] outline-none"
                >
                  <option value="all">All Assigned Students ({myAssignedStudents.length})</option>
                  {myAssignedStudents.map(s => (
                    <option key={s.studentId} value={s.studentId}>{s.name} ({s.studentId})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Attendance Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
              <div className="bg-[#FAF9F7] p-3 rounded-xl border border-[#E3DFD7] text-left">
                <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Total Sessions</span>
                <span className="text-lg font-bold text-[#161F1A] mt-0.5 block">{attendanceStats.total}</span>
              </div>
              <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 text-left">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Present</span>
                <span className="text-lg font-bold text-emerald-800 mt-0.5 block">{attendanceStats.present}</span>
              </div>
              <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 text-left">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Late</span>
                <span className="text-lg font-bold text-amber-800 mt-0.5 block">{attendanceStats.late}</span>
              </div>
              <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200 text-left">
                <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Absent</span>
                <span className="text-lg font-bold text-rose-800 mt-0.5 block">{attendanceStats.absent}</span>
              </div>
              <div className="bg-[#EEF8F3] p-3 rounded-xl border border-[#2D8B5C]/30 text-left col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-[#1E5C3D] uppercase tracking-wider block">Attendance Rate</span>
                <span className="text-lg font-extrabold text-[#1E5C3D] mt-0.5 block">{attendanceStats.rate}%</span>
              </div>
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center space-x-1.5 pt-1 border-t border-[#EAE6DE]">
              <span className="text-[11px] font-bold text-[#5A6B61] mr-1">Filter Status:</span>
              {(['all', 'Present', 'Late', 'Absent'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setAttendanceStatusFilter(st)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    attendanceStatusFilter === st
                      ? 'bg-[#2D8B5C] text-white shadow-2xs'
                      : 'bg-[#FAF9F7] text-[#5A6B61] border border-[#E3DFD7] hover:bg-gray-100'
                  }`}
                >
                  {st === 'all' ? 'All Records' : st}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-[#E3DFD7] rounded-2xl overflow-hidden shadow-xs">
            {filteredAttendance.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#5A6B61] italic">
                No attendance logs found matching the selected student and status filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF9F7] border-b border-[#E3DFD7] text-[#5A6B61] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Attendance Status</th>
                      <th className="py-3 px-4">Class Details / Reason</th>
                      <th className="py-3 px-4">Origin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE6DE]">
                    {filteredAttendance.map(att => (
                      <tr key={att.id} className="hover:bg-[#FAF9F7]/60 transition-colors">
                        <td className="py-3 px-4 font-semibold text-[#161F1A] font-mono">{att.date}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-[#161F1A] block">{att.studentName}</span>
                          <span className="text-[10px] text-[#5A6B61] font-mono">{att.studentId}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center space-x-1 ${
                            att.status === 'Present'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : att.status === 'Late'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : att.status === 'Absent'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              att.status === 'Present' ? 'bg-emerald-600' :
                              att.status === 'Late' ? 'bg-amber-600' :
                              att.status === 'Absent' ? 'bg-rose-600' : 'bg-blue-600'
                            }`} />
                            <span>{att.status}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#161F1A] max-w-xs truncate font-medium">
                          {att.details || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[10px] font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200">
                            {att.source}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: TUTORS TRAINING VIDEOS */}
      {currentTab === 'tutor_training' && (
        <TutorsTrainingPortal />
      )}

      {/* TAB 6: ANNOUNCEMENTS */}
      {currentTab === 'announcements' && (
        <AnnouncementsList announcements={announcements} />
      )}

      {/* Lesson Modal */}
      <LessonModal
        isOpen={isLessonModalOpen}
        onClose={() => {
          setIsLessonModalOpen(false);
          setEditingLessonForTutor(null);
        }}
        onSave={handleSaveLesson}
        onUpdate={handleUpdateLesson}
        editingLesson={editingLessonForTutor}
        students={students.filter(s => isSameTutor(s.assignedTutorId, tutor?.tutorId) || classStudentIds.has(s.studentId))}
        currentTutorId={tutor?.tutorId}
        initialStudentId={selectedStudentForLesson}
      />

      {/* 30-Day Student Lesson Progression Report Modal */}
      <StudentMonthReportModal
        isOpen={isMonthReportModalOpen}
        onClose={() => setIsMonthReportModalOpen(false)}
        student={selectedStudentForMonthReport}
        lessons={lessons}
        onOpenLogLesson={(studentId) => {
          setEditingLessonForTutor(null);
          setSelectedStudentForLesson(studentId);
          setIsLessonModalOpen(true);
        }}
      />
    </div>
  );
};
