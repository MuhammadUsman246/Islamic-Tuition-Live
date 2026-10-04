import React, { useState, useEffect } from 'react';
import {
  X,
  GraduationCap,
  Heart,
  Users,
  Calendar,
  Clock,
  Video,
  Radio,
  BookOpen,
  Target,
  Award,
  CheckSquare,
  CheckCircle,
  DollarSign,
  CreditCard,
  Receipt,
  Flame,
  Bell,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Sliders,
  Download,
  User,
  Lock,
  Palmtree,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Check,
  HelpCircle,
  Volume2
} from 'lucide-react';

export interface StudentParentTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: 'student' | 'parent';
  userName?: string;
  onNavigateTab?: (tab: string) => void;
  storageKeyPrefix?: string;
}

interface TourStep {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  features: {
    icon: React.ElementType;
    title: string;
    description: string;
    tabId?: string;
    tabLabel?: string;
    tag?: string;
  }[];
  proTip?: string;
}

export const StudentParentTourModal: React.FC<StudentParentTourModalProps> = ({
  isOpen,
  onClose,
  userRole: initialUserRole,
  userName = 'Student',
  onNavigateTab,
  storageKeyPrefix = 'default'
}) => {
  const [activeRole, setActiveRole] = useState<'student' | 'parent'>(initialUserRole);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(true);

  // Sync active role when props change
  useEffect(() => {
    setActiveRole(initialUserRole);
    setCurrentStepIndex(0);
  }, [initialUserRole, isOpen]);

  if (!isOpen) return null;

  const storageKey = `has_seen_portal_tour_${activeRole}_${storageKeyPrefix}`;

  const handleClose = () => {
    if (dontShowAgain && typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, 'true');
      } catch (e) {}
    }
    onClose();
  };

  // STUDENT STEPS DEFINITION
  const studentSteps: TourStep[] = [
    {
      id: 'student_welcome',
      badge: 'Welcome to Quran Learning',
      title: `Assalamu Alaykum, ${userName}! 🌿`,
      subtitle: 'Your dedicated online Quran and Islamic studies portal. Here is a quick guide to help you get the most out of your learning journey.',
      icon: GraduationCap,
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-950/80 border border-emerald-500/30',
      features: [
        {
          icon: Video,
          title: 'Live 1-on-1 Quran Classroom',
          description: 'Join live video & audio sessions directly in your browser with built-in Mushaf & Qaida displays.',
          tabId: 'student_schedule',
          tabLabel: 'Open Classroom Tab'
        },
        {
          icon: Calendar,
          title: 'Local Timezone Timetable',
          description: 'All your class slots and weekly schedules are automatically converted to your home city timezone.',
          tabId: 'student_schedule',
          tabLabel: 'View Timetable'
        },
        {
          icon: BookOpen,
          title: 'Lesson History & Daily Homework',
          description: 'Track your current Surah, Ayah, Tajweed rules, and tutor remarks after every class.',
          tabId: 'student_lessons',
          tabLabel: 'Check Lessons'
        },
        {
          icon: Flame,
          title: 'Streaks & Attendance Milestones',
          description: 'Earn punctuality badges and keep up your daily Quran recitation streak.',
          tabId: 'student_attendance',
          tabLabel: 'View Attendance'
        }
      ],
      proTip: 'You can access your live classroom 5 minutes before class time. No downloads or meeting codes needed!'
    },
    {
      id: 'student_classroom',
      badge: 'Interactive Learning',
      title: 'Live Quran Classroom & Tools',
      subtitle: 'Built from the ground up for high-fidelity Tajweed recitation and interactive learning.',
      icon: Radio,
      iconColor: 'text-emerald-300',
      iconBg: 'bg-emerald-900/60 border border-emerald-400/40',
      features: [
        {
          icon: Video,
          title: 'One-Click Room Entry',
          description: 'Simply click "Join Live Classroom" from your dashboard or top header when it is time for class.',
          tag: 'Instant Access'
        },
        {
          icon: Sliders,
          title: 'Studio Voice Filter & Noise Suppression',
          description: 'Built-in audio filters ensure your teacher hears your pronunciation and Makharij clearly.',
          tag: 'Crystal Clear'
        },
        {
          icon: BookOpen,
          title: 'Shared Mushaf & Qaida Stage',
          description: 'Follow your tutor\'s highlighted Quranic verses and pointers without needing physical books.',
          tag: 'Interactive'
        },
        {
          icon: Lock,
          title: 'Safe & Protected Chat',
          description: 'Classroom chat includes automatic privacy and academic safety so you can focus on Quran recitation.',
          tag: 'Protected'
        }
      ],
      proTip: 'Use headphones for the best audio experience and to prevent microphone feedback during recitation.'
    },
    {
      id: 'student_schedule',
      badge: 'Time Management',
      title: 'Weekly Timetable & Schedule',
      subtitle: 'Never miss a session with real-time class status and countdown timers.',
      icon: Calendar,
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-950/80 border border-amber-500/30',
      features: [
        {
          icon: Clock,
          title: 'Automatic Timezone Conversion',
          description: 'Whether you are in New York, London, Sydney, or Dubai, class timings are shown in your local clock.',
          tabId: 'student_schedule',
          tabLabel: 'My Schedule'
        },
        {
          icon: CheckSquare,
          title: 'Class Countdown & Live Badge',
          description: 'See live status indicators for today\'s classes, upcoming slots, and class reminders.',
          tabId: 'student_schedule',
          tabLabel: 'Today\'s Classes'
        },
        {
          icon: Palmtree,
          title: 'Excused Leaves & Holidays',
          description: 'View approved vacations and scheduled breaks without affecting your attendance standing.',
          tabId: 'student_schedule',
          tabLabel: 'Leave Calendar'
        }
      ],
      proTip: 'Look for the green "Live Now" banner when your class is in session for immediate 1-click entry.'
    },
    {
      id: 'student_progress',
      badge: 'Academic Excellence',
      title: 'Lessons, Homework & Tajweed',
      subtitle: 'Review feedback, practice assigned verses, and track your Quranic milestones.',
      icon: Target,
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-950/80 border border-blue-500/30',
      features: [
        {
          icon: BookOpen,
          title: 'Daily Sabaq & Sabqi Record',
          description: 'Accurate tracking of Surah, Ayah, Para/Juz, and page numbers covered in every single session.',
          tabId: 'student_lessons',
          tabLabel: 'Lesson Log'
        },
        {
          icon: Award,
          title: 'Tutor Remarks & Tajweed Grades',
          description: 'Review your teacher\'s specific advice on pronunciation, Makharij, and revision areas.',
          tabId: 'student_lessons',
          tabLabel: 'Teacher Feedback'
        },
        {
          icon: Download,
          title: 'PDF Lesson Progress Cards',
          description: 'Generate and download official PDF progress certificates to share with your family.',
          tabId: 'student_lessons',
          tabLabel: 'Download PDF'
        }
      ],
      proTip: 'Review your previous lesson notes before class to refresh your memory for Sabaq revision!'
    },
    {
      id: 'student_profile_fees',
      badge: 'Account & Tuition',
      title: 'Profile, Avatars & Fee Receipts',
      subtitle: 'Personalize your Islamic profile and view official payment records.',
      icon: User,
      iconColor: 'text-purple-400',
      iconBg: 'bg-purple-950/80 border border-purple-500/30',
      features: [
        {
          icon: Sparkles,
          title: 'Islamic Avatars & Customization',
          description: 'Choose your student avatar, set preferred learning goals, and customize your profile.',
          tabId: 'student_profile',
          tabLabel: 'Customize Profile'
        },
        {
          icon: Receipt,
          title: 'Official Tuition Receipts',
          description: 'View verified tuition payments and download PDF payment receipts anytime.',
          tabId: 'student_fees',
          tabLabel: 'Fee Receipts'
        },
        {
          icon: MessageSquare,
          title: 'Direct Academy Support',
          description: 'Reach academy administration directly through built-in support messaging.',
          tabId: 'messages',
          tabLabel: 'Contact Admin'
        }
      ],
      proTip: 'You can replay this tour anytime by clicking the "🎓 Dashboard Tour" button at the top of your dashboard.'
    }
  ];

  // PARENT STEPS DEFINITION
  const parentSteps: TourStep[] = [
    {
      id: 'parent_welcome',
      badge: 'Family Education Portal',
      title: 'Assalamu Alaykum, Respected Parent! 🌿',
      subtitle: 'Your dedicated portal to supervise, support, and track your children\'s Quranic and Islamic education in one unified dashboard.',
      icon: Heart,
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-950/80 border border-emerald-500/30',
      features: [
        {
          icon: Users,
          title: 'Multi-Child Family Hub',
          description: 'Monitor all your enrolled children from a single login without needing separate accounts.',
          tabId: 'parent_children',
          tabLabel: 'Children Overview'
        },
        {
          icon: Calendar,
          title: 'Synchronized Family Schedules',
          description: 'View combined weekly timetables for all siblings automatically converted to your home timezone.',
          tabId: 'parent_schedule',
          tabLabel: 'View Schedule'
        },
        {
          icon: BookOpen,
          title: 'Daily Lesson Logs & Tajweed Reports',
          description: 'Instant visibility into daily lesson progress, Surah memorization, and tutor remarks.',
          tabId: 'parent_lessons',
          tabLabel: 'Lesson Reports'
        },
        {
          icon: Receipt,
          title: 'Tuition Invoices & Receipts',
          description: 'Consolidated family invoicing, payment notices, and downloadable official PDF receipts.',
          tabId: 'parent_fees',
          tabLabel: 'Tuition Invoices'
        }
      ],
      proTip: 'You can toggle between individual children or view family summaries across every tab.'
    },
    {
      id: 'parent_family',
      badge: 'Multi-Child Management',
      title: 'Family Hub & Class Schedules',
      subtitle: 'Easily manage schedules and check live classroom presence for every child.',
      icon: Users,
      iconColor: 'text-emerald-300',
      iconBg: 'bg-emerald-900/60 border border-emerald-400/40',
      features: [
        {
          icon: Users,
          title: 'Sibling Quick Switcher',
          description: 'Filter timetables, lesson records, and fees child-by-child or as a unified family group.',
          tabId: 'parent_children',
          tabLabel: 'Child Profiles'
        },
        {
          icon: Clock,
          title: 'Local Timezone Timetables',
          description: 'Accurately schedules all your children\'s classes in your family\'s local clock.',
          tabId: 'parent_schedule',
          tabLabel: 'Family Timetable'
        },
        {
          icon: Radio,
          title: 'Live Classroom Status',
          description: 'See at a glance when a child is currently in an active class session with their tutor.',
          tabId: 'parent_schedule',
          tabLabel: 'Live Status'
        }
      ],
      proTip: 'Family timetables display color-coded student chips so you can quickly see who has class on which day.'
    },
    {
      id: 'parent_lessons',
      badge: 'Academic Progress',
      title: 'Lesson History & Teacher Reports',
      subtitle: 'Real-time transparency into your children\'s Quran memorization, reading, and Tajweed.',
      icon: BookOpen,
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-950/80 border border-blue-500/30',
      features: [
        {
          icon: GraduationCap,
          title: 'Daily Sabaq & Revision Tracking',
          description: 'See exactly which Surah, Ayah, or Qaida rule was covered in every lesson.',
          tabId: 'parent_lessons',
          tabLabel: 'Daily Reports'
        },
        {
          icon: CheckCircle,
          title: 'Tutor Ratings & Quality Feedback',
          description: 'Read teacher evaluations on pronunciation, fluency, and areas needing home practice.',
          tabId: 'parent_lessons',
          tabLabel: 'Teacher Feedback'
        },
        {
          icon: Download,
          title: 'Weekly & Monthly Progress Cards',
          description: 'Generate comprehensive academic PDF reports to celebrate your children\'s achievements.',
          tabId: 'parent_lessons',
          tabLabel: 'Export Reports'
        }
      ],
      proTip: 'Use the date filters to inspect lessons over any time window or export complete archives to CSV/PDF.'
    },
    {
      id: 'parent_attendance',
      badge: 'Punctuality & Discipline',
      title: 'Attendance & Leave Management',
      subtitle: 'Complete visibility over class attendance, punctuality, and planned vacations.',
      icon: CheckSquare,
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-950/80 border border-amber-500/30',
      features: [
        {
          icon: CheckSquare,
          title: 'Class Attendance Ledger',
          description: 'Detailed records of present, absent, late, and tutor-rescheduled sessions.',
          tabId: 'parent_attendance',
          tabLabel: 'Attendance Log'
        },
        {
          icon: Palmtree,
          title: 'Planned Leave Visibility',
          description: 'View excused student leaves and academy holiday schedules with ease.',
          tabId: 'parent_attendance',
          tabLabel: 'Leave Records'
        },
        {
          icon: Flame,
          title: 'Class Punctuality Metrics',
          description: 'Monitor consistency and encourage your children to maintain unbroken study streaks.',
          tabId: 'parent_attendance',
          tabLabel: 'Punctuality Score'
        }
      ],
      proTip: 'If you need to request a planned vacation for your child, message academy administration in advance.'
    },
    {
      id: 'parent_fees_support',
      badge: 'Billing & Support',
      title: 'Tuition Invoices, Receipts & Direct Support',
      subtitle: 'Clear, transparent billing records and direct line to academy management.',
      icon: DollarSign,
      iconColor: 'text-purple-400',
      iconBg: 'bg-purple-950/80 border border-purple-500/30',
      features: [
        {
          icon: CreditCard,
          title: 'Consolidated Family Invoices',
          description: 'Pay single combined tuition fees for all siblings or manage separate invoices.',
          tabId: 'parent_fees',
          tabLabel: 'Invoices'
        },
        {
          icon: Receipt,
          title: 'Official Downloadable PDF Receipts',
          description: 'Instant access to verified payment receipts with dates, invoice numbers, and payment methods.',
          tabId: 'parent_fees',
          tabLabel: 'Receipts Archive'
        },
        {
          icon: MessageSquare,
          title: 'Direct Staff & Admin Messaging',
          description: 'Communicate directly with academy coordinators, supervisors, and teachers.',
          tabId: 'messages',
          tabLabel: 'Contact Support'
        }
      ],
      proTip: 'Payment notices can be submitted directly through the portal by attaching payment confirmation screenshots.'
    }
  ];

  const steps = activeRole === 'student' ? studentSteps : parentSteps;
  const currentStep = steps[currentStepIndex] || steps[0];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleClose();
    } else {
      setCurrentStepIndex(prev => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStepIndex(prev => Math.max(prev - 1, 0));
  };

  const handleJumpToTab = (tabId?: string) => {
    if (tabId && onNavigateTab) {
      onNavigateTab(tabId);
      handleClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="bg-[#0B140F] border border-[#223D2E] text-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] relative font-sans">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-700/10 rounded-full blur-3xl pointer-events-none" />

        {/* TOP MODAL HEADER */}
        <div className="px-5 py-4 border-b border-[#1C3326] flex items-center justify-between relative z-10 bg-[#0F1B14]/80">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl ${currentStep.iconBg} shrink-0`}>
              <currentStep.icon className={`w-5 h-5 ${currentStep.iconColor}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {currentStep.badge}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  Step {currentStepIndex + 1} of {steps.length}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5">
                {currentStep.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="Close Tour"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ROLE SELECTOR PILL (Allows switching between Student & Parent guide) */}
        <div className="px-5 pt-3 pb-1 bg-[#09110D] border-b border-[#1A2E22] flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-slate-400 font-medium">Viewing Guide:</span>
            <div className="inline-flex p-0.5 rounded-lg bg-[#14231A] border border-[#233F2E]">
              <button
                type="button"
                onClick={() => {
                  setActiveRole('student');
                  setCurrentStepIndex(0);
                }}
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  activeRole === 'student'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Student Guide</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveRole('parent');
                  setCurrentStepIndex(0);
                }}
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  activeRole === 'parent'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Heart className="w-3.5 h-3.5" />
                <span>Parents Guide</span>
              </button>
            </div>
          </div>

          <div className="hidden sm:flex items-center space-x-1 text-[11px] text-emerald-400 font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Islamic Tuition Portal</span>
          </div>
        </div>

        {/* STEP BODY CONTENT */}
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-4 relative z-10">
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {currentStep.subtitle}
          </p>

          {/* KEY FEATURES GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {currentStep.features.map((feat, idx) => {
              const FeatIcon = feat.icon;
              return (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-[#111F17]/90 border border-[#203B2C] hover:border-emerald-500/40 transition-all flex flex-col justify-between space-y-2 group shadow-xs"
                >
                  <div className="flex items-start space-x-3">
                    <div className="p-2 rounded-xl bg-emerald-950/90 border border-emerald-500/30 text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                      <FeatIcon className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-white tracking-tight">
                          {feat.title}
                        </h4>
                        {feat.tag && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                            {feat.tag}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        {feat.description}
                      </p>
                    </div>
                  </div>

                  {feat.tabId && onNavigateTab && (
                    <div className="pt-1 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => handleJumpToTab(feat.tabId)}
                        className="text-[10px] font-semibold text-emerald-300 hover:text-emerald-200 flex items-center space-x-1 cursor-pointer hover:underline"
                      >
                        <span>{feat.tabLabel || 'Open Feature'}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* PRO TIP / GUIDANCE BOX */}
          {currentStep.proTip && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-200 text-xs flex items-start space-x-2.5 shadow-2xs">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-snug text-[11px]">
                <strong className="text-emerald-300 font-semibold mr-1">Helpful Tip:</strong>
                <span>{currentStep.proTip}</span>
              </div>
            </div>
          )}
        </div>

        {/* STEP PROGRESS DOTS */}
        <div className="px-5 py-2.5 bg-[#09110D] border-t border-[#1C3326] flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center space-x-1.5">
            {steps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentStepIndex(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === currentStepIndex
                    ? 'w-6 bg-emerald-500 shadow-xs'
                    : 'w-2 bg-slate-700 hover:bg-slate-500'
                }`}
                title={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          {/* "Don't show this again" checkbox */}
          <label className="flex items-center space-x-2 text-[11px] text-slate-400 select-none cursor-pointer hover:text-slate-200 transition-colors">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={e => setDontShowAgain(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span>Don't show this tour on next login</span>
          </label>
        </div>

        {/* MODAL FOOTER BUTTONS */}
        <div className="px-5 py-3.5 bg-[#0E1A13] border-t border-[#1C3326] flex items-center justify-between">
          <button
            type="button"
            disabled={isFirstStep}
            onClick={handleBack}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer ${
              isFirstStep
                ? 'opacity-30 cursor-not-allowed text-slate-500'
                : 'text-slate-300 hover:text-white bg-[#16271D] hover:bg-[#1E3327] border border-[#264433]'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Skip Tour
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="px-4 sm:px-5 py-2 bg-[#2D8B5C] hover:bg-[#237049] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1.5 cursor-pointer active:scale-95"
            >
              <span>{isLastStep ? 'Explore Dashboard' : 'Next Step'}</span>
              {isLastStep ? <Check className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
