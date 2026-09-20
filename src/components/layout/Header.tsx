import React from 'react';
import { LogOut, Eye, Menu, PanelLeftClose } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Tutor, Student } from '../../types';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface HeaderProps {
  title: string;
  subtitle?: string;
  tutors?: Tutor[];
  students?: Student[];
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  tutors = [],
  students = [],
  isSidebarOpen = true,
  onToggleSidebar
}) => {
  const {
    userProfile,
    activeRole,
    actualRole,
    adminViewingRole,
    adminViewingTargetId,
    setAdminViewingRole,
    logout
  } = useAuth();

  const handlePersonaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'admin') {
      setAdminViewingRole(null, null);
    } else if (val === 'supervisor') {
      setAdminViewingRole('supervisor', null);
    } else if (val.startsWith('tutor_')) {
      const tutorId = val.substring('tutor_'.length);
      setAdminViewingRole('tutor', tutorId);
    } else if (val.startsWith('student_')) {
      const studentId = val.substring('student_'.length);
      setAdminViewingRole('student', studentId);
    } else if (val.startsWith('parent_')) {
      const parentId = val.substring('parent_'.length);
      setAdminViewingRole('parent', parentId);
    }
  };

  const isRealAdmin = actualRole === 'admin';

  // Compute active select value
  const selectedValue = adminViewingRole === 'tutor'
    ? `tutor_${adminViewingTargetId || ''}`
    : adminViewingRole === 'student'
      ? `student_${adminViewingTargetId || ''}`
      : adminViewingRole === 'parent'
        ? `parent_${adminViewingTargetId || ''}`
        : adminViewingRole === 'supervisor'
          ? 'supervisor'
          : 'admin';

  // Unique Parents list derived from real students
  const parentList = React.useMemo(() => {
    const seen = new Set<string>();
    const list: { id: string; name: string; studentName: string }[] = [];
    students.forEach(s => {
      if (s.parentName) {
        const pKey = s.parentId || s.parentEmail || s.parentName;
        if (!seen.has(pKey)) {
          seen.add(pKey);
          list.push({
            id: s.parentId || s.studentId,
            name: s.parentName,
            studentName: s.name
          });
        }
      }
    });
    return list;
  }, [students]);

  return (
    <header
      id="portal_header"
      className="bg-white border-b border-[#E3DFD7] px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between sticky top-0 z-20 shadow-xs gap-2"
    >
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
        {onToggleSidebar && (
          <button
            type="button"
            id="header_toggle_sidebar_button"
            onClick={onToggleSidebar}
            className={`min-h-[38px] min-w-[38px] p-2 sm:px-2.5 sm:py-1.5 rounded-lg border transition-colors cursor-pointer flex items-center justify-center space-x-1.5 text-xs font-semibold shrink-0 shadow-2xs ${
              isSidebarOpen
                ? 'border-[#D5D0C6] bg-white hover:bg-[#FAF9F7] text-[#5A6B61]'
                : 'border-[#2D8B5C] bg-emerald-50 hover:bg-emerald-100 text-[#1E5C3D]'
            }`}
            title={isSidebarOpen ? "Hide Options/Settings Menu" : "Show Options/Settings Menu"}
            aria-label="Toggle Options/Settings Menu"
          >
            {isSidebarOpen ? (
              <>
                <PanelLeftClose className="w-4 h-4 text-[#5A6B61]" />
                <span className="hidden md:inline">Hide Options</span>
              </>
            ) : (
              <>
                <Menu className="w-4 h-4 text-[#2D8B5C]" />
                <span className="text-xs font-bold text-[#1E5C3D] hidden sm:inline">Show Options</span>
              </>
            )}
          </button>
        )}

        {!isSidebarOpen && (
          <div className="hidden sm:flex items-center space-x-2 pl-1 border-r border-gray-200 pr-3 mr-1">
            <img
              src="/favicon.svg"
              alt="IslamicTuition Emblem"
              className="w-7 h-7 object-contain"
              referrerPolicy="no-referrer"
            />
            <span className="font-bold text-xs text-[#1E5C3D] hidden lg:inline tracking-tight">IslamicTuition</span>
          </div>
        )}

        <div className="min-w-0">
          <h2 className="text-sm sm:text-base lg:text-lg font-bold text-[#161F1A] tracking-tight truncate">{title}</h2>
          {subtitle && <p className="text-[11px] sm:text-xs text-[#5A6B61] mt-0.5 truncate hidden md:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
        {/* PWA App Install Button */}
        <PWAInstallButton variant="compact" />

        {/* Admin Real-User Switching / Inspection Mode (STRICTLY ADMIN ONLY) */}
        {isRealAdmin && (
          <div className="flex items-center space-x-1 sm:space-x-2 bg-amber-50/90 p-1 sm:p-1.5 rounded-lg border border-amber-300 shadow-2xs">
            <div className="flex items-center space-x-1 pl-1 text-xs font-semibold text-amber-900 hidden xs:flex">
              <Eye className="w-3.5 h-3.5 text-amber-700" />
              <span className="hidden sm:inline">Admin Switch:</span>
            </div>
            <select
              id="admin_role_switcher_select"
              value={selectedValue}
              onChange={handlePersonaChange}
              className="bg-white border border-amber-300 text-[#161F1A] text-[11px] sm:text-xs rounded-md px-1.5 sm:px-2.5 py-1 font-medium focus:ring-1 focus:ring-amber-500 focus:outline-none max-w-[120px] sm:max-w-[210px] lg:max-w-[260px] truncate cursor-pointer"
              title="Admin authority: switch to any real supervisor, tutor, student, or parent dashboard to inspect & edit"
            >
              <optgroup label="👑 Academy Administration">
                <option value="admin">
                  Director (Admin Main)
                </option>
              </optgroup>

              <optgroup label="🛡️ Academic Supervision">
                <option value="supervisor">
                  Academic Supervisor
                </option>
              </optgroup>

              <optgroup label="📖 Registered Tutors (Faculty)">
                {tutors.length > 0 ? (
                  tutors.map((t) => (
                    <option key={`tutor_${t.tutorId}`} value={`tutor_${t.tutorId}`}>
                      {t.realName || t.tutorId} ({t.tutorId})
                    </option>
                  ))
                ) : (
                  <option disabled value="">
                    (No tutors registered yet)
                  </option>
                )}
              </optgroup>

              <optgroup label="🎓 Registered Students">
                {students.length > 0 ? (
                  students.map((s) => (
                    <option key={`student_${s.studentId}`} value={`student_${s.studentId}`}>
                      {s.name} ({s.studentId})
                    </option>
                  ))
                ) : (
                  <option disabled value="">
                    (No students registered yet)
                  </option>
                )}
              </optgroup>

              {parentList.length > 0 && (
                <optgroup label="👨‍👩‍👧 Registered Parents / Guardians">
                  {parentList.map((p) => (
                    <option key={`parent_${p.id}`} value={`parent_${p.id}`}>
                      {p.name} ({p.studentName}'s Parent)
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        )}

        {/* Dual Parent / Student Role Switcher (Only visible for dual-role users) */}
        {(() => {
          const hasDualProfiles = Boolean(
            !isRealAdmin && userProfile?.studentId && userProfile?.linkedStudentIds && userProfile.linkedStudentIds.length > 0
          );

          if (!hasDualProfiles) return null;

          return (
            <div className="flex items-center bg-[#FAF9F7] p-0.5 sm:p-1 rounded-lg border border-[#D5D0C6] shadow-2xs">
              <button
                type="button"
                onClick={() => setAdminViewingRole(actualRole === 'student' ? 'parent' : null, null)}
                className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  activeRole === 'parent'
                    ? 'bg-[#2D8B5C] text-white shadow-xs'
                    : 'text-[#5A6B61] hover:text-[#161F1A]'
                }`}
                title="View Parent Guardian Portal (manage children, tuition, family)"
              >
                Parent Mode
              </button>
              <button
                type="button"
                onClick={() => setAdminViewingRole(actualRole === 'parent' ? 'student' : null, userProfile?.studentId || null)}
                className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  activeRole === 'student'
                    ? 'bg-[#2D8B5C] text-white shadow-xs'
                    : 'text-[#5A6B61] hover:text-[#161F1A]'
                }`}
                title="View Student Learning Portal (your personal Quran lessons)"
              >
                Student Mode
              </button>
            </div>
          );
        })()}

        {/* User Identity Chip */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 pl-1 border-l border-gray-200">
          <div
            className="w-8 h-8 rounded-full bg-[#2D8B5C]/15 border border-[#2D8B5C]/30 flex items-center justify-center text-[#1E5C3D] font-bold text-xs shrink-0 overflow-hidden shadow-2xs"
            title={`${userProfile?.preferredName || userProfile?.displayName} (${userProfile?.role})`}
          >
            {userProfile?.avatarUrl ? (
              <img
                src={userProfile.avatarUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : userProfile?.displayName ? (
              userProfile.displayName.charAt(0).toUpperCase()
            ) : (
              'U'
            )}
          </div>
          <div className="hidden xl:block text-left">
            <p className="text-xs font-semibold text-[#161F1A] leading-tight truncate max-w-[140px]">
              {userProfile?.preferredName || userProfile?.displayName}
            </p>
            <p className="text-[10px] text-[#5A6B61] capitalize">
              {userProfile?.role} {userProfile?.tutorId ? `(${userProfile.tutorId})` : ''} {userProfile?.studentId ? `(${userProfile.studentId})` : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={logout}
            title={activeRole === 'tutor' ? "Sign Out (Admin Password Required)" : "Sign Out of Academy"}
            className="min-h-[36px] min-w-[36px] p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer flex items-center justify-center"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
