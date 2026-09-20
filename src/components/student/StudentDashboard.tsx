import React, { useState, useEffect, useMemo } from 'react';
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
  FileSpreadsheet
} from 'lucide-react';
import {
  Student,
  Tutor,
  TimetableClass,
  Lesson,
  AttendanceRecord,
  StudentFee,
  Announcement
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { convertPKTToStudentTime, getTimezoneShortCode } from '../../utils/timezone';
import { generateInvoicePDF, generateLessonReportPDF, generateStudentReportPDF } from '../../utils/pdfGenerator';
import { FeeReceiptModal } from '../modals/FeeReceiptModal';
import { PaymentNoticeModal } from '../modals/PaymentNoticeModal';
import { StudentProfileCustomizerModal } from '../modals/StudentProfileCustomizerModal';
import { exportLessonsToCSV } from '../../utils/csvExporter';
import { getCurrencySymbol } from '../../utils/currency';
import { findStudentByEmailOrId } from '../../services/dataService';

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
  const [startDateReport, setStartDateReport] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDateReport, setEndDateReport] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [reportViewMode, setReportViewMode] = useState<'monthly' | 'weekly' | 'all'>('monthly');
  const [expandedMonths, setExpandedMonths] = useState<{ [key: string]: boolean }>({});
  const [expandedWeeks, setExpandedWeeks] = useState<{ [key: string]: boolean }>({});
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

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

  const assignedTutor = student ? tutors.find(t => t.tutorId === student.assignedTutorId) || null : null;

  // Filter student's own data strictly
  const myClasses = student ? classes.filter(c => c.studentId === student.studentId) : [];
  const myLessons = student ? lessons.filter(l => l.studentId === student.studentId) : [];
  const myAttendance = student ? attendance.filter(a => a.studentId === student.studentId) : [];

  const lessonsByMonth = useMemo(() => {
    const grouped: { [key: string]: Lesson[] } = {};
    myLessons.forEach(lesson => {
      const monthKey = lesson.month || 'Other / Uncategorized';
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(lesson);
    });
    return grouped;
  }, [myLessons]);

  const lessonsByWeek = useMemo(() => {
    const grouped: { [key: string]: Lesson[] } = {};
    myLessons.forEach(lesson => {
      const weekKey = `Week of ${getMonday(lesson.date)}`;
      if (!grouped[weekKey]) {
        grouped[weekKey] = [];
      }
      grouped[weekKey].push(lesson);
    });
    return grouped;
  }, [myLessons]);

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

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* Alert if student is not found */}
      {!student && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-3 text-xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-950">Student Profile Not Linked</h4>
            <p className="mt-0.5 text-amber-800">
              There is currently no student record linked to your email ({userProfile?.email || 'N/A'}). Please contact the Academy Administration to link your student profile.
            </p>
          </div>
        </div>
      )}

      {/* Welcome Banner with Permanent Zoom Classroom Link & Avatar */}
      {student && (
        <div className="bg-[#1E5C3D] text-white p-6 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Student Avatar with quick trigger */}
            <div
              onClick={() => setIsProfileModalOpen(true)}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 p-0.5 shadow-md flex items-center justify-center overflow-hidden border-2 border-white/30 shrink-0 cursor-pointer hover:scale-105 transition-transform group relative"
              title="Click to customize profile picture and goals"
            >
              {userProfile?.avatarUrl ? (
                <img
                  src={userProfile.avatarUrl}
                  alt="Student Avatar"
                  className="w-full h-full object-cover rounded-2xl"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-xl sm:text-2xl font-bold text-white">
                  {userProfile?.displayName?.charAt(0).toUpperCase() || student.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                <Edit3 className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#E8A93E] text-white text-[10px] font-bold uppercase tracking-wider">
                  Student Portal
                </span>
                <span className="text-xs text-[#b8dbca]">
                  Timezone: <strong className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-white" title={student?.timezone}>{getTimezoneShortCode(student?.timezone)}</strong>
                </span>
                {userProfile?.preferredName && (
                  <span className="text-xs text-emerald-200 italic font-medium">
                    (Known as "{userProfile.preferredName}")
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold tracking-tight">
                Assalamu Alaykum, {userProfile?.preferredName || student?.name}
              </h2>
              <p className="text-xs text-[#d2e8dd] max-w-xl">
                Course: <strong>{student?.courseType}</strong> with <strong>{assignedTutor?.tutorId || 'Assigned Tutor'} {assignedTutor?.realName ? `(${assignedTutor.realName})` : ''}</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs transition-colors flex items-center space-x-1.5 border border-white/20 shadow-xs cursor-pointer"
              title="Update profile picture, bio, and Islamic goals"
            >
              <User className="w-4 h-4 text-[#E8A93E]" />
              <span>Edit Profile & Avatar</span>
            </button>

            {(actualRole === 'parent' || userProfile?.role === 'parent' || adminViewingRole === 'student') && (
              <button
                type="button"
                onClick={() => setAdminViewingRole(actualRole === 'student' ? 'parent' : null, null)}
                className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs transition-colors flex items-center space-x-1.5 border border-white/20 shadow-xs cursor-pointer"
              >
                <Users className="w-4 h-4 text-emerald-200" />
                <span>Return to Parent Guardian Portal</span>
              </button>
            )}

            {/* Large Join Zoom Classroom button */}
            {assignedTutor?.zoomLink && (
              <a
                id="student_join_zoom_button"
                href={assignedTutor.zoomLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 rounded-xl bg-[#E8A93E] hover:bg-[#C98A1E] text-white font-bold text-sm transition-all flex items-center space-x-2.5 shadow-md transform hover:scale-[1.02]"
              >
                <Video className="w-5 h-5" />
                <span>Join My Live Class (Zoom)</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Trial Status Notice if on Trial */}
      {student?.status === 'Trial' && (
        <div className="bg-[#FFF9ED] border border-[#E8A93E] p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <Sparkles className="w-5 h-5 text-[#E8A93E]" />
            <div>
              <h4 className="text-xs font-bold text-[#8C5D08] uppercase tracking-wider">
                Free Trial in Progress: {student.trialSessionsCompleted || 0} of 5 Sessions Completed
              </h4>
              <p className="text-xs text-[#161F1A]">
                You have {5 - (student.trialSessionsCompleted || 0)} complimentary trial classes remaining.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#E8A93E] text-white">
            {student.trialStatus || 'In Progress'}
          </span>
        </div>
      )}



      {/* TAB 1: SCHEDULE (LOCAL TIME) */}
      {currentTab === 'student_schedule' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#161F1A]">My Weekly Class Schedule</h3>
              <p className="text-xs text-[#5A6B61]">
                Automatically converted to your local time (<strong className="font-mono text-[#2D8B5C]" title={student?.timezone}>{getTimezoneShortCode(student?.timezone)}</strong>).
              </p>
            </div>
          </div>

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
                return (
                  <div key={cls.id} className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#2D8B5C]">
                          {converted.localDay}
                        </span>
                        <h4 className="text-base font-bold text-[#161F1A] mt-0.5">
                          {converted.localTime} <span className="text-xs font-normal text-[#5A6B61]">local</span>
                        </h4>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                        {cls.durationMinutes} min
                      </span>
                    </div>

                    <div className="p-3 bg-[#FAF9F7] rounded-lg border border-[#E3DFD7] text-xs space-y-1">
                      <p className="text-[#5A6B61]">
                        Instructor: <strong className="text-[#2D8B5C]">{cls.tutorId}</strong>
                      </p>
                      <p className="text-[#5A6B61]">
                        Weekly Class: <span className="font-medium text-[#161F1A]">{converted.localDay}s at {converted.localTime}</span>
                      </p>
                    </div>

                    <a
                      href={assignedTutor?.zoomLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Enter Classroom</span>
                    </a>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* TAB 2: LESSONS & HOMEWORK */}
      {currentTab === 'student_lessons' && (
        <div className="space-y-5">
          {/* Custom Date Range Combined Report Downloader */}
          <div className="bg-white p-4 rounded-xl border border-[#E3DFD7] shadow-xs space-y-3">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-[#E8F5EE] rounded-lg text-[#1E5C3D]">
                <Calendar className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-[#161F1A]">Download Combined Progress Report</h4>
                <p className="text-[10px] text-[#5A6B61]">Select a custom date range to compile all lesson progress into a single consolidated PDF report.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
              <div>
                <label className="text-[10px] font-bold text-[#5A6B61] block mb-1">From Date</label>
                <input
                  type="date"
                  value={startDateReport}
                  onChange={(e) => setStartDateReport(e.target.value)}
                  className="w-full border border-[#D5D0C6] rounded-lg p-1.5 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:border-[#2D8B5C] outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#5A6B61] block mb-1">To Date</label>
                <input
                  type="date"
                  value={endDateReport}
                  onChange={(e) => setEndDateReport(e.target.value)}
                  className="w-full border border-[#D5D0C6] rounded-lg p-1.5 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:border-[#2D8B5C] outline-none"
                />
              </div>
              <div className="col-span-2 flex items-center space-x-2">
                <button
                  onClick={() => {
                    if (!student) return;
                    const filtered = myLessons.filter(l => l.date >= startDateReport && l.date <= endDateReport);
                    if (filtered.length === 0) {
                      alert("No completed lessons found within the selected date range.");
                      return;
                    }
                    generateStudentReportPDF(student, filtered, `Report (${startDateReport} to ${endDateReport})`);
                  }}
                  className="flex-1 py-1.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-lg text-xs font-bold shadow-xs flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF Report</span>
                </button>
                <button
                  onClick={() => {
                    if (!student) return;
                    const filtered = myLessons.filter(l => l.date >= startDateReport && l.date <= endDateReport);
                    if (filtered.length === 0) {
                      alert("No completed lessons found within the selected date range.");
                      return;
                    }
                    exportLessonsToCSV(
                      `${student.name} Academic Lessons`,
                      filtered,
                      `Range (${startDateReport} to ${endDateReport})`,
                      { studentName: student.name }
                    );
                  }}
                  className="flex-1 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow-xs flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV Report</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#161F1A]">My Lessons & Homework</h3>
              <p className="text-xs text-[#5A6B61]">
                Academic records and revision homework assigned by your teacher.
              </p>
            </div>

            {/* View Mode Switcher */}
            <div className="bg-[#FAF9F7] border border-[#E3DFD7] p-1 rounded-xl flex items-center space-x-1 self-start sm:self-auto shadow-xs">
              <button
                type="button"
                onClick={() => setReportViewMode('monthly')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  reportViewMode === 'monthly'
                    ? 'bg-white text-[#1E5C3D] shadow-xs'
                    : 'text-[#5A6B61] hover:text-[#161F1A]'
                }`}
              >
                Monthly Summary
              </button>
              <button
                type="button"
                onClick={() => setReportViewMode('weekly')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  reportViewMode === 'weekly'
                    ? 'bg-white text-[#1E5C3D] shadow-xs'
                    : 'text-[#5A6B61] hover:text-[#161F1A]'
                }`}
              >
                Weekly View
              </button>
              <button
                type="button"
                onClick={() => setReportViewMode('all')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  reportViewMode === 'all'
                    ? 'bg-white text-[#1E5C3D] shadow-xs'
                    : 'text-[#5A6B61] hover:text-[#161F1A]'
                }`}
              >
                Day-by-Day Logs
              </button>
            </div>
          </div>

          {/* Render helper */}
          {(() => {
            const renderLessonCard = (lesson: Lesson) => (
              <div
                key={lesson.id}
                onClick={() => setSelectedLessonForDetail(lesson)}
                className="bg-white p-5 rounded-xl border border-[#E3DFD7] hover:border-[#2D8B5C] cursor-pointer transition-all shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-[#161F1A]">{lesson.lessonType}</h4>
                    <p className="text-xs text-[#5A6B61]">Taught by {lesson.tutorId} on {lesson.date}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {(() => {
                      const status = lesson.attendanceStatus || 'Present';
                      return (
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center space-x-1 ${
                          status === 'Present' ? 'bg-emerald-50 text-emerald-900 border-emerald-300' :
                          status === 'Late' ? 'bg-amber-50 text-amber-900 border-amber-300' :
                          status === 'Absent' ? 'bg-rose-50 text-rose-900 border-rose-300' :
                          'bg-sky-50 text-sky-900 border-sky-300'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            status === 'Present' ? 'bg-emerald-600' :
                            status === 'Late' ? 'bg-amber-600' :
                            status === 'Absent' ? 'bg-rose-600' : 'bg-sky-600'
                          }`} />
                          <span>{status}</span>
                        </span>
                      );
                    })()}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLessonForDetail(lesson);
                      }}
                      className="px-2.5 py-1 text-xs font-medium text-white bg-[#2D8B5C] hover:bg-[#1E5C3D] rounded-md flex items-center space-x-1 cursor-pointer transition-colors"
                    >
                      <span>View Details</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        generateLessonReportPDF(lesson);
                      }}
                      className="px-2.5 py-1 text-xs font-medium text-[#161F1A] bg-[#FAF9F7] border border-[#D5D0C6] rounded-md hover:bg-gray-100 flex items-center space-x-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#2D8B5C]" />
                      <span>Download PDF</span>
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
                      <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Revision (Sabaq)</span>
                      <p className="font-medium text-[#161F1A] mt-0.5">{lesson.revision || 'None'}</p>
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
                          <div key={idx} className="relative rounded-lg overflow-hidden border border-[#D5D0C6] bg-black/5 aspect-video group cursor-zoom-in" onClick={() => setActivePreviewImage(scr.url)}>
                            <img
                              src={scr.url}
                              alt={scr.name}
                              referrerPolicy="no-referrer"
                              className="object-cover w-full h-full hover:scale-105 transition-transform duration-200"
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] p-1 truncate text-center opacity-0 group-hover:opacity-100 transition-opacity">
                              {scr.name}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {lesson.teacherRemarks && (
                  <p className="text-xs text-[#5A6B61] italic">
                    <strong>Teacher Encouragement:</strong> "{lesson.teacherRemarks}"
                  </p>
                )}
              </div>
            );

            if (myLessons.length === 0) {
              return (
                <div className="bg-white p-8 rounded-xl border border-[#E3DFD7] text-center text-xs text-[#5A6B61]">
                  <BookOpen className="w-8 h-8 text-[#D5D0C6] mx-auto mb-2" />
                  <p className="font-semibold text-[#161F1A]">No lesson reports recorded yet.</p>
                  <p className="text-[11px] mt-1">Lesson entries by your assigned tutor will appear here in real-time.</p>
                </div>
              );
            }

            if (reportViewMode === 'all') {
              return (
                <div className="space-y-3">
                  {myLessons.map(renderLessonCard)}
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
                        <div
                          className="bg-[#FAF9F7] px-4 py-3 border-b border-[#E3DFD7] flex items-center justify-between cursor-pointer hover:bg-[#F2EFE9] transition-colors"
                          onClick={() => setExpandedWeeks(prev => ({ ...prev, [weekKey]: !isExpanded }))}
                        >
                          <div className="flex items-center space-x-2.5">
                            <span className="w-2 h-2 rounded-full bg-[#2D8B5C]"></span>
                            <span className="text-sm font-bold text-[#161F1A]">{weekKey}</span>
                          </div>
                          <div className="flex items-center space-x-3 text-xs text-[#5A6B61]">
                            <span className="font-semibold bg-emerald-50 text-[#1E5C3D] px-2 py-0.5 rounded border border-emerald-200">
                              {presentCount} of {lessonsInWeek.length} Classes Completed
                            </span>
                            <span className="font-bold text-gray-400">{isExpanded ? 'Collapse ▲' : 'Expand ▼'}</span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-4 bg-gray-50/30 divide-y divide-[#EAE6DE] space-y-4">
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
                      <div
                        className="bg-[#FAF9F7] px-4 py-3.5 border-b border-[#E3DFD7] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 cursor-pointer hover:bg-[#F2EFE9] transition-colors"
                        onClick={() => setExpandedMonths(prev => ({ ...prev, [monthKey]: !isExpanded }))}
                      >
                        <div className="space-y-1">
                          <span className="text-base font-extrabold text-[#161F1A]">{monthKey} Report Card</span>
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
                          <span className="font-bold text-xs text-gray-400 shrink-0">{isExpanded ? 'Hide Logs ▲' : 'View Logs ▼'}</span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-4 bg-gray-50/30 space-y-4">
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
          <h3 className="text-base font-bold text-[#161F1A]">My Class Attendance Record</h3>
          <div className="bg-white border border-[#E3DFD7] rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F7] border-b border-[#E3DFD7] text-[#5A6B61] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Tutor</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE6DE]">
                {myAttendance.map(att => (
                  <tr key={att.id} className="hover:bg-[#FAF9F7]/60">
                    <td className="py-3 px-4 font-semibold text-[#161F1A]">{att.date}</td>
                    <td className="py-3 px-4 text-[#2D8B5C] font-medium">{att.tutorId}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        att.status === 'Present' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {att.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#5A6B61]">{att.notes || 'Verified attendance'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: FEE RECEIPTS */}
      {currentTab === 'student_fees' && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-[#161F1A]">Tuition Invoices & Payment Receipts</h3>
          <div className="space-y-3">
            {myFees.map(fee => {
              const isFamilyCov = (fee as any).isFamilyCoverage;
              return (
                <div key={fee.id} className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-[#2D8B5C]">{fee.invoiceNumber}</span>
                      {isFamilyCov && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#1E5C3D]/10 text-[#1E5C3D] border border-[#2D8B5C]/20">
                          Family Plan
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-[#161F1A] text-sm mt-0.5">
                      {fee.billingPeriod} Tuition {isFamilyCov ? '(Your Individual Allocation)' : ''}
                    </h4>
                    <p className="text-[#5A6B61]">Due Date: {fee.dueDate}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-base font-bold text-[#161F1A] font-mono">
                      {getCurrencySymbol(fee.currency)}{fee.amount.toLocaleString()}
                    </p>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        fee.status === 'Paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : fee.status === 'Payment Submitted'
                          ? 'bg-purple-100 text-purple-900 border border-purple-300'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {fee.status === 'Payment Submitted' ? 'Submitted (Pending Verification)' : fee.status}
                      </span>

                      {fee.status !== 'Paid' && (
                        <button
                          type="button"
                          onClick={() => setPaymentNoticeFee(fee)}
                          className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                          title="Notify academy administration that tuition payment was sent"
                        >
                          <Send className="w-3 h-3" />
                          <span>{fee.status === 'Payment Submitted' ? 'Update Notice' : 'Notify Paid'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setViewingReceiptFee(fee)}
                        className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer"
                        title="Open Official In-App Receipt"
                      >
                        <Receipt className="w-3 h-3 text-[#2D8B5C]" />
                        <span>Receipt</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => generateInvoicePDF(fee)}
                        className="px-2 py-0.5 text-xs text-[#2D8B5C] hover:underline cursor-pointer"
                        title="Download PDF"
                      >
                        PDF
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: ANNOUNCEMENTS */}
      {currentTab === 'announcements' && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-[#161F1A]">Academy Announcements</h3>
          <div className="space-y-3">
            {announcements.map(ann => (
              <div key={ann.id} className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs space-y-2">
                <h4 className="text-sm font-bold text-[#161F1A]">{ann.title}</h4>
                <p className="text-xs text-[#5A6B61] leading-relaxed">{ann.content}</p>
                <p className="text-[10px] text-[#5A6B61]">Posted on {new Date(ann.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: MY PROFILE & PERSONAL LEARNING JOURNEY */}
      {currentTab === 'student_profile' && (
        <div className="space-y-6">
          {/* Top Profile Summary Card */}
          <div className="bg-white p-6 rounded-2xl border border-[#E3DFD7] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1E5C3D] to-[#2D8B5C] p-0.5 shadow-md flex items-center justify-center overflow-hidden border-2 border-white shrink-0">
                {userProfile?.avatarUrl ? (
                  <img
                    src={userProfile.avatarUrl}
                    alt="Student Avatar"
                    className="w-full h-full object-cover rounded-2xl"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-3xl font-bold text-white">
                    {userProfile?.displayName?.charAt(0).toUpperCase() || student?.name?.charAt(0).toUpperCase() || 'S'}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-[#161F1A]">
                    {userProfile?.preferredName || student?.name || userProfile?.displayName}
                  </h3>
                  {userProfile?.preferredName && (
                    <span className="text-xs text-[#5A6B61]">({student?.name})</span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E8A93E] text-white">
                    {student?.courseType || 'Quranic Studies'}
                  </span>
                </div>
                <p className="text-xs text-[#5A6B61]">
                  Assigned ID: <strong className="font-mono text-[#2D8B5C]">{student?.studentId || userProfile?.studentId || 'STU-000'}</strong> • Instructor: <strong>{assignedTutor?.tutorId || 'Assigned Tutor'}</strong>
                </p>
                {userProfile?.bio && (
                  <p className="text-xs text-[#161F1A] italic max-w-xl pt-0.5">
                    "{userProfile.bio}"
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="px-4 py-2.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center space-x-2 shrink-0 cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>Customize Profile & Avatar</span>
            </button>
          </div>

          {/* Grid of Quranic Goals & Daily Habit Tracker */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Quran Goals & Preferences */}
            <div className="bg-white p-5 rounded-2xl border border-[#E3DFD7] shadow-xs space-y-4">
              <div className="flex items-center space-x-2 border-b border-[#E3DFD7] pb-3">
                <Target className="w-4 h-4 text-[#2D8B5C]" />
                <h4 className="text-xs font-bold text-[#161F1A] uppercase tracking-wider">
                  Quran Goals & Favorites
                </h4>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7] space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6B61] flex items-center gap-1">
                    <Target className="w-3 h-3 text-[#2D8B5C]" />
                    <span>Personal Target</span>
                  </span>
                  <p className="font-bold text-[#161F1A]">
                    {userProfile?.quranGoal || 'Memorize Juz Amma with Tajweed rules'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7] space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6B61] flex items-center gap-1">
                      <Heart className="w-3 h-3 text-red-500" />
                      <span>Favorite Surah</span>
                    </span>
                    <p className="font-bold text-[#161F1A] truncate">
                      {userProfile?.favoriteSurah || 'Surah Ar-Rahman (55)'}
                    </p>
                  </div>

                  <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7] space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6B61] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#2D8B5C]" />
                      <span>Daily Target</span>
                    </span>
                    <p className="font-bold text-[#161F1A]">
                      {userProfile?.dailyGoalMinutes || 20} mins / day
                    </p>
                  </div>
                </div>

                {userProfile?.hobbies && (
                  <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7] space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6B61]">
                      Hobbies & Interests
                    </span>
                    <p className="text-[#161F1A] font-medium">{userProfile.hobbies}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Protected Academy Records Shield */}
            <div className="bg-[#FAF9F7] p-5 rounded-2xl border border-[#D5D0C6] shadow-xs space-y-4">
              <div className="flex items-center space-x-2 border-b border-[#D5D0C6] pb-3">
                <ShieldCheck className="w-4 h-4 text-[#1E5C3D]" />
                <h4 className="text-xs font-bold text-[#161F1A] uppercase tracking-wider">
                  Academic Safety Shield
                </h4>
              </div>

              <p className="text-xs text-[#5A6B61] leading-relaxed">
                To guarantee zero disruption to your tutor schedules, attendance records, and family tuition statements, official academic identity fields are managed exclusively by Academy Administration.
              </p>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-[#E3DFD7]">
                  <span className="text-[10px] text-[#5A6B61] block font-semibold">Official Student Name</span>
                  <strong className="text-[#161F1A] truncate block">{student?.name || userProfile?.displayName}</strong>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-[#E3DFD7]">
                  <span className="text-[10px] text-[#5A6B61] block font-semibold">Assigned Student ID</span>
                  <strong className="text-[#2D8B5C] font-mono block">{student?.studentId || userProfile?.studentId || 'N/A'}</strong>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-[#E3DFD7]">
                  <span className="text-[10px] text-[#5A6B61] block font-semibold">Official Timezone</span>
                  <strong className="text-[#161F1A] block font-mono">{student?.timezone || 'America/New_York'}</strong>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-[#E3DFD7]">
                  <span className="text-[10px] text-[#5A6B61] block font-semibold">Enrolled Status</span>
                  <strong className="text-emerald-700 block">{student?.status || 'Active'}</strong>
                </div>
              </div>

              <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>You can safely update your avatar, bio, and personal goals anytime without affecting your classes!</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETE LESSON DETAIL POPUP MODAL */}
      {selectedLessonForDetail && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setSelectedLessonForDetail(null)}>
          <div className="bg-white rounded-2xl border border-[#E3DFD7] shadow-2xl max-w-lg w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#FAF9F7] px-5 py-4 border-b border-[#E3DFD7] flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-[#161F1A]">Complete Lesson Feedback</h3>
                <p className="text-[10px] text-[#5A6B61]">Session conducted on {selectedLessonForDetail.date}</p>
              </div>
              <button
                onClick={() => setSelectedLessonForDetail(null)}
                className="text-gray-400 hover:text-gray-700 font-bold text-xs"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="flex items-center justify-between bg-[#E8F5EE] p-3 rounded-xl border border-emerald-100">
                <div>
                  <span className="text-[10px] font-bold text-[#1E5C3D] block uppercase tracking-wider">Subject Taught</span>
                  <p className="font-bold text-sm text-[#161F1A]">{selectedLessonForDetail.lessonType}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold ${
                  selectedLessonForDetail.attendanceStatus === 'Absent' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {selectedLessonForDetail.attendanceStatus || 'Present'}
                </span>
              </div>

              {selectedLessonForDetail.attendanceStatus === 'Absent' ? (
                <div className="bg-red-50 p-3.5 rounded-xl border border-red-100">
                  <span className="font-bold text-red-700 block">Student Absent</span>
                  <p className="text-red-600 mt-1">{selectedLessonForDetail.absentReason || 'No lesson was conducted due to absence.'}</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="bg-[#FAF9F7] p-2.5 rounded-lg border border-[#EAE6DE]">
                      <span className="text-[9px] font-bold text-[#5A6B61] uppercase tracking-wider block">Portion Recited</span>
                      <p className="font-semibold text-[#161F1A] mt-0.5">{selectedLessonForDetail.lessonCovered}</p>
                      {(selectedLessonForDetail.mushafPage || selectedLessonForDetail.quranDetails?.mushafPage) && (
                        <span className="inline-block mt-1 text-[9px] font-extrabold bg-[#E8F5EE] text-[#1E5C3D] px-1.5 py-0.5 rounded">
                          Mushaf Page: {selectedLessonForDetail.mushafPage || selectedLessonForDetail.quranDetails?.mushafPage}
                        </span>
                      )}
                    </div>
                    <div className="bg-[#FAF9F7] p-2.5 rounded-lg border border-[#EAE6DE]">
                      <span className="text-[9px] font-bold text-[#5A6B61] uppercase tracking-wider block">Memorization Progress</span>
                      <p className="font-semibold text-[#B87314] mt-0.5">{selectedLessonForDetail.memorization || '—'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="bg-[#FAF9F7] p-2.5 rounded-lg border border-[#EAE6DE]">
                      <span className="text-[9px] font-bold text-[#5A6B61] uppercase tracking-wider block">Adaab & Islamic Manners</span>
                      <p className="font-semibold text-[#2D8B5C] mt-0.5">{selectedLessonForDetail.adaabManners || '—'}</p>
                    </div>
                    <div className="bg-[#FAF9F7] p-2.5 rounded-lg border border-[#EAE6DE]">
                      <span className="text-[9px] font-bold text-[#5A6B61] uppercase tracking-wider block">Revision & Practice</span>
                      <p className="font-semibold text-[#161F1A] mt-0.5">{selectedLessonForDetail.revision || 'None'}</p>
                    </div>
                  </div>

                  {selectedLessonForDetail.teacherRemarks && (
                    <div className="bg-amber-50/40 p-3 rounded-lg border border-amber-100">
                      <span className="text-[9px] font-bold text-[#B87314] uppercase tracking-wider block">Teacher's Personal Remarks</span>
                      <p className="text-[#161F1A] italic mt-1 leading-relaxed">"{selectedLessonForDetail.teacherRemarks}"</p>
                    </div>
                  )}

                  {/* Screenshots inside detail modal */}
                  {selectedLessonForDetail.screenshots && selectedLessonForDetail.screenshots.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-bold text-[#5A6B61] uppercase tracking-wider block">Lesson Pages / Screenshots ({selectedLessonForDetail.screenshots.length})</span>
                      <div className="grid grid-cols-3 gap-2">
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

            <div className="bg-[#FAF9F7] px-5 py-3 border-t border-[#E3DFD7] flex items-center justify-between">
              <button
                onClick={() => generateLessonReportPDF(selectedLessonForDetail)}
                className="px-3.5 py-1.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-bold rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF Summary</span>
              </button>
              <button
                onClick={() => setSelectedLessonForDetail(null)}
                className="px-3.5 py-1.5 border border-[#D5D0C6] bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
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
            <img src={activePreviewImage} alt="Preview" referrerPolicy="no-referrer" className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" />
            
            <div className="mt-3 flex items-center space-x-3 bg-white/95 p-2 rounded-xl shadow-lg border border-[#E3DFD7]">
              <a
                href={activePreviewImage}
                download="lesson-curriculum-page.png"
                className="px-3.5 py-1.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-bold rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download to Practice Later</span>
              </a>
              <button
                onClick={() => setActivePreviewImage(null)}
                className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
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
