import React, { useState, useMemo } from 'react';
import {
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  UserX,
  Palmtree,
  Sparkles,
  Plus,
  Download,
  Search,
  Filter,
  X,
  Pencil,
  Trash2,
  Check,
  Zap,
  Info
} from 'lucide-react';
import { Tutor, TutorAttendanceRecord, TutorAttendanceStatus } from '../../types';
import {
  addTutorAttendanceRecord,
  updateTutorAttendanceRecord,
  deleteTutorAttendanceRecord
} from '../../services/dataService';
import { TutorAttendanceModal } from '../modals/TutorAttendanceModal';
import {
  exportTutorAttendanceToCSV,
  exportTutorMonthlyAuditToCSV
} from '../../utils/csvExporter';
import { getCurrentOperationalDate, getRelativeOperationalDate } from '../../utils/timezone';

interface TutorShiftsAttendanceManagerProps {
  tutors: Tutor[];
  tutorAttendance: TutorAttendanceRecord[];
  role: 'Admin' | 'Supervisor';
  onRefreshData?: () => Promise<void>;
  onEditTutorShiftSchedule?: (tutor: Tutor) => void;
}

export const TutorShiftsAttendanceManager: React.FC<TutorShiftsAttendanceManagerProps> = ({
  tutors,
  tutorAttendance,
  role,
  onRefreshData,
  onEditTutorShiftSchedule
}) => {
  // Selected daily roll-call date (defaults to Today in operational PKT)
  const todayDateStr = useMemo(() => getCurrentOperationalDate(), []);
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(todayDateStr);

  // Selected audit month for end-of-month payroll (defaults to current month YYYY-MM)
  const [selectedAuditMonth, setSelectedAuditMonth] = useState<string>(() => todayDateStr.slice(0, 7));

  // Daily board search & status filters
  const [dailySearchQuery, setDailySearchQuery] = useState<string>('');
  const [dailyStatusFilter, setDailyStatusFilter] = useState<'all' | 'unlogged' | 'Present' | 'Late' | 'Absent' | 'Leave'>('all');

  // Time period filter for the history ledger
  const [historyPeriod, setHistoryPeriod] = useState<'7days' | '30days' | '60days' | 'all'>('7days');
  const [historyTutorFilter, setHistoryTutorFilter] = useState<string>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');

  // Selected tutor for the detailed Month Late Audit Drawer
  const [inspectingTutorForAudit, setInspectingTutorForAudit] = useState<Tutor | null>(null);

  // Modal state for manual / edit attendance record
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<TutorAttendanceRecord | null>(null);

  // State for inline Late Popover
  const [activeLatePopoverTutorId, setActiveLatePopoverTutorId] = useState<string | null>(null);
  const [customLateMinutesInput, setCustomLateMinutesInput] = useState<string>('15');
  const [customLateNotesInput, setCustomLateNotesInput] = useState<string>('');

  // Day Stepper handler
  const handleStepDay = (deltaDays: number) => {
    try {
      const parts = selectedDailyDate.split('-').map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2] + deltaDays);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      setSelectedDailyDate(`${yyyy}-${mm}-${dd}`);
    } catch {
      // fallback
    }
  };

  // Month Stepper handler
  const handleStepMonth = (deltaMonths: number) => {
    try {
      const [yearNum, monthNum] = selectedAuditMonth.split('-').map(Number);
      const d = new Date(yearNum, monthNum - 1 + deltaMonths, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      setSelectedAuditMonth(`${yyyy}-${mm}`);
    } catch {
      // fallback
    }
  };

  // Arrival Time Calculator (Shift Start + Late Minutes = Exact Arrival Time)
  const calculateArrivalTime = (shiftStart: string, lateMinutes: number): string => {
    try {
      const match = shiftStart.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!match) return shiftStart;
      let hours = parseInt(match[1], 10);
      const mins = parseInt(match[2], 10);
      const ampm = match[3].toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;

      const totalMinutes = (hours * 60 + mins + lateMinutes) % (24 * 60);
      let newHours = Math.floor(totalMinutes / 60);
      const newMins = totalMinutes % 60;
      const newAmpm = newHours >= 12 ? 'PM' : 'AM';
      if (newHours === 0) newHours = 12;
      else if (newHours > 12) newHours -= 12;

      return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')} ${newAmpm}`;
    } catch {
      return shiftStart;
    }
  };

  // Filter active in-office tutors (ignore deactivated or purely remote test accounts if needed)
  const activeTutors = useMemo(() => {
    return tutors.filter(t => t.status === 'Active');
  }, [tutors]);

  // Map of attendance records for the selected daily roll-call date
  const dailyAttendanceMap = useMemo(() => {
    const map = new Map<string, TutorAttendanceRecord>();
    (tutorAttendance || []).forEach(r => {
      if (r.date === selectedDailyDate) {
        map.set(r.tutorId, r);
      }
    });
    return map;
  }, [tutorAttendance, selectedDailyDate]);

  // Filtered tutors for the daily roll-call board
  const filteredDailyTutors = useMemo(() => {
    return activeTutors.filter(t => {
      if (dailySearchQuery.trim()) {
        const q = dailySearchQuery.toLowerCase().trim();
        const matchName = (t.realName || '').toLowerCase().includes(q) || (t.displayName || '').toLowerCase().includes(q);
        const matchId = (t.tutorId || '').toLowerCase().includes(q);
        if (!matchName && !matchId) return false;
      }

      if (dailyStatusFilter !== 'all') {
        const rec = dailyAttendanceMap.get(t.tutorId);
        if (dailyStatusFilter === 'unlogged') {
          if (rec) return false;
        } else if (dailyStatusFilter === 'Present') {
          if (!rec || (rec.status !== 'Present' && rec.status !== 'On Time')) return false;
        } else if (dailyStatusFilter === 'Late') {
          if (!rec || rec.status !== 'Late') return false;
        } else if (dailyStatusFilter === 'Absent') {
          if (!rec || rec.status !== 'Absent') return false;
        } else if (dailyStatusFilter === 'Leave') {
          if (!rec || (rec.status !== 'Leave' && rec.status !== 'Excused')) return false;
        }
      }

      return true;
    });
  }, [activeTutors, dailySearchQuery, dailyStatusFilter, dailyAttendanceMap]);

  // Determine day of week for selected daily date (e.g. "Monday")
  const selectedDayOfWeek = useMemo(() => {
    try {
      const parts = selectedDailyDate.split('-').map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString('en-US', { weekday: 'long' });
    } catch {
      return 'Monday';
    }
  }, [selectedDailyDate]);

  // Check if today is a standard weekday (Mon-Fri)
  const isWeekday = useMemo(() => {
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(selectedDayOfWeek);
  }, [selectedDayOfWeek]);

  // 1-Click Quick Mark Action for an individual tutor on the daily board
  const handleQuickMarkDailyStatus = async (
    tutor: Tutor,
    status: TutorAttendanceStatus,
    lateMinutes = 0,
    notes = ''
  ) => {
    const existing = dailyAttendanceMap.get(tutor.tutorId);
    const shiftStart = tutor.shiftStartTimePKT || '12:30 AM';
    const shiftEnd = tutor.shiftEndTimePKT || '07:00 AM';
    const computedTimeIn = status === 'Late' && lateMinutes > 0
      ? calculateArrivalTime(shiftStart, lateMinutes)
      : shiftStart;

    const payload: Omit<TutorAttendanceRecord, 'id'> = {
      tutorId: tutor.tutorId,
      tutorName: tutor.realName || tutor.displayName || tutor.tutorId,
      date: selectedDailyDate,
      status,
      shiftStartTimePKT: shiftStart,
      shiftEndTimePKT: shiftEnd,
      timeIn: computedTimeIn,
      timeOut: shiftEnd,
      lateDurationMinutes: status === 'Late' ? lateMinutes : 0,
      notes: notes || (status === 'Late' ? `Arrived ${lateMinutes} mins late at ${computedTimeIn}` : status === 'Present' ? 'On Time' : status),
      markedBy: `${role} Quick-Action`,
      markedAt: new Date().toISOString()
    };

    if (existing) {
      await updateTutorAttendanceRecord(existing.id, payload);
    } else {
      await addTutorAttendanceRecord(payload);
    }

    setActiveLatePopoverTutorId(null);
    setCustomLateNotesInput('');
    if (onRefreshData) await onRefreshData();
  };

  // 1-Click Batch Mark: Marks all remaining unrecorded tutors as On Time
  const handleBatchMarkRemainingOnTime = async () => {
    const unrecordedTutors = activeTutors.filter(t => !dailyAttendanceMap.has(t.tutorId));
    if (unrecordedTutors.length === 0) {
      alert(`All faculty members already have attendance logs recorded for ${selectedDailyDate}.`);
      return;
    }

    for (const tutor of unrecordedTutors) {
      const shiftStart = tutor.shiftStartTimePKT || '12:30 AM';
      const shiftEnd = tutor.shiftEndTimePKT || '07:00 AM';
      await addTutorAttendanceRecord({
        tutorId: tutor.tutorId,
        tutorName: tutor.realName || tutor.displayName || tutor.tutorId,
        date: selectedDailyDate,
        status: 'Present',
        shiftStartTimePKT: shiftStart,
        shiftEndTimePKT: shiftEnd,
        timeIn: shiftStart,
        timeOut: shiftEnd,
        lateDurationMinutes: 0,
        notes: 'On Time (1-Click Roll Call)',
        markedBy: `${role} 1-Click Roll Call`,
        markedAt: new Date().toISOString()
      });
    }

    if (onRefreshData) await onRefreshData();
  };

  // Monthly Faculty Attendance & Late Minutes Audit calculations with auto-on-time resolution
  const monthlyAuditData = useMemo(() => {
    const currentMonthPrefix = selectedAuditMonth; // YYYY-MM
    const [yearNum, monthNum] = currentMonthPrefix.split('-').map(Number);
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();

    return activeTutors.map(tutor => {
      const tutorShiftDays = (tutor.shiftDays && tutor.shiftDays.length > 0)
        ? tutor.shiftDays
        : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const shiftStart = tutor.shiftStartTimePKT || '12:30 AM';

      // Find all records for this tutor in the selected month
      const monthRecords = (tutorAttendance || []).filter(
        r => r.tutorId === tutor.tutorId && (r.date || '').startsWith(currentMonthPrefix)
      );
      const recordByDateMap = new Map<string, TutorAttendanceRecord>();
      monthRecords.forEach(r => {
        if (r.date) recordByDateMap.set(r.date, r);
      });

      let scheduledShiftDaysCount = 0;
      let autoOnTimeDaysCount = 0;
      let explicitPresentCount = 0;
      const lateRecords: TutorAttendanceRecord[] = [];
      let absentCount = 0;
      let leaveCount = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentMonthPrefix}-${String(day).padStart(2, '0')}`;
        const dayDate = new Date(yearNum, monthNum - 1, day);
        const dayOfWeek = dayDate.toLocaleDateString('en-US', { weekday: 'long' });

        const isScheduledDay = tutorShiftDays.includes(dayOfWeek);
        if (!isScheduledDay) continue;

        // Has this date passed or is it today?
        const isElapsedOrToday = dateStr <= todayDateStr;
        if (!isElapsedOrToday) {
          continue; // future date in month
        }

        scheduledShiftDaysCount++;
        const rec = recordByDateMap.get(dateStr);
        if (rec) {
          if (rec.status === 'Late') {
            lateRecords.push(rec);
          } else if (rec.status === 'Absent') {
            absentCount++;
          } else if (rec.status === 'Leave' || rec.status === 'Excused') {
            leaveCount++;
          } else {
            explicitPresentCount++;
          }
        } else {
          // Unlogged elapsed shift day automatically treated as On Time
          autoOnTimeDaysCount++;
        }
      }

      // Check any non-standard records (e.g. weekend shifts)
      monthRecords.forEach(r => {
        if (!r.date) return;
        const parts = r.date.split('-').map(Number);
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        const dow = d.toLocaleDateString('en-US', { weekday: 'long' });
        if (!tutorShiftDays.includes(dow)) {
          scheduledShiftDaysCount++;
          if (r.status === 'Late') lateRecords.push(r);
          else if (r.status === 'Absent') absentCount++;
          else if (r.status === 'Leave' || r.status === 'Excused') leaveCount++;
          else explicitPresentCount++;
        }
      });

      const totalPresentDays = explicitPresentCount + autoOnTimeDaysCount;
      const totalLateMinutes = lateRecords.reduce((sum, r) => sum + (r.lateDurationMinutes || 0), 0);

      const lateDatesBreakdown = lateRecords
        .map(r => `${r.date}: ${r.lateDurationMinutes || 0}m late (${r.timeIn || shiftStart})`)
        .join('; ');

      const punctualityRate = scheduledShiftDaysCount > 0
        ? Math.round((totalPresentDays / scheduledShiftDaysCount) * 100)
        : 100;

      return {
        tutor,
        tutorId: tutor.tutorId,
        tutorName: tutor.realName || tutor.tutorId,
        scheduledDays: scheduledShiftDaysCount,
        presentDays: totalPresentDays,
        autoOnTimeDaysCount,
        explicitPresentCount,
        lateDays: lateRecords.length,
        totalLateMinutes,
        absentDays: absentCount,
        leaveDays: leaveCount,
        punctualityRate,
        lateDatesBreakdown,
        lateRecords
      };
    });
  }, [activeTutors, tutorAttendance, selectedAuditMonth, todayDateStr]);

  // Overall stats for today's selected date
  const todayStats = useMemo(() => {
    let onTimeCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let unloggedCount = 0;

    activeTutors.forEach(t => {
      const rec = dailyAttendanceMap.get(t.tutorId);
      if (!rec) {
        unloggedCount++;
      } else if (rec.status === 'Late') {
        lateCount++;
      } else if (rec.status === 'Absent') {
        absentCount++;
      } else if (rec.status === 'Leave' || rec.status === 'Excused') {
        leaveCount++;
      } else {
        onTimeCount++;
      }
    });

    return { onTimeCount, lateCount, absentCount, leaveCount, unloggedCount, total: activeTutors.length };
  }, [activeTutors, dailyAttendanceMap]);

  // Historical Records Table filter
  const filteredHistoryRecords = useMemo(() => {
    return (tutorAttendance || []).filter(r => {
      // Period filter
      if (historyPeriod !== 'all') {
        const days = historyPeriod === '7days' ? 7 : historyPeriod === '30days' ? 30 : 60;
        const cutoff = getRelativeOperationalDate(-days);
        if (r.date && r.date < cutoff) return false;
      }

      // Tutor filter
      if (historyTutorFilter !== 'all' && r.tutorId !== historyTutorFilter) return false;

      // Status filter
      if (historyStatusFilter !== 'all') {
        if (historyStatusFilter === 'Present' && r.status !== 'Present' && r.status !== 'On Time') return false;
        if (historyStatusFilter === 'Late' && r.status !== 'Late') return false;
        if (historyStatusFilter === 'Absent' && r.status !== 'Absent') return false;
        if (historyStatusFilter === 'Leave' && r.status !== 'Leave' && r.status !== 'Excused') return false;
      }

      // Search query
      if (historySearchQuery.trim()) {
        const q = historySearchQuery.toLowerCase().trim();
        const matchName = (r.tutorName || '').toLowerCase().includes(q);
        const matchId = (r.tutorId || '').toLowerCase().includes(q);
        const matchNotes = (r.notes || '').toLowerCase().includes(q);
        if (!matchName && !matchId && !matchNotes) return false;
      }

      return true;
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [tutorAttendance, historyPeriod, historyTutorFilter, historyStatusFilter, historySearchQuery]);

  return (
    <div className="space-y-6">
      {/* SECTION 1: HEADER & ACTION BUTTONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#E3DFD7] shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-[#2D8B5C]" />
            <h3 className="text-base font-bold text-[#161F1A]">Faculty Shift Attendance &amp; Lateness Audit</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
              Auto-Schedule Synced
            </span>
          </div>
          <p className="text-xs text-[#5A6B61] mt-0.5">
            Default 12:30 AM – 7:00 AM PKT shifts. 1-click on-time roll call, fast lateness logging in minutes, and end-of-month payroll audit.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setEditingRecord(null);
              setIsModalOpen(true);
            }}
            className="px-3 py-1.5 bg-white border border-[#D5D0C6] hover:bg-gray-50 text-[#161F1A] text-xs font-semibold rounded-lg flex items-center space-x-1.5 shadow-2xs cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4 text-[#2D8B5C]" />
            <span>Manual Shift Log</span>
          </button>

          <button
            type="button"
            onClick={() => exportTutorMonthlyAuditToCSV('faculty_monthly_lateness_audit', monthlyAuditData)}
            className="px-3.5 py-1.5 bg-[#1E5C3D] hover:bg-[#16472F] text-white text-xs font-bold rounded-lg flex items-center space-x-1.5 shadow-xs cursor-pointer transition-colors"
            title="Download monthly summary with total late minutes for accounts & payroll"
          >
            <Download className="w-4 h-4 text-[#E8A93E]" />
            <span>Export Payroll Audit (CSV)</span>
          </button>
        </div>
      </div>

      {/* SECTION 2: END-OF-MONTH FACULTY ATTENDANCE & LATENESS AUDIT CARDS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-xs font-bold text-[#161F1A] uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#2D8B5C]" />
                Monthly Faculty Attendance &amp; Lateness Summary ({selectedAuditMonth})
              </h4>
              <span className="px-2 py-0.2 rounded-full text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                Auto On-Time Enabled
              </span>
            </div>
            <p className="text-[11px] text-[#5A6B61] mt-0.5">
              Scheduled shifts auto-fill on-time if no exception is logged. Click any card for day-by-day late audit &amp; deducted minutes.
            </p>
          </div>

          {/* Month Selector with Steppers for Payroll Accounting */}
          <div className="flex items-center space-x-1.5 bg-[#FAF9F7] border border-[#D5D0C6] px-2.5 py-1 rounded-lg">
            <span className="text-[11px] font-semibold text-[#5A6B61]">Payroll Month:</span>
            <button
              type="button"
              onClick={() => handleStepMonth(-1)}
              className="px-2 py-0.5 rounded text-xs font-bold text-[#5A6B61] hover:bg-gray-200 transition-colors cursor-pointer"
              title="Previous Month"
            >
              ◀
            </button>
            <input
              type="month"
              value={selectedAuditMonth}
              onChange={(e) => setSelectedAuditMonth(e.target.value)}
              className="bg-transparent border-none text-xs font-mono font-bold focus:outline-none cursor-pointer text-[#161F1A]"
            />
            <button
              type="button"
              onClick={() => handleStepMonth(1)}
              className="px-2 py-0.5 rounded text-xs font-bold text-[#5A6B61] hover:bg-gray-200 transition-colors cursor-pointer"
              title="Next Month"
            >
              ▶
            </button>
            {selectedAuditMonth !== todayDateStr.slice(0, 7) && (
              <button
                type="button"
                onClick={() => setSelectedAuditMonth(todayDateStr.slice(0, 7))}
                className="text-[10px] text-[#2D8B5C] font-bold hover:underline ml-1 cursor-pointer"
              >
                Current
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {monthlyAuditData.map(audit => {
            const hasLateness = audit.totalLateMinutes > 0;
            return (
              <div
                key={audit.tutorId}
                onClick={() => setInspectingTutorForAudit(audit.tutor)}
                className={`bg-white p-4 rounded-xl border transition-all cursor-pointer shadow-xs hover:border-[#2D8B5C] hover:shadow-sm space-y-2.5 ${
                  hasLateness ? 'border-amber-300 bg-amber-50/20' : 'border-[#E3DFD7]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-bold text-[#2D8B5C] font-mono">{audit.tutorId}</span>
                      <span className="text-[10px] text-[#5A6B61] font-semibold truncate max-w-[120px]">
                        {audit.tutorName}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#5A6B61] mt-0.5 font-mono">
                      Shift: {audit.tutor.shiftStartTimePKT || '12:30 AM'} – {audit.tutor.shiftEndTimePKT || '07:00 AM'}
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                    audit.lateDays === 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}>
                    {audit.punctualityRate}% On Time
                  </span>
                </div>

                {/* Metrics Breakdown Grid */}
                <div className="grid grid-cols-4 gap-1 text-center pt-1 border-t border-[#EAE6DE]">
                  <div className="bg-[#FAF9F7] p-1.5 rounded">
                    <span className="text-[9px] text-[#5A6B61] block font-semibold">Logged</span>
                    <strong className="text-xs text-[#161F1A] font-bold">{audit.scheduledDays}d</strong>
                  </div>
                  <div className="bg-emerald-50 p-1.5 rounded">
                    <span className="text-[9px] text-emerald-800 block font-semibold">On Time</span>
                    <strong className="text-xs text-emerald-800 font-bold">{audit.presentDays}d</strong>
                  </div>
                  <div className={`p-1.5 rounded ${audit.lateDays > 0 ? 'bg-amber-100 border border-amber-300' : 'bg-amber-50'}`}>
                    <span className="text-[9px] text-amber-800 block font-semibold">Late</span>
                    <strong className="text-xs text-amber-900 font-extrabold">{audit.lateDays}d</strong>
                  </div>
                  <div className="bg-rose-50 p-1.5 rounded">
                    <span className="text-[9px] text-rose-800 block font-semibold">Absent</span>
                    <strong className="text-xs text-rose-800 font-bold">{audit.absentDays}d</strong>
                  </div>
                </div>

                {/* Total Late Minutes Highlight */}
                {hasLateness ? (
                  <div className="p-1.5 rounded-lg bg-amber-100/80 border border-amber-300 text-amber-900 text-[11px] font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      Total Lateness:
                    </span>
                    <span className="font-extrabold font-mono text-amber-950">
                      {audit.totalLateMinutes} mins ({audit.lateDays} {audit.lateDays === 1 ? 'day' : 'days'})
                    </span>
                  </div>
                ) : (
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-800 text-[10px] font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Punctuality Record:
                    </span>
                    <span className="font-bold">100% On Time</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: TODAY'S DAILY ROLL-CALL & 1-CLICK ACTION BOARD */}
      <div className="bg-white p-5 rounded-2xl border border-[#E3DFD7] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EAE6DE] pb-3">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-[#161F1A]">Daily Shift Roll-Call Board</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isWeekday ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'}`}>
                {selectedDayOfWeek} {isWeekday ? '• Scheduled Weekday' : '• Weekend'}
              </span>
            </div>
            <p className="text-xs text-[#5A6B61]">
              Log exceptions (Late/Absent) with 1 click. Unlogged faculty auto-complete as On-Time at end of shift.
            </p>
          </div>

          {/* Date Selector & 1-Click Roll Call */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center space-x-1 bg-[#FAF9F7] border border-[#D5D0C6] px-2 py-1 rounded-lg">
              <span className="text-[11px] font-semibold text-[#5A6B61]">Date:</span>
              <button
                type="button"
                onClick={() => handleStepDay(-1)}
                className="px-1.5 py-0.5 rounded text-xs font-bold text-[#5A6B61] hover:bg-gray-200 transition-colors cursor-pointer"
                title="Previous Day"
              >
                ◀
              </button>
              <input
                type="date"
                value={selectedDailyDate}
                onChange={(e) => setSelectedDailyDate(e.target.value)}
                className="bg-transparent border-none text-xs font-mono font-bold focus:outline-none cursor-pointer text-[#161F1A]"
              />
              <button
                type="button"
                onClick={() => handleStepDay(1)}
                className="px-1.5 py-0.5 rounded text-xs font-bold text-[#5A6B61] hover:bg-gray-200 transition-colors cursor-pointer"
                title="Next Day"
              >
                ▶
              </button>
              {selectedDailyDate !== todayDateStr && (
                <button
                  type="button"
                  onClick={() => setSelectedDailyDate(todayDateStr)}
                  className="text-[10px] text-[#2D8B5C] font-bold hover:underline ml-1 cursor-pointer"
                >
                  Today
                </button>
              )}
            </div>

            {/* 1-Click "Mark All Remaining On-Time" */}
            <button
              type="button"
              onClick={handleBatchMarkRemainingOnTime}
              disabled={todayStats.unloggedCount === 0}
              className="px-3.5 py-1.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg flex items-center space-x-1.5 shadow-xs cursor-pointer transition-all active:scale-95"
              title="Automatically records all remaining faculty members as On Time with their standard shift hours"
            >
              <Zap className="w-3.5 h-3.5 text-[#E8A93E]" />
              <span>Mark Remaining On-Time ({todayStats.unloggedCount})</span>
            </button>
          </div>
        </div>

        {/* Daily Stats Summary Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="bg-[#FAF9F7] p-2.5 rounded-xl border border-[#E3DFD7]">
            <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Total Faculty</span>
            <span className="text-base font-bold text-[#161F1A] mt-0.5 block">{todayStats.total}</span>
          </div>
          <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">On Time</span>
            <span className="text-base font-bold text-emerald-800 mt-0.5 block">{todayStats.onTimeCount}</span>
          </div>
          <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Late</span>
            <span className="text-base font-bold text-amber-800 mt-0.5 block">{todayStats.lateCount}</span>
          </div>
          <div className="bg-rose-50/70 p-2.5 rounded-xl border border-rose-200">
            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Absent</span>
            <span className="text-base font-bold text-rose-800 mt-0.5 block">{todayStats.absentCount}</span>
          </div>
          <div className="bg-blue-50/70 p-2.5 rounded-xl border border-blue-200">
            <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">Pending / Auto</span>
            <span className="text-base font-bold text-blue-800 mt-0.5 block">{todayStats.unloggedCount}</span>
          </div>
        </div>

        {/* Quick Daily Search & Status Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7]">
          <div className="flex items-center space-x-1.5 flex-wrap gap-1">
            <span className="text-[11px] font-bold text-[#5A6B61] mr-1">Roster Filter:</span>
            {(['all', 'unlogged', 'Present', 'Late', 'Absent', 'Leave'] as const).map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setDailyStatusFilter(st)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  dailyStatusFilter === st
                    ? 'bg-[#2D8B5C] text-white shadow-2xs'
                    : 'bg-white text-[#5A6B61] border border-[#D5D0C6] hover:bg-gray-50'
                }`}
              >
                {st === 'all' ? `All (${activeTutors.length})` :
                 st === 'unlogged' ? `Unlogged (${todayStats.unloggedCount})` :
                 st === 'Present' ? `On-Time (${todayStats.onTimeCount})` :
                 st === 'Late' ? `Late (${todayStats.lateCount})` :
                 st === 'Absent' ? `Absent (${todayStats.absentCount})` :
                 `Leave (${todayStats.leaveCount})`}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#5A6B61]" />
            <input
              type="text"
              placeholder="Search faculty name or ID..."
              value={dailySearchQuery}
              onChange={(e) => setDailySearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#D5D0C6] rounded-lg text-xs focus:ring-1 focus:ring-[#2D8B5C] outline-none"
            />
          </div>
        </div>

        {/* Faculty Daily Roll-Call List */}
        <div className="divide-y divide-[#EAE6DE] border border-[#E3DFD7] rounded-xl overflow-hidden">
          {filteredDailyTutors.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#5A6B61] italic bg-white">
              No faculty members match the "{dailyStatusFilter}" filter or search criteria for this date.
            </div>
          ) : (
            filteredDailyTutors.map(tutor => {
              const record = dailyAttendanceMap.get(tutor.tutorId);
              const shiftStart = tutor.shiftStartTimePKT || '12:30 AM';
              const shiftEnd = tutor.shiftEndTimePKT || '07:00 AM';
              const isLatePopoverOpen = activeLatePopoverTutorId === tutor.tutorId;
              const previewArrivalTime = calculateArrivalTime(shiftStart, Number(customLateMinutesInput) || 15);

              return (
                <div
                  key={tutor.tutorId}
                  className="p-3.5 bg-white hover:bg-[#FAF9F7]/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  {/* Faculty Info & Shift Hours */}
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-[#2D8B5C]/10 text-[#1E5C3D] font-bold text-xs flex items-center justify-center shrink-0 border border-[#2D8B5C]/20">
                      {tutor.realName ? tutor.realName.charAt(0).toUpperCase() : 'T'}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-[#161F1A]">{tutor.realName || tutor.tutorId}</span>
                        <span className="text-[10px] font-mono font-bold text-[#2D8B5C] bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          {tutor.tutorId}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#5A6B61] flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1 font-mono text-[#161F1A]">
                          <Clock className="w-3 h-3 text-[#2D8B5C]" />
                          Shift: <strong>{shiftStart} – {shiftEnd} PKT</strong>
                        </span>
                        {onEditTutorShiftSchedule && (
                          <button
                            type="button"
                            onClick={() => onEditTutorShiftSchedule(tutor)}
                            className="inline-flex items-center gap-1 text-[10px] text-[#2D8B5C] hover:underline font-bold bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-200 cursor-pointer transition-colors"
                            title="Edit shift start/end hours and weekly working days"
                          >
                            <Pencil className="w-2.5 h-2.5" />
                            <span>Edit Shift</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Current Status Badge & Action Controls */}
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {record ? (
                      /* Recorded State */
                      <div className="flex items-center gap-2">
                        {record.status === 'Late' ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                            <span>Late (+{record.lateDurationMinutes || 0}m · Arrived {record.timeIn || '—'})</span>
                          </div>
                        ) : record.status === 'Absent' ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <UserX className="w-3.5 h-3.5 text-rose-600" />
                            <span>Absent</span>
                          </div>
                        ) : record.status === 'Leave' || record.status === 'Excused' ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            <Palmtree className="w-3.5 h-3.5 text-blue-600" />
                            <span>Approved Leave</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>On Time ({record.timeIn || shiftStart})</span>
                          </div>
                        )}

                        {/* Edit Record Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRecord(record);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition-colors"
                          title="Edit shift attendance record"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete / Reset Record Button */}
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm(`Reset attendance log for ${tutor.realName || tutor.tutorId} on ${selectedDailyDate}? It will return to unlogged (auto on-time).`)) {
                              await deleteTutorAttendanceRecord(record.id);
                              if (onRefreshData) await onRefreshData();
                            }
                          }}
                          className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer transition-colors"
                          title="Delete / reset attendance log"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      /* Unrecorded State with 1-Click Fast Actions */
                      <div className="flex items-center gap-1.5 relative">
                        <span className="text-[11px] text-[#5A6B61] italic mr-1">
                          Unlogged (Auto-fills On-Time)
                        </span>

                        {/* 1-Click On-Time Button */}
                        <button
                          type="button"
                          onClick={() => handleQuickMarkDailyStatus(tutor, 'Present', 0, 'On Time')}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors cursor-pointer flex items-center space-x-1"
                          title="Mark as On Time right now"
                        >
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>On-Time</span>
                        </button>

                        {/* 1-Click / Fast Late Button */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveLatePopoverTutorId(isLatePopoverOpen ? null : tutor.tutorId);
                              setCustomLateMinutesInput('15');
                              setCustomLateNotesInput('');
                            }}
                            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-colors cursor-pointer flex items-center space-x-1"
                            title="Mark tutor as Late and log minutes"
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-700" />
                            <span>Mark Late...</span>
                          </button>

                          {/* Quick Lateness Popover */}
                          {isLatePopoverOpen && (
                            <div className="absolute right-0 top-8 z-30 bg-white p-3.5 rounded-xl border border-amber-300 shadow-xl w-72 space-y-2.5 animate-in fade-in duration-150">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-amber-950 flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-amber-600" /> Log Lateness Minutes
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setActiveLatePopoverTutorId(null)}
                                  className="text-gray-400 hover:text-gray-700 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* 1-Click Minutes Presets */}
                              <div className="grid grid-cols-6 gap-1">
                                {[10, 15, 20, 30, 45, 60].map(mins => (
                                  <button
                                    key={mins}
                                    type="button"
                                    onClick={() => handleQuickMarkDailyStatus(tutor, 'Late', mins, customLateNotesInput.trim() || `Arrived ${mins}m late`)}
                                    className="py-1 px-1 text-[11px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 rounded text-center transition-colors cursor-pointer"
                                  >
                                    +{mins}m
                                  </button>
                                ))}
                              </div>

                              {/* Custom Minutes & Note Input */}
                              <div className="space-y-1.5 pt-1.5 border-t border-amber-100 text-xs">
                                <div className="flex items-center space-x-1.5">
                                  <span className="text-[11px] font-medium text-[#5A6B61]">Custom:</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="360"
                                    value={customLateMinutesInput}
                                    onChange={(e) => setCustomLateMinutesInput(e.target.value)}
                                    placeholder="Mins"
                                    className="w-16 px-2 py-1 text-xs border border-amber-300 rounded font-mono font-bold"
                                  />
                                  <span className="text-[10px] text-[#5A6B61] font-mono">
                                    → Arrival: <strong>{previewArrivalTime}</strong>
                                  </span>
                                </div>

                                <input
                                  type="text"
                                  placeholder="Reason (optional, e.g. delay, power)..."
                                  value={customLateNotesInput}
                                  onChange={(e) => setCustomLateNotesInput(e.target.value)}
                                  className="w-full px-2 py-1 text-xs border border-[#D5D0C6] rounded bg-white"
                                />

                                <button
                                  type="button"
                                  onClick={() => handleQuickMarkDailyStatus(
                                    tutor,
                                    'Late',
                                    Number(customLateMinutesInput) || 15,
                                    customLateNotesInput.trim() || `Arrived ${customLateMinutesInput} mins late`
                                  )}
                                  className="w-full py-1.5 px-2 text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white rounded-lg cursor-pointer transition-colors"
                                >
                                  Save Late Arrival (+{customLateMinutesInput}m)
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 1-Click Absent Button */}
                        <button
                          type="button"
                          onClick={() => handleQuickMarkDailyStatus(tutor, 'Absent', 0, 'Marked Absent')}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 transition-colors cursor-pointer"
                          title="Mark tutor absent"
                        >
                          Absent
                        </button>

                        {/* 1-Click Leave Button */}
                        <button
                          type="button"
                          onClick={() => handleQuickMarkDailyStatus(tutor, 'Leave', 0, 'Authorized Leave')}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 transition-colors cursor-pointer"
                          title="Mark approved leave"
                        >
                          Leave
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* SECTION 4: HISTORICAL SHIFT ATTENDANCE LEDGER */}
      <div className="bg-white p-5 rounded-2xl border border-[#E3DFD7] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EAE6DE] pb-3">
          <div>
            <h4 className="text-sm font-bold text-[#161F1A]">Shift Attendance &amp; Lateness History Ledger</h4>
            <p className="text-xs text-[#5A6B61]">
              Audit faculty logs, inspect late minutes, and edit records if any error was made.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => exportTutorAttendanceToCSV('faculty_attendance_history', filteredHistoryRecords)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Ledger (CSV)</span>
            </button>
          </div>
        </div>

        {/* Filters Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Period Pills */}
          <div className="flex items-center space-x-1.5 flex-wrap gap-1">
            <span className="text-[11px] font-bold text-[#5A6B61] mr-1">Time Period:</span>
            {(['7days', '30days', '60days', 'all'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setHistoryPeriod(p)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  historyPeriod === p
                    ? 'bg-[#1E5C3D] text-white shadow-2xs'
                    : 'bg-[#FAF9F7] text-[#5A6B61] border border-[#E3DFD7] hover:bg-gray-100'
                }`}
              >
                {p === '7days' ? 'Last 7 Days (Default)' : p === '30days' ? 'Last 30 Days' : p === '60days' ? 'Last 60 Days' : 'All Records'}
              </button>
            ))}
          </div>

          {/* Tutor & Search Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={historyTutorFilter}
              onChange={(e) => setHistoryTutorFilter(e.target.value)}
              className="border border-[#D5D0C6] rounded-lg px-2.5 py-1 text-xs bg-white font-medium focus:ring-1 focus:ring-[#2D8B5C] outline-none"
            >
              <option value="all">All Tutors ({activeTutors.length})</option>
              {activeTutors.map(t => (
                <option key={t.tutorId} value={t.tutorId}>{t.tutorId} ({t.realName})</option>
              ))}
            </select>

            <select
              value={historyStatusFilter}
              onChange={(e) => setHistoryStatusFilter(e.target.value)}
              className="border border-[#D5D0C6] rounded-lg px-2.5 py-1 text-xs bg-white font-medium focus:ring-1 focus:ring-[#2D8B5C] outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="Present">Present / On Time</option>
              <option value="Late">Late Only</option>
              <option value="Absent">Absent Only</option>
              <option value="Leave">Leave Only</option>
            </select>

            <div className="flex items-center space-x-1.5 bg-[#FAF9F7] border border-[#D5D0C6] px-2.5 py-1 rounded-lg">
              <Search className="w-3.5 h-3.5 text-[#5A6B61]" />
              <input
                type="text"
                placeholder="Search tutor, notes..."
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                className="bg-transparent border-none text-xs focus:outline-none w-36"
              />
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="bg-white border border-[#E3DFD7] rounded-xl overflow-hidden shadow-xs">
          {filteredHistoryRecords.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#5A6B61] italic">
              No faculty shift attendance logs match the selected filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF9F7] border-b border-[#E3DFD7] text-[#5A6B61] font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3.5">Date</th>
                    <th className="py-2.5 px-3.5">Tutor ID &amp; Name</th>
                    <th className="py-2.5 px-3.5">Shift Hours (PKT)</th>
                    <th className="py-2.5 px-3.5">Arrival / Time In</th>
                    <th className="py-2.5 px-3.5">Status</th>
                    <th className="py-2.5 px-3.5">Lateness (Mins)</th>
                    <th className="py-2.5 px-3.5">Marked By</th>
                    <th className="py-2.5 px-3.5">Notes</th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE6DE]">
                  {filteredHistoryRecords.map(rec => (
                    <tr key={rec.id} className="hover:bg-[#FAF9F7]/70 transition-colors">
                      <td className="py-2.5 px-3.5 font-mono font-semibold text-[#161F1A]">{rec.date}</td>
                      <td className="py-2.5 px-3.5">
                        <span className="font-bold text-[#161F1A] block">{rec.tutorName || rec.tutorId}</span>
                        <span className="text-[10px] font-mono text-[#2D8B5C]">{rec.tutorId}</span>
                      </td>
                      <td className="py-2.5 px-3.5 font-mono text-[#5A6B61]">
                        {rec.shiftStartTimePKT || '12:30 AM'} – {rec.shiftEndTimePKT || '07:00 AM'}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono font-semibold text-[#161F1A]">
                        {rec.timeIn || rec.loginTime || '—'}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center space-x-1 ${
                          rec.status === 'Present' || rec.status === 'On Time'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : rec.status === 'Late'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : rec.status === 'Absent'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            rec.status === 'Present' || rec.status === 'On Time' ? 'bg-emerald-600' :
                            rec.status === 'Late' ? 'bg-amber-600' :
                            rec.status === 'Absent' ? 'bg-rose-600' : 'bg-blue-600'
                          }`} />
                          <span>{rec.status === 'Present' ? 'On Time' : rec.status}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 font-mono">
                        {rec.status === 'Late' && (rec.lateDurationMinutes || 0) > 0 ? (
                          <span className="font-extrabold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                            +{rec.lateDurationMinutes} mins
                          </span>
                        ) : (
                          <span className="text-gray-400">0 min</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-[#5A6B61] text-[11px]">{rec.markedBy || 'System'}</td>
                      <td className="py-2.5 px-3.5 text-[#161F1A] max-w-xs truncate">{rec.notes || '—'}</td>
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRecord(rec);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition-colors"
                            title="Edit this record to fix any mistake"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm(`Delete attendance record for ${rec.tutorName} on ${rec.date}?`)) {
                                await deleteTutorAttendanceRecord(rec.id);
                                if (onRefreshData) await onRefreshData();
                              }
                            }}
                            className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer transition-colors"
                            title="Delete this record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* INSPECT MONTH LATENESS AUDIT MODAL */}
      {inspectingTutorForAudit && (() => {
        const audit = monthlyAuditData.find(a => a.tutorId === inspectingTutorForAudit.tutorId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl border border-[#E3DFD7] overflow-hidden">
              <div className="px-6 py-4 bg-[#1E5C3D] text-white flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base">
                    Lateness &amp; Punctuality Audit: {inspectingTutorForAudit.realName || inspectingTutorForAudit.tutorId}
                  </h3>
                  <p className="text-xs text-emerald-200">
                    Month of {selectedAuditMonth} • {inspectingTutorForAudit.tutorId} • Shift: {inspectingTutorForAudit.shiftStartTimePKT || '12:30 AM'} – {inspectingTutorForAudit.shiftEndTimePKT || '07:00 AM'} PKT
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectingTutorForAudit(null)}
                  className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Summary Metrics */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-[#FAF9F7] p-2.5 rounded-xl border border-[#E3DFD7]">
                    <span className="text-[10px] text-[#5A6B61] block font-semibold">Total Shifts</span>
                    <strong className="text-sm font-bold text-[#161F1A]">{audit?.scheduledDays || 0}</strong>
                  </div>
                  <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    <span className="text-[10px] text-emerald-800 block font-semibold">On Time</span>
                    <strong className="text-sm font-bold text-emerald-800">{audit?.presentDays || 0}</strong>
                  </div>
                  <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    <span className="text-[10px] text-amber-800 block font-semibold">Late Days</span>
                    <strong className="text-sm font-bold text-amber-900">{audit?.lateDays || 0}</strong>
                  </div>
                  <div className="bg-amber-100 p-2.5 rounded-xl border border-amber-300">
                    <span className="text-[10px] text-amber-900 block font-bold">Total Late Mins</span>
                    <strong className="text-sm font-extrabold text-amber-950 font-mono">{audit?.totalLateMinutes || 0}m</strong>
                  </div>
                </div>

                {/* Day-by-Day Late Log Breakdown */}
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-[#161F1A] uppercase tracking-wider">
                    Late Arrival Records for Payroll Audit
                  </h5>

                  {!audit?.lateRecords || audit.lateRecords.length === 0 ? (
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center text-xs text-emerald-800 font-semibold">
                      🎉 Excellent Record: 0 late days logged for this faculty member this month!
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {audit.lateRecords.map(rec => (
                        <div
                          key={rec.id}
                          className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-bold text-[#161F1A]">{rec.date}</span>
                              <span className="px-2 py-0.5 rounded font-extrabold text-[11px] bg-amber-200 text-amber-900">
                                +{rec.lateDurationMinutes || 0} mins late
                              </span>
                            </div>
                            <p className="text-[11px] text-[#5A6B61] mt-0.5">
                              Arrival: {rec.timeIn || '—'} (Shift: {rec.shiftStartTimePKT || '12:30 AM'}) • {rec.notes || 'Late'}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingRecord(rec);
                              setIsModalOpen(true);
                              setInspectingTutorForAudit(null);
                            }}
                            className="px-2.5 py-1 text-xs font-bold text-amber-900 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg cursor-pointer transition-colors"
                          >
                            Edit Log
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-3 bg-[#FAF9F7] border-t border-[#EAE6DE] flex justify-end">
                <button
                  type="button"
                  onClick={() => setInspectingTutorForAudit(null)}
                  className="px-4 py-2 text-xs font-bold bg-[#161F1A] text-white rounded-lg hover:bg-black transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Manual / Edit Record Modal */}
      <TutorAttendanceModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingRecord(null);
        }}
        onSave={async (record, id) => {
          if (id) {
            await updateTutorAttendanceRecord(id, record);
          } else {
            await addTutorAttendanceRecord(record);
          }
          if (onRefreshData) await onRefreshData();
        }}
        tutors={activeTutors}
        initialRecord={editingRecord}
        markedByRole={role}
      />
    </div>
  );
};
