import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, AlertCircle, CheckCircle, Palmtree, ArrowRight, RotateCcw, Loader2 } from 'lucide-react';
import { Student } from '../../types';

interface StudentLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  onSaveLeave: (params: {
    studentId: string;
    isOnLeave: boolean;
    leaveStartDate?: string;
    leaveEndDate?: string;
    leaveReason?: string;
    leaveType?: 'Specific Days' | 'Full Month' | 'Custom Range' | 'Indefinite';
    updateClasses?: boolean;
  }) => Promise<void>;
}

export const StudentLeaveModal: React.FC<StudentLeaveModalProps> = ({
  isOpen,
  onClose,
  student,
  onSaveLeave
}) => {
  const [leaveMode, setLeaveMode] = useState<'preset' | 'month' | 'custom'>('preset');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('Vacation / Traveling');
  const [customReason, setCustomReason] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [updateClasses, setUpdateClasses] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && student) {
      const today = new Date().toISOString().slice(0, 10);
      if (student.isOnLeave) {
        setStartDate(student.leaveStartDate || today);
        setEndDate(student.leaveEndDate || '');
        setReason(student.leaveReason || 'Vacation / Traveling');
        setLeaveMode('custom');
      } else {
        setStartDate(today);
        const inOneWeek = new Date();
        inOneWeek.setDate(inOneWeek.getDate() + 7);
        setEndDate(inOneWeek.toISOString().slice(0, 10));
        setReason('Vacation / Traveling');
        setCustomReason('');
        setLeaveMode('preset');
      }
      setError(null);
      setSaving(false);
    }
  }, [isOpen, student]);

  if (!isOpen || !student) return null;

  const applyPresetDays = (days: number, label: string) => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
    setReason(label);
  };

  const applyMonthLeave = (year: number, monthZeroIndexed: number, monthName: string) => {
    const firstDay = new Date(year, monthZeroIndexed, 1);
    const lastDay = new Date(year, monthZeroIndexed + 1, 0);
    setStartDate(firstDay.toISOString().slice(0, 10));
    setEndDate(lastDay.toISOString().slice(0, 10));
    setSelectedMonth(monthName);
    setReason(`On Leave for Month of ${monthName}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate) {
      setError('Please provide a start date for the leave.');
      return;
    }

    if (endDate && endDate < startDate) {
      setError('End date cannot be earlier than start date.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const effectiveReason = reason === 'Other' && customReason.trim() ? customReason.trim() : reason;
      await onSaveLeave({
        studentId: student.studentId,
        isOnLeave: true,
        leaveStartDate: startDate,
        leaveEndDate: endDate,
        leaveReason: effectiveReason,
        leaveType: leaveMode === 'month' ? 'Full Month' : 'Custom Range',
        updateClasses
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to set student leave:', err);
      setError(err.message || 'Failed to save student leave. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEndLeave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSaveLeave({
        studentId: student.studentId,
        isOnLeave: false,
        leaveStartDate: '',
        leaveEndDate: '',
        leaveReason: '',
        updateClasses: true
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to resume classes:', err);
      setError(err.message || 'Failed to resume classes.');
    } finally {
      setSaving(false);
    }
  };

  // Pre-calculate month options for quick selection
  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const currentYear = now.getFullYear();
  const monthOptions = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(currentYear, currentMonthIdx + i, 1);
    const mName = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    monthOptions.push({
      year: d.getFullYear(),
      monthIdx: d.getMonth(),
      name: mName
    });
  }

  return (
    <div className="fixed inset-0 bg-[#161F1A]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-[#E3DFD7] max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E3DFD7] bg-[#FAF9F7] shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
              <Palmtree className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#161F1A]">
                Student Leave / Vacation Management
              </h3>
              <p className="text-[11px] text-[#5A6B61]">
                {student.name} ({student.studentId}) • {student.assignedTutorId || 'No Tutor'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1.5 rounded-lg text-[#5A6B61] hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Active Leave Banner if already on leave */}
          {student.isOnLeave && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Palmtree className="w-4 h-4 text-amber-700" />
                  Currently On Leave
                </span>
                <span className="text-[10px] bg-amber-200/80 font-bold text-amber-900 px-2 py-0.5 rounded">
                  Active Notice
                </span>
              </div>
              <p className="text-xs text-amber-800">
                Dates: <strong>{student.leaveStartDate || 'Today'}</strong> to <strong>{student.leaveEndDate || 'Indefinite'}</strong>
                <br />
                Reason: <em>{student.leaveReason || 'Not specified'}</em>
              </p>
              <button
                type="button"
                onClick={handleEndLeave}
                disabled={saving}
                className="w-full mt-1 py-1.5 px-3 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>End Leave & Resume Regular Classes Now</span>
              </button>
            </div>
          )}

          {/* Leave Type / Mode Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#161F1A]">Leave Duration Method</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setLeaveMode('preset')}
                className={`py-2 px-2 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                  leaveMode === 'preset'
                    ? 'bg-[#2D8B5C] text-white border-[#2D8B5C] shadow-2xs'
                    : 'bg-white text-[#161F1A] border-[#D5D0C6] hover:bg-gray-50'
                }`}
              >
                Quick Presets
              </button>
              <button
                type="button"
                onClick={() => setLeaveMode('month')}
                className={`py-2 px-2 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                  leaveMode === 'month'
                    ? 'bg-[#2D8B5C] text-white border-[#2D8B5C] shadow-2xs'
                    : 'bg-white text-[#161F1A] border-[#D5D0C6] hover:bg-gray-50'
                }`}
              >
                Full Month
              </button>
              <button
                type="button"
                onClick={() => setLeaveMode('custom')}
                className={`py-2 px-2 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                  leaveMode === 'custom'
                    ? 'bg-[#2D8B5C] text-white border-[#2D8B5C] shadow-2xs'
                    : 'bg-white text-[#161F1A] border-[#D5D0C6] hover:bg-gray-50'
                }`}
              >
                Custom Dates
              </button>
            </div>
          </div>

          {/* Presets Mode */}
          {leaveMode === 'preset' && (
            <div className="space-y-2 bg-[#FAF9F7] p-3 rounded-xl border border-[#E3DFD7]">
              <span className="text-[11px] font-semibold text-[#5A6B61] block">Choose Quick Duration</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => applyPresetDays(3, '3-Day Leave / Weekend Vacation')}
                  className="p-2 bg-white border border-[#D5D0C6] hover:border-[#2D8B5C] rounded-lg text-xs text-left font-medium text-[#161F1A] cursor-pointer"
                >
                  <div className="font-bold text-[#2D8B5C]">3 Days</div>
                  <div className="text-[10px] text-[#5A6B61]">Short trip / family visit</div>
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetDays(7, '1-Week Leave / Traveling')}
                  className="p-2 bg-white border border-[#D5D0C6] hover:border-[#2D8B5C] rounded-lg text-xs text-left font-medium text-[#161F1A] cursor-pointer"
                >
                  <div className="font-bold text-[#2D8B5C]">1 Week (7 Days)</div>
                  <div className="text-[10px] text-[#5A6B61]">Weekly vacation</div>
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetDays(14, '2-Week Leave / Exams & Traveling')}
                  className="p-2 bg-white border border-[#D5D0C6] hover:border-[#2D8B5C] rounded-lg text-xs text-left font-medium text-[#161F1A] cursor-pointer"
                >
                  <div className="font-bold text-[#2D8B5C]">2 Weeks (14 Days)</div>
                  <div className="text-[10px] text-[#5A6B61]">School exams / holiday</div>
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetDays(30, '1-Month Leave')}
                  className="p-2 bg-white border border-[#D5D0C6] hover:border-[#2D8B5C] rounded-lg text-xs text-left font-medium text-[#161F1A] cursor-pointer"
                >
                  <div className="font-bold text-[#2D8B5C]">1 Month (30 Days)</div>
                  <div className="text-[10px] text-[#5A6B61]">Extended break</div>
                </button>
              </div>
            </div>
          )}

          {/* Month Mode */}
          {leaveMode === 'month' && (
            <div className="space-y-2 bg-[#FAF9F7] p-3 rounded-xl border border-[#E3DFD7]">
              <span className="text-[11px] font-semibold text-[#5A6B61] block">Select Specific Month</span>
              <div className="grid grid-cols-2 gap-2">
                {monthOptions.map((opt) => (
                  <button
                    key={opt.name}
                    type="button"
                    onClick={() => applyMonthLeave(opt.year, opt.monthIdx, opt.name)}
                    className={`p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-all text-left ${
                      selectedMonth === opt.name
                        ? 'bg-[#2D8B5C] text-white border-[#2D8B5C]'
                        : 'bg-white text-[#161F1A] border-[#D5D0C6] hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-bold">{opt.name}</div>
                    <div className={`text-[10px] ${selectedMonth === opt.name ? 'text-emerald-100' : 'text-[#5A6B61]'}`}>
                      Full 30/31 Day Leave
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Leave Start Date
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white text-[#161F1A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Leave End Date (Inclusive)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white text-[#161F1A]"
              />
            </div>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-xs font-semibold text-[#161F1A] mb-1">
              Leave Reason / Category
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white text-[#161F1A]"
            >
              <option value="Vacation / Traveling">Vacation / Traveling Abroad</option>
              <option value="School Exams / Studies">School Exams / Academic Preparation</option>
              <option value="Family / Personal Reasons">Family / Personal Reasons</option>
              <option value="Medical / Sick Leave">Medical / Sick Leave</option>
              <option value="Hajj / Umrah">Hajj / Umrah Pilgrimage</option>
              <option value="Ramadan Break">Ramadan Schedule Adjustment</option>
              <option value="Other">Other / Custom Reason</option>
            </select>

            {reason === 'Other' && (
              <input
                type="text"
                placeholder="Specify reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="mt-2 w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white text-[#161F1A]"
              />
            )}
          </div>

          {/* Class Timetable Sync Option */}
          <div className="pt-1">
            <label className="flex items-start space-x-2 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={updateClasses}
                onChange={(e) => setUpdateClasses(e.target.checked)}
                className="mt-0.5 rounded border-[#D5D0C6] text-[#2D8B5C] focus:ring-[#2D8B5C]"
              />
              <span className="text-[#161F1A]">
                Automatically tag scheduled timetable classes as <strong>'Student on Leave'</strong> so tutors and parents clearly see the status on the schedule.
              </span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#E3DFD7] flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#5A6B61] hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-bold text-white bg-[#2D8B5C] hover:bg-[#1E5C3D] rounded-lg shadow-sm flex items-center space-x-2 cursor-pointer transition-colors disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Leave...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Confirm Student Leave</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
