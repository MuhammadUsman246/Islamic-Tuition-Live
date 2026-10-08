import React, { useState, useMemo } from 'react';
import {
  Clock,
  Users,
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  Plus,
  Sparkles,
  UserCheck,
  UserX,
  Layers,
  Moon,
  Sunrise,
  Zap,
  LayoutList,
  LayoutGrid,
  ShieldCheck,
  Info,
  ChevronDown,
  ChevronUp,
  Globe,
  Check,
  Eye
} from 'lucide-react';
import { Tutor, Student, DayOfWeek, TimetableClass } from '../../types';
import { isSameTutor } from '../../services/dataService';
import { TutorScheduleViewModal } from '../modals/TutorScheduleViewModal';

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

// Operational time slots from 1:00 AM to 8:00 AM in 30-minute intervals (15 slots)
const OPERATIONAL_1AM_8AM_SLOTS: string[] = [
  '01:00',
  '01:30',
  '02:00',
  '02:30',
  '03:00',
  '03:30',
  '04:00',
  '04:30',
  '05:00',
  '05:30',
  '06:00',
  '06:30',
  '07:00',
  '07:30',
  '08:00'
];

const TIME_SEGMENTS = [
  { id: 'all', label: 'All 1 AM – 8 AM', icon: Clock, slots: OPERATIONAL_1AM_8AM_SLOTS },
  { id: 'early', label: 'Early Shift (1 AM – 4 AM)', icon: Moon, slots: ['01:00', '01:30', '02:00', '02:30', '03:00', '03:30', '04:00'] },
  { id: 'morning', label: 'Morning Shift (4:30 AM – 8 AM)', icon: Sunrise, slots: ['04:30', '05:00', '05:30', '06:00', '06:30', '07:00', '07:30', '08:00'] },
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
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [viewLayout, setViewLayout] = useState<'inline' | 'matrix'>('inline');
  const [highlightSlot, setHighlightSlot] = useState<string>('');
  const [showOccupiedMap, setShowOccupiedMap] = useState<Record<string, boolean>>({});
  const [inspectingTutorForSchedule, setInspectingTutorForSchedule] = useState<Tutor | null>(null);

  // Format 24h time to 12h readable string (e.g. 03:00 -> 3:00 AM)
  const format12Hour = (time24: string) => {
    const [hStr, mStr] = time24.split(':');
    const h = parseInt(hStr, 10);
    const m = mStr || '00';
    if (isNaN(h)) return time24;
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayH}:${m} ${period}`;
  };

  // Convert PKT time to UK (GMT/BST approx -4h) & US EST (-9h) reference hints
  const getConvertedTimes = (pktTime: string) => {
    const [hStr, mStr] = pktTime.split(':');
    const h = parseInt(hStr, 10);
    if (isNaN(h)) return { uk: '', est: '' };
    const m = mStr || '00';
    
    // PKT is UTC+5. UK is UTC+0/+1 (-4h in BST). US EST is UTC-5 (-9h).
    const ukH = (h - 4 + 24) % 24;
    const estH = (h - 9 + 24) % 24;
    
    const ukStr = `${ukH === 0 ? 12 : ukH > 12 ? ukH - 12 : ukH}:${m} ${ukH >= 12 ? 'PM' : 'AM'} UK`;
    const estStr = `${estH === 0 ? 12 : estH > 12 ? estH - 12 : estH}:${m} ${estH >= 12 ? 'PM' : 'AM'} US/EST`;
    
    return { uk: ukStr, est: estStr };
  };

  // 100% IN-MEMORY COMPUTATION: Zero Firestore Reads or Writes
  const slotData = useMemo(() => {
    const activeTutors = tutors.filter(t => t.status !== 'Inactive');

    // Filter slots based on selected 1 AM - 8 AM segment
    const segment = TIME_SEGMENTS.find(s => s.id === timeSegment) || TIME_SEGMENTS[0];
    const slotsToProcess = segment.slots;

    const computed = slotsToProcess.map((slot) => {
      // Find all classes booked at this day and slot (normalized day & time check)
      const matchingClasses = classes.filter(c => {
        if (c.status === 'Cancelled') return false;
        const cDays = c.days && Array.isArray(c.days) ? c.days : [c.dayOfWeek || (c as any).day];
        const matchesDay = cDays.some(d => d?.toLowerCase() === selectedDay.toLowerCase());
        if (!matchesDay) return false;

        const slotNorm = slot.trim();
        const startNorm = (c.startTimePKT || c.time || c.startTime || '').trim();
        return (
          slotNorm === startNorm ||
          slotNorm === startNorm.padStart(5, '0') ||
          startNorm.startsWith(slotNorm)
        );
      });

      // Split tutors into Available and Busy using isSameTutor for 100% ID variant precision
      const isTutorBusy = (t: Tutor) => {
        return matchingClasses.some(c => isSameTutor(c.tutorId, t.tutorId) || isSameTutor(c.tutorId, t.id));
      };

      const availableTutors = activeTutors.filter(t => !isTutorBusy(t));
      const busyTutors = activeTutors
        .filter(t => isTutorBusy(t))
        .map(t => ({
          tutor: t,
          assignedClasses: matchingClasses.filter(c => isSameTutor(c.tutorId, t.tutorId) || isSameTutor(c.tutorId, t.id))
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
        b.assignedClasses.some(c => 
          c.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
          c.studentId?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );

      const totalFaculty = activeTutors.length;
      const freeCount = availableTutors.length;
      const busyCount = busyTutors.length;
      const availabilityPct = totalFaculty > 0 ? Math.round((freeCount / totalFaculty) * 100) : 0;
      const timeConversions = getConvertedTimes(slot);

      return {
        slot,
        display12: format12Hour(slot),
        timeUk: timeConversions.uk,
        timeEst: timeConversions.est,
        availableTutors: filteredAvailable,
        busyTutors: filteredBusy,
        rawAvailableCount: freeCount,
        rawBusyCount: busyCount,
        totalFaculty,
        availabilityPct
      };
    });

    if (onlyAvailable) {
      return computed.filter(d => d.availableTutors.length > 0);
    }
    return computed;
  }, [tutors, classes, selectedDay, timeSegment, searchQuery, onlyAvailable]);

  // Overall metrics for 1 AM to 8 AM
  const dayStats = useMemo(() => {
    let totalSlotsWithFreeTutors = 0;
    let totalOpenSeats = 0;
    let mostAvailableSlot = { slot: '', count: -1 };

    slotData.forEach(d => {
      if (d.rawAvailableCount > 0) {
        totalSlotsWithFreeTutors++;
        totalOpenSeats += d.rawAvailableCount;
      }
      if (d.rawAvailableCount > mostAvailableSlot.count) {
        mostAvailableSlot = { slot: d.display12, count: d.rawAvailableCount };
      }
    });

    return {
      totalSlotsWithFreeTutors,
      totalOpenSeats,
      mostAvailableSlot
    };
  }, [slotData]);

  const toggleShowOccupied = (slot: string) => {
    setShowOccupiedMap(prev => ({ ...prev, [slot]: !prev[slot] }));
  };

  const handleQuickJump = (slotTime: string) => {
    setHighlightSlot(slotTime);
    const element = document.getElementById(`slot-view-item-${slotTime}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => setHighlightSlot(''), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Control Deck */}
      <div className="bg-gradient-to-br from-[#0F2444] via-[#16355F] to-[#0A1B33] text-white p-5 rounded-2xl shadow-md border border-[#234B7F]/60">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold border border-emerald-400/30 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5" />
                <span>1:00 AM – 8:00 AM PKT Shift</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-sky-500/20 text-sky-200 text-[11px] font-semibold border border-sky-400/30" title="Calculated 100% in-memory with zero extra database read/write cost">
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>0 Read / Write Usage (Zero Database Load)</span>
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
              Available Tutor Slots Inspector
            </h2>
            <p className="text-xs text-slate-200 mt-1 max-w-2xl leading-relaxed">
              Real-time schedule calibrated from <strong>1:00 AM to 8:00 AM PKT</strong>. All available tutors are listed inline with direct 1-click class assignment.
            </p>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex items-center gap-2.5 self-start lg:self-center">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl px-3.5 py-2 text-center min-w-[85px]">
              <span className="text-[10px] text-slate-300 uppercase font-bold tracking-wider block">Open Slots</span>
              <span className="text-xl font-extrabold text-emerald-400">{dayStats.totalSlotsWithFreeTutors}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl px-3.5 py-2 text-center min-w-[95px]">
              <span className="text-[10px] text-slate-300 uppercase font-bold tracking-wider block">Free Tutors</span>
              <span className="text-xl font-extrabold text-amber-300">{dayStats.totalOpenSeats}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl px-3.5 py-2 text-center min-w-[95px]">
              <span className="text-[10px] text-slate-300 uppercase font-bold tracking-wider block">Peak Open</span>
              <span className="text-xs font-bold text-sky-300 mt-1 block truncate max-w-[100px]">{dayStats.mostAvailableSlot.slot || 'None'}</span>
            </div>
          </div>
        </div>

        {/* Day Selector Tabs */}
        <div className="mt-4 pt-3.5 border-t border-white/10">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            <Calendar className="w-4 h-4 text-emerald-400 shrink-0 mr-1.5" />
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mr-1 shrink-0">Day:</span>
            {DAYS_OF_WEEK.map((day) => {
              const isSelected = selectedDay === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 flex items-center gap-1 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-950/40 scale-102 border border-emerald-400'
                      : 'bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10'
                  }`}
                >
                  <span>{day}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modern Filter & View Command Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Shift Segment Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-700 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              Shift:
            </span>
            {TIME_SEGMENTS.map((seg) => {
              const Icon = seg.icon;
              const isSelected = timeSegment === seg.id;
              return (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => setTimeSegment(seg.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#15355F] text-white shadow-xs font-bold'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{seg.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search, Only-Available Toggle & Layout */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tutor name or ID..."
                className="w-full pl-8 pr-6 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15355F] focus:bg-white transition-all font-medium text-slate-900"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Only Available Toggle */}
            <button
              type="button"
              onClick={() => setOnlyAvailable(!onlyAvailable)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                onlyAvailable
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
              title={onlyAvailable ? "Showing only open slots (Click to reveal all slots)" : "Showing all slots (Click to isolate available slots)"}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{onlyAvailable ? 'Available Only' : 'Show All Slots'}</span>
            </button>

            {/* Layout Toggle (Inline vs Cards) */}
            <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-200 flex items-center">
              <button
                type="button"
                onClick={() => setViewLayout('inline')}
                className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewLayout === 'inline'
                    ? 'bg-white text-[#15355F] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Inline Horizontal Stream"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>Inline</span>
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('matrix')}
                className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewLayout === 'matrix'
                    ? 'bg-white text-[#15355F] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Cards Grid"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Slot Shortcuts 1:00 AM to 8:00 AM */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-xs">
          <span className="text-slate-500 font-bold shrink-0 flex items-center gap-1 text-[11px]">
            <Zap className="w-3 h-3 text-amber-500" />
            Jump To Hour:
          </span>
          {OPERATIONAL_1AM_8AM_SLOTS.map((time) => (
            <button
              key={time}
              type="button"
              onClick={() => handleQuickJump(time)}
              className="px-2.5 py-1 rounded-md bg-slate-50 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300 border border-slate-200 text-slate-700 text-[11px] font-semibold transition-all shrink-0 cursor-pointer active:scale-95"
            >
              {format12Hour(time)}
            </button>
          ))}
        </div>
      </div>

      {/* 1. MAIN INLINE STREAM VIEW (Ultra-Optimized & Scannable) */}
      {viewLayout === 'inline' && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-xs divide-y divide-slate-100">
          {slotData.length === 0 ? (
            <div className="text-center py-12 px-4 bg-slate-50/50">
              <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800">No open time slots found between 1:00 AM and 8:00 AM on {selectedDay}</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                All tutors are booked for this period or match filters were too restrictive.
              </p>
              <button
                type="button"
                onClick={() => {
                  setOnlyAvailable(false);
                  setSearchQuery('');
                  setTimeSegment('all');
                }}
                className="mt-3 px-3.5 py-1.5 bg-[#15355F] text-white rounded-lg text-xs font-bold hover:bg-[#0F2444] cursor-pointer"
              >
                Reset Filters &amp; View All 1 AM – 8 AM Slots
              </button>
            </div>
          ) : (
            slotData.map((data) => {
              const isHighlighted = highlightSlot === data.slot;
              const isOccupiedShown = showOccupiedMap[data.slot] || false;

              return (
                <div
                  key={data.slot}
                  id={`slot-view-item-${data.slot}`}
                  className={`p-3.5 transition-all duration-200 flex flex-col gap-2.5 ${
                    isHighlighted
                      ? 'bg-amber-50/90 ring-2 ring-amber-400'
                      : 'hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Left Column: Time & International Indicators */}
                    <div className="flex items-center gap-3 shrink-0 min-w-[260px]">
                      <div className="px-3 py-1.5 bg-gradient-to-b from-[#16355F] to-[#0F2444] text-white rounded-xl text-center shadow-xs font-bold text-xs min-w-[80px]">
                        <span>{data.display12}</span>
                        <span className="block text-[9px] text-emerald-300 font-semibold tracking-wide">PKT</span>
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-extrabold text-slate-900">{selectedDay}</span>
                          <span className="text-[10px] text-slate-400 font-mono font-medium">({data.slot})</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono">{data.timeUk}</span>
                          <span>•</span>
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono">{data.timeEst}</span>
                        </div>
                      </div>

                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                        {data.availableTutors.length} Free
                      </span>
                    </div>

                    {/* Middle Column: Inline Available Tutor Badges (1-Click Assignment & Timetable Inspector) */}
                    <div className="flex-1 flex flex-wrap items-center gap-1.5">
                      {data.availableTutors.map((tutor) => (
                        <div
                          key={tutor.id || tutor.tutorId}
                          className="inline-flex items-center gap-1 p-1 bg-emerald-50/90 border border-emerald-300 rounded-lg shadow-2xs"
                        >
                          <button
                            type="button"
                            onClick={() => onAddClass && onAddClass(tutor.tutorId, selectedDay, data.slot)}
                            className="group inline-flex items-center gap-1.5 px-2 py-0.5 text-emerald-950 font-bold text-xs hover:bg-emerald-600 hover:text-white rounded-md transition-all cursor-pointer"
                            title={`Click to book class with ${tutor.realName || tutor.tutorId} at ${data.display12}`}
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-500 group-hover:bg-white shrink-0 shadow-2xs" />
                            <span>{tutor.tutorId}</span>
                            {tutor.realName && (
                              <span className="text-[10px] text-emerald-700 group-hover:text-emerald-100 font-normal">
                                ({tutor.realName.split(' ')[0]})
                              </span>
                            )}
                            <Plus className="w-3.5 h-3.5 text-emerald-600 group-hover:text-white opacity-70 group-hover:opacity-100 ml-0.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setInspectingTutorForSchedule(tutor)}
                            className="p-1 hover:bg-emerald-200 text-emerald-800 rounded-md transition-colors cursor-pointer"
                            title={`View ${tutor.tutorId}'s full weekly timetable schedule`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Right Column: Actions */}
                    <div className="shrink-0 flex items-center gap-2 self-start md:self-center">
                      {data.busyTutors.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleShowOccupied(data.slot)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                            isOccupiedShown
                              ? 'bg-slate-200 text-slate-800 border-slate-300'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                          title="Show which tutors are occupied at this slot"
                        >
                          <Users className="w-3 h-3 text-slate-500" />
                          <span>{data.busyTutors.length} Occupied</span>
                          {isOccupiedShown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}

                      {onAddClass && data.availableTutors.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onAddClass(data.availableTutors[0].tutorId, selectedDay, data.slot)}
                          className="px-3 py-1.5 bg-[#059669] hover:bg-[#047857] text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-transform active:scale-95 cursor-pointer whitespace-nowrap"
                          title="Quick book first available tutor"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Book Slot</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Optional Occupied Breakdown (Tutor -> Student) */}
                  {isOccupiedShown && data.busyTutors.length > 0 && (
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <UserX className="w-3 h-3 text-rose-500" />
                        Busy Faculty:
                      </span>
                      {data.busyTutors.map(({ tutor, assignedClasses }) => (
                        <div
                          key={tutor.id || tutor.tutorId}
                          className="px-2 py-1 bg-white border border-slate-200 rounded-md flex items-center gap-1.5 text-[11px]"
                        >
                          <span className="font-bold text-slate-800">{tutor.tutorId}</span>
                          <span className="text-slate-300">→</span>
                          <span className="text-slate-600 truncate max-w-[120px]">
                            {assignedClasses[0]?.studentName || assignedClasses[0]?.studentId || 'Booked'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 2. CARD BASE VIEW (Matrix Grid — Robust & Enhanced) */}
      {viewLayout === 'matrix' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {slotData.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
              <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No open time slots match the selected criteria (1 AM – 8 AM)</p>
            </div>
          ) : (
            slotData.map((data) => (
              <div
                key={data.slot}
                id={`slot-view-item-${data.slot}`}
                className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs space-y-3 hover:border-slate-400 transition-all flex flex-col justify-between"
              >
                {/* Card Top: Time, Day, Badge, and Capacity Bar */}
                <div className="space-y-2 pb-2.5 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="px-2.5 py-1 bg-[#15355F] text-white rounded-lg text-xs font-extrabold shadow-2xs">
                        {data.display12}
                      </div>
                      <div>
                        <span className="text-xs font-extrabold text-slate-900 block leading-tight">{selectedDay}</span>
                        <span className="text-[10px] text-slate-400 font-mono font-medium">Slot {data.slot}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                      {data.availableTutors.length} Free
                    </span>
                  </div>

                  {/* International Time Indicators */}
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold bg-slate-50 p-1.5 rounded-md">
                    <span>🇬🇧 {data.timeUk}</span>
                    <span>🇺🇸 {data.timeEst}</span>
                  </div>

                  {/* Availability Percentage Bar */}
                  <div className="space-y-1 pt-0.5">
                    <div className="flex justify-between text-[10px] font-bold text-slate-600">
                      <span>Available Capacity</span>
                      <span className="text-emerald-700 font-extrabold">{data.availabilityPct}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                        style={{ width: `${data.availabilityPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Body: Available Tutors as Booking Chips */}
                <div className="space-y-2 flex-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-900">
                    <span className="flex items-center gap-1 uppercase tracking-wide text-[10px] text-slate-600">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Ready to Teach:
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Click to assign</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {data.availableTutors.map((tutor) => (
                      <button
                        key={tutor.id || tutor.tutorId}
                        type="button"
                        onClick={() => onAddClass && onAddClass(tutor.tutorId, selectedDay, data.slot)}
                        className="group px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-950 border border-emerald-300 hover:border-emerald-600 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 group-hover:bg-white shrink-0" />
                        <span>{tutor.tutorId}</span>
                        {tutor.realName && (
                          <span className="text-[10px] text-emerald-700 group-hover:text-emerald-100 font-normal">
                            ({tutor.realName.split(' ')[0]})
                          </span>
                        )}
                        <Plus className="w-3 h-3 text-emerald-600 group-hover:text-white ml-0.5 opacity-60 group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Card Footer: Quick Action & Occupied Snapshot */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {data.rawBusyCount > 0 ? `${data.rawBusyCount} Busy` : 'All Available'}
                  </span>

                  {onAddClass && data.availableTutors.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onAddClass(data.availableTutors[0].tutorId, selectedDay, data.slot)}
                      className="px-3 py-1 bg-[#059669] hover:bg-[#047857] text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-transform active:scale-95 cursor-pointer ml-auto"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Book Slot</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
      {/* Tutor Schedule Matrix Modal Inspector */}
      <TutorScheduleViewModal
        isOpen={Boolean(inspectingTutorForSchedule)}
        onClose={() => setInspectingTutorForSchedule(null)}
        tutor={inspectingTutorForSchedule}
        classes={classes}
        students={students}
        onSelectSlotToBook={(tutorId, day, slot) => {
          if (onAddClass) {
            onAddClass(tutorId, day, slot);
          }
        }}
      />
    </div>
  );
};

export default TutorSlotAvailabilityInspector;
