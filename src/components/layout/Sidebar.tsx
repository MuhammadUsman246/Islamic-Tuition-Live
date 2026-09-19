import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Users,
  GraduationCap,
  BookOpen,
  CheckSquare,
  Clock,
  DollarSign,
  Briefcase,
  Share2,
  Bell,
  MessageSquare,
  Settings,
  LogOut,
  Sparkles,
  ShieldCheck,
  Video,
  Trash2,
  User,
  FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole, Tutor } from '../../types';
import { subscribeToUnreadMessages, subscribeToTutors, updateTutor } from '../../services/dataService';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  unreadCount?: number;
  tutors?: Tutor[];
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, onClose, unreadCount: passedUnreadCount, tutors: passedTutors }) => {
  const { userProfile, activeRole, adminViewingRole, adminViewingTargetId, logout } = useAuth();
  const role: UserRole = activeRole || userProfile?.role || 'admin';
  const currentUserId = (adminViewingRole && adminViewingTargetId)
    ? `${role}_${adminViewingTargetId}`
    : (userProfile?.uid || 'user');

  const [internalUnreadCount, setInternalUnreadCount] = useState<number>(0);
  const [currentTutorRecord, setCurrentTutorRecord] = useState<Tutor | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  useEffect(() => {
    if (role !== 'tutor') {
      setCurrentTutorRecord(null);
      return;
    }
    // If tutors list is already provided by parent App, avoid duplicate subscription
    if (passedTutors && passedTutors.length > 0) {
      const match = passedTutors.find(t => 
        (userProfile?.tutorId && t.tutorId === userProfile.tutorId) ||
        (userProfile?.email && t.email && t.email.toLowerCase().trim() === userProfile.email.toLowerCase().trim())
      );
      if (match) setCurrentTutorRecord(match);
      return;
    }

    const unsub = subscribeToTutors((tutorList) => {
      const match = tutorList.find(t => 
        (userProfile?.tutorId && t.tutorId === userProfile.tutorId) ||
        (userProfile?.email && t.email && t.email.toLowerCase().trim() === userProfile.email.toLowerCase().trim())
      );
      if (match) {
        setCurrentTutorRecord(match);
      }
    });
    return () => unsub();
  }, [role, userProfile?.tutorId, userProfile?.email, passedTutors]);

  const handleToggleAvailability = async () => {
    if (!currentTutorRecord || isTogglingStatus) return;
    setIsTogglingStatus(true);
    const newStatus = currentTutorRecord.availabilityStatus === 'Available' ? 'Busy' : 'Available';
    try {
      await updateTutor(currentTutorRecord.id, { availabilityStatus: newStatus });
    } catch (err) {
      console.error("Failed to update availability status:", err);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  useEffect(() => {
    if (passedUnreadCount !== undefined) return;
    const unsub = subscribeToUnreadMessages(currentUserId, role, (total) => {
      setInternalUnreadCount(total);
    });
    return () => unsub();
  }, [currentUserId, role, passedUnreadCount]);

  const unreadCount = passedUnreadCount !== undefined ? passedUnreadCount : internalUnreadCount;

  const getNavItems = (): NavItem[] => {
    switch (role) {
      case 'admin':
        return [
          { id: 'overview', label: 'Academy Overview', icon: GraduationCap },
          { id: 'timetable', label: 'Master Timetable', icon: Calendar },
          { id: 'students', label: 'Students', icon: Users },
          { id: 'tutors', label: 'Tutors & Zoom Links', icon: Video },
          { id: 'lessons', label: 'Lesson History', icon: BookOpen },
          { id: 'attendance', label: 'Attendance', icon: CheckSquare },
          { id: 'trials', label: 'Trial Classes (5-Session)', icon: Sparkles },
          { id: 'fees', label: 'Student Fees & Invoices', icon: DollarSign },
          { id: 'salaries', label: 'Tutor Salaries (PKR)', icon: Briefcase },
          { id: 'referrals', label: 'Referral Rewards', icon: Share2 },
          { id: 'security', label: 'Academy Security', icon: ShieldCheck },
          { id: 'announcements', label: 'Announcements', icon: Bell },
          { id: 'messages', label: 'Internal Messages', icon: MessageSquare },
          { id: 'trash', label: 'Recently Deleted & Trash', icon: Trash2 },
          { id: 'settings', label: 'Academy Settings', icon: Settings }
        ];

      case 'tutor':
        return [
          { id: 'tutor_timetable', label: 'My Weekly Timetable', icon: Calendar },
          { id: 'tutor_students', label: 'Assigned Students', icon: Users },
          { id: 'tutor_lessons', label: 'Lesson Reports', icon: BookOpen },
          { id: 'tutor_attendance', label: 'Attendance Tracking', icon: CheckSquare },
          { id: 'announcements', label: 'Announcements', icon: Bell },
          { id: 'messages', label: 'Academy Messages', icon: MessageSquare }
        ];

      case 'supervisor':
        return [
          { id: 'supervisor_overview', label: 'Operations Overview', icon: ShieldCheck },
          { id: 'timetable', label: 'Master Timetables', icon: Calendar },
          { id: 'supervisor_attendance', label: 'Tutor Attendance & Late', icon: Clock },
          { id: 'lessons', label: 'Lesson Quality & Reports', icon: BookOpen },
          { id: 'announcements', label: 'Announcements', icon: Bell },
          { id: 'messages', label: 'Staff Communications', icon: MessageSquare }
        ];

      case 'student':
        return [
          { id: 'student_schedule', label: 'My Schedule (Local Time)', icon: Calendar },
          { id: 'student_lessons', label: 'My Lessons & Homework', icon: BookOpen },
          { id: 'student_attendance', label: 'My Attendance', icon: CheckSquare },
          { id: 'student_fees', label: 'Fee Receipts', icon: DollarSign },
          { id: 'student_profile', label: 'My Profile & Avatar', icon: User },
          { id: 'announcements', label: 'Announcements', icon: Bell },
          { id: 'messages', label: 'Contact Admin', icon: MessageSquare }
        ];

      case 'parent':
        return [
          { id: 'parent_children', label: 'Children Overview', icon: Users },
          { id: 'parent_schedule', label: 'Class Schedules', icon: Calendar },
          { id: 'parent_lessons', label: 'Lesson History & Progress', icon: BookOpen },
          { id: 'parent_attendance', label: 'Attendance Records', icon: CheckSquare },
          { id: 'parent_fees', label: 'Tuition Invoices', icon: DollarSign },
          { id: 'announcements', label: 'Announcements', icon: Bell },
          { id: 'messages', label: 'Contact Admin', icon: MessageSquare }
        ];

      default:
        return [];
    }
  };

  const navItems = getNavItems();

  return (
    <aside
      id="portal_sidebar"
      className="w-72 sm:w-64 max-w-[85vw] bg-[#1B2E24] text-white flex flex-col h-screen sticky top-0 shrink-0 border-r border-[#263e32] shadow-2xl lg:shadow-none"
    >
      {/* Brand Header */}
      <div className="p-3.5 sm:p-4 border-b border-[#263e32] flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-white/10 p-1 border border-white/15 flex items-center justify-center shadow-xs shrink-0 backdrop-blur-xs">
            <img
              src="/favicon.svg"
              alt="IslamicTuition Emblem"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-sm tracking-wide text-white leading-tight truncate">
              IslamicTuition
            </h1>
            <p className="text-[10px] text-[#E8A93E] font-medium tracking-wider uppercase truncate">
              Online Quran Academy
            </p>
          </div>
        </div>
      </div>

      {/* Role Badge */}
      <div className="px-4 py-2 bg-[#14231b] border-b border-[#263e32] flex items-center justify-between">
        <span className="text-[11px] text-[#95a89e] uppercase tracking-wider font-medium">Active Role</span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#2D8B5C]/30 text-[#6de0a2] border border-[#2D8B5C]/40 capitalize">
          {role}
        </span>
      </div>

      {/* Real-time Availability Status Toggle for Tutors */}
      {role === 'tutor' && currentTutorRecord && (
        <div className="px-4 py-3 bg-[#0d1812] border-b border-[#263e32] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#95a89e] uppercase tracking-wider font-semibold">Live Availability</span>
            <div className="flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${
                currentTutorRecord.availabilityStatus === 'Available' ? 'bg-[#25D366] animate-pulse' : 'bg-red-500'
              }`} />
              <span className={`text-[11px] font-bold ${
                currentTutorRecord.availabilityStatus === 'Available' ? 'text-[#6de0a2]' : 'text-red-400'
              }`}>
                {currentTutorRecord.availabilityStatus || 'Busy'}
              </span>
            </div>
          </div>
          
          <button
            onClick={handleToggleAvailability}
            disabled={isTogglingStatus}
            className={`w-full py-1.5 rounded-md text-xs font-extrabold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              currentTutorRecord.availabilityStatus === 'Available'
                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/35'
                : 'bg-[#2D8B5C]/20 hover:bg-[#2D8B5C]/30 text-[#6de0a2] border border-[#2D8B5C]/35'
            }`}
          >
            <span>Set to {currentTutorRecord.availabilityStatus === 'Available' ? 'Busy' : 'Available'}</span>
          </button>
        </div>
      )}

      {/* Navigation Options & Settings header */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between text-[11px] font-semibold text-[#8ba295] uppercase tracking-wider">
        <span>Options & Settings</span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-1 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          const isMessages = item.id === 'messages';
          return (
            <button
              key={item.id}
              id={`nav_item_${item.id}`}
              onClick={() => {
                setCurrentTab(item.id);
                if (onClose && typeof window !== 'undefined' && window.innerWidth < 1024) {
                  onClose();
                }
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                isActive
                  ? 'bg-[#2D8B5C] text-white shadow-sm font-semibold'
                  : 'text-[#c2d1c9] hover:bg-[#233a2e] hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#8ba295]'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {isMessages && unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#25D366] text-white shrink-0 shadow-xs">
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Profile & Logout */}
      <div className="p-4 border-t border-[#263e32] bg-[#14231b]">
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="text-xs font-medium text-white truncate">
              {userProfile?.displayName || 'Authorized User'}
            </p>
            <p className="text-[11px] text-[#7d9487] truncate">
              {userProfile?.email}
            </p>
          </div>
          <button
            id="sidebar_logout_button"
            onClick={logout}
            title="Sign Out"
            className="p-1.5 text-[#95a89e] hover:text-white hover:bg-[#233a2e] rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
