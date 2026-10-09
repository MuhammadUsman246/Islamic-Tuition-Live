import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  GraduationCap,
  Calendar,
  MessageSquare,
  DollarSign,
  Sparkles,
  Eye,
  Share2,
  Users,
  Video,
  BookOpen,
  CheckSquare,
  Briefcase,
  Bell,
  ShieldCheck,
  Settings,
  Plus,
  FileText,
  Repeat,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  UserCheck
} from 'lucide-react';
import { Student, Tutor } from '../../types';

interface AdminCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
  students: Student[];
  tutors: Tutor[];
  onOpenStudentFile: (student: Student) => void;
  onRegisterStudent: () => void;
  onScheduleClass: () => void;
  onLogLesson: () => void;
  onIssueInvoice: () => void;
  onWeeklyReport: () => void;
  onShiftStudent: () => void;
}

interface PaletteAction {
  id: string;
  title: string;
  subtitle: string;
  category: 'Actions' | 'Navigation' | 'Students' | 'Tutors';
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  badge?: string;
  badgeColor?: string;
  handler: () => void;
}

export const AdminCommandPalette: React.FC<AdminCommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  students,
  tutors,
  onOpenStudentFile,
  onRegisterStudent,
  onScheduleClass,
  onLogLesson,
  onIssueInvoice,
  onWeeklyReport,
  onShiftStudent
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset search when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Base navigation items
  const navItems = useMemo(
    () => [
      { id: 'overview', title: 'Academy Overview', subtitle: 'Executive KPI summary & pending accounts', icon: GraduationCap, category: 'Navigation' as const, tab: 'overview' },
      { id: 'timetable', title: 'Master Timetable', subtitle: '24/7 master scheduling matrix & slot reservations', icon: Calendar, category: 'Navigation' as const, tab: 'timetable' },
      { id: 'messages', title: 'Internal Messages', subtitle: 'Faculty, student & supervisor communications', icon: MessageSquare, category: 'Navigation' as const, tab: 'messages' },
      { id: 'students', title: 'Student Directory', subtitle: 'Student dossiers, enrolment & shifts', icon: Users, category: 'Navigation' as const, tab: 'students' },
      { id: 'fees', title: 'Student Fees & Invoices', subtitle: 'Tuition collection, invoices & fee receipts', icon: DollarSign, category: 'Navigation' as const, tab: 'fees' },
      { id: 'trials', title: 'Trial Classes (5-Session)', subtitle: 'Free trial progression, Day 1 & follow-ups', icon: Sparkles, category: 'Navigation' as const, tab: 'trials' },
      { id: 'admin_observe', title: 'Observe Live Classes', subtitle: 'Silent supervisor monitor into active classrooms', icon: Eye, category: 'Navigation' as const, tab: 'admin_observe' },
      { id: 'referrals', title: 'Referral Rewards', subtitle: 'Student & parent word-of-mouth referral credits', icon: Share2, category: 'Navigation' as const, tab: 'referrals' },
      { id: 'tutors', title: 'Tutors & Classrooms', subtitle: 'Faculty roster, credentials & direct links', icon: Video, category: 'Navigation' as const, tab: 'tutors' },
      { id: 'lessons', title: 'Lesson History & Reports', subtitle: 'Class records, surah/ayah logs & remarks', icon: BookOpen, category: 'Navigation' as const, tab: 'lessons' },
      { id: 'attendance', title: 'Attendance & Records', subtitle: 'Student & tutor attendance logs', icon: CheckSquare, category: 'Navigation' as const, tab: 'attendance' },
      { id: 'salaries', title: 'Tutor Salaries (PKR)', subtitle: 'Faculty payroll calculation & payout receipts', icon: Briefcase, category: 'Navigation' as const, tab: 'salaries' },
      { id: 'announcements', title: 'Announcements', subtitle: 'Academy-wide broadcast news & notices', icon: Bell, category: 'Navigation' as const, tab: 'announcements' },
      { id: 'security', title: 'Academy Security', subtitle: 'Password management & role safety audit', icon: ShieldCheck, category: 'Navigation' as const, tab: 'security' },
      { id: 'settings', title: 'Academy Settings', subtitle: 'Global configurations, currency & rules', icon: Settings, category: 'Navigation' as const, tab: 'settings' }
    ],
    []
  );

  // Quick Action items
  const quickActions = useMemo(
    () => [
      {
        id: 'action_register_student',
        title: 'Register New Student',
        subtitle: 'Enrol a new student with timetable & tutor assignment',
        icon: Plus,
        iconBg: 'bg-emerald-100',
        iconColor: 'text-emerald-700',
        badge: 'Enrol',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        category: 'Actions' as const,
        handler: () => {
          onClose();
          onRegisterStudent();
        }
      },
      {
        id: 'action_schedule_class',
        title: 'Schedule Timetable Class',
        subtitle: 'Book a 30-min recurring slot on tutor timetable',
        icon: Calendar,
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-700',
        badge: 'Schedule',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
        category: 'Actions' as const,
        handler: () => {
          onClose();
          onScheduleClass();
        }
      },
      {
        id: 'action_issue_invoice',
        title: 'Issue Student Invoice / Fee',
        subtitle: 'Create tuition fee invoice with custom currency & due date',
        icon: DollarSign,
        iconBg: 'bg-emerald-100',
        iconColor: 'text-[#2D8B5C]',
        badge: 'Billing',
        badgeColor: 'bg-emerald-50 text-[#1E5C3D] border-emerald-200',
        category: 'Actions' as const,
        handler: () => {
          onClose();
          onIssueInvoice();
        }
      },
      {
        id: 'action_shift_student',
        title: 'Shift Student to Another Tutor',
        subtitle: 'Reassign student, records & choose new timetable slot',
        icon: Repeat,
        iconBg: 'bg-purple-100',
        iconColor: 'text-purple-700',
        badge: 'Reassign',
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
        category: 'Actions' as const,
        handler: () => {
          onClose();
          onShiftStudent();
        }
      },
      {
        id: 'action_log_lesson',
        title: 'Log Lesson Progress Report',
        subtitle: 'Record completed lesson, Surah, Ayah & tutor comments',
        icon: BookOpen,
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-800',
        badge: 'Log',
        badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
        category: 'Actions' as const,
        handler: () => {
          onClose();
          onLogLesson();
        }
      },
      {
        id: 'action_weekly_report',
        title: 'Generate Weekly Parent Report',
        subtitle: 'Create summary of attendance and Quran progress',
        icon: FileText,
        iconBg: 'bg-teal-100',
        iconColor: 'text-teal-700',
        badge: 'Report',
        badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
        category: 'Actions' as const,
        handler: () => {
          onClose();
          onWeeklyReport();
        }
      }
    ],
    [onClose, onRegisterStudent, onScheduleClass, onIssueInvoice, onShiftStudent, onLogLesson, onWeeklyReport]
  );

  // Filtered results
  const items: PaletteAction[] = useMemo(() => {
    const q = query.trim().toLowerCase();

    // 1. Actions matching
    const matchedActions: PaletteAction[] = quickActions
      .filter(a => !q || a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q))
      .map(a => ({
        ...a,
        handler: a.handler
      }));

    // 2. Navigation matching
    const matchedNav: PaletteAction[] = navItems
      .filter(n => !q || n.title.toLowerCase().includes(q) || n.subtitle.toLowerCase().includes(q) || n.tab.toLowerCase().includes(q))
      .map(n => ({
        id: `nav_${n.id}`,
        title: n.title,
        subtitle: n.subtitle,
        category: 'Navigation',
        icon: n.icon,
        iconBg: 'bg-slate-100',
        iconColor: 'text-slate-700',
        badge: 'Tab',
        badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
        handler: () => {
          onClose();
          onNavigateTab(n.tab);
        }
      }));

    // 3. Students matching (show top 8 when typing, or first 4 when empty)
    const filteredStudents = q
      ? students.filter(
          s =>
            s.name.toLowerCase().includes(q) ||
            s.studentId.toLowerCase().includes(q) ||
            (s.courseType && s.courseType.toLowerCase().includes(q)) ||
            (s.assignedTutorId && s.assignedTutorId.toLowerCase().includes(q))
        ).slice(0, 8)
      : students.slice(0, 3);

    const matchedStudents: PaletteAction[] = filteredStudents.map(st => ({
      id: `student_${st.id}`,
      title: `${st.name} (${st.studentId})`,
      subtitle: `Course: ${st.courseType || 'Quran'} • Tutor: ${st.assignedTutorId || 'None'} • Status: ${st.status}`,
      category: 'Students',
      icon: Users,
      iconBg: st.status === 'Trial' ? 'bg-amber-100' : 'bg-emerald-100',
      iconColor: st.status === 'Trial' ? 'text-amber-800' : 'text-[#2D8B5C]',
      badge: st.status,
      badgeColor: st.status === 'Trial' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200',
      handler: () => {
        onClose();
        onOpenStudentFile(st);
      }
    }));

    // 4. Tutors matching
    const filteredTutors = q
      ? tutors.filter(
          t =>
            t.realName.toLowerCase().includes(q) ||
            t.tutorId.toLowerCase().includes(q) ||
            (t.gender && t.gender.toLowerCase().includes(q))
        ).slice(0, 6)
      : tutors.slice(0, 2);

    const matchedTutors: PaletteAction[] = filteredTutors.map(tut => ({
      id: `tutor_${tut.id}`,
      title: `${tut.realName} (${tut.tutorId})`,
      subtitle: `Slots: ${tut.availabilitySchedule?.length || 0} active • Hourly: ${tut.hourlyRatePKR ? `${tut.hourlyRatePKR} PKR` : 'Not set'}`,
      category: 'Tutors',
      icon: UserCheck,
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-700',
      badge: 'Faculty',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      handler: () => {
        onClose();
        onNavigateTab('tutors');
      }
    }));

    // If search is active, prioritize results: matching students first if typed ID/name, else actions and nav
    if (q) {
      const looksLikeStudent = q.startsWith('stu') || q.includes('fatima') || q.includes('ali') || q.includes('khan');
      if (looksLikeStudent) {
        return [...matchedStudents, ...matchedActions, ...matchedNav, ...matchedTutors];
      }
      return [...matchedActions, ...matchedNav, ...matchedStudents, ...matchedTutors];
    }

    return [...matchedActions, ...matchedNav, ...matchedStudents];
  }, [query, quickActions, navItems, students, tutors, onClose, onNavigateTab, onOpenStudentFile]);

  // Keep selected index within bounds
  useEffect(() => {
    if (selectedIndex >= items.length) {
      setSelectedIndex(Math.max(0, items.length - 1));
    }
  }, [items.length, selectedIndex]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1 < items.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 >= 0 ? prev - 1 : items.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex]) {
        items[selectedIndex].handler();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-14 sm:pt-20 px-3 sm:px-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#E3DFD7] overflow-hidden flex flex-col max-h-[82vh] animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="p-3.5 sm:p-4 border-b border-[#EDEAE3] flex items-center gap-3 bg-[#FAF9F7]">
          <div className="w-8 h-8 rounded-lg bg-[#2D8B5C]/10 flex items-center justify-center text-[#2D8B5C] shrink-0">
            <Search className="w-4 h-4" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, search students, jump to tabs..."
            className="flex-1 bg-transparent border-none text-sm sm:text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSelectedIndex(0);
              }}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-400 bg-white border border-[#E3DFD7] rounded-md shadow-2xs">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1">
          {items.length === 0 ? (
            <div className="py-12 text-center">
              <Search className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No matching results</p>
              <p className="text-xs text-slate-400 mt-1">Try searching for student names, IDs, tabs or actions</p>
            </div>
          ) : (
            (() => {
              let lastCategory = '';
              return items.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const showCategoryHeader = item.category !== lastCategory;
                lastCategory = item.category;
                const Icon = item.icon;

                return (
                  <React.Fragment key={item.id}>
                    {showCategoryHeader && (
                      <div className="px-3 pt-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {item.category}
                      </div>
                    )}
                    <button
                      type="button"
                      data-selected={isSelected}
                      onClick={item.handler}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full text-left p-2.5 sm:p-3 rounded-xl flex items-center justify-between gap-3 transition-colors cursor-pointer group ${
                        isSelected
                          ? 'bg-emerald-50/80 border border-[#2D8B5C]/30 text-slate-900 shadow-2xs'
                          : 'hover:bg-slate-50 border border-transparent text-slate-700'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg ${item.iconBg} ${item.iconColor} flex items-center justify-center shrink-0 shadow-2xs transition-transform group-hover:scale-105`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-semibold truncate group-hover:text-[#1E5C3D]">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {item.badge && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              item.badgeColor || 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                        <ArrowRight
                          className={`w-4 h-4 text-slate-300 transition-transform ${
                            isSelected ? 'translate-x-0.5 text-[#2D8B5C]' : ''
                          }`}
                        />
                      </div>
                    </button>
                  </React.Fragment>
                );
              });
            })()
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="p-2.5 sm:p-3 bg-[#FAF9F7] border-t border-[#EDEAE3] flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="flex items-center space-x-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-white border border-[#E3DFD7] rounded shadow-2xs">↑</kbd>
              <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-white border border-[#E3DFD7] rounded shadow-2xs">↓</kbd>
              <span className="ml-1 text-slate-400">Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-white border border-[#E3DFD7] rounded shadow-2xs">↵</kbd>
              <span className="ml-1 text-slate-400">Select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-white border border-[#E3DFD7] rounded shadow-2xs">ESC</kbd>
              <span className="ml-1 text-slate-400">Close</span>
            </span>
          </div>
          <div className="flex items-center space-x-1.5 text-[#2D8B5C] font-semibold text-[10px] uppercase tracking-wider">
            <Sparkles className="w-3 h-3" />
            <span>IslamicTuition Command</span>
          </div>
        </div>
      </div>
    </div>
  );
};
