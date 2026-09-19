import React, { useState } from 'react';
import { AnnouncementsList } from '../common/AnnouncementsList';
import {
  ShieldCheck,
  Calendar,
  Clock,
  BookOpen,
  Users,
  CheckCircle,
  AlertTriangle,
  Plus,
  Edit2,
  Bell,
  X,
  Download,
  Search,
  Trash2,
  FileImage,
  FileSpreadsheet,
  ShieldAlert,
  Sparkles,
  Eye
} from 'lucide-react';
import {
  Tutor,
  Student,
  TimetableClass,
  Lesson,
  TutorAttendanceRecord,
  AttendanceRecord,
  Announcement
} from '../../types';
import { TimetableGrid } from '../common/TimetableGrid';
import { exportLessonsToCSV } from '../../utils/csvExporter';
import { generateLessonReportPDF, generateStudentReportPDF } from '../../utils/pdfGenerator';
import {
  sanitizeStudentForSupervisor,
  addTutorAttendanceRecord,
  updateTutorAttendanceRecord,
  updateClass,
  updateTutor,
  updateLesson,
  deleteLesson,
  addLesson
} from '../../services/dataService';
import { TutorAttendanceModal } from '../modals/TutorAttendanceModal';
import { LessonMaterialEditModal } from '../modals/LessonMaterialEditModal';
import { LessonEditModal } from '../modals/LessonEditModal';
import { LessonModal } from '../modals/LessonModal';

interface SupervisorDashboardProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  tutors: Tutor[];
  students: Student[];
  classes: TimetableClass[];
  lessons: Lesson[];
  attendance: AttendanceRecord[];
  tutorAttendance: TutorAttendanceRecord[];
  announcements: Announcement[];
  onRefreshData?: () => Promise<void>;
}

