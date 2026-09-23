/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPortal } from './components/auth/AuthPortal';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { TutorDashboard } from './components/tutor/TutorDashboard';
import { SupervisorDashboard } from './components/supervisor/SupervisorDashboard';
import { StudentDashboard } from './components/student/StudentDashboard';
import { ParentDashboard } from './components/parent/ParentDashboard';
import { ChatView } from './components/chat/ChatView';
import {
  Student,
  Tutor,
  TimetableClass,
  Lesson,
  StudentFee,
  TutorSalary,
  Referral,
  Announcement,
  AttendanceRecord,
  TutorAttendanceRecord,
  UserRole,
  ChatMessage,
  ActiveCallSession
} from './types';
import {
  fetchAllAcademyData,
  isAnnouncementTargetedForRole,
  subscribeToUnreadMessages,
  subscribeToIncomingMessages,
  subscribeToIncomingCalls,
  subscribeToTutors,
  subscribeToLessons,
  subscribeToStudents,
  subscribeToClasses,
  loadCachedCollection,
  deduplicateTutors,
  ensureFeesLoaded,
  ensureSalariesLoaded,
  ensureReferralsLoaded,
  ensureAttendanceLoaded,
  ensureTutorAttendanceLoaded
} from './services/dataService';
import { ensureDatabaseSeeded } from './services/seedData';
import { clearAllAcademyData } from './services/seedData';
import { INITIAL_TUTOR_ENTITIES } from './data/tutorsData';
import { ALL_INITIAL_STUDENTS, ALL_INITIAL_CLASSES } from './data/studentsData';
import {
  sendDesktopNotification,
  playNotificationChime,
  requestDesktopNotificationPermission
} from './utils/chatMediaUtils';
import { InAppMessageToast } from './components/chat/InAppMessageToast';
import { LiveCallModal } from './components/chat/LiveCallModal';
import { AdminLogoutAuthModal } from './components/modals/AdminLogoutAuthModal';
import {
  Loader2,
  Eye,
  XCircle,
  Menu,
  GraduationCap,
  Calendar,
  Users,
  MessageSquare,
  BookOpen,
  DollarSign,
  ShieldCheck,
  CheckSquare
} from 'lucide-react';

