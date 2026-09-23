import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Sparkles, AlertCircle, Loader2, Copy, FileSpreadsheet } from 'lucide-react';
import { Student, Tutor, TimetableClass, DayOfWeek, CourseType, AllowedCurrency } from '../../types';
import { addStudent, addClass, getNextSequentialStudentId } from '../../services/dataService';

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
  days: string;
  timePKT: string;
  monthlyFee?: number;
  feeDate?: string;
  feeCurrency?: AllowedCurrency;
  studentId: string;
  familyGroupName?: string;
  isTrial: boolean;
  studentEmail: string;
  parentEmail: string;
  status: 'pending' | 'duplicate' | 'imported' | 'error';
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  students,
  tutors
}) => {
  const [pastedText, setPastedText] = useState('');
  const [importing, setImporting] = useState(false);
  const [currentProgress, setCurrentProgress] = useState('');
  const [items, setItems] = useState<ImportItem[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setItems([]);
    setPastedText('');
    setCurrentProgress('');
  }, [isOpen]);

  const handleParseCustomData = () => {
    if (!pastedText.trim()) {
      alert('Please paste some rows from Google Sheets.');
      return;
    }

    const lines = pastedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    // Calculate next sequential student ID base number
    const nextSeqId = getNextSequentialStudentId(students);
    const parsedNum = parseInt(nextSeqId.replace(/[^0-9]/g, ''), 10);
    const startCounter = !isNaN(parsedNum) ? parsedNum : 101;

    const parsed: ImportItem[] = [];

    lines.forEach((line, index) => {
      const cols = line.split('\t').map(c => c.trim());
      
      // Skip header row if it resembles headers
      if (index === 0 && cols.some(c => 
        c.toLowerCase().includes('name') || 
        c.toLowerCase().includes('tutor') || 
        c.toLowerCase().includes('time') || 
        c.toLowerCase().includes('fee') ||
        c.toLowerCase().includes('student')
      )) {
        return;
      }

      // Check if we have at least student name
      const name = cols[0] || '';
      if (!name) return;

      const tutorId = cols[1] || 'Tutor 2';
      const rawDays = cols[2] || 'Monday to Friday';
      const rawTime = cols[3] || '1:00 AM';
      const rawFee = cols[4] || '';
      const rawFeeDate = cols[5] || '1';
      const rawCurrency = cols[6] || 'USD';
      const rawStudentId = cols[7] || '';
      const familyGroupName = cols[8] || '';
      const rawTrial = cols[9] || '';

      // Clean Time to HH:mm formatted string
      let timePKT = '01:00';
      try {
        let timeStr = rawTime.toUpperCase().replace(/\s+/g, '');
        const isPM = timeStr.includes('PM');
        const isAM = timeStr.includes('AM');
        let cleanTime = timeStr.replace('AM', '').replace('PM', '');
        let [hoursStr, minutesStr] = cleanTime.split(':');
        let hours = parseInt(hoursStr, 10);
        let minutes = minutesStr ? parseInt(minutesStr, 10) : 0;
        if (isNaN(hours)) hours = 1;
        if (isNaN(minutes)) minutes = 0;

        if (isPM && hours < 12) hours += 12;
        if (isAM && hours === 12) hours = 0;

        timePKT = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      } catch {
        timePKT = rawTime;
      }

      const isTrial = 
        rawTrial.toLowerCase().includes('yes') || 
        rawTrial.toLowerCase().includes('trial') || 
        rawTrial.toLowerCase().includes('true');

      // Parse Fee
      let monthlyFee: number | undefined = undefined;
      let feeCurrency: AllowedCurrency | undefined = undefined;
      if (rawFee) {
        const num = parseFloat(rawFee.replace(/[^0-9.]/g, ''));
        if (!isNaN(num) && num > 0) {
          monthlyFee = num;
          feeCurrency = (['USD', 'CAD', 'GBP', 'PKR'].includes(rawCurrency.toUpperCase()) 
            ? rawCurrency.toUpperCase() 
            : 'USD') as AllowedCurrency;
        }
      }

      // Determine Student ID: use custom one if provided, otherwise auto-generate
      let finalStudentId = rawStudentId;
      if (!finalStudentId) {
        finalStudentId = `STU-${startCounter + parsed.length}`;
      }

      const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const studentEmail = `${cleanName}@gmail.com`;
      const parentEmail = `${cleanName}parent@gmail.com`;

      const isDuplicate = students.some(
        (s) =>
          s.studentId === finalStudentId ||
          s.name.toLowerCase().trim() === name.toLowerCase().trim()
      );

      parsed.push({
        name,
        tutorId,
        days: rawDays,
        timePKT,
        monthlyFee,
        feeDate: rawFeeDate || undefined,
        feeCurrency,
        studentId: finalStudentId,
        familyGroupName: familyGroupName || undefined,
        isTrial,
        studentEmail,
        parentEmail,
        status: isDuplicate ? 'duplicate' : 'pending'
      });
    });

    setItems(parsed);
    setCurrentProgress(`Parsed ${parsed.length} rows successfully. Please review the details below before importing.`);
  };

  const handleExecuteImport = async () => {
    setImporting(true);
    let successCount = 0;

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.status === 'duplicate') continue;

        setCurrentProgress(`Importing student ${i + 1}/${items.length}: ${item.name}...`);

        let familyGroupId: string | undefined = undefined;
        if (item.familyGroupName) {
          familyGroupId = 'fam_' + item.familyGroupName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        }

        // Incorporate Fee Date info inside private notes and custom doc structure
        const notesText = `Imported via bulk sheet. Fee Date: Day ${item.feeDate || '1'} of the month.`;

        // 1. Create Student record
        const studentRecord: Omit<Student, 'id'> & { feeDate?: string } = {
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
          monthlyFee: item.monthlyFee,
          feeCurrency: item.feeCurrency,
          feeDate: item.feeDate,
          familyGroupId,
          familyGroupName: item.familyGroupName,
          notes: notesText,
          createdAt: new Date().toISOString()
        };

        await addStudent(studentRecord);

        // 2. Map Days and Create Weekday Classes
        let daysToSchedule: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const rawDaysLower = item.days.toLowerCase();
        
        if (rawDaysLower && !rawDaysLower.includes('monday to friday')) {
          const matchedDays: DayOfWeek[] = [];
          if (rawDaysLower.includes('monday')) matchedDays.push('Monday');
          if (rawDaysLower.includes('tuesday')) matchedDays.push('Tuesday');
          if (rawDaysLower.includes('wednesday')) matchedDays.push('Wednesday');
          if (rawDaysLower.includes('thursday')) matchedDays.push('Thursday');
          if (rawDaysLower.includes('friday')) matchedDays.push('Friday');
          if (rawDaysLower.includes('saturday')) matchedDays.push('Saturday');
          if (rawDaysLower.includes('sunday')) matchedDays.push('Sunday');
          
          if (matchedDays.length > 0) {
            daysToSchedule = matchedDays;
          }
        }

        for (const day of daysToSchedule) {
          const classRecord: Omit<TimetableClass, 'id'> = {
            tutorId: item.tutorId,
            studentId: item.studentId,
            studentName: item.name,
            dayOfWeek: day,
            startTimePKT: item.timePKT,
            durationMinutes: 30,
            status: 'Scheduled',
            isRecurring: true,
            isWeekend: day === 'Saturday' || day === 'Sunday',
            notes: item.isTrial ? 'Trial Slot' : 'Regular Slot'
          };
          await addClass(classRecord);
        }

        setItems((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, status: 'imported' } : p))
        );
        successCount++;
      }

      setCurrentProgress(`Alhamdulillah! Successfully imported ${successCount} students and scheduled all associated classes.`);
      await onSuccess();
    } catch (err: any) {
      console.error(err);
      setCurrentProgress(`An error occurred during import: ${err.message || err}`);
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  const pendingCount = items.filter((item) => item.status === 'pending').length;
  const duplicateCount = items.filter((item) => item.status === 'duplicate').length;
  const importedCount = items.filter((item) => item.status === 'imported').length;

  return (
    <div className="fixed inset-0 bg-[#161F1A]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl border border-[#E3DFD7] max-w-5xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E3DFD7] bg-[#FAF9F7] shrink-0">
          <div>
            <h3 className="text-sm font-extrabold text-[#161F1A] flex items-center gap-1.5 uppercase tracking-wide">
              <Sparkles className="w-4 h-4 text-[#2D8B5C]" />
              Universal Student Bulk Importer
            </h3>
            <p className="text-[11px] text-[#5A6B61] mt-0.5">
              Copy rows directly from Google Sheets to register student records, customize IDs, map joint family billing, specify fee due dates, and schedule lessons.
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

        {/* Scrollable Container */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 min-h-0">
          <div className="space-y-3 bg-[#FAF9F7] p-4 rounded-xl border border-[#E3DFD7]">
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-[#161F1A] flex items-center gap-1">
                <FileSpreadsheet className="w-4 h-4 text-[#2D8B5C]" /> Step 1: Format & Copy Google Sheets Columns
              </h4>
              <p className="text-[11px] text-[#5A6B61] leading-relaxed">
                Ensure your Google Sheet columns are strictly ordered like this:
                <br />
                <code className="text-[#1E5C3D] font-mono bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100/60 block mt-1.5 text-[10px]">
                  Student Name [Tab] Tutor [Tab] Days [Tab] Time PKT [Tab] Monthly Fee [Tab] Fee Date [Tab] Currency [Tab] Student I'D [Tab] Family Group Name [Tab] Trial?
                </code>
                <br />
                Copy your rows (header row will be auto-skipped) and paste them into the box below.
              </p>
            </div>

            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste rows here...&#10;Mouhammadou	Tutor 2	Monday to Friday	1:00 AM	100	1	USD	STU-101	Isra Family	No"
              disabled={importing}
              className="w-full h-24 p-3 border border-[#D5D0C6] rounded-xl text-[11px] font-mono bg-white focus:outline-none focus:ring-1 focus:ring-[#2D8B5C]"
            />

            <div className="flex justify-end">
              <button
                onClick={handleParseCustomData}
                disabled={importing || !pastedText.trim()}
                className="px-4 py-2 bg-[#1E5C3D] hover:bg-[#161F1A] text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
              >
                Parse Spreadsheet Rows
              </button>
            </div>
          </div>

          {/* Status summary banner */}
          {items.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#FAF9F7] p-3 rounded-xl border border-[#E3DFD7] text-center">
                <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Ready to Import</span>
                <p className="text-base font-extrabold text-[#2D8B5C]">{pendingCount}</p>
              </div>
              <div className="bg-[#FAF9F7] p-3 rounded-xl border border-[#E3DFD7] text-center">
                <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Skipped/Duplicate</span>
                <p className="text-base font-extrabold text-[#8C5D08]">{duplicateCount}</p>
              </div>
              <div className="bg-[#FAF9F7] p-3 rounded-xl border border-[#E3DFD7] text-center">
                <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Successfully Imported</span>
                <p className="text-base font-extrabold text-blue-600">{importedCount}</p>
              </div>
            </div>
          )}

          {currentProgress && (
            <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              currentProgress.startsWith('Alhamdulillah') || currentProgress.startsWith('Parsed')
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

          {items.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold text-[#5A6B61] uppercase tracking-wider">
                Google Sheets Parsed Preview
              </h4>
              <div className="border border-[#E3DFD7] rounded-xl overflow-hidden max-h-[250px] overflow-y-auto">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-[#FAF9F7] border-b border-[#E3DFD7] text-[#5A6B61] font-bold sticky top-0 z-10">
                    <tr>
                      <th className="py-2 px-3">Student ID</th>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Tutor</th>
                      <th className="py-2 px-3">Time (PKT)</th>
                      <th className="py-2 px-3">Days</th>
                      <th className="py-2 px-3">Fee</th>
                      <th className="py-2 px-3">Fee Date</th>
                      <th className="py-2 px-3">Family Group</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3DFD7] font-medium">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="py-2 px-3 font-mono font-extrabold text-[#1E5C3D]">{item.studentId}</td>
                        <td className="py-2 px-3 font-bold text-[#161F1A]">{item.name}</td>
                        <td className="py-2 px-3 text-[#2D8B5C] font-semibold">{item.tutorId}</td>
                        <td className="py-2 px-3 font-mono text-gray-600">{item.timePKT}</td>
                        <td className="py-2 px-3 text-gray-500 font-mono truncate max-w-[110px]" title={item.days}>{item.days}</td>
                        <td className="py-2 px-3 font-mono font-bold text-gray-700">
                          {item.monthlyFee ? `${item.monthlyFee} ${item.feeCurrency}` : '—'}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-blue-900 bg-blue-50/20">{item.feeDate || '—'}</td>
                        <td className="py-2 px-3 font-bold text-amber-900 truncate max-w-[120px]" title={item.familyGroupName || 'None'}>
                          {item.familyGroupName || '—'}
                        </td>
                        <td className="py-2 px-3">
                          {item.isTrial ? (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-[#FFF9ED] text-[#8C5D08] border border-[#E8A93E]/30">Trial</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-100">Active</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {item.status === 'duplicate' && (
                            <span className="text-[#8C5D08] font-bold flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> Skip/Duplicate
                            </span>
                          )}
                          {item.status === 'pending' && (
                            <span className="text-gray-500 font-bold">Ready</span>
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
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-[#E3DFD7] bg-[#FAF9F7] flex items-center justify-between shrink-0">
          <p className="text-[10px] text-[#5A6B61] max-w-md leading-normal">
            Pasting registers student profiles with simple emails, auto-schedules Monday-Friday (or custom) lessons, configures billing, and establishes siblings family groups.
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
              className="px-4 py-2 bg-[#2D8B5C] text-white rounded-xl text-xs font-bold hover:bg-[#1E5C3D] flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {importing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <span>Run Bulk Import ({pendingCount})</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
