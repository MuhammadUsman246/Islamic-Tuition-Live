import React, { useState, useEffect } from 'react';
import { X, Gift, CheckCircle } from 'lucide-react';
import { Referral, Student, ReferralStatus } from '../../types';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    referralData: Omit<Referral, 'id'>,
    id?: string,
    applyFeeDiscount?: boolean
  ) => Promise<void>;
  students: Student[];
  initialReferral?: Referral | null;
}

export const ReferralModal: React.FC<ReferralModalProps> = ({
  isOpen,
  onClose,
  onSave,
  students,
  initialReferral
}) => {
  const [referrerName, setReferrerName] = useState('');
  const [referredStudentId, setReferredStudentId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rewardAmount, setRewardAmount] = useState<number>(30);
  const [status, setStatus] = useState<ReferralStatus>('Pending');
  const [notes, setNotes] = useState('');
  const [applyDiscountToFee, setApplyDiscountToFee] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialReferral) {
      setReferrerName(initialReferral.referrerName);
      setReferredStudentId(initialReferral.referredStudentId);
      setDate(initialReferral.date);
      setRewardAmount(initialReferral.rewardAmount);
      setStatus(initialReferral.status);
      setNotes(initialReferral.notes || '');
      setApplyDiscountToFee(false);
    } else {
      setReferrerName('');
      if (students.length > 0) setReferredStudentId(students[0].studentId);
      setDate(new Date().toISOString().slice(0, 10));
      setRewardAmount(30);
      setStatus('Pending');
      setNotes('');
      setApplyDiscountToFee(false);
    }
  }, [initialReferral, students, isOpen]);

  if (!isOpen) return null;

  const selectedStudent = students.find(s => s.studentId === referredStudentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(
        {
          referrerName: referrerName.trim(),
          referredStudentId,
          referredStudentName: selectedStudent?.name || referredStudentId,
          date,
          rewardAmount: Number(rewardAmount),
          currency: 'USD',
          status,
          notes: notes.trim()
        },
        initialReferral?.id,
        applyDiscountToFee && (status === 'Approved' || status === 'Paid/Applied')
      );
      onClose();
    } catch (err: any) {
      alert('Error saving referral: ' + err.message);
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
            <Gift className="w-5 h-5 text-[#E8A93E]" />
            <h3 className="font-bold text-base">
              {initialReferral ? 'Edit Student Referral' : 'Register New Referral'}
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
          {/* Referrer Name */}
          <div>
            <label className="block text-xs font-semibold text-[#161F1A] mb-1">
              Referrer (Parent / Student Name)
            </label>
            <input
              type="text"
              required
              value={referrerName}
              onChange={(e) => setReferrerName(e.target.value)}
              placeholder="e.g. Tariq Khan (Parent of Ali Khan)"
              className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
            />
          </div>

          {/* Referred Student & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Referred Student
              </label>
              <select
                value={referredStudentId}
                onChange={(e) => setReferredStudentId(e.target.value)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
              >
                {students.map(s => (
                  <option key={s.id} value={s.studentId}>
                    {s.name} ({s.studentId})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Referral Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
              />
            </div>
          </div>

          {/* Reward Amount & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Bonus / Discount Amount ($ USD)
              </label>
              <input
                type="number"
                min="0"
                step="5"
                required
                value={rewardAmount}
                onChange={(e) => setRewardAmount(Number(e.target.value))}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Referral Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ReferralStatus)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
              >
                <option value="Pending">Pending (Trial under review)</option>
                <option value="Approved">Approved (Eligible for reward)</option>
                <option value="Paid/Applied">Paid / Applied to Fee</option>
              </select>
            </div>
          </div>

          {/* Option to apply discount immediately to fee */}
          {(status === 'Approved' || status === 'Paid/Applied') && (
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyDiscountToFee}
                  onChange={(e) => setApplyDiscountToFee(e.target.checked)}
                  className="rounded text-[#2D8B5C] focus:ring-[#2D8B5C]"
                />
                <span className="text-xs font-medium text-emerald-900">
                  Automatically apply ${rewardAmount} discount to pending fee invoice for {selectedStudent?.name}
                </span>
              </label>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#161F1A] mb-1">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Recommended neighbor family; student enrolled in Nazra..."
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
              {saving ? 'Saving...' : initialReferral ? 'Update Referral' : 'Save Referral'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
