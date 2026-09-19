import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar, CheckCircle, AlertTriangle } from 'lucide-react';
import { TutorAttendanceRecord, Tutor, TutorAttendanceStatus } from '../../types';

interface TutorAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: Omit<TutorAttendanceRecord, 'id'>, id?: string) => Promise<void>;
  tutors: Tutor[];
  initialRecord?: TutorAttendanceRecord | null;
  markedByRole: 'Admin' | 'Supervisor';
}

export const TutorAttendanceModal: React.FC<TutorAttendanceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  tutors,
  initialRecord,
  markedByRole
}) => {
  const [tutorId, setTutorId] = useState<string>('Tutor 1');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<TutorAttendanceStatus>('Present');
  const [timeIn, setTimeIn] = useState<string>('01:00');
  const [timeOut, setTimeOut] = useState<string>('05:00');
  const [lateDurationMinutes, setLateDurationMinutes] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (initialRecord) {
      setTutorId(initialRecord.tutorId);
      setDate(initialRecord.date);
      setStatus(initialRecord.status || 'Present');
      setTimeIn(initialRecord.timeIn || initialRecord.loginTime || '01:00');
      setTimeOut(initialRecord.timeOut || '05:00');
      setLateDurationMinutes(initialRecord.lateDurationMinutes || 0);
      setNotes(initialRecord.notes || '');
    } else {
      if (tutors.length > 0) setTutorId(tutors[0].tutorId);
      setDate(new Date().toISOString().slice(0, 10));
      setStatus('Present');
      setTimeIn('01:00');
      setTimeOut('05:00');
      setLateDurationMinutes(0);
      setNotes('');
    }
  }, [initialRecord, tutors, isOpen]);

  if (!isOpen) return null;

  const selectedTutor = tutors.find(t => t.tutorId === tutorId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(
        {
          tutorId,
          tutorName: selectedTutor?.realName || selectedTutor?.displayName || tutorId,
          date,
          status,
          loginTime: timeIn,
          timeIn,
          timeOut,
          lateDurationMinutes: status === 'Late' ? Number(lateDurationMinutes) || 0 : 0,
          notes: notes.trim(),
          markedBy: `${markedByRole} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
          markedAt: new Date().toISOString()
        },
        initialRecord?.id
      );
      onClose();
    } catch (err: any) {
      alert('Error saving tutor attendance: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-[#E3DFD7] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#1E5C3D] text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-[#E8A93E]" />
            <h3 className="font-bold text-base">
              {initialRecord ? 'Edit Tutor Attendance' : 'Record Tutor Attendance'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Tutor & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Tutor
              </label>
              <select
                value={tutorId}
                onChange={(e) => setTutorId(e.target.value)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
              >
                {tutors.map(t => (
                  <option key={t.id} value={t.tutorId}>
                    {t.tutorId} ({t.realName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-[#161F1A] mb-1">
              Attendance Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
            >
              <option value="Present">Present (On Time)</option>
              <option value="Late">Late</option>
              <option value="Absent">Absent</option>
              <option value="Excused">Excused / Approved Leave</option>
            </select>
          </div>

          {/* Time In & Time Out */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Time In (PKT)
              </label>
              <input
                type="time"
                value={timeIn}
                onChange={(e) => setTimeIn(e.target.value)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Time Out (PKT)
              </label>
              <input
                type="time"
                value={timeOut}
                onChange={(e) => setTimeOut(e.target.value)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
              />
            </div>
          </div>

          {/* Late Duration (if Late) */}
          {status === 'Late' && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
              <label className="block text-xs font-semibold text-amber-900 mb-1">
                Lateness Duration (Minutes)
              </label>
              <input
                type="number"
                min="1"
                value={lateDurationMinutes}
                onChange={(e) => setLateDurationMinutes(Number(e.target.value))}
                className="w-full border border-amber-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-amber-500 focus:outline-none"
                placeholder="e.g. 15"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#161F1A] mb-1">
              Inspection / Administrative Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Logged in on time, conducted 6 sessions smoothly..."
              className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-[#EAE6DE] flex items-center justify-end space-x-3">
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
              className="px-5 py-2 text-xs font-bold text-white bg-[#2D8B5C] hover:bg-[#1E5C3D] rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving...' : initialRecord ? 'Update Record' : 'Save Attendance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
