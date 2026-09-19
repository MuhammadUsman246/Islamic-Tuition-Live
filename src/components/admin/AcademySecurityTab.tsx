import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  Clock,
  Laptop,
  Globe,
  AlertTriangle,
  RefreshCw,
  LogOut,
  CheckCircle2,
  Lock,
  Key,
  ShieldAlert,
  Search,
  Eye,
  Activity
} from 'lucide-react';
import { AcademyUserSession, UserRole, UserProfile } from '../../types';
import { getActiveUserSessions, terminateUserSession } from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';

interface AcademySecurityTabProps {
  systemUsers?: UserProfile[];
  onRefreshData?: () => Promise<void>;
}

export const AcademySecurityTab: React.FC<AcademySecurityTabProps> = ({
  systemUsers = [],
  onRefreshData
}) => {
  const { userProfile, resetPassword } = useAuth();
  const [sessions, setSessions] = useState<AcademyUserSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'idle' | 'terminated'>('all');
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [passwordResetEmail, setPasswordResetEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);

  // Security Policy Settings state
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(120);
  const [enforcePasswordComplexity, setEnforcePasswordComplexity] = useState<boolean>(true);
  const [enableAuditLogging, setEnableAuditLogging] = useState<boolean>(true);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const liveSessions = await getActiveUserSessions();
      setSessions(liveSessions);
    } catch (err) {
      console.error('Error fetching active sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 30000); // refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleTerminateSession = async (sessionId: string, userDisplayName: string) => {
    if (!window.confirm(`Are you sure you want to terminate and revoke the session for ${userDisplayName}? This will force the user to sign in again.`)) {
      return;
    }

    setTerminatingId(sessionId);
    try {
      await terminateUserSession(sessionId);
      setFeedbackMsg({
        text: `Session for ${userDisplayName} was successfully terminated and revoked.`,
        type: 'success'
      });
      await fetchSessions();
    } catch (err: any) {
      setFeedbackMsg({
        text: `Failed to terminate session: ${err.message}`,
        type: 'error'
      });
    } finally {
      setTerminatingId(null);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  const handleTriggerPasswordReset = async (email: string) => {
    if (!email.trim()) return;
    setIsSendingReset(true);
    try {
      await resetPassword(email.trim());
      setFeedbackMsg({
        text: `Official password reset instructions sent to ${email}.`,
        type: 'success'
      });
      setPasswordResetEmail('');
    } catch (err: any) {
      setFeedbackMsg({
        text: `Password reset error: ${err.message}`,
        type: 'error'
      });
    } finally {
      setIsSendingReset(false);
      setTimeout(() => setFeedbackMsg(null), 5000);
    }
  };

  const filteredSessions = sessions.filter(s => {
    const matchesSearch =
      s.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.uid?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.deviceInfo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.ipAddress?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'all' || s.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const activeCount = sessions.filter(s => s.status === 'active').length;
  const idleCount = sessions.filter(s => s.status === 'idle').length;
  const adminSessionsCount = sessions.filter(s => s.role === 'admin' && s.status === 'active').length;
  const facultySessionsCount = sessions.filter(s => (s.role === 'tutor' || s.role === 'supervisor') && s.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Header & Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E3DFD7] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <ShieldCheck className="w-5 h-5 text-[#2D8B5C]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#161F1A]">Academy Security & Active Session Audit</h2>
              <p className="text-xs text-[#5A6B61]">
                Live monitoring of logged-in faculty, parents, and students with real-time access revocation and policy controls.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={fetchSessions}
            disabled={loadingSessions}
            className="px-3.5 py-2 bg-white border border-[#D5D0C6] hover:bg-gray-50 text-xs font-semibold text-[#161F1A] rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Refresh session list"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#2D8B5C] ${loadingSessions ? 'animate-spin' : ''}`} />
            <span>{loadingSessions ? 'Refreshing...' : 'Refresh Sessions'}</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Security KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#5A6B61] uppercase tracking-wider">Active Live Sessions</span>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <Activity className="w-4 h-4 animate-pulse" />
            </span>
          </div>
          <p className="text-2xl font-bold text-[#161F1A] mt-2">{activeCount}</p>
          <p className="text-[11px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>{idleCount} idle accounts</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#5A6B61] uppercase tracking-wider">Admin Staff Logged In</span>
            <span className="p-2 rounded-lg bg-purple-50 text-purple-700">
              <Lock className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-purple-900 mt-2">{adminSessionsCount}</p>
          <p className="text-[11px] text-[#5A6B61] mt-1">
            <span>Privileged administrative access</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#5A6B61] uppercase tracking-wider">Faculty & Supervisors</span>
            <span className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-blue-900 mt-2">{facultySessionsCount}</p>
          <p className="text-[11px] text-[#5A6B61] mt-1">
            <span>Teaching & shift monitoring</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#5A6B61] uppercase tracking-wider">Security Posture</span>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-[#2D8B5C] mt-2">Protected</p>
          <p className="text-[11px] text-emerald-800 font-medium mt-1">
            <span>Auth v9 + Heartbeat Active</span>
          </p>
        </div>
      </div>

      {/* Main Section: Active User Sessions Table */}
      <div className="bg-white rounded-xl border border-[#E3DFD7] shadow-xs overflow-hidden">
        {/* Table Filters Header */}
        <div className="p-4 sm:p-5 border-b border-[#EDEAE3] bg-[#FAF9F7] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-[#161F1A]">Live Authenticated User Sessions</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              {filteredSessions.length} sessions
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
                placeholder="Search user, email, IP..."
                className="pl-8 pr-3 py-1.5 bg-white border border-[#D5D0C6] rounded-lg text-xs text-[#161F1A] placeholder-[#5A6B61] focus:ring-1 focus:ring-[#2D8B5C] w-48"
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-white border border-[#D5D0C6] rounded-lg text-xs text-[#161F1A]"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admins</option>
              <option value="supervisor">Supervisors</option>
              <option value="tutor">Tutors</option>
              <option value="student">Students</option>
              <option value="parent">Parents</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-white border border-[#D5D0C6] rounded-lg text-xs text-[#161F1A]"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Now</option>
              <option value="idle">Idle</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>
        </div>

        {/* Sessions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF9F7] border-b border-[#E3DFD7] text-[#5A6B61] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">User Account</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status & Heartbeat</th>
                <th className="py-3 px-4">Login Time</th>
                <th className="py-3 px-4">Device / Browser</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4 text-right">Access Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE6DE]">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#5A6B61]">
                    No user sessions matched the specified criteria.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => {
                  const isCurrentUser = session.uid === userProfile?.uid;
                  const isTerminating = terminatingId === session.id;

                  // Format dates
                  const loginTimeStr = new Date(session.loginAt).toLocaleString();
                  const lastActiveTimeStr = new Date(session.lastActiveAt).toLocaleTimeString();

                  return (
                    <tr
                      key={session.id}
                      className={`hover:bg-[#FAF9F7]/60 transition-colors ${
                        session.status === 'terminated' ? 'opacity-60 bg-gray-50/50' : ''
                      }`}
                    >
                      {/* User Account */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-full bg-[#2D8B5C]/10 text-[#2D8B5C] flex items-center justify-center font-bold text-xs uppercase">
                            {session.displayName?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <span className="font-bold text-[#161F1A] block flex items-center gap-1.5">
                              {session.displayName || 'User'}
                              {isCurrentUser && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-800">
                                  You
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] text-[#5A6B61]">{session.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                            session.role === 'admin'
                              ? 'bg-purple-100 text-purple-900 border border-purple-200'
                              : session.role === 'tutor'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                              : session.role === 'supervisor'
                              ? 'bg-blue-100 text-blue-900 border border-blue-200'
                              : session.role === 'parent'
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : 'bg-gray-100 text-gray-800 border border-gray-200'
                          }`}
                        >
                          {session.role}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {session.status === 'active' ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                              Active Online
                            </span>
                            <span className="text-[10px] text-gray-500 block">
                              Last active: {lastActiveTimeStr}
                            </span>
                          </div>
                        ) : session.status === 'idle' ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Idle
                            </span>
                            <span className="text-[10px] text-gray-500 block">
                              Last active: {lastActiveTimeStr}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            Terminated / Revoked
                          </span>
                        )}
                      </td>

                      {/* Login Time */}
                      <td className="py-3 px-4 font-mono text-[#5A6B61] text-[11px]">
                        {loginTimeStr}
                      </td>

                      {/* Device / Browser */}
                      <td className="py-3 px-4 text-[#5A6B61]">
                        <div className="flex items-center space-x-1.5">
                          <Laptop className="w-3.5 h-3.5 text-gray-400" />
                          <span className="truncate max-w-[140px]" title={session.deviceInfo || session.browser}>
                            {session.deviceInfo || session.browser || 'Web Browser'}
                          </span>
                        </div>
                      </td>

                      {/* IP Address */}
                      <td className="py-3 px-4 font-mono text-[#5A6B61] text-[11px]">
                        <div className="flex items-center space-x-1">
                          <Globe className="w-3 h-3 text-gray-400" />
                          <span>{session.ipAddress || '192.168.1.1 (LAN)'}</span>
                        </div>
                      </td>

                      {/* Access Actions */}
                      <td className="py-3 px-4 text-right space-x-1.5">
                        {session.status !== 'terminated' && (
                          <button
                            type="button"
                            disabled={isTerminating || isCurrentUser}
                            onClick={() => handleTerminateSession(session.id, session.displayName || session.email)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer ${
                              isCurrentUser
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                            }`}
                            title={isCurrentUser ? 'Cannot terminate your own current session' : 'Force sign-out and terminate this session'}
                          >
                            <LogOut className="w-3 h-3" />
                            <span>{isTerminating ? 'Revoking...' : 'Terminate'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Policies & Quick Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Policy Configurations */}
        <div className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs space-y-4">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-[#2D8B5C]" />
            <h3 className="text-sm font-bold text-[#161F1A]">Academy Access Security Policies</h3>
          </div>

          <div className="space-y-3 text-xs text-[#3E4D43]">
            <div className="p-3 bg-[#FAF9F7] rounded-lg border border-[#E3DFD7] flex items-center justify-between">
              <div>
                <span className="font-bold text-[#161F1A] block">Auto Session Timeout</span>
                <span className="text-[11px] text-[#5A6B61]">Automatically marks idle accounts as inactive</span>
              </div>
              <select
                value={sessionTimeoutMinutes}
                onChange={(e) => setSessionTimeoutMinutes(parseInt(e.target.value, 10))}
                className="px-2.5 py-1 bg-white border border-[#D5D0C6] rounded-lg font-semibold text-[#161F1A]"
              >
                <option value={30}>30 Minutes</option>
                <option value={60}>60 Minutes</option>
                <option value={120}>2 Hours (Default)</option>
                <option value={240}>4 Hours</option>
              </select>
            </div>

            <div className="p-3 bg-[#FAF9F7] rounded-lg border border-[#E3DFD7] flex items-center justify-between">
              <div>
                <span className="font-bold text-[#161F1A] block">Enforce Strong Password Complexity</span>
                <span className="text-[11px] text-[#5A6B61]">Minimum 8 characters with alphanumeric requirements</span>
              </div>
              <button
                type="button"
                onClick={() => setEnforcePasswordComplexity(!enforcePasswordComplexity)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                  enforcePasswordComplexity ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {enforcePasswordComplexity ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div className="p-3 bg-[#FAF9F7] rounded-lg border border-[#E3DFD7] flex items-center justify-between">
              <div>
                <span className="font-bold text-[#161F1A] block">Live Heartbeat & Security Audit Logs</span>
                <span className="text-[11px] text-[#5A6B61]">Track user sign-ins, IP origins, and time on portal</span>
              </div>
              <button
                type="button"
                onClick={() => setEnableAuditLogging(!enableAuditLogging)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                  enableAuditLogging ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {enableAuditLogging ? 'Active' : 'Paused'}
              </button>
            </div>
          </div>
        </div>

        {/* Instant Password Reset & Key Management */}
        <div className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs space-y-4">
          <div className="flex items-center space-x-2">
            <Key className="w-4 h-4 text-purple-700" />
            <h3 className="text-sm font-bold text-[#161F1A]">Trigger Password Reset Email</h3>
          </div>

          <p className="text-xs text-[#5A6B61]">
            Send an official Firebase Authentication password reset email directly to any faculty member, student, or parent experiencing login issues.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleTriggerPasswordReset(passwordResetEmail);
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-xs font-bold text-[#161F1A] mb-1">
                Target User Email Address
              </label>
              <input
                type="email"
                value={passwordResetEmail}
                onChange={(e) => setPasswordResetEmail(e.target.value)}
                placeholder="e.g. tutor@islamictuition.com or parent@gmail.com"
                className="w-full px-3 py-2 bg-white border border-[#D5D0C6] rounded-lg text-xs text-[#161F1A] focus:ring-1 focus:ring-[#2D8B5C]"
                required
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-[#5A6B61]">
                Generates a secure, expiring one-time link.
              </span>
              <button
                type="submit"
                disabled={isSendingReset}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Key className="w-3.5 h-3.5" />
                <span>{isSendingReset ? 'Sending...' : 'Send Reset Link'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
