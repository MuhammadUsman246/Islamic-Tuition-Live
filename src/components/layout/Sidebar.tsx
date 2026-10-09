import React, { useState, useEffect, useMemo } from 'react';
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
  FileSpreadsheet,
  Radio,
  Eye,
  Lock,
  X,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole, Tutor, Student } from '../../types';
import { subscribeToUnreadMessages } from '../../services/dataService';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  unreadCount?: number;
  tutors?: Tutor[];
  students?: Student[];
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  sectionHeader?: string;
  badge?: string | number;
  badgeType?: 'live' | 'counter';
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, onClose, unreadCount: passedUnreadCount, tutors: passedTutors = [], students: passedStudents = [] }) => {
  const { userProfile, activeRole, adminViewingRole, adminViewingTargetId, logout } = useAuth();
  const role: UserRole = activeRole || userProfile?.role || 'admin';
  const currentUserId = (adminViewingRole && adminViewingTargetId)
    ? `${role}_${adminViewingTargetId}`
    : (userProfile?.uid || 'user');

  const [internalUnreadCount, setInternalUnreadCount] = useState<number>(0);

  useEffect(() => {
    if (passedUnreadCount !== undefined) return;
    const unsub = subscribeToUnreadMessages(currentUserId, role, (total) => {
      setInternalUnreadCount(total);
    });
    return () => unsub();
  }, [currentUserId, role, passedUnreadCount]);

  const unreadCount = passedUnreadCount !== undefined ? passedUnreadCount : internalUnreadCount;

  const activeStudent = passedStudents.find(s =>
    (adminViewingTargetId && (s.studentId === adminViewingTargetId || s.id === adminViewingTargetId)) ||
    (userProfile?.studentId && s.studentId === userProfile.studentId) ||
    (userProfile?.email && s.email && s.email.toLowerCase().trim() === userProfile.email.toLowerCase().trim())
  );
  const showFeeToStudent = activeStudent ? activeStudent.showFeeToStudent !== false : true;

  const getNavItems = (): NavItem[] => {
    switch (role) {
      case 'admin':
        return [
          // 1. Core / Daily Operations (Top priority order per user requirements)
          { id: 'overview', label: 'Academy Overview', icon: GraduationCap, sectionHeader: 'Daily Operations' },
          { id: 'timetable', label: 'Master Timetable', icon: Calendar },
          { id: 'messages', label: 'Internal Messages', icon: MessageSquare },
          { id: 'students', label: 'Student Directory', icon: Users },
          { id: 'fees', label: 'Student Fees & Invoices', icon: DollarSign },
          { id: 'trials', label: 'Trial Classes (5-Session)', icon: Sparkles },
          { id: 'admin_observe', label: 'Observe Live Classes', icon: Eye, badgeType: 'live' },
          { id: 'referrals', label: 'Referral Rewards', icon: Share2 },

          // 2. Academic & Faculty Management
          { id: 'tutors', label: 'Tutors & Classrooms', icon: Video, sectionHeader: 'Academic Management' },
          { id: 'lessons', label: 'Lesson History & Reports', icon: BookOpen },
          { id: 'attendance', label: 'Attendance & Records', icon: CheckSquare },
          { id: 'salaries', label: 'Tutor Salaries (PKR)', icon: Briefcase },

          // 3. Communications & Academy Tools
          { id: 'announcements', label: 'Announcements', icon: Bell, sectionHeader: 'Academy Tools & Media' },
          { id: 'classroom_lab', label: 'Classroom Lab (LiveKit)', icon: Radio },
          { id: 'chat_safety', label: 'Classroom Chat Safety', icon: Lock },
          { id: 'lesson_dictionary', label: 'Lesson Dictionary & Spellcheck', icon: BookOpen },

          // 4. System & Governance
          { id: 'security', label: 'Academy Security', icon: ShieldCheck, sectionHeader: 'System & Governance' },
          { id: 'trash', label: 'Recently Deleted & Trash', icon: Trash2 },
          { id: 'settings', label: 'Academy Settings', icon: Settings }
        ];

      case 'tutor':
        return [
          { id: 'tutor_timetable', label: 'My Weekly Timetable', icon: Calendar },
          { id: 'tutor_students', label: 'Assigned Students', icon: Users },
          { id: 'tutor_training', label: 'Tutors Training Videos', icon: Video },
          { id: 'announcements', label: 'Announcements', icon: Bell },
          { id: 'messages', label: 'Academy Messages', icon: MessageSquare }
        ];

      case 'supervisor':
        return [
          { id: 'supervisor_overview', label: 'Operations Overview', icon: ShieldCheck },
          { id: 'supervisor_observe', label: 'Observe Live Classes', icon: Eye },
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
          ...(showFeeToStudent ? [{ id: 'student_fees', label: 'Fee Receipts', icon: DollarSign }] : []),
          { id: 'student_referrals', label: 'Refer a Student (Sadaqah)', icon: Share2 },
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
          { id: 'parent_referrals', label: 'Refer a Student (Sadaqah)', icon: Share2 },
          { id: 'announcements', label: 'Announcements', icon: Bell },
          { id: 'messages', label: 'Contact Admin', icon: MessageSquare }
        ];

      default:
        return [];
    }
  };

  const navItems = getNavItems();

  interface SectionGroup {
    title: string;
    items: NavItem[];
  }

  const sectionGroups = useMemo<SectionGroup[]>(() => {
    const groups: SectionGroup[] = [];
    let currentGroup: SectionGroup = { title: '', items: [] };

    for (const item of navItems) {
      if (item.sectionHeader) {
        if (currentGroup.items.length > 0 || currentGroup.title) {
          groups.push(currentGroup);
        }
        currentGroup = { title: item.sectionHeader, items: [item] };
      } else {
        currentGroup.items.push(item);
      }
    }

    if (currentGroup.items.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }, [navItems]);

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    'Daily Operations': false,
    'Academic Management': false,
    'Academy Tools & Media': true,
    'System & Governance': true,
  });

  // Automatically expand a section if the active tab is located inside it
  useEffect(() => {
    for (const group of sectionGroups) {
      if (group.title && group.items.some(item => item.id === currentTab)) {
        setCollapsedSections(prev => {
          if (prev[group.title] === true) {
            return { ...prev, [group.title]: false };
          }
          return prev;
        });
      }
    }
  }, [currentTab, sectionGroups]);

  const toggleSection = (sectionTitle: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionTitle]: !prev[sectionTitle]
    }));
  };

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
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Menu"
            className="lg:hidden min-h-[44px] min-w-[44px] rounded-lg text-[#95a89e] hover:text-white hover:bg-[#233a2e] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Role Badge */}
      <div className="px-4 py-2 bg-[#14231b] border-b border-[#263e32] flex items-center justify-between">
        <span className="text-[11px] text-[#95a89e] uppercase tracking-wider font-medium">Active Role</span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#2D8B5C]/30 text-[#6de0a2] border border-[#2D8B5C]/40 capitalize">
          {role}
        </span>
      </div>

      {/* Navigation Links with Collapsible Accordion Sections */}
      <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1.5 scrollbar-thin scrollbar-thumb-emerald-950">
        {sectionGroups.map((group, groupIdx) => {
          const isCollapsible = Boolean(group.title);
          const isCollapsed = isCollapsible && Boolean(collapsedSections[group.title]);
          const hasActiveItem = group.items.some(i => i.id === currentTab);
          const sectionUnread = group.items.some(i => i.id === 'messages') ? unreadCount : 0;
          const sectionHasLive = group.items.some(i => i.id === 'admin_observe');

          return (
            <div key={group.title || `group_${groupIdx}`} className="space-y-1">
              {isCollapsible ? (
                <button
                  type="button"
                  onClick={() => toggleSection(group.title)}
                  className="w-full pt-3 pb-1.5 px-2 flex items-center justify-between text-[11px] font-bold text-[#8ba295] hover:text-white uppercase tracking-wider border-t border-[#263e32]/80 mt-2.5 first:mt-0 first:border-t-0 first:pt-1 group transition-colors cursor-pointer rounded-sm"
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="truncate group-hover:text-emerald-300 transition-colors">
                      {group.title}
                    </span>
                    <span className="text-[10px] font-semibold text-[#788e81] group-hover:text-[#a0b5aa] px-1.5 py-0.2 rounded-full bg-[#14231b] border border-[#263e32]">
                      {group.items.length}
                    </span>
                    {/* Collapsed indicators */}
                    {isCollapsed && hasActiveItem && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Active tab inside" />
                    )}
                    {isCollapsed && sectionUnread > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#25D366] text-white">
                        {sectionUnread}
                      </span>
                    )}
                    {isCollapsed && sectionHasLive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" title="Live class observing" />
                    )}
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-[#8ba295] group-hover:text-white transition-transform duration-200 shrink-0 ${
                      isCollapsed ? '-rotate-90' : 'rotate-0'
                    }`}
                  />
                </button>
              ) : null}

              {/* Items in section */}
              {(!isCollapsible || !isCollapsed) && (
                <div className="space-y-1 transition-all duration-200">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    const isMessages = item.id === 'messages';
                    const isObserve = item.id === 'admin_observe';

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
                        className={`w-full min-h-[42px] flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer group ${
                          isActive
                            ? 'bg-[#2D8B5C] text-white shadow-sm font-semibold ring-1 ring-white/10'
                            : 'text-[#c2d1c9] hover:bg-[#233a2e] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${isActive ? 'text-white' : 'text-[#8ba295]'}`} />
                          <span className="truncate">{item.label}</span>
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                          {isMessages && unreadCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#25D366] text-white shadow-xs">
                              {unreadCount}
                            </span>
                          )}

                          {isObserve && item.badgeType === 'live' && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                              <span>LIVE</span>
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User Profile & Logout */}
      <div className="p-4 border-t border-[#263e32] bg-[#14231b]">
        <div className="flex items-center justify-between">
          {(() => {
            const activeTutorObj = role === 'tutor'
              ? passedTutors.find(t =>
                  (adminViewingRole === 'tutor' && adminViewingTargetId && (t.tutorId === adminViewingTargetId || t.id === adminViewingTargetId)) ||
                  (userProfile?.tutorId && t.tutorId === userProfile.tutorId) ||
                  (userProfile?.email && t.email?.toLowerCase().trim() === userProfile.email.toLowerCase().trim())
                )
              : null;
            const activeStudentObj = role === 'student'
              ? passedStudents.find(s =>
                  (adminViewingRole === 'student' && adminViewingTargetId && (s.studentId === adminViewingTargetId || s.id === adminViewingTargetId)) ||
                  (!adminViewingRole && userProfile?.studentId && s.studentId === userProfile.studentId) ||
                  (!adminViewingRole && userProfile?.email && s.email?.toLowerCase().trim() === userProfile.email.toLowerCase().trim())
                )
              : null;
            const activeParentObj = role === 'parent'
              ? passedStudents.find(s =>
                  (adminViewingRole === 'parent' && adminViewingTargetId && (s.studentId === adminViewingTargetId || s.parentId === adminViewingTargetId)) ||
                  (!adminViewingRole && userProfile?.linkedStudentIds?.includes(s.studentId)) ||
                  (!adminViewingRole && userProfile?.email && s.parentEmail?.toLowerCase().trim() === userProfile.email.toLowerCase().trim())
                )
              : null;

            const footerPrimaryName = role === 'tutor'
              ? (activeTutorObj?.realName || (!adminViewingRole && userProfile?.displayName) || 'Authorized Tutor')
              : role === 'student'
              ? (activeStudentObj?.name || (!adminViewingRole && userProfile?.displayName) || 'Student')
              : role === 'parent'
              ? (activeParentObj?.parentName || (!adminViewingRole && userProfile?.displayName) || 'Parent')
              : (userProfile?.displayName || 'Authorized User');

            const footerSecondaryText = role === 'tutor'
              ? `Faculty Portal • ${activeTutorObj?.tutorId || userProfile?.tutorId || 'Active'}`
              : role === 'student'
              ? `Student Portal • ${activeStudentObj?.studentId || userProfile?.studentId || 'Active'}`
              : role === 'parent'
              ? `Parent Guardian Portal`
              : (userProfile?.email || '');

            return (
              <div className="min-w-0 pr-2">
                <p className="text-xs font-medium text-white truncate">
                  {footerPrimaryName}
                </p>
                <p className="text-[11px] text-[#7d9487] truncate">
                  {footerSecondaryText}
                </p>
              </div>
            );
          })()}
          <button
            id="sidebar_logout_button"
            onClick={logout}
            title={role === 'tutor' ? "Sign Out (Admin Password Required)" : "Sign Out"}
            className="min-h-[44px] min-w-[44px] p-2 text-[#95a89e] hover:text-white hover:bg-[#233a2e] rounded-md transition-colors cursor-pointer flex items-center justify-center shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
