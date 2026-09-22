import React, { useState, useEffect } from 'react';
import { X, Briefcase, CheckCircle } from 'lucide-react';
import { TutorSalary, Tutor } from '../../types';

interface SalaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (salaryData: Omit<TutorSalary, 'id'>, id?: string) => Promise<void>;
  tutors: Tutor[];
  initialSalary?: TutorSalary | null;
}

export const SalaryModal: React.FC<SalaryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  tutors,
  initialSalary
}) => {
  const [tutorId, setTutorId] = useState<string>('Tutor 1');
  const [monthlySalary, setMonthlySalary] = useState<number>(50000);
  const [month, setMonth] = useState<string>('September 2026');
  const [status, setStatus] = useState<'Paid' | 'Unpaid'>('Unpaid');
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [deduction, setDeduction] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (initialSalary) {
      setTutorId(initialSalary.tutorId);
      setMonthlySalary(initialSalary.monthlySalary);
      setMonth(initialSalary.month);
      setStatus(initialSalary.status);
      setPaymentDate(initialSalary.paymentDate || '');
      setDeduction(initialSalary.deduction || 0);
      setNotes(initialSalary.notes || '');
    } else {
      if (tutors.length > 0) {
        setTutorId(tutors[0].tutorId);
        setMonthlySalary(tutors[0].monthlySalaryPKR || 50000);
      }
      setMonth('September 2026');
      setStatus('Unpaid');
      setPaymentDate('');
      setDeduction(0);
      setNotes('');
    }
  }, [initialSalary, tutors]);

  if (!isOpen) return null;

  const selectedTutor = tutors.find(t => t.tutorId === tutorId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(
        {
          tutorId,
          tutorName: selectedTutor?.realName || tutorId,
          monthlySalary,
          currency: 'PKR',
          month,
          status,
          paymentDate: status === 'Paid' ? (paymentDate || new Date().toISOString().slice(0, 10)) : undefined,
          deduction,
          notes,
          createdAt: initialSalary?.createdAt || new Date().toISOString()
        },
        initialSalary?.id
      );
      onClose();
    } catch (err: any) {
      alert("Error saving salary: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-[#E3DFD7] overflow-hidden">
        <div className="px-6 py-4 bg-[#2D8B5C] text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Briefcase className="w-5 h-5 text-[#E8A93E]" />
            <h3 className="font-bold text-base">
              {initialSalary ? 'Edit Tutor Salary' : 'Disburse Tutor Salary (PKR)'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#161F1A] mb-1">Tutor</label>
            <select
              value={tutorId}
              onChange={(e) => {
                setTutorId(e.target.value);
                const t = tutors.find(x => x.tutorId === e.target.value);
                if (t?.monthlySalaryPKR) setMonthlySalary(t.monthlySalaryPKR);
              }}
              className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white"
              required
            >
              {tutors.map((t, idx) => (
                <option key={`${t.id || t.tutorId}_${idx}`} value={t.tutorId}>
                  {t.tutorId} ({t.realName})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">Monthly Salary (PKR)</label>
              <input
                type="number"
                min={0}
                value={monthlySalary}
                onChange={(e) => setMonthlySalary(parseFloat(e.target.value) || 0)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">Deduction (PKR)</label>
              <input
                type="number"
                min={0}
                value={deduction}
                onChange={(e) => setDeduction(parseFloat(e.target.value) || 0)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">Month</label>
              <input
                type="text"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                placeholder="e.g. September 2026"
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'Paid' | 'Unpaid')}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white"
              >
                <option value="Unpaid">Unpaid</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
          </div>

          {status === 'Paid' && (
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#161F1A] mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Transferred via Meezan Bank"
              className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs"
            />
          </div>

          <div className="pt-4 border-t border-[#E3DFD7] flex items-center justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-medium text-[#5A6B61] hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
            <button
              id="submit_salary_button"
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#2D8B5C] hover:bg-[#1E5C3D] rounded-lg shadow-sm flex items-center space-x-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Salary'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
