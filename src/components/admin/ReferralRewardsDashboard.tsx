import React, { useState } from 'react';
import {
  Share2,
  Plus,
  DollarSign,
  Gift,
  CheckCircle,
  Clock,
  User,
  Users,
  Search,
  Filter,
  ArrowUpRight,
  Download,
  Trash2,
  Edit2,
  Sparkles
} from 'lucide-react';
import { Referral, Student, StudentFee } from '../../types';

interface ReferralRewardsDashboardProps {
  referrals: Referral[];
  students: Student[];
  fees: StudentFee[];
  onAddReferral: () => void;
  onEditReferral: (referral: Referral) => void;
  onDeleteReferral: (id: string) => Promise<void>;
  onApplyDiscount: (referral: Referral) => Promise<void>;
  onMarkPaid: (referral: Referral) => Promise<void>;
}

export const ReferralRewardsDashboard: React.FC<ReferralRewardsDashboardProps> = ({
  referrals,
  students,
  fees,
  onAddReferral,
  onEditReferral,
  onDeleteReferral,
  onApplyDiscount,
  onMarkPaid
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pending' | 'Applied' | 'Paid'>('all');
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);

  // Filtered referrals
  const filteredReferrals = referrals.filter(ref => {
    const matchesSearch =
      ref.referrerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ref.referredStudentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ref.referredStudentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ref.notes && ref.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || ref.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate KPIs
  const totalReferralsCount = referrals.length;
  const totalRewardValueUSD = referrals.reduce((sum, r) => sum + (r.rewardAmount || 0), 0);
  const appliedCount = referrals.filter(r => r.status === 'Applied').length;
  const appliedValueUSD = referrals.filter(r => r.status === 'Applied').reduce((sum, r) => sum + (r.rewardAmount || 0), 0);
  const pendingCount = referrals.filter(r => r.status === 'Pending').length;
  const pendingValueUSD = referrals.filter(r => r.status === 'Pending').reduce((sum, r) => sum + (r.rewardAmount || 0), 0);
  const paidCount = referrals.filter(r => r.status === 'Paid').length;

  // Calculate Leaderboard by Referrer Name
  const referrerMap = new Map<string, { count: number; totalReward: number; appliedReward: number; currency: string }>();
  referrals.forEach(ref => {
    const key = ref.referrerName.trim() || 'Anonymous';
    const existing = referrerMap.get(key) || { count: 0, totalReward: 0, appliedReward: 0, currency: ref.currency || 'USD' };
    existing.count += 1;
    existing.totalReward += ref.rewardAmount || 0;
    if (ref.status === 'Applied') {
      existing.appliedReward += ref.rewardAmount || 0;
    }
    referrerMap.set(key, existing);
  });

  const topReferrers = Array.from(referrerMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.totalReward - a.totalReward);

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Referral ID', 'Referrer Name', 'Referred Student ID', 'Referred Student Name', 'Date', 'Status', 'Reward Currency', 'Reward Amount', 'Notes'];
    const rows = referrals.map(r => [
      r.id,
      `"${r.referrerName.replace(/"/g, '""')}"`,
      r.referredStudentId,
      `"${r.referredStudentName.replace(/"/g, '""')}"`,
      r.date,
      r.status,
      r.currency,
      r.rewardAmount,
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `IslamicTuition_Referral_Rewards_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E3DFD7] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <Share2 className="w-5 h-5 text-[#2D8B5C]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#161F1A]">Referral Rewards & Student Discount Management</h2>
              <p className="text-xs text-[#5A6B61]">
                Track student recommendations, auto-calculate fee discounts for qualifying referrers, and manage reward payouts.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white border border-[#D5D0C6] hover:bg-gray-50 text-xs font-semibold text-[#161F1A] rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={onAddReferral}
            className="px-4 py-2 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-bold rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Record New Referral</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#5A6B61] uppercase tracking-wider">Total Referrals</span>
            <span className="p-2 rounded-lg bg-[#2D8B5C]/10 text-[#2D8B5C]">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-[#161F1A] mt-2">{totalReferralsCount}</p>
          <p className="text-[11px] text-[#5A6B61] mt-1">
            <span>{topReferrers.length} active referring families</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#5A6B61] uppercase tracking-wider">Total Reward Value</span>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <Gift className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-emerald-800 mt-2">${totalRewardValueUSD.toLocaleString()}</p>
          <p className="text-[11px] text-emerald-700 font-medium mt-1">
            <span>Discounts & cash bonuses generated</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#5A6B61] uppercase tracking-wider">Discounts Applied</span>
            <span className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <CheckCircle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-blue-900 mt-2">${appliedValueUSD.toLocaleString()}</p>
          <p className="text-[11px] text-[#5A6B61] mt-1">
            <span>{appliedCount} discounts deducted from tuition fees</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#5A6B61] uppercase tracking-wider">Pending Settlement</span>
            <span className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-amber-800 mt-2">${pendingValueUSD.toLocaleString()}</p>
          <p className="text-[11px] text-amber-700 font-medium mt-1">
            <span>{pendingCount} rewards ready to be applied</span>
          </p>
        </div>
      </div>

      {/* Referrer Rankings Leaderboard */}
      {topReferrers.length > 0 && (
        <div className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-[#161F1A]">Qualifying Referrers & Accumulated Rewards</h3>
            </div>
            <span className="text-xs text-[#5A6B61]">Calculated based on verified student referrals</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topReferrers.slice(0, 6).map((refUser, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7] flex items-center justify-between hover:border-[#2D8B5C]/40 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                    idx === 0
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : idx === 1
                      ? 'bg-gray-200 text-gray-800 border border-gray-300'
                      : 'bg-emerald-50 text-emerald-800'
                  }`}>
                    #{idx + 1}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#161F1A]">{refUser.name}</h4>
                    <span className="text-[11px] text-[#5A6B61]">{refUser.count} student{refUser.count > 1 ? 's' : ''} referred</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-bold text-xs text-[#2D8B5C] block">
                    {refUser.currency} {refUser.totalReward}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {refUser.appliedReward > 0 ? `${refUser.currency} ${refUser.appliedReward} applied` : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Referrals Detailed Table */}
      <div className="bg-white rounded-xl border border-[#E3DFD7] shadow-xs overflow-hidden">
        {/* Table Filters Header */}
        <div className="p-4 sm:p-5 border-b border-[#EDEAE3] bg-[#FAF9F7] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-[#161F1A]">All Referral Records & Tuition Deductions</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              {filteredReferrals.length} items
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search referrer, student..."
                className="pl-8 pr-3 py-1.5 bg-white border border-[#D5D0C6] rounded-lg text-xs text-[#161F1A] placeholder-[#5A6B61] focus:ring-1 focus:ring-[#2D8B5C] w-48"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-white border border-[#D5D0C6] rounded-lg text-xs text-[#161F1A]"
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending (Needs Action)</option>
              <option value="Applied">Applied to Fee Invoice</option>
              <option value="Paid">Paid Out</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF9F7] border-b border-[#E3DFD7] text-[#5A6B61] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Referrer (Family/Student)</th>
                <th className="py-3 px-4">Referred New Student</th>
                <th className="py-3 px-4">Date Recorded</th>
                <th className="py-3 px-4">Reward Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Notes / Invoice Connection</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE6DE]">
              {filteredReferrals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#5A6B61]">
                    No referral records found. Click "Record New Referral" to track one.
                  </td>
                </tr>
              ) : (
                filteredReferrals.map(ref => {
                  const isProcessing = isProcessingId === ref.id;

                  return (
                    <tr key={ref.id} className="hover:bg-[#FAF9F7]/60 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-[#161F1A] block">{ref.referrerName}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-[#161F1A] block">{ref.referredStudentName}</span>
                        <span className="font-mono text-[10px] text-[#2D8B5C]">{ref.referredStudentId}</span>
                      </td>

                      <td className="py-3 px-4 font-mono text-[#5A6B61]">
                        {ref.date}
                      </td>

                      <td className="py-3 px-4 font-bold text-[#2D8B5C]">
                        {ref.currency} {ref.rewardAmount}
                      </td>

                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          ref.status === 'Applied'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ref.status === 'Paid'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {ref.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-[#5A6B61] max-w-xs truncate">
                        {ref.notes || 'Tuition discount credit'}
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5">
                        {ref.status === 'Pending' && (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={async () => {
                              setIsProcessingId(ref.id);
                              try {
                                await onApplyDiscount(ref);
                              } finally {
                                setIsProcessingId(null);
                              }
                            }}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-md transition-colors cursor-pointer border border-emerald-200"
                            title="Apply this discount to the student's tuition fee invoice"
                          >
                            Apply Discount
                          </button>
                        )}

                        {ref.status !== 'Paid' && (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={async () => {
                              setIsProcessingId(ref.id);
                              try {
                                await onMarkPaid(ref);
                              } finally {
                                setIsProcessingId(null);
                              }
                            }}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold rounded-md transition-colors cursor-pointer border border-blue-200"
                            title="Mark as paid out in cash/transfer"
                          >
                            Mark Paid
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onEditReferral(ref)}
                          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-md transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteReferral(ref.id)}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
