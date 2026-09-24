import React, { useState, useEffect } from 'react';
import { 
  X, User, Mail, Phone, MapPin, Clock, Calendar, BookOpen, CreditCard, 
  CheckCircle, Shield, Edit, Plus, ExternalLink, FileText, Star, Award, 
  Users, DollarSign, RefreshCw, Copy, Check, Lock, ArrowUpRight
} from 'lucide-react';
import { Student, Tutor, TimetableClass, Lesson, StudentFee, AllowedCurrency } from '../../types';
import { getCurrencySymbol } from '../../utils/currency';
import { updateStudent, updateFee } from '../../services/dataService';

interface StudentFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  tutors: Tutor[];
  classes: TimetableClass[];
  lessons: Lesson[];
  fees: StudentFee[];
  students?: Student[];
  onEditStudent: (student: Student) => void;
  onOpenFeeModal: (studentId: string) => void;
  onOpenLessonModal: (studentId: string) => void;
  onOpenShiftTutorModal?: (student: Student) => void;
  onRefreshData?: () => Promise<void>;
  initialTab?: 'overview' | 'finance' | 'schedule' | 'lessons' | 'notes';
}

export const StudentFolderModal: React.FC<StudentFolderModalProps> = ({
  isOpen,
  onClose,
  student,
  tutors,
  classes,
  lessons,
  fees,
  students = [],
  onEditStudent,
  onOpenFeeModal,
  onOpenLessonModal,
  onOpenShiftTutorModal,
  onRefreshData,
  initialTab = 'overview'
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'finance' | 'schedule' | 'lessons' | 'notes'>(initialTab);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [adminNotesInput, setAdminNotesInput] = useState<string>('');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);
  const [notesSaveMsg, setNotesSaveMsg] = useState<string>('');
  const [lessonSearch, setLessonSearch] = useState<string>('');
  const [quickPaymentAmount, setQuickPaymentAmount] = useState<number | ''>('');
  const [selectedFeeForPayment, setSelectedFeeForPayment] = useState<StudentFee | null>(null);
  const [isRecordingPayment, setIsRecordingPayment] = useState<boolean>(false);

  // Sync privateAdminNotes state when student changes
  useEffect(() => {
    if (student) {
      setAdminNotesInput(student.privateAdminNotes || '');
      setNotesSaveMsg('');
      setActiveTab(initialTab);
    }
  }, [student, initialTab]);

  if (!isOpen || !student) return null;

  // Safe data filtering
  const studentClasses = classes.filter(c => c && c.studentId === student.studentId);
  const studentLessons = lessons
    .filter(l => l && l.studentId === student.studentId)
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  const studentFees = fees
    .filter(f => f && f.studentId === student.studentId)
    .sort((a, b) => new Date(b.dueDate || b.createdAt || 0).getTime() - new Date(a.dueDate || a.createdAt || 0).getTime());

  // Siblings in same Family Group
  const siblings = students.filter(s => 
    s && s.studentId !== student.studentId && 
    ((student.familyGroupId && s.familyGroupId === student.familyGroupId) ||
     (student.familyGroupName && s.familyGroupName === student.familyGroupName))
  );

  // Assigned tutor object
  const assignedTutor = tutors.find(t => 
    t && (t.tutorId === student.assignedTutorId || t.name === student.assignedTutorId || t.realName === student.assignedTutorId)
  );

  // Financial Calculations
  const currencySymbol = getCurrencySymbol(student.feeCurrency || 'USD');
  const totalBilled = studentFees.reduce((acc, f) => acc + (f.amount || 0), 0);
  const totalPaid = studentFees.reduce((acc, f) => acc + (f.paidAmount || (f.status === 'Paid' ? f.amount : 0)), 0);
  const pendingDue = Math.max(0, totalBilled - totalPaid);
  
  const latestFee = studentFees[0];
  const isOverdue = !!(latestFee && latestFee.status !== 'Paid' && latestFee.dueDate && new Date(latestFee.dueDate) < new Date());

  // Attendance Calculations
  const totalSessionsLogged = studentLessons.length;
  const presentCount = studentLessons.filter(l => !l.attendanceStatus || l.attendanceStatus === 'Present').length;
  const absentCount = studentLessons.filter(l => l.attendanceStatus === 'Absent').length;
  const rescheduledCount = studentLessons.filter(l => l.attendanceStatus === 'Cancelled' || l.attendanceStatus === 'Make-up').length;
  const attendancePercentage = totalSessionsLogged > 0 
    ? Math.round((presentCount / totalSessionsLogged) * 100) 
    : 100;

  const copyToClipboard = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSaveNotes = async () => {
    if (!student) return;
    setIsSavingNotes(true);
    setNotesSaveMsg('');
    try {
      await updateStudent(student.id, { privateAdminNotes: adminNotesInput });
      setNotesSaveMsg('Admin notes saved successfully.');
      if (onRefreshData) await onRefreshData();
    } catch (err) {
      console.error('Failed to save notes:', err);
      setNotesSaveMsg('Error saving notes.');
    } finally {
      setIsSavingNotes(false);
      setTimeout(() => setNotesSaveMsg(''), 3000);
    }
  };

  const handleRecordPayment = async (fee: StudentFee) => {
    if (!quickPaymentAmount || typeof quickPaymentAmount !== 'number' || quickPaymentAmount <= 0) return;
    setIsRecordingPayment(true);
    try {
      const currentPaid = fee.paidAmount || (fee.status === 'Paid' ? fee.amount : 0);
      const newPaid = currentPaid + quickPaymentAmount;
      const isFullyPaid = newPaid >= fee.amount;

      await updateFee(fee.id, {
        paidAmount: newPaid,
        status: isFullyPaid ? 'Paid' : 'Pending',
        paymentDate: new Date().toISOString()
      });

      if (onRefreshData) await onRefreshData();
      setSelectedFeeForPayment(null);
      setQuickPaymentAmount('');
    } catch (err) {
      console.error('Failed to record payment:', err);
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const filteredLessons = studentLessons.filter(l => {
    if (!lessonSearch) return true;
    const q = lessonSearch.toLowerCase();
    const surah = l.quranDetails?.surahName || (l as any).surahName || l.lessonCovered || '';
    const notes = l.teacherRemarks || (l as any).notes || '';
    const homework = l.homework || '';
    const tutor = (l as any).tutorName || l.tutorId || '';
    return (
      surah.toLowerCase().includes(q) ||
      notes.toLowerCase().includes(q) ||
      homework.toLowerCase().includes(q) ||
      (l.date && l.date.includes(q)) ||
      tutor.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex justify-center items-center p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[92vh] text-left">
        
        {/* MODAL HEADER */}
        <div className="bg-[#161F1A] text-white p-5 sm:p-6 relative border-b border-white/10 flex-shrink-0">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
            title="Close Student Folder"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Student Identity */}
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#2D8B5C] flex items-center justify-center text-white text-2xl font-bold shadow-sm border border-white/20 flex-shrink-0">
                {student.name ? student.name.charAt(0).toUpperCase() : 'S'}
              </div>

              <div>
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{student.name}</h2>
                  
                  {/* Clean unboxed status & metadata */}
                  <span className="text-xs font-mono font-bold text-emerald-300">
                    {student.studentId}
                  </span>
                  <span className="text-gray-500 text-xs" aria-hidden="true">•</span>
                  <span className={`text-xs font-semibold ${
                    student.status === 'Active' ? 'text-emerald-400' :
                    student.status === 'Trial' ? 'text-amber-400' :
                    student.status === 'Paused' ? 'text-blue-400' : 'text-gray-400'
                  }`}>
                    {student.status}
                  </span>
                </div>

                {/* Subtitle Metadata */}
                <div className="flex items-center space-x-2 text-xs text-gray-300 mt-1 flex-wrap">
                  <span>{student.courseType}</span>
                  <span aria-hidden="true">•</span>
                  <span>Tutor: <strong className="text-white">{assignedTutor?.name || assignedTutor?.realName || student.assignedTutorId || 'Unassigned'}</strong></span>
                  <span aria-hidden="true">•</span>
                  <span>{student.country || 'USA'}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions Header Toolbar */}
            <div className="flex items-center space-x-2 flex-wrap gap-2 md:justify-end">
              <button
                onClick={() => onEditStudent(student)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer border border-white/15"
              >
                <Edit className="w-3.5 h-3.5 text-emerald-300" />
                <span>Edit Details</span>
              </button>

              {onOpenShiftTutorModal && (
                <button
                  onClick={() => onOpenShiftTutorModal(student)}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer border border-white/15"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
                  <span>Shift Tutor</span>
                </button>
              )}

              <button
                onClick={() => onOpenLessonModal(student.studentId)}
                className="px-3 py-1.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Lesson</span>
              </button>

              <button
                onClick={() => onOpenFeeModal(student.studentId)}
                className="px-3 py-1.5 bg-[#C5A059] hover:bg-[#A38243] text-[#161F1A] font-bold rounded-lg text-xs flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Create Fee</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 KPI SUMMARY CARDS */}
        <div className="bg-gray-50/80 p-3 sm:p-4 border-b border-gray-200 flex-shrink-0 grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* 1. Financial Status */}
          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span className="font-medium flex items-center space-x-1">
                <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                <span>Financial Summary</span>
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                pendingDue === 0 ? 'bg-emerald-100 text-emerald-800' :
                isOverdue ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {pendingDue === 0 ? 'Paid' : isOverdue ? 'Overdue' : 'Pending'}
              </span>
            </div>
            <div className="text-base sm:text-lg font-bold text-[#161F1A] tracking-tight">
              {currencySymbol}{pendingDue.toLocaleString()} <span className="text-xs font-normal text-gray-500">due</span>
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Fee: {currencySymbol}{student.monthlyFee || 0} / mo
            </div>
          </div>

          {/* 2. Attendance Stats */}
          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span className="font-medium flex items-center space-x-1">
                <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                <span>Attendance Health</span>
              </span>
              <span className="text-xs font-bold text-emerald-700">{attendancePercentage}%</span>
            </div>
            <div className="text-base sm:text-lg font-bold text-[#161F1A] tracking-tight">
              {presentCount} <span className="text-xs font-normal text-gray-500">/ {totalSessionsLogged} Sessions</span>
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5 flex items-center space-x-2">
              <span className="text-rose-600">{absentCount} Abs</span>
              <span>•</span>
              <span className="text-amber-600">{rescheduledCount} Resch</span>
            </div>
          </div>

          {/* 3. Schedule Slot */}
          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span className="font-medium flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>Weekly Timetable</span>
              </span>
              <span className="text-xs font-bold text-gray-700">{studentClasses.length} slots</span>
            </div>
            <div className="text-sm font-bold text-[#161F1A] truncate">
              {studentClasses.length > 0 
                ? studentClasses.map(c => (c && c.dayOfWeek ? String(c.dayOfWeek).substring(0, 3) : '')).filter(Boolean).join(', ') 
                : 'No slots scheduled'}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5 truncate">
              {studentClasses[0] ? `${studentClasses[0].startTimePKT || 'Class'} (${studentClasses[0].durationMinutes || 30}m)` : 'Unassigned'}
            </div>
          </div>

          {/* 4. Lesson Progress */}
          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span className="font-medium flex items-center space-x-1">
                <Award className="w-3.5 h-3.5 text-indigo-600" />
                <span>Latest Lesson</span>
              </span>
              <span className="text-xs font-bold text-indigo-700">{totalSessionsLogged} Logs</span>
            </div>
            <div className="text-sm font-bold text-[#161F1A] truncate">
              {studentLessons[0]?.quranDetails?.surahName || (studentLessons[0] as any)?.surahName || studentLessons[0]?.lessonCovered || 'No lessons logged yet'}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5 truncate">
              Last: {studentLessons[0]?.date ? new Date(studentLessons[0].date).toLocaleDateString() : 'N/A'}
            </div>
          </div>
        </div>

        {/* TAB NAVIGATION BAR */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 flex items-center space-x-2 sm:space-x-6 overflow-x-auto flex-shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-1.5 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-[#2D8B5C] text-[#2D8B5C]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Overview & Contacts</span>
          </button>

          <button
            onClick={() => setActiveTab('finance')}
            className={`py-3 px-1.5 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center space-x-2 whitespace-nowrap relative ${
              activeTab === 'finance'
                ? 'border-[#2D8B5C] text-[#2D8B5C]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Financial Ledger ({studentFees.length})</span>
            {pendingDue > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('schedule')}
            className={`py-3 px-1.5 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'schedule'
                ? 'border-[#2D8B5C] text-[#2D8B5C]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Timetable & Attendance</span>
          </button>

          <button
            onClick={() => setActiveTab('lessons')}
            className={`py-3 px-1.5 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'lessons'
                ? 'border-[#2D8B5C] text-[#2D8B5C]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Lesson Logs ({studentLessons.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('notes')}
            className={`py-3 px-1.5 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'notes'
                ? 'border-[#2D8B5C] text-[#2D8B5C]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Lock className="w-4 h-4 text-amber-600" />
            <span>Admin Notes</span>
            {student.privateAdminNotes && (
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            )}
          </button>
        </div>

        {/* TAB CONTENTS */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 bg-gray-50/50">
          
          {/* ================= TAB 1: OVERVIEW & CONTACTS ================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Personal & Contact Details */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h3 className="font-bold text-[#161F1A] text-sm flex items-center space-x-2">
                      <User className="w-4 h-4 text-[#2D8B5C]" />
                      <span>Student Profile Details</span>
                    </h3>
                    <span className="text-xs text-gray-400 font-mono">ID: {student.studentId}</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-500 font-medium">Full Name</span>
                      <span className="font-semibold text-gray-900">{student.name}</span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-500 font-medium">Student Email</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-gray-900">{student.email || 'N/A'}</span>
                        {student.email && (
                          <button 
                            onClick={() => copyToClipboard(student.email, 'studentEmail')}
                            className="p-1 text-gray-400 hover:text-emerald-700 cursor-pointer"
                            title="Copy email"
                          >
                            {copiedField === 'studentEmail' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-500 font-medium">Student Phone</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-gray-900">{student.phone || 'N/A'}</span>
                        {student.phone && (
                          <button 
                            onClick={() => copyToClipboard(student.phone, 'studentPhone')}
                            className="p-1 text-gray-400 hover:text-emerald-700 cursor-pointer"
                            title="Copy phone"
                          >
                            {copiedField === 'studentPhone' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-500 font-medium">Country</span>
                      <span className="font-semibold text-gray-900">{student.country || 'USA'}</span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-500 font-medium">Local Timezone</span>
                      <span className="font-semibold text-gray-900">{student.timezone || 'America/New_York'}</span>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="text-gray-500 font-medium">Enrollment Date</span>
                      <span className="font-semibold text-gray-900">
                        {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Parent / Guardian Info */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h3 className="font-bold text-[#161F1A] text-sm flex items-center space-x-2">
                      <Users className="w-4 h-4 text-amber-600" />
                      <span>Parent / Guardian Contacts</span>
                    </h3>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-500 font-medium">Parent Name</span>
                      <span className="font-semibold text-gray-900">{student.parentName || 'N/A'}</span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-500 font-medium">Parent Email</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-gray-900">{student.parentEmail || 'N/A'}</span>
                        {student.parentEmail && (
                          <button 
                            onClick={() => copyToClipboard(student.parentEmail, 'parentEmail')}
                            className="p-1 text-gray-400 hover:text-emerald-700 cursor-pointer"
                          >
                            {copiedField === 'parentEmail' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-500 font-medium">Parent Phone / WhatsApp</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-gray-900">{student.parentPhone || 'N/A'}</span>
                        {student.parentPhone && (
                          <>
                            <a
                              href={`https://wa.me/${student.parentPhone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-semibold rounded text-[10px] hover:bg-emerald-200 transition-colors"
                            >
                              WhatsApp
                            </a>
                            <button 
                              onClick={() => copyToClipboard(student.parentPhone, 'parentPhone')}
                              className="p-1 text-gray-400 hover:text-emerald-700 cursor-pointer"
                            >
                              {copiedField === 'parentPhone' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-500 font-medium">Family Group</span>
                      <span className="font-semibold text-gray-900">
                        {student.familyGroupName || 'Individual Account'}
                      </span>
                    </div>

                    {siblings.length > 0 && (
                      <div className="pt-2">
                        <span className="text-gray-500 font-medium block mb-1">Group Siblings ({siblings.length})</span>
                        <div className="flex flex-wrap gap-1.5">
                          {siblings.map(sib => (
                            <span key={sib.studentId} className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded font-mono text-[11px] border border-gray-200">
                              {sib.name} ({sib.studentId})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Course & Enrollment Summary */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
                <h3 className="font-bold text-[#161F1A] text-sm flex items-center space-x-2 border-b border-gray-100 pb-3">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <span>Academic Course & Enrollment Program</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-gray-500 block text-[11px] font-medium">Course Program</span>
                    <span className="font-bold text-gray-900 text-sm block mt-0.5">{student.courseType}</span>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-gray-500 block text-[11px] font-medium">Assigned Tutor</span>
                    <span className="font-bold text-emerald-800 text-sm block mt-0.5">
                      {assignedTutor ? (assignedTutor.name || assignedTutor.realName) : (student.assignedTutorId || 'Unassigned')}
                    </span>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-gray-500 block text-[11px] font-medium">Trial Sessions Status</span>
                    <span className="font-bold text-gray-900 text-sm block mt-0.5">
                      {student.trialSessionsCompleted || 0} sessions ({student.trialStatus || 'Completed'})
                    </span>
                  </div>
                </div>

                {student.notes && (
                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 text-xs">
                    <span className="font-bold text-amber-900 block mb-1">General Profile Notes:</span>
                    <p className="text-amber-950 whitespace-pre-wrap">{student.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 2: FINANCIAL LEDGER ================= */}
          {activeTab === 'finance' && (
            <div className="space-y-6">
              
              {/* Fee Structure Summary */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-[#161F1A] text-base">Monthly Billing Ledger</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Agreed Fee: <strong className="text-gray-900">{currencySymbol}{student.monthlyFee || 0} / month ({student.feeCurrency || 'USD'})</strong>
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="text-right pr-3 border-r border-gray-200">
                    <span className="text-xs text-gray-500 block">Total Collected</span>
                    <span className="text-base font-bold text-emerald-700">{currencySymbol}{totalPaid.toLocaleString()}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500 block">Outstanding Pending</span>
                    <span className={`text-base font-bold ${pendingDue > 0 ? 'text-rose-600' : 'text-gray-800'}`}>
                      {currencySymbol}{pendingDue.toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={() => onOpenFeeModal(student.studentId)}
                    className="ml-2 px-3 py-2 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Invoice</span>
                  </button>
                </div>
              </div>

              {/* Quick Payment Recorder Form Modal/Box if selected */}
              {selectedFeeForPayment && (
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-emerald-900 text-xs">Record Payment for Invoice ({selectedFeeForPayment.billingPeriod || selectedFeeForPayment.invoiceNumber})</h4>
                    <button onClick={() => setSelectedFeeForPayment(null)} className="text-emerald-700 hover:text-emerald-950 text-xs font-semibold cursor-pointer">Cancel</button>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="number"
                      value={quickPaymentAmount}
                      onChange={e => setQuickPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder={`Amount in ${currencySymbol} (Total: ${selectedFeeForPayment.amount})`}
                      className="px-3 py-2 border border-emerald-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 flex-1"
                    />
                    <button
                      onClick={() => handleRecordPayment(selectedFeeForPayment)}
                      disabled={isRecordingPayment || !quickPaymentAmount}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isRecordingPayment ? 'Saving...' : 'Confirm Payment'}
                    </button>
                  </div>
                </div>
              )}

              {/* Invoices Table */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
                <div className="p-4 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between">
                  <h4 className="font-bold text-[#161F1A] text-xs uppercase tracking-wider">Fee Invoices & Receipts History</h4>
                  <span className="text-xs text-gray-500">{studentFees.length} total records</span>
                </div>

                {studentFees.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-xs">
                    No fee invoices recorded yet for this student.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                        <tr>
                          <th className="p-3">Invoice / Month</th>
                          <th className="p-3">Due Date</th>
                          <th className="p-3">Amount</th>
                          <th className="p-3">Paid Amount</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {studentFees.map(fee => {
                          const paid = fee.paidAmount || (fee.status === 'Paid' ? fee.amount : 0);
                          const remaining = Math.max(0, fee.amount - paid);
                          const isFeeOverdue = !!(fee.status !== 'Paid' && fee.dueDate && new Date(fee.dueDate) < new Date());

                          return (
                            <tr key={fee.id} className="hover:bg-gray-50/80 transition-colors">
                              <td className="p-3 font-semibold text-gray-900">
                                {fee.billingPeriod || fee.invoiceNumber || 'Monthly Fee'}
                              </td>
                              <td className="p-3 text-gray-600">
                                {fee.dueDate ? new Date(fee.dueDate).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="p-3 font-bold text-gray-900">
                                {currencySymbol}{fee.amount}
                              </td>
                              <td className="p-3 text-emerald-700 font-semibold">
                                {currencySymbol}{paid}
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                  fee.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                                  isFeeOverdue ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {fee.status === 'Paid' ? 'Paid' : isFeeOverdue ? 'Overdue' : 'Pending'}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                {fee.status !== 'Paid' && (
                                  <button
                                    onClick={() => {
                                      setSelectedFeeForPayment(fee);
                                      setQuickPaymentAmount(remaining);
                                    }}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[11px] transition-colors cursor-pointer"
                                  >
                                    Record Pay
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 3: TIMETABLE & ATTENDANCE ================= */}
          {activeTab === 'schedule' && (
            <div className="space-y-6">
              
              {/* Active Weekly Classes */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h3 className="font-bold text-[#161F1A] text-sm flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-[#2D8B5C]" />
                    <span>Weekly Class Timetable Slots ({studentClasses.length})</span>
                  </h3>
                </div>

                {studentClasses.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-xs bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    No active class slots scheduled on the timetable grid for this student.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {studentClasses.map(cls => (
                      <div key={cls.id} className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 hover:border-emerald-300 transition-colors space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#2D8B5C] text-sm">{cls.dayOfWeek || 'Scheduled Day'}</span>
                          <span className="px-2 py-0.5 bg-white text-gray-700 font-mono text-[10px] rounded border border-gray-200">
                            {cls.durationMinutes || 30} min
                          </span>
                        </div>
                        <div className="text-xs text-gray-800 font-semibold flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5 text-gray-500" />
                          <span>{cls.startTimePKT || 'TBD'} PKT</span>
                        </div>
                        <div className="text-[11px] text-gray-500 pt-1 border-t border-gray-200/60 flex items-center justify-between">
                          <span>Tutor: <strong>{cls.tutorId}</strong></span>
                          {cls.notes && (
                            <span className="text-gray-400 text-[10px] truncate max-w-[120px]">{cls.notes}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Attendance Log Breakdown */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h3 className="font-bold text-[#161F1A] text-sm flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                    <span>Attendance Rate & Session Record</span>
                  </h3>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    {attendancePercentage}% Attendance Rate
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                    <span className="text-lg font-bold text-emerald-800">{presentCount}</span>
                    <span className="text-[11px] text-emerald-700 block font-medium">Present</span>
                  </div>
                  <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-100">
                    <span className="text-lg font-bold text-rose-800">{absentCount}</span>
                    <span className="text-[11px] text-rose-700 block font-medium">Absent</span>
                  </div>
                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                    <span className="text-lg font-bold text-amber-800">{rescheduledCount}</span>
                    <span className="text-[11px] text-amber-700 block font-medium">Rescheduled / Cancelled</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ================= TAB 4: LESSON LOGS ================= */}
          {activeTab === 'lessons' && (
            <div className="space-y-4">
              
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <input
                  type="text"
                  value={lessonSearch}
                  onChange={e => setLessonSearch(e.target.value)}
                  placeholder="Search lessons by Surah, notes, date or tutor..."
                  className="px-3.5 py-2 border border-gray-200 rounded-xl text-xs bg-white w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-[#2D8B5C]"
                />

                <button
                  onClick={() => onOpenLessonModal(student.studentId)}
                  className="px-3.5 py-2 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 shadow-2xs w-full sm:w-auto justify-center"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log New Lesson</span>
                </button>
              </div>

              {filteredLessons.length === 0 ? (
                <div className="bg-white p-8 text-center text-gray-400 text-xs rounded-2xl border border-gray-200">
                  {lessonSearch ? 'No matching lessons found.' : 'No lesson history logged yet.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLessons.map(lesson => {
                    const title = lesson.quranDetails?.surahName || (lesson as any).surahName || lesson.lessonCovered || 'Quran Lesson';
                    const versesText = lesson.quranDetails ? `${lesson.quranDetails.ayahStart}-${lesson.quranDetails.ayahEnd}` : (lesson as any).verses;
                    const paraText = lesson.quranDetails?.juz || (lesson as any).paraNumber;
                    const notesText = lesson.teacherRemarks || (lesson as any).notes;
                    const tutorName = (lesson as any).tutorName || lesson.tutorId || 'Assigned Tutor';
                    const ratingText = lesson.performance || (lesson as any).rating;

                    return (
                      <div key={lesson.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs hover:border-emerald-300 transition-all space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-[#161F1A] text-sm">{title}</span>
                            {versesText && (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded border border-emerald-200">
                                Verses: {versesText}
                              </span>
                            )}
                            {paraText && (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 text-[10px] font-bold rounded border border-amber-200">
                                Para / Juz: {paraText}
                              </span>
                            )}
                          </div>

                          <span className="text-xs text-gray-500 font-medium">
                            {lesson.date ? new Date(lesson.date).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {lesson.homework && (
                            <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                              <span className="text-gray-500 font-bold block text-[10px]">Homework Assigned:</span>
                              <span className="text-gray-800">{lesson.homework}</span>
                            </div>
                          )}
                          {notesText && (
                            <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                              <span className="text-gray-500 font-bold block text-[10px]">Tutor Remarks / Notes:</span>
                              <span className="text-gray-800">{notesText}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t border-gray-100">
                          <span>Tutor: <strong className="text-gray-800">{tutorName}</strong></span>
                          {ratingText && (
                            <div className="flex items-center space-x-1 text-amber-600 font-bold">
                              <Star className="w-3.5 h-3.5 fill-amber-400" />
                              <span>{ratingText}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 5: CONFIDENTIAL ADMIN NOTES ================= */}
          {activeTab === 'notes' && (
            <div className="space-y-6">
              
              {/* Private Admin Notes Box */}
              <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h3 className="font-bold text-[#161F1A] text-sm flex items-center space-x-2">
                    <Lock className="w-4 h-4 text-amber-600" />
                    <span>Confidential Private Admin Notes</span>
                  </h3>
                  <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Admin Visible Only
                  </span>
                </div>

                <textarea
                  value={adminNotesInput}
                  onChange={e => setAdminNotesInput(e.target.value)}
                  rows={5}
                  placeholder="Type confidential admin notes here (e.g. parent special requests, fee custom terms, schedule preferences, supervisor instructions)..."
                  className="w-full p-3 border border-gray-200 rounded-xl text-xs bg-amber-50/20 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-sans"
                />

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-emerald-700 font-semibold">{notesSaveMsg}</span>
                  <button
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="px-4 py-2 bg-[#161F1A] hover:bg-[#2D8B5C] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center space-x-1.5 shadow-2xs disabled:opacity-50"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isSavingNotes ? 'Saving Notes...' : 'Save Notes'}</span>
                  </button>
                </div>
              </div>

              {/* System Audit & Activity Timeline */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
                <h3 className="font-bold text-[#161F1A] text-sm flex items-center space-x-2 border-b border-gray-100 pb-3">
                  <FileText className="w-4 h-4 text-gray-600" />
                  <span>Student Profile Record Timeline</span>
                </h3>

                <div className="space-y-3 text-xs">
                  <div className="flex items-start space-x-3 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
                    <div className="flex-1">
                      <span className="font-bold text-gray-900 block">Student Record Enrolled</span>
                      <span className="text-gray-500 text-[11px]">
                        Registered on {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : 'System Start'}
                      </span>
                    </div>
                  </div>

                  {student.assignedTutorId && (
                    <div className="flex items-start space-x-3 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                      <div className="flex-1">
                        <span className="font-bold text-gray-900 block">Current Assigned Tutor</span>
                        <span className="text-gray-500 text-[11px]">
                          Assigned to {assignedTutor?.name || assignedTutor?.realName || student.assignedTutorId}
                        </span>
                      </div>
                    </div>
                  )}

                  {studentFees.length > 0 && (
                    <div className="flex items-start space-x-3 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5" />
                      <div className="flex-1">
                        <span className="font-bold text-gray-900 block">Latest Fee Invoice Issued</span>
                        <span className="text-gray-500 text-[11px]">
                          {latestFee.billingPeriod || latestFee.month} — {currencySymbol}{latestFee.amount} ({latestFee.status})
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* BOTTOM FOOTER */}
        <div className="p-4 bg-gray-100 border-t border-gray-200 flex items-center justify-between flex-shrink-0 text-xs">
          <span className="text-gray-500 font-medium">
            Student File & Record • <strong className="text-gray-800">{student.name} ({student.studentId})</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Close Folder
          </button>
        </div>

      </div>
    </div>
  );
};
