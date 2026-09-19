import React, { useState } from 'react';
import { X, MessageSquare, Send, CheckCircle2, PhoneCall, ExternalLink } from 'lucide-react';
import { Student, Tutor } from '../../types';

interface TrialSmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  tutor?: Tutor | null;
  onSendSms: (studentId: string, phone: string, message: string) => Promise<void>;
}

export const TrialSmsModal: React.FC<TrialSmsModalProps> = ({
  isOpen,
  onClose,
  student,
  tutor,
  onSendSms
}) => {
  if (!isOpen || !student) return null;

  const parentPhone = student.parentPhone || student.phone || '+1 (555) 019-2834';
  const parentName = student.parentName || 'Parent / Guardian';
  const tutorName = tutor ? `${tutor.tutorId} (${tutor.realName})` : 'Assigned Academy Tutor';

  const defaultMessage = `Assalamu Alaykum ${parentName},\n\nThis is a reminder from Islamic Tuition Quran Academy for ${student.name}'s upcoming trial class scheduled with ${tutorName}.\n\nPlease ensure the student is ready 5 minutes prior on Zoom.\nMay Allah grant barakah in their Quran journey!\n\nIslamic Tuition Academy`;

  const [message, setMessage] = useState(defaultMessage);
  const [phoneNumber, setPhoneNumber] = useState(parentPhone);
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  // Helper to trigger direct WhatsApp redirection
  const handleOpenWhatsApp = () => {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const encodedMsg = encodeURIComponent(message);
    const waUrl = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodedMsg}`
      : `https://wa.me/?text=${encodedMsg}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await onSendSms(student.studentId, phoneNumber, message);
      setSentSuccess(true);
      setTimeout(() => {
        setSentSuccess(false);
        onClose();
      }, 1800);
    } catch (err: any) {
      alert('Failed to send SMS reminder: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-[#E3DFD7] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#1E5C3D] text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="p-1.5 rounded-lg bg-white/10">
              <MessageSquare className="w-5 h-5 text-[#E8A93E]" />
            </span>
            <div>
              <h3 className="font-bold text-base">Trial Class Reminder</h3>
              <p className="text-xs text-[#b8dbca]">Send via WhatsApp or SMS to prospective parent</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {sentSuccess ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto animate-bounce" />
            <h4 className="text-base font-bold text-[#161F1A]">SMS Reminder Dispatched!</h4>
            <p className="text-xs text-[#5A6B61]">
              Successfully sent trial reminder notification to <strong>{phoneNumber}</strong> for {student.name}.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Parent Phone / WhatsApp Number
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs font-mono font-bold bg-[#FAF9F7]"
                placeholder="e.g. +1 555 123 4567"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#161F1A]">
                  Reminder Message Body
                </label>
                <span className="text-[10px] text-[#5A6B61]">{message.length} chars</span>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="w-full border border-[#D5D0C6] rounded-lg p-3 text-xs leading-relaxed focus:ring-1 focus:ring-[#2D8B5C]"
                required
              />
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <span>💬 WhatsApp Direct Launch:</span>
              </div>
              <p className="text-[#335342]">
                Clicking <strong>Send on WhatsApp</strong> opens WhatsApp directly with the pre-filled reminder ready to send to the parent.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-[#5A6B61] hover:bg-gray-100 rounded-lg text-center cursor-pointer"
              >
                Cancel
              </button>

              {/* Direct WhatsApp Redirection Button */}
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="px-4 py-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-bold rounded-lg flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer transition-colors"
                title="Open WhatsApp with pre-filled message"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Send on WhatsApp</span>
              </button>

              {/* SMS Gateway button */}
              <button
                type="submit"
                disabled={sending || !phoneNumber.trim()}
                className="px-4 py-2 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-bold rounded-lg flex items-center justify-center space-x-1.5 shadow-xs disabled:opacity-50 cursor-pointer transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sending ? 'Sending...' : 'Log SMS Alert'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
