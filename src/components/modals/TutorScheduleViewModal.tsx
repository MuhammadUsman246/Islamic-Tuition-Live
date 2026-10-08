import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  BookOpen,
  CheckCircle2,
  Plus,
  Zap,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Video
} from 'lucide-react';
import { Tutor, Student, TimetableClass, DayOfWeek, PKT_TIME_SLOTS } from '../../types';
import { isSameTutor } from '../../services/dataService';

interface TutorScheduleViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tutor: Tutor | null;
  classes: TimetableClass[];
  students: Student[];
  onSelectSlotToBook?: (tutorId: string, day: DayOfWeek, slot: string) => void;
}

const DAYS: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

export const TutorScheduleViewModal: React.FC<TutorScheduleViewModalProps> = ({
  isOpen,
  onClose,
  tutor,
  classes = [],
  students = [],
  onSelectSlotToBook
}) => {
  const [selectedDayTab, setSelectedDayTab] = useState<DayOfWeek>('Monday');
  const [viewFilter, setViewFilter] = useState<'all' | '1am-8am' | 'booked' | 'available'>('1am-8am');

  if (!isOpen || !tutor) return null;

  const tutorClasses = classes.filter(c => isSameTutor(c.tutorId, tutor.tutorId) || isSameTutor(c.tutorId, tutor.id));

  // Determine slots to display based on viewFilter
  const timeSlots = viewFilter === '1am-8am'
    ? PKT_TIME_SLOTS.filter(s => {
        const hour = parseInt(s.split(':')[0], 10);
        return hour >= 1 && hour <= 8;
      })
    : PKT_TIME_SLOTS;

  // Calculate stats for this tutor
  const totalBooked = tutorClasses.filter(c => c.status !== 'Cancelled').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#EAE6DE] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-[#161F1A]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0F2444] via-[#16355F] to-[#0A1B33] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 font-bold text-lg">
              {tutor.tutorId?.replace(/\D/g, '') || 'T'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white">
                  {tutor.realName ? `${tutor.realName} (${tutor.tutorId})` : tutor.tutorId}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  {tutor.availabilityStatus || 'Available'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-2">
                <span>{tutor.email || 'Faculty Tutor'}</span>
                <span>•</span>
                <span className="text-emerald-400 font-semibold">{totalBooked} Weekly Classes Booked</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters & Day Tabs */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-[#EAE6DE] space-y-3 shrink-0">
          {/* Days Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            <Calendar className="w-4 h-4 text-[#1E5C3D] shrink-0 mr-1" />
            {DAYS.map(day => {
              const dayClassCount = tutorClasses.filter(c => {
                if (c.status === 'Cancelled') return false;
                const cDays = c.days && Array.isArray(c.days) ? c.days : [c.dayOfWeek];
                return cDays.some(d => d?.toLowerCase() === day.toLowerCase());
              }).length;

              const isSelected = selectedDayTab === day;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDayTab(day)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-[#1E5C3D] text-white shadow-xs'
                      : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span>{day}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isSelected ? 'bg-emerald-400/30 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {dayClassCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Time Segment Filter */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600">Filter Slots:</span>
              <button
                onClick={() => setViewFilter('1am-8am')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  viewFilter === '1am-8am'
                    ? 'bg-[#0F2444] text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                1:00 AM – 8:00 AM Shift
              </button>
              <button
                onClick={() => setViewFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  viewFilter === 'all'
                    ? 'bg-[#0F2444] text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                All 24 Hours
              </button>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-600" />
                Available / Free
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-amber-600" />
                Booked Class
              </span>
            </div>
          </div>
        </div>

        {/* Timetable Grid View */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
            <span>{selectedDayTab}'s Schedule Matrix for {tutor.tutorId}</span>
            <span className="text-slate-500 font-normal">Click any green "Free Slot" to quickly schedule a class</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {timeSlots.map(slot => {
              // Check if class exists for this tutor, day, and slot
              const bookedClass = tutorClasses.find(c => {
                if (c.status === 'Cancelled') return false;
                const cDays = c.days && Array.isArray(c.days) ? c.days : [c.dayOfWeek];
                const matchesDay = cDays.some(d => d?.toLowerCase() === selectedDayTab.toLowerCase());
                const slotNorm = slot.trim();
                const startNorm = (c.startTimePKT || c.time || c.startTime || '').trim();
                const hourMatch = slotNorm === startNorm ||
                  slotNorm === startNorm.padStart(5, '0') ||
                  startNorm.startsWith(slotNorm);
                return matchesDay && hourMatch;
              });

              const isOccupied = Boolean(bookedClass);

              if (viewFilter === 'booked' && !isOccupied) return null;
              if (viewFilter === 'available' && isOccupied) return null;

              return (
                <div
                  key={slot}
                  className={`p-3 rounded-xl border transition-all ${
                    isOccupied
                      ? 'bg-amber-50/80 border-amber-200'
                      : 'bg-emerald-50/60 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-white border text-xs font-mono font-bold text-slate-800 shadow-2xs">
                      {slot} PKT
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        isOccupied
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      {isOccupied ? 'BOOKED' : 'OPEN SLOT'}
                    </span>
                  </div>

                  {isOccupied && bookedClass ? (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-amber-950 truncate">
                        {bookedClass.studentName || bookedClass.studentId}
                      </p>
                      <p className="text-[10px] text-amber-800">
                        {bookedClass.courseType || 'Quran Class'} • {bookedClass.duration || 30} mins
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-emerald-700 font-medium">Slot Available</span>
                      {onSelectSlotToBook && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSlotToBook(tutor.tutorId, selectedDayTab, slot);
                            onClose();
                          }}
                          className="px-2.5 py-1 bg-[#1E5C3D] hover:bg-[#16432C] text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-transform active:scale-95 shadow-2xs"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Schedule Class</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-[#EAE6DE] flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Tutor ID: <strong className="text-slate-800">{tutor.tutorId}</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold cursor-pointer transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
