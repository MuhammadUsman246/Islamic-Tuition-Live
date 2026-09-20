import React, { useState } from 'react';
import { X, CheckCircle, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { Student, Tutor, TimetableClass, DayOfWeek, CourseType } from '../../types';
import { addStudent, addClass } from '../../services/dataService';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  students: Student[];
  tutors: Tutor[];
}

interface ImportItem {
  name: string;
  tutorId: string;
  timePKT: string;
  isTrial: boolean;
  studentId: string;
  studentEmail: string;
  parentEmail: string;
  status: 'pending' | 'duplicate' | 'imported' | 'error';
}

const TUTOR_2_STUDENTS = [
  { name: 'Mouhammadou', tutorId: 'Tutor 2', timePKT: '01:00', isTrial: false },
  { name: 'Abdul', tutorId: 'Tutor 2', timePKT: '01:30', isTrial: false },
  { name: 'Laouratou', tutorId: 'Tutor 2', timePKT: '03:00', isTrial: false },
  { name: 'Mohammed', tutorId: 'Tutor 2', timePKT: '03:30', isTrial: false },
  { name: 'Salma', tutorId: 'Tutor 2', timePKT: '04:00', isTrial: false },
  { name: 'Ahmad', tutorId: 'Tutor 2', timePKT: '04:30', isTrial: false },
  { name: 'Abseen', tutorId: 'Tutor 2', timePKT: '05:00', isTrial: false },
  { name: 'Iman', tutorId: 'Tutor 2', timePKT: '06:00', isTrial: false },
  { name: 'Zainab', tutorId: 'Tutor 2', timePKT: '06:30', isTrial: false }
];

