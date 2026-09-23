import React, { useState } from 'react';
import {
  X,
  CheckCircle,
  AlertCircle,
  Calendar,
  BookOpen,
  User,
  ShieldCheck,
  FileImage,
  Loader2
} from 'lucide-react';
import { Lesson, CourseType, AttendanceStatus, LessonPerformance } from '../../types';
import { updateLesson } from '../../services/dataService';

interface LessonEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: Lesson | null;
  userRole: 'admin' | 'supervisor';
  userName?: string;
  onRefreshData?: () => Promise<void>;
  onOpenMaterialModal?: (lesson: Lesson) => void;
}

export const LessonEditModal: React.FC<LessonEditModalProps> = ({
  isOpen,
  onClose,
  lesson,
  userRole,
  userName = 'Supervisor',
  onRefreshData,
  onOpenMaterialModal
}) => {
  if (!isOpen || !lesson) return null;

  const [date, setDate] = useState<string>(lesson.date || '');
  const [lessonType, setLessonType] = useState<CourseType>(lesson.lessonType || 'Quran Reading / Nazra');
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>(lesson.attendanceStatus || 'Present');
  const [lateMinutes, setLateMinutes] = useState<number>(lesson.lateMinutes || 10);
  const [absentReason, setAbsentReason] = useState<string>(lesson.absentReason || '');
  const [lessonCovered, setLessonCovered] = useState<string>(lesson.lessonCovered || '');
  const [mushafPage, setMushafPage] = useState<string>(lesson.mushafPage ? String(lesson.mushafPage) : '');
  const [memorization, setMemorization] = useState<string>(lesson.memorization || '');
  const [adaabManners, setAdaabManners] = useState<string>(lesson.adaabManners || '');
  const [revision, setRevision] = useState<string>(lesson.revision || '');
  const [homework, setHomework] = useState<string>(lesson.homework || '');
  const [teacherRemarks, setTeacherRemarks] = useState<string>(lesson.teacherRemarks || '');
  const [performance, setPerformance] = useState<LessonPerformance>(lesson.performance || 'Good');
  
  // Safety & Security Audit
  const [safetyStatus, setSafetyStatus] = useState<'Safe' | 'Flagged' | 'Audited' | 'Pending Review'>(
    lesson.safetyStatus || 'Audited'
  );
  const [safetyNotes, setSafetyNotes] = useState<string>(lesson.safetyNotes || '');
  
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonCovered.trim() && attendanceStatus !== 'Absent') {
      alert("Please enter the lesson covered / portion recited.");
      return;
    }

    setIsSaving(true);
    try {
      const dateObj = new Date(date);
      const month = !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : lesson.month;

      await updateLesson(lesson.id, {
        date,
        month,
        lessonType,
        attendanceStatus,
        lateMinutes: attendanceStatus === 'Late' ? lateMinutes : undefined,
        absentReason: attendanceStatus === 'Absent' ? absentReason : undefined,
        lessonCovered: attendanceStatus === 'Absent' ? (absentReason ? `Absent (${absentReason})` : 'Absent') : lessonCovered.trim(),
        mushafPage: mushafPage.trim() || undefined,
        memorization: memorization.trim() || undefined,
        adaabManners: adaabManners.trim() || undefined,
        revision: revision.trim() || undefined,
        homework: homework.trim() || undefined,
        teacherRemarks: teacherRemarks.trim() || undefined,
        performance,
        safetyStatus,
        safetyNotes: safetyNotes.trim() || undefined,
        auditedBy: `${userRole.toUpperCase()} - ${userName}`,
        auditedAt: new Date().toISOString()
      });

      if (onRefreshData) {
        await onRefreshData();
      }
      onClose();
    } catch (err: any) {
      alert("Failed to update lesson: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-[#E3DFD7] overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-[#14231b] text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2D8B5C] flex items-center justify-center text-white">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm sm:text-base">
                  Edit Academic Lesson & Safety Record
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#2D8B5C] text-white">
                  {userRole} Override
                </span>
              </div>
              <p className="text-[11px] text-[#9cb4a6] mt-0.5">
                Student: <strong>{lesson.studentName}</strong> ({lesson.studentId}) • Tutor: <strong>{lesson.tutorId}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Quick Row: Date, Lesson Type, Attendance */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#161F1A] mb-1">Lesson Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full text-xs border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white font-mono focus:outline-none focus:border-[#2D8B5C]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#161F1A] mb-1">Lesson Type</label>
              <select
                value={lessonType}
                onChange={(e) => setLessonType(e.target.value as any)}
                className="w-full text-xs border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-[#2D8B5C]"
              >
                <option value="Quran Reading / Nazra">Quran Reading / Nazra</option>
                <option value="Noorani Qaida">Noorani Qaida</option>
                <option value="Hifz">Hifz (Quran Memorization)</option>
                <option value="Tajweed & Tarteel">Tajweed & Tarteel</option>
                <option value="Islamic Studies">Islamic Studies / Duas Only (No Qaida/Quran Read)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#161F1A] mb-1">Attendance Status</label>
              <select
                value={attendanceStatus}
                onChange={(e) => setAttendanceStatus(e.target.value as any)}
                className="w-full text-xs border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white font-bold focus:outline-none focus:border-[#2D8B5C]"
              >
                <option value="Present">Present</option>
                <option value="Late">Late</option>
                <option value="Absent">Absent</option>
                <option value="Make-up">Make-up</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {attendanceStatus === 'Late' && (
            <div>
              <label className="block text-xs font-bold text-amber-800 mb-1">Minutes Late</label>
              <input
                type="number"
                min={1}
                max={120}
                value={lateMinutes}
                onChange={(e) => setLateMinutes(Number(e.target.value))}
                className="w-full text-xs border border-amber-300 rounded-lg px-2.5 py-1.5 bg-amber-50/40"
              />
            </div>
          )}

          {attendanceStatus === 'Absent' && (
            <div>
              <label className="block text-xs font-bold text-rose-800 mb-1">Reason for Absence</label>
              <input
                type="text"
                value={absentReason}
                onChange={(e) => setAbsentReason(e.target.value)}
                placeholder="e.g., Illness, family emergency, travel"
                className="w-full text-xs border border-rose-300 rounded-lg px-2.5 py-1.5 bg-rose-50/40"
              />
            </div>
          )}

          {attendanceStatus !== 'Absent' && (
            <>
              {/* Portion Recited / Covered */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#161F1A] mb-1">
                    Lesson Covered / Portion Recited
                  </label>
                  <input
                    type="text"
                    value={lessonCovered}
                    onChange={(e) => setLessonCovered(e.target.value)}
                    required
                    placeholder="e.g. Surah Al-Baqarah Ayah 255-257 or Qaida Page 6 Line 1-4"
                    className="w-full text-xs border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-[#2D8B5C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#161F1A] mb-1">Mushaf Page #</label>
                  <input
                    type="text"
                    value={mushafPage}
                    onChange={(e) => setMushafPage(e.target.value)}
                    placeholder="e.g. 42"
                    className="w-full text-xs border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-[#2D8B5C]"
                  />
                </div>
              </div>

              {/* Memorization & Adaab */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#B87314] mb-1">
                    Memorization / Kalimas / Duas
                  </label>
                  <input
                    type="text"
                    value={memorization}
                    onChange={(e) => setMemorization(e.target.value)}
                    placeholder="e.g. 3rd Kalima, Dua before sleep"
                    className="w-full text-xs border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-[#2D8B5C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#2D8B5C] mb-1">
                    Adaab, Akhlaaq & Manners
                  </label>
                  <input
                    type="text"
                    value={adaabManners}
                    onChange={(e) => setAdaabManners(e.target.value)}
                    placeholder="e.g. Etiquettes of greeting, respecting parents"
                    className="w-full text-xs border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-[#2D8B5C]"
                  />
                </div>
              </div>

              {/* Revision & Homework */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#161F1A] mb-1">Revision (Sabaq)</label>
                  <input
                    type="text"
                    value={revision}
                    onChange={(e) => setRevision(e.target.value)}
                    placeholder="Previous lesson revision details"
                    className="w-full text-xs border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-[#2D8B5C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#161F1A] mb-1">Homework</label>
                  <input
                    type="text"
                    value={homework}
                    onChange={(e) => setHomework(e.target.value)}
                    placeholder="Daily practice assignment"
                    className="w-full text-xs border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-[#2D8B5C]"
                  />
                </div>
              </div>

              {/* Performance & Remarks */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#161F1A] mb-1">Performance Rating</label>
                  <select
                    value={performance}
                    onChange={(e) => setPerformance(e.target.value as any)}
                    className="w-full text-xs border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white font-semibold focus:outline-none focus:border-[#2D8B5C]"
                  >
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Average">Average</option>
                    <option value="Needs Improvement">Needs Improvement</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#161F1A] mb-1">Teacher Remarks / Notes</label>
                  <input
                    type="text"
                    value={teacherRemarks}
                    onChange={(e) => setTeacherRemarks(e.target.value)}
                    placeholder="Tutor evaluation remarks"
                    className="w-full text-xs border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-[#2D8B5C]"
                  />
                </div>
              </div>
            </>
          )}

          {/* Safety & Security Inspection (Supervisor & Admin Focus) */}
          <div className="bg-[#FAF9F7] p-4 rounded-xl border border-[#E3DFD7] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#161F1A] flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-[#2D8B5C]" />
                <span>Safety & Security Check (Child Protection & Audio/Video Environment)</span>
              </label>
              <span className="text-[10px] text-[#5A6B61] font-semibold">Supervisor / Admin Authority</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <select
                  value={safetyStatus}
                  onChange={(e) => setSafetyStatus(e.target.value as any)}
                  className="w-full text-xs border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white font-bold text-[#1E5C3D]"
                >
                  <option value="Audited">Audited & Approved</option>
                  <option value="Safe">Safe Environment</option>
                  <option value="Flagged">Flagged for Review</option>
                  <option value="Pending Review">Pending Audit</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <input
                  type="text"
                  value={safetyNotes}
                  onChange={(e) => setSafetyNotes(e.target.value)}
                  placeholder="Supervisor safety verification notes (e.g., 'Zoom call audited, student safe')"
                  className="w-full text-xs border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white text-xs"
                />
              </div>
            </div>
          </div>

          {/* Material Screenshots Management Shortcut */}
          <div className="bg-[#E8F5EE]/60 p-3.5 rounded-xl border border-[#C2E3D0] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <FileImage className="w-4 h-4 text-[#2D8B5C]" />
              <div>
                <span className="text-xs font-bold text-[#1E5C3D] block">
                  Lesson Material & Screenshots ({lesson.screenshots?.length || 0} attached)
                </span>
                <span className="text-[10px] text-[#5A6B61]">
                  Replace poor quality screenshots, upload clean Mushaf scans, or delete wrong entries
                </span>
              </div>
            </div>
            {onOpenMaterialModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMaterialModal(lesson);
                }}
                className="px-3 py-1.5 bg-[#2D8B5C] text-white text-xs font-bold rounded-lg hover:bg-[#1E5C3D] flex items-center space-x-1 cursor-pointer"
              >
                <span>Edit Screenshots / Material</span>
              </button>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E3DFD7]">
            <span className="text-[11px] text-[#5A6B61]">
              Changes apply instantly across student reports, parent view, and spreadsheet ledgers.
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[#5A6B61] hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 text-xs font-bold text-white bg-[#2D8B5C] hover:bg-[#1E5C3D] rounded-lg shadow-sm flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Save Lesson Overwrite</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