export const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({
  currentTab,
  setCurrentTab,
  tutors,
  students,
  classes,
  lessons,
  tutorAttendance,
  announcements,
  onRefreshData
}) => {
  const [selectedTutorId, setSelectedTutorId] = useState<string>('all');
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState<boolean>(false);
  const [selectedAttendanceRecord, setSelectedAttendanceRecord] = useState<TutorAttendanceRecord | null>(null);

  // New Class Notifications tracking for Supervisor
  const [supervisorAcknowledgedClassIds, setSupervisorAcknowledgedClassIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('supervisor_ack_classes');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Group unacknowledged classes by student & tutor for supervisor
  const supervisorStudentMap = new Map<string, TimetableClass[]>();
  classes.filter(c => !supervisorAcknowledgedClassIds.includes(c.id)).forEach(c => {
    const key = `${c.studentId || c.studentName}_${c.tutorId}`;
    const list = supervisorStudentMap.get(key) || [];
    list.push(c);
    supervisorStudentMap.set(key, list);
  });

  const groupedSupervisorAssignments = Array.from(supervisorStudentMap.entries()).map(([key, studentClasses]) => {
    const first = studentClasses[0];
    const assignedTutor = tutors.find(t => t.tutorId === first.tutorId);
    
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
      groupKey: key,
      studentName: first.studentName,
      tutorName: assignedTutor?.name || first.tutorId,
      time: first.startTimePKT,
      daysLabel,
      classIds: studentClasses.map(c => c.id)
    };
  });

  const handleSupervisorAcknowledgeGroup = (classIds: string[]) => {
    const updated = Array.from(new Set([...supervisorAcknowledgedClassIds, ...classIds]));
    setSupervisorAcknowledgedClassIds(updated);
    try {
      localStorage.setItem('supervisor_ack_classes', JSON.stringify(updated));
    } catch {}
  };

  const handleSupervisorAcknowledgeAll = () => {
    const allIds = classes.map(c => c.id);
    setSupervisorAcknowledgedClassIds(allIds);
    try {
      localStorage.setItem('supervisor_ack_classes', JSON.stringify(allIds));
    } catch {}
  };

  // Sanitize students for supervisor (strip phone, email, parent contacts, private admin notes)
  const sanitizedStudents = students.map(sanitizeStudentForSupervisor);

  const filteredClasses = selectedTutorId === 'all'
    ? classes
    : classes.filter(c => c.tutorId === selectedTutorId);

  const [supervisorLessonsViewMode, setSupervisorLessonsViewMode] = useState<'cards' | 'spreadsheet'>('spreadsheet');
  const [supervisorSearchQuery, setSupervisorSearchQuery] = useState<string>('');
  const [supervisorSafetyFilter, setSupervisorSafetyFilter] = useState<'all' | 'audited' | 'flagged' | 'pending'>('all');
  const [supervisorTimeMode, setSupervisorTimeMode] = useState<'all' | 'monthly' | 'weekly' | 'custom'>('all');
  const [supervisorStudentId, setSupervisorStudentId] = useState<string>('all');
  const [supervisorStartDate, setSupervisorStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [supervisorEndDate, setSupervisorEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Modal states for Supervisor editing and auditing
  const [selectedMaterialLesson, setSelectedMaterialLesson] = useState<Lesson | null>(null);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState<boolean>(false);
  const [selectedEditLesson, setSelectedEditLesson] = useState<Lesson | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isNewLessonModalOpen, setIsNewLessonModalOpen] = useState<boolean>(false);



  const filteredLessons = lessons
    .filter(l => {
      if (selectedTutorId !== 'all' && l.tutorId !== selectedTutorId) return false;
      if (supervisorStudentId !== 'all' && l.studentId !== supervisorStudentId) return false;

      // Search Query filter (matches student name, student ID, tutor ID, lesson covered, course)
      if (supervisorSearchQuery.trim()) {
        const query = supervisorSearchQuery.toLowerCase();
        const matches =
          (l.studentName || '').toLowerCase().includes(query) ||
          (l.studentId || '').toLowerCase().includes(query) ||
          (l.tutorId || '').toLowerCase().includes(query) ||
          (l.lessonCovered || '').toLowerCase().includes(query) ||
          (l.lessonType || '').toLowerCase().includes(query) ||
          (l.teacherRemarks || '').toLowerCase().includes(query);
        if (!matches) return false;
      }

      // Safety & Security Audit filter
      if (supervisorSafetyFilter === 'audited') {
        if (l.safetyStatus !== 'Audited' && l.safetyStatus !== 'Safe') return false;
      } else if (supervisorSafetyFilter === 'flagged') {
        if (l.safetyStatus !== 'Flagged') return false;
      } else if (supervisorSafetyFilter === 'pending') {
        if (l.safetyStatus === 'Audited' || l.safetyStatus === 'Safe') return false;
      }

      // Timeframe filter - guarantees today's lessons and upcoming timezone dates are never hidden!
      if (supervisorTimeMode === 'all') return true;

      const lessonTime = new Date(l.date).getTime();
      const nowTime = Date.now();
      const diffDays = (nowTime - lessonTime) / (1000 * 60 * 60 * 24);

      if (supervisorTimeMode === 'weekly') {
        // Safe: include today, future timezone dates, and up to 7 days past
        return diffDays <= 7;
      } else if (supervisorTimeMode === 'monthly') {
        // Safe: include today, future timezone dates, and up to 31 days past
        return diffDays <= 31;
      } else if (supervisorTimeMode === 'custom') {
        if (supervisorStartDate && l.date < supervisorStartDate) return false;
        if (supervisorEndDate && l.date > supervisorEndDate) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

  const handleQuickSafetyAudit = async (lesson: Lesson, newStatus: 'Audited' | 'Flagged' | 'Safe') => {
    try {
      await updateLesson(lesson.id, {
        safetyStatus: newStatus,
        auditedBy: 'SUPERVISOR - Quality & Safety Audit',
        auditedAt: new Date().toISOString()
      });
      if (onRefreshData) await onRefreshData();
    } catch (err: any) {
      alert("Error updating safety audit: " + err.message);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this lesson report? Supervisor override will remove it from all records and spreadsheets.")) return;
    try {
      await deleteLesson(lessonId);
      if (onRefreshData) await onRefreshData();
    } catch (err: any) {
      alert("Error deleting lesson report: " + err.message);
    }
  };

  const handleSaveNewLesson = async (lessonData: Omit<Lesson, 'id'>) => {
    await addLesson(lessonData);
    if (onRefreshData) await onRefreshData();
  };

  const lateTutors = tutorAttendance.filter(t => t.status === 'Late' || (t.lateDurationMinutes && t.lateDurationMinutes > 0));

  const handleSaveAttendance = async (record: Omit<TutorAttendanceRecord, 'id'>, id?: string) => {
    if (id) {
      await updateTutorAttendanceRecord(id, record);
    } else {
      await addTutorAttendanceRecord(record);
    }
    if (onRefreshData) await onRefreshData();
  };

  // Monthly summary per tutor for Item 13
  const tutorSummaryMap = React.useMemo(() => {
    const map: Record<string, { total: number; present: number; absent: number; late: number; excused: number }> = {};
    tutors.forEach(t => {
      map[t.tutorId] = { total: 0, present: 0, absent: 0, late: 0, excused: 0 };
    });
    tutorAttendance.forEach(a => {
      if (!map[a.tutorId]) {
        map[a.tutorId] = { total: 0, present: 0, absent: 0, late: 0, excused: 0 };
      }
      map[a.tutorId].total += 1;
      if (a.status === 'Present' || a.status === 'On Time') map[a.tutorId].present += 1;
      else if (a.status === 'Late') map[a.tutorId].late += 1;
      else if (a.status === 'Absent') map[a.tutorId].absent += 1;
      else if (a.status === 'Excused' || a.status === 'Leave') map[a.tutorId].excused += 1;
    });
    return map;
  }, [tutors, tutorAttendance]);

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* Header Banner */}
      <div className="bg-[#14231b] text-white p-6 rounded-2xl border border-[#263e32] shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#2D8B5C] text-white text-[10px] font-bold uppercase tracking-wider">
              Academic Supervision
            </span>
            <span className="text-xs text-[#9cb4a6]">Operations & Teaching Quality Control</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">Supervisor Command Deck</h2>
          <p className="text-xs text-[#c4d6cc] max-w-xl">
            Audit master schedules, monitor tutor punctuality, and evaluate Quranic lesson quality across academy faculties.
          </p>
        </div>
      </div>



      {/* TAB 1: OPERATIONS OVERVIEW */}
      {currentTab === 'supervisor_overview' && (
        <div className="space-y-6">
          {/* Lateness Alert if any */}
          {lateTutors.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                    {lateTutors.length} Tutor Lateness Incident(s) Logged
                  </h4>
                  <p className="text-xs text-amber-800">
                    Faculty members logged into Zoom after the scheduled start time.
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-amber-900 bg-amber-100 px-3 py-1 rounded-md">
                Requires Academic Review
              </span>
            </div>
          )}



          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs">
              <span className="text-xs font-semibold text-[#5A6B61] uppercase tracking-wider">Monitored Classes</span>
              <p className="text-2xl font-bold text-[#161F1A] mt-1">{classes.length}</p>
              <p className="text-[11px] text-[#5A6B61] mt-1">Calibrated in Asia/Karachi (PKT)</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs">
              <span className="text-xs font-semibold text-[#5A6B61] uppercase tracking-wider">Active Faculty Tutors</span>
              <p className="text-2xl font-bold text-[#161F1A] mt-1">{tutors.length}</p>
              <p className="text-[11px] text-[#5A6B61] mt-1">Dedicated permanent Zoom classrooms</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs">
              <span className="text-xs font-semibold text-[#5A6B61] uppercase tracking-wider">Lesson Reports Filed</span>
              <p className="text-2xl font-bold text-[#161F1A] mt-1">{lessons.length}</p>
              <p className="text-[11px] text-[#5A6B61] mt-1">With performance grading</p>
            </div>
          </div>

          {/* Timetable view */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[#161F1A]">Master Timetable Inspection</h3>
            <TimetableGrid
              classes={filteredClasses}
              role="supervisor"
              currentTutorId={selectedTutorId}
              students={students}
              tutors={tutors}
              onCancelClass={async (classId, newStatus) => {
                await updateClass(classId, { status: newStatus });
                if (onRefreshData) {
                  await onRefreshData();
                }
              }}
            />
          </div>
        </div>
      )}

      {/* TAB 2: TIMETABLES */}
      {currentTab === 'timetable' && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-[#161F1A]">Faculty Timetables</h3>
          <TimetableGrid
            classes={filteredClasses}
            role="supervisor"
            currentTutorId={selectedTutorId}
            students={students}
            tutors={tutors}
            onCancelClass={async (classId, newStatus) => {
              await updateClass(classId, { status: newStatus });
              if (onRefreshData) {
                await onRefreshData();
              }
            }}
          />
        </div>
      )}

      {/* TAB 3: TUTOR ATTENDANCE & LATENESS */}
      {currentTab === 'supervisor_attendance' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#161F1A]">Tutor Punctuality & Attendance Audit</h3>
              <p className="text-xs text-[#5A6B61]">
                Record shifts, monitor login punctuality, and audit monthly attendance summaries across all tutors.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedAttendanceRecord(null);
                setIsAttendanceModalOpen(true);
              }}
              className="px-4 py-2 bg-[#2D8B5C] text-white text-xs font-bold rounded-lg hover:bg-[#1E5C3D] flex items-center space-x-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record Tutor Attendance</span>
            </button>
          </div>

          {/* Monthly Attendance Summary per Tutor (Item 13) */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#161F1A] uppercase tracking-wider">
              Faculty Monthly Attendance Summaries
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {tutors.map(t => {
                const s = tutorSummaryMap[t.tutorId] || { total: 0, present: 0, absent: 0, late: 0, excused: 0 };
                return (
                  <div key={t.id} className="bg-white p-4 rounded-xl border border-[#E3DFD7] shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-bold text-[#2D8B5C]">{t.tutorId}</span>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.availabilityStatus === 'Available' ? 'bg-[#25D366] animate-pulse' : 'bg-amber-500'}`} title={t.availabilityStatus || 'Busy'} />
                      </div>
                      <span className="text-[10px] text-[#5A6B61] font-bold">{t.realName}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-center pt-1 border-t border-[#EAE6DE]">
                      <div className="bg-[#FAF9F7] p-1.5 rounded">
                        <span className="text-[10px] text-[#5A6B61] block">Total</span>
                        <strong className="text-xs text-[#161F1A]">{s.total}</strong>
                      </div>
                      <div className="bg-emerald-50 p-1.5 rounded">
                        <span className="text-[10px] text-emerald-800 block">Pres.</span>
                        <strong className="text-xs text-emerald-800">{s.present}</strong>
                      </div>
                      <div className="bg-amber-50 p-1.5 rounded">
                        <span className="text-[10px] text-amber-800 block">Late</span>
                        <strong className="text-xs text-amber-800">{s.late}</strong>
                      </div>
                      <div className="bg-red-50 p-1.5 rounded">
                        <span className="text-[10px] text-red-800 block">Abs.</span>
                        <strong className="text-xs text-red-800">{s.absent}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Audit Table */}
          <div className="bg-white border border-[#E3DFD7] rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F7] border-b border-[#E3DFD7] text-[#5A6B61] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Tutor ID</th>
                  <th className="py-3 px-4">Faculty Name</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Time In (PKT)</th>
                  <th className="py-3 px-4">Time Out</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Lateness</th>
                  <th className="py-3 px-4">Marked By</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE6DE]">
                {tutorAttendance.map(ta => (
                  <tr key={ta.id} className="hover:bg-[#FAF9F7]/60">
                    <td className="py-3 px-4 font-bold text-[#2D8B5C]">{ta.tutorId}</td>
                    <td className="py-3 px-4 font-semibold text-[#161F1A]">{ta.tutorName}</td>
                    <td className="py-3 px-4">{ta.date}</td>
                    <td className="py-3 px-4 font-mono">{ta.timeIn || ta.loginTime || '—'}</td>
                    <td className="py-3 px-4 font-mono">{ta.timeOut || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ta.status === 'Present' || ta.status === 'On Time'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ta.status === 'Late'
                          ? 'bg-amber-100 text-amber-800'
                          : ta.status === 'Absent'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {ta.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#5A6B61]">
                      {ta.lateDurationMinutes && ta.lateDurationMinutes > 0 ? `${ta.lateDurationMinutes} mins` : '0 min'}
                    </td>
                    <td className="py-3 px-4 text-[#5A6B61] text-[11px]">{ta.markedBy || 'System'}</td>
                    <td className="py-3 px-4 text-[#5A6B61]">{ta.notes || '—'}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedAttendanceRecord(ta);
                          setIsAttendanceModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: LESSONS QUALITY REVIEW & SAFETY DIRECTORY */}
      {currentTab === 'lessons' && (
        <div className="space-y-4">
          {/* Header Card */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs">
            <div>
              <div className="flex items-center space-x-2.5">
                <h3 className="text-base sm:text-lg font-bold text-[#161F1A]">
                  Supervisor Academic & Safety Directory
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-[#1E5C3D] border border-emerald-200">
                  Full Authority
                </span>
              </div>
              <p className="text-xs text-[#5A6B61] mt-0.5">
                Audit student lessons, inspect & edit uploaded screenshot materials, and verify safety & security across all academies ({filteredLessons.length} reports).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* View Layout Toggle */}
              <div className="inline-flex bg-gray-100 p-1 rounded-lg border border-[#E3DFD7]">
                <button
                  type="button"
                  onClick={() => setSupervisorLessonsViewMode('spreadsheet')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    supervisorLessonsViewMode === 'spreadsheet'
                      ? 'bg-[#2D8B5C] text-white shadow-2xs'
                      : 'text-[#5A6B61] hover:text-[#161F1A]'
                  }`}
                >
                  📊 Spreadsheet Ledger
                </button>
                <button
                  type="button"
                  onClick={() => setSupervisorLessonsViewMode('cards')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    supervisorLessonsViewMode === 'cards'
                      ? 'bg-[#2D8B5C] text-white shadow-2xs'
                      : 'text-[#5A6B61] hover:text-[#161F1A]'
                  }`}
                >
                  📋 Quality Cards
                </button>
              </div>

              {/* Action: Record Lesson */}
              <button
                type="button"
                onClick={() => setIsNewLessonModalOpen(true)}
                className="px-3.5 py-1.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Record Lesson</span>
              </button>

              {/* Action: Export CSV */}
              <button
                type="button"
                onClick={() => {
                  if (filteredLessons.length === 0) {
                    alert("No completed lessons match your selected filter range to export.");
                    return;
                  }
                  exportLessonsToCSV(
                    'Supervisor Academic Lessons Audit',
                    filteredLessons,
                    `Filter (${supervisorTimeMode.toUpperCase()})`
                  );
                }}
                className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Filtering Control Panel */}
          <div className="bg-[#FAF9F7] p-4 rounded-xl border border-[#E3DFD7] space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Search input across all academies */}
              <div className="flex items-center space-x-2 bg-white border border-[#D5D0C6] px-3 py-1.5 rounded-lg w-full sm:w-64">
                <Search className="w-4 h-4 text-[#5A6B61]" />
                <input
                  type="text"
                  placeholder="Search student, tutor, lesson..."
                  value={supervisorSearchQuery}
                  onChange={(e) => setSupervisorSearchQuery(e.target.value)}
                  className="bg-transparent border-none text-xs focus:outline-none w-full"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Tutor Filter */}
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-[#161F1A]">Tutor:</span>
                  <select
                    value={selectedTutorId}
                    onChange={(e) => setSelectedTutorId(e.target.value)}
                    className="text-xs border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white font-medium focus:ring-1 focus:ring-[#2D8B5C] outline-none"
                  >
                    <option value="all">All Tutors ({tutors.length})</option>
                    {tutors.map(t => (
                      <option key={t.tutorId} value={t.tutorId}>{t.name} ({t.tutorId})</option>
                    ))}
                  </select>
                </div>

                {/* Student Filter */}
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-[#161F1A]">Student:</span>
                  <select
                    value={supervisorStudentId}
                    onChange={(e) => setSupervisorStudentId(e.target.value)}
                    className="text-xs border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white font-medium focus:ring-1 focus:ring-[#2D8B5C] outline-none"
                  >
                    <option value="all">All Students ({sanitizedStudents.length})</option>
                    {sanitizedStudents.map(s => (
                      <option key={s.studentId} value={s.studentId}>{s.name} ({s.studentId})</option>
                    ))}
                  </select>
                </div>

                {/* Safety Filter */}
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-[#161F1A]">Safety:</span>
                  <select
                    value={supervisorSafetyFilter}
                    onChange={(e) => setSupervisorSafetyFilter(e.target.value as any)}
                    className="text-xs border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white font-semibold focus:ring-1 focus:ring-[#2D8B5C] outline-none"
                  >
                    <option value="all">All Safety States</option>
                    <option value="audited">🛡️ Audited & Safe</option>
                    <option value="flagged">🚩 Flagged for Review</option>
                    <option value="pending">⚠️ Pending Audit</option>
                  </select>
                </div>

                {/* Time Mode Pills */}
                <div className="flex items-center space-x-1 bg-white p-1 rounded-lg border border-[#E3DFD7]">
                  {(['all', 'weekly', 'monthly', 'custom'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSupervisorTimeMode(mode)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                        supervisorTimeMode === mode
                          ? 'bg-[#2D8B5C] text-white shadow-xs'
                          : 'text-[#5A6B61] hover:text-[#161F1A] hover:bg-gray-100'
                      }`}
                    >
                      {mode === 'monthly' ? 'Monthly (31d)' : mode === 'weekly' ? 'Weekly (7d)' : mode === 'custom' ? 'Custom' : 'All Time'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Date Inputs if mode === 'custom' */}
            {supervisorTimeMode === 'custom' && (
              <div className="flex items-center space-x-3 pt-2 border-t border-[#E3DFD7]">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-[#5A6B61] font-bold">From:</span>
                  <input
                    type="date"
                    value={supervisorStartDate}
                    onChange={(e) => setSupervisorStartDate(e.target.value)}
                    className="border border-[#D5D0C6] rounded-lg px-2 py-1 text-xs bg-white font-mono outline-none"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-[#5A6B61] font-bold">To:</span>
                  <input
                    type="date"
                    value={supervisorEndDate}
                    onChange={(e) => setSupervisorEndDate(e.target.value)}
                    className="border border-[#D5D0C6] rounded-lg px-2 py-1 text-xs bg-white font-mono outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SPREADSHEET LEDGER MODE */}
          {supervisorLessonsViewMode === 'spreadsheet' && (
            <div className="bg-white rounded-xl border border-[#E3DFD7] shadow-xs overflow-hidden">
              <div className="px-5 py-3 border-b border-[#E3DFD7] bg-[#FAF9F7] flex items-center justify-between">
                <span className="text-xs font-bold text-[#161F1A]">
                  Supervisor Academic Ledger ({filteredLessons.length} records)
                </span>
                <span className="text-[11px] text-[#5A6B61]">
                  Click Edit to modify lesson content, or Material to inspect screenshots
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-[#FAF9F7] text-[#5A6B61] border-b border-[#E3DFD7] uppercase tracking-wider text-[10px] font-bold">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">Tutor</th>
                      <th className="py-2.5 px-3">Course</th>
                      <th className="py-2.5 px-3">Portion Recited</th>
                      <th className="py-2.5 px-3">Page</th>
                      <th className="py-2.5 px-3">Memorization</th>
                      <th className="py-2.5 px-3">Adaab</th>
                      <th className="py-2.5 px-3 text-center">Material / Screenshots</th>
                      <th className="py-2.5 px-3 text-center">Safety Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3DFD7]">
                    {filteredLessons.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="py-8 text-center text-xs text-[#5A6B61] italic">
                          No matching lesson records found. Today's lessons will appear here immediately once submitted.
                        </td>
                      </tr>
                    ) : (
                      filteredLessons.map((l, idx) => {
                        const scrCount = l.screenshots?.length || 0;
                        const isSafe = l.safetyStatus === 'Audited' || l.safetyStatus === 'Safe';
                        return (
                          <tr key={l.id} className="hover:bg-[#FAF9F7]/70 transition-colors">
                            <td className="py-2 px-3 text-[11px] text-[#5A6B61] font-mono">{idx + 1}</td>
                            <td className="py-2 px-3 text-[11px] font-bold text-[#161F1A] font-mono">{l.date}</td>
                            <td className="py-2 px-3">
                              <span className="font-bold text-[#161F1A] block">{l.studentName}</span>
                              <span className="text-[10px] text-[#5A6B61] font-mono">{l.studentId}</span>
                            </td>
                            <td className="py-2 px-3 text-[11px] font-semibold text-[#161F1A]">{l.tutorId}</td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-[#1E5C3D] border border-emerald-100">
                                {l.lessonType}
                              </span>
                            </td>
                            <td className="py-2 px-3 max-w-[180px] truncate text-[11px] font-medium text-[#161F1A]" title={l.lessonCovered}>
                              {l.lessonCovered || '—'}
                            </td>
                            <td className="py-2 px-3 text-[11px] font-mono text-[#1E5C3D] font-bold">
                              {l.mushafPage || l.quranDetails?.mushafPage || '—'}
                            </td>
                            <td className="py-2 px-3 max-w-[120px] truncate text-[11px] text-[#B87314]" title={l.memorization}>
                              {l.memorization || '—'}
                            </td>
                            <td className="py-2 px-3 max-w-[120px] truncate text-[11px] text-[#2D8B5C]" title={l.adaabManners}>
                              {l.adaabManners || '—'}
                            </td>

                            {/* Screenshots / Material Cell */}
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedMaterialLesson(l);
                                  setIsMaterialModalOpen(true);
                                }}
                                className={`px-2 py-1 rounded text-[10px] font-bold flex items-center justify-center space-x-1 mx-auto cursor-pointer transition-colors ${
                                  scrCount > 0
                                    ? 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                                title="Inspect or replace lesson screenshots & materials"
                              >
                                <FileImage className="w-3.5 h-3.5" />
                                <span>{scrCount} {scrCount === 1 ? 'Page' : 'Pages'}</span>
                              </button>
                            </td>

                            {/* Safety Cell */}
                            <td className="py-2 px-3 text-center">
                              <div className="inline-flex items-center space-x-1">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center space-x-1 ${
                                  isSafe
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : l.safetyStatus === 'Flagged'
                                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}>
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>{l.safetyStatus || 'Audited'}</span>
                                </span>
                              </div>
                            </td>

                            {/* Actions Cell */}
                            <td className="py-2 px-3 text-right">
                              <div className="flex items-center justify-end space-x-1">

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedEditLesson(l);
                                    setIsEditModalOpen(true);
                                  }}
                                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-[#161F1A] rounded text-[11px] font-bold cursor-pointer"
                                  title="Edit full lesson details"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedMaterialLesson(l);
                                    setIsMaterialModalOpen(true);
                                  }}
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#1E5C3D] rounded text-[11px] font-bold cursor-pointer"
                                  title="Manage / Replace Screenshots"
                                >
                                  Material
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLesson(l.id)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                  title="Delete lesson record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* QUALITY & SAFETY CARDS MODE */}
          {supervisorLessonsViewMode === 'cards' && (
            <div className="space-y-3">
              {filteredLessons.length === 0 ? (
                <div className="bg-white p-8 rounded-xl border border-[#E3DFD7] text-center text-xs text-[#5A6B61] italic">
                  No matching lesson reports found for the selected tutor, student, or timeframe filter.
                </div>
              ) : (
                filteredLessons.map(lesson => {
                  const status = lesson.attendanceStatus || 'Present';
                  const isSafe = lesson.safetyStatus === 'Audited' || lesson.safetyStatus === 'Safe';
                  return (
                    <div key={lesson.id} className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs space-y-3 hover:border-[#B5AFA4] transition-colors">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-bold text-[#161F1A]">
                              {lesson.studentName} <span className="text-xs text-[#5A6B61] font-mono">({lesson.studentId})</span>
                            </h4>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-[#1E5C3D] border border-emerald-100">
                              {lesson.lessonType}
                            </span>
                            {/* Safety Badge */}
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center space-x-1 ${
                              isSafe
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : lesson.safetyStatus === 'Flagged'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                              <ShieldCheck className="w-3 h-3" />
                              <span>{lesson.safetyStatus || 'Audited'}</span>
                            </span>
                          </div>
                          <p className="text-[11px] text-[#5A6B61] mt-0.5">
                            Tutor: <strong className="text-[#161F1A]">{lesson.tutorId}</strong> • Date: <strong className="text-[#161F1A]">{lesson.date}</strong>
                          </p>
                        </div>

                        {/* Top Right Controls: Attendance Badge + Action Buttons */}
                        <div className="flex items-center space-x-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center space-x-1 ${
                            status === 'Present' ? 'bg-emerald-50 text-emerald-900 border-emerald-300' :
                            status === 'Late' ? 'bg-amber-50 text-amber-900 border-amber-300' :
                            status === 'Absent' ? 'bg-rose-50 text-rose-900 border-rose-300' :
                            'bg-sky-50 text-sky-900 border-sky-300'
                          }`}>
                            <span className={`w-2 h-2 rounded-full ${
                              status === 'Present' ? 'bg-emerald-600' :
                              status === 'Late' ? 'bg-amber-600' :
                              status === 'Absent' ? 'bg-rose-600' : 'bg-sky-600'
                            }`} />
                            <span>{status}</span>
                          </span>


                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEditLesson(lesson);
                              setIsEditModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-xs font-bold rounded-lg text-[#161F1A] cursor-pointer"
                            title="Edit full lesson content"
                          >
                            Edit Lesson
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMaterialLesson(lesson);
                              setIsMaterialModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#1E5C3D] text-xs font-bold rounded-lg cursor-pointer"
                            title="Inspect / Edit / Replace Screenshots"
                          >
                            Edit Material
                          </button>

                          <button
                            type="button"
                            onClick={() => generateLessonReportPDF(lesson)}
                            className="p-1 text-[#5A6B61] hover:text-[#161F1A] cursor-pointer"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteLesson(lesson.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                            title="Delete lesson"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {status === 'Absent' ? (
                        <div className="bg-rose-50/70 p-3 rounded-lg border border-rose-200 text-xs text-rose-800">
                          <strong>Student Absent:</strong> {lesson.absentReason || 'No lesson conducted due to student absence.'}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-[#FAF9F7] p-3 rounded-lg border border-[#E3DFD7]">
                          <div>
                            <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Portion Recited</span>
                            <p className="font-semibold text-[#161F1A] mt-0.5">{lesson.lessonCovered || '—'}</p>
                            {(lesson.mushafPage || lesson.quranDetails?.mushafPage) && (
                              <span className="inline-block mt-1 text-[10px] font-bold bg-[#E8F5EE] text-[#1E5C3D] px-2 py-0.5 rounded">
                                Mushaf Page: {lesson.mushafPage || lesson.quranDetails?.mushafPage}
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Memorization</span>
                            <p className="font-semibold text-[#B87314] mt-0.5">{lesson.memorization || '—'}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Adaab & Manners</span>
                            <p className="font-semibold text-[#2D8B5C] mt-0.5">{lesson.adaabManners || '—'}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Revision</span>
                            <p className="font-semibold text-[#161F1A] mt-0.5">{lesson.revision || 'None'}</p>
                          </div>
                        </div>
                      )}

                      {/* Safety & Security Observation Banner */}
                      <div className="bg-[#FAF9F7] px-3 py-2 rounded-lg border border-[#E3DFD7] flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center space-x-2">
                          <ShieldCheck className={`w-4 h-4 ${isSafe ? 'text-emerald-600' : 'text-amber-600'}`} />
                          <span className="font-bold text-[#161F1A]">Safety & Security:</span>
                          <span className="text-[#5A6B61]">{lesson.safetyNotes || 'Safe audio/video environment confirmed. Child protection standards met.'}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] text-[#5A6B61]">{lesson.auditedBy ? `Audited by: ${lesson.auditedBy}` : 'Audited: Academic Supervisor'}</span>
                          {!isSafe && (
                            <button
                              type="button"
                              onClick={() => handleQuickSafetyAudit(lesson, 'Audited')}
                              className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[10px] font-bold cursor-pointer"
                            >
                              Mark Safe & Audited
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Screenshots Gallery for Supervisor Quality Control & Safety Auditing */}
                      <div className="space-y-1.5 pt-1.5 border-t border-dashed border-[#E3DFD7]">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">
                            Uploaded Lesson Pages / Screenshots ({lesson.screenshots?.length || 0}):
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMaterialLesson(lesson);
                              setIsMaterialModalOpen(true);
                            }}
                            className="text-[11px] font-bold text-[#2D8B5C] hover:underline flex items-center space-x-1 cursor-pointer"
                          >
                            <FileImage className="w-3.5 h-3.5" />
                            <span>Manage / Replace Screenshots</span>
                          </button>
                        </div>

                        {lesson.screenshots && lesson.screenshots.length > 0 ? (
                          <div className="flex flex-wrap gap-2.5">
                            {lesson.screenshots.map((scr, idx) => (
                              scr.expired || !scr.url ? (
                                <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 flex items-center space-x-1.5 text-gray-400 text-[10px] min-h-[36px]">
                                  <Clock className="w-3.5 h-3.5 text-gray-300" />
                                  <span className="font-medium text-[9px] text-gray-500">Image Expired (31d limit)</span>
                                </div>
                              ) : (
                                <div
                                  key={idx}
                                  onClick={() => setActivePreviewImage(scr.url)}
                                  className="relative group rounded-lg overflow-hidden border border-[#D5D0C6] hover:border-[#2D8B5C] bg-[#FAF9F7] w-20 h-14 cursor-zoom-in transition-all shadow-xs"
                                >
                                  <img
                                    src={scr.url}
                                    alt={scr.name}
                                    referrerPolicy="no-referrer"
                                    className="object-cover w-full h-full group-hover:scale-105 transition-transform"
                                  />
                                  <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                                </div>
                              )
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-[#5A6B61] italic">
                            No screenshots uploaded by tutor. You can attach clear Mushaf or Qaida scans via "Edit Material".
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB: ANNOUNCEMENTS */}
      {currentTab === 'announcements' && (
        <AnnouncementsList announcements={announcements} />
      )}

      {/* Tutor Attendance Modal */}
      <TutorAttendanceModal
        isOpen={isAttendanceModalOpen}
        onClose={() => {
          setIsAttendanceModalOpen(false);
          setSelectedAttendanceRecord(null);
        }}
        onSave={handleSaveAttendance}
        initialRecord={selectedAttendanceRecord}
        tutors={tutors}
        defaultMarkedBy="Academic Supervisor"
      />

      {/* Floating Modern Notification Tray for Supervisor Tracking */}
      {groupedSupervisorAssignments.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full space-y-2.5 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto">
          <div className="bg-[#1E5C3D] text-white px-4 py-3 rounded-2xl shadow-xl border border-emerald-600 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 text-emerald-200 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                  Academy Class Feed
                </h4>
                <p className="text-[11px] text-emerald-200">
                  {groupedSupervisorAssignments.length} student schedules to track
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSupervisorAcknowledgeAll}
              className="text-[11px] font-bold bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg text-white transition-colors cursor-pointer"
            >
              Dismiss All
            </button>
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {groupedSupervisorAssignments.map((ga) => (
              <div
                key={ga.groupKey}
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
                    <p className="text-[10px] font-semibold text-emerald-800">
                      Tutor: {ga.tutorName}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSupervisorAcknowledgeGroup(ga.classIds)}
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

      {/* Lesson Material & Screenshot Edit Modal for Supervisor */}
      <LessonMaterialEditModal
        isOpen={isMaterialModalOpen}
        onClose={() => {
          setIsMaterialModalOpen(false);
          setSelectedMaterialLesson(null);
        }}
        lesson={selectedMaterialLesson}
        userRole="supervisor"
        userName="Academic Supervisor"
        onRefreshData={onRefreshData}
        onPreviewImage={(url) => setActivePreviewImage(url)}
      />

      {/* Lesson Full Edit Modal for Supervisor */}
      <LessonEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedEditLesson(null);
        }}
        lesson={selectedEditLesson}
        userRole="supervisor"
        userName="Academic Supervisor"
        onRefreshData={onRefreshData}
        onOpenMaterialModal={(lesson) => {
          setSelectedMaterialLesson(lesson);
          setIsMaterialModalOpen(true);
        }}
      />

      {/* Record New Lesson Modal for Supervisor */}
      <LessonModal
        isOpen={isNewLessonModalOpen}
        onClose={() => setIsNewLessonModalOpen(false)}
        onSave={handleSaveNewLesson}
        students={students}
      />

      {/* Supervisor Safety Audit Lightbox */}
      {activePreviewImage && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in cursor-zoom-out" onClick={() => setActivePreviewImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center justify-center bg-black/40 p-2 rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <img src={activePreviewImage} alt="Supervisor Audit" referrerPolicy="no-referrer" className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" />
            
            <div className="mt-3 flex items-center space-x-3 bg-white/95 p-2 rounded-xl shadow-lg border border-[#E3DFD7]">
              <a
                href={activePreviewImage}
                download="supervisor-audit-screenshot.png"
                className="px-3.5 py-1.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-bold rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save to Audit Log</span>
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
    </div>
  );
};