const TUTOR_3_STUDENTS = [
  { name: 'Idrissa', tutorId: 'Tutor 3', timePKT: '21:00', isTrial: false },
  { name: 'Bashir', tutorId: 'Tutor 3', timePKT: '21:30', isTrial: false },
  { name: 'Hawa', tutorId: 'Tutor 3', timePKT: '23:00', isTrial: false },
  { name: 'Marwa Yasir', tutorId: 'Tutor 3', timePKT: '23:30', isTrial: true },
  { name: 'Aswa Yasir', tutorId: 'Tutor 3', timePKT: '00:00', isTrial: true },
  { name: 'Safwana', tutorId: 'Tutor 3', timePKT: '01:30', isTrial: false },
  { name: 'Setayish', tutorId: 'Tutor 3', timePKT: '02:00', isTrial: false },
  { name: 'Shazneen', tutorId: 'Tutor 3', timePKT: '02:30', isTrial: false },
  { name: 'Ibrahim', tutorId: 'Tutor 3', timePKT: '03:00', isTrial: true },
  { name: 'Alika Salisusa', tutorId: 'Tutor 3', timePKT: '03:30', isTrial: false },
  { name: 'Mamadou Bah', tutorId: 'Tutor 3', timePKT: '04:00', isTrial: false },
  { name: 'Agu Bah', tutorId: 'Tutor 3', timePKT: '04:30', isTrial: false },
  { name: 'Ayan Jones', tutorId: 'Tutor 3', timePKT: '05:30', isTrial: true },
  { name: 'Osman Mohammad', tutorId: 'Tutor 3', timePKT: '06:00', isTrial: false },
  { name: 'Ibrahim Ca', tutorId: 'Tutor 3', timePKT: '06:30', isTrial: false }
];

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  students,
  tutors
}) => {
  const [importing, setImporting] = useState(false);
  const [currentProgress, setCurrentProgress] = useState('');
  const [items, setItems] = useState<ImportItem[]>([]);

  // Initialize items and determine potential duplicates
  React.useEffect(() => {
    if (!isOpen) return;

    // Determine the highest student numeric counter already in use
    let startCounter = 301;
    students.forEach((s) => {
      if (s.studentId && s.studentId.startsWith('STU-')) {
        const num = parseInt(s.studentId.replace('STU-', ''), 10);
        if (!isNaN(num) && num >= startCounter) {
          startCounter = num + 1;
        }
      }
    });

    const rawList = [...TUTOR_2_STUDENTS, ...TUTOR_3_STUDENTS];
    const initialItems: ImportItem[] = rawList.map((raw, idx) => {
      const studentId = `STU-${startCounter + idx}`;
      const cleanName = raw.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const studentEmail = `${cleanName}@gmail.com`;
      const parentEmail = `${cleanName}parent@gmail.com`;

      // Check if student with same name or email already exists
      const isDuplicate = students.some(
        (s) =>
          s.name.toLowerCase().trim() === raw.name.toLowerCase().trim() ||
          s.email.toLowerCase().trim() === studentEmail.toLowerCase().trim()
      );

      return {
        ...raw,
        studentId,
        studentEmail,
        parentEmail,
        status: isDuplicate ? 'duplicate' : 'pending'
      };
    });

    setItems(initialItems);
  }, [isOpen, students]);

  if (!isOpen) return null;

  const handleExecuteImport = async () => {
    setImporting(true);
    let successCount = 0;

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.status === 'duplicate') continue;

        setCurrentProgress(`Importing student ${i + 1}/${items.length}: ${item.name}...`);

        // 1. Create Student record
        const studentRecord: Omit<Student, 'id'> = {
          studentId: item.studentId,
          name: item.name,
          email: item.studentEmail,
          phone: '',
          parentName: `${item.name} Parent`,
          parentEmail: item.parentEmail,
          parentPhone: '',
          assignedTutorId: item.tutorId,
          status: item.isTrial ? 'Trial' : 'Active',
          courseType: 'Quran Reading / Nazra' as CourseType,
          country: 'United States',
          timezone: 'America/New_York',
          trialSessionsCompleted: 0,
          trialSessionsTotal: 5,
          trialStatus: item.isTrial ? 'In Progress' : 'None',
          createdAt: new Date().toISOString()
        };

        const docId = await addStudent(studentRecord);

        // 2. Create Monday - Friday Classes
        const weekdays: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        for (const day of weekdays) {
          const classRecord: Omit<TimetableClass, 'id'> = {
            tutorId: item.tutorId,
            studentId: item.studentId,
            studentName: item.name,
            dayOfWeek: day,
            startTimePKT: item.timePKT,
            durationMinutes: 30,
            status: 'Scheduled',
            isRecurring: true,
            isWeekend: false,
            notes: item.isTrial ? 'Trial Slot' : 'Regular Slot'
          };
          await addClass(classRecord);
        }

        // Mark item as imported
        setItems((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, status: 'imported' } : p))
        );
        successCount++;
      }

      setCurrentProgress(`Alhamdulillah! Imported ${successCount} students successfully.`);
      await onSuccess();
    } catch (err: any) {
      console.error(err);
      setCurrentProgress(`An error occurred during import: ${err.message || err}`);
    } finally {
      setImporting(false);
    }
  };

  const pendingCount = items.filter((item) => item.status === 'pending').length;
  const duplicateCount = items.filter((item) => item.status === 'duplicate').length;
  const importedCount = items.filter((item) => item.status === 'imported').length;

  return (
    <div className="fixed inset-0 bg-[#161F1A]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl border border-[#E3DFD7] max-w-2xl w-full shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E3DFD7] bg-[#FAF9F7]">
          <div>
            <h3 className="text-sm font-extrabold text-[#161F1A] flex items-center gap-1.5 uppercase tracking-wide">
              <Sparkles className="w-4 h-4 text-[#2D8B5C]" />
              Bulk Student & Schedule Importer
            </h3>
            <p className="text-[11px] text-[#5A6B61] mt-0.5">
              Import pre-assigned student rosters for Tutor 2 and Tutor 3.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={importing}
            className="p-1.5 rounded-lg text-[#5A6B61] hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List & Details */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Status summary banner */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#FAF9F7] p-3 rounded-xl border border-[#E3DFD7] text-center">
              <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Ready to Import</span>
              <p className="text-lg font-extrabold text-[#2D8B5C]">{pendingCount}</p>
            </div>
            <div className="bg-[#FAF9F7] p-3 rounded-xl border border-[#E3DFD7] text-center">
              <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Skipped/Duplicate</span>
              <p className="text-lg font-extrabold text-[#8C5D08]">{duplicateCount}</p>
            </div>
            <div className="bg-[#FAF9F7] p-3 rounded-xl border border-[#E3DFD7] text-center">
              <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Successfully Imported</span>
              <p className="text-lg font-extrabold text-blue-600">{importedCount}</p>
            </div>
          </div>

          {currentProgress && (
            <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              currentProgress.startsWith('Alhamdulillah') 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              {importing ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#2D8B5C]" />
              ) : (
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              )}
              {currentProgress}
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-[#5A6B61] uppercase tracking-wider">Roster Review</h4>
            <div className="border border-[#E3DFD7] rounded-xl overflow-hidden max-h-[250px] overflow-y-auto">
              <table className="w-full text-[11px] text-left">
                <thead className="bg-[#FAF9F7] border-b border-[#E3DFD7] text-[#5A6B61] font-bold">
                  <tr>
                    <th className="py-2 px-3">Student ID</th>
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3">Assigned Tutor</th>
                    <th className="py-2 px-3">Time (PKT)</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Action Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3DFD7] font-medium">
                  {items.map((item) => (
                    <tr key={item.studentId} className="hover:bg-gray-50/50">
                      <td className="py-2 px-3 font-mono font-bold text-[#1E5C3D]">{item.studentId}</td>
                      <td className="py-2 px-3 font-bold text-[#161F1A]">{item.name}</td>
                      <td className="py-2 px-3 text-[#2D8B5C] font-semibold">{item.tutorId}</td>
                      <td className="py-2 px-3 font-mono text-gray-600">{item.timePKT}</td>
                      <td className="py-2 px-3">
                        {item.isTrial ? (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-[#FFF9ED] text-[#8C5D08] border border-[#E8A93E]/30">Trial</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-100">Active</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {item.status === 'duplicate' && (
                          <span className="text-[#8C5D08] font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Duplicate (Skip)</span>
                        )}
                        {item.status === 'pending' && (
                          <span className="text-gray-500 font-bold">Pending</span>
                        )}
                        {item.status === 'imported' && (
                          <span className="text-emerald-700 font-extrabold flex items-center gap-1">✓ Imported</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-[#E3DFD7] bg-[#FAF9F7] flex items-center justify-between">
          <p className="text-[10px] text-[#5A6B61] max-w-sm">
            Importing registers the student profiles with test emails, and schedules their classes recurring from Monday to Friday.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2 border border-[#D5D0C6] bg-white rounded-xl text-xs font-bold text-[#161F1A] hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteImport}
              disabled={importing || pendingCount === 0}
              className="px-4 py-2 bg-[#2D8B5C] text-white rounded-xl text-xs font-bold hover:bg-[#1E5C3D] flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {importing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <span>Run Bulk Import</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
