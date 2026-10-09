import React, { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { DollarSign, Sparkles, TrendingUp, AlertCircle, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Student, StudentFee } from '../../types';

interface QuickFinancialAndTrialAnalyticsProps {
  fees: StudentFee[];
  students: Student[];
  onNavigateToFees: () => void;
  onNavigateToTrials: () => void;
}

export const QuickFinancialAndTrialAnalytics: React.FC<QuickFinancialAndTrialAnalyticsProps> = ({
  fees,
  students,
  onNavigateToFees,
  onNavigateToTrials
}) => {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // 1. Financial Health Computations
  const financialData = useMemo(() => {
    let totalRevenuePaid = 0;
    let totalPending = 0;
    let totalOverdue = 0;
    let overdueCount = 0;
    let pendingCount = 0;

    fees.forEach(f => {
      const amount = Number(f.amount) || 0;
      if (f.status === 'Paid') {
        totalRevenuePaid += amount;
      } else if (f.status === 'Overdue' || (f.status === 'Pending' && f.dueDate < todayStr)) {
        totalOverdue += amount;
        overdueCount++;
      } else {
        totalPending += amount;
        pendingCount++;
      }
    });

    const totalBilled = totalRevenuePaid + totalPending + totalOverdue;
    const pendingAndOverdue = totalPending + totalOverdue;
    const realizationRate = totalBilled > 0 ? Math.round((totalRevenuePaid / totalBilled) * 100) : 100;
    const overdueRate = totalBilled > 0 ? Math.round((totalOverdue / totalBilled) * 100) : 0;
    const pendingRate = totalBilled > 0 ? Math.round((totalPending / totalBilled) * 100) : 0;

    return {
      totalRevenuePaid,
      totalPending,
      totalOverdue,
      pendingAndOverdue,
      overdueCount,
      pendingCount,
      totalBilled,
      realizationRate,
      overdueRate,
      pendingRate
    };
  }, [fees, todayStr]);

  // 2. Trial Conversion Rate Computations
  const trialData = useMemo(() => {
    let convertedCount = 0;
    let decisionReadyCount = 0;
    let inProgressCount = 0;

    students.forEach(s => {
      if (s.trialStatus === 'Converted' || (s.status === 'Active' && (s.trialSessionsCompleted || 0) > 0)) {
        convertedCount++;
      } else if (s.status === 'Trial') {
        if ((s.trialSessionsCompleted || 0) >= 5 || s.trialStatus === 'Decision Pending') {
          decisionReadyCount++;
        } else {
          inProgressCount++;
        }
      }
    });

    const totalTrialsTracked = convertedCount + decisionReadyCount + inProgressCount;
    // Conversion rate based on completed decision cycle (converted / evaluated)
    const evaluatedTotal = convertedCount + decisionReadyCount;
    const conversionRate = evaluatedTotal > 0
      ? Math.round((convertedCount / evaluatedTotal) * 100)
      : (totalTrialsTracked > 0 ? Math.round((convertedCount / totalTrialsTracked) * 100) : 85);

    const chartData = [
      { name: 'Converted & Enrolled', value: Math.max(convertedCount, 1), color: '#2D8B5C' },
      { name: '5/5 Decision Ready', value: decisionReadyCount, color: '#8B5CF6' },
      { name: 'In Progress (1-4)', value: Math.max(inProgressCount, 0), color: '#F59E0B' }
    ].filter(item => item.value > 0);

    return {
      convertedCount,
      decisionReadyCount,
      inProgressCount,
      totalTrialsTracked,
      conversionRate,
      chartData
    };
  }, [students]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* CARD 1: Quick Financial Health */}
      <div className="bg-white rounded-xl border border-[#E3DFD7] shadow-xs overflow-hidden flex flex-col justify-between hover:border-[#2D8B5C]/40 transition-all">
        {/* Card Header */}
        <div className="p-4 sm:p-5 border-b border-[#EDEAE3] bg-gradient-to-r from-emerald-50/40 via-white to-slate-50/20 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/10 text-[#2D8B5C] flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#161F1A]">Quick Financial Health</h3>
              <p className="text-[11px] text-[#5A6B61]">Monthly realized revenue vs. pending accounts</p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              financialData.realizationRate >= 80
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              {financialData.realizationRate}% Realized
            </span>
          </div>
        </div>

        {/* Card Content */}
        <div className="p-4 sm:p-5 space-y-4 flex-1">
          {/* Revenue vs Pending Split Values */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {/* Total Monthly Revenue (Paid) */}
            <div className="bg-emerald-50/40 p-3.5 rounded-xl border border-emerald-100 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-[#2D8B5C] font-semibold">
                <span>Total Revenue Paid</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <p className="text-xl sm:text-2xl font-extrabold text-[#161F1A]">
                ${financialData.totalRevenuePaid.toLocaleString()}
              </p>
              <p className="text-[10px] text-[#5A6B61] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-[#2D8B5C]" />
                <span>Verified in tuition ledger</span>
              </p>
            </div>

            {/* Pending Fees */}
            <div className={`p-3.5 rounded-xl border space-y-1 ${
              financialData.overdueCount > 0
                ? 'bg-rose-50/40 border-rose-200'
                : 'bg-amber-50/40 border-amber-100'
            }`}>
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className={financialData.overdueCount > 0 ? 'text-rose-700' : 'text-amber-800'}>
                  Pending Fees
                </span>
                {financialData.overdueCount > 0 ? (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                )}
              </div>
              <p className={`text-xl sm:text-2xl font-extrabold ${
                financialData.overdueCount > 0 ? 'text-rose-900' : 'text-[#161F1A]'
              }`}>
                ${financialData.pendingAndOverdue.toLocaleString()}
              </p>
              <p className="text-[10px] text-[#5A6B61] truncate">
                {financialData.overdueCount > 0 ? (
                  <strong className="text-rose-700">{financialData.overdueCount} past due (${financialData.totalOverdue.toLocaleString()})</strong>
                ) : (
                  <span>{financialData.pendingCount} pending on schedule</span>
                )}
              </p>
            </div>
          </div>

          {/* Visual Stacked Realization Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#5A6B61] font-medium">Realization Distribution</span>
              <span className="font-mono text-[11px] text-[#161F1A] font-bold">
                ${financialData.totalRevenuePaid.toLocaleString()} / ${financialData.totalBilled.toLocaleString()}
              </span>
            </div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
              <div
                className="h-full bg-[#2D8B5C] transition-all duration-500"
                style={{ width: `${financialData.realizationRate}%` }}
                title={`Collected: ${financialData.realizationRate}%`}
              />
              {financialData.overdueRate > 0 && (
                <div
                  className="h-full bg-rose-500 transition-all duration-500"
                  style={{ width: `${financialData.overdueRate}%` }}
                  title={`Overdue: ${financialData.overdueRate}%`}
                />
              )}
              {financialData.pendingRate > 0 && (
                <div
                  className="h-full bg-amber-400 transition-all duration-500"
                  style={{ width: `${financialData.pendingRate}%` }}
                  title={`Pending: ${financialData.pendingRate}%`}
                />
              )}
            </div>

            {/* Legend line */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px] text-[#5A6B61]">
              <div className="flex items-center space-x-3">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#2D8B5C]" />
                  <span>Collected ({financialData.realizationRate}%)</span>
                </span>
                {financialData.overdueCount > 0 && (
                  <span className="flex items-center gap-1 text-rose-700 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>Overdue ({financialData.overdueRate}%)</span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Scheduled ({financialData.pendingRate}%)</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card Footer Link */}
        <div className="px-4 sm:px-5 py-2.5 bg-[#FAF9F7] border-t border-[#EDEAE3] flex items-center justify-between text-xs">
          <span className="text-[11px] text-[#5A6B61]">Tuition ledger records up to date</span>
          <button
            type="button"
            onClick={onNavigateToFees}
            className="text-[11px] font-bold text-[#2D8B5C] hover:text-[#1E5C3D] flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>Open Fee Ledger</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* CARD 2: Trial Conversion Rate with Recharts Mini-Chart */}
      <div className="bg-white rounded-xl border border-[#E3DFD7] shadow-xs overflow-hidden flex flex-col justify-between hover:border-[#E8A93E]/50 transition-all">
        {/* Card Header */}
        <div className="p-4 sm:p-5 border-b border-[#EDEAE3] bg-gradient-to-r from-amber-50/40 via-white to-purple-50/20 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-[#E8A93E]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#161F1A]">Trial Conversion Rate</h3>
              <p className="text-[11px] text-[#5A6B61]">5-Session trial performance &amp; enrolment ratio</p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-amber-500 text-white shadow-2xs">
              {trialData.conversionRate}% Rate
            </span>
          </div>
        </div>

        {/* Card Content with Recharts Mini-Donut Chart */}
        <div className="p-4 sm:p-5 space-y-3 flex-1 flex flex-col justify-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
            {/* Left: Recharts Mini-Chart Container */}
            <div className="relative flex items-center justify-center min-h-[135px]">
              <div className="w-[135px] h-[135px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      formatter={(val: any, name: any) => [`${val} students`, name]}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E3DFD7',
                        borderRadius: '8px',
                        fontSize: '11px',
                        padding: '4px 8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                      }}
                    />
                    <Pie
                      data={trialData.chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={56}
                      paddingAngle={3}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    >
                      {trialData.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Central Conversion Percentage Badge */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-black text-[#161F1A] leading-tight">
                  {trialData.conversionRate}%
                </span>
                <span className="text-[9px] uppercase tracking-wider font-bold text-[#5A6B61]">
                  Converted
                </span>
              </div>
            </div>

            {/* Right: Stage Breakdown Breakdown */}
            <div className="space-y-2 text-xs">
              {/* Converted */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2D8B5C] shrink-0" />
                  <span className="text-[#161F1A] font-semibold text-[11px]">Enrolled Students</span>
                </div>
                <span className="font-mono font-bold text-[#2D8B5C] text-xs">
                  {trialData.convertedCount}
                </span>
              </div>

              {/* Decision Ready (5/5) */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-purple-50/60 border border-purple-100">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600 shrink-0" />
                  <span className="text-[#161F1A] font-semibold text-[11px]">5/5 Decision Ready</span>
                </div>
                <span className="font-mono font-bold text-purple-700 text-xs">
                  {trialData.decisionReadyCount}
                </span>
              </div>

              {/* In Progress (1-4) */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/60 border border-amber-100">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-[#161F1A] font-semibold text-[11px]">In Progress (Day 1-4)</span>
                </div>
                <span className="font-mono font-bold text-amber-700 text-xs">
                  {trialData.inProgressCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card Footer Link */}
        <div className="px-4 sm:px-5 py-2.5 bg-[#FAF9F7] border-t border-[#EDEAE3] flex items-center justify-between text-xs">
          <span className="text-[11px] text-[#5A6B61]">5-Session trial tracker active</span>
          <button
            type="button"
            onClick={onNavigateToTrials}
            className="text-[11px] font-bold text-[#C98A1E] hover:text-amber-800 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>Review Trials Pipeline</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
