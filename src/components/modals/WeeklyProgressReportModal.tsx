import React, { useState, useEffect } from 'react';
import { X, FileText, Send, Copy, Check, Sparkles, Calendar, User, BookOpen, Award, CheckCircle2, AlertCircle } from 'lucide-react';
import { Student, Lesson, AttendanceRecord, Tutor } from '../../types';
import { generateWeeklyProgressReportPDF, getWeeklyProgressReportWhatsAppMessage, WeeklyReportData } from '../../utils/pdfGenerator';

interface WeeklyProgressReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  lessons: Lesson[];
  attendanceRecords?: AttendanceRecord[];
  tutors?: Tutor[];
  initialStudentId?: string;
}

export const WeeklyProgressReportModal: React.FC<WeeklyProgressReportModalProps> = ({
  isOpen,
  onClose,
  students,
  lessons,
  attendanceRecords = [],
  tutors = [],
  initialStudentId
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId || '');
  const [dateRange, setDateRange] = useState<'this_week' | 'last_week' | 'custom'>('this_week');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const [portionRecited, setPortionRecited] = useState<string>('');
  const [tajweedObservations, setTajweedObservations] = useState<string>('');
  const [memorizationProgress, setMemorizationProgress] = useState<string>('');
  const [tutorFeedback, setTutorFeedback] = useState<string>('');
  const [recommendedPractice, setRecommendedPractice] = useState<string>('15-20 minutes daily recitation revision before class.');
  
  const [isCopied, setIsCopied] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Initialize date range
  useEffect(() => {
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    const startObj = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const start = startObj.toISOString().slice(0, 10);
    
    setStartDate(start);
    setEndDate(end);
  }, []);

  useEffect(() => {
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
    } else if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0].studentId);
    }
  }, [initialStudentId, students]);

  const currentStudent = students.find(s => s.studentId === selectedStudentId) || students[0];

  // Calculate lessons and attendance within selected window
  const studentLessons = (lessons || []).filter(l => {
    const matchesStudent = l.studentId === currentStudent?.studentId;
    const withinDate = (!startDate || l.date >= startDate) && (!endDate || l.date <= endDate);
    return matchesStudent && withinDate;
  });

  const studentAttendance = (attendanceRecords || []).filter(a => {
    const matchesStudent = a.studentId === currentStudent?.studentId;
    const withinDate = (!startDate || a.date >= startDate) && (!endDate || a.date <= endDate);
    return matchesStudent && withinDate;
  });

  // Calculate statistics
  const totalScheduled = Math.max(studentLessons.length, studentAttendance.length, 1);
  const attendedCount = studentLessons.filter(l => l.attendanceStatus !== 'Absent').length ||
    studentAttendance.filter(a => a.status === 'Present' || a.status === 'Late' || a.status === 'Make-up').length;
  const lateCount = studentLessons.filter(l => l.attendanceStatus === 'Late').length ||
    studentAttendance.filter(a => a.status === 'Late').length;
  const absentCount = studentLessons.filter(l => l.attendanceStatus === 'Absent').length ||
    studentAttendance.filter(a => a.status === 'Absent').length;
  const attendanceRate = Math.round((attendedCount / totalScheduled) * 100) || 100;

  // Auto-populate remarks based on lessons
  useEffect(() => {
    if (!currentStudent) return;

    if (studentLessons.length > 0) {
      // Gather portions covered
      const portions: string[] = [];
      const feedbacks: string[] = [];
      const tajweedNotes: string[] = [];
      const memorizations: string[] = [];

      studentLessons.forEach(l => {
        if (l.quranDetails) {
          portions.push(`Surah ${l.quranDetails.surahName} (Ayahs ${l.quranDetails.ayahStart}-${l.quranDetails.ayahEnd}, Juz ${l.quranDetails.juz})`);
        } else if (l.qaidaDetails) {
          portions.push(`Qaida Pg ${l.qaidaDetails.pageNumber} (${l.qaidaDetails.lessonSection})`);
        } else if (l.lessonCovered) {
          portions.push(l.lessonCovered);
        }

        if (l.teacherRemarks) feedbacks.push(l.teacherRemarks);
        if (l.mistakes || l.weakAreas) tajweedNotes.push(`Focus area: ${l.weakAreas || l.mistakes}`);
        if (l.memorization || l.adaabManners) memorizations.push(`${l.memorization || ''} ${l.adaabManners || ''}`.trim());
      });

      if (portions.length > 0) {
        setPortionRecited(portions.slice(0, 3).join('; '));
      } else {
        setPortionRecited(`Regular syllabus progress in ${currentStudent.courseType}.`);
      }

      if (feedbacks.length > 0) {
        setTutorFeedback(feedbacks[feedbacks.length - 1]);
      } else {
        setTutorFeedback(`MashaAllah, ${currentStudent.name} demonstrated good focus and steady improvement this week.`);
      }

      if (tajweedNotes.length > 0) {
        setTajweedObservations(tajweedNotes.slice(0, 2).join('; '));
      } else {
        setTajweedObservations('Good pronunciation, steady pace and adherence to Madd and Ghunnah rules.');
      }

      if (memorizations.length > 0) {
        setMemorizationProgress(memorizations.slice(0, 2).join('; '));
      } else {
        setMemorizationProgress('Daily supplications and prayer steps recited with confidence.');
      }
    } else {
      setPortionRecited(`Regular syllabus progress in ${currentStudent.courseType}.`);
      setTutorFeedback(`MashaAllah, ${currentStudent.name} is progressing well in assigned lessons.`);
      setTajweedObservations('Clear recitation with steady progress in Makharij.');
      setMemorizationProgress('Active revision of daily Surahs and Kalmas.');
    }
  }, [selectedStudentId, startDate, endDate]);

  if (!isOpen || !currentStudent) return null;

  const assignedTutor = tutors.find(t => t.tutorId === currentStudent.assignedTutorId || t.realName === currentStudent.assignedTutorId);
  const tutorName = assignedTutor?.realName || currentStudent.assignedTutorId;

  const reportData: WeeklyReportData = {
    student: currentStudent,
    tutorName,
    startDate,
    endDate,
    attendanceRate,
    totalScheduled,
    totalAttended: attendedCount,
    totalLate: lateCount,
    totalAbsent: absentCount,
    portionRecited,
    tajweedObservations,
    memorizationProgress,
    tutorFeedback,
    recommendedPractice
  };

  const handleDownloadPdf = () => {
    setIsGeneratingPdf(true);
    try {
      generateWeeklyProgressReportPDF(reportData);
    } catch (err) {
      console.error('Error generating weekly PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleCopyWhatsApp = () => {
    const msg = getWeeklyProgressReportWhatsAppMessage(reportData);
    navigator.clipboard.writeText(msg);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 3000);
  };

  const handleSendWhatsApp = () => {
    const rawPhone = (currentStudent.parentPhone || currentStudent.phone || '').replace(/[^0-9]/g, '');
    const msg = getWeeklyProgressReportWhatsAppMessage(reportData);
    const encoded = encodeURIComponent(msg);
    if (rawPhone && rawPhone.length >= 7) {
      window.open(`https://wa.me/${rawPhone}?text=${encoded}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-[#E3DFD7] overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E5C3D] to-[#2D8B5C] p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-white/10 backdrop-blur-md">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base">Weekly Progress Report Generator</h3>
              <p className="text-xs text-white/80">Generate 1-click official PDF and WhatsApp summaries for parents</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Controls: Student & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#FAF9F7] p-4 rounded-xl border border-[#E3DFD7]">
            <div>
              <label className="block text-xs font-bold text-[#161F1A] mb-1">
                Select Student
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#D5D0C6] rounded-lg text-xs font-semibold text-[#161F1A] focus:ring-1 focus:ring-[#2D8B5C] focus:border-[#2D8B5C]"
              >
                {students.map(st => (
                  <option key={st.id} value={st.studentId}>
                    {st.name} ({st.studentId}) — {st.courseType}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#161F1A] mb-1">
                Report Week Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-[#D5D0C6] rounded-lg text-xs text-[#161F1A]"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-[#D5D0C6] rounded-lg text-xs text-[#161F1A]"
                />
              </div>
            </div>
          </div>

          {/* Attendance KPI Card Preview */}
          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Attendance & Punctuality ({startDate} to {endDate})
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-700 text-white">
                {attendanceRate}% Present
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-white p-2 rounded-lg border border-emerald-100">
                <span className="text-[10px] text-gray-500 block">Attended</span>
                <span className="font-bold text-emerald-800 text-sm">{attendedCount}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-100">
                <span className="text-[10px] text-gray-500 block">Scheduled</span>
                <span className="font-bold text-gray-800 text-sm">{totalScheduled}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-100">
                <span className="text-[10px] text-gray-500 block">Late</span>
                <span className="font-bold text-amber-700 text-sm">{lateCount}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-100">
                <span className="text-[10px] text-gray-500 block">Absences</span>
                <span className={`font-bold text-sm ${absentCount > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{absentCount}</span>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#161F1A] mb-1 flex items-center justify-between">
                <span>Portion Recited This Week</span>
                <span className="text-[10px] font-normal text-gray-500">Auto-extracted from daily logs</span>
              </label>
              <input
                type="text"
                value={portionRecited}
                onChange={(e) => setPortionRecited(e.target.value)}
                placeholder="e.g. Surah Al-Mulk (Ayahs 1-15, Juz 29); Qaida Pg 14"
                className="w-full px-3 py-2 bg-white border border-[#D5D0C6] rounded-lg text-xs text-[#161F1A] focus:ring-1 focus:ring-[#2D8B5C]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#161F1A] mb-1">
                  Tajweed & Makharij Observations
                </label>
                <textarea
                  rows={2}
                  value={tajweedObservations}
                  onChange={(e) => setTajweedObservations(e.target.value)}
                  placeholder="e.g. Good throat letters articulation; practice Ikhfa rules."
                  className="w-full px-3 py-2 bg-white border border-[#D5D0C6] rounded-lg text-xs text-[#161F1A] focus:ring-1 focus:ring-[#2D8B5C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#161F1A] mb-1">
                  Memorization & Duas / Adaab
                </label>
                <textarea
                  rows={2}
                  value={memorizationProgress}
                  onChange={(e) => setMemorizationProgress(e.target.value)}
                  placeholder="e.g. Recited 4th Kalma & Before Sleeping Dua fluently."
                  className="w-full px-3 py-2 bg-white border border-[#D5D0C6] rounded-lg text-xs text-[#161F1A] focus:ring-1 focus:ring-[#2D8B5C]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#161F1A] mb-1">
                Tutor Feedback & Remarks for Parents
              </label>
              <textarea
                rows={2}
                value={tutorFeedback}
                onChange={(e) => setTutorFeedback(e.target.value)}
                placeholder="e.g. MashaAllah great dedication shown during live sessions this week!"
                className="w-full px-3 py-2 bg-white border border-[#D5D0C6] rounded-lg text-xs text-[#161F1A] focus:ring-1 focus:ring-[#2D8B5C]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#161F1A] mb-1">
                Recommended Daily Home Practice
              </label>
              <input
                type="text"
                value={recommendedPractice}
                onChange={(e) => setRecommendedPractice(e.target.value)}
                placeholder="e.g. 15-20 minutes daily recitation revision before Maghrib."
                className="w-full px-3 py-2 bg-white border border-[#D5D0C6] rounded-lg text-xs text-[#161F1A] focus:ring-1 focus:ring-[#2D8B5C]"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-[#FAF9F7] px-6 py-4 border-t border-[#E3DFD7] flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            Parent: <strong className="text-gray-700">{currentStudent.parentName || 'Guardian'}</strong> ({currentStudent.parentPhone || 'No phone set'})
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="px-3 py-2 bg-white border border-[#D5D0C6] hover:bg-gray-50 text-[#161F1A] text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
              <span>{isCopied ? 'Copied Message!' : 'Copy Summary'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="px-3.5 py-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-bold rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send WhatsApp</span>
            </button>

            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={handleDownloadPdf}
              className="px-4 py-2 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-bold rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{isGeneratingPdf ? 'Generating...' : 'Download PDF Card'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
