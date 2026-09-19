import React, { useState, useEffect } from 'react';
import { X, UserCheck, Video, DollarSign, Phone, Mail, FileText, Key } from 'lucide-react';
import { Tutor } from '../../types';
import { registerUserAccount } from '../../services/dataService';

interface TutorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tutorData: Omit<Tutor, 'id'>, id?: string) => Promise<void>;
  initialTutor?: Tutor | null;
  existingTutorsCount: number;
}

export const TutorModal: React.FC<TutorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTutor,
  existingTutorsCount
}) => {
  const [tutorId, setTutorId] = useState<string>('');
  const [realName, setRealName] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [zoomLink, setZoomLink] = useState<string>('');
  const [monthlySalaryPKR, setMonthlySalaryPKR] = useState<number>(35000);
  const [status, setStatus] = useState<'Active' | 'Inactive' | 'On Leave'>('Active');
  const [notes, setNotes] = useState<string>('');
  const [createTutorUser, setCreateTutorUser] = useState<boolean>(true);
  const [tutorPassword, setTutorPassword] = useState<string>('tutor123');
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialTutor) {
      setTutorId(initialTutor.tutorId);
      setRealName(initialTutor.realName || '');
      setDisplayName(initialTutor.displayName || initialTutor.realName || '');
      setEmail(initialTutor.email || '');
      setPhone(initialTutor.phone || '');
      setZoomLink(initialTutor.zoomLink || '');
      setMonthlySalaryPKR(initialTutor.monthlySalaryPKR || 35000);
      setStatus(initialTutor.status || 'Active');
      setNotes(initialTutor.notes || '');
    } else {
      const nextId = `Tutor ${existingTutorsCount + 1}`;
      setTutorId(nextId);
      setRealName('');
      setDisplayName('');
      setEmail('');
      setPhone('');
      setZoomLink('https://zoom.us/j/90000000000?pwd=tuition_secret');
      setMonthlySalaryPKR(35000);
      setStatus('Active');
      setNotes('');
    }
  }, [initialTutor, existingTutorsCount, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!tutorId.trim() || !realName.trim()) {
      setError('Please provide Tutor ID and Real Name.');
      return;
    }

    if (!zoomLink.trim() || !zoomLink.startsWith('http')) {
      setError('Please provide a valid Zoom URL (must begin with https://).');
      return;
    }

    setSaving(true);
    try {
      await onSave(
        {
          tutorId: tutorId.trim(),
          realName: realName.trim(),
          displayName: displayName.trim() || realName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          zoomLink: zoomLink.trim(),
          monthlySalaryPKR: Number(monthlySalaryPKR) || 0,
          status,
          notes: notes.trim()
        },
        initialTutor?.id
      );

      // Register real tutor login credentials (Item 12)
      if (createTutorUser && email.trim()) {
        await registerUserAccount({
          email: email.trim(),
          password: tutorPassword.trim() || 'tutor123',
          displayName: realName.trim(),
          role: 'tutor',
          status: status === 'Active' ? 'active' : 'inactive',
          tutorId: tutorId.trim()
        });
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save tutor details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-[#E3DFD7] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#1E5C3D] text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-5 h-5 text-[#E8A93E]" />
            <h3 className="font-bold text-base">
              {initialTutor ? `Edit Tutor (${initialTutor.tutorId})` : 'Register New Tutor'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
              {error}
            </div>
          )}

          {/* Tutor ID & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Tutor ID (e.g. Tutor 1)
              </label>
              <input
                type="text"
                value={tutorId}
                onChange={(e) => setTutorId(e.target.value)}
                placeholder="Tutor 1"
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs font-mono font-bold focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Account Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive / Suspended</option>
                <option value="On Leave">On Leave</option>
              </select>
            </div>
          </div>

          {/* Names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Real Name (Internal)
              </label>
              <input
                type="text"
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                placeholder="e.g. Hafiz Muhammad Bilal"
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Display Name (Students see)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ustadh Bilal"
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
              />
            </div>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-[#5A6B61]" /> Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tutor@islamictuition.com"
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-[#5A6B61]" /> Phone / WhatsApp
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+92 300 1234567"
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
              />
            </div>
          </div>

          {/* Permanent Zoom Classroom Link */}
          <div className="p-3.5 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7] space-y-1.5">
            <label className="block text-xs font-bold text-[#1E5C3D] flex items-center gap-1.5">
              <Video className="w-4 h-4 text-[#2D8B5C]" />
              Permanent Zoom Classroom Link
            </label>
            <p className="text-[11px] text-[#5A6B61]">
              Assigned students will see this link in their portal to join live sessions.
            </p>
            <input
              type="url"
              value={zoomLink}
              onChange={(e) => setZoomLink(e.target.value)}
              placeholder="https://zoom.us/j/91234567890?pwd=..."
              className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs font-mono bg-white focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
              required
            />
          </div>

          {/* Base Salary */}
          <div>
            <label className="block text-xs font-semibold text-[#161F1A] mb-1 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-[#5A6B61]" /> Base Monthly Salary (PKR)
            </label>
            <input
              type="number"
              value={monthlySalaryPKR}
              onChange={(e) => setMonthlySalaryPKR(Number(e.target.value))}
              placeholder="35000"
              className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs font-bold focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#161F1A] mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-[#5A6B61]" /> Admin Private Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any administrative notes regarding qualifications, availability, etc."
              className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
            />
          </div>

          {/* Real User Credentials Provisioning (Item 12) */}
          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
            <div className="flex items-center space-x-2">
              <Key className="w-4 h-4 text-[#2D8B5C]" />
              <span className="text-xs font-bold text-[#1E5C3D] uppercase tracking-wider">
                Tutor Login Credentials (Item 12)
              </span>
            </div>
            <label className="flex items-center space-x-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={createTutorUser}
                onChange={(e) => setCreateTutorUser(e.target.checked)}
                className="rounded border-[#D5D0C6] text-[#2D8B5C] focus:ring-[#2D8B5C]"
              />
              <span className="text-xs font-semibold text-[#161F1A]">Enable portal login account for this tutor</span>
            </label>
            {createTutorUser && (
              <div className="pt-1">
                <label className="block text-[11px] text-[#5A6B61] mb-1">Initial Password</label>
                <input
                  type="text"
                  value={tutorPassword}
                  onChange={(e) => setTutorPassword(e.target.value)}
                  placeholder="e.g. tutor123"
                  className="w-full border border-[#D5D0C6] rounded-md px-3 py-1.5 text-xs font-mono bg-white"
                />
                <p className="text-[10px] text-[#5A6B61] mt-1">
                  Tutor can log into IslamicTuition with their email and this password to access their dedicated Tutor Dashboard.
                </p>
              </div>
            )}
          </div>

          {/* Modal Actions */}
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
              {saving ? 'Saving...' : initialTutor ? 'Update Tutor' : 'Register Tutor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
