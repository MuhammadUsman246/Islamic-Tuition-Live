import React, { useState, useEffect, useMemo } from 'react';
import { useClassroom } from '../../context/ClassroomContext';
import {
  Video,
  Calendar,
  BookOpen,
  CheckSquare,
  Clock,
  ExternalLink,
  Download,
  Sparkles,
  DollarSign,
  AlertCircle,
  Users,
  Receipt,
  Send,
  User,
  Target,
  Heart,
  ShieldCheck,
  Edit3,
  Flame,
  Award,
  FileSpreadsheet,
  Palmtree,
  Radio,
  Copy,
  Check,
  Share2,
  Bell,
  MessageSquare,
  X
} from 'lucide-react';
import {
  Student,
  Tutor,
  TimetableClass,
  Lesson,
  AttendanceRecord,
  StudentFee,
  Announcement,
  LiveKitRoomTokenResponse
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { convertPKTToStudentTime, getTimezoneShortCode, isLessonInDateRange, getRelativeOperationalDate, normalizeDateString, getCurrentOperationalDate } from '../../utils/timezone';
import { generateInvoicePDF, generateLessonReportPDF, generateStudentReportPDF } from '../../utils/pdfGenerator';
import { FeeReceiptModal } from '../modals/FeeReceiptModal';
import { PaymentNoticeModal } from '../modals/PaymentNoticeModal';
import { StudentProfileCustomizerModal } from '../modals/StudentProfileCustomizerModal';
import { exportLessonsToCSV } from '../../utils/csvExporter';
import { getCurrencySymbol } from '../../utils/currency';
import { findStudentByEmailOrId, loadOlderLessonsArchive } from '../../services/dataService';
import { getLocalClassroomSettings, fetchLiveKitToken, getCanonicalRoomName, getTutorSlug, getTutorDisplayId } from '../../services/livekitService';
import { IslamicTuitionClassroom } from '../classroom/IslamicTuitionClassroom';
import { IslamicReferralSection } from '../common/IslamicReferralSection';

interface StudentDashboardProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentStudentId: string;
  students: Student[];
  tutors: Tutor[];
  classes: TimetableClass[];
  lessons: Lesson[];
  attendance: AttendanceRecord[];
  fees: StudentFee[];
  announcements: Announcement[];
  onRefreshData?: () => Promise<void>;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  currentTab,
  setCurrentTab,
  currentStudentId,
  students,
  tutors,
  classes,
  lessons,
  attendance,
  fees,
  announcements,
  onRefreshData
}) => {
  const { userProfile, actualRole, adminViewingRole, adminViewingTargetId, setAdminViewingRole } = useAuth();
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);
  const [viewingReceiptFee, setViewingReceiptFee] = useState<StudentFee | null>(null);
  const [paymentNoticeFee, setPaymentNoticeFee] = useState<StudentFee | null>(null);
  const [selectedLessonForDetail, setSelectedLessonForDetail] = useState<Lesson | null>(null);
  const [startDateReport, setStartDateReport] = useState<string>(() => getRelativeOperationalDate(-30));
  const [endDateReport, setEndDateReport] = useState<string>(() => getCurrentOperationalDate());
  const [reportViewMode, setReportViewMode] = useState<'monthly' | '60days' | 'weekly' | 'all' | 'custom'>('weekly');
  const [isLoadingOlderLessons, setIsLoadingOlderLessons] = useState<boolean>(false);
  const [expandedMonths, setExpandedMonths] = useState<{ [key: string]: boolean }>({});
  const [expandedWeeks, setExpandedWeeks] = useState<{ [key: string]: boolean }>({});
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [studentActionToast, setStudentActionToast] = useState<{
    type: 'info' | 'error' | 'success';
    message: string;
  } | null>(null);

  const showStudentToast = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setStudentActionToast({ type, message });
    setTimeout(() => {
      setStudentActionToast(prev => (prev?.message === message ? null : prev));
    }, 5000);
  };

  const getMonday = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Unscheduled';
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      return monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Unscheduled';
    }
  };

  // STRICT PRIVACY: Authenticated student isolation
  const matchedStudent = useMemo(() => {
    if (adminViewingRole && adminViewingTargetId) {
      const match = students.find(s => s.studentId === adminViewingTargetId || s.id === adminViewingTargetId);
      if (match) return match;
    }
    const cleanUserEmail = userProfile?.email?.toLowerCase().trim();
    const cleanStudentId = userProfile?.studentId?.trim();
    const cleanCurrentId = currentStudentId?.trim();

    return students.find(s => {
      const sEmail = s.email?.toLowerCase().trim();
      const sParentEmail = s.parentEmail?.toLowerCase().trim();

      if (cleanCurrentId && (s.studentId === cleanCurrentId || s.id === cleanCurrentId)) return true;
      if (cleanStudentId && (s.studentId === cleanStudentId || s.id === cleanStudentId)) return true;
      if (cleanUserEmail && (sEmail === cleanUserEmail || sParentEmail === cleanUserEmail)) return true;
      return false;
    }) || null;
  }, [students, currentStudentId, userProfile, adminViewingRole, adminViewingTargetId]);

  const [fetchedStudent, setFetchedStudent] = useState<Student | null>(null);

  useEffect(() => {
    let isMounted = true;
    const resolveDirectStudent = async () => {
      if (matchedStudent) return; // Already resolved via props
      const targetQuery = userProfile?.email || userProfile?.studentId || currentStudentId;
      if (!targetQuery) return;

      const direct = await findStudentByEmailOrId(targetQuery);
      if (direct && isMounted) {
        setFetchedStudent(direct);
        if (onRefreshData) {
          onRefreshData();
        }
      }
    };
    resolveDirectStudent();
    return () => { isMounted = false; };
  }, [matchedStudent, userProfile, currentStudentId, onRefreshData]);

  // Fallback synthesized student record so logged-in students in fresh profiles/incognito are never stranded
  const synthesizedStudent = useMemo<Student | null>(() => {
    if (matchedStudent || fetchedStudent) return null;
    if (userProfile && (userProfile.role === 'student' || userProfile.studentId || userProfile.email)) {
      const cleanEmail = userProfile.email?.toLowerCase().trim() || 'student@academy.com';
      const displayName = userProfile.displayName || cleanEmail.split('@')[0] || 'Student';
      const stuId = userProfile.studentId || `STU-${cleanEmail.split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
      return {
        id: stuId,
        studentId: stuId,
        name: displayName,
        email: cleanEmail,
        parentEmail: userProfile.parentEmail || '',
        phone: userProfile.phone || '',
        country: userProfile.country || 'USA',
        timezone: userProfile.timezone || 'America/New_York',
        courseType: userProfile.courseType || 'Qaida',
        status: 'Active',
        assignedTutorId: 'TUT-001',
        monthlyFee: 50,
        currency: 'USD',
        joiningDate: new Date().toISOString().slice(0, 10),
        notes: 'Active Academy Student'
      };
    }
    return null;
  }, [matchedStudent, fetchedStudent, userProfile]);

  const student = matchedStudent || fetchedStudent || synthesizedStudent;

  const isMatchCurrentStudent = (targetIdOrName?: string) => {
    if (!targetIdOrName || !student) return false;
    const t = targetIdOrName.trim().toLowerCase();
    const sId = student.studentId?.trim().toLowerCase();
    const dId = student.id?.trim().toLowerCase();
    const sName = student.name?.trim().toLowerCase();
    
    if (sId && (t === sId || t.replace(/[^a-z0-9]/g, '') === sId.replace(/[^a-z0-9]/g, ''))) return true;
    if (dId && (t === dId || t.replace(/[^a-z0-9]/g, '') === dId.replace(/[^a-z0-9]/g, ''))) return true;
    if (sName && t === sName) return true;
    return false;
  };

  // Filter student's own data strictly
  const myClasses = student ? classes.filter(c => isMatchCurrentStudent(c.studentId) || isMatchCurrentStudent(c.studentName)) : [];
  const myLessons = student ? lessons.filter(l => isMatchCurrentStudent(l.studentId) || isMatchCurrentStudent(l.studentName)) : [];
  const myAttendance = student ? attendance.filter(a => isMatchCurrentStudent(a.studentId) || isMatchCurrentStudent(a.studentName)) : [];

  // UNIFIED STUDENT ATTENDANCE: Auto-picked from lesson submissions + quick attendance records
  const unifiedStudentAttendance = useMemo(() => {
    const list: Array<{
      id: string;
      date: string;
      tutorId?: string;
      status: 'Present' | 'Late' | 'Absent' | 'Excused' | 'Student on Leave';
      notes: string;
      source: string;
    }> = [];

    // 1. Ingest lesson reports
    myLessons.forEach(l => {
      const st = (l.attendanceStatus || 'Present') as any;
      let notes = l.lessonCovered || 'Lesson completed';
      if (st === 'Absent') {
        notes = l.absentReason ? `Absent: ${l.absentReason}` : 'Student Absent';
      } else if (st === 'Late') {
        notes = `${l.lateMinutes ? `${l.lateMinutes} min late — ` : ''}${l.lessonCovered || 'Class conducted'}`;
      } else if (st === 'Student on Leave') {
        notes = 'Authorized leave';
      }

      list.push({
        id: `lesson_${l.id}`,
        date: l.date,
        tutorId: l.tutorId,
        status: st,
        notes,
        source: 'Lesson Report'
      });
    });

    // 2. Ingest manual attendance records
    myAttendance.forEach(a => {
      const match = list.find(item => item.date === a.date);
      if (!match) {
        list.push({
          id: `att_${a.id}`,
          date: a.date,
          tutorId: a.tutorId,
          status: a.status as any,
          notes: a.notes || 'Verified attendance',
          source: 'Attendance Log'
        });
      }
    });

    return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [myLessons, myAttendance]);

  // Resolve student's assigned tutor accurately from student record or scheduled classes
  const rawAssignedTutorId = student?.assignedTutorId || myClasses[0]?.tutorId || 'Tutor 1';
  const assignedTutor = student
    ? tutors.find(
        t =>
          t.tutorId === rawAssignedTutorId ||
          getTutorSlug(t.tutorId) === getTutorSlug(rawAssignedTutorId)
      ) || null
    : null;
  const resolvedTutorDisplayId = getTutorDisplayId(assignedTutor || rawAssignedTutorId, tutors);
  const resolvedTutorSlug = getTutorSlug(resolvedTutorDisplayId, tutors);
  const [copiedClassroomLink, setCopiedClassroomLink] = useState(false);

  const filteredStudentLessons = useMemo(() => {
    return myLessons.filter(l => {
      return isLessonInDateRange(l.date, reportViewMode, startDateReport, endDateReport);
    });
  }, [myLessons, reportViewMode, startDateReport, endDateReport]);

  const lessonsByMonth = useMemo(() => {
    const grouped: { [key: string]: Lesson[] } = {};
    filteredStudentLessons.forEach(lesson => {
      const monthKey = lesson.month || 'Other / Uncategorized';
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(lesson);
    });
    return grouped;
  }, [filteredStudentLessons]);

  const lessonsByWeek = useMemo(() => {
    const grouped: { [key: string]: Lesson[] } = {};
    filteredStudentLessons.forEach(lesson => {
      const weekKey = `Week of ${getMonday(lesson.date)}`;
      if (!grouped[weekKey]) {
        grouped[weekKey] = [];
      }
      grouped[weekKey].push(lesson);
    });
    return grouped;
  }, [filteredStudentLessons]);

  // STRICT INVOICE ISOLATION: A Student must ONLY see their own fee and personal amount
  const myFees = useMemo(() => {
    if (!student) return [];
    return fees
      .filter(f => {
        // Direct fee
        if (f.studentId === student.studentId) return true;
        // Or covered in family combined invoice
        if (f.isFamilyInvoice && f.studentIds && f.studentIds.includes(student.studentId)) return true;
        return false;
      })
      .map(f => {
        if (f.isFamilyInvoice && f.siblingBreakdown && f.siblingBreakdown.length > 0) {
          const personalItem = f.siblingBreakdown.find(item => item.studentId === student.studentId);
          if (personalItem) {
            return {
              ...f,
              amount: personalItem.amount,
              studentName: student.name,
              isFamilyCoverage: true
            };
          }
        }
        return {
          ...f,
          isFamilyCoverage: false
        };
      });
  }, [fees, student]);

  // LiveKit Pilot Classroom Integration for Students
  const [isLiveKitModalOpen, setIsLiveKitModalOpen] = useState<boolean>(false);
  const [liveKitTokenData, setLiveKitTokenData] = useState<LiveKitRoomTokenResponse | null>(null);
  const [isJoiningLiveKit, setIsJoiningLiveKit] = useState<boolean>(false);
  const [customRoomCode, setCustomRoomCode] = useState<string>('');
  const classroomSettings = useMemo(() => getLocalClassroomSettings(), []);
  const isAllowedTestStudent = useMemo(() => {
    if (!classroomSettings.classroomEnabled) return true;
    const currentId = student?.studentId || currentStudentId;
    if (!currentId) return true;
    if (classroomSettings.allowedTestStudentIds.includes('all')) return true;
    return classroomSettings.allowedTestStudentIds.includes(currentId);
  }, [classroomSettings, student?.studentId, currentStudentId]);

  const { joinClassroomSession } = useClassroom();

  const handleJoinLiveKitTestClass = async (overrideRoomCode?: string) => {
    try {
      setIsJoiningLiveKit(true);
      const activeTutorId = overrideRoomCode || resolvedTutorDisplayId || student?.assignedTutorId || 'Tutor 1';
      const roomName = getCanonicalRoomName(activeTutorId, student?.studentId, overrideRoomCode || customRoomCode);
      const tokenRes = await fetchLiveKitToken({
        roomId: roomName,
        identity: `student_${student?.studentId || 'stu'}_${Date.now().toString(36)}`,
        participantName: student?.name || userProfile?.displayName || 'Student',
        role: 'student',
        customServerUrl: classroomSettings.livekitServerUrl || undefined,
      });
      setLiveKitTokenData(tokenRes);
      setIsLiveKitModalOpen(true);
    } catch (err: any) {
      showStudentToast(`Could not launch LiveKit Classroom: ${err?.message || err}`, 'error');
    } finally {
      setIsJoiningLiveKit(false);
    }
  };

  const activeBannerTheme = (!adminViewingRole && userProfile?.themePreference) || 'emerald';
  const welcomeBannerThemeClass =
    activeBannerTheme === 'gold'
      ? 'bg-gradient-to-br from-[#5C4314] via-[#4A350E] to-[#362609] border border-amber-500/30'
      : activeBannerTheme === 'midnight'
      ? 'bg-gradient-to-br from-[#17253B] via-[#111C2D] to-[#0B1320] border border-blue-400/25'
      : activeBannerTheme === 'sage'
      ? 'bg-gradient-to-br from-[#254438] via-[#1D362C] to-[#14261F] border border-emerald-400/25'
      : 'bg-[#1E5C3D]';

  const showFeeTab = student ? student.showFeeToStudent !== false : true;
  const studentPortalTabs = [
    { id: 'student_schedule', label: 'My Schedule', icon: Calendar },
    { id: 'student_lessons', label: 'Lessons & Homework', icon: BookOpen },
    { id: 'student_attendance', label: 'Attendance', icon: CheckSquare },
    ...(showFeeTab ? [{ id: 'student_fees', label: 'Fee Receipts', icon: DollarSign }] : []),
    { id: 'student_referrals', label: 'Refer & Earn $30', icon: Share2 },
    { id: 'student_profile', label: 'Profile & Avatar', icon: User },
    { id: 'announcements', label: 'Announcements', icon: Bell },
    { id: 'messages', label: 'Contact Admin', icon: MessageSquare },
  ];

  return (
    <div className="student-portal-root p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden break-words">
      {/* LiveKit Classroom Modal for Allowed Test Students */}
      {isLiveKitModalOpen && liveKitTokenData && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 p-0 sm:p-4 md:p-6 flex flex-col justify-center animate-in fade-in duration-200">
          <div className="w-full h-full max-w-7xl mx-auto flex flex-col">
            <IslamicTuitionClassroom
              roomName={liveKitTokenData.roomName}
              tokenData={liveKitTokenData}
              userRole="student"
              participantName={student?.name || userProfile?.displayName || 'Student'}
              settings={classroomSettings}
              onLeave={() => setIsLiveKitModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Dismissible In-App Toast Banner */}
      {studentActionToast && (
        <div
          role="alert"
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold shadow-sm animate-in fade-in duration-200 ${
            studentActionToast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : studentActionToast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 break-words">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="break-words">{studentActionToast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setStudentActionToast(null)}
            className="student-touch-target min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-black/5 flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="Dismiss Notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Alert if student is not found */}
      {!student && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-3 text-xs break-words">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0 break-words">
            <h4 className="font-bold text-amber-950">Student Profile Not Linked</h4>
            <p className="mt-0.5 text-amber-800 break-words">
              There is currently no student record linked to your email ({userProfile?.email || 'N/A'}). Please contact the Academy Administration to link your student profile.
            </p>
          </div>
        </div>
      )}

      {/* Welcome Banner with Permanent Zoom Classroom Link & Avatar */}
      {student && (
        <div className={`${welcomeBannerThemeClass} text-white p-4 sm:p-6 rounded-2xl shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4`}>
          <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0">
            {/* Student Avatar with quick trigger */}
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="student-touch-target w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 p-0.5 shadow-md flex items-center justify-center overflow-hidden border-2 border-white/30 shrink-0 cursor-pointer hover:scale-105 transition-transform group relative"
              title="Click to customize profile picture and goals"
            >
              {(!adminViewingRole && userProfile?.avatarUrl) ? (
                <img
                  src={userProfile.avatarUrl}
                  alt="Student Avatar"
                  className="w-full h-full object-cover rounded-2xl"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-xl sm:text-2xl font-bold text-white">
                  {((!adminViewingRole && userProfile?.displayName) || student.name).charAt(0).toUpperCase()}
                </span>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                <Edit3 className="w-4 h-4 text-white" />
              </div>
            </button>

            <div className="space-y-1.5 min-w-0 flex-1 break-words">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#E8A93E] text-white text-[10px] font-bold uppercase tracking-wider">
                  Student Portal
                </span>
                <span className="text-xs text-[#b8dbca] break-words">
                  Timezone: <strong className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-white" title={student?.timezone}>{getTimezoneShortCode(student?.timezone)}</strong>
                </span>
                {!adminViewingRole && userProfile?.preferredName && (
                  <span className="text-xs text-emerald-200 italic font-medium break-words">
                    (Known as "{userProfile.preferredName}")
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight break-words">
                Assalamu Alaykum, {(!adminViewingRole && userProfile?.preferredName) || student?.name}
              </h2>
              <p className="text-xs text-[#d2e8dd] max-w-xl break-words">
                Course: <strong>{student?.courseType}</strong> • Assigned Tutor: <strong>{resolvedTutorDisplayId}</strong>
              </p>
              {/* Assigned Tutor Classroom ID & Direct Link Pill */}
              <div className="pt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2.5 py-1.5 rounded-lg bg-black/25 border border-white/15 font-mono text-emerald-200 flex items-center gap-1.5">
                  <span>Classroom ID:</span>
                  <strong className="text-white">{resolvedTutorSlug}</strong>
                </span>
                <div className="px-2.5 py-1 rounded-lg bg-black/25 border border-white/15 font-mono text-[#d2e8dd] flex flex-wrap items-center gap-2 max-w-full">
                  <span className="break-all text-[11px] sm:text-xs">
                    {window.location.origin}/class/{resolvedTutorSlug}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${window.location.origin}/class/${resolvedTutorSlug}`;
                      navigator.clipboard.writeText(url).then(() => {
                        setCopiedClassroomLink(true);
                        setTimeout(() => setCopiedClassroomLink(false), 2000);
                      });
                    }}
                    className="student-touch-target min-h-[44px] px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[#E8A93E] hover:text-amber-300 font-sans font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Copy direct link to your assigned tutor's classroom"
                  >
                    {copiedClassroomLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedClassroomLink ? 'Copied' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="student-touch-target min-h-[44px] px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs transition-colors flex items-center justify-center space-x-1.5 border border-white/20 shadow-xs cursor-pointer"
              title="Update profile picture, bio, and Islamic goals"
            >
              <User className="w-4 h-4 text-[#E8A93E] shrink-0" />
              <span>Edit Profile & Avatar</span>
            </button>

            {(actualRole === 'parent' || userProfile?.role === 'parent') && (
              <button
                type="button"
                onClick={() => setAdminViewingRole(actualRole === 'student' ? 'parent' : null, null)}
                className="student-touch-target min-h-[44px] px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs transition-colors flex items-center justify-center space-x-1.5 border border-white/20 shadow-xs cursor-pointer"
              >
                <Users className="w-4 h-4 text-emerald-200 shrink-0" />
                <span>Return to Parent Guardian Portal</span>
              </button>
            )}

            {/* Primary Live Classroom Join Button */}
            <button
              type="button"
              id="student_livekit_launch_button"
              onClick={() => handleJoinLiveKitTestClass(resolvedTutorDisplayId)}
              disabled={isJoiningLiveKit}
              className="student-touch-target min-h-[48px] px-6 py-3 rounded-xl bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white font-bold text-sm transition-all flex items-center justify-center space-x-2.5 shadow-md transform hover:scale-[1.01] cursor-pointer ring-2 ring-emerald-400/30"
              title={`Join your assigned tutor's live classroom (${resolvedTutorSlug})`}
            >
              <Radio className="w-5 h-5 text-[#E8A93E] animate-pulse shrink-0" />
              <span>{isJoiningLiveKit ? 'Connecting...' : `Join ${resolvedTutorDisplayId} Classroom`}</span>
            </button>

            {/* Zoom Fallback Button */}
            {assignedTutor?.zoomLink && (
              <a
                id="student_join_zoom_button"
                role="button"
                href={assignedTutor.zoomLink}
                target="_blank"
                rel="noopener noreferrer"
                className="student-touch-target min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all flex items-center justify-center space-x-2 border border-slate-600 shadow-xs"
              >
                <Video className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Zoom (Fallback)</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Mobile & Tablet Quick-Switch Navigation Strip (44x44px Touch Compliant) */}
      <div className="lg:hidden flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
        {studentPortalTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCurrentTab(tab.id)}
              className={`student-touch-target min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap shrink-0 transition-all cursor-pointer border ${
                isActive
                  ? 'bg-[#2D8B5C] text-white border-[#1E5C3D] shadow-xs'
                  : 'bg-white text-[#5A6B61] border-[#E3DFD7] hover:text-[#161F1A] hover:border-[#2D8B5C]/40'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#2D8B5C]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Student Leave Status Notice if on Leave */}
      {student?.isOnLeave && (
        <div className="bg-amber-50/90 border border-amber-300 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs break-words">
          <div className="flex items-start sm:items-center space-x-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
              <Palmtree className="w-5 h-5" />
            </div>
            <div className="min-w-0 break-words">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex flex-wrap items-center gap-1.5">
                <span>Leave of Absence Active</span>
                {student.leaveType && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-200 text-amber-900">
                    {student.leaveType}
                  </span>
                )}
              </h4>
              <p className="text-xs text-amber-800 mt-0.5 break-words">
                You are currently marked on leave from <strong>{student.leaveStartDate || 'Today'}</strong> {student.leaveEndDate ? `to ${student.leaveEndDate}` : ''}.
                {student.leaveReason && <span className="ml-1 italic font-medium break-words">({student.leaveReason})</span>}
                <span className="block mt-0.5 text-amber-950 font-semibold">
                  Scheduled lessons will automatically resume once your leave period concludes.
                </span>
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500 text-white shrink-0 self-start sm:self-center">
            On Leave
          </span>
        </div>
      )}

      {/* Trial Status Notice if on Trial */}
      {student?.status === 'Trial' && (
        <div className="bg-[#FFF9ED] border border-[#E8A93E] p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs break-words">
          <div className="flex items-start sm:items-center space-x-3 min-w-0">
            <Sparkles className="w-5 h-5 text-[#E8A93E] shrink-0 mt-0.5 sm:mt-0" />
            <div className="min-w-0 break-words">
              <h4 className="text-xs font-bold text-[#8C5D08] uppercase tracking-wider break-words">
                Free Trial in Progress: {student.trialSessionsCompleted || 0} of 5 Sessions Completed
              </h4>
              <p className="text-xs text-[#161F1A] break-words">
                You have {5 - (student.trialSessionsCompleted || 0)} complimentary trial classes remaining.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#E8A93E] text-white shrink-0 self-start sm:self-center">
            {student.trialStatus || 'In Progress'}
          </span>
        </div>
      )}

      {/* TAB 1: SCHEDULE (LOCAL TIME) */}
      {currentTab === 'student_schedule' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[#161F1A]">My Weekly Class Schedule</h3>
              <p className="text-xs text-[#5A6B61] break-words">
                Automatically converted to your local time (<strong className="font-mono text-[#2D8B5C]" title={student?.timezone}>{getTimezoneShortCode(student?.timezone)}</strong>).
              </p>
            </div>
          </div>

          {myClasses.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-[#E3DFD7] shadow-xs text-center space-y-3">
              <Calendar className="w-8 h-8 text-[#D5D0C6] mx-auto" />
              <h4 className="text-sm font-bold text-[#161F1A]">No Weekly Classes Scheduled Yet</h4>
              <p className="text-xs text-[#5A6B61] max-w-md mx-auto leading-relaxed">
                Your weekly class timetable will appear here automatically in your local timezone once finalized by Academy Administration. You can still join your assigned instructor's classroom anytime above.
              </p>
              <div className="pt-1 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleJoinLiveKitTestClass(resolvedTutorDisplayId)}
                  disabled={isJoiningLiveKit}
                  className="student-touch-target min-h-[44px] px-5 py-2.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <Radio className="w-4 h-4 text-[#E8A93E]" />
                  <span>Join {resolvedTutorDisplayId} Classroom</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentTab('messages')}
                  className="student-touch-target min-h-[44px] px-4 py-2.5 bg-[#FAF9F7] hover:bg-gray-100 text-[#161F1A] border border-[#D5D0C6] text-xs font-bold rounded-xl inline-flex items-center gap-2 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4 text-[#2D8B5C]" />
                  <span>Contact Admin</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(() => {
                const DAY_RANKS: Record<string, number> = {
                  'Monday': 1,
                  'Tuesday': 2,
                  'Wednesday': 3,
                  'Thursday': 4,
                  'Friday': 5,
                  'Saturday': 6,
                  'Sunday': 7
                };

                const sortedClasses = [...myClasses].map(cls => {
                  const converted = convertPKTToStudentTime(
                    cls.dayOfWeek,
                    cls.startTimePKT,
                    student?.timezone || 'America/New_York'
                  );
                  return { cls, converted };
                }).sort((a, b) => {
                  const rankA = DAY_RANKS[a.converted.localDay] || 99;
                  const rankB = DAY_RANKS[b.converted.localDay] || 99;
                  if (rankA !== rankB) return rankA - rankB;
                  return a.converted.localTime24.localeCompare(b.converted.localTime24);
                });

                return sortedClasses.map(({ cls, converted }) => {
                  const classTutorDisplay = getTutorDisplayId(cls.tutorId, tutors);
                  const classTutorSlug = getTutorSlug(cls.tutorId, tutors);
                  return (
                    <div key={cls.id} className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs space-y-3 flex flex-col justify-between break-words">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#2D8B5C]">
                              {converted.localDay}
                            </span>
                            <h4 className="text-base font-bold text-[#161F1A] mt-0.5">
                              {converted.localTime} <span className="text-xs font-normal text-[#5A6B61]">local</span>
                            </h4>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 shrink-0">
                            {cls.durationMinutes} min
                          </span>
                        </div>

                        <div className="p-3 bg-[#FAF9F7] rounded-lg border border-[#E3DFD7] text-xs space-y-1.5 break-words">
                          <p className="text-[#5A6B61] flex flex-wrap items-center justify-between gap-1">
                            <span>Instructor: <strong className="text-[#2D8B5C]">{classTutorDisplay}</strong></span>
                            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {classTutorSlug}
                            </span>
                          </p>
                          <p className="text-[#5A6B61] break-words">
                            Weekly Class: <span className="font-medium text-[#161F1A]">{converted.localDay}s at {converted.localTime}</span>
                          </p>
                          <p className="text-[#5A6B61] font-mono text-[11px] break-all">
                            Link: <span className="text-[#1E5C3D]">{window.location.origin}/class/{classTutorSlug}</span>
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleJoinLiveKitTestClass(cls.tutorId)}
                        disabled={isJoiningLiveKit}
                        className="student-touch-target min-h-[44px] w-full py-2.5 px-3 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <Radio className="w-4 h-4 text-[#E8A93E] shrink-0" />
                        <span>Join {classTutorDisplay} Classroom ({classTutorSlug})</span>
                      </button>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LESSONS & HOMEWORK */}
      {currentTab === 'student_lessons' && (
        <div className="space-y-5">
          {/* Custom Date Range Combined Report Downloader */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E3DFD7] shadow-xs space-y-3">
            <div className="flex items-center space-x-2.5">
              <span className="p-2 bg-[#E8F5EE] rounded-lg text-[#1E5C3D] shrink-0">
                <Calendar className="w-4 h-4" />
              </span>
              <div className="min-w-0 break-words">
                <h4 className="text-xs font-bold text-[#161F1A]">Download Combined Progress Report</h4>
                <p className="text-[11px] text-[#5A6B61] break-words">Select a custom date range to compile all lesson progress into a single consolidated PDF or CSV report.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-[11px] font-bold text-[#5A6B61] block mb-1">From Date</label>
                <input
                  type="date"
                  value={startDateReport}
                  onChange={(e) => setStartDateReport(e.target.value)}
                  className="min-h-[44px] w-full border border-[#D5D0C6] rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:border-[#2D8B5C] outline-none bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#5A6B61] block mb-1">To Date</label>
                <input
                  type="date"
                  value={endDateReport}
                  onChange={(e) => setEndDateReport(e.target.value)}
                  className="min-h-[44px] w-full border border-[#D5D0C6] rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:border-[#2D8B5C] outline-none bg-white"
                />
              </div>
              <div className="sm:col-span-2 flex flex-col xs:flex-row items-stretch xs:items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!student) return;
                    const filtered = myLessons.filter(l => l.date >= startDateReport && l.date <= endDateReport);
                    if (filtered.length === 0) {
                      showStudentToast('No completed lessons found within the selected date range.', 'info');
                      return;
                    }
                    generateStudentReportPDF(student, filtered, `Report (${startDateReport} to ${endDateReport})`);
                  }}
                  className="student-touch-target min-h-[44px] flex-1 px-4 py-2.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer transition-colors"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>PDF Report</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!student) return;
                    const filtered = myLessons.filter(l => l.date >= startDateReport && l.date <= endDateReport);
                    if (filtered.length === 0) {
                      showStudentToast('No completed lessons found within the selected date range.', 'info');
                      return;
                    }
                    exportLessonsToCSV(
                      `${student.name} Academic Lessons`,
                      filtered,
                      `Range (${startDateReport} to ${endDateReport})`,
                      { studentName: student.name }
                    );
                  }}
                  className="student-touch-target min-h-[44px] flex-1 px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer transition-colors"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>CSV Report</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#161F1A]">My Lessons & Homework</h3>
              <p className="text-xs text-[#5A6B61] break-words">
                Academic records and revision homework assigned by your teacher.
              </p>
            </div>

            {/* View Mode Switcher */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[#FAF9F7] border border-[#E3DFD7] p-1.5 rounded-xl shadow-xs self-start sm:self-auto w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setReportViewMode('weekly')}
                className={`student-touch-target min-h-[44px] px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  reportViewMode === 'weekly'
                    ? 'bg-white text-[#1E5C3D] shadow-xs'
                    : 'text-[#5A6B61] hover:text-[#161F1A]'
                }`}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                disabled={isLoadingOlderLessons}
                onClick={async () => {
                  setReportViewMode('monthly');
                  if (student) {
                    setIsLoadingOlderLessons(true);
                    try {
                      await loadOlderLessonsArchive({ studentIds: Array.from(new Set([student.studentId, student.id].filter(Boolean))), daysBack: 35 });
                      if (onRefreshData) await onRefreshData();
                    } finally {
                      setIsLoadingOlderLessons(false);
                    }
                  }
                }}
                className={`student-touch-target min-h-[44px] px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  reportViewMode === 'monthly'
                    ? 'bg-white text-[#1E5C3D] shadow-xs'
                    : 'text-[#5A6B61] hover:text-[#161F1A]'
                }`}
              >
                Last 30 Days
              </button>
              <button
                type="button"
                disabled={isLoadingOlderLessons}
                onClick={async () => {
                  setReportViewMode('60days');
                  if (student) {
                    setIsLoadingOlderLessons(true);
                    try {
                      await loadOlderLessonsArchive({ studentIds: Array.from(new Set([student.studentId, student.id].filter(Boolean))), daysBack: 65 });
                      if (onRefreshData) await onRefreshData();
                    } finally {
                      setIsLoadingOlderLessons(false);
                    }
                  }
                }}
                className={`student-touch-target min-h-[44px] px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  reportViewMode === '60days'
                    ? 'bg-white text-[#1E5C3D] shadow-xs'
                    : 'text-[#5A6B61] hover:text-[#161F1A]'
                }`}
              >
                Last 60 Days
              </button>
              <button
                type="button"
                disabled={isLoadingOlderLessons}
                onClick={async () => {
                  setReportViewMode('custom');
                  if (student) {
                    setIsLoadingOlderLessons(true);
                    try {
                      await loadOlderLessonsArchive({ studentIds: Array.from(new Set([student.studentId, student.id].filter(Boolean))), daysBack: 180 });
                      if (onRefreshData) await onRefreshData();
                    } finally {
                      setIsLoadingOlderLessons(false);
                    }
                  }
                }}
                className={`student-touch-target min-h-[44px] px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  reportViewMode === 'custom'
                    ? 'bg-white text-[#1E5C3D] shadow-xs'
                    : 'text-[#5A6B61] hover:text-[#161F1A]'
                }`}
              >
                Custom Range
              </button>
              <button
                type="button"
                disabled={isLoadingOlderLessons}
                onClick={async () => {
                  setReportViewMode('all');
                  if (student) {
                    setIsLoadingOlderLessons(true);
                    try {
                      await loadOlderLessonsArchive({ studentIds: Array.from(new Set([student.studentId, student.id].filter(Boolean))), daysBack: 365 });
                      if (onRefreshData) await onRefreshData();
                    } finally {
                      setIsLoadingOlderLessons(false);
                    }
                  }
                }}
                className={`student-touch-target min-h-[44px] px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  reportViewMode === 'all'
                    ? 'bg-white text-[#1E5C3D] shadow-xs'
                    : 'text-[#5A6B61] hover:text-[#161F1A]'
                }`}
              >
                {isLoadingOlderLessons && reportViewMode === 'all' ? 'Loading Older...' : 'All History'}
              </button>
            </div>
          </div>

          {/* Custom Date Pickers for Student */}
          {reportViewMode === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 bg-[#FAF9F7] p-3.5 rounded-xl border border-[#E3DFD7] text-xs">
              <span className="font-bold text-[#161F1A]">Select Range:</span>
              <div className="flex items-center space-x-2">
                <span className="text-[#5A6B61]">From:</span>
                <input
                  type="date"
                  value={startDateReport}
                  onChange={(e) => setStartDateReport(e.target.value)}
                  className="min-h-[44px] bg-white border border-[#D5D0C6] rounded-lg px-3 py-1.5 text-xs font-mono outline-none"
                />
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[#5A6B61]">To:</span>
                <input
                  type="date"
                  value={endDateReport}
                  onChange={(e) => setEndDateReport(e.target.value)}
                  className="min-h-[44px] bg-white border border-[#D5D0C6] rounded-lg px-3 py-1.5 text-xs font-mono outline-none"
                />
              </div>
            </div>
          )}

          {/* Render helper */}
          {(() => {
            const renderLessonCard = (lesson: Lesson) => (
              <div
                key={lesson.id}
                onClick={() => setSelectedLessonForDetail(lesson)}
                className="bg-white p-4 sm:p-5 rounded-xl border border-[#E3DFD7] hover:border-[#2D8B5C] cursor-pointer transition-all shadow-xs space-y-3.5 break-words"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0 break-words">
                    <h4 className="text-sm font-bold text-[#161F1A] break-words">{lesson.lessonType}</h4>
                    <p className="text-xs text-[#5A6B61] break-words">Taught by {getTutorDisplayId(lesson.tutorId, tutors)} on {lesson.date}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(() => {
                      const status = lesson.attendanceStatus || 'Present';
                      return (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center space-x-1.5 ${
                          status === 'Present' ? 'bg-emerald-50 text-emerald-900 border-emerald-300' :
                          status === 'Late' ? 'bg-amber-50 text-amber-900 border-amber-300' :
                          status === 'Absent' ? 'bg-rose-50 text-rose-900 border-rose-300' :
                          'bg-sky-50 text-sky-900 border-sky-300'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            status === 'Present' ? 'bg-emerald-600' :
                            status === 'Late' ? 'bg-amber-600' :
                            status === 'Absent' ? 'bg-rose-600' : 'bg-sky-600'
                          }`} />
                          <span>{status}</span>
                        </span>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLessonForDetail(lesson);
                      }}
                      className="student-touch-target min-h-[44px] px-3.5 py-2 text-xs font-bold text-white bg-[#2D8B5C] hover:bg-[#1E5C3D] rounded-lg flex items-center space-x-1.5 cursor-pointer transition-colors shadow-2xs"
                    >
                      <span>View Details</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        generateLessonReportPDF(lesson);
                      }}
                      className="student-touch-target min-h-[44px] px-3.5 py-2 text-xs font-bold text-[#161F1A] bg-[#FAF9F7] border border-[#D5D0C6] rounded-lg hover:bg-gray-100 flex items-center space-x-1.5 cursor-pointer transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-[#2D8B5C] shrink-0" />
                      <span>Download PDF</span>
                    </button>
                  </div>
                </div>

                {lesson.attendanceStatus === 'Absent' ? (
                  <div className="bg-red-50/70 p-3 rounded-lg border border-red-200 text-xs text-red-700 break-words">
                    <span className="font-semibold block">Student Absent:</span>
                    <p className="text-[11px] text-red-600 mt-0.5 break-words">
                      {lesson.absentReason || 'No lesson conducted due to student absence.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-[#FAF9F7] p-3.5 rounded-lg border border-[#E3DFD7] break-words">
                    <div className="min-w-0 break-words">
                      <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Portion Recited</span>
                      <p className="font-medium text-[#161F1A] mt-0.5 break-words">{lesson.lessonCovered}</p>
                    </div>
                    <div className="min-w-0 break-words">
                      <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Memorization</span>
                      <p className="font-medium text-[#B87314] mt-0.5 break-words">{lesson.memorization || '—'}</p>
                    </div>
                    <div className="min-w-0 break-words">
                      <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Adaab & Manners</span>
                      <p className="font-medium text-[#2D8B5C] mt-0.5 break-words">{lesson.adaabManners || '—'}</p>
                    </div>
                    <div className="min-w-0 break-words">
                      <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Revision (Sabaq)</span>
                      <p className="font-medium text-[#161F1A] mt-0.5 break-words">{lesson.revision || 'None'}</p>
                    </div>
                  </div>
                )}

                {lesson.screenshots && lesson.screenshots.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Attached Lesson Pages / Screenshots</span>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {lesson.screenshots.map((scr, idx) => (
                        scr.expired || !scr.url ? (
                          <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center text-gray-400 text-[11px] flex flex-col items-center justify-center min-h-[60px]">
                            <Clock className="w-3.5 h-3.5 text-gray-300 mb-0.5" />
                            <span className="font-semibold block">Image Expired</span>
                            <span className="text-[8px] block">Cleaned up after 31 days</span>
                          </div>
                        ) : (
                          <div
                            key={idx}
                            className="relative rounded-lg overflow-hidden border border-[#D5D0C6] bg-black/5 aspect-video group cursor-zoom-in"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActivePreviewImage(scr.url);
                            }}
                          >
                            <img
                              src={scr.url}
                              alt={scr.name}
                              referrerPolicy="no-referrer"
                              className="object-cover w-full h-full hover:scale-105 transition-transform duration-200"
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] p-1 break-words text-center opacity-0 group-hover:opacity-100 transition-opacity">
                              {scr.name}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {lesson.teacherRemarks && (
                  <p className="text-xs text-[#5A6B61] italic break-words">
                    <strong>Teacher Encouragement:</strong> "{lesson.teacherRemarks}"
                  </p>
                )}
              </div>
            );

            if (filteredStudentLessons.length === 0) {
              return (
                <div className="bg-white p-8 rounded-xl border border-[#E3DFD7] text-center text-xs text-[#5A6B61]">
                  <BookOpen className="w-8 h-8 text-[#D5D0C6] mx-auto mb-2" />
                  <p className="font-semibold text-[#161F1A]">No lesson reports found for the selected time range.</p>
                  <p className="text-[11px] mt-1">Try selecting "Last 60 Days" or "All History" to view earlier records.</p>
                </div>
              );
            }

            if (reportViewMode === 'all' || reportViewMode === 'custom') {
              return (
                <div className="space-y-3">
                  {filteredStudentLessons.map(renderLessonCard)}
                </div>
              );
            }

            if (reportViewMode === 'weekly') {
              return (
                <div className="space-y-4">
                  {Object.keys(lessonsByWeek).map(weekKey => {
                    const lessonsInWeek = lessonsByWeek[weekKey];
                    const isExpanded = expandedWeeks[weekKey] !== false; // default expanded

                    const presentCount = lessonsInWeek.filter(l => l.attendanceStatus !== 'Absent').length;

                    return (
                      <div key={weekKey} className="bg-white rounded-xl border border-[#E3DFD7] overflow-hidden shadow-xs">
                        <button
                          type="button"
                          className="w-full min-h-[48px] bg-[#FAF9F7] px-4 py-3 border-b border-[#E3DFD7] flex flex-wrap items-center justify-between gap-2 cursor-pointer hover:bg-[#F2EFE9] transition-colors text-left"
                          onClick={() => setExpandedWeeks(prev => ({ ...prev, [weekKey]: !isExpanded }))}
                        >
                          <div className="flex items-center space-x-2.5">
                            <span className="w-2 h-2 rounded-full bg-[#2D8B5C] shrink-0"></span>
                            <span className="text-sm font-bold text-[#161F1A] break-words">{weekKey}</span>
                          </div>
                          <div className="flex items-center space-x-3 text-xs text-[#5A6B61]">
                            <span className="font-semibold bg-emerald-50 text-[#1E5C3D] px-2 py-0.5 rounded border border-emerald-200">
                              {presentCount} of {lessonsInWeek.length} Classes Completed
                            </span>
                            <span className="font-bold text-gray-500">{isExpanded ? 'Collapse ▲' : 'Expand ▼'}</span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="p-3 sm:p-4 bg-gray-50/30 divide-y divide-[#EAE6DE] space-y-4">
                            {lessonsInWeek.map(renderLessonCard)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            }

            // DEFAULT: MONTHLY SUMMARY VIEW
            return (
              <div className="space-y-4">
                {Object.keys(lessonsByMonth).map(monthKey => {
                  const lessonsInMonth = lessonsByMonth[monthKey];
                  const isExpanded = expandedMonths[monthKey] !== false; // default expanded

                  const presentCount = lessonsInMonth.filter(l => l.attendanceStatus !== 'Absent').length;
                  const totalCount = lessonsInMonth.length;
                  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 100;

                  // Unique subject types
                  const subjects = Array.from(new Set(lessonsInMonth.map(l => l.lessonType)));

                  return (
                    <div key={monthKey} className="bg-white rounded-xl border border-[#E3DFD7] overflow-hidden shadow-xs space-y-2">
                      {/* Month Summary Banner */}
                      <button
                        type="button"
                        className="w-full min-h-[52px] bg-[#FAF9F7] px-4 py-3.5 border-b border-[#E3DFD7] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 cursor-pointer hover:bg-[#F2EFE9] transition-colors text-left"
                        onClick={() => setExpandedMonths(prev => ({ ...prev, [monthKey]: !isExpanded }))}
                      >
                        <div className="space-y-1">
                          <span className="text-base font-extrabold text-[#161F1A] break-words">{monthKey} Report Card</span>
                          <div className="flex flex-wrap gap-1.5">
                            {subjects.map(s => (
                              <span key={s} className="text-[9px] font-bold uppercase tracking-wider text-[#1E5C3D] bg-[#E8F5EE] px-1.5 py-0.5 rounded">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-3.5 self-end sm:self-auto">
                          {/* Mini metrics bar */}
                          <div className="flex items-center space-x-4 text-xs font-semibold">
                            <div className="text-right">
                              <span className="text-[10px] text-[#5A6B61] block font-normal">Attendance</span>
                              <span className="text-[#1E5C3D] font-mono font-bold">{attendanceRate}% ({presentCount}/{totalCount})</span>
                            </div>
                          </div>
                          <span className="font-bold text-xs text-gray-500 shrink-0">{isExpanded ? 'Hide Logs ▲' : 'View Logs ▼'}</span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-3 sm:p-4 bg-gray-50/30 space-y-4">
                          {lessonsInMonth.map(renderLessonCard)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 3: ATTENDANCE */}
      {currentTab === 'student_attendance' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[#161F1A]">My Class Attendance Record</h3>
              <p className="text-xs text-[#5A6B61] break-words">Real-time attendance history verified from your completed classes.</p>
            </div>
          </div>

          {/* Attendance Summary KPI Pills */}
          {unifiedStudentAttendance.length > 0 && (() => {
            const totalCount = unifiedStudentAttendance.length;
            const presentCount = unifiedStudentAttendance.filter(a => a.status === 'Present').length;
            const lateCount = unifiedStudentAttendance.filter(a => a.status === 'Late').length;
            const absentCount = unifiedStudentAttendance.filter(a => a.status === 'Absent').length;
            const rate = Math.round(((presentCount + lateCount) / totalCount) * 100);
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-[#E3DFD7] shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6B61] block">Attendance Rate</span>
                  <span className="text-lg font-extrabold text-[#1E5C3D] font-mono">{rate}%</span>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-[#E3DFD7] shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6B61] block">Present</span>
                  <span className="text-lg font-extrabold text-emerald-700 font-mono">{presentCount}</span>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-[#E3DFD7] shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6B61] block">Late</span>
                  <span className="text-lg font-extrabold text-amber-700 font-mono">{lateCount}</span>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-[#E3DFD7] shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6B61] block">Absent</span>
                  <span className="text-lg font-extrabold text-rose-700 font-mono">{absentCount}</span>
                </div>
              </div>
            );
          })()}

          <div className="bg-white border border-[#E3DFD7] rounded-2xl overflow-hidden shadow-xs">
            {unifiedStudentAttendance.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#5A6B61] italic">
                No attendance logs recorded yet. Attendance will populate automatically upon lesson completion.
              </div>
            ) : (
              <>
                {/* Mobile Responsive Cards (< sm) */}
                <div className="sm:hidden divide-y divide-[#EAE6DE]">
                  {unifiedStudentAttendance.map(att => (
                    <div key={att.id} className="p-4 space-y-2 text-xs break-words">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-[#161F1A]">{att.date}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center space-x-1 ${
                          att.status === 'Present'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : att.status === 'Late'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : att.status === 'Absent'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            att.status === 'Present' ? 'bg-emerald-600' :
                            att.status === 'Late' ? 'bg-amber-600' :
                            att.status === 'Absent' ? 'bg-rose-600' : 'bg-blue-600'
                          }`} />
                          <span>{att.status}</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#5A6B61]">
                        <span>Instructor: <strong className="text-[#2D8B5C]">{getTutorDisplayId(att.tutorId, tutors)}</strong></span>
                        <span className="font-mono text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200">
                          {att.source}
                        </span>
                      </div>
                      <p className="text-xs text-[#161F1A] font-medium bg-[#FAF9F7] p-2.5 rounded-lg border border-[#EAE6DE] break-words">
                        {att.notes || '—'}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Tablet & Desktop Table (>= sm) */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF9F7] border-b border-[#E3DFD7] text-[#5A6B61] font-bold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Tutor</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Class Details / Lesson Covered</th>
                        <th className="py-3 px-4">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAE6DE]">
                      {unifiedStudentAttendance.map(att => (
                        <tr key={att.id} className="hover:bg-[#FAF9F7]/60">
                          <td className="py-3 px-4 font-mono font-semibold text-[#161F1A] whitespace-nowrap">{att.date}</td>
                          <td className="py-3 px-4 text-[#2D8B5C] font-semibold whitespace-nowrap">{getTutorDisplayId(att.tutorId, tutors)}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
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
                          <td className="py-3 px-4 text-[#161F1A] font-medium break-words max-w-md">{att.notes || '—'}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="text-[10px] font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200">
                              {att.source}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: FEE RECEIPTS */}
      {currentTab === 'student_fees' && (
        student?.showFeeToStudent === false ? (
          <div className="bg-white p-8 rounded-2xl border border-[#E3DFD7] shadow-xs text-center space-y-3">
            <div className="w-12 h-12 bg-amber-50 text-amber-700 rounded-full flex items-center justify-center mx-auto border border-amber-200">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#161F1A]">Tuition Fees Managed by Parent</h3>
            <p className="text-xs text-[#5A6B61] max-w-md mx-auto leading-relaxed">
              Tuition invoices and fee records for your account are managed directly by your parent / guardian. Fee details are hidden in your student portal as per admin settings.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-[#161F1A]">Tuition Invoices & Payment Receipts</h3>
            {myFees.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-[#E3DFD7] shadow-xs text-center space-y-2">
                <Receipt className="w-8 h-8 text-[#D5D0C6] mx-auto" />
                <h4 className="text-sm font-bold text-[#161F1A]">No Tuition Invoices Found</h4>
                <p className="text-xs text-[#5A6B61] max-w-md mx-auto">
                  You currently have no pending or historical tuition invoices. Official receipts will appear here automatically when generated.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myFees.map(fee => {
                  const isFamilyCov = (fee as any).isFamilyCoverage;
                  return (
                    <div key={fee.id} className="bg-white p-4 sm:p-5 rounded-xl border border-[#E3DFD7] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs break-words">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-[#2D8B5C]">{fee.invoiceNumber}</span>
                          {isFamilyCov && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#1E5C3D]/10 text-[#1E5C3D] border border-[#2D8B5C]/20">
                              Family Plan
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-[#161F1A] text-sm break-words">
                          {fee.billingPeriod} Tuition {isFamilyCov ? '(Your Individual Allocation)' : ''}
                        </h4>
                        <p className="text-[#5A6B61]">Due Date: {fee.dueDate}</p>
                      </div>
                      <div className="sm:text-right space-y-2.5">
                        <div className="flex sm:justify-end items-center justify-between gap-2">
                          <p className="text-base font-bold text-[#161F1A] font-mono">
                            {getCurrencySymbol(fee.currency)}{fee.amount.toLocaleString()}
                          </p>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            fee.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : fee.status === 'Payment Submitted'
                              ? 'bg-purple-100 text-purple-900 border border-purple-300'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {fee.status === 'Payment Submitted' ? 'Submitted (Pending Verification)' : fee.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center sm:justify-end gap-2">
                          {fee.status !== 'Paid' && (
                            <button
                              type="button"
                              onClick={() => setPaymentNoticeFee(fee)}
                              className="student-touch-target min-h-[44px] px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                              title="Notify academy administration that tuition payment was sent"
                            >
                              <Send className="w-3.5 h-3.5 shrink-0" />
                              <span>{fee.status === 'Payment Submitted' ? 'Update Notice' : 'Notify Paid'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setViewingReceiptFee(fee)}
                            className="student-touch-target min-h-[44px] px-3.5 py-2 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                            title="Open Official In-App Receipt"
                          >
                            <Receipt className="w-3.5 h-3.5 text-[#2D8B5C] shrink-0" />
                            <span>Receipt</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => generateInvoicePDF(fee)}
                            className="student-touch-target min-h-[44px] px-3.5 py-2 text-xs font-bold text-[#2D8B5C] bg-[#FAF9F7] hover:bg-gray-100 border border-[#D5D0C6] rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                            title="Download PDF"
                          >
                            <Download className="w-3.5 h-3.5 shrink-0" />
                            <span>PDF</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )
      )}

      {/* TAB 5: ANNOUNCEMENTS */}
      {currentTab === 'announcements' && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-[#161F1A]">Academy Announcements</h3>
          {announcements.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-[#E3DFD7] shadow-xs text-center space-y-2">
              <Bell className="w-8 h-8 text-[#D5D0C6] mx-auto" />
              <h4 className="text-sm font-bold text-[#161F1A]">No Academy Announcements</h4>
              <p className="text-xs text-[#5A6B61] max-w-md mx-auto">
                Official academy notices, Ramadan schedules, and Eid holiday announcements will be posted here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map(ann => (
                <div key={ann.id} className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs space-y-2 break-words">
                  <h4 className="text-sm font-bold text-[#161F1A] break-words">{ann.title}</h4>
                  <p className="text-xs text-[#5A6B61] leading-relaxed break-words whitespace-pre-wrap">{ann.content}</p>
                  <p className="text-[10px] text-[#5A6B61]">Posted on {new Date(ann.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: MY PROFILE & PERSONAL LEARNING JOURNEY */}
      {currentTab === 'student_profile' && (
        <div className="space-y-6">
          {/* Top Profile Summary Card */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#E3DFD7] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-5 break-words">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 min-w-0 w-full md:w-auto">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1E5C3D] to-[#2D8B5C] p-0.5 shadow-md flex items-center justify-center overflow-hidden border-2 border-white shrink-0">
                {(!adminViewingRole && userProfile?.avatarUrl) ? (
                  <img
                    src={userProfile.avatarUrl}
                    alt="Student Avatar"
                    className="w-full h-full object-cover rounded-2xl"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-3xl font-bold text-white">
                    {((!adminViewingRole && userProfile?.displayName) || student?.name || 'S').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="space-y-1.5 min-w-0 flex-1 break-words">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-[#161F1A] break-words">
                    {(!adminViewingRole && userProfile?.preferredName) || student?.name || userProfile?.displayName}
                  </h3>
                  {!adminViewingRole && userProfile?.preferredName && (
                    <span className="text-xs text-[#5A6B61] break-words">({student?.name})</span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E8A93E] text-white">
                    {student?.courseType || 'Quranic Studies'}
                  </span>
                </div>
                <p className="text-xs text-[#5A6B61] break-words">
                  Assigned ID: <strong className="font-mono text-[#2D8B5C]">{student?.studentId || userProfile?.studentId || 'STU-000'}</strong> • Instructor: <strong>{resolvedTutorDisplayId}</strong>
                </p>
                {!adminViewingRole && userProfile?.bio && (
                  <p className="text-xs text-[#161F1A] italic max-w-xl pt-0.5 break-words">
                    "{userProfile.bio}"
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="student-touch-target min-h-[44px] w-full md:w-auto px-4 py-2.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
            >
              <Edit3 className="w-4 h-4 shrink-0" />
              <span>Customize Profile & Avatar</span>
            </button>
          </div>

          {/* Grid of Quranic Goals & Daily Habit Tracker */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Quran Goals & Preferences */}
            <div className="bg-white p-5 rounded-2xl border border-[#E3DFD7] shadow-xs space-y-4 break-words">
              <div className="flex items-center space-x-2 border-b border-[#E3DFD7] pb-3">
                <Target className="w-4 h-4 text-[#2D8B5C] shrink-0" />
                <h4 className="text-xs font-bold text-[#161F1A] uppercase tracking-wider">
                  Quran Goals & Favorites
                </h4>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7] space-y-1 break-words">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6B61] flex items-center gap-1">
                    <Target className="w-3 h-3 text-[#2D8B5C] shrink-0" />
                    <span>Personal Target</span>
                  </span>
                  <p className="font-bold text-[#161F1A] break-words">
                    {(!adminViewingRole && userProfile?.quranGoal) || 'Memorize Juz Amma with Tajweed rules'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7] space-y-1 break-words">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6B61] flex items-center gap-1">
                      <Heart className="w-3 h-3 text-red-500 shrink-0" />
                      <span>Favorite Surah</span>
                    </span>
                    <p className="font-bold text-[#161F1A] break-words">
                      {(!adminViewingRole && userProfile?.favoriteSurah) || 'Surah Ar-Rahman (55)'}
                    </p>
                  </div>

                  <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7] space-y-1 break-words">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6B61] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#2D8B5C] shrink-0" />
                      <span>Daily Target</span>
                    </span>
                    <p className="font-bold text-[#161F1A] break-words">
                      {(!adminViewingRole && userProfile?.dailyGoalMinutes) || 20} mins / day
                    </p>
                  </div>
                </div>

                {!adminViewingRole && userProfile?.hobbies && (
                  <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7] space-y-1 break-words">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6B61]">
                      Hobbies & Interests
                    </span>
                    <p className="text-[#161F1A] font-medium break-words">{userProfile.hobbies}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Protected Academy Records Shield */}
            <div className="bg-[#FAF9F7] p-5 rounded-2xl border border-[#D5D0C6] shadow-xs space-y-4 break-words">
              <div className="flex items-center space-x-2 border-b border-[#D5D0C6] pb-3">
                <ShieldCheck className="w-4 h-4 text-[#1E5C3D] shrink-0" />
                <h4 className="text-xs font-bold text-[#161F1A] uppercase tracking-wider">
                  Academic Safety Shield
                </h4>
              </div>

              <p className="text-xs text-[#5A6B61] leading-relaxed break-words">
                To guarantee zero disruption to your tutor schedules, attendance records, and family tuition statements, official academic identity fields are managed exclusively by Academy Administration.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-[#E3DFD7] break-words">
                  <span className="text-[10px] text-[#5A6B61] block font-semibold">Official Student Name</span>
                  <strong className="text-[#161F1A] break-words block">{student?.name || userProfile?.displayName}</strong>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-[#E3DFD7] break-words">
                  <span className="text-[10px] text-[#5A6B61] block font-semibold">Assigned Student ID</span>
                  <strong className="text-[#2D8B5C] font-mono break-words block">{student?.studentId || userProfile?.studentId || 'N/A'}</strong>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-[#E3DFD7] break-words">
                  <span className="text-[10px] text-[#5A6B61] block font-semibold">Official Timezone</span>
                  <strong className="text-[#161F1A] block font-mono break-words">{student?.timezone || 'America/New_York'}</strong>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-[#E3DFD7] break-words">
                  <span className="text-[10px] text-[#5A6B61] block font-semibold">Enrolled Status</span>
                  <strong className="text-emerald-700 block">{student?.status || 'Active'}</strong>
                </div>
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 flex items-center gap-2 break-words">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>You can safely update your avatar, bio, and personal goals anytime without affecting your classes!</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ISLAMIC VALUES REFERRAL TAB */}
      {currentTab === 'student_referrals' && (
        <IslamicReferralSection
          referrerName={student?.name || userProfile?.displayName || 'Student'}
          referrerStudentId={student?.studentId || userProfile?.studentId}
          referrerRole="student"
          referrerEmail={student?.email || userProfile?.email}
        />
      )}

      {/* COMPLETE LESSON DETAIL POPUP MODAL */}
      {selectedLessonForDetail && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4" onClick={() => setSelectedLessonForDetail(null)}>
          <div className="bg-white rounded-2xl border border-[#E3DFD7] shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden break-words" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#FAF9F7] px-5 py-3.5 border-b border-[#E3DFD7] flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-extrabold text-sm text-[#161F1A]">Complete Lesson Feedback</h3>
                <p className="text-[10px] text-[#5A6B61]">Session conducted on {selectedLessonForDetail.date}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLessonForDetail(null)}
                className="student-touch-target min-h-[44px] min-w-[44px] px-2.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-200/60 font-bold text-xs flex items-center justify-center cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#E8F5EE] p-3 rounded-xl border border-emerald-100">
                <div className="min-w-0 break-words">
                  <span className="text-[10px] font-bold text-[#1E5C3D] block uppercase tracking-wider">Subject Taught</span>
                  <p className="font-bold text-sm text-[#161F1A] break-words">{selectedLessonForDetail.lessonType}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold shrink-0 ${
                  selectedLessonForDetail.attendanceStatus === 'Absent' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {selectedLessonForDetail.attendanceStatus || 'Present'}
                </span>
              </div>

              {selectedLessonForDetail.attendanceStatus === 'Absent' ? (
                <div className="bg-red-50 p-3.5 rounded-xl border border-red-100 break-words">
                  <span className="font-bold text-red-700 block">Student Absent</span>
                  <p className="text-red-600 mt-1 break-words">{selectedLessonForDetail.absentReason || 'No lesson was conducted due to absence.'}</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="bg-[#FAF9F7] p-3 rounded-lg border border-[#EAE6DE] break-words">
                      <span className="text-[9px] font-bold text-[#5A6B61] uppercase tracking-wider block">Portion Recited</span>
                      <p className="font-semibold text-[#161F1A] mt-0.5 break-words">{selectedLessonForDetail.lessonCovered}</p>
                      {(selectedLessonForDetail.mushafPage || selectedLessonForDetail.quranDetails?.mushafPage) && (
                        <span className="inline-block mt-1 text-[9px] font-extrabold bg-[#E8F5EE] text-[#1E5C3D] px-1.5 py-0.5 rounded">
                          Mushaf Page: {selectedLessonForDetail.mushafPage || selectedLessonForDetail.quranDetails?.mushafPage}
                        </span>
                      )}
                    </div>
                    <div className="bg-[#FAF9F7] p-3 rounded-lg border border-[#EAE6DE] break-words">
                      <span className="text-[9px] font-bold text-[#5A6B61] uppercase tracking-wider block">Memorization Progress</span>
                      <p className="font-semibold text-[#B87314] mt-0.5 break-words">{selectedLessonForDetail.memorization || '—'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="bg-[#FAF9F7] p-3 rounded-lg border border-[#EAE6DE] break-words">
                      <span className="text-[9px] font-bold text-[#5A6B61] uppercase tracking-wider block">Adaab & Islamic Manners</span>
                      <p className="font-semibold text-[#2D8B5C] mt-0.5 break-words">{selectedLessonForDetail.adaabManners || '—'}</p>
                    </div>
                    <div className="bg-[#FAF9F7] p-3 rounded-lg border border-[#EAE6DE] break-words">
                      <span className="text-[9px] font-bold text-[#5A6B61] uppercase tracking-wider block">Revision & Practice</span>
                      <p className="font-semibold text-[#161F1A] mt-0.5 break-words">{selectedLessonForDetail.revision || 'None'}</p>
                    </div>
                  </div>

                  {selectedLessonForDetail.teacherRemarks && (
                    <div className="bg-amber-50/40 p-3 rounded-lg border border-amber-100 break-words">
                      <span className="text-[9px] font-bold text-[#B87314] uppercase tracking-wider block">Teacher's Personal Remarks</span>
                      <p className="text-[#161F1A] italic mt-1 leading-relaxed break-words">"{selectedLessonForDetail.teacherRemarks}"</p>
                    </div>
                  )}

                  {/* Screenshots inside detail modal */}
                  {selectedLessonForDetail.screenshots && selectedLessonForDetail.screenshots.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-bold text-[#5A6B61] uppercase tracking-wider block">Lesson Pages / Screenshots ({selectedLessonForDetail.screenshots.length})</span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {selectedLessonForDetail.screenshots.map((scr, idx) => (
                          scr.expired || !scr.url ? (
                            <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-1.5 text-center text-gray-400 text-[10px] flex flex-col items-center justify-center min-h-[50px]">
                              <Clock className="w-3.5 h-3.5 text-gray-300" />
                              <span className="text-[8px]">Image Expired</span>
                            </div>
                          ) : (
                            <div key={idx} className="relative rounded-lg overflow-hidden border border-[#D5D0C6] bg-black/5 aspect-video cursor-pointer" onClick={() => {
                              setActivePreviewImage(scr.url);
                              setSelectedLessonForDetail(null);
                            }}>
                              <img src={scr.url} alt={scr.name} referrerPolicy="no-referrer" className="object-cover w-full h-full" />
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-[#FAF9F7] px-5 py-3 border-t border-[#E3DFD7] flex flex-wrap items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => generateLessonReportPDF(selectedLessonForDetail)}
                className="student-touch-target min-h-[44px] px-4 py-2 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Download PDF Summary</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedLessonForDetail(null)}
                className="student-touch-target min-h-[44px] px-4 py-2 border border-[#D5D0C6] bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Elegant Downloader Lightbox */}
      {activePreviewImage && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in cursor-zoom-out" onClick={() => setActivePreviewImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center justify-center bg-black/40 p-2 rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <img src={activePreviewImage} alt="Preview" referrerPolicy="no-referrer" className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl" />
            
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3 bg-white/95 p-2.5 rounded-xl shadow-lg border border-[#E3DFD7]">
              <a
                role="button"
                href={activePreviewImage}
                download="lesson-curriculum-page.png"
                className="student-touch-target min-h-[44px] px-4 py-2 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Download to Practice Later</span>
              </a>
              <button
                type="button"
                onClick={() => setActivePreviewImage(null)}
                className="student-touch-target min-h-[44px] px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Close ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official In-App Fee Receipt Modal */}
      <FeeReceiptModal
        isOpen={!!viewingReceiptFee}
        onClose={() => setViewingReceiptFee(null)}
        fee={viewingReceiptFee}
        student={students.find(s => s.studentId === viewingReceiptFee?.studentId) || null}
      />

      {/* Student Profile & Avatar Customizer Modal */}
      <StudentProfileCustomizerModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        student={student}
        assignedTutor={assignedTutor}
      />

      {/* Payment Notice Modal */}
      <PaymentNoticeModal
        isOpen={!!paymentNoticeFee}
        onClose={() => setPaymentNoticeFee(null)}
        fee={paymentNoticeFee}
        submitterRole="Student"
        onPaymentSubmitted={async () => {
          if (onRefreshData) {
            await onRefreshData();
          }
        }}
      />
    </div>
  );
};