const MainPortal: React.FC = () => {
  const {
    currentUser,
    userProfile,
    actualRole,
    activeRole,
    adminViewingRole,
    adminViewingTargetId,
    setAdminViewingRole,
    forceEnterApp,
    isLogoutAuthModalOpen,
    closeLogoutAuthModal,
    loading: authLoading,
    systemLinkUserProfile
  } = useAuth();

  const role: UserRole = activeRole || 'admin';

  // Default tabs for each role
  const getDefaultTab = (r: UserRole): string => {
    switch (r) {
      case 'admin': return 'overview';
      case 'tutor': return 'tutor_timetable';
      case 'supervisor': return 'supervisor_overview';
      case 'student': return 'student_schedule';
      case 'parent': return 'parent_children';
      default: return 'overview';
    }
  };

  const [currentTab, setCurrentTab] = useState<string>(() => getDefaultTab(role));

  // Automatically switch to correct default tab when active role changes (e.g. toggling Parent/Student Mode)
  useEffect(() => {
    setCurrentTab(getDefaultTab(role));
  }, [role]);
  const [activeChatThreadId, setActiveChatThreadId] = useState<string | undefined>(undefined);
  const [incomingMessageToast, setIncomingMessageToast] = useState<{ message: ChatMessage; channelName: string } | null>(null);
  const [activeCallSession, setActiveCallSession] = useState<ActiveCallSession | null>(null);
  const [unreadMessagesTotal, setUnreadMessagesTotal] = useState<number>(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });

  const currentUserId = (adminViewingRole && adminViewingTargetId)
    ? `${role}_${adminViewingTargetId}`
    : (role === 'tutor' && userProfile?.tutorId ? userProfile.tutorId : (userProfile?.uid || 'user'));

  // Auto-request desktop notifications for workplace/academy devices
  useEffect(() => {
    const handleInitialInteraction = () => {
      requestDesktopNotificationPermission().catch(() => {});
    };
    // Request immediately on mount
    requestDesktopNotificationPermission().catch(() => {});
    window.addEventListener('click', handleInitialInteraction, { once: true });
    return () => {
      window.removeEventListener('click', handleInitialInteraction);
    };
  }, []);

  // Live subscription to unread message count
  useEffect(() => {
    if (!currentUser || !currentUserId) return;
    const unsub = subscribeToUnreadMessages(currentUserId, role, (total) => {
      setUnreadMessagesTotal(total);
    });
    return () => unsub();
  }, [currentUser, currentUserId, role]);

  // Live subscription to incoming messages across the whole application for alerts
  useEffect(() => {
    if (!currentUser || !currentUserId) return;
    const unsub = subscribeToIncomingMessages(currentUserId, role, (newMsg) => {
      // Play non-intrusive sound alert
      playNotificationChime();

      // Trigger desktop push notification if enabled
      let channelLabel = newMsg.senderName;
      if (newMsg.threadId.startsWith('desk_tutor_')) {
        channelLabel = role === 'tutor'
          ? 'Admin & Supervisor Group'
          : `${newMsg.senderName} (Support Group)`;
      } else if (newMsg.threadId.startsWith('dm_admin_tutor_')) {
        channelLabel = role === 'tutor' ? 'Admin' : `${newMsg.senderName} (Direct)`;
      } else if (newMsg.threadId === 'dm_admin_supervisor') {
        channelLabel = role === 'supervisor' ? 'Admin' : 'Academic Supervisor';
      }
      
      const snippet = newMsg.attachment
        ? (newMsg.attachment.type === 'audio' ? 'Sent a voice note' : `Sent a ${newMsg.attachment.name}`)
        : (newMsg.text || 'Sent a message');

      const senderDisplay = (role === 'tutor' && newMsg.senderRole === 'admin')
        ? 'Admin'
        : `${newMsg.senderName} (${newMsg.senderRole.toUpperCase()})`;

      sendDesktopNotification(
        newMsg.id,
        senderDisplay,
        snippet
      );

      // Show in-app floating toast banner
      setIncomingMessageToast({
        message: (role === 'tutor' && newMsg.senderRole === 'admin')
          ? { ...newMsg, senderName: 'Admin' }
          : newMsg,
        channelName: channelLabel
      });
    });

    return () => unsub();
  }, [currentUser, currentUserId, role]);

  // Live subscription to incoming calls globally across the academy portal
  useEffect(() => {
    if (!currentUser || !currentUserId) return;
    const unsub = subscribeToIncomingCalls(currentUserId, role, (incomingCall) => {
      if (incomingCall) {
        setActiveCallSession(incomingCall);
      }
    });
    return () => unsub();
  }, [currentUser, currentUserId, role]);

  // Switch default tab when role changes
  useEffect(() => {
    setCurrentTab(getDefaultTab(role));
  }, [role]);

  // Mobile Bottom Navigation Shortcuts
  const getBottomNavItems = () => {
    switch (role) {
      case 'admin':
        return [
          { id: 'overview', label: 'Overview', icon: GraduationCap },
          { id: 'timetable', label: 'Timetable', icon: Calendar },
          { id: 'students', label: 'Students', icon: Users },
          { id: 'fees', label: 'Fees', icon: DollarSign },
          { id: 'messages', label: 'Chat', icon: MessageSquare },
        ];
      case 'tutor':
        return [
          { id: 'tutor_timetable', label: 'Timetable', icon: Calendar },
          { id: 'tutor_students', label: 'Students', icon: Users },
          { id: 'tutor_lessons', label: 'Lessons', icon: BookOpen },
          { id: 'tutor_attendance', label: 'Attendance', icon: CheckSquare },
          { id: 'messages', label: 'Chat', icon: MessageSquare },
        ];
      case 'supervisor':
        return [
          { id: 'supervisor_overview', label: 'Overview', icon: ShieldCheck },
          { id: 'timetable', label: 'Timetable', icon: Calendar },
          { id: 'supervisor_attendance', label: 'Tutors', icon: CheckSquare },
          { id: 'lessons', label: 'Reports', icon: BookOpen },
          { id: 'messages', label: 'Chat', icon: MessageSquare },
        ];
      case 'student':
        return [
          { id: 'student_schedule', label: 'Schedule', icon: Calendar },
          { id: 'student_lessons', label: 'Lessons', icon: BookOpen },
          { id: 'student_attendance', label: 'Attendance', icon: CheckSquare },
          { id: 'student_fees', label: 'Fees', icon: DollarSign },
          { id: 'messages', label: 'Chat', icon: MessageSquare },
        ];
      case 'parent':
        return [
          { id: 'parent_children', label: 'Children', icon: Users },
          { id: 'parent_schedule', label: 'Schedule', icon: Calendar },
          { id: 'parent_attendance', label: 'Attendance', icon: CheckSquare },
          { id: 'parent_fees', label: 'Fees', icon: DollarSign },
          { id: 'messages', label: 'Chat', icon: MessageSquare },
        ];
      default:
        return [];
    }
  };

  const bottomNavItems = getBottomNavItems();

  // Central Database State - Preloaded from memory/local cache/seed for 0ms instantaneous display
  const [students, setStudents] = useState<Student[]>(() => {
    return loadCachedCollection<Student[]>('students') || ALL_INITIAL_STUDENTS;
  });
  const [tutors, setTutors] = useState<Tutor[]>(() => {
    const cached = loadCachedCollection<Tutor[]>('tutors');
    return deduplicateTutors(cached && cached.length >= 20 ? cached : INITIAL_TUTOR_ENTITIES);
  });
  const [classes, setClasses] = useState<TimetableClass[]>(() => {
    return loadCachedCollection<TimetableClass[]>('classes') || ALL_INITIAL_CLASSES;
  });
  const [lessons, setLessons] = useState<Lesson[]>(() => {
    return loadCachedCollection<Lesson[]>('lessons') || [];
  });
  const [fees, setFees] = useState<StudentFee[]>(() => {
    return loadCachedCollection<StudentFee[]>('fees') || [];
  });
  const [salaries, setSalaries] = useState<TutorSalary[]>(() => {
    return loadCachedCollection<TutorSalary[]>('salaries') || [];
  });
  const [referrals, setReferrals] = useState<Referral[]>(() => {
    return loadCachedCollection<Referral[]>('referrals') || [];
  });
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
    return loadCachedCollection<Announcement[]>('announcements') || [];
  });
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    return loadCachedCollection<AttendanceRecord[]>('attendance') || [];
  });
  const [tutorAttendance, setTutorAttendance] = useState<TutorAttendanceRecord[]>(() => {
    return loadCachedCollection<TutorAttendanceRecord[]>('tutorAttendance') || [];
  });
  const [dataLoading, setDataLoading] = useState<boolean>(false);

  // Load real database entities with intelligent role-scoped startup and high-speed memory caching
  const loadAcademyData = useCallback(async (forceRefresh = false) => {
    try {
      const targetId = role === 'tutor'
        ? (userProfile?.tutorId || currentUserId)
        : (userProfile?.studentId || currentUserId);

      const data = await fetchAllAcademyData(forceRefresh, role, targetId);

      if (data.students && data.students.length > 0) setStudents(data.students);
      if (data.tutors && data.tutors.length > 0) setTutors(deduplicateTutors(data.tutors));
      if (data.classes && data.classes.length > 0) setClasses(data.classes);
      if (data.lessons) setLessons(data.lessons);
      if (data.fees && data.fees.length > 0) setFees(data.fees);
      if (data.salaries && data.salaries.length > 0) setSalaries(data.salaries);
      if (data.referrals && data.referrals.length > 0) setReferrals(data.referrals);
      if (data.announcements) setAnnouncements(data.announcements.filter(a => isAnnouncementTargetedForRole(a, role)));
      if (data.attendance && data.attendance.length > 0) setAttendance(data.attendance);
      if (data.tutorAttendance && data.tutorAttendance.length > 0) setTutorAttendance(data.tutorAttendance);
    } catch (err) {
      console.error("Error loading academy database:", err);
    } finally {
      setDataLoading(false);
    }
  }, [role, userProfile?.tutorId, userProfile?.studentId, currentUserId]);

  useEffect(() => {
    // 1. Instantly load / refresh data in background
    loadAcademyData(false);
    // 2. Non-blocking verification of seeding (0ms if already seeded)
    ensureDatabaseSeeded().catch(() => {});
  }, [loadAcademyData]);

  // Lazy-load heavy secondary collections on-demand when specific tabs are activated
  useEffect(() => {
    if (role === 'admin') {
      if (currentTab === 'fees') {
        ensureFeesLoaded().then(loadedFees => {
          if (loadedFees && loadedFees.length > 0) setFees(loadedFees);
        });
      } else if (currentTab === 'salaries') {
        ensureSalariesLoaded().then(loadedSalaries => {
          if (loadedSalaries && loadedSalaries.length > 0) setSalaries(loadedSalaries);
        });
      } else if (currentTab === 'referrals') {
        ensureReferralsLoaded().then(loadedReferrals => {
          if (loadedReferrals && loadedReferrals.length > 0) setReferrals(loadedReferrals);
        });
      } else if (currentTab === 'attendance' || currentTab === 'tutor_attendance') {
        ensureAttendanceLoaded().then(loadedAttendance => {
          if (loadedAttendance && loadedAttendance.length > 0) setAttendance(loadedAttendance);
        });
        ensureTutorAttendanceLoaded().then(loadedTutorAtt => {
          if (loadedTutorAtt && loadedTutorAtt.length > 0) setTutorAttendance(loadedTutorAtt);
        });
      }
    } else if (role === 'student' || role === 'parent') {
      if (currentTab === 'student_fees' || currentTab === 'parent_fees') {
        ensureFeesLoaded().then(loadedFees => {
          if (loadedFees && loadedFees.length > 0) setFees(loadedFees);
        });
      }
    }
  }, [currentTab, role]);

  // Real-time subscribe to tutors list to capture Live Availability Status immediately (Admin & Supervisor only)
  useEffect(() => {
    if (!currentUser) return;
    if (role !== 'admin' && role !== 'supervisor') return;
    const unsub = subscribeToTutors((updatedTutors) => {
      if (updatedTutors && updatedTutors.length > 0) {
        setTutors(deduplicateTutors(updatedTutors));
      }
    });
    return () => unsub();
  }, [currentUser, role]);

  // Real-time subscribe to timetable classes so master timetable and tutor weekly classes update immediately
  useEffect(() => {
    if (!currentUser) return;
    if (role !== 'admin' && role !== 'supervisor' && role !== 'tutor') return;
    const tutorFilter = role === 'tutor' ? (userProfile?.tutorId || currentUserId) : undefined;
    const unsub = subscribeToClasses((updatedClasses) => {
      if (updatedClasses && updatedClasses.length > 0) {
        setClasses(updatedClasses);
      }
    }, tutorFilter);
    return () => unsub();
  }, [currentUser, role, userProfile?.tutorId, currentUserId]);

  // Real-time subscribe to lessons so tutor entries immediately replicate to spreadsheets in Admin & Supervisor dashboards
  useEffect(() => {
    if (!currentUser) return;
    if (role !== 'admin' && role !== 'supervisor' && role !== 'tutor') return;
    const filterTutorId = role === 'tutor' ? (userProfile?.tutorId || currentUserId) : undefined;
    const unsub = subscribeToLessons((updatedLessons) => {
      setLessons(updatedLessons);
    }, filterTutorId);
    return () => unsub();
  }, [currentUser, role, userProfile?.tutorId, currentUserId]);

  // Real-time subscribe to students list so new student profiles created by Admin replicate immediately everywhere
  useEffect(() => {
    if (!currentUser) return;
    if (role !== 'admin' && role !== 'supervisor' && role !== 'tutor') return;
    const tutorFilter = role === 'tutor' ? (userProfile?.tutorId || currentUserId) : undefined;
    const unsub = subscribeToStudents((updatedStudents) => {
      if (updatedStudents && updatedStudents.length > 0) {
        setStudents(updatedStudents);
      }
    }, tutorFilter);
    return () => unsub();
  }, [currentUser, role, userProfile?.tutorId, currentUserId]);

  // Dynamic Linking Effect: Ensure logged in user's profile is linked to real student/parent/tutor record in Firestore
  useEffect(() => {
    if (!userProfile || !userProfile.email || adminViewingRole) return;
    const normEmail = userProfile.email.trim().toLowerCase();

    // 1. Check Student linking
    if ((userProfile.role === 'student' || !userProfile.role || !userProfile.studentId) && students.length > 0) {
      const match = students.find(s => s.email && s.email.trim().toLowerCase() === normEmail);
      if (match && match.studentId && userProfile.studentId !== match.studentId) {
        systemLinkUserProfile({
          studentId: match.studentId,
          courseType: match.courseType,
          country: match.country,
          timezone: match.timezone,
          role: userProfile.role === 'admin' ? 'admin' : 'student'
        });
      }
    }

    // 2. Check Parent linking
    if ((userProfile.role === 'parent' || !userProfile.role || !userProfile.linkedStudentIds || userProfile.linkedStudentIds.length === 0) && students.length > 0) {
      const childMatches = students.filter(s => s.parentEmail && s.parentEmail.trim().toLowerCase() === normEmail);
      if (childMatches.length > 0) {
        const cIds = Array.from(new Set(childMatches.map(c => c.studentId).filter(Boolean))) as string[];
        if (cIds.length > 0 && (!userProfile.linkedStudentIds || userProfile.linkedStudentIds.length !== cIds.length)) {
          systemLinkUserProfile({
            linkedStudentIds: cIds,
            role: (userProfile.role === 'admin' || userProfile.role === 'tutor' || userProfile.role === 'supervisor') ? userProfile.role : 'parent'
          });
        }
      }
    }

    // 3. Check Tutor linking
    if ((userProfile.role === 'tutor' || !userProfile.role || !userProfile.tutorId) && tutors.length > 0) {
      const match = tutors.find(t => t.email && t.email.trim().toLowerCase() === normEmail);
      if (match && match.tutorId && userProfile.tutorId !== match.tutorId) {
        systemLinkUserProfile({
          tutorId: match.tutorId,
          role: 'tutor'
        });
      }
    }
  }, [userProfile, students, tutors, adminViewingRole, systemLinkUserProfile]);

  // Loading Screen
  if (authLoading) {
    return (
      <div className="h-screen w-screen bg-[#FAF9F7] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-[#2D8B5C] flex items-center justify-center text-white font-bold text-xl shadow-md">
          IT
        </div>
        <div className="flex items-center space-x-2 text-[#1E5C3D] font-semibold text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-[#2D8B5C]" />
          <span>Authenticating Session...</span>
        </div>
        <button
          type="button"
          onClick={() => {
            forceEnterApp('muhammadusmanabbasi100@gmail.com');
          }}
          className="text-xs text-[#2D8B5C] underline hover:text-[#1E5C3D] font-medium cursor-pointer pt-2"
        >
          Taking too long? Click here to enter instantly
        </button>
      </div>
    );
  }

  // If unauthenticated or account is pending admin approval, show AuthPortal
  if (!userProfile || userProfile.status === 'pending_approval') {
    return <AuthPortal />;
  }

  if (dataLoading) {
    return (
      <div className="h-screen w-screen bg-[#FAF9F7] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-[#2D8B5C] flex items-center justify-center text-white font-bold text-xl shadow-md">
          IT
        </div>
        <div className="flex items-center space-x-2 text-[#1E5C3D] font-semibold text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-[#2D8B5C]" />
          <span>Synchronizing IslamicTuition Academy Database...</span>
        </div>
        <p className="text-xs text-[#5A6B61]">Establishing persistent connections...</p>
        <button
          type="button"
          onClick={() => setDataLoading(false)}
          className="text-xs text-[#2D8B5C] underline hover:text-[#1E5C3D] font-medium cursor-pointer pt-2"
        >
          Skip Synchronization & Open Dashboard Now
        </button>
      </div>
    );
  }

  // Header Title mapping
  const getHeaderTitle = () => {
    if (currentTab === 'messages') return 'Communications Channel';
    switch (role) {
      case 'admin':
        return 'IslamicTuition — Director Administration';
      case 'tutor':
        return `Faculty Portal — ${userProfile?.displayName || 'Tutor'}`;
      case 'supervisor':
        return 'Academic Supervision & Quality Control';
      case 'student':
        return `Student Academy Portal — ${userProfile?.displayName || 'Student'}`;
      case 'parent':
        return `Parent Guardian Portal — ${userProfile?.displayName || 'Parent'}`;
      default:
        return 'IslamicTuition Portal';
    }
  };

  const isInspecting = actualRole === 'admin' && Boolean(adminViewingRole);

  return (
    <div className="flex min-h-screen bg-[#FAF9F7] text-[#161F1A] relative">
      {/* Mobile Backdrop for Sidebar */}
      {isSidebarOpen && (
        <div
          id="sidebar_mobile_backdrop"
          className="fixed inset-0 bg-black/60 z-40 lg:hidden transition-opacity backdrop-blur-xs"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Role-Specific Sidebar with Responsive Toggle Behavior */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transition-all duration-300 ease-in-out lg:static shrink-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:hidden'
        }`}
      >
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          unreadCount={unreadMessagesTotal}
          tutors={tutors}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Admin Inspection Mode Banner */}
        {isInspecting && (
          <div className="bg-amber-500 text-slate-900 px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-xs sticky top-0 z-30">
            <div className="flex items-center space-x-2">
              <Eye className="w-4 h-4 text-slate-950 shrink-0" />
              <span>
                Admin Inspection Mode: Currently viewing portal as <strong className="uppercase">{role}</strong>. All interactions connect to live Firestore database.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAdminViewingRole(null)}
              className="px-2.5 py-1 bg-slate-950 text-white hover:bg-slate-800 rounded-md text-xs font-medium cursor-pointer transition-colors"
            >
              Exit Inspection Mode
            </button>
          </div>
        )}

        <Header
          title={getHeaderTitle()}
          subtitle="Real-Time Persistent Quran Academy Management System"
          tutors={tutors}
          students={students}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        />

        <main className="flex-1 pb-20 lg:pb-8 px-4 sm:px-8 lg:px-12 py-4 sm:py-6 overflow-x-hidden">
          {/* Global In-App Message Toast Alert */}
          {incomingMessageToast && (
            <InAppMessageToast
              message={incomingMessageToast.message}
              channelName={incomingMessageToast.channelName}
              onOpenChat={(threadId) => {
                setActiveChatThreadId(threadId);
                setCurrentTab('messages');
              }}
              onDismiss={() => setIncomingMessageToast(null)}
            />
          )}

          <div className="max-w-[1360px] mx-auto space-y-5">
            {/* Internal Messages View */}
            {currentTab === 'messages' ? (
              <ChatView
                initialThreadId={activeChatThreadId}
                students={students}
                tutors={tutors}
              />
            ) : role === 'admin' ? (
              <AdminDashboard
                currentTab={currentTab}
                setCurrentTab={setCurrentTab}
                students={students}
                tutors={tutors}
                classes={classes}
                lessons={lessons}
                fees={fees}
                salaries={salaries}
                referrals={referrals}
                announcements={announcements}
                attendance={attendance}
                tutorAttendance={tutorAttendance}
                onRefreshData={() => loadAcademyData(false)}
              />
            ) : role === 'tutor' ? (
              <TutorDashboard
                currentTab={currentTab}
                setCurrentTab={setCurrentTab}
                currentTutorId={adminViewingTargetId || userProfile?.tutorId || ''}
                tutors={tutors}
                students={students}
                classes={classes}
                lessons={lessons}
                attendance={attendance}
                announcements={announcements}
                onRefreshData={() => loadAcademyData(false)}
              />
            ) : role === 'supervisor' ? (
              <SupervisorDashboard
                currentTab={currentTab}
                setCurrentTab={setCurrentTab}
                tutors={tutors}
                students={students}
                classes={classes}
                lessons={lessons}
                attendance={attendance}
                tutorAttendance={tutorAttendance}
                announcements={announcements}
                onRefreshData={() => loadAcademyData(false)}
              />
            ) : role === 'student' ? (
              <StudentDashboard
                currentTab={currentTab}
                setCurrentTab={setCurrentTab}
                currentStudentId={
                  adminViewingTargetId ||
                  userProfile?.studentId ||
                  (students.find(s => s.email && s.email.toLowerCase().trim() === userProfile?.email?.toLowerCase().trim())?.studentId) ||
                  ''
                }
                students={students}
                tutors={tutors}
                classes={classes}
                lessons={lessons}
                attendance={attendance}
                fees={fees}
                announcements={announcements}
                onRefreshData={() => loadAcademyData(false)}
              />
            ) : role === 'parent' ? (
              <ParentDashboard
                currentTab={currentTab}
                setCurrentTab={setCurrentTab}
                linkedStudentIds={adminViewingTargetId ? [adminViewingTargetId] : userProfile?.linkedStudentIds || []}
                students={students}
                tutors={tutors}
                classes={classes}
                lessons={lessons}
                attendance={attendance}
                fees={fees}
                announcements={announcements}
                onRefreshData={() => loadAcademyData(false)}
              />
            ) : null}
          </div>
        </main>

        {/* Mobile Sticky Bottom Navigation Bar */}
        <nav
          id="mobile_bottom_nav_bar"
          aria-label="Mobile Navigation"
          className="fixed bottom-0 inset-x-0 bg-[#1B2E24] border-t border-[#263e32] text-white z-30 lg:hidden shadow-lg"
        >
          <div className="flex items-center justify-around h-14 px-1">
            {bottomNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              const isMessages = item.id === 'messages';
              return (
                <button
                  key={item.id}
                  id={`bottom_nav_${item.id}`}
                  onClick={() => setCurrentTab(item.id)}
                  className={`relative flex flex-col items-center justify-center flex-1 h-full text-center transition-colors cursor-pointer py-1 ${
                    isActive ? 'text-[#6de0a2]' : 'text-[#8ba295] hover:text-white'
                  }`}
                >
                  <div className="relative">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#6de0a2]' : 'text-[#8ba295]'}`} />
                    {isMessages && unreadMessagesTotal > 0 && (
                      <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#25D366] text-white shadow-xs">
                        {unreadMessagesTotal}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium truncate max-w-[58px] mt-0.5">{item.label}</span>
                  {isActive && <span className="w-1 h-1 bg-[#6de0a2] rounded-full mt-0.5"></span>}
                </button>
              );
            })}
            {/* More / Menu button */}
            <button
              type="button"
              id="bottom_nav_more_menu"
              onClick={() => setIsSidebarOpen(true)}
              className="flex flex-col items-center justify-center flex-1 h-full text-center text-[#8ba295] hover:text-white transition-colors cursor-pointer py-1"
            >
              <Menu className="w-4 h-4 text-[#E8A93E]" />
              <span className="text-[10px] font-medium truncate max-w-[58px] mt-0.5">Menu</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Global Live Call Modal for incoming/active calls outside chat view */}
      {activeCallSession && currentTab !== 'messages' && (
        <LiveCallModal
          callSession={activeCallSession}
          currentUserId={currentUserId}
          currentUserRole={role}
          currentUserName={userProfile?.displayName || 'Academy Member'}
          onClose={() => setActiveCallSession(null)}
        />
      )}

      {/* Protected Admin Logout Authorization Modal for Faculty Terminals */}
      <AdminLogoutAuthModal
        isOpen={isLogoutAuthModalOpen}
        onClose={closeLogoutAuthModal}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainPortal />
    </AuthProvider>
  );
}
