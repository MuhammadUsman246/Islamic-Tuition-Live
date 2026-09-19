import React, { useState, useEffect, useMemo } from 'react';
import { X, CheckCircle, BookOpen, AlertCircle, Info, Clock, UserX, UserCheck, Sparkles, HeartHandshake, Bookmark, Camera, Paperclip, UploadCloud, Trash2, Image as ImageIcon, FileSpreadsheet } from 'lucide-react';
import { Lesson, Student, CourseType, AttendanceStatus } from '../../types';
import { JUZ_MAPPINGS, getSurahsForJuz, getAyahRangeForSurahInJuz, validateQuranSelection } from '../../data/quranData';
import {
  NORANI_QAIDA_STRUCTURE,
  getLessonsForPage,
  getSectionsForLesson,
  getLinesForSection
} from '../../data/qaidaData';
import { getLessons } from '../../services/dataService';
import { compressAndConvertToWebP } from '../../utils/chatMediaUtils';

interface LessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (lessonData: Omit<Lesson, 'id'>) => Promise<void>;
  students: Student[];
  currentTutorId?: string;
  initialStudentId?: string;
}

export const LessonModal: React.FC<LessonModalProps> = ({
  isOpen,
  onClose,
  onSave,
  students,
  currentTutorId,
  initialStudentId
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId || '');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [lessonType, setLessonType] = useState<CourseType>('Quran Reading / Nazra');

  // Attendance Status State
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>('Present');
  const [lateMinutes, setLateMinutes] = useState<number>(10);
  const [absentReason, setAbsentReason] = useState<string>('');

  // Quran Selection State - Requires active selection
  const [juz, setJuz] = useState<number | ''>('');
  const [surahNumber, setSurahNumber] = useState<number | ''>('');
  const [ayahStart, setAyahStart] = useState<number | ''>('');
  const [ayahEnd, setAyahEnd] = useState<number | ''>('');
  const [mushafPage, setMushafPage] = useState<string>('');
  const [quranError, setQuranError] = useState<string | null>(null);

  // Norani Qaida Cascading Selection State: Page → Lesson → Section → Line
  const qaidaName = 'Norani Qaida';
  const [qaidaPage, setQaidaPage] = useState<number>(2);
  const [qaidaLessonName, setQaidaLessonName] = useState<string>('Lesson 1: THE ALPHABETS');
  const [qaidaSection, setQaidaSection] = useState<string>('Main');
  const [qaidaLine, setQaidaLine] = useState<string>('Lines 1-6');

  // Memorization & Adaab Fields (Required)
  const [memorization, setMemorization] = useState<string>('');
  const [adaabManners, setAdaabManners] = useState<string>('');

  // Core Lesson Fields
  const [lessonCovered, setLessonCovered] = useState<string>('');
  const [revision, setRevision] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Screenshots and Clipboard/Paste State
  const [screenshots, setScreenshots] = useState<{ url: string; name: string; size: number }[]>([]);
  const [compressing, setCompressing] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);

  // Last Lesson Auto-Fill Context
  const [lastLesson, setLastLesson] = useState<Lesson | null>(null);
  const [autoFilledNotice, setAutoFilledNotice] = useState<string | null>(null);

  // All lessons to feed into the Google Sheet Monthly Progression view
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);

  const selectedStudent = useMemo(() => {
    return students.find(s => s.studentId === selectedStudentId) || null;
  }, [students, selectedStudentId]);

  // Prepopulate or update student & find last lesson
  useEffect(() => {
    let activeId = selectedStudentId;
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
      activeId = initialStudentId;
    } else if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0].studentId);
      activeId = students[0].studentId;
    }

    if (activeId) {
      const st = students.find(s => s.studentId === activeId);
      if (st) {
        if (st.courseType === 'Noorani Qaida') {
          setLessonType('Noorani Qaida');
        } else if (st.courseType === 'Hifz') {
          setLessonType('Hifz');
        } else {
          setLessonType('Quran Reading / Nazra');
        }
      }

      // Fetch student's last recorded lesson to suggest progression
      getLessons().then(lessons => {
        setAllLessons(lessons);
        const studentLessons = lessons
          .filter(l => l.studentId === activeId && l.attendanceStatus !== 'Absent')
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (studentLessons.length > 0) {
          const prev = studentLessons[0];
          setLastLesson(prev);
        } else {
          setLastLesson(null);
        }
      }).catch(console.error);
    }
  }, [initialStudentId, students, selectedStudentId]);

  // Qaida Cascading Dropdown Handlers
  const availableQaidaLessons = useMemo(() => getLessonsForPage(qaidaPage), [qaidaPage]);

  useEffect(() => {
    if (availableQaidaLessons.length > 0) {
      const exists = availableQaidaLessons.some(l => l.lessonName === qaidaLessonName);
      if (!exists) {
        setQaidaLessonName(availableQaidaLessons[0].lessonName);
      }
    }
  }, [qaidaPage, availableQaidaLessons, qaidaLessonName]);

  const availableQaidaSections = useMemo(() => {
    return getSectionsForLesson(qaidaPage, qaidaLessonName);
  }, [qaidaPage, qaidaLessonName]);

  useEffect(() => {
    if (availableQaidaSections.length > 0) {
      const exists = availableQaidaSections.some(s => s.sectionName === qaidaSection);
      if (!exists) {
        setQaidaSection(availableQaidaSections[0].sectionName);
      }
    }
  }, [qaidaLessonName, availableQaidaSections, qaidaSection]);

  const availableQaidaLines = useMemo(() => {
    return getLinesForSection(qaidaPage, qaidaLessonName, qaidaSection);
  }, [qaidaPage, qaidaLessonName, qaidaSection]);

  useEffect(() => {
    if (availableQaidaLines.length > 0) {
      const exists = availableQaidaLines.includes(qaidaLine);
      if (!exists) {
        setQaidaLine(availableQaidaLines[0]);
      }
    }
  }, [qaidaSection, availableQaidaLines, qaidaLine]);

  // Quick 1-click continue from previous lesson
  const applyContinueFromLastLesson = () => {
    if (!lastLesson) return;

    if (lastLesson.lessonType) {
      setLessonType(lastLesson.lessonType);
    }

    if (lastLesson.quranDetails) {
      setJuz(lastLesson.quranDetails.juz);
      setSurahNumber(lastLesson.quranDetails.surahNumber);
      const nextStart = lastLesson.quranDetails.ayahEnd + 1;
      setAyahStart(nextStart);
      setAyahEnd(nextStart + 5);
      if (lastLesson.mushafPage) {
        setMushafPage(String(lastLesson.mushafPage));
      }
      setRevision(`Surah ${lastLesson.quranDetails.surahName} (Ayahs ${lastLesson.quranDetails.ayahStart}-${lastLesson.quranDetails.ayahEnd})`);
      setAutoFilledNotice(`Loaded next Ayahs continuing from ${lastLesson.date}`);
    } else if (lastLesson.qaidaDetails) {
      setQaidaPage(lastLesson.qaidaDetails.pageNumber);
      if (lastLesson.qaidaDetails.lessonName) {
        setQaidaLessonName(lastLesson.qaidaDetails.lessonName);
      }
      setQaidaSection(lastLesson.qaidaDetails.lessonSection);
      setQaidaLine(lastLesson.qaidaDetails.exerciseLine);
      setRevision(`Qaida Page ${lastLesson.qaidaDetails.pageNumber}`);
      setAutoFilledNotice(`Loaded Qaida progress from ${lastLesson.date}`);
    }

    if (lastLesson.memorization) {
      setMemorization(lastLesson.memorization);
    }
    if (lastLesson.adaabManners) {
      setAdaabManners(lastLesson.adaabManners);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalPaste = async (e: ClipboardEvent) => {
      // Don't intercept paste inside standard text inputs
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && (activeEl.id !== 'screenshot-drop-area')) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            if (screenshots.length >= 3) {
              alert("Maximum of 3 screenshots can be uploaded per lesson.");
              return;
            }
            setCompressing(true);
            try {
              const result = await compressAndConvertToWebP(file);
              setScreenshots(prev => [...prev, { url: result.dataUrl, name: result.name, size: result.size }]);
            } catch (err: any) {
              alert("Compression failed: " + err.message);
            } finally {
              setCompressing(false);
            }
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [isOpen, screenshots.length]);

  // Update Surahs when Juz changes
  const availableSurahs = useMemo(() => {
    return typeof juz === 'number' ? getSurahsForJuz(juz) : [];
  }, [juz]);

  useEffect(() => {
    if (availableSurahs.length > 0) {
      if (typeof surahNumber === 'number') {
        const match = availableSurahs.find(s => s.number === surahNumber);
        if (!match) {
          setSurahNumber(availableSurahs[0].number);
        }
      } else {
        setSurahNumber(availableSurahs[0].number);
      }
    }
  }, [juz, availableSurahs, surahNumber]);

  // Update Ayah range when Surah or Juz changes
  const currentAyahRange = useMemo(() => {
    if (typeof juz === 'number' && typeof surahNumber === 'number') {
      return getAyahRangeForSurahInJuz(juz, surahNumber);
    }
    return null;
  }, [juz, surahNumber]);

  useEffect(() => {
    if (currentAyahRange && typeof juz === 'number' && typeof surahNumber === 'number') {
      if (typeof ayahStart !== 'number' || ayahStart < currentAyahRange.min || ayahStart > currentAyahRange.max) {
        setAyahStart(currentAyahRange.min);
      }
      if (typeof ayahEnd !== 'number' || ayahEnd < currentAyahRange.min || ayahEnd > currentAyahRange.max) {
        setAyahEnd(Math.min(currentAyahRange.min + 10, currentAyahRange.max));
      }
      setQuranError(null);
    }
  }, [juz, surahNumber, currentAyahRange, ayahStart, ayahEnd]);

  // Validate on ayah input change
  useEffect(() => {
    if (attendanceStatus === 'Absent') {
      setQuranError(null);
      return;
    }

    if (lessonType === 'Quran Reading / Nazra' || lessonType === 'Hifz') {
      if (typeof juz !== 'number' || typeof surahNumber !== 'number') {
        setQuranError(null);
        return;
      }
      if (typeof ayahStart === 'number' && typeof ayahEnd === 'number') {
        const val = validateQuranSelection(juz, surahNumber, ayahStart, ayahEnd);
        if (!val.valid) {
          setQuranError(val.error || 'Invalid Quran Ayah range for this Juz');
        } else {
          setQuranError(null);
        }
      }
    } else {
      setQuranError(null);
    }
  }, [juz, surahNumber, ayahStart, ayahEnd, lessonType, attendanceStatus]);

  if (!isOpen) return null;

  const currentStudent = students.find(s => s.studentId === selectedStudentId);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (!files) return;

    const filesArray = Array.from(files).filter((f: any) => f.type.startsWith('image/')) as File[];
    if (filesArray.length === 0) return;

    if (screenshots.length + filesArray.length > 3) {
      alert("You can upload a maximum of 3 screenshots per lesson.");
      return;
    }

    setCompressing(true);
    try {
      for (const file of filesArray) {
        const result = await compressAndConvertToWebP(file);
        setScreenshots(prev => [...prev, { url: result.dataUrl, name: result.name, size: result.size }]);
      }
    } catch (err: any) {
      alert("Compression failed: " + err.message);
    } finally {
      setCompressing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const filesArray = Array.from(files) as File[];
    if (screenshots.length + filesArray.length > 3) {
      alert("You can upload a maximum of 3 screenshots per lesson.");
      return;
    }

    setCompressing(true);
    try {
      for (const file of filesArray) {
        const result = await compressAndConvertToWebP(file);
        setScreenshots(prev => [...prev, { url: result.dataUrl, name: result.name, size: result.size }]);
      }
    } catch (err: any) {
      alert("Compression failed: " + err.message);
    } finally {
      setCompressing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Auto calculate month label
    const dateObj = new Date(date);
    const month = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // IF ABSENT: Record absence only
    if (attendanceStatus === 'Absent') {
      setSaving(true);
      try {
        const absentSummary = absentReason.trim() ? `Absent (${absentReason.trim()})` : 'Absent';
        await onSave({
          studentId: selectedStudentId,
          studentName: currentStudent?.name || 'Student',
          tutorId: currentTutorId || currentStudent?.assignedTutorId || 'Tutor 1',
          date,
          month,
          lessonType,
          attendanceStatus: 'Absent',
          absentReason: absentReason.trim() || undefined,
          lessonCovered: absentSummary,
          revision: undefined,
          performance: undefined,
          createdAt: new Date().toISOString()
        });
        onClose();
      } catch (err: any) {
        alert("Failed to save absence: " + err.message);
      } finally {
        setSaving(false);
      }
      return;
    }

    // MANDATORY VALIDATIONS:
    if (!memorization.trim()) {
      alert("Please fill in the 'Memorization / Kalima / Duas / Ahadith' field (Required).");
      return;
    }

    if (!adaabManners.trim()) {
      alert("Please fill in the 'Adaab, Akhlaaq & Manners' field (Required).");
      return;
    }

    // Determine Quran / Qaida structured details
    let quranDetails = undefined;
    if (lessonType === 'Quran Reading / Nazra' || lessonType === 'Hifz') {
      if (typeof juz !== 'number' || typeof surahNumber !== 'number' || typeof ayahStart !== 'number' || typeof ayahEnd !== 'number') {
        setQuranError('Please select the specific Juz, Surah, and Ayah range taught today.');
        return;
      }
      const val = validateQuranSelection(juz, surahNumber, ayahStart, ayahEnd);
      if (!val.valid) {
        setQuranError(val.error || 'Please correct the Quran selection before saving');
        return;
      }
      const surahMeta = availableSurahs.find(s => s.number === surahNumber);
      quranDetails = {
        juz,
        surahNumber,
        surahName: surahMeta ? surahMeta.englishName : `Surah ${surahNumber}`,
        ayahStart,
        ayahEnd,
        mushafPage: mushafPage.trim() || undefined
      };
    }

    let qaidaDetails = undefined;
    if (lessonType === 'Noorani Qaida') {
      qaidaDetails = {
        qaidaName,
        pageNumber: qaidaPage,
        lessonName: qaidaLessonName,
        lessonSection: qaidaSection,
        exerciseLine: qaidaLine
      };
    }

    // Compose lessonCovered text
    let finalCovered = lessonCovered.trim();
    if (!finalCovered) {
      if (quranDetails) {
        const pageLabel = mushafPage.trim() ? ` (Page ${mushafPage.trim()})` : '';
        finalCovered = `Juz ${quranDetails.juz}, Surah ${quranDetails.surahName} (Ayahs ${quranDetails.ayahStart}-${quranDetails.ayahEnd})${pageLabel}`;
      } else if (qaidaDetails) {
        finalCovered = `Qaida Page ${qaidaDetails.pageNumber}: ${qaidaDetails.lessonName} - ${qaidaDetails.lessonSection} (${qaidaDetails.exerciseLine})`;
      } else {
        finalCovered = `${lessonType} lesson covered`;
      }
    }

    setSaving(true);
    try {
      await onSave({
        studentId: selectedStudentId,
        studentName: currentStudent?.name || 'Student',
        tutorId: currentTutorId || currentStudent?.assignedTutorId || 'Tutor 1',
        date,
        month,
        lessonType,
        attendanceStatus,
        lateMinutes: attendanceStatus === 'Late' ? (Number(lateMinutes) || 10) : undefined,
        mushafPage: mushafPage.trim() || undefined,
        memorization: memorization.trim(),
        adaabManners: adaabManners.trim(),
        quranDetails,
        qaidaDetails,
        lessonCovered: finalCovered,
        revision: revision.trim() || undefined,
        screenshots: screenshots.map(s => ({
          url: s.url,
          name: s.name,
          size: s.size,
          uploadedAt: new Date().toISOString(),
          expired: false
        })),
        createdAt: new Date().toISOString()
      });
      onClose();
    } catch (err: any) {
      alert("Failed to save lesson: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl border border-[#E3DFD7] overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-[#2D8B5C] text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-[#E8A93E]" />
            <h3 className="font-bold text-base">Record Lesson & Attendance Report</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Top Row: Student, Date & Lesson Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Student <span className="text-red-500">*</span>
              </label>
              <select
                id="lesson_student_select"
                value={selectedStudentId}
                onChange={(e) => {
                  setSelectedStudentId(e.target.value);
                  const st = students.find(s => s.studentId === e.target.value);
                  if (st) {
                    if (st.courseType === 'Noorani Qaida') setLessonType('Noorani Qaida');
                    else if (st.courseType === 'Hifz') setLessonType('Hifz');
                    else setLessonType('Quran Reading / Nazra');
                  }
                }}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none bg-white font-medium"
                required
              >
                {students.map(st => (
                  <option key={st.studentId} value={st.studentId}>
                    {st.name} ({st.studentId}) {st.status === 'Trial' ? '• Trial' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                id="lesson_date_input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Core Lesson Type <span className="text-red-500">*</span>
              </label>
              <select
                id="lesson_type_select"
                value={lessonType}
                onChange={(e) => setLessonType(e.target.value as CourseType)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none bg-white font-medium"
              >
                <option value="Noorani Qaida">Qaida</option>
                <option value="Quran Reading / Nazra">Quran Reading</option>
                <option value="Hifz">Quran Memorization</option>
              </select>
            </div>
          </div>

          {/* Quick Continue from Last Lesson Banner */}
          {lastLesson && attendanceStatus !== 'Absent' && (
            <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-start space-x-2">
                <Bookmark className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[#166534] block">
                    Last Lesson ({lastLesson.date}): {lastLesson.lessonCovered}
                    {lastLesson.mushafPage ? ` • Page ${lastLesson.mushafPage}` : ''}
                  </span>
                  <span className="text-[11px] text-[#15803D]">
                    {lastLesson.memorization ? `Memorization: ${lastLesson.memorization} | ` : ''}
                    {lastLesson.adaabManners ? `Adaab: ${lastLesson.adaabManners}` : ''}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={applyContinueFromLastLesson}
                className="px-3 py-1.5 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-lg text-xs font-bold shrink-0 shadow-xs flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Continue Next</span>
              </button>
            </div>
          )}

          {autoFilledNotice && (
            <div className="text-[11px] text-emerald-700 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200 font-medium">
              ⚡ {autoFilledNotice}
            </div>
          )}

          {/* ATTENDANCE STATUS SELECTOR ON TOP */}
          <div className="bg-[#FAF9F7] p-3.5 rounded-xl border border-[#E3DFD7] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#161F1A] flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-[#2D8B5C]" />
                Attendance Status
              </label>
              <span className="text-[11px] text-[#5A6B61]">
                Mark whether the student attended or was absent
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                id="attendance_status_present_btn"
                onClick={() => setAttendanceStatus('Present')}
                className={`flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  attendanceStatus === 'Present'
                    ? 'bg-[#E8F5EE] border-[#2D8B5C] text-[#1E5C3D] shadow-xs ring-1 ring-[#2D8B5C]'
                    : 'bg-white border-[#D5D0C6] text-[#5A6B61] hover:bg-gray-50'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5 text-[#2D8B5C]" />
                <span>Present</span>
              </button>

              <button
                type="button"
                id="attendance_status_late_btn"
                onClick={() => setAttendanceStatus('Late')}
                className={`flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  attendanceStatus === 'Late'
                    ? 'bg-[#FEF3E2] border-[#E8A93E] text-[#B87314] shadow-xs ring-1 ring-[#E8A93E]'
                    : 'bg-white border-[#D5D0C6] text-[#5A6B61] hover:bg-gray-50'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-[#E8A93E]" />
                <span>Late</span>
              </button>

              <button
                type="button"
                id="attendance_status_absent_btn"
                onClick={() => setAttendanceStatus('Absent')}
                className={`flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  attendanceStatus === 'Absent'
                    ? 'bg-[#FDE8E8] border-[#E02424] text-[#9B1C1C] shadow-xs ring-1 ring-[#E02424]'
                    : 'bg-white border-[#D5D0C6] text-[#5A6B61] hover:bg-gray-50'
                }`}
              >
                <UserX className="w-3.5 h-3.5 text-[#E02424]" />
                <span>Absent</span>
              </button>
            </div>

            {/* IF LATE: Show Minutes Late selector & input */}
            {attendanceStatus === 'Late' && (
              <div className="pt-2.5 border-t border-[#E3DFD7] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#B87314]" />
                  <span className="text-xs font-semibold text-[#B87314]">How many minutes late?</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[5, 10, 15, 20, 30].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setLateMinutes(mins)}
                      className={`px-2.5 py-1 text-xs rounded-md border font-medium cursor-pointer transition-colors ${
                        lateMinutes === mins
                          ? 'bg-[#E8A93E] text-white border-[#E8A93E]'
                          : 'bg-white text-[#5A6B61] border-[#D5D0C6] hover:bg-gray-50'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                  <div className="flex items-center space-x-1 ml-1">
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={lateMinutes}
                      onChange={(e) => setLateMinutes(parseInt(e.target.value, 10) || 1)}
                      className="w-16 border border-[#D5D0C6] rounded-md px-2 py-1 text-xs text-center font-bold text-[#161F1A] bg-white focus:outline-none focus:border-[#E8A93E]"
                    />
                    <span className="text-xs text-[#5A6B61]">mins</span>
                  </div>
                </div>
              </div>
            )}

            {/* IF ABSENT: Explanatory banner & optional reason note */}
            {attendanceStatus === 'Absent' && (
              <div className="pt-2.5 border-t border-[#E3DFD7] space-y-2.5">
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                  <div>
                    <span className="font-bold block">Student Marked as Absent</span>
                    <span className="text-[11px] text-red-600">
                      Lesson entry options are automatically hidden because no lesson took place. The absence will be recorded in student history and parent reports.
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">
                    Reason for Absence / Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={absentReason}
                    onChange={(e) => setAbsentReason(e.target.value)}
                    placeholder="e.g. Uninformed absence, sick, family travel, power outage..."
                    className="w-full border border-[#D5D0C6] rounded-md px-3 py-1.5 text-xs focus:ring-1 focus:ring-red-400 focus:outline-none bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* LESSON REPORTING OPTIONS: Hidden if Student is Absent */}
          {attendanceStatus !== 'Absent' && (
            <>
              {/* Quran Selection with Active Selection + Validation + Custom Page Input */}
              {(lessonType === 'Quran Reading / Nazra' || lessonType === 'Hifz') && (
                <div className="p-3.5 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1E5C3D] uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-[#2D8B5C]" />
                      Quran Reading / Memorization Selection <span className="text-red-500">*</span>
                    </span>
                    {currentAyahRange && typeof juz === 'number' && (
                      <span className="text-[11px] font-medium text-[#2D8B5C] bg-[#E8F5EE] px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        Juz {juz} range: Ayah {currentAyahRange.min} - {currentAyahRange.max}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">
                        Juz (Para) <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={juz}
                        onChange={(e) => {
                          const val = e.target.value ? parseInt(e.target.value, 10) : '';
                          setJuz(val);
                        }}
                        className="w-full border border-[#D5D0C6] rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-[#2D8B5C] font-medium"
                        required
                      >
                        <option value="">-- Select Juz * --</option>
                        {JUZ_MAPPINGS.map(j => (
                          <option key={j.juzNumber} value={j.juzNumber}>
                            Juz {j.juzNumber} ({j.arabicName})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">
                        Surah <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={surahNumber}
                        disabled={typeof juz !== 'number'}
                        onChange={(e) => {
                          const val = e.target.value ? parseInt(e.target.value, 10) : '';
                          setSurahNumber(val);
                        }}
                        className="w-full border border-[#D5D0C6] rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-[#2D8B5C] font-medium disabled:bg-gray-100"
                        required
                      >
                        <option value="">{typeof juz !== 'number' ? '-- Select Juz First --' : '-- Select Surah * --'}</option>
                        {availableSurahs.map(s => (
                          <option key={s.number} value={s.number}>
                            {s.number}. {s.englishName} ({s.name})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">
                        From Ayah <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        placeholder="1"
                        value={ayahStart}
                        onChange={(e) => setAyahStart(e.target.value ? parseInt(e.target.value, 10) : '')}
                        className={`w-full border rounded-md px-2 py-1.5 text-xs focus:outline-none ${
                          quranError ? 'border-red-400 bg-red-50/40' : 'border-[#D5D0C6] focus:border-[#2D8B5C]'
                        }`}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">
                        To Ayah <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={typeof ayahStart === 'number' ? ayahStart : 1}
                        placeholder="7"
                        value={ayahEnd}
                        onChange={(e) => setAyahEnd(e.target.value ? parseInt(e.target.value, 10) : '')}
                        className={`w-full border rounded-md px-2 py-1.5 text-xs focus:outline-none ${
                          quranError ? 'border-red-400 bg-red-50/40' : 'border-[#D5D0C6] focus:border-[#2D8B5C]'
                        }`}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#1E5C3D] mb-1">
                        Page No. (Custom)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 52, 417"
                        value={mushafPage}
                        onChange={(e) => setMushafPage(e.target.value)}
                        className="w-full border border-[#D5D0C6] rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-[#2D8B5C] bg-white font-medium"
                      />
                    </div>
                  </div>

                  {quranError && (
                    <div className="flex items-center space-x-1.5 text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                      <span className="font-medium">{quranError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Norani Qaida Cascading Dropdowns: Page → Lesson → Section → Line */}
              {lessonType === 'Noorani Qaida' && (
                <div className="p-3.5 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1E5C3D] uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-[#2D8B5C]" />
                      Norani Qaida Selection (Page → Lesson → Section → Line) <span className="text-red-500">*</span>
                    </span>
                    <span className="text-[10px] text-[#5A6B61] bg-white px-2 py-0.5 rounded border border-[#D5D0C6]">
                      Canonically Validated
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* 1. Page */}
                    <div>
                      <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">
                        Page <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={qaidaPage}
                        onChange={(e) => setQaidaPage(parseInt(e.target.value, 10))}
                        className="w-full border border-[#D5D0C6] rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-[#2D8B5C] font-medium"
                        required
                      >
                        {NORANI_QAIDA_STRUCTURE.map(p => (
                          <option key={p.pageNumber} value={p.pageNumber}>
                            {p.pageLabel}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 2. Lesson */}
                    <div>
                      <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">
                        Lesson <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={qaidaLessonName}
                        onChange={(e) => setQaidaLessonName(e.target.value)}
                        className="w-full border border-[#D5D0C6] rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-[#2D8B5C] font-medium truncate"
                        required
                      >
                        {availableQaidaLessons.map(l => (
                          <option key={l.lessonName} value={l.lessonName}>
                            {l.lessonName}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 3. Section */}
                    <div>
                      <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">
                        Section <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={qaidaSection}
                        onChange={(e) => setQaidaSection(e.target.value)}
                        className="w-full border border-[#D5D0C6] rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-[#2D8B5C] font-medium"
                        required
                      >
                        {availableQaidaSections.map(s => (
                          <option key={s.sectionName} value={s.sectionName}>
                            {s.sectionName}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 4. Line */}
                    <div>
                      <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">
                        Line / Range <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={qaidaLine}
                        onChange={(e) => setQaidaLine(e.target.value)}
                        className="w-full border border-[#D5D0C6] rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-[#2D8B5C] font-medium"
                        required
                      >
                        {availableQaidaLines.map(line => (
                          <option key={line} value={line}>
                            {line}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* MEMORIZATION SECTION: Required Compact Input */}
              <div className="p-3.5 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7] space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#161F1A] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#E8A93E]" />
                    <span>Memorization / Kalima / Duas / Ahadith <span className="text-red-500">*</span></span>
                  </label>
                  <span className="text-[10px] font-semibold text-red-600">Required</span>
                </div>

                <input
                  type="text"
                  value={memorization}
                  onChange={(e) => setMemorization(e.target.value)}
                  placeholder="e.g. 4th Kalma, Dua e Qunoot, Salah steps, 40 Rabbana duas..."
                  className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none bg-white font-medium"
                  required
                />
              </div>

              {/* ADAAB & AKHLAAQ / ISLAMIC MANNERS: Required Compact Input */}
              <div className="p-3.5 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7] space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#161F1A] flex items-center gap-1.5">
                    <HeartHandshake className="w-3.5 h-3.5 text-[#2D8B5C]" />
                    <span>Adaab, Akhlaaq & Manners <span className="text-red-500">*</span></span>
                  </label>
                  <span className="text-[10px] font-semibold text-red-600">Required</span>
                </div>

                <input
                  type="text"
                  value={adaabManners}
                  onChange={(e) => setAdaabManners(e.target.value)}
                  placeholder="e.g. Manners of drinking, respect to parents, steps of wudu..."
                  className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none bg-white font-medium"
                  required
                />
              </div>

              {/* Lesson Covered & Revision */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                    Lesson Covered / Summary (Optional custom override)
                  </label>
                  <input
                    type="text"
                    value={lessonCovered}
                    onChange={(e) => setLessonCovered(e.target.value)}
                    placeholder="Auto-generated from Quran/Qaida selection if blank..."
                    className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                    Revision (Sabaq / Dhor)
                  </label>
                  <input
                    type="text"
                    value={revision}
                    onChange={(e) => setRevision(e.target.value)}
                    placeholder="e.g. Previous portions, Surah Al-Fatihah, or last 5 pages..."
                    className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none bg-white"
                  />
                </div>
              </div>

              {/* SCREENSHOT / FILE UPLOAD & Clipboard Paste */}
              <div className="p-3.5 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#161F1A] flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-[#2D8B5C]" />
                    <span>Lesson Page / Screenshots (Max 3)</span>
                  </label>
                  <span className="text-[10px] text-[#5A6B61]">
                    Auto-converted to WebP & compressed
                  </span>
                </div>

                {/* Drop/Paste Target Area Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Drop/Upload Area - 2 cols on md */}
                  <div
                    id="screenshot-drop-area"
                    tabIndex={0}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={`md:col-span-2 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-1 focus:outline-none focus:ring-1 focus:ring-[#2D8B5C] ${
                      dragOver
                        ? 'border-[#2D8B5C] bg-[#E8F5EE]'
                        : 'border-[#D5D0C6] hover:border-[#2D8B5C] hover:bg-[#FAF9F7]'
                    }`}
                    onClick={() => document.getElementById('screenshot-file-input')?.click()}
                  >
                    <input
                      id="screenshot-file-input"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <UploadCloud className="w-6 h-6 text-[#2D8B5C] animate-pulse" />
                    <p className="text-xs font-bold text-[#161F1A]">
                      Drag & Drop or Click to Upload
                    </p>
                    <p className="text-[10px] text-[#5A6B61]">
                      Select lesson page images/screenshots
                    </p>
                  </div>

                  {/* Easy Clipboard Paste Area - 1 col on md */}
                  <div className="bg-white border border-[#E3DFD7] rounded-xl p-3 flex flex-col justify-between space-y-2 shadow-sm">
                    <div>
                      <span className="text-[11px] font-bold text-[#1E5C3D] flex items-center gap-1">
                        📋 Quick Paste Box
                      </span>
                      <p className="text-[10px] text-[#5A6B61] leading-tight mt-1">
                        Click inside the input below and press <kbd className="bg-gray-100 px-1 py-0.5 rounded text-[9px] font-mono text-gray-700">Ctrl+V</kbd> to paste a screenshot instantly.
                      </p>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Click & Paste (Ctrl+V)"
                        className="w-full border border-[#D5D0C6] focus:border-[#2D8B5C] focus:ring-1 focus:ring-[#2D8B5C] rounded-lg px-2 py-2 text-xs bg-gray-50/70 focus:bg-white text-center font-bold placeholder:text-gray-400 placeholder:font-medium cursor-pointer outline-none transition-all"
                        onPaste={async (e) => {
                          const items = e.clipboardData?.items;
                          if (!items) return;
                          let imagePasted = false;
                          for (let i = 0; i < items.length; i++) {
                            const item = items[i];
                            if (item.type.indexOf('image') !== -1) {
                              const file = item.getAsFile();
                              if (file) {
                                e.preventDefault();
                                imagePasted = true;
                                if (screenshots.length >= 3) {
                                  alert("Maximum of 3 screenshots can be uploaded per lesson.");
                                  return;
                                }
                                setCompressing(true);
                                try {
                                  const result = await compressAndConvertToWebP(file);
                                  setScreenshots(prev => [...prev, { url: result.dataUrl, name: result.name, size: result.size }]);
                                } catch (err: any) {
                                  alert("Compression failed: " + err.message);
                                } finally {
                                  setCompressing(false);
                                }
                              }
                            }
                          }
                          if (imagePasted) {
                            e.preventDefault();
                          }
                          // Safely reset the input text
                          setTimeout(() => {
                            if (e.target) (e.target as HTMLInputElement).value = '';
                          }, 50);
                        }}
                        onChange={(e) => {
                          e.target.value = '';
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== 'v' || (!e.ctrlKey && !e.metaKey)) {
                            e.preventDefault();
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Loading / Compressing Status */}
                {compressing && (
                  <div className="flex items-center justify-center space-x-2 text-[11px] text-[#2D8B5C] font-semibold bg-[#E8F5EE] py-1 px-3 rounded-lg border border-emerald-100">
                    <div className="w-3.5 h-3.5 border-2 border-[#2D8B5C] border-t-transparent rounded-full animate-spin"></div>
                    <span>Optimizing & compressing image for storage...</span>
                  </div>
                )}

                {/* Screenshot Previews */}
                {screenshots.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 pt-1">
                    {screenshots.map((scr, idx) => (
                      <div key={idx} className="relative group rounded-lg overflow-hidden border border-[#D5D0C6] bg-white flex flex-col justify-between shadow-xs">
                        {/* Image Preview */}
                        <div className="relative aspect-video w-full bg-gray-50 flex items-center justify-center overflow-hidden">
                          <img
                            src={scr.url}
                            alt={scr.name}
                            referrerPolicy="no-referrer"
                            className="object-cover w-full h-full"
                          />
                        </div>
                        {/* Meta info */}
                        <div className="p-1.5 bg-[#FAF9F7] border-t border-[#EAE6DE] flex items-center justify-between gap-1 text-[10px]">
                          <span className="truncate font-medium text-[#161F1A] max-w-[70%]">
                            {scr.name}
                          </span>
                          <span className="text-[#5A6B61] shrink-0">
                            {Math.round(scr.size / 1024)} KB
                          </span>
                        </div>
                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setScreenshots(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="absolute top-1 right-1 p-1 bg-white/95 rounded-full hover:bg-red-50 text-[#5A6B61] hover:text-red-600 shadow-sm cursor-pointer transition-colors"
                          title="Remove screenshot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-[#E3DFD7] flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#5A6B61] hover:bg-gray-100 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="save_lesson_submit_button"
              type="submit"
              disabled={saving || (attendanceStatus !== 'Absent' && !!quranError)}
              className={`px-5 py-2.5 text-xs font-bold text-white rounded-lg shadow-xs flex items-center space-x-2 cursor-pointer transition-all ${
                attendanceStatus === 'Absent'
                  ? 'bg-[#E02424] hover:bg-[#C81E1E]'
                  : quranError || saving
                  ? 'bg-gray-400 cursor-not-allowed opacity-75'
                  : 'bg-[#2D8B5C] hover:bg-[#1E5C3D]'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              <span>
                {saving
                  ? 'Saving...'
                  : attendanceStatus === 'Absent'
                  ? 'Save Absent Report'
                  : 'Save Lesson Report'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
