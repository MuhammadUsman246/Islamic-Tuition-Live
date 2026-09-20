import React, { useState } from 'react';
import { ShieldAlert, Lock, Eye, EyeOff, Loader2, LogOut, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AdminLogoutAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminLogoutAuthModal: React.FC<AdminLogoutAuthModalProps> = ({
  isOpen,
  onClose
}) => {
  const { confirmAdminLogout, userProfile } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter the administrator password.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const isAuthorized = await confirmAdminLogout(password);
      if (!isAuthorized) {
        setError('Incorrect administrator password. Sign out prohibited.');
      } else {
        // Logout succeeded; modal will unmount as auth state clears
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Authorization failed. Please re-enter the director password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setPassword('');
    setError(null);
    onClose();
  };

  return (
    <div
      id="admin_logout_auth_modal_backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="admin_logout_auth_modal"
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-rose-200 overflow-hidden text-[#161F1A]"
      >
        {/* Header with Warning Accent */}
        <div className="bg-gradient-to-r from-rose-900 to-[#14231b] p-5 text-white flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-rose-300" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight">
                Admin Authorization Required
              </h3>
              <p className="text-[11px] text-rose-200 mt-0.5">
                Faculty Terminal Protection • {userProfile?.tutorId || 'Tutor'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="p-1 rounded-lg hover:bg-white/10 text-rose-200 hover:text-white transition-colors cursor-pointer"
            title="Close dialog"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 leading-relaxed space-y-1">
            <p className="font-semibold flex items-center gap-1.5 text-amber-950">
              <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>Sign-Out is Restricted</span>
            </p>
            <p>
              Tutors cannot log out from this teaching station to prevent accidental session drops. To sign out, an <strong>Academic Director or Administrator</strong> must enter their password.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2 animate-in fade-in">
              <span className="w-2 h-2 rounded-full bg-rose-600 mt-1 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="admin_auth_password_input"
              className="block text-xs font-bold text-[#161F1A] uppercase tracking-wider"
            >
              Administrator / Director Password
            </label>
            <div className="relative">
              <input
                id="admin_auth_password_input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password to authorize sign out"
                autoFocus
                disabled={isSubmitting}
                className="w-full px-3 py-2 pr-10 text-xs sm:text-sm border border-[#D5D0C6] rounded-xl bg-[#FAF9F7] text-[#161F1A] focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A6B61] hover:text-[#161F1A] cursor-pointer"
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-gray-500">
              Only authorized Academy Directors can sign out this terminal.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#5A6B61] hover:text-[#161F1A] hover:bg-[#FAF9F7] border border-[#D5D0C6] transition-colors cursor-pointer"
            >
              Cancel (Stay Logged In)
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-xs flex items-center space-x-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4" />
                  <span>Authorize Sign Out</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
