import React, { useState, useEffect, useMemo } from 'react';
import { TimetableClass, DayOfWeek, UserRole, PKT_TIME_SLOTS, Student, Tutor } from '../../types';
import { Sparkles, Plus, Clock, Calendar, Filter, Search, LayoutGrid, List, Star, X } from 'lucide-react';
import { ClassDetailModal } from '../modals/ClassDetailModal';
import { getCurrentTeachingDay } from '../../utils/timezone';

interface TimetableGridProps {
  classes: TimetableClass[];
  role: UserRole;
  currentTutorId?: string;
  studentTimezone?: string;
  students?: Student[];
  tutors?: Tutor[];
  onAddClass?: (slot: { day: DayOfWeek; time: string }) => void;
  onEditClass?: (cls: TimetableClass) => void;
  onDeleteClass?: (classId: string) => void;
  onCancelClass?: (classId: string, newStatus: TimetableClass['status']) => void;
  onLogLesson?: (studentId: string) => void;
  onTutorFilterChange?: (tutorId: string) => void;
}

const WEEKDAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const WEEKEND_DAYS: DayOfWeek[] = ['Saturday', 'Sunday'];

// Format 24h PKT time into a friendly 12h display without PKT suffix
function formatTime12H(time24: string): string {
  try {
    const [hStr, mStr] = time24.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return time24;
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH}:${mStr.padStart(2, '0')} ${period}`;
  } catch (e) {
    return time24;
  }
}

// Parse HH:mm to minutes from midnight
function parseTimeToMinutes(time24: string): number {
  if (!time24) return 0;
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

// Calculate end time in 12H format
function calculateEndTime12H(startTime24: string, durationMinutes: number): string {
  const startM = parseTimeToMinutes(startTime24);
  const endM = (startM + durationMinutes) % (24 * 60);
  const h = Math.floor(endM / 60);
  const m = endM % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}

// Compact slot display labels (no redundant ranges)
const COMPACT_SLOT_LABELS: Record<string, string> = {
  '01:00': '1:00 AM',
  '01:30': '1:30 AM',
  '02:00': '2:00 AM',
  '02:30': '2:30 AM',
  '03:00': '3:00 AM',
  '03:30': '3:30 AM',
  '04:00': '4:00 AM',
  '04:30': '4:30 AM',
  '05:00': '5:00 AM',
  '05:30': '5:30 AM',
  '06:00': '6:00 AM',
  '06:30': '6:30 AM'
};

// Subtle color accents per tutor for rapid visual scanning
export interface TutorColorTheme {
  id: string;
  name: string;
  bg: string;            // Card soft tinted background & hover state
  border: string;        // Card subtle boundary border
  accentBar: string;     // Left 3.5px solid signature accent strip
  text: string;          // Student name text in deep, high-contrast WCAG AAA tone
  tutorBadgeBg: string;  // Chip background, text, and border
  dot: string;           // Solid dot for legends and indicator chips
}

export const TUTOR_PALETTES: TutorColorTheme[] = [
  // 1: Sage Emerald
  {
    id: 'emerald',
    name: 'Emerald Sage',
    bg: 'bg-emerald-50/95 hover:bg-emerald-100/90',
    border: 'border-emerald-300',
    accentBar: 'border-l-emerald-600',
    text: 'text-emerald-950',
    tutorBadgeBg: 'bg-emerald-100/90 text-emerald-900 border-emerald-300',
    dot: 'bg-emerald-600'
  },
  // 2: Sky Azure
  {
    id: 'sky',
    name: 'Sky Azure',
    bg: 'bg-sky-50/95 hover:bg-sky-100/90',
    border: 'border-sky-300',
    accentBar: 'border-l-sky-600',
    text: 'text-sky-950',
    tutorBadgeBg: 'bg-sky-100/90 text-sky-900 border-sky-300',
    dot: 'bg-sky-600'
  },
  // 3: Royal Indigo
  {
    id: 'indigo',
    name: 'Royal Indigo',
    bg: 'bg-indigo-50/95 hover:bg-indigo-100/90',
    border: 'border-indigo-300',
    accentBar: 'border-l-indigo-600',
    text: 'text-indigo-950',
    tutorBadgeBg: 'bg-indigo-100/90 text-indigo-900 border-indigo-300',
    dot: 'bg-indigo-600'
  },
  // 4: Clean Teal
  {
    id: 'teal',
    name: 'Sea Teal',
    bg: 'bg-teal-50/95 hover:bg-teal-100/90',
    border: 'border-teal-300',
    accentBar: 'border-l-teal-600',
    text: 'text-teal-950',
    tutorBadgeBg: 'bg-teal-100/90 text-teal-900 border-teal-300',
    dot: 'bg-teal-600'
  },
  // 5: Elegant Purple
  {
    id: 'purple',
    name: 'Purple Plum',
    bg: 'bg-purple-50/95 hover:bg-purple-100/90',
    border: 'border-purple-300',
    accentBar: 'border-l-purple-600',
    text: 'text-purple-950',
    tutorBadgeBg: 'bg-purple-100/90 text-purple-900 border-purple-300',
    dot: 'bg-purple-600'
  },
  // 6: Warm Amber
  {
    id: 'amber',
    name: 'Warm Amber',
    bg: 'bg-amber-50/95 hover:bg-amber-100/90',
    border: 'border-amber-300',
    accentBar: 'border-l-amber-600',
    text: 'text-amber-950',
    tutorBadgeBg: 'bg-amber-100/90 text-amber-900 border-amber-300',
    dot: 'bg-amber-600'
  },
  // 7: Marine Blue
  {
    id: 'blue',
    name: 'Marine Blue',
    bg: 'bg-blue-50/95 hover:bg-blue-100/90',
    border: 'border-blue-300',
    accentBar: 'border-l-blue-600',
    text: 'text-blue-950',
    tutorBadgeBg: 'bg-blue-100/90 text-blue-900 border-blue-300',
    dot: 'bg-blue-600'
  },
  // 8: Ocean Cyan
  {
    id: 'cyan',
    name: 'Ocean Cyan',
    bg: 'bg-cyan-50/95 hover:bg-cyan-100/90',
    border: 'border-cyan-300',
    accentBar: 'border-l-cyan-600',
    text: 'text-cyan-950',
    tutorBadgeBg: 'bg-cyan-100/90 text-cyan-900 border-cyan-300',
    dot: 'bg-cyan-600'
  },
  // 9: Rose Berry
  {
    id: 'rose',
    name: 'Rose Berry',
    bg: 'bg-rose-50/90 hover:bg-rose-100/90',
    border: 'border-rose-300',
    accentBar: 'border-l-rose-500',
    text: 'text-rose-950',
    tutorBadgeBg: 'bg-rose-100/90 text-rose-900 border-rose-300',
    dot: 'bg-rose-500'
  },
  // 10: Executive Slate
  {
    id: 'slate',
    name: 'Executive Slate',
    bg: 'bg-slate-100/95 hover:bg-slate-200/90',
    border: 'border-slate-300',
    accentBar: 'border-l-slate-600',
    text: 'text-slate-950',
    tutorBadgeBg: 'bg-slate-200/90 text-slate-900 border-slate-300',
    dot: 'bg-slate-600'
  },
  // 11: Olive Lime
  {
    id: 'lime',
    name: 'Olive Lime',
    bg: 'bg-lime-50/95 hover:bg-lime-100/90',
    border: 'border-lime-300',
    accentBar: 'border-l-lime-600',
    text: 'text-lime-950',
    tutorBadgeBg: 'bg-lime-100/90 text-lime-900 border-lime-300',
    dot: 'bg-lime-600'
  },
  // 12: Warm Terracotta
  {
    id: 'orange',
    name: 'Terracotta',
    bg: 'bg-orange-50/90 hover:bg-orange-100/90',
    border: 'border-orange-300',
    accentBar: 'border-l-orange-500',
    text: 'text-orange-950',
    tutorBadgeBg: 'bg-orange-100/90 text-orange-900 border-orange-300',
    dot: 'bg-orange-500'
  },
  // 13: Lavender Violet
  {
    id: 'violet',
    name: 'Lavender Violet',
    bg: 'bg-violet-50/95 hover:bg-violet-100/90',
    border: 'border-violet-300',
    accentBar: 'border-l-violet-600',
    text: 'text-violet-950',
    tutorBadgeBg: 'bg-violet-100/90 text-violet-900 border-violet-300',
    dot: 'bg-violet-600'
  },
  // 14: Berry Fuchsia
  {
    id: 'fuchsia',
    name: 'Berry Fuchsia',
    bg: 'bg-fuchsia-50/90 hover:bg-fuchsia-100/90',
    border: 'border-fuchsia-300',
    accentBar: 'border-l-fuchsia-600',
    text: 'text-fuchsia-950',
    tutorBadgeBg: 'bg-fuchsia-100/90 text-fuchsia-900 border-fuchsia-300',
    dot: 'bg-fuchsia-600'
  },
  // 15: Deep Jade
  {
    id: 'jade',
    name: 'Deep Jade',
    bg: 'bg-emerald-100/75 hover:bg-emerald-200/70',
    border: 'border-emerald-400',
    accentBar: 'border-l-emerald-700',
    text: 'text-emerald-950',
    tutorBadgeBg: 'bg-emerald-200/80 text-emerald-950 border-emerald-400',
    dot: 'bg-emerald-700'
  },
  // 16: Sandstone
  {
    id: 'stone',
    name: 'Sandstone',
    bg: 'bg-stone-100/95 hover:bg-stone-200/85',
    border: 'border-stone-300',
    accentBar: 'border-l-stone-600',
    text: 'text-stone-950',
    tutorBadgeBg: 'bg-stone-200/90 text-stone-900 border-stone-300',
    dot: 'bg-stone-600'
  }
];

export function getSlotColorTheme(
  cls: { tutorId?: string; studentName?: string; studentId?: string },
  isSingleTutorView: boolean = false
): TutorColorTheme {
  const key = isSingleTutorView 
    ? (cls.studentName || cls.studentId || cls.tutorId || 'Student')
    : (cls.tutorId || 'Tutor 1');
  
  if (!isSingleTutorView && cls.tutorId) {
    const match = cls.tutorId.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      const idx = (num - 1) % TUTOR_PALETTES.length;
      return TUTOR_PALETTES[idx >= 0 ? idx : 0];
    }
  }

  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % TUTOR_PALETTES.length;
  return TUTOR_PALETTES[idx];
}

const DEFAULT_TUTOR_COLOR = {
  bg: 'bg-[#F0F7F3] hover:bg-[#E5F2EB]',
  border: 'border-[#91CBB0]',
  text: 'text-[#161F1A]',
  badge: 'bg-[#2D8B5C] text-white'
};

const TUTOR_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  'Tutor 1': {
    bg: TUTOR_PALETTES[0].bg,
    border: TUTOR_PALETTES[0].border,
    text: TUTOR_PALETTES[0].text,
    badge: 'bg-emerald-700 text-white'
  },
  'Tutor 2': {
    bg: TUTOR_PALETTES[1].bg,
    border: TUTOR_PALETTES[1].border,
    text: TUTOR_PALETTES[1].text,
    badge: 'bg-sky-700 text-white'
  },
  'Tutor 3': {
    bg: TUTOR_PALETTES[2].bg,
    border: TUTOR_PALETTES[2].border,
    text: TUTOR_PALETTES[2].text,
    badge: 'bg-indigo-700 text-white'
  },
  'Tutor 4': {
    bg: TUTOR_PALETTES[3].bg,
    border: TUTOR_PALETTES[3].border,
    text: TUTOR_PALETTES[3].text,
    badge: 'bg-teal-700 text-white'
  }
};

export const TimetableGrid: React.FC<TimetableGridProps> = ({
  classes,
  role,
  currentTutorId,
  students = [],
  tutors = [],
  onAddClass,
  onEditClass,
  onDeleteClass,
  onCancelClass,
  onLogLesson,
  onTutorFilterChange
}) => {
  const currentTeachingDay = getCurrentTeachingDay();

  // Check if any active classes exist on Saturday or Sunday
  const hasWeekendClasses = useMemo(() => {
    return classes.some(c => c.dayOfWeek === 'Saturday' || c.dayOfWeek === 'Sunday');
  }, [classes]);

  // Requirement: By default only set sheet days to Mon-Fri (no Saturday & Sunday).
  // Saturday and Sunday only appear if user clicks 7 Days or if admin added weekend slots.
  const [showWeekend, setShowWeekend] = useState<boolean>(() => hasWeekendClasses);

  useEffect(() => {
    if (hasWeekendClasses) {
      setShowWeekend(true);
    }
  }, [hasWeekendClasses]);
  const [selectedTutorFilter, setSelectedTutorFilter] = useState<string>(currentTutorId || 'all');

  useEffect(() => {
    setSelectedTutorFilter(currentTutorId || 'all');
  }, [currentTutorId]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDetailClass, setSelectedDetailClass] = useState<TimetableClass | null>(null);
  const [mobileDay, setMobileDay] = useState<DayOfWeek>(currentTeachingDay);
  const [mobileViewMode, setMobileViewMode] = useState<'day' | 'grid'>('day');

  const [isManageSlotsModalOpen, setIsManageSlotsModalOpen] = useState(false);
  const [modalNewSlotValue, setModalNewSlotValue] = useState('22:00');
  const [modalSlotPosition, setModalSlotPosition] = useState<'top' | 'bottom'>('top');
  const [selectedSlotDetails, setSelectedSlotDetails] = useState<{ day: DayOfWeek; slot: string; classes: TimetableClass[] } | null>(null);

  // Custom visible time slots pinned on Top (before 1:00 AM)
  const [customGridSlotsTop, setCustomGridSlotsTop] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('islamictuition_custom_grid_slots_top');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {}
    return [];
  });

  // Custom visible time slots pinned on Bottom (after 6:30 AM)
  const [customGridSlotsBottom, setCustomGridSlotsBottom] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('islamictuition_custom_grid_slots_bottom');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {}
    return [];
  });

  const handleAddCustomSlotTop = (slot: string) => {
    if (!slot) return;
    if (PKT_TIME_SLOTS.includes(slot as any) || customGridSlotsTop.includes(slot)) {
      return;
    }
    const updated = [...customGridSlotsTop, slot].sort((a, b) => a.localeCompare(b));
    setCustomGridSlotsTop(updated);
    localStorage.setItem('islamictuition_custom_grid_slots_top', JSON.stringify(updated));
  };

  const handleAddCustomSlotBottom = (slot: string) => {
    if (!slot) return;
    if (PKT_TIME_SLOTS.includes(slot as any) || customGridSlotsBottom.includes(slot)) {
      return;
    }
    const updated = [...customGridSlotsBottom, slot].sort((a, b) => a.localeCompare(b));
    setCustomGridSlotsBottom(updated);
    localStorage.setItem('islamictuition_custom_grid_slots_bottom', JSON.stringify(updated));
  };

  const handleRemoveCustomSlot = (slot: string) => {
    const updatedTop = customGridSlotsTop.filter(s => s !== slot);
    setCustomGridSlotsTop(updatedTop);
    localStorage.setItem('islamictuition_custom_grid_slots_top', JSON.stringify(updatedTop));

    const updatedBottom = customGridSlotsBottom.filter(s => s !== slot);
    setCustomGridSlotsBottom(updatedBottom);
    localStorage.setItem('islamictuition_custom_grid_slots_bottom', JSON.stringify(updatedBottom));
  };

  const activeDays = showWeekend ? [...WEEKDAYS, ...WEEKEND_DAYS] : WEEKDAYS;

  // Get all unique start times from currently loaded classes that aren't in PKT_TIME_SLOTS
  const extraClassSlots = Array.from(new Set<string>(classes.map(c => c.startTimePKT)))
    .filter(slot => !PKT_TIME_SLOTS.includes(slot as any));

  // Determine which class slots belong to Top (< '01:00') vs Bottom (>= '07:00' or similar)
  const extraTop = extraClassSlots.filter(s => s < '01:00' && !customGridSlotsTop.includes(s));
  const extraBottom = extraClassSlots.filter(s => s >= '07:00' && !customGridSlotsBottom.includes(s));

  const sortedTop = [...customGridSlotsTop, ...extraTop].sort((a, b) => a.localeCompare(b));
  const sortedBottom = [...customGridSlotsBottom, ...extraBottom].sort((a, b) => a.localeCompare(b));

  const TIME_SLOTS: string[] = [...sortedTop, ...PKT_TIME_SLOTS, ...sortedBottom];

  // Ensure mobile selected day is in activeDays
  const effectiveMobileDay = activeDays.includes(mobileDay) ? mobileDay : activeDays[0];

  // Filter classes by tutor and search query
  const filteredClasses = classes.filter(c => {
    const matchTutor = selectedTutorFilter === 'all' || c.tutorId === selectedTutorFilter;
    const matchSearch = !searchQuery || 
      c.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.tutorId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchTutor && matchSearch;
  });

  // Unique tutors list for filter dropdown and faculty colors bar (natural numeric sequence: Tutor 1, Tutor 2, ..., Tutor 10)
  const uniqueTutors: string[] = Array.from(new Set<string>(classes.map(c => c.tutorId).filter(Boolean) as string[])).sort(
    (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

  // Selected detail class student & tutor references
  const detailStudent = selectedDetailClass ? students.find(s => s.studentId === selectedDetailClass.studentId) : null;
  const detailTutor = selectedDetailClass ? tutors.find(t => t.tutorId === selectedDetailClass.tutorId) : null;

  return (
    <div id="master_timetable_container" className="bg-white border border-[#E3DFD7] rounded-xl overflow-hidden shadow-xs">
      {/* Top Compact Command & Filter Bar */}
      <div className="px-3.5 py-2.5 bg-[#FAF9F7] border-b border-[#E3DFD7] flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Title + Key Metrics */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#2D8B5C]"></span>
            <h3 className="text-xs font-bold text-[#161F1A] uppercase tracking-wider">
              {role === 'tutor' ? 'Faculty Timetable (PKT)' : 'Master Timetable (PKT)'}
            </h3>
          </div>

          <div className="flex items-center space-x-1.5 text-[11px]">
            <span className="px-2 py-0.5 rounded-md bg-[#2D8B5C]/10 text-[#1E5C3D] font-semibold flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {filteredClasses.length} Scheduled
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#FAF9F7] border border-[#D5D0C6] text-[#5A6B61] font-medium hidden sm:inline-flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#2D8B5C]" />
              1:00 AM – 7:00 AM PKT
            </span>
          </div>
        </div>

        {/* Right: Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Mobile View Toggle */}
          <div className="flex items-center bg-gray-200/70 p-0.5 rounded-lg md:hidden">
            <button
              type="button"
              onClick={() => setMobileViewMode('day')}
              className={`px-2 py-1 rounded-md text-xs font-semibold flex items-center space-x-1 transition-all ${
                mobileViewMode === 'day'
                  ? 'bg-white text-[#161F1A] shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Day</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileViewMode('grid')}
              className={`px-2 py-1 rounded-md text-xs font-semibold flex items-center space-x-1 transition-all ${
                mobileViewMode === 'grid'
                  ? 'bg-white text-[#161F1A] shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#5A6B61] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search student/tutor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-2.5 py-1 text-xs bg-white border border-[#D5D0C6] rounded-md focus:outline-none focus:ring-1 focus:ring-[#2D8B5C] w-28 sm:w-40"
            />
          </div>

          {/* Tutor Filter for Admin & Supervisor */}
          {role !== 'tutor' && (
            <div className="flex items-center space-x-1">
              <Filter className="w-3.5 h-3.5 text-[#5A6B61]" />
              <select
                value={selectedTutorFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedTutorFilter(val);
                  if (onTutorFilterChange) {
                    onTutorFilterChange(val);
                  }
                }}
                className="bg-white border border-[#D5D0C6] rounded-md px-2 py-1 text-xs font-medium text-[#161F1A] focus:outline-none focus:ring-1 focus:ring-[#2D8B5C] max-w-[120px] sm:max-w-none"
              >
                <option value="all">All Faculty</option>
                {tutors && tutors.length > 0 ? (
                  [...tutors]
                    .sort((a, b) => (a.tutorId || '').localeCompare(b.tutorId || '', undefined, { numeric: true, sensitivity: 'base' }))
                    .map((t, idx) => (
                      <option key={`${t.id || t.tutorId}_${idx}`} value={t.tutorId}>{t.tutorId} ({t.realName})</option>
                    ))
                ) : (
                  uniqueTutors.map((tId, idx) => (
                    <option key={`${tId}_${idx}`} value={tId}>{tId}</option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* Weekend Toggle: Mon-Fri by default */}
          <button
            id="timetable_weekend_toggle_btn"
            type="button"
            onClick={() => setShowWeekend(!showWeekend)}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer flex items-center space-x-1 ${
              showWeekend 
                ? 'bg-[#2D8B5C] text-white border-[#2D8B5C] shadow-2xs' 
                : 'bg-white text-[#5A6B61] border-[#D5D0C6] hover:bg-gray-100 hover:text-[#161F1A]'
            }`}
            title={showWeekend ? "Switch to Mon–Fri (5 days)" : "Click to show full 7 Days (Mon–Sun)"}
          >
            <span>{showWeekend ? '7 Days' : '+ 7 Days'}</span>
          </button>

        </div>
      </div>

      {/* Interactive Faculty Color Bar */}
      {selectedTutorFilter === 'all' && uniqueTutors.length > 0 && (
        <div className="px-3.5 py-1.5 bg-[#FAF9F7] border-b border-[#E3DFD7] flex items-center gap-2 overflow-x-auto text-[11px]">
          <span className="font-bold text-[#5A6B61] text-[10px] uppercase tracking-wider shrink-0 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#2D8B5C]"></span>
            Faculty Colors:
          </span>
          <div className="flex items-center gap-1.5 min-w-max">
            {uniqueTutors.map(tId => {
              const theme = getSlotColorTheme({ tutorId: tId });
              const tutorObj = tutors.find(t => t.tutorId === tId);
              const displayName = tutorObj?.realName ? `${tId} (${tutorObj.realName.split(' ')[0]})` : tId;
              return (
                <button
                  key={tId}
                  type="button"
                  onClick={() => {
                    setSelectedTutorFilter(tId);
                    if (onTutorFilterChange) onTutorFilterChange(tId);
                  }}
                  className={`px-2 py-0.5 rounded-md border flex items-center gap-1.5 transition-all cursor-pointer hover:shadow-2xs active:scale-95 ${theme.bg} ${theme.border}`}
                  title={`Click to filter schedule to ${tId} only`}
                >
                  <span className={`w-2 h-2 rounded-full ${theme.dot} shrink-0`} />
                  <span className={`font-bold text-[10.5px] ${theme.text}`}>{displayName}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter indicator if filtered to single tutor */}
      {selectedTutorFilter !== 'all' && (
        <div className="px-3.5 py-1.5 bg-emerald-50/80 border-b border-emerald-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-950 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            <span>Filtered to: <strong className="font-bold text-[#1E5C3D]">{selectedTutorFilter}</strong></span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedTutorFilter('all');
              if (onTutorFilterChange) onTutorFilterChange('all');
            }}
            className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
          >
            Show All Faculty
          </button>
        </div>
      )}

      {/* Mobile Day Selector Bar */}
      <div className={`px-2.5 py-2 bg-[#F2EFE9] border-b border-[#E3DFD7] flex items-center space-x-1.5 overflow-x-auto ${
        mobileViewMode === 'day' ? 'flex' : 'hidden md:hidden'
      }`}>
        <span className="text-[11px] font-bold text-[#5A6B61] uppercase tracking-wider pl-1 shrink-0">Day:</span>
        <div className="flex items-center space-x-1 min-w-max">
          {activeDays.map((day) => {
            const isSelected = effectiveMobileDay === day;
            const isWeekend = day === 'Saturday' || day === 'Sunday';
            const isToday = day === currentTeachingDay;
            const dayClassesCount = filteredClasses.filter(c => c.dayOfWeek === day).length;
            const shortName = day.substring(0, 3);

            return (
              <button
                key={day}
                type="button"
                onClick={() => setMobileDay(day)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-[#2D8B5C] text-white shadow-xs font-semibold'
                    : isToday
                    ? 'bg-emerald-50 border border-emerald-200 text-[#1E5C3D]'
                    : isWeekend
                    ? 'bg-amber-100/70 text-amber-900 hover:bg-amber-100'
                    : 'bg-white text-[#161F1A] hover:bg-gray-100 border border-[#D5D0C6]'
                }`}
              >
                <span className="flex items-center space-x-1">
                  <span>{shortName}</span>
                  {isToday && (
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isSelected ? 'bg-white' : 'bg-[#2D8B5C]'
                    } animate-pulse`} title="Today" />
                  )}
                </span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : dayClassesCount > 0
                    ? 'bg-[#2D8B5C]/15 text-[#1E5C3D] font-bold'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {dayClassesCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Day Agenda Timeline */}
      {mobileViewMode === 'day' && (
        <div className="block md:hidden max-h-[640px] overflow-y-auto divide-y divide-[#EAE6DE]">
          {effectiveMobileDay === currentTeachingDay && (
            <div className="sticky top-0 z-10 bg-emerald-50/95 backdrop-blur-xs border-b border-emerald-100 px-3.5 py-2 flex items-center justify-between text-[#1E5C3D]">
              <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2D8B5C] animate-pulse" />
                Today's Active Session
              </span>
              <span className="text-[10px] bg-[#2D8B5C] text-white px-2 py-0.5 rounded-md font-bold">
                {effectiveMobileDay}
              </span>
            </div>
          )}

          {TIME_SLOTS.map((slot) => {
            const compactLabel = COMPACT_SLOT_LABELS[slot] || formatTime12H(slot);
            const slotStartM = parseTimeToMinutes(slot);
            const directClasses = filteredClasses.filter(
              c => c.dayOfWeek === effectiveMobileDay && c.startTimePKT === slot
            );
            const extendedClasses = filteredClasses.filter(c => {
              if (c.dayOfWeek !== effectiveMobileDay) return false;
              const cStart = parseTimeToMinutes(c.startTimePKT);
              const cEnd = cStart + c.durationMinutes;
              return cStart < slotStartM && cEnd > slotStartM;
            });
            const allSlotCount = directClasses.length + extendedClasses.length;

            return (
              <div
                key={slot}
                className={`p-3 transition-colors flex items-start gap-3 ${
                  effectiveMobileDay === currentTeachingDay
                    ? 'bg-[#EAF5EE]/90 hover:bg-[#DDF0E3] border-l-2 border-l-[#2D8B5C]'
                    : 'hover:bg-gray-50/70'
                }`}
              >
                {/* Time Badge with delete button */}
                <div
                  onClick={() => {
                    if (role === 'admin') {
                      setIsManageSlotsModalOpen(true);
                    }
                  }}
                  className={`w-18 shrink-0 text-center bg-[#FAF9F7] border border-[#E3DFD7] rounded-lg py-2 px-1 relative ${
                    role === 'admin' ? 'hover:bg-amber-50 cursor-pointer transition-all hover:scale-[1.02] border-amber-200' : ''
                  }`}
                  title={role === 'admin' ? "Click to manage timetable rows" : undefined}
                >
                  <div className="font-mono font-bold text-xs text-[#161F1A]">{compactLabel}</div>
                  <div className="text-[9px] text-[#5A6B61] mt-0.5">PKT (30m)</div>
                  {role === 'admin' && !PKT_TIME_SLOTS.includes(slot as any) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveCustomSlot(slot);
                      }}
                      className="absolute -top-1.5 -right-1.5 bg-rose-100 hover:bg-rose-200 border border-rose-200 text-rose-700 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[11px] font-black cursor-pointer transition-all"
                      title={`Remove custom row for ${compactLabel}`}
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Class Content or Available Slot */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  {allSlotCount > 0 ? (
                    <>
                      {directClasses.map((cls) => {
                        const matchingStudent = students.find(
                          s => s.studentId === cls.studentId || s.name.toLowerCase() === cls.studentName.toLowerCase()
                        );
                        const isTrial = matchingStudent?.status === 'Trial' || cls.status === 'Trial' || Boolean(cls.notes?.toLowerCase().includes('trial'));
                        const isCancelled = cls.status === 'Cancelled';
                        const isLeaveToday = cls.status === 'Student on Leave' || Boolean(matchingStudent?.isOnLeave);
                        const isLeaveWeekly = cls.status === 'Student on Leave (Weekly)';
                        const isLongSession = (cls.durationMinutes || 30) > 30;

                        const isSingleTutor = selectedTutorFilter !== 'all' || role === 'tutor';
                        const theme = getSlotColorTheme(cls, isSingleTutor);

                        const cardBgClass = isCancelled
                          ? 'bg-rose-50/85 border-rose-200 border-l-[3.5px] border-l-rose-500 text-rose-950 opacity-80'
                          : isLeaveToday
                          ? 'bg-indigo-50/90 border-indigo-200 border-l-[3.5px] border-l-indigo-500 text-indigo-950 opacity-90'
                          : isLeaveWeekly
                          ? 'bg-amber-50/90 border-amber-200 border-l-[3.5px] border-l-amber-500 text-[#8C5D08] opacity-90'
                          : isLongSession
                          ? 'bg-amber-50/95 border-amber-300 border-l-[4px] border-l-amber-500 text-amber-950 shadow-xs'
                          : isTrial
                          ? 'bg-[#FFF9EE] border-[#E8A93E] border-l-[3.5px] border-l-[#E8A93E] text-[#8C5D08]'
                          : `${theme.bg} ${theme.border} border-l-[3.5px] ${theme.accentBar} ${theme.text}`;

                        return (
                          <div
                            key={cls.id}
                            onClick={() => setSelectedDetailClass(cls)}
                            className={`p-2.5 rounded-xl border text-xs shadow-2xs cursor-pointer transition-all active:scale-[0.99] ${cardBgClass}`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`font-bold text-sm truncate ${isCancelled || isLeaveToday || isLeaveWeekly ? 'line-through text-slate-500' : isLongSession ? 'text-amber-950 font-black' : theme.text}`}>
                                  {cls.studentName}
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shadow-3xs ${theme.tutorBadgeBg}`}>
                                  {cls.tutorId}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {isLongSession && (
                                  <span className="text-[9.5px] font-black text-amber-900 bg-amber-200/95 border border-amber-300 px-1.5 py-0.5 rounded shadow-3xs flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5 shrink-0" />
                                    <span>{cls.durationMinutes} MIN ({formatTime12H(cls.startTimePKT)}–{calculateEndTime12H(cls.startTimePKT, cls.durationMinutes)})</span>
                                  </span>
                                )}
                                {isCancelled && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-200 text-rose-900">
                                    Cancelled
                                  </span>
                                )}
                                {isLeaveToday && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-900">
                                    Leave (Today)
                                  </span>
                                )}
                                {isLeaveWeekly && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-[#8C5D08]">
                                    Leave (Weekly)
                                  </span>
                                )}
                                {isTrial && !isCancelled && !isLeaveToday && !isLeaveWeekly && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8A93E] text-white inline-flex items-center gap-1">
                                    <Star className="w-2.5 h-2.5 fill-white text-white shrink-0" />
                                    <span>Trial Lesson</span>
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-1 text-[11px] text-[#5A6B61]">
                              <span>ID: <strong className="text-[#161F1A] font-mono">{cls.studentId}</strong></span>
                              <span className={`font-semibold ${isLongSession ? 'text-amber-900 font-bold' : theme.text}`}>
                                {isLongSession ? `${cls.durationMinutes}m Class (${formatTime12H(cls.startTimePKT)} – ${calculateEndTime12H(cls.startTimePKT, cls.durationMinutes)})` : cls.tutorId}
                              </span>
                            </div>
                            {cls.notes && (
                              <p className="text-[10px] text-gray-600 mt-1 italic line-clamp-1">
                                Note: {cls.notes}
                              </p>
                            )}
                          </div>
                        );
                      })}

                      {/* Extended / Spanned Class Cards */}
                      {extendedClasses.map((cls) => {
                        const isSingleTutor = selectedTutorFilter !== 'all' || role === 'tutor';
                        const theme = getSlotColorTheme(cls, isSingleTutor);
                        const endLabel = calculateEndTime12H(cls.startTimePKT, cls.durationMinutes);
                        return (
                          <div
                            key={`ext_mob_${cls.id}`}
                            onClick={() => setSelectedDetailClass(cls)}
                            className="p-2.5 rounded-xl border border-dashed border-amber-300 bg-amber-50/85 hover:bg-amber-100/80 text-amber-950 text-xs shadow-2xs cursor-pointer transition-all active:scale-[0.99]"
                            title={`Extended ${cls.durationMinutes}m Session: Started at ${formatTime12H(cls.startTimePKT)} and continues until ${endLabel}`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-extrabold text-sm text-amber-950 truncate flex items-center gap-1">
                                  <span>⤷ {cls.studentName}</span>
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shadow-3xs ${theme.tutorBadgeBg}`}>
                                  {cls.tutorId}
                                </span>
                              </div>
                              <span className="text-[9.5px] font-black text-amber-900 bg-amber-200/90 border border-amber-300 px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow-3xs">
                                <Clock className="w-2.5 h-2.5 shrink-0" />
                                <span>Cont. until {endLabel}</span>
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-1 text-[11px] text-amber-800 font-medium">
                              <span>{cls.durationMinutes}m Class ({formatTime12H(cls.startTimePKT)} – {endLabel})</span>
                              <span className="font-bold text-amber-900 bg-amber-200/60 px-1.5 py-0.2 rounded text-[10px]">Slot Occupied</span>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div
                      onClick={() => onAddClass && onAddClass({ day: effectiveMobileDay, time: slot })}
                      className={`flex items-center justify-between py-2 px-3 rounded-lg border border-dashed transition-all ${
                        effectiveMobileDay === currentTeachingDay
                          ? 'border-[#2D8B5C]/30 bg-[#F0F7F3]'
                          : 'border-gray-200 bg-gray-50/50'
                      } ${
                        onAddClass ? 'cursor-pointer hover:bg-emerald-50/80 hover:border-[#2D8B5C]/40 group' : ''
                      }`}
                    >
                      <span className="text-xs text-gray-400 group-hover:text-[#2D8B5C] font-medium">Available Slot</span>
                      {onAddClass && (
                        <button
                          type="button"
                          className="px-2.5 py-1 bg-[#2D8B5C]/10 group-hover:bg-[#2D8B5C] text-[#2D8B5C] group-hover:text-white rounded-md text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Book</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Grid Table (Desktop default or Mobile Grid Mode) */}
      <div className={`overflow-x-auto max-h-[640px] ${mobileViewMode === 'day' ? 'hidden md:block' : 'block'}`}>
        <table className="w-full border-collapse text-left text-xs">
          {/* Table Header: Day Columns */}
          <thead className="sticky top-0 z-20 bg-white border-b border-[#EDEAE3] shadow-xs">
            <tr>
              {/* Top-left Time Corner */}
              <th
                onClick={() => {
                  if (role === 'admin') {
                    setIsManageSlotsModalOpen(true);
                  }
                }}
                className={`py-2.5 px-3 w-24 border-r border-b border-[#EDEAE3] text-center font-bold text-[#5A6B61] text-[10px] uppercase tracking-wider sticky left-0 bg-[#FAFAF9] z-30 transition-colors ${
                  role === 'admin' ? 'hover:bg-amber-50 hover:text-[#1E5C3D] cursor-pointer group' : ''
                }`}
                title={role === 'admin' ? "Click to manage timetable rows" : undefined}
              >
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <span>TIME (PKT)</span>
                  {role === 'admin' && (
                    <span className="text-[8px] text-[#2D8B5C] font-extrabold group-hover:underline flex items-center gap-0.5 mt-0.5 uppercase">
                      <Plus className="w-2 h-2" /> Rows
                    </span>
                  )}
                </div>
              </th>
              {activeDays.map((day) => {
                const isToday = day === currentTeachingDay;
                const dayClassesCount = filteredClasses.filter(c => c.dayOfWeek === day).length;
                return (
                  <th
                    key={day}
                    className={`py-2 px-3 border-r border-[#EDEAE3] min-w-[160px] transition-all relative ${
                      isToday
                        ? 'bg-[#1E5C3D] text-white border-b-2 border-[#164830] shadow-xs'
                        : 'bg-white text-[#1E5C3D] border-b border-[#EDEAE3] hover:bg-gray-50/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 h-7">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`text-[11px] font-extrabold tracking-tight truncate ${
                          isToday ? 'text-white' : 'text-[#161F1A]'
                        }`}>
                          {day}
                        </span>
                        {isToday && (
                          <span className="bg-[#E8A93E] text-white text-[8px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded-sm flex items-center gap-0.5 shadow-2xs select-none">
                            <Clock className="w-2 h-2" />
                            <span>TODAY</span>
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                        isToday
                          ? 'bg-white/20 text-white font-mono'
                          : dayClassesCount > 0
                          ? 'bg-[#2D8B5C]/10 text-[#1E5C3D] border border-[#2D8B5C]/20 font-mono'
                          : 'bg-gray-100 text-gray-400 font-mono'
                      }`}>
                        {dayClassesCount}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-[#EDEAE3]">
            {TIME_SLOTS.map((slot) => {
              const compactLabel = COMPACT_SLOT_LABELS[slot] || formatTime12H(slot);

              return (
                <tr key={slot} className="hover:bg-[#FAF9F7]/40 transition-colors">
                  {/* Sticky Time Header */}
                  <td
                    onClick={() => {
                      if (role === 'admin') {
                        setIsManageSlotsModalOpen(true);
                      }
                    }}
                    className={`py-1.5 px-3 border-r border-b border-[#EDEAE3] bg-[#FAFAF9] sticky left-0 z-10 select-none transition-colors ${
                      role === 'admin' ? 'hover:bg-amber-50 cursor-pointer group/timecell' : ''
                    }`}
                    title={role === 'admin' ? "Click to manage timetable rows" : undefined}
                  >
                    <div className="flex items-center justify-between gap-1.5 min-w-[70px]">
                      <span className="text-[11px] font-bold text-[#161F1A] tracking-tight leading-none whitespace-nowrap group-hover/timecell:text-[#1E5C3D]">
                        {compactLabel}
                      </span>
                      {role === 'admin' && !PKT_TIME_SLOTS.includes(slot as any) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveCustomSlot(slot);
                          }}
                          className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 w-4 h-4 rounded flex items-center justify-center cursor-pointer transition-colors text-xs font-black shrink-0"
                          title={`Remove custom row for ${compactLabel}`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Day Cells */}
                  {activeDays.map((day) => {
                    const isToday = day === currentTeachingDay;
                    const isWeekend = day === 'Saturday' || day === 'Sunday';
                    const slotStartM = parseTimeToMinutes(slot);

                    const directClasses = filteredClasses.filter(
                      c => c.dayOfWeek === day && c.startTimePKT === slot
                    );
                    const extendedClasses = filteredClasses.filter(c => {
                      if (c.dayOfWeek !== day) return false;
                      const cStart = parseTimeToMinutes(c.startTimePKT);
                      const cEnd = cStart + c.durationMinutes;
                      return cStart < slotStartM && cEnd > slotStartM;
                    });

                    const totalCellClassesCount = directClasses.length + extendedClasses.length;
                    const allCellClasses = [...directClasses, ...extendedClasses];

                    return (
                      <td
                        key={`${day}_${slot}`}
                        onClick={() => {
                          if (totalCellClassesCount === 0) {
                            if (onAddClass) {
                              onAddClass({ day, time: slot });
                            }
                          } else if (totalCellClassesCount === 1) {
                            setSelectedDetailClass(allCellClasses[0]);
                          } else {
                            setSelectedSlotDetails({ day, slot, classes: allCellClasses });
                          }
                        }}
                        className={`p-1 border-r border-b border-[#EDEAE3] align-top min-w-[160px] relative group transition-all duration-150 ${
                          isToday
                            ? 'bg-[#EAF5EE]/90 hover:bg-[#DDF0E3] border-x border-x-[#2D8B5C]/25 shadow-[inset_0_0_0_1px_rgba(45,139,92,0.08)]'
                            : isWeekend
                            ? 'bg-amber-50/25 hover:bg-amber-50/50'
                            : 'bg-white hover:bg-[#FAF9F7]'
                        } ${
                          (totalCellClassesCount > 0 || onAddClass) ? 'cursor-pointer' : ''
                        }`}
                      >
                        {totalCellClassesCount > 0 ? (
                          <div className="space-y-1">
                            {directClasses.slice(0, 2).map((cls) => {
                              const matchingStudent = students.find(
                                s => s.studentId === cls.studentId || s.name.toLowerCase() === cls.studentName.toLowerCase()
                              );
                              const isTrial = matchingStudent?.status === 'Trial' || cls.status === 'Trial' || Boolean(cls.notes?.toLowerCase().includes('trial'));
                              const isCancelled = cls.status === 'Cancelled';
                              const isLeaveToday = cls.status === 'Student on Leave' || Boolean(matchingStudent?.isOnLeave);
                              const isLeaveWeekly = cls.status === 'Student on Leave (Weekly)';
                              const isLongSession = (cls.durationMinutes || 30) > 30;

                              const isSingleTutor = selectedTutorFilter !== 'all' || role === 'tutor';
                              const theme = getSlotColorTheme(cls, isSingleTutor);

                              const cardClasses = isCancelled
                                ? 'bg-rose-50/90 border-rose-200 border-l-[3.5px] border-l-rose-500 text-rose-950 opacity-85'
                                : isLeaveToday
                                ? 'bg-indigo-50/90 border-indigo-200 border-l-[3.5px] border-l-indigo-500 text-indigo-950 opacity-90'
                                : isLeaveWeekly
                                ? 'bg-amber-50/90 border-amber-200 border-l-[3.5px] border-l-amber-500 text-[#8C5D08] opacity-90'
                                : isLongSession
                                ? 'bg-amber-50/95 border-amber-300 border-l-[4px] border-l-amber-500 text-amber-950 shadow-xs'
                                : isTrial
                                ? 'bg-[#FFF9EE] border-[#E8A93E] border-l-[3.5px] border-l-[#E8A93E] text-[#8C5D08]'
                                : `${theme.bg} ${theme.border} border-l-[3.5px] ${theme.accentBar} ${theme.text}`;

                              return (
                                <div
                                  key={cls.id}
                                  id={`class_card_${cls.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDetailClass(cls);
                                  }}
                                  className={`px-2.5 py-1.5 rounded-lg border text-xs shadow-2xs transition-all cursor-pointer hover:shadow-xs hover:scale-[1.01] flex items-center justify-between gap-1.5 ${cardClasses}`}
                                  title={isLongSession 
                                    ? `⭐ ${cls.durationMinutes}-Minute Extended Session (${formatTime12H(cls.startTimePKT)} – ${calculateEndTime12H(cls.startTimePKT, cls.durationMinutes)}). Click for details.`
                                    : "Click to view full class session details, edit, or cancel"}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span
                                        className={`font-bold text-[11.5px] truncate tracking-tight leading-tight ${
                                          isCancelled || isLeaveToday || isLeaveWeekly
                                            ? 'line-through text-slate-400'
                                            : isLongSession
                                            ? 'text-amber-950 font-black'
                                            : theme.text
                                        }`}
                                        title={cls.studentName}
                                      >
                                        {cls.studentName}
                                      </span>

                                      {((role === 'admin' || role === 'supervisor') && selectedTutorFilter === 'all') && (
                                        <span
                                          className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border shadow-3xs ${theme.tutorBadgeBg}`}
                                          title={`Tutor: ${cls.tutorId}`}
                                        >
                                          {cls.tutorId}
                                        </span>
                                      )}

                                      {isLongSession && (
                                        <span
                                          className="text-[8.5px] font-black text-amber-950 bg-amber-200/90 border border-amber-400/80 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5 shadow-3xs"
                                          title={`Extended Duration: ${cls.durationMinutes} Minutes (Ends ${calculateEndTime12H(cls.startTimePKT, cls.durationMinutes)})`}
                                        >
                                          <Clock className="w-2 h-2 text-amber-800 shrink-0" />
                                          <span>{cls.durationMinutes}m ({formatTime12H(cls.startTimePKT)}–{calculateEndTime12H(cls.startTimePKT, cls.durationMinutes)})</span>
                                        </span>
                                      )}

                                      {isTrial && !isCancelled && !isLeaveToday && !isLeaveWeekly && (
                                        <span
                                          className="text-[8.5px] font-black text-[#B27000] bg-[#FFF3DC] px-1.5 py-0.2 rounded border border-[#E8A93E]/40 inline-flex items-center gap-0.5 shadow-3xs"
                                          title="Trial Class"
                                        >
                                          <Star className="w-2.5 h-2.5 fill-[#E8A93E] text-[#E8A93E] shrink-0" />
                                          <span>TRIAL</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-1 shrink-0 select-none">
                                    {isCancelled && (
                                      <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-rose-200 text-rose-900 uppercase tracking-wide">
                                        Cancelled
                                      </span>
                                    )}
                                    {isLeaveToday && (
                                      <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-indigo-200 text-indigo-900 uppercase tracking-wide">
                                        Leave
                                      </span>
                                    )}
                                    {isLeaveWeekly && (
                                      <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-200 text-[#8C5D08] uppercase tracking-wide">
                                        Leave
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {/* Extended / Spanned Continuation Cards in Desktop Table */}
                            {extendedClasses.slice(0, 2).map((cls) => {
                              const isSingleTutor = selectedTutorFilter !== 'all' || role === 'tutor';
                              const theme = getSlotColorTheme(cls, isSingleTutor);
                              const endLabel = calculateEndTime12H(cls.startTimePKT, cls.durationMinutes);
                              return (
                                <div
                                  key={`ext_tbl_${cls.id}`}
                                  id={`ext_class_card_${cls.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDetailClass(cls);
                                  }}
                                  className="px-2 py-1.5 rounded-lg border border-dashed border-amber-300 bg-amber-50/80 hover:bg-amber-100/85 text-xs shadow-2xs transition-all cursor-pointer hover:scale-[1.01] flex items-center justify-between gap-1"
                                  title={`Occupied by ${cls.studentName}'s ${cls.durationMinutes}-minute session (started ${formatTime12H(cls.startTimePKT)}, ends ${endLabel}). Click for details.`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span className="font-extrabold text-[11px] text-amber-950 truncate flex items-center gap-0.5">
                                        <span>⤷ {cls.studentName}</span>
                                      </span>
                                      {((role === 'admin' || role === 'supervisor') && selectedTutorFilter === 'all') && (
                                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border shadow-3xs ${theme.tutorBadgeBg}`}>
                                          {cls.tutorId}
                                        </span>
                                      )}
                                      <span className="text-[8.5px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300/80 px-1 py-0.2 rounded inline-flex items-center gap-0.5">
                                        <Clock className="w-2 h-2 shrink-0" />
                                        <span>Cont. until {endLabel}</span>
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-amber-200/90 text-amber-900 uppercase shrink-0 border border-amber-300/60">
                                    {cls.durationMinutes}m
                                  </span>
                                </div>
                              );
                            })}

                            {totalCellClassesCount > 2 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSlotDetails({ day, slot, classes: allCellClasses });
                                }}
                                className="w-full mt-1.5 py-1 px-2 bg-[#E8F5E9] hover:bg-[#C8E6C9] border border-[#A5D6A7]/50 text-[#1E5C3D] hover:text-[#113C25] rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-3xs hover:scale-[1.01]"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-[#2D8B5C] animate-pulse" />
                                <span>+ {totalCellClassesCount - 2} more classes</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="w-full h-full min-h-[30px] flex items-center justify-center">
                            {onAddClass ? (
                              <div
                                className={`w-full h-full flex items-center justify-center transition-all text-xs font-medium ${
                                  isToday
                                    ? 'text-[#2D8B5C] group-hover:text-[#1E5C3D]'
                                    : 'text-gray-300 group-hover:text-[#2D8B5C]'
                                }`}
                                title={`Schedule on ${day} at ${compactLabel}`}
                              >
                                <span className={`group-hover:hidden text-[11px] ${
                                  isToday ? 'text-[#2D8B5C]/60 font-semibold' : 'text-gray-300/60'
                                }`}>—</span>
                                <div className={`hidden group-hover:flex items-center justify-center gap-1 px-2 py-0.5 rounded shadow-3xs transition-all ${
                                  isToday
                                    ? 'bg-white text-[#1E5C3D] border border-[#2D8B5C]/35 font-semibold'
                                    : 'bg-white text-[#2D8B5C] border border-[#2D8B5C]/20 font-semibold'
                                }`}>
                                  <Plus className="w-3 h-3 text-[#2D8B5C]" />
                                  <span className="text-[10px] font-bold">Book</span>
                                </div>
                              </div>
                            ) : (
                              <span className={`text-[11px] ${
                                isToday ? 'text-[#2D8B5C]/60 font-semibold' : 'text-gray-300/60'
                              }`}>—</span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Legend */}
      <div className="px-3.5 py-2 bg-[#FAF9F7] border-t border-[#E3DFD7] flex flex-wrap items-center justify-between text-[11px] text-[#5A6B61] gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-[#161F1A]">Faculty Tutors:</span>
          {uniqueTutors.map(tId => {
            const theme = getSlotColorTheme({ tutorId: tId });
            return (
              <span key={tId} className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md border text-[10.5px] ${theme.bg} ${theme.border}`}>
                <span className={`w-2 h-2 rounded-full ${theme.dot}`}></span>
                <span className={`font-bold ${theme.text}`}>{tId}</span>
              </span>
            );
          })}
        </div>
        <div className="flex items-center space-x-3 text-[10px]">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-[#E8A93E]"></span>
            <span>Trial Lesson</span>
          </span>
          <span className="text-gray-400">•</span>
          <span>Click any slot or class for details & actions</span>
        </div>
      </div>

      {/* Class Details Modal */}
      <ClassDetailModal
        isOpen={!!selectedDetailClass}
        onClose={() => setSelectedDetailClass(null)}
        classItem={selectedDetailClass}
        student={detailStudent}
        tutor={detailTutor}
        onEdit={onEditClass}
        onDelete={onDeleteClass}
        onCancel={onCancelClass}
        onLogLesson={onLogLesson}
        role={role}
      />

      {/* Manage Grid Time Rows Modal (Admin only) */}
      {isManageSlotsModalOpen && role === 'admin' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-[#E3DFD7] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-3.5 bg-[#1E5C3D] text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-[#E8A93E]" />
                <h3 className="font-bold text-sm">Manage Timetable Time Rows</h3>
              </div>
              <button
                onClick={() => setIsManageSlotsModalOpen(false)}
                className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 text-xs">
              <p className="text-gray-600 leading-relaxed">
                By default, the timetable maintains a clean, fixed view from <strong className="text-gray-900 font-mono">01:00 AM to 07:00 AM PKT</strong>.
                As an Admin, you can add custom off-peak rows below to schedule sessions at other hours.
              </p>

              {/* Add New Row Box */}
              <div className="bg-[#FAF9F7] border border-[#E3DFD7] rounded-xl p-4 space-y-3">
                <h4 className="font-extrabold text-[#1E5C3D] uppercase tracking-wide text-[10px]">Add Custom Time Row</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Select Time</label>
                    <input
                      type="time"
                      value={modalNewSlotValue}
                      onChange={(e) => setModalNewSlotValue(e.target.value)}
                      className="w-full bg-white border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Row Position</label>
                    <select
                      value={modalSlotPosition}
                      onChange={(e) => setModalSlotPosition(e.target.value as 'top' | 'bottom')}
                      className="w-full bg-white border border-[#D5D0C6] rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                    >
                      <option value="top">Top (Night Shifts)</option>
                      <option value="bottom">Bottom (Morning/Evening)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (modalSlotPosition === 'top') {
                      handleAddCustomSlotTop(modalNewSlotValue);
                    } else {
                      handleAddCustomSlotBottom(modalNewSlotValue);
                    }
                  }}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Time Row</span>
                </button>
              </div>

              {/* Active Rows List */}
              <div className="space-y-2">
                <h4 className="font-extrabold text-gray-700 uppercase tracking-wide text-[10px]">Active Custom Rows</h4>
                
                {customGridSlotsTop.length === 0 && customGridSlotsBottom.length === 0 ? (
                  <div className="text-center py-4 border border-dashed border-gray-200 rounded-xl bg-gray-50/50 text-gray-400 italic text-[11px]">
                    No custom rows active. Timetable is clean and fixed.
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 border border-[#EDEAE3] rounded-xl p-2.5 bg-white">
                    {/* Top Slots */}
                    {customGridSlotsTop.map((slot) => (
                      <div key={slot} className="flex items-center justify-between p-1.5 bg-amber-50/20 border border-amber-100 rounded-lg text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-950">{COMPACT_SLOT_LABELS[slot] || formatTime12H(slot)}</span>
                          <span className="bg-amber-100 text-amber-800 text-[8px] font-bold px-1 rounded uppercase">TOP</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomSlot(slot)}
                          className="text-rose-600 hover:text-rose-800 font-bold px-1.5 py-0.5 rounded hover:bg-rose-50 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ))}

                    {/* Bottom Slots */}
                    {customGridSlotsBottom.map((slot) => (
                      <div key={slot} className="flex items-center justify-between p-1.5 bg-emerald-50/20 border border-emerald-100 rounded-lg text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-emerald-950">{COMPACT_SLOT_LABELS[slot] || formatTime12H(slot)}</span>
                          <span className="bg-emerald-100 text-emerald-800 text-[8px] font-bold px-1 rounded uppercase">BOTTOM</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomSlot(slot)}
                          className="text-rose-600 hover:text-rose-800 font-bold px-1.5 py-0.5 rounded hover:bg-rose-50 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-[#FAF9F7] border-t border-[#EAE6DE] flex justify-end">
              <button
                type="button"
                onClick={() => setIsManageSlotsModalOpen(false)}
                className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-xs cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Roll-up Slot Details Modal (Solution 1) */}
      {selectedSlotDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-[#E3DFD7] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 bg-[#1E5C3D] text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">
                  {selectedSlotDetails.day} at {formatTime12H(selectedSlotDetails.slot)}
                </h3>
                <p className="text-[11px] text-emerald-100 font-medium">
                  {selectedSlotDetails.classes.length} Sessions Scheduled
                </p>
              </div>
              <button
                onClick={() => setSelectedSlotDetails(null)}
                className="p-1.5 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content List */}
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-2.5">
              <p className="text-gray-500 text-xs leading-relaxed mb-1">
                Showing all active classes for this slot. Click on any class card to view session actions, mark attendance, log lessons, or reschedule.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {selectedSlotDetails.classes.map((cls) => {
                  const matchingStudent = students.find(
                    s => s.studentId === cls.studentId || s.name.toLowerCase() === cls.studentName.toLowerCase()
                  );
                  const isTrial = matchingStudent?.status === 'Trial' || cls.status === 'Trial' || Boolean(cls.notes?.toLowerCase().includes('trial'));
                  const isCancelled = cls.status === 'Cancelled';
                  const isLeaveToday = cls.status === 'Student on Leave' || Boolean(matchingStudent?.isOnLeave);
                  const isLeaveWeekly = cls.status === 'Student on Leave (Weekly)';

                  const isSingleTutor = selectedTutorFilter !== 'all' || role === 'tutor';
                  const theme = getSlotColorTheme(cls, isSingleTutor);

                  const cardClassNames = isCancelled
                    ? 'bg-rose-50/85 border-rose-200 border-l-[3.5px] border-l-rose-500 text-rose-950 opacity-90'
                    : isLeaveToday
                    ? 'bg-indigo-50/85 border-indigo-200 border-l-[3.5px] border-l-indigo-500 text-indigo-950 opacity-90'
                    : isLeaveWeekly
                    ? 'bg-amber-50/85 border-amber-200 border-l-[3.5px] border-l-amber-500 text-[#8C5D08] opacity-90'
                    : isTrial
                    ? 'bg-[#FFF9EE] border-[#E8A93E]/50 border-l-[3.5px] border-l-[#E8A93E] text-[#8C5D08]'
                    : `${theme.bg} ${theme.border} border-l-[3.5px] ${theme.accentBar} ${theme.text}`;

                  return (
                    <div
                      key={cls.id}
                      onClick={() => {
                        setSelectedDetailClass(cls);
                        setSelectedSlotDetails(null); // Close this roll-up list so the main details card shows clearly
                      }}
                      className={`p-3 rounded-xl border text-xs shadow-3xs hover:shadow-xs hover:scale-[1.01] transition-all cursor-pointer flex flex-col justify-between gap-2 text-left ${cardClassNames}`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                          <h4 className={`font-extrabold text-[12px] truncate leading-tight ${isCancelled || isLeaveToday || isLeaveWeekly ? 'line-through text-slate-400' : theme.text}`}>
                            {cls.studentName}
                          </h4>
                          <p className="text-[10px] text-gray-500 font-mono mt-0.5">ID: {cls.studentId || 'N/A'}</p>
                        </div>

                        {/* Tutor badge */}
                        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wide shrink-0 border ${theme.tutorBadgeBg}`}>
                          {cls.tutorId}
                        </span>
                      </div>

                      {/* Badges row */}
                      <div className="flex flex-wrap gap-1">
                        {cls.durationMinutes && cls.durationMinutes > 30 && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-200 text-amber-950 border border-amber-300 flex items-center gap-0.5 uppercase">
                            <Clock className="w-2 h-2 shrink-0" />
                            <span>{cls.durationMinutes}m ({formatTime12H(cls.startTimePKT)}–{calculateEndTime12H(cls.startTimePKT, cls.durationMinutes)})</span>
                          </span>
                        )}
                        {isCancelled && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-rose-200 text-rose-900 uppercase">
                            Cancelled
                          </span>
                        )}
                        {isLeaveToday && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-indigo-200 text-indigo-900 uppercase">
                            Leave (Today)
                          </span>
                        )}
                        {isLeaveWeekly && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-200 text-[#8C5D08] uppercase">
                            Leave (Weekly)
                          </span>
                        )}
                        {isTrial && !isCancelled && !isLeaveToday && !isLeaveWeekly && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-900 flex items-center gap-0.5 uppercase">
                            <Star className="w-2 h-2 fill-amber-500 text-amber-500 shrink-0" />
                            <span>TRIAL</span>
                          </span>
                        )}
                        {!isCancelled && !isLeaveToday && !isLeaveWeekly && !isTrial && (!cls.durationMinutes || cls.durationMinutes === 30) && (
                          <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100/70 text-emerald-800 uppercase">
                            Regular
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-[#FAF9F7] border-t border-[#EAE6DE] flex items-center justify-between">
              {role === 'admin' && onAddClass ? (
                <button
                  type="button"
                  onClick={() => {
                    const slotData = { day: selectedSlotDetails.day, time: selectedSlotDetails.slot };
                    setSelectedSlotDetails(null);
                    onAddClass(slotData);
                  }}
                  className="px-3.5 py-1.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white font-bold rounded-lg text-xs cursor-pointer transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Class to Slot</span>
                </button>
              ) : <div />}
              <button
                type="button"
                onClick={() => setSelectedSlotDetails(null)}
                className="px-4.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-xs cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

