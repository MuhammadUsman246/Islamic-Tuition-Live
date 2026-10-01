import React, { useState, useMemo } from 'react';
import {
  Clock,
  Users,
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Plus,
  Sparkles,
  ChevronRight,
  UserCheck,
  UserX,
  Layers,
  ArrowRight,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  Video
} from 'lucide-react';
import { Tutor, Student, DayOfWeek, TimetableClass } from '../../types';

interface TutorSlotAvailabilityInspectorProps {
  tutors: Tutor[];
  students: Student[];
  classes?: TimetableClass[];
  onAddClass?: (tutorId: string, day: DayOfWeek, slot: string) => void;
  onSelectTutor?: (tutor: Tutor) => void;
  onSelectStudent?: (student: Student) => void;
}

const DAYS_OF_WEEK: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

// Full 24-hour slot generation (48 half-hour slots) to ensure complete coverage for global academy operations
const ALL_24H_SLOTS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  return `${h.toString().padStart(2, '0')}:${m}`;
});

const TIME_SEGMENTS = [
  { id: 'all', label: 'All 24 Hours', icon: Clock, range: [0, 48] },
  { id: 'night', label: 'Night / Early AM (12 AM - 6 AM)', icon: Moon, range: [0, 12] },
  { id: 'morning', label: 'Morning (6 AM - 12 PM)', icon: Sunrise, range: [12, 24] },
  { id: 'afternoon', label: 'Afternoon (12 PM - 6 PM)', icon: Sun, range: [24, 36] },
  { id: 'evening', label: 'Evening (6 PM - 12 AM)', icon: Sunset, range: [36, 48] },
];

