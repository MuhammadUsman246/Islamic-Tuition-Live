import React, { useState, useEffect } from 'react';
import {
  Lock,
  Mail,
  User,
  Phone,
  Globe,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  Info,
  LogOut,
  RefreshCw,
  KeyRound,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { registerSelfStudentOrParent } from '../../services/dataService';
import { CourseType, UserProfile } from '../../types';
import { SUPPORTED_COUNTRIES, COMMON_TIMEZONES, detectUserLocation } from '../../utils/timezone';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface AuthPortalProps {
  initialMode?: 'signin' | 'register';
}

export const AuthPortal: React.FC<AuthPortalProps> = ({ initialMode = 'signin' }) => {
  const {
    loginWithEmail,
    loginWithGoogle,
    resetPassword,
    userProfile,
    logout,
    checkApprovalStatus
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'register'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sign In Form State
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Self-Registration Form State (Student & Parent ONLY)
  const [regRole, setRegRole] = useState<'student' | 'parent'>('student');
  const [displayName, setDisplayName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [phone, setPhone] = useState('');
  
  // Auto-detect browser location & timezone on initial mount
  const detectedLoc = detectUserLocation();
  const [country, setCountry] = useState(detectedLoc.country);
  const [timezone, setTimezone] = useState(detectedLoc.timezone);
  const [courseType, setCourseType] = useState<CourseType>('Quran Reading / Nazra');
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Handle Country selection change: update country and preselect a default timezone for that country
  const handleCountryChange = (newCountryName: string) => {
    setCountry(newCountryName);
    const countryMatch = SUPPORTED_COUNTRIES.find(c => c.name === newCountryName);
    if (countryMatch) {
      // Check if current timezone belongs to new country, if not switch to default
      const currentBelongs = COMMON_TIMEZONES.some(t => t.value === timezone && t.country === newCountryName);
      if (!currentBelongs) {
        setTimezone(countryMatch.defaultTimezone);
      }
    }
  };

  // If the user is currently signed in but their status is pending_approval, render the Pending Approval screen!
  if (userProfile && userProfile.status === 'pending_approval') {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-2xl border border-[#E3DFD7] shadow-xl overflow-hidden">
          {/* Top Banner */}
          <div className="bg-[#163A29] p-6 text-white text-center relative">
            <div className="w-16 h-16 rounded-2xl bg-white/10 p-2 border border-white/20 flex items-center justify-center mx-auto mb-3 shadow-inner backdrop-blur-xs">
              <img
                src="/favicon.svg"
                alt="IslamicTuition Logo"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <h2 className="text-xl font-bold font-serif">Enrollment Under Review</h2>
            <p className="text-xs text-white/80 mt-1">
              Awaiting Academic Director Verification & Activation
            </p>
          </div>

          <div className="p-6 space-y-5 text-[#161F1A]">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <Info className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Account Status: Pending Admin Confirmation</span>
              </div>
              <p className="leading-relaxed">
                Welcome to <strong>IslamicTuition</strong>, {userProfile.displayName}. Your application has been logged in our institutional database.
              </p>
              <p className="leading-relaxed">
                To guarantee tutor quality and appropriate curriculum placement, student and parent accounts require confirmation by the Academic Director before dashboard features and class schedules unlock.
              </p>
            </div>

            <div className="bg-[#F8F7F4] p-4 rounded-xl border border-[#E8E4DC] text-xs space-y-2">
              <h4 className="font-semibold text-gray-700 uppercase tracking-wider text-[10px]">Submitted Profile Details</h4>
              <div className="grid grid-cols-2 gap-2 text-gray-800">
                <div>
                  <span className="text-gray-500 block text-[11px]">Full Name</span>
                  <span className="font-medium">{userProfile.displayName}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Registered Email</span>
                  <span className="font-medium truncate block">{userProfile.email}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Account Type</span>
                  <span className="capitalize font-medium">{userProfile.role}</span>
                </div>
                {userProfile.courseType && (
                  <div>
                    <span className="text-gray-500 block text-[11px]">Curriculum</span>
                    <span className="font-medium">{userProfile.courseType}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-500 block text-[11px]">Submission Time</span>
                  <span className="font-medium">
                    {userProfile.createdAt ? new Date(userProfile.createdAt).toLocaleDateString() : 'Just now'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <button
                type="button"
                onClick={async () => {
                  setCheckingStatus(true);
                  try {
                    await checkApprovalStatus();
                  } finally {
                    setCheckingStatus(false);
                  }
                }}
                disabled={checkingStatus}
                className="w-full py-2.5 px-4 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin' : ''}`} />
                <span>{checkingStatus ? 'Checking Live Status...' : 'Check Approval Status'}</span>
              </button>

              <button
                type="button"
                onClick={logout}
                className="w-full py-2.5 px-4 border border-[#D5D0C6] hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-medium flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-gray-500" />
                <span>Sign Out & Return Later</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await loginWithEmail(signInEmail.trim(), signInPassword, rememberMe);
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.message || 'Invalid email or password. Please verify your credentials or continue with Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Google sign in error:', err);
      setError(err.message || 'Google sign-in was cancelled or failed.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = resetEmail.trim() || signInEmail.trim();
    if (!targetEmail) {
      setError('Please enter your email address to receive password reset instructions.');
      return;
    }
    setResetLoading(true);
    setError(null);
    try {
      await resetPassword(targetEmail);
      setSuccessMsg(`Password reset email dispatched to ${targetEmail}. Please check your inbox.`);
      setShowResetModal(false);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || 'Could not send password reset email.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleSelfRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      await registerSelfStudentOrParent({
        email: regEmail.trim(),
        password: regPassword,
        displayName: displayName.trim(),
        role: regRole,
        phone: phone.trim(),
        country,
        timezone,
        courseType: regRole === 'student' ? courseType : undefined,
        parentName: regRole === 'student' ? parentName : undefined,
        parentEmail: regRole === 'student' ? parentEmail : undefined
      });

      setSuccessMsg('Registration submitted successfully! Your application is now awaiting Academic Director activation.');
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Failed to complete registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col justify-center py-6 sm:py-10 px-3 sm:px-6 lg:px-8 relative">
      {/* Top Floating PWA Install Button */}
      <div className="absolute top-4 right-4 z-10">
        <PWAInstallButton variant="compact" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-5 sm:mb-6">
        <div className="flex justify-center mb-3">
          <img
            src="/logo.svg"
            alt="Islamic Tuition - Online Quran Academy"
            className="h-16 sm:h-20 w-auto max-w-full object-contain filter drop-shadow-xs"
            referrerPolicy="no-referrer"
          />
        </div>
        <p className="mt-1 text-xs text-[#5A6B61] font-medium">
          Premier Online Quranic & Islamic Academic Institution
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white rounded-2xl border border-[#E3DFD7] shadow-sm overflow-hidden">
          {/* Navigation Tabs */}
          <div className="flex border-b border-[#E3DFD7] bg-[#F8F7F4]">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`flex-1 py-3.5 text-xs font-semibold text-center border-b-2 transition-all cursor-pointer ${
                mode === 'signin'
                  ? 'border-[#2D8B5C] text-[#2D8B5C] bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Sign In to Account
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 py-3.5 text-xs font-semibold text-center border-b-2 transition-all cursor-pointer ${
                mode === 'register'
                  ? 'border-[#2D8B5C] text-[#2D8B5C] bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Student / Parent Enrollment
            </button>
          </div>

          <div className="p-4 sm:p-8 space-y-5 sm:space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {mode === 'signin' ? (
              /* ================= SIGN IN FORM ================= */
              <div className="space-y-4 text-xs">
                {/* 1. Continue with Google */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-white hover:bg-gray-50 text-gray-700 border border-[#D5D0C6] rounded-xl font-medium flex items-center justify-center space-x-3 transition-all cursor-pointer shadow-2xs hover:shadow-xs disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-[#E3DFD7]" />
                  <span className="flex-shrink mx-3 text-gray-400 text-[10px] uppercase tracking-wider font-medium">
                    Or sign in with email & password
                  </span>
                  <div className="flex-grow border-t border-[#E3DFD7]" />
                </div>

                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="block font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        placeholder="e.g. dateandtimecalculator@gmail.com"
                        className="w-full pl-9 pr-3 py-2 border border-[#D5D0C6] rounded-xl focus:ring-2 focus:ring-[#2D8B5C]/20 focus:border-[#2D8B5C] outline-hidden bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-medium text-gray-700">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmail(signInEmail);
                          setShowResetModal(true);
                        }}
                        className="text-[11px] text-[#2D8B5C] hover:text-[#1E5C3D] hover:underline cursor-pointer font-medium"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        required
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-3 py-2 border border-[#D5D0C6] rounded-xl focus:ring-2 focus:ring-[#2D8B5C]/20 focus:border-[#2D8B5C] outline-hidden bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-0.5">
                    <label className="flex items-center space-x-2 cursor-pointer text-gray-600">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded-sm border-gray-300 text-[#2D8B5C] focus:ring-[#2D8B5C]"
                      />
                      <span className="text-xs">Remember this device</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !signInEmail.trim() || !signInPassword}
                    className="w-full py-2.5 px-4 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-xl font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Signing In...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              /* ================= REGISTRATION FORM (STUDENT / PARENT ONLY) ================= */
              <form onSubmit={handleSelfRegister} className="space-y-4 text-xs">
                {/* Role Switcher */}
                <div>
                  <label className="block font-semibold text-gray-700 mb-1.5">
                    Select Account Type
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setRegRole('student')}
                      className={`py-2.5 px-3 rounded-xl font-medium border text-xs transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                        regRole === 'student'
                          ? 'bg-[#2D8B5C] text-white border-[#2D8B5C] shadow-xs'
                          : 'bg-[#FAF9F7] text-gray-600 border-[#D5D0C6] hover:bg-gray-100 hover:text-gray-800'
                      }`}
                    >
                      <span>🎓</span>
                      <span>Student</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegRole('parent')}
                      className={`py-2.5 px-3 rounded-xl font-medium border text-xs transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                        regRole === 'parent'
                          ? 'bg-[#2D8B5C] text-white border-[#2D8B5C] shadow-xs'
                          : 'bg-[#FAF9F7] text-gray-600 border-[#D5D0C6] hover:bg-gray-100 hover:text-gray-800'
                      }`}
                    >
                      <span>👨‍👩‍👧</span>
                      <span>Parent / Guardian</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">
                    {regRole === 'student' ? 'Student Full Name' : 'Parent / Guardian Full Name'}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={regRole === 'student' ? 'e.g. Zayd Abdullah' : 'e.g. Dr. Tariq Khan'}
                      className="w-full pl-9 pr-3 py-2 border border-[#D5D0C6] rounded-xl focus:ring-2 focus:ring-[#2D8B5C]/20 focus:border-[#2D8B5C] outline-hidden bg-white text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="yourname@domain.com"
                        className="w-full pl-9 pr-3 py-2 border border-[#D5D0C6] rounded-xl focus:ring-2 focus:ring-[#2D8B5C]/20 focus:border-[#2D8B5C] outline-hidden bg-white text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full pl-9 pr-3 py-2 border border-[#D5D0C6] rounded-xl focus:ring-2 focus:ring-[#2D8B5C]/20 focus:border-[#2D8B5C] outline-hidden bg-white text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 555-0199"
                        className="w-full pl-9 pr-3 py-2 border border-[#D5D0C6] rounded-xl focus:ring-2 focus:ring-[#2D8B5C]/20 focus:border-[#2D8B5C] outline-hidden bg-white text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-gray-700 mb-1">
                      Country
                    </label>
                    <div className="relative">
                      <Globe className="w-4 h-4 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
                      <select
                        value={country}
                        onChange={(e) => handleCountryChange(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-[#D5D0C6] rounded-xl focus:ring-2 focus:ring-[#2D8B5C]/20 focus:border-[#2D8B5C] outline-hidden bg-white text-xs cursor-pointer truncate"
                      >
                        {SUPPORTED_COUNTRIES.map((c) => (
                          <option key={c.code} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-gray-700 mb-1 flex items-center justify-between">
                      <span>Timezone</span>
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-[#D5D0C6] rounded-xl focus:ring-2 focus:ring-[#2D8B5C]/20 focus:border-[#2D8B5C] outline-hidden bg-white text-xs cursor-pointer truncate font-mono text-[11px]"
                      >
                        {COMMON_TIMEZONES.map((tz) => (
                          <option key={tz.value} value={tz.value}>
                            {tz.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {regRole === 'student' && (
                  <div className="space-y-3 pt-1 border-t border-[#E3DFD7]">
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">
                        Quranic Course / Curriculum
                      </label>
                      <select
                        value={courseType}
                        onChange={(e) => setCourseType(e.target.value as CourseType)}
                        className="w-full px-3 py-2 border border-[#D5D0C6] rounded-xl bg-white text-xs focus:ring-2 focus:ring-[#2D8B5C]/20 focus:border-[#2D8B5C] outline-hidden"
                      >
                        <option value="Quran Reading / Nazra">Quran Reading / Nazra</option>
                        <option value="Noorani Qaida">Noorani Qaida (Beginner)</option>
                        <option value="Tajweed Rules">Tajweed & Phonetics</option>
                        <option value="Hifz (Memorization)">Hifz (Quran Memorization)</option>
                        <option value="Islamic Studies">Islamic Studies & Duas</option>
                        <option value="Urdu Language">Urdu Language</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-medium text-gray-700 mb-1">
                          Parent / Guardian Name (Optional)
                        </label>
                        <input
                          type="text"
                          value={parentName}
                          onChange={(e) => setParentName(e.target.value)}
                          placeholder="e.g. Tariq Khan"
                          className="w-full px-3 py-2 border border-[#D5D0C6] rounded-xl bg-white text-xs focus:ring-2 focus:ring-[#2D8B5C]/20 focus:border-[#2D8B5C] outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block font-medium text-gray-700 mb-1">
                          Parent Email Address (Optional)
                        </label>
                        <input
                          type="email"
                          value={parentEmail}
                          onChange={(e) => setParentEmail(e.target.value)}
                          placeholder="parent@family.org"
                          className="w-full px-3 py-2 border border-[#D5D0C6] rounded-xl bg-white text-xs focus:ring-2 focus:ring-[#2D8B5C]/20 focus:border-[#2D8B5C] outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-xl font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs disabled:opacity-50 mt-4"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Registration...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Registration</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E3DFD7] shadow-xl w-full max-w-md p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setShowResetModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#2D8B5C] flex items-center justify-center border border-emerald-100">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Reset Your Password</h3>
                <p className="text-xs text-gray-500">We will email you a secure link to reset your password</p>
              </div>
            </div>

            <form onSubmit={handlePasswordReset} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  Account Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Enter your registered email"
                    className="w-full pl-9 pr-3 py-2 border border-[#D5D0C6] rounded-xl focus:ring-2 focus:ring-[#2D8B5C]/20 focus:border-[#2D8B5C] outline-hidden bg-white text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2 border border-[#D5D0C6] rounded-xl text-gray-700 hover:bg-gray-50 font-medium transition-all cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading || !resetEmail.trim()}
                  className="px-4 py-2 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-xl font-semibold transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5 text-xs"
                >
                  {resetLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <span>Send Reset Email</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
