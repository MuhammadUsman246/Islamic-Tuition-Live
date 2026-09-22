import React, { useState, useMemo } from 'react';
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
  Palmtree
} from 'lucide-react';
import {
  Tutor,
  Student,
  TimetableClass,
  Lesson,
  AttendanceRecord,
  TutorStudentView,
  Announcement
} from '../../types';
import { TimetableGrid } from '../common/TimetableGrid';
import { LessonModal } from '../modals/LessonModal';
import { StudentMonthReportModal } from '../modals/StudentMonthReportModal';
import { launchTutorZoomDesktop } from '../../utils/zoomUtils';
import { sanitizeStudentForTutor, addLesson, addAttendanceRecord, updateClass } from '../../services/dataService';
import { generateLessonReportPDF, generateStudentReportPDF } from '../../utils/pdfGenerator';
import { exportLessonsToCSV } from '../../utils/csvExporter';
import { useAuth } from '../../context/AuthContext';

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
  const [selectedStudentForLesson, setSelectedStudentForLesson] = useState<string>('');
  const [selectedStudentForMonthReport, setSelectedStudentForMonthReport] = useState<Student | null>(null);
  const [isMonthReportModalOpen, setIsMonthReportModalOpen] = useState<boolean>(false);

  const { userProfile, adminViewingRole, adminViewingTargetId } = useAuth();

  // Identify current tutor with role/persona safety
  const tutor = React.useMemo(() => {
    if (adminViewingRole === 'tutor' && adminViewingTargetId) {
      const match = tutors.find(t => t.tutorId === adminViewingTargetId);
      if (match) return match;
    }
    return tutors.find(t =>
      (currentTutorId && t.tutorId === currentTutorId) ||
      (userProfile?.tutorId && t.tutorId === userProfile.tutorId) ||
      (userProfile?.email && t.email && t.email.toLowerCase().trim() === userProfile.email.toLowerCase().trim())
    ) || tutors[0];
  }, [tutors, currentTutorId, userProfile, adminViewingRole, adminViewingTargetId]);

  // Filter classes for this tutor
  const myClasses = classes.filter(c => c.tutorId === tutor?.tutorId);

  // STRICT ALLOW-LIST PRIVACY: Filter and sanitize students assigned to this tutor (or who have scheduled classes with them)
  const classStudentIds = new Set(myClasses.map(c => c.studentId));
  const myAssignedStudents: TutorStudentView[] = students
    .filter(s => s.assignedTutorId === tutor?.tutorId || classStudentIds.has(s.studentId))
    .map(sanitizeStudentForTutor);

  // Filter lessons for this tutor
  const myLessons = lessons.filter(l => l.tutorId === tutor?.tutorId || myAssignedStudents.some(s => s.studentId === l.studentId));

  // Time Period & Student Filter state for Tutor Lesson Reports
  const [reportTimeMode, setReportTimeMode] = useState<'all' | 'monthly' | 'weekly' | 'custom'>('monthly');
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>('all');
  const [tutorStartDate, setTutorStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [tutorEndDate, setTutorEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const filteredTutorLessons = useMemo(() => {
    return myLessons.filter(l => {
      if (selectedStudentFilter !== 'all' && l.studentId !== selectedStudentFilter) {
        return false;
      }
      if (reportTimeMode === 'weekly') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        const weekAgo = d.toISOString().slice(0, 10);
        return l.date >= weekAgo;
      } else if (reportTimeMode === 'monthly') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        const monthAgo = d.toISOString().slice(0, 10);
        return l.date >= monthAgo;
      } else if (reportTimeMode === 'custom') {
        if (tutorStartDate && l.date < tutorStartDate) return false;
        if (tutorEndDate && l.date > tutorEndDate) return false;
      }
      return true;
    });
  }, [myLessons, selectedStudentFilter, reportTimeMode, tutorStartDate, tutorEndDate]);

  // New Class Notifications tracking for Tutor (Item 8)
  const [acknowledgedClassIds, setAcknowledgedClassIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(`tutor_ack_classes_${tutor?.tutorId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Group unacknowledged classes by student
  const studentClassMap = new Map<string, TimetableClass[]>();
  myClasses.filter(c => !acknowledgedClassIds.includes(c.id)).forEach(c => {
    const list = studentClassMap.get(c.studentId || c.studentName) || [];
    list.push(c);
    studentClassMap.set(c.studentId || c.studentName, list);
  });

  const groupedNewAssignments = Array.from(studentClassMap.entries()).map(([studentKey, studentClasses]) => {
    const first = studentClasses[0];
    // Sort days chronologically
    const dayOrder: Record<string, number> = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };
    const sortedDays = Array.from(new Set(studentClasses.map(c => c.dayOfWeek))).sort((a, b) => (dayOrder[a] || 99) - (dayOrder[b] || 99));
    
    let daysLabel = sortedDays.join(', ');
    if (sortedDays.length >= 3 && sortedDays[0] === 'Monday' && sortedDays[sortedDays.length - 1] === 'Friday') {
      daysLabel = 'Mon - Fri';
    } else if (sortedDays.length === 2 && sortedDays[0] === 'Saturday' && sortedDays[1] === 'Sunday') {
      daysLabel = 'Weekends';
    }

    return {
      studentKey,
      studentName: first.studentName,
      studentId: first.studentId,
      time: first.startTimePKT,
      daysLabel,
      classIds: studentClasses.map(c => c.id)
    };
  });

  const handleAcknowledgeStudentGroup = (classIds: string[]) => {
    const updated = Array.from(new Set([...acknowledgedClassIds, ...classIds]));
    setAcknowledgedClassIds(updated);
    try {
      localStorage.setItem(`tutor_ack_classes_${tutor?.tutorId}`, JSON.stringify(updated));
    } catch {}
  };

  const handleAcknowledgeAll = () => {
    const allIds = myClasses.map(c => c.id);
    setAcknowledgedClassIds(allIds);
    try {
      localStorage.setItem(`tutor_ack_classes_${tutor?.tutorId}`, JSON.stringify(allIds));
    } catch {}
  };

  const handleSaveLesson = async (lessonData: Omit<Lesson, 'id'>) => {
    await addLesson({
      ...lessonData,
      tutorId: tutor?.tutorId || 'Tutor 1'
    });
    await onRefreshData();
  };

  const handleQuickAttendance = async (studentId: string, studentName: string, status: 'Present' | 'Absent') => {
    await addAttendanceRecord({
      classId: 'tutor_quick',
      studentId,
      studentName,
      tutorId: tutor?.tutorId || 'Tutor 1',
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

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* Top Banner: Permanent Zoom Classroom & Quick Log Lesson */}
      <div className="bg-[#1E5C3D] text-white p-6 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#E8A93E] text-white text-[10px] font-bold uppercase tracking-wider">
              {tutor?.tutorId || 'Tutor'} Portal
            </span>
            <span className="text-xs text-[#b8dbca]">Operational Timetable: Asia/Karachi (PKT)</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            Assalamu Alaykum, {tutor?.realName || 'Ustadh'}
          </h2>
          <p className="text-xs text-[#d2e8dd] max-w-xl">
            Welcome to your teaching hub. Launch your permanent Zoom classroom link to conduct classes and submit structured reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Permanent Zoom Action Button - Launches directly into local Zoom desktop application */}
          <button
            type="button"
            id="tutor_zoom_launch_button"
            onClick={handleLaunchZoomDesktop}
            className="px-5 py-2.5 rounded-xl bg-[#E8A93E] hover:bg-[#C98A1E] text-white font-semibold text-xs transition-colors flex items-center space-x-2 shadow-xs cursor-pointer"
            title="Launch and start your permanent Zoom classroom directly in your logged-in desktop application"
          >
            <Video className="w-4 h-4" />
            <span>Launch Zoom Classroom</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          {/* Quick Log Lesson Button */}
          <button
            id="tutor_log_lesson_button"
            onClick={() => {
              setSelectedStudentForLesson(myAssignedStudents[0]?.studentId || '');
              setIsLessonModalOpen(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-[#1E5C3D] font-semibold text-xs transition-colors flex items-center space-x-2 shadow-xs"
          >
            <BookOpen className="w-4 h-4 text-[#2D8B5C]" />
            <span>Record Lesson Report</span>
          </button>
        </div>
      </div>


      {/* Floating Modern Notification Tray for New Class Assignments */}
      {groupedNewAssignments.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full space-y-2.5 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto">
          <div className="bg-[#1E5C3D] text-white px-4 py-3 rounded-2xl shadow-xl border border-emerald-600 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 text-emerald-200 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                  New Class Assignments
                </h4>
                <p className="text-[11px] text-emerald-200">
                  {groupedNewAssignments.length} student schedules pending review
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAcknowledgeAll}
              className="text-[11px] font-bold bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg text-white transition-colors cursor-pointer"
            >
              Dismiss All
            </button>
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {groupedNewAssignments.map((ga) => (
              <div
                key={ga.studentKey}
                className="bg-white/95 backdrop-blur-md p-3.5 rounded-xl border border-[#D5EADF] shadow-lg text-xs flex items-center justify-between gap-3 group hover:border-[#2D8B5C] transition-all"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#2D8B5C] shrink-0" />
                    <p className="font-extrabold text-[#161F1A] text-[13px] truncate">{ga.studentName}</p>
                  </div>
                  <div className="pl-3.5 space-y-0.5">
                    <p className="text-[11px] font-semibold text-emerald-900 flex items-center gap-1">
                      <span>Days:</span> <span className="text-[#1E5C3D]">{ga.daysLabel}</span>
                    </p>
                    <p className="text-[11px] font-semibold text-emerald-900 flex items-center gap-1">
                      <span>Time:</span> <span className="text-[#1E5C3D]">{ga.time} PKT</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleAcknowledgeStudentGroup(ga.classIds)}
                  className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-rose-100 hover:text-rose-700 text-gray-500 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  title="Hide/Dismiss notification"
                  aria-label="Hide notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}



      {/* TAB 1: WEEKLY TIMETABLE */}
      {currentTab === 'tutor_timetable' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#161F1A]">My Weekly Teaching Schedule</h3>
              <p className="text-xs text-[#5A6B61]">
                Clean schedule calibrated in Asia/Karachi (PKT). 30-minute standard sessions.
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
                    <span className="text-xs font-mono font-bold text-[#2D8B5C]">{st.studentId}</span>
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
                  <p className="text-[#5A6B61]"><strong>Teaching Timetable:</strong> PKT Operational Schedule</p>
                  {st.status === 'Trial' && (
                    <p className="text-[#8C5D08]">
                      <strong>Trial Progress:</strong> {st.trialSessionsCompleted} of 5 completed
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-[#EAE6DE] grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
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
                  const label = studentObj ? `${studentObj.name} Lessons` : `Tutor ${tutor?.name || ''} Lessons`;
                  exportLessonsToCSV(
                    label,
                    filteredTutorLessons,
                    `Filter (${reportTimeMode.toUpperCase()})`,
                    { tutorName: tutor?.name, studentName: studentObj?.name }
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
              <div className="flex items-center space-x-1 bg-white p-1 rounded-lg border border-[#E3DFD7]">
                {(['monthly', 'weekly', 'custom', 'all'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setReportTimeMode(mode)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                      reportTimeMode === mode
                        ? 'bg-[#2D8B5C] text-white shadow-xs'
                        : 'text-[#5A6B61] hover:text-[#161F1A] hover:bg-gray-100'
                    }`}
                  >
                    {mode === 'monthly' ? 'Last 30 Days' : mode === 'weekly' ? 'Last 7 Days' : mode === 'custom' ? 'Custom Range' : 'All Time'}
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
              filteredTutorLessons.map(lesson => (
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
                    </div>
                    <p className="text-[11px] text-[#5A6B61]">{lesson.date} ({lesson.month})</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => generateLessonReportPDF(lesson)}
                      className="p-1 text-[#2D8B5C] hover:bg-gray-100 rounded"
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
            )))}
          </div>
        </div>
      )}

      {/* TAB 4: ATTENDANCE TRACKING */}
      {currentTab === 'tutor_attendance' && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-[#161F1A]">Class Attendance Log</h3>
          <div className="bg-white border border-[#E3DFD7] rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F7] border-b border-[#E3DFD7] text-[#5A6B61] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE6DE]">
                {attendance
                  .filter(a => a.tutorId === tutor?.tutorId)
                  .map(att => (
                    <tr key={att.id} className="hover:bg-[#FAF9F7]/60">
                      <td className="py-3 px-4 font-semibold text-[#161F1A]">{att.studentName} ({att.studentId})</td>
                      <td className="py-3 px-4">{att.date}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          att.status === 'Present' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {att.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#5A6B61] font-mono">{att.markedAt}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: ANNOUNCEMENTS */}
      {currentTab === 'announcements' && (
        <AnnouncementsList announcements={announcements} />
      )}

      {/* Lesson Modal */}
      <LessonModal
        isOpen={isLessonModalOpen}
        onClose={() => setIsLessonModalOpen(false)}
        onSave={handleSaveLesson}
        students={students.filter(s => s.assignedTutorId === tutor?.tutorId)}
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
          setSelectedStudentForLesson(studentId);
          setIsLessonModalOpen(true);
        }}
      />
    </div>
  );
};
