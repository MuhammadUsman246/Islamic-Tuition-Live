import React, { useState } from 'react';
import { 
  Bell, X, Megaphone, Calendar, CreditCard, Smartphone, 
  CheckCircle2, AlertTriangle, ArrowRight, BookOpen, Clock, Shield
} from 'lucide-react';
import { Announcement, StudentFee, TimetableClass, Lesson } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcements?: Announcement[];
  fees?: StudentFee[];
  classes?: TimetableClass[];
  lessons?: Lesson[];
  onNavigateTab?: (tab: string) => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  announcements = [],
  fees = [],
  classes = [],
  lessons = [],
  onNavigateTab
}) => {
  const { userProfile, activeRole } = useAuth();
  const [activeFilter, setActiveFilter] = useState<'all' | 'announcements' | 'classes' | 'billing'>('all');

  if (!isOpen) return null;

  // Filter relevant announcements for current role
  const relevantAnnouncements = announcements;

  // Filter billing notices for students / parents
  const pendingFees = (activeRole === 'student' || activeRole === 'parent')
    ? fees.filter(f => f.status === 'Pending' || f.status === 'Overdue')
    : [];

  const totalAlertsCount = relevantAnnouncements.length + pendingFees.length;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-end p-2 sm:p-4 md:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-md h-[90vh] max-h-[720px] rounded-2xl shadow-2xl border border-[#E3DFD7] flex flex-col overflow-hidden text-left animate-in slide-in-from-right-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#142C1E] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#2D8B5C] flex items-center justify-center text-white shadow-inner">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">Notification Center</h3>
              <p className="text-[11px] text-emerald-200">
                {totalAlertsCount} active updates & announcements
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-200 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close Notification Center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="bg-[#FAF9F7] px-4 py-2.5 border-b border-[#E3DFD7] flex items-center space-x-1.5 overflow-x-auto text-xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-[#2D8B5C] text-white shadow-xs'
                : 'bg-white text-[#5A6B61] border border-[#E3DFD7] hover:text-[#161F1A]'
            }`}
          >
            All ({totalAlertsCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('announcements')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              activeFilter === 'announcements'
                ? 'bg-[#2D8B5C] text-white shadow-xs'
                : 'bg-white text-[#5A6B61] border border-[#E3DFD7] hover:text-[#161F1A]'
            }`}
          >
            Announcements ({relevantAnnouncements.length})
          </button>
          {pendingFees.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilter('billing')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                activeFilter === 'billing'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
              }`}
            >
              Billing ({pendingFees.length})
            </button>
          )}
        </div>

        {/* Notifications Scroll List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* Mobile PWA Install Card Tip */}
          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs space-y-2">
            <div className="flex items-center space-x-2">
              <Smartphone className="w-4 h-4 text-[#2D8B5C] shrink-0" />
              <h4 className="font-bold text-[#142C1E]">Install IslamicTuition on your Phone</h4>
            </div>
            <p className="text-[11px] text-[#1E5C3D] leading-relaxed">
              Add the academy app directly to your iPhone or Android home screen for instant 1-click access and on-time class reminders.
            </p>
            <div className="pt-1">
              <PWAInstallButton variant="compact" />
            </div>
          </div>

          {/* Pending Fees Notices */}
          {(activeFilter === 'all' || activeFilter === 'billing') && pendingFees.map(fee => (
            <div 
              key={fee.id}
              className="bg-rose-50/90 border border-rose-200 p-3.5 rounded-xl text-xs space-y-2 border-l-4 border-l-rose-500 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-200 text-rose-900 uppercase">
                  Invoice Due
                </span>
                <span className="text-[10px] font-mono text-rose-800">Due: {fee.dueDate}</span>
              </div>
              <div>
                <p className="font-bold text-[#161F1A] text-sm">
                  {fee.currency} {fee.amount.toLocaleString()} — {fee.billingPeriod}
                </p>
                <p className="text-[11px] text-[#5A6B61] mt-0.5">
                  Invoice #{fee.invoiceNumber || fee.id.slice(0, 8)} for {fee.studentName}
                </p>
              </div>
              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => {
                    onNavigateTab(activeRole === 'parent' ? 'parent_fees' : 'student_fees');
                    onClose();
                  }}
                  className="inline-flex items-center space-x-1 font-bold text-[#2D8B5C] hover:underline text-[11px] cursor-pointer pt-1"
                >
                  <span>Open Fee & Payment Portal</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}

          {/* Announcements Feed */}
          {(activeFilter === 'all' || activeFilter === 'announcements') && (
            relevantAnnouncements.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#5A6B61] italic bg-[#FAF9F7] rounded-xl border border-[#E3DFD7]">
                No active announcements right now.
              </div>
            ) : (
              relevantAnnouncements.map(ann => (
                <div 
                  key={ann.id}
                  className="bg-white border border-[#E3DFD7] p-3.5 rounded-xl text-xs space-y-2 shadow-2xs hover:border-[#2D8B5C]/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-1.5">
                      <Megaphone className="w-3.5 h-3.5 text-[#E8A93E] shrink-0" />
                      <h4 className="font-bold text-[#161F1A] truncate">{ann.title}</h4>
                    </div>
                    <span className="text-[10px] text-[#8C5D08] font-semibold bg-[#FFF9ED] px-2 py-0.5 rounded border border-[#E8A93E]/30 shrink-0">
                      {ann.authorName || 'Director'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#2C3E34] leading-relaxed whitespace-pre-wrap">
                    {ann.content}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-[#5A6B61] pt-1 border-t border-[#EAE6DE]">
                    <span>Target: {Array.isArray(ann.targetRoles) ? ann.targetRoles.join(', ') : (ann.targetRole || 'All')}</span>
                    {ann.endDate && <span>Expires: {ann.endDate}</span>}
                  </div>
                </div>
              ))
            )
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#FAF9F7] p-3 border-t border-[#E3DFD7] text-center shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-white hover:bg-gray-100 text-[#161F1A] border border-[#D5D0C6] font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Close Notification Center
          </button>
        </div>
      </div>
    </div>
  );
};