export const TutorSlotAvailabilityInspector: React.FC<TutorSlotAvailabilityInspectorProps> = ({
  tutors = [],
  students = [],
  classes = [],
  onAddClass,
  onSelectTutor,
  onSelectStudent,
}) => {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [timeSegment, setTimeSegment] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [highlightSlot, setHighlightSlot] = useState<string>('');
  const [expandedSlots, setExpandedSlots] = useState<Record<string, boolean>>({});

  // Format 24h time to 12h readable string (e.g. 03:00 -> 3:00 AM, 15:30 -> 3:30 PM)
  const format12Hour = (time24: string) => {
    const [hStr, mStr] = time24.split(':');
    const h = parseInt(hStr, 10);
    const m = mStr || '00';
    if (isNaN(h)) return time24;
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayH}:${m} ${period}`;
  };

  // Convert PKT time to UK (GMT/BST approx -4h / -5h) & US EST (-9h / -10h) reference hints
  const getConvertedTimeHints = (pktTime: string) => {
    const [hStr, mStr] = pktTime.split(':');
    const h = parseInt(hStr, 10);
    if (isNaN(h)) return '';
    const m = mStr || '00';
    
    // PKT is UTC+5. UK is UTC+0/+1. US EST is UTC-5.
    const ukH = (h - 4 + 24) % 24;
    const estH = (h - 9 + 24) % 24;
    
    const uk12 = `${ukH === 0 ? 12 : ukH > 12 ? ukH - 12 : ukH}:${m} ${ukH >= 12 ? 'PM' : 'AM'} UK`;
    const est12 = `${estH === 0 ? 12 : estH > 12 ? estH - 12 : estH}:${m} ${estH >= 12 ? 'PM' : 'AM'} US/EST`;
    
    return `(${uk12} • ${est12})`;
  };

  // Build complete lookup of which tutors are busy at each slot for the selected day
  const slotData = useMemo(() => {
    const activeTutors = tutors.filter(t => t.status !== 'Inactive');

    // Filter slots based on selected segment
    const segment = TIME_SEGMENTS.find(s => s.id === timeSegment) || TIME_SEGMENTS[0];
    const slotsToProcess = ALL_24H_SLOTS.slice(segment.range[0], segment.range[1]);

    return slotsToProcess.map((slot) => {
      // Find all classes booked at this day and slot from classes prop
      const matchingClasses = classes.filter(c => {
        if (c.dayOfWeek !== selectedDay) return false;
        if (c.status === 'Cancelled') return false;
        return c.startTimePKT === slot;
      });

      // Map occupied tutor IDs
      const busyTutorIds = new Set<string>();
      const tutorClassMap: Record<string, TimetableClass[]> = {};

      matchingClasses.forEach((cls) => {
        if (cls.tutorId) {
          busyTutorIds.add(cls.tutorId);
          if (!tutorClassMap[cls.tutorId]) {
            tutorClassMap[cls.tutorId] = [];
          }
          tutorClassMap[cls.tutorId].push(cls);
        }
      });

      // Split tutors into Available and Busy
      const availableTutors = activeTutors.filter(t => !busyTutorIds.has(t.tutorId) && !busyTutorIds.has(t.id));
      const busyTutors = activeTutors
        .filter(t => busyTutorIds.has(t.tutorId) || busyTutorIds.has(t.id))
        .map(t => ({
          tutor: t,
          assignedClasses: tutorClassMap[t.tutorId] || tutorClassMap[t.id] || []
        }));

      // Filter by search query if any
      const filteredAvailable = availableTutors.filter(t => 
        !searchQuery || 
        t.realName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tutorId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
      );

      const filteredBusy = busyTutors.filter(b => 
        !searchQuery || 
        b.tutor.realName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.tutor.tutorId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.assignedClasses.some(c => c.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) || c.studentId?.toLowerCase().includes(searchQuery.toLowerCase()))
      );

      const totalFaculty = activeTutors.length;
      const freeCount = availableTutors.length;
      const busyCount = busyTutors.length;
      const availabilityPct = totalFaculty > 0 ? Math.round((freeCount / totalFaculty) * 100) : 0;

      return {
        slot,
        display12: format12Hour(slot),
        timeHints: getConvertedTimeHints(slot),
        availableTutors: filteredAvailable,
        busyTutors: filteredBusy,
        rawAvailableCount: freeCount,
        rawBusyCount: busyCount,
        totalFaculty,
        availabilityPct
      };
    });
  }, [tutors, classes, selectedDay, timeSegment, searchQuery]);

  // Overall day metrics
  const dayStats = useMemo(() => {
    let totalSlotsCovered = 0;
    let totalOpenSeats = 0;
    let mostAvailableSlot = { slot: '', count: -1 };
    let busiestSlot = { slot: '', count: -1 };

    slotData.forEach(d => {
      totalSlotsCovered++;
      totalOpenSeats += d.rawAvailableCount;
      if (d.rawAvailableCount > mostAvailableSlot.count) {
        mostAvailableSlot = { slot: d.display12, count: d.rawAvailableCount };
      }
      if (d.rawBusyCount > busiestSlot.count) {
        busiestSlot = { slot: d.display12, count: d.rawBusyCount };
      }
    });

    return {
      totalOpenSeats,
      avgOpenPerSlot: totalSlotsCovered > 0 ? (totalOpenSeats / totalSlotsCovered).toFixed(1) : 0,
      mostAvailableSlot,
      busiestSlot
    };
  }, [slotData]);

  const toggleExpand = (slot: string) => {
    setExpandedSlots(prev => ({ ...prev, [slot]: !prev[slot] }));
  };

  const handleQuickJump = (slotTime: string) => {
    setHighlightSlot(slotTime);
    const element = document.getElementById(`slot-card-${slotTime}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => setHighlightSlot(''), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Deck */}
      <div className="bg-gradient-to-r from-[#1B365D] via-[#152A4A] to-[#0A192F] text-white p-6 rounded-2xl shadow-md border border-[#2A4365]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>24/7 Master Timetable Availability Engine</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Faculty Availability by Time Slot
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Inspect exactly which tutors are free and which are occupied across all 48 half-hour slots. Add classes instantly to any available tutor at any time (e.g. 3:00 AM, 5:30 PM, etc.).
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl p-3 text-center">
              <span className="text-xs text-slate-300 font-medium block">Total Free Slots</span>
              <span className="text-xl font-bold text-emerald-400">{dayStats.totalOpenSeats}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Tutor-hours open</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl p-3 text-center">
              <span className="text-xs text-slate-300 font-medium block">Peak Open Slot</span>
              <span className="text-lg font-bold text-amber-300">{dayStats.mostAvailableSlot.slot || 'N/A'}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">{dayStats.mostAvailableSlot.count} free tutors</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
              <span className="text-xs text-slate-300 font-medium block">Peak Rush Slot</span>
              <span className="text-lg font-bold text-rose-300">{dayStats.busiestSlot.slot || 'N/A'}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">{dayStats.busiestSlot.count} classes live</span>
            </div>
          </div>
        </div>

        {/* Day Selector Tabs */}
        <div className="mt-6 pt-5 border-t border-white/10">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            <Calendar className="w-4 h-4 text-emerald-400 shrink-0 mr-1" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider mr-2 shrink-0">Select Day:</span>
            {DAYS_OF_WEEK.map((day) => {
              const isSelected = selectedDay === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-900/40 scale-105'
                      : 'bg-white/10 hover:bg-white/20 text-slate-200 border border-white/5'
                  }`}
                >
                  <span>{day}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter & Quick Jump Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E3DFD7] shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Time Segment Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              Time Range:
            </span>
            {TIME_SEGMENTS.map((seg) => {
              const Icon = seg.icon;
              const isSelected = timeSegment === seg.id;
              return (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => setTimeSegment(seg.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#1B365D] text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{seg.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Box & Quick Toggle */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tutor name or ID..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B365D] focus:bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setOnlyAvailable(!onlyAvailable)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors cursor-pointer ${
                onlyAvailable
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Available Only</span>
            </button>
          </div>
        </div>

        {/* Quick Slot Shortcuts for common requests like 3:00 AM, 4:00 AM, 5:00 PM */}
        <div className="pt-3 border-t border-slate-100 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-slate-500 font-medium shrink-0 flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-500" />
            Quick Jump to Slot:
          </span>
          {['03:00', '03:30', '04:00', '04:30', '05:00', '09:00', '14:00', '17:00', '19:00', '21:00'].map((time) => (
            <button
              key={time}
              type="button"
              onClick={() => handleQuickJump(time)}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 border border-slate-200 text-slate-700 text-[11px] font-medium transition-colors shrink-0 cursor-pointer"
            >
              {format12Hour(time)}
            </button>
          ))}
        </div>
      </div>

      {/* Slots Matrix Feed */}
      <div className="space-y-4">
        {slotData.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No time slots match the selected filter</p>
            <p className="text-xs text-slate-500 mt-1">Try switching time range or clearing the search box</p>
          </div>
        ) : (
          slotData.map((data) => {
            const isHighlighted = highlightSlot === data.slot;
            const isExpanded = expandedSlots[data.slot] !== false; // Default expanded
            const isAvailableOnlyMatch = !onlyAvailable || data.availableTutors.length > 0;

            if (!isAvailableOnlyMatch) return null;

            return (
              <div
                key={data.slot}
                id={`slot-card-${data.slot}`}
                className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden shadow-xs ${
                  isHighlighted
                    ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-50/20'
                    : 'border-[#E3DFD7] hover:border-slate-400'
                }`}
              >
                {/* Slot Header Bar */}
                <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-[#1B365D] text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-xs min-w-[70px]">
                      <Clock className="w-4 h-4 mr-1.5 text-emerald-300" />
                      {data.display12}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{selectedDay} @ {data.display12}</span>
                        <span className="text-[11px] font-medium text-slate-500">
                          {data.timeHints}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-500 font-medium">Slot ID: {data.slot}</span>
                        <span className="text-slate-300">•</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                          data.rawAvailableCount > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {data.rawAvailableCount} Free Tutors Available
                        </span>
                        {data.rawBusyCount > 0 && (
                          <span className="text-[11px] font-medium bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md">
                            {data.rawBusyCount} Busy
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Availability Bar & Action */}
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex flex-col items-end min-w-[120px]">
                      <div className="flex justify-between w-full text-[10px] font-medium text-slate-600 mb-1">
                        <span>Free Capacity</span>
                        <span className="font-bold text-emerald-700">{data.availabilityPct}%</span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            data.availabilityPct > 50
                              ? 'bg-emerald-500'
                              : data.availabilityPct > 20
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${data.availabilityPct}%` }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleExpand(data.slot)}
                      className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors cursor-pointer"
                      title={isExpanded ? 'Collapse Slot' : 'Expand Slot'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Collapsible Content */}
                {isExpanded && (
                  <div className="p-4 space-y-4">
                    {/* Section 1: Free / Available Tutors */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 uppercase tracking-wide">
                          <UserCheck className="w-4 h-4 text-emerald-600" />
                          Ready Tutors Available to Teach ({data.availableTutors.length})
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Click "Assign Class" to book this tutor at {data.display12}
                        </span>
                      </div>

                      {data.availableTutors.length === 0 ? (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 italic">
                          No available tutors in this slot matching criteria.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                          {data.availableTutors.map((tutor) => (
                            <div
                              key={tutor.id || tutor.tutorId}
                              className="p-3 bg-emerald-50/60 hover:bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col justify-between transition-all hover:shadow-xs group"
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                    <span className="text-xs font-bold text-slate-900 group-hover:text-emerald-900">
                                      {tutor.realName || tutor.tutorId}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-emerald-700 font-semibold ml-3.5 block">
                                    {tutor.tutorId}
                                  </span>
                                  {tutor.email && (
                                    <p className="text-[10px] text-slate-500 ml-3.5 truncate max-w-[150px]">
                                      {tutor.email}
                                    </p>
                                  )}
                                </div>
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium">
                                  FREE
                                </span>
                              </div>

                              <div className="pt-2 border-t border-emerald-100/80 flex items-center justify-between gap-1">
                                {onSelectTutor && (
                                  <button
                                    type="button"
                                    onClick={() => onSelectTutor(tutor)}
                                    className="text-[10px] text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                                  >
                                    View Profile
                                  </button>
                                )}
                                {onAddClass && (
                                  <button
                                    type="button"
                                    onClick={() => onAddClass(tutor.tutorId, selectedDay, data.slot)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-2xs ml-auto transition-transform active:scale-95 cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Assign Class</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Section 2: Occupied / Busy Tutors */}
                    {data.busyTutors.length > 0 && (
                      <div className="pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                            <UserX className="w-4 h-4 text-slate-500" />
                            Occupied Tutors &amp; Ongoing Classes ({data.busyTutors.length})
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                          {data.busyTutors.map(({ tutor, assignedClasses }) => (
                            <div
                              key={tutor.id || tutor.tutorId}
                              className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between opacity-90 hover:opacity-100 transition-opacity"
                            >
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-semibold text-slate-800 truncate">
                                    {tutor.realName || tutor.tutorId}
                                  </span>
                                  <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                                    BUSY
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono block mb-1">
                                  {tutor.tutorId}
                                </span>
                                {assignedClasses.length > 0 ? (
                                  <div className="space-y-1 mt-1.5">
                                    <span className="text-[10px] text-slate-500 font-medium block">
                                      Teaching Student:
                                    </span>
                                    {assignedClasses.map((cls) => {
                                      const stObj = students.find(s => s.studentId === cls.studentId);
                                      return (
                                        <div
                                          key={cls.id}
                                          onClick={() => stObj && onSelectStudent && onSelectStudent(stObj)}
                                          className={`p-1.5 bg-white border border-slate-200 rounded text-[10px] text-slate-700 flex items-center justify-between ${
                                            stObj && onSelectStudent ? 'cursor-pointer hover:border-slate-400' : ''
                                          }`}
                                        >
                                          <span className="font-medium truncate">{cls.studentName || cls.studentId}</span>
                                          <span className="text-[9px] text-slate-400 capitalize">{cls.status}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-slate-400 italic mt-1">Booked slot</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TutorSlotAvailabilityInspector;
