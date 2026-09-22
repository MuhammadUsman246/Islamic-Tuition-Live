import React, { useState, useMemo } from 'react';
import {
  X,
  Calendar,
  BookOpen,
  CheckCircle2,
  Clock,
  UserX,
  Sparkles,
  FileText,
  Search,
  Filter,
  Eye,
  ChevronRight,
  Award,
  Image as ImageIcon,
  HeartHandshake,
  Bookmark,
  Layers
} from 'lucide-react';
import { Student, Lesson, CourseType } from '../../types';

interface StudentMonthReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  lessons: Lesson[];
  onOpenLogLesson?: (studentId: string) => void;
}

export const StudentMonthReportModal: React.FC<StudentMonthReportModalProps> = ({
  isOpen,
  onClose,
  student,
  lessons,
  onOpenLogLesson
}) => {
  const [timeFilter, setTimeFilter] = useState<'30' | '14' | '60' | 'all'>('30');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedLessonForDetail, setSelectedLessonForDetail] = useState<Lesson | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Filter lessons for this specific student within selected time range
  const studentLessons = useMemo(() => {
    if (!student) return [];

    const now = new Date();
    let cutoffDate: Date | null = null;

    if (timeFilter === '14') {
      cutoffDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    } else if (timeFilter === '30') {
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (timeFilter === '60') {
      cutoffDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    }

    return lessons
      .filter(l => l.studentId === student.studentId)
      .filter(l => {
        if (!cutoffDate) return true;
        const lessonDate = new Date(l.date);
        return lessonDate >= cutoffDate;
      })
      .filter(l => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        return (
          l.date.toLowerCase().includes(term) ||
          l.lessonCovered?.toLowerCase().includes(term) ||
          l.quranDetails?.surahName?.toLowerCase().includes(term) ||
          l.qaidaDetails?.lessonName?.toLowerCase().includes(term) ||
          l.memorization?.toLowerCase().includes(term) ||
          l.adaabManners?.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [student, lessons, timeFilter, searchTerm]);

  // Statistics calculation for the last 30 days
  const stats = useMemo(() => {
    const total = studentLessons.length;
    const presentCount = studentLessons.filter(l => l.attendanceStatus === 'Present' || !l.attendanceStatus).length;
    const lateCount = studentLessons.filter(l => l.attendanceStatus === 'Late').length;
    const absentCount = studentLessons.filter(l => l.attendanceStatus === 'Absent').length;
    const attendanceRate = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 100;

    // Latest active lesson
    const latestLesson = studentLessons.find(l => l.attendanceStatus !== 'Absent');

    return {
      total,
      presentCount,
      lateCount,
      absentCount,
      attendanceRate,
      latestLesson
    };
  }, [studentLessons]);

  if (!isOpen || !student) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#EAE6DE] overflow-hidden">
        
        {/* Header Section */}
        <div className="bg-[#1E5C3D] text-white px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center text-white border border-white/20 font-bold text-lg">
              {student.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold tracking-tight text-white">{student.name}</h3>
                <span className="px-2 py-0.5 rounded-full bg-[#E8A93E] text-white text-[10px] font-bold">
                  {student.studentId}
                </span>
              </div>
              <p className="text-xs text-emerald-200 mt-0.5 flex items-center gap-1.5">
                <span>Course: <strong className="text-white">{student.courseType || 'Quran Reading'}</strong></span>
                <span>•</span>
                <span>30-Day Progression Report</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onOpenLogLesson && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLogLesson(student.studentId);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-white text-[#1E5C3D] hover:bg-emerald-50 text-xs font-semibold transition-colors flex items-center space-x-1.5 shadow-xs"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#2D8B5C]" />
                <span>+ Log Lesson</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Summary Bar */}
        <div className="bg-[#F8F6F0] border-b border-[#EAE6DE] px-6 py-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0 text-xs">
          <div className="bg-white p-2.5 rounded-xl border border-[#E0DACB] flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-[#2D8B5C]">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-medium">Logged Sessions</p>
              <p className="text-sm font-bold text-[#1E5C3D]">{stats.total} Classes</p>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-[#E0DACB] flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-medium">Attendance Rate</p>
              <p className="text-sm font-bold text-emerald-800">{stats.attendanceRate}%</p>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-[#E0DACB] flex items-center space-x-3 col-span-2 sm:col-span-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-[#E8A93E] shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <p className="text-[10px] text-gray-500 font-medium">Latest Sabaq / Lesson Reached</p>
              <p className="text-xs font-semibold text-gray-800 truncate">
                {stats.latestLesson?.lessonCovered || 'No recent lesson recorded'}
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="px-6 py-3 border-b border-[#EAE6DE] bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-1.5 bg-[#F0ECE1] p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setTimeFilter('14')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                timeFilter === '14' ? 'bg-[#1E5C3D] text-white font-bold shadow-2xs' : 'text-[#5A6B61] hover:text-gray-900'
              }`}
            >
              14 Days
            </button>
            <button
              onClick={() => setTimeFilter('30')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                timeFilter === '30' ? 'bg-[#1E5C3D] text-white font-bold shadow-2xs' : 'text-[#5A6B61] hover:text-gray-900'
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setTimeFilter('60')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                timeFilter === '60' ? 'bg-[#1E5C3D] text-white font-bold shadow-2xs' : 'text-[#5A6B61] hover:text-gray-900'
              }`}
            >
              60 Days
            </button>
            <button
              onClick={() => setTimeFilter('all')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                timeFilter === 'all' ? 'bg-[#1E5C3D] text-white font-bold shadow-2xs' : 'text-[#5A6B61] hover:text-gray-900'
              }`}
            >
              All History
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search Surah, Juz, Qaida, Notes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#F8F6F0] border border-[#E0DACB] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#2D8B5C]"
            />
          </div>
        </div>

        {/* Row-Based Lesson History List */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3 bg-[#FAF8F5]">
          {studentLessons.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-[#EAE6DE] p-6 space-y-2">
              <BookOpen className="w-10 h-10 text-gray-300 mx-auto" />
              <p className="text-sm font-semibold text-gray-600">No lesson reports found for this timeframe</p>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                No recorded sessions match the selected filter. Click "Log Lesson" above to record today's session.
              </p>
            </div>
          ) : (
            studentLessons.map((lesson, idx) => {
              const isAbsent = lesson.attendanceStatus === 'Absent';
              const isLate = lesson.attendanceStatus === 'Late';

              return (
                <div
                  key={lesson.id || idx}
                  onClick={() => setSelectedLessonForDetail(lesson)}
                  className="bg-white rounded-2xl p-4 border border-[#EAE6DE] hover:border-[#2D8B5C] hover:shadow-md transition-all cursor-pointer group space-y-3"
                >
                  {/* Top Bar of Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0ECE1] pb-2.5">
                    <div className="flex items-center space-x-2.5">
                      <span className="px-2.5 py-1 rounded-lg bg-[#F0ECE1] text-[#1E5C3D] font-bold text-xs flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{lesson.date}</span>
                      </span>

                      {/* Attendance Status Badge */}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center space-x-1 ${
                          isAbsent
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : isLate
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {isAbsent ? (
                          <>
                            <UserX className="w-3 h-3" />
                            <span>Absent</span>
                          </>
                        ) : isLate ? (
                          <>
                            <Clock className="w-3 h-3" />
                            <span>Late ({lesson.lateMinutes || 10}m)</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Present</span>
                          </>
                        )}
                      </span>

                      {lesson.lessonType && (
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-medium">
                          {lesson.lessonType}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-gray-400 group-hover:text-[#2D8B5C] font-semibold flex items-center space-x-1">
                      <span>View Full Details</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                  {/* Main Content Grid of Row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    {/* Column 1: Main Portion Taught */}
                    <div className="bg-[#F9F8F5] p-3 rounded-xl border border-[#EAE6DE] space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E5C3D] flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-[#2D8B5C]" /> Lesson / Sabaq Taught
                      </span>
                      {lesson.quranDetails ? (
                        <div className="space-y-0.5">
                          <p className="font-bold text-gray-900 text-xs">
                            Juz {lesson.quranDetails.juz} • Surah {lesson.quranDetails.surahName} (#{lesson.quranDetails.surahNumber})
                          </p>
                          <p className="text-[#2D8B5C] font-medium">
                            Ayahs {lesson.quranDetails.ayahStart} – {lesson.quranDetails.ayahEnd}
                            {lesson.quranDetails.mushafPage ? ` (Page ${lesson.quranDetails.mushafPage})` : ''}
                          </p>
                        </div>
                      ) : lesson.qaidaDetails ? (
                        <div className="space-y-0.5">
                          <p className="font-bold text-gray-900 text-xs">
                            Qaida Page {lesson.qaidaDetails.pageNumber}: {lesson.qaidaDetails.lessonName}
                          </p>
                          <p className="text-emerald-700 font-medium">
                            {lesson.qaidaDetails.lessonSection} ({lesson.qaidaDetails.exerciseLine})
                          </p>
                        </div>
                      ) : (
                        <p className="font-medium text-gray-800">
                          {lesson.lessonCovered || (isAbsent ? 'Class Absent' : 'General Session')}
                        </p>
                      )}
                    </div>

                    {/* Column 2: Memorization & Kalima / Duas */}
                    <div className="bg-[#F9F8F5] p-3 rounded-xl border border-[#EAE6DE] space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#E8A93E] flex items-center gap-1">
                        <Bookmark className="w-3 h-3" /> Memorization / Kalima / Duas
                      </span>
                      <p className="text-gray-700 font-medium line-clamp-2">
                        {lesson.memorization || 'Standard Daily Duas & Kalimas'}
                      </p>
                    </div>

                    {/* Column 3: Adaab, Akhlaaq & Attachments */}
                    <div className="bg-[#F9F8F5] p-3 rounded-xl border border-[#EAE6DE] space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                        <HeartHandshake className="w-3 h-3 text-[#2D8B5C]" /> Adaab & Manners
                      </span>
                      <p className="text-gray-700 font-medium line-clamp-1">
                        {lesson.adaabManners || 'Respectful & Attentive in Class'}
                      </p>

                      {/* Attachment Thumbnails */}
                      {lesson.screenshots && lesson.screenshots.length > 0 && (
                        <div className="flex items-center space-x-1.5 pt-1">
                          {lesson.screenshots.map((s, i) => (
                            <img
                              key={i}
                              src={s.url}
                              alt={`Lesson artifact ${i}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewImage(s.url);
                              }}
                              className="w-7 h-7 object-cover rounded-md border border-gray-200 hover:opacity-80 transition-opacity"
                            />
                          ))}
                          <span className="text-[10px] text-gray-400 font-semibold">
                            {lesson.screenshots.length} image(s)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Bar */}
        <div className="bg-white border-t border-[#EAE6DE] px-6 py-3 flex items-center justify-between text-xs text-gray-500 shrink-0">
          <span>Showing {studentLessons.length} report entries for {student.name}</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition-colors"
          >
            Close Report
          </button>
        </div>
      </div>

      {/* Row Click Expanded Full Detail Modal */}
      {selectedLessonForDetail && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 border border-[#EAE6DE] max-h-[88vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F0ECE1] pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#2D8B5C] tracking-wider">Detailed Lesson Report</span>
                <h4 className="text-base font-bold text-gray-900">
                  {student.name} — {selectedLessonForDetail.date}
                </h4>
              </div>
              <button
                onClick={() => setSelectedLessonForDetail(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-[#F8F6F0] p-3 rounded-2xl border border-[#E0DACB]">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">Attendance</span>
                  <p className="font-bold text-gray-800">{selectedLessonForDetail.attendanceStatus || 'Present'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">Course Type</span>
                  <p className="font-bold text-gray-800">{selectedLessonForDetail.lessonType || 'Quran Reading'}</p>
                </div>
              </div>

              <div className="bg-[#F9F8F5] p-3.5 rounded-2xl border border-[#EAE6DE] space-y-1">
                <span className="text-[10px] font-bold text-[#1E5C3D] uppercase">Sabaq / Lesson Covered</span>
                <p className="text-sm font-semibold text-gray-900">{selectedLessonForDetail.lessonCovered || 'N/A'}</p>
                {selectedLessonForDetail.quranDetails && (
                  <p className="text-xs text-[#2D8B5C]">
                    Juz {selectedLessonForDetail.quranDetails.juz}, Surah {selectedLessonForDetail.quranDetails.surahName} (#{selectedLessonForDetail.quranDetails.surahNumber}), Ayahs {selectedLessonForDetail.quranDetails.ayahStart}-{selectedLessonForDetail.quranDetails.ayahEnd}
                  </p>
                )}
                {selectedLessonForDetail.qaidaDetails && (
                  <p className="text-xs text-emerald-800">
                    Page {selectedLessonForDetail.qaidaDetails.pageNumber}: {selectedLessonForDetail.qaidaDetails.lessonName} ({selectedLessonForDetail.qaidaDetails.exerciseLine})
                  </p>
                )}
              </div>

              {selectedLessonForDetail.memorization && (
                <div className="bg-[#F9F8F5] p-3.5 rounded-2xl border border-[#EAE6DE] space-y-1">
                  <span className="text-[10px] font-bold text-[#E8A93E] uppercase">Memorization / Kalima / Duas</span>
                  <p className="text-gray-800">{selectedLessonForDetail.memorization}</p>
                </div>
              )}

              {selectedLessonForDetail.adaabManners && (
                <div className="bg-[#F9F8F5] p-3.5 rounded-2xl border border-[#EAE6DE] space-y-1">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase">Adaab, Akhlaaq & Manners</span>
                  <p className="text-gray-800">{selectedLessonForDetail.adaabManners}</p>
                </div>
              )}

              {selectedLessonForDetail.revision && (
                <div className="bg-[#F9F8F5] p-3.5 rounded-2xl border border-[#EAE6DE] space-y-1">
                  <span className="text-[10px] font-bold text-gray-600 uppercase">Revision / Sabaqi / Manzil</span>
                  <p className="text-gray-800">{selectedLessonForDetail.revision}</p>
                </div>
              )}

              {/* Screenshots Display */}
              {selectedLessonForDetail.screenshots && selectedLessonForDetail.screenshots.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Lesson Artifact Screenshots</span>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedLessonForDetail.screenshots.map((img, i) => (
                      <img
                        key={i}
                        src={img.url}
                        alt={`Screenshot ${i+1}`}
                        onClick={() => setPreviewImage(img.url)}
                        className="w-full h-24 object-cover rounded-xl border border-gray-200 hover:scale-105 transition-transform cursor-pointer"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLessonForDetail(null)}
                className="px-5 py-2 rounded-xl bg-[#1E5C3D] text-white font-semibold text-xs"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox Preview */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-70 bg-black/85 flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in"
        >
          <img src={previewImage} alt="Enlarged preview" className="max-w-full max-h-[90vh] object-contain rounded-2xl" />
        </div>
      )}
    </div>
  );
};
