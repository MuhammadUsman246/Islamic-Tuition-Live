import React, { useState, useMemo } from 'react';
import {
  Users,
  Video,
  Calendar,
  BookOpen,
  CheckSquare,
  DollarSign,
  Download,
  ExternalLink,
  Sparkles,
  AlertCircle,
  CheckCircle,
  CreditCard,
  Layers,
  FileText,
  FileSpreadsheet,
  Table as TableIcon,
  LayoutGrid,
  Clock,
  Bell,
  GraduationCap,
  Receipt,
  Send
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
import { exportLessonsToCSV } from '../../utils/csvExporter';
import { getCurrencySymbol } from '../../utils/currency';
import { updateFee } from '../../services/dataService';

interface ParentDashboardProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  linkedStudentIds: string[];
  students: Student[];
  tutors: Tutor[];
  classes: TimetableClass[];
  lessons: Lesson[];
  attendance: AttendanceRecord[];
  fees: StudentFee[];
  announcements: Announcement[];
  onRefreshData?: () => Promise<void>;
}

export const ParentDashboard: React.FC<ParentDashboardProps> = ({
  currentTab,
  setCurrentTab,
  linkedStudentIds,
  students,
  tutors,
  classes,
  lessons,
  attendance,
  fees,
  announcements,
  onRefreshData
}) => {
  const { userProfile, adminViewingRole, adminViewingTargetId, setAdminViewingRole } = useAuth();
  const [feeTypeFilter, setFeeTypeFilter] = useState<'all' | 'combined' | 'individual'>('all');
  const [payingFeeId, setPayingFeeId] = useState<string | null>(null);
  const [viewingReceiptFee, setViewingReceiptFee] = useState<StudentFee | null>(null);
  const [paymentNoticeFee, setPaymentNoticeFee] = useState<StudentFee | null>(null);
  const [lessonViewMode, setLessonViewMode] = useState<'sheet' | 'cards'>('sheet');
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);
  const [selectedLessonForDetail, setSelectedLessonForDetail] = useState<Lesson | null>(null);
  const [selectedStudentForSheet, setSelectedStudentForSheet] = useState<Student | null>(null);
  const [startDateReport, setStartDateReport] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDateReport, setEndDateReport] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [reportViewMode, setReportViewMode] = useState<'monthly' | 'weekly' | 'all'>('monthly');
  const [expandedMonths, setExpandedMonths] = useState<{ [key: string]: boolean }>({});
  const [expandedWeeks, setExpandedWeeks] = useState<{ [key: string]: boolean }>({});

  const parentEmailNorm = userProfile?.email?.toLowerCase().trim() || '';
  const parentUid = userProfile?.uid || '';

  // Determine if this parent is ALSO registered as an enrolled student in the academy
  const selfStudentProfile = useMemo(() => {
    if (!parentEmailNorm) return null;
    return students.find(s => s.email && s.email.toLowerCase().trim() === parentEmailNorm) || null;
  }, [students, parentEmailNorm]);

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

  // STRICT PRIVACY: Only include students legitimately linked to this parent account (and self if enrolled)
  const myChildren = useMemo(() => {
    // If admin is inspecting with a specific target child ID
    if (adminViewingRole && adminViewingTargetId) {
      const targetMatches = students.filter(s => s.studentId === adminViewingTargetId || s.parentId === adminViewingTargetId);
      if (targetMatches.length > 0) return targetMatches;
    }

    const explicitLinked = new Set(
      (linkedStudentIds && linkedStudentIds.length > 0)
        ? linkedStudentIds
        : (userProfile?.linkedStudentIds || [])
    );

    return students.filter(s => {
      // 1. Direct ID match from linked array
      if (explicitLinked.size > 0 && explicitLinked.has(s.studentId)) return true;
      // 2. Direct parent UID link
      if (parentUid && s.parentId && s.parentId === parentUid) return true;
      // 3. Direct parent Email link
      if (parentEmailNorm && s.parentEmail && s.parentEmail.toLowerCase().trim() === parentEmailNorm) return true;
      // 4. Parent is ALSO an enrolled adult student herself/himself
      if (parentEmailNorm && s.email && s.email.toLowerCase().trim() === parentEmailNorm) return true;
      return false;
    });
  }, [students, linkedStudentIds, userProfile, adminViewingRole, adminViewingTargetId, parentEmailNorm, parentUid]);

  const [selectedChildId, setSelectedChildId] = useState<string>(
    myChildren[0]?.studentId || ''
  );

  const activeChild = myChildren.find(c => c.studentId === selectedChildId) || myChildren[0] || null;
  const activeTutor = tutors.find(t => t.tutorId === activeChild?.assignedTutorId) || null;

  const childClasses = activeChild ? classes.filter(c => c.studentId === activeChild.studentId) : [];
  const childLessons = activeChild ? lessons.filter(l => l.studentId === activeChild.studentId) : [];
  const childAttendance = activeChild ? attendance.filter(a => a.studentId === activeChild.studentId) : [];

  const childLessonsByMonth = useMemo(() => {
    const grouped: { [key: string]: Lesson[] } = {};
    childLessons.forEach(lesson => {
      const monthKey = lesson.month || 'Other / Uncategorized';
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(lesson);
    });
    return grouped;
  }, [childLessons]);

  const childLessonsByWeek = useMemo(() => {
    const grouped: { [key: string]: Lesson[] } = {};
    childLessons.forEach(lesson => {
      const weekKey = `Week of ${getMonday(lesson.date)}`;
      if (!grouped[weekKey]) {
        grouped[weekKey] = [];
      }
      grouped[weekKey].push(lesson);
    });
    return grouped;
  }, [childLessons]);

  // STRICT INVOICE ISOLATION: A Parent must ONLY see fees and invoices belonging to their connected children
  const familyFees = useMemo(() => {
    if (myChildren.length === 0) return [];
    const myChildIds = new Set(myChildren.map(c => c.studentId));
    const myFamilyIds = new Set(myChildren.map(c => c.familyGroupId).filter(Boolean));
    const myFamilyNames = new Set(myChildren.map(c => c.familyGroupName?.toLowerCase().trim()).filter(Boolean));

    return fees.filter(f => {
      // 1. Direct student ID match
      if (myChildIds.has(f.studentId)) return true;
      // 2. Family combined invoice where any child is included in studentIds
      if (f.studentIds && f.studentIds.some(sid => myChildIds.has(sid))) return true;
      // 3. Family group ID match
      if (f.familyGroupId && myFamilyIds.has(f.familyGroupId)) return true;
      // 4. Family group name match
      if (f.familyGroupName && myFamilyNames.has(f.familyGroupName.toLowerCase().trim())) return true;
      return false;
    });
  }, [fees, myChildren]);

  const combinedFees = useMemo(() => familyFees.filter(f => f.isFamilyInvoice), [familyFees]);
  const individualFees = useMemo(() => familyFees.filter(f => !f.isFamilyInvoice), [familyFees]);

  const displayedFees = useMemo(() => {
    if (feeTypeFilter === 'combined') return combinedFees;
    if (feeTypeFilter === 'individual') return individualFees;
    return familyFees;
  }, [feeTypeFilter, familyFees, combinedFees, individualFees]);

  const handleSettlePayment = async (fee: StudentFee) => {
    setPayingFeeId(fee.id);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      await updateFee(fee.id, {
        status: 'Paid',
        paymentDate: todayStr,
        paymentMethod: 'Parent Online Portal (Settled)'
      });
      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err: any) {
      alert('Failed to settle invoice: ' + err.message);
    } finally {
      setPayingFeeId(null);
    }
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* Top Banner with Children Switcher */}
      <div className="bg-[#1E5C3D] text-white p-6 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#E8A93E] text-white text-[10px] font-bold uppercase tracking-wider">
              Parent Guardian Portal
            </span>
            <span className="text-xs text-[#b8dbca]">Managing {myChildren.length} Enrolled Children</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">Family Academic Dashboard</h2>
          <p className="text-xs text-[#d2e8dd]">
            Review class schedules, track recitation progress, and manage tuition accounts.
          </p>
        </div>

        {/* Child & Self Selector Pill Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {selfStudentProfile && (
            <button
              type="button"
              onClick={() => setAdminViewingRole('student', selfStudentProfile.studentId)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#E8A93E] hover:bg-[#C98A1E] text-white transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
              title="Open full Student Portal for your personal Quran lessons"
            >
              <GraduationCap className="w-4 h-4 text-white" />
              <span>Switch to Student Dashboard</span>
            </button>
          )}

          <div className="flex flex-wrap items-center bg-[#14231b] p-1.5 rounded-xl border border-[#263e32] gap-1">
            <span className="text-xs text-[#9cb4a6] font-medium px-2">Learner:</span>
            {myChildren.map(child => {
              const isSelected = child.studentId === selectedChildId;
              const isSelf = parentEmailNorm && child.email && child.email.toLowerCase().trim() === parentEmailNorm;
              return (
                <button
                  key={child.studentId}
                  onClick={() => setSelectedChildId(child.studentId)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                    isSelected
                      ? 'bg-[#2D8B5C] text-white shadow-xs'
                      : 'text-[#9cb4a6] hover:text-white'
                  }`}
                >
                  <span>{isSelf ? `Myself (${child.name})` : child.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${isSelected ? 'bg-black/25 text-emerald-100' : 'text-gray-400'}`}>
                    {isSelf ? 'Self' : child.studentId}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Child Summary Card */}
      {activeChild && (
        <div className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-[#2D8B5C]/15 border border-[#2D8B5C]/30 flex items-center justify-center font-bold text-base text-[#1E5C3D]">
              {activeChild.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-[#161F1A]">{activeChild.name}</h3>
                <span className="text-xs font-mono text-[#5A6B61]">({activeChild.studentId})</span>
                {activeChild.status === 'Trial' ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF9ED] text-[#8C5D08] border border-[#E8A93E]/40 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Trial ({activeChild.trialSessionsCompleted || 0}/5)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                    {activeChild.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#5A6B61] mt-0.5">
                Course: <strong>{activeChild.courseType}</strong> • Tutor: <strong>{activeTutor?.tutorId} ({activeTutor?.realName})</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={activeTutor?.zoomLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors shadow-xs"
            >
            <Video className="w-4 h-4" />
            <span>Launch {activeChild.name}'s Zoom Class</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    )}



      {/* TAB 1: SCHEDULE */}
      {(currentTab === 'parent_schedule' || currentTab === 'parent_children') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#161F1A]">
                Class Schedule for {activeChild?.name}
              </h3>
              <p className="text-xs text-[#5A6B61]">
                Calibrated in local time (<strong className="font-mono text-[#2D8B5C]" title={activeChild?.timezone}>{getTimezoneShortCode(activeChild?.timezone)}</strong>).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {childClasses.map((cls) => {
              const conv = convertPKTToStudentTime(cls.dayOfWeek, cls.startTimePKT, activeChild?.timezone || 'America/New_York');
              return (
                <div key={cls.id} className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#2D8B5C]">
                        {conv.localDay}
                      </span>
                      <h4 className="text-base font-bold text-[#161F1A] mt-0.5">
                        {conv.localTime} <span className="text-xs font-normal text-[#5A6B61]">local</span>
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                      {cls.durationMinutes} min
                    </span>
                  </div>

                  <div className="p-3 bg-[#FAF9F7] rounded-lg border border-[#E3DFD7] text-xs space-y-1">
                    <p className="text-[#5A6B61]">
                      Assigned Tutor: <strong className="text-[#2D8B5C]">{cls.tutorId}</strong>
                    </p>
                    <p className="text-[#5A6B61]">
                      Weekly Class: <span className="font-medium text-[#161F1A]">{conv.localDay}s at {conv.localTime}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: LESSONS & PROGRESS */}
      {currentTab === 'parent_lessons' && (
        <div className="space-y-5">
          {/* Custom Date Range Combined Report Downloader for Parents */}
          <div className="bg-white p-4 rounded-xl border border-[#E3DFD7] shadow-xs space-y-3">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-[#E8F5EE] rounded-lg text-[#1E5C3D]">
                <Calendar className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-[#161F1A]">Download Combined Progress Report</h4>
                <p className="text-[10px] text-[#5A6B61]">Select a custom date range to compile all lesson progress for {activeChild?.name} into a single consolidated PDF report.</p>
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
                    if (!activeChild) return;
                    const filtered = childLessons.filter(l => l.date >= startDateReport && l.date <= endDateReport);
                    if (filtered.length === 0) {
                      alert("No completed lessons found within the selected date range.");
                      return;
                    }
                    generateStudentReportPDF(activeChild, filtered, `Report (${startDateReport} to ${endDateReport})`);
                  }}
                  className="flex-1 py-1.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-lg text-xs font-bold shadow-xs flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF Report</span>
                </button>
                <button
                  onClick={() => {
                    if (!activeChild) return;
                    const filtered = childLessons.filter(l => l.date >= startDateReport && l.date <= endDateReport);
                    if (filtered.length === 0) {
                      alert("No completed lessons found within the selected date range.");
                      return;
                    }
                    exportLessonsToCSV(
                      `${activeChild.name} Academic Lessons`,
                      filtered,
                      `Range (${startDateReport} to ${endDateReport})`,
                      { studentName: activeChild.name }
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

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E3DFD7] pb-3">
            <div>
              <h3 className="text-base font-bold text-[#161F1A]">
                Lesson Reports for {activeChild?.name}
              </h3>
              <p className="text-xs text-[#5A6B61]">
                Official daily progress, Quran recitation, Kalimas/Duas memorization, and Islamic manners.
              </p>
            </div>

            {/* View Formats Selector */}
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

          {/* Controls visible only during raw Day-by-Day view */}
          {reportViewMode === 'all' && childLessons.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#FAF9F7]/60 p-2.5 rounded-xl border border-[#E3DFD7]">
              <span className="text-xs font-semibold text-[#161F1A]">Adjust layout & download:</span>
              <div className="flex items-center space-x-2">
                {/* View Toggle */}
                <div className="bg-[#FAF9F7] p-0.5 rounded-lg border border-[#D5D0C6] flex items-center">
                  <button
                    type="button"
                    onClick={() => setLessonViewMode('sheet')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center space-x-1 cursor-pointer transition-colors ${
                      lessonViewMode === 'sheet'
                        ? 'bg-white text-[#1E5C3D] shadow-xs'
                        : 'text-[#5A6B61] hover:text-[#161F1A]'
                    }`}
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    <span>Sheet View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLessonViewMode('cards')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center space-x-1 cursor-pointer transition-colors ${
                      lessonViewMode === 'cards'
                        ? 'bg-white text-[#1E5C3D] shadow-xs'
                        : 'text-[#5A6B61] hover:text-[#161F1A]'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Cards</span>
                  </button>
                </div>

                {activeChild && (
                  <button
                    onClick={() => generateStudentReportPDF(activeChild, childLessons, 'Current Academic Month')}
                    className="px-3 py-1.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-lg text-xs font-bold shadow-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Monthly PDF</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Render layout structure */}
          {(() => {
            const renderLessonCard = (lesson: Lesson) => (
              <div
                key={lesson.id}
                onClick={() => setSelectedLessonForDetail(lesson)}
                className="bg-white p-5 rounded-xl border border-[#E3DFD7] hover:border-[#2D8B5C] cursor-pointer transition-all shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-bold text-[#161F1A]">{lesson.lessonType}</h4>
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
                    </div>
                    <p className="text-xs text-[#5A6B61]">Taught by {lesson.tutorId} on {lesson.date}</p>
                  </div>
                  <div className="flex items-center space-x-2">
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
                      <span>PDF Report</span>
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
                          Mushaf Page: {lesson.mushafPage || lesson.quranDetails?.mushafPage}
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

                {/* Screenshots Display support inside Parent Dashboard */}
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
              </div>
            );

            if (childLessons.length === 0) {
              return (
                <div className="bg-white p-8 rounded-xl border border-[#E3DFD7] text-center text-xs text-[#5A6B61]">
                  <BookOpen className="w-8 h-8 text-[#D5D0C6] mx-auto mb-2" />
                  <p className="font-semibold text-[#161F1A]">No lesson reports recorded yet for {activeChild?.name}.</p>
                  <p className="text-[11px] mt-1">Lesson entries by your assigned tutor will appear here in real-time.</p>
                </div>
              );
            }

            // Raw Chronological Day-by-Day Logs with Table/Card Selection
            if (reportViewMode === 'all') {
              return lessonViewMode === 'sheet' ? (
                /* GOOGLE SHEET STYLE MONTHLY TABLE */
                <div className="bg-white border border-[#E3DFD7] rounded-xl overflow-x-auto shadow-xs">
                  <table className="w-full text-left text-xs whitespace-nowrap min-w-[700px]">
                    <thead className="bg-[#FAF9F7] border-b border-[#E3DFD7] text-[#161F1A] font-bold">
                      <tr>
                        <th className="py-3 px-3.5 border-r border-[#E3DFD7]">Date</th>
                        <th className="py-3 px-3 border-r border-[#E3DFD7]">Subject / Course</th>
                        <th className="py-3 px-3 border-r border-[#E3DFD7] text-center">Page No.</th>
                        <th className="py-3 px-3.5 border-r border-[#E3DFD7]">Surah & Ayahs / Lesson</th>
                        <th className="py-3 px-3.5 border-r border-[#E3DFD7]">Memorization / Kalima</th>
                        <th className="py-3 px-3.5 border-r border-[#E3DFD7]">Adaab & Manners</th>
                        <th className="py-3 px-3.5 border-r border-[#E3DFD7]">Revision</th>
                        <th className="py-3 px-3.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAE6DE]">
                      {childLessons.map((lesson) => {
                        const isAbsent = lesson.attendanceStatus === 'Absent';
                        const isLate = lesson.attendanceStatus === 'Late';
                        const pageVal = lesson.quranDetails?.mushafPage || lesson.mushafPage || (lesson.qaidaDetails ? `Qaida P.${lesson.qaidaDetails.pageNumber}` : '-');

                        return (
                          <tr
                            key={lesson.id}
                            onClick={() => setSelectedLessonForDetail(lesson)}
                            className={`transition-colors cursor-pointer ${
                              isAbsent
                                ? 'bg-red-50/70 hover:bg-red-50'
                                : isLate
                                ? 'bg-amber-50/40 hover:bg-amber-50/60'
                                : 'hover:bg-[#FAF9F7]/80'
                            }`}
                          >
                            <td className="py-2.5 px-3.5 font-semibold text-[#161F1A] border-r border-[#EAE6DE]">
                              {lesson.date}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-[#2D8B5C] border-r border-[#EAE6DE]">
                              {lesson.lessonType}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-[#161F1A] border-r border-[#EAE6DE] bg-black/2">
                              {isAbsent ? '-' : pageVal}
                            </td>
                            <td className="py-2.5 px-3.5 font-medium text-[#161F1A] border-r border-[#EAE6DE] max-w-xs truncate">
                              {isAbsent ? (
                                <span className="text-red-700 italic font-semibold">
                                  {lesson.absentReason ? `Absent (${lesson.absentReason})` : 'Student Absent'}
                                </span>
                              ) : (
                                lesson.lessonCovered
                              )}
                            </td>
                            <td className="py-2.5 px-3.5 text-[#B87314] font-medium border-r border-[#EAE6DE]">
                              {isAbsent ? '-' : (lesson.memorization || '-')}
                            </td>
                            <td className="py-2.5 px-3.5 text-[#2D8B5C] font-medium border-r border-[#EAE6DE]">
                              {isAbsent ? '-' : (lesson.adaabManners || '-')}
                            </td>
                            <td className="py-2.5 px-3.5 text-[#5A6B61] border-r border-[#EAE6DE]">
                              {isAbsent ? '-' : (lesson.revision || '-')}
                            </td>
                            <td className="py-2.5 px-3.5 text-center">
                              {isAbsent ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                                  Absent
                                </span>
                              ) : isLate ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  Late ({lesson.lateMinutes || 10}m)
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Present
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-3">
                  {childLessons.map(renderLessonCard)}
                </div>
              );
            }

            // Weekly Summary layout for Parents
            if (reportViewMode === 'weekly') {
              return (
                <div className="space-y-4">
                  {Object.keys(childLessonsByWeek).map(weekKey => {
                    const lessonsInWeek = childLessonsByWeek[weekKey];
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



            // Default: Monthly Report layout for Parents
            return (
              <div className="space-y-4">
                {Object.keys(childLessonsByMonth).map(monthKey => {
                  const lessonsInMonth = childLessonsByMonth[monthKey];
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
      {currentTab === 'parent_attendance' && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-[#161F1A]">Attendance Audit for {activeChild?.name}</h3>
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
                {childAttendance.map(att => (
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
                    <td className="py-3 px-4 text-[#5A6B61]">{att.notes || 'Verified'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notice if no children are linked */}
      {myChildren.length === 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-3 text-xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-950">No Connected Children Found</h4>
            <p className="mt-0.5 text-amber-800">
              There are currently no active student profiles linked to this parent account. Please contact the Academy Administration to link your student records.
            </p>
          </div>
        </div>
      )}

      {/* TAB 4: FAMILY INVOICES */}
      {currentTab === 'parent_fees' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#161F1A]">Family Tuition Invoices & Statements</h3>
              <p className="text-xs text-[#5A6B61]">
                Consolidated family statements and individual tuition receipts for your children.
              </p>
            </div>

            {/* Filter Pills: All | Combined | Individual */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-[#E3DFD7] shadow-2xs space-x-1">
              <button
                onClick={() => setFeeTypeFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                  feeTypeFilter === 'all'
                    ? 'bg-[#161F1A] text-white'
                    : 'text-[#5A6B61] hover:bg-gray-100'
                }`}
              >
                <span>All Statements</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 text-inherit font-mono">
                  {familyFees.length}
                </span>
              </button>

              <button
                onClick={() => setFeeTypeFilter('combined')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                  feeTypeFilter === 'combined'
                    ? 'bg-[#1E5C3D] text-white'
                    : 'text-[#1E5C3D] hover:bg-emerald-50'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Combined Family ({combinedFees.length})</span>
              </button>

              <button
                onClick={() => setFeeTypeFilter('individual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                  feeTypeFilter === 'individual'
                    ? 'bg-[#161F1A] text-white'
                    : 'text-[#5A6B61] hover:bg-gray-100'
                }`}
              >
                <span>Individual ({individualFees.length})</span>
              </button>
            </div>
          </div>

          {displayedFees.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-[#E3DFD7] text-center text-gray-500 space-y-2">
              <DollarSign className="w-8 h-8 text-gray-400 mx-auto" />
              <p className="font-semibold text-[#161F1A]">No invoices found in this view</p>
              <p className="text-xs text-gray-500">
                {feeTypeFilter === 'combined'
                  ? 'There are currently no consolidated family statements issued. All child tuition is listed under individual statements.'
                  : 'There are currently no tuition fee invoices issued for your connected children.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedFees.map(fee => {
                const isPaid = fee.status === 'Paid';
                const isSubmitted = fee.status === 'Payment Submitted';
                const isOverdue = !isPaid && !isSubmitted && (fee.status === 'Overdue' || (fee.status === 'Pending' && fee.dueDate < new Date().toISOString().slice(0, 10)));
                const netAmount = Math.max(0, fee.amount - (fee.discount || 0));

                return (
                  <div
                    key={fee.id}
                    className={`bg-white rounded-xl border p-5 shadow-xs space-y-4 transition-all ${
                      fee.isFamilyInvoice
                        ? 'border-[#2D8B5C]/40 bg-gradient-to-br from-white via-white to-emerald-50/20'
                        : 'border-[#E3DFD7]'
                    } ${isOverdue && !isPaid ? 'border-l-4 border-l-rose-500' : ''}`}
                  >
                    {/* Header Row */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-xs text-[#2D8B5C] bg-[#2D8B5C]/10 px-2 py-0.5 rounded-md">
                            {fee.invoiceNumber}
                          </span>
                          {fee.isFamilyInvoice ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#1E5C3D] text-white flex items-center gap-1">
                              <Users className="w-3 h-3" /> Combined Family Invoice
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-700">
                              Single Student
                            </span>
                          )}
                          <span className="text-xs text-[#5A6B61]">• {fee.billingPeriod}</span>
                        </div>

                        <h4 className="font-bold text-[#161F1A] text-base">
                          {fee.isFamilyInvoice
                            ? (fee.familyGroupName || fee.studentName)
                            : fee.studentName}
                        </h4>
                        <p className="text-xs text-[#5A6B61]">
                          Due Date: <span className={`font-mono font-bold ${isOverdue && !isPaid ? 'text-rose-700' : 'text-[#161F1A]'}`}>{fee.dueDate}</span>
                          {isPaid && fee.paymentDate && (
                            <span className="ml-2 text-emerald-700 font-semibold">• Paid on {fee.paymentDate}</span>
                          )}
                        </p>
                      </div>

                      {/* Status Badge & Amount Summary */}
                      <div className="text-right space-y-1">
                        <div className="flex items-center justify-end space-x-2">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : isSubmitted
                                ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                : isOverdue
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {isPaid ? (
                              <>
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
                                <span>Paid</span>
                              </>
                            ) : isSubmitted ? (
                              <>
                                <Clock className="w-3.5 h-3.5 text-purple-700 animate-pulse" />
                                <span>Payment Submitted (Pending Admin Confirmation)</span>
                              </>
                            ) : isOverdue ? (
                              <>
                                <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
                                <span>Overdue</span>
                              </>
                            ) : (
                              <span>Pending</span>
                            )}
                          </span>
                        </div>

                        <div>
                          <div className="text-xl font-bold font-mono text-[#161F1A]">
                            {getCurrencySymbol(fee.currency)}{netAmount.toLocaleString()}
                          </div>
                          {fee.discount && fee.discount > 0 ? (
                            <div className="text-[10px] text-emerald-700 font-mono">
                              ({getCurrencySymbol(fee.currency)}{fee.amount.toLocaleString()} gross - {getCurrencySymbol(fee.currency)}{fee.discount.toLocaleString()} sibling discount)
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Sibling Breakdown Table if Family Combined Invoice */}
                    {fee.isFamilyInvoice && fee.siblingBreakdown && fee.siblingBreakdown.length > 0 && (
                      <div className="bg-[#FAF9F7] rounded-xl border border-[#E3DFD7] p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-[#161F1A]">
                          <span className="flex items-center gap-1.5 text-[#1E5C3D]">
                            <Layers className="w-3.5 h-3.5" />
                            <span>Covered Sibling Tuition Breakdown ({fee.siblingBreakdown.length} Children)</span>
                          </span>
                          <span className="text-[11px] text-[#5A6B61] font-normal">Included in this single consolidated invoice</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {fee.siblingBreakdown.map((sib, sIdx) => (
                            <div key={sIdx} className="bg-white p-2.5 rounded-lg border border-[#EAE6DE] flex items-center justify-between text-xs">
                              <div>
                                <span className="font-bold text-[#161F1A] block">{sib.studentName}</span>
                                <span className="text-[10px] font-mono text-[#5A6B61]">{sib.studentId}</span>
                              </div>
                              <span className="font-mono font-bold text-[#161F1A]">
                                {getCurrencySymbol(fee.currency)}{sib.amount.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Payment Submitted Callout Banner */}
                    {isSubmitted && (
                      <div className="bg-purple-50/80 border border-purple-200 rounded-xl p-3 text-xs text-purple-900 flex items-start space-x-2.5">
                        <Clock className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                        <div className="space-y-0.5 flex-1">
                          <p className="font-bold">
                            Payment notice submitted on {fee.paymentDate || 'recently'} via {fee.paymentMethod || 'Bank Transfer'}.
                          </p>
                          <p className="text-[11px] text-purple-800">
                            {fee.paymentReference ? `Reference: ${fee.paymentReference}. ` : ''}
                            The academy finance administration will verify receipt in the academy account and manually confirm this invoice to "Paid".
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Actions Row */}
                    <div className="pt-2 border-t border-[#EAE6DE] flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[11px] text-[#5A6B61]">
                        {fee.isFamilyInvoice
                          ? 'Consolidated tuition invoice for all enrolled children.'
                          : 'Official tuition billing invoice.'}
                      </span>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setViewingReceiptFee(fee)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
                          title="Open Official In-App Receipt"
                        >
                          <Receipt className="w-3.5 h-3.5 text-[#2D8B5C]" />
                          <span>View Receipt</span>
                        </button>

                        <button
                          onClick={() => generateInvoicePDF(fee)}
                          className="px-3 py-1.5 rounded-lg border border-[#D5D0C6] hover:bg-gray-100 text-xs font-semibold text-[#161F1A] flex items-center space-x-1.5 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-[#2D8B5C]" />
                          <span>Download PDF Statement</span>
                        </button>

                        {isPaid ? (
                          <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center space-x-1.5">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Paid in Full</span>
                          </span>
                        ) : isSubmitted ? (
                          <button
                            type="button"
                            onClick={() => setPaymentNoticeFee(fee)}
                            className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
                            title="Update payment details or view notice sent to admin"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Notice Sent (Update Details)</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPaymentNoticeFee(fee)}
                            className="px-3.5 py-1.5 rounded-lg bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
                            title="Notify academy that you have sent tuition payment"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>
                              {fee.isFamilyInvoice ? 'Notify Family Payment Sent' : 'Notify Payment Sent'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: ANNOUNCEMENTS */}
      {currentTab === 'announcements' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#161F1A]">Academy Announcements & Notices</h3>
            <span className="text-xs text-[#5A6B61]">{announcements.length} Published Updates</span>
          </div>
          {announcements.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-[#E3DFD7] text-center text-[#5A6B61]">
              <Bell className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="font-semibold text-[#161F1A]">No announcements at this time</p>
              <p className="text-xs text-gray-500 mt-1">Updates from the Academic Director will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map(ann => (
                <div key={ann.id} className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-[#161F1A]">{ann.title}</h4>
                    <span className="text-[10px] text-[#5A6B61]">{new Date(ann.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-[#5A6B61] leading-relaxed whitespace-pre-line">{ann.content}</p>
                </div>
              ))}
            </div>
          )}
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

      {/* Payment Notice Modal (Notifies admin for manual confirmation) */}
      <PaymentNoticeModal
        isOpen={!!paymentNoticeFee}
        onClose={() => setPaymentNoticeFee(null)}
        fee={paymentNoticeFee}
        submitterRole="Parent"
        onPaymentSubmitted={async () => {
          if (onRefreshData) {
            await onRefreshData();
          }
        }}
      />
    </div>
  );
};
