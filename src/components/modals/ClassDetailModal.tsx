import React from 'react';
import { X, Calendar, Clock, User, Globe, Edit2, Trash2, Video, Sparkles, CheckCircle2, Ban, BookOpen } from 'lucide-react';
import { TimetableClass, Student, Tutor, UserRole } from '../../types';
import { convertPKTToStudentTime } from '../../utils/timezone';

interface ClassDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  classItem: TimetableClass | null;
  student?: Student | null;
  tutor?: Tutor | null;
  onEdit?: (cls: TimetableClass) => void;
  onDelete?: (classId: string) => void;
  onCancel?: (classId: string, newStatus: TimetableClass['status']) => void;
  onLogLesson?: (studentId: string) => void;
  role: UserRole;
}

export const ClassDetailModal: React.FC<ClassDetailModalProps> = ({
  isOpen,
  onClose,
  classItem,
  student,
  tutor,
  onEdit,
  onDelete,
  onCancel,
  onLogLesson,
  role
}) => {
  if (!isOpen || !classItem) return null;

  const studentTz = student?.timezone || 'America/New_York';
  const converted = convertPKTToStudentTime(classItem.dayOfWeek, classItem.startTimePKT, studentTz);

  const isTrial = classItem.notes?.toLowerCase().includes('trial') || 
    (student && student.status === 'Trial');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-[#E3DFD7] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#2D8B5C] text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-[#E8A93E]" />
            <h3 className="font-bold text-sm">Class Session Details</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Student & Course Header */}
          <div className="flex items-start justify-between border-b border-[#EAE6DE] pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-base font-bold text-[#161F1A]">
                  {classItem.studentName}
                </h4>
                <span className="font-mono text-[11px] text-[#2D8B5C] font-semibold">
                  ({classItem.studentId})
                </span>
              </div>
              <p className="text-[11px] text-[#5A6B61] mt-0.5">
                {student?.courseType || 'Quran Reading & Tajweed'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                classItem.status === 'Completed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : classItem.status === 'Cancelled'
                  ? 'bg-red-100 text-red-800'
                  : classItem.status === 'Student on Leave'
                  ? 'bg-indigo-100 text-indigo-800'
                  : classItem.status === 'Student on Leave (Weekly)'
                  ? 'bg-amber-100 text-[#8C5D08] border border-[#E8A93E]/30'
                  : 'bg-[#2D8B5C]/15 text-[#1E5C3D]'
              }`}>
                {classItem.status}
              </span>
              {isTrial && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF9ED] text-[#8C5D08] border border-[#E8A93E]/40 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#E8A93E]" /> Trial Session
                </span>
              )}
            </div>
          </div>

          {/* Schedule Details Card - Strictly role-partitioned timezone privacy */}
          <div className={`grid ${role === 'admin' ? 'grid-cols-2' : 'grid-cols-1'} gap-3 bg-[#FAF9F7] p-3.5 rounded-xl border border-[#E3DFD7]`}>
            {/* Tutors, Supervisors, and Admin see Pakistan Operational Time (PKT) */}
            {(role === 'admin' || role === 'tutor' || role === 'supervisor') && (
              <div>
                <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">
                  Academy Time (PKT)
                </span>
                <p className="font-bold text-sm text-[#161F1A] mt-0.5 font-mono">
                  {classItem.startTimePKT} PKT
                </p>
                <p className="text-[11px] text-[#5A6B61]">{classItem.dayOfWeek}</p>
              </div>
            )}

            {/* Students, Parents, and Admin see Student Local Time */}
            {(role === 'admin' || role === 'student' || role === 'parent') && (
              <div>
                <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">
                  {role === 'admin' ? 'Student Local Time' : 'Your Scheduled Time'}
                </span>
                <p className="font-bold text-sm text-[#1E5C3D] mt-0.5 font-mono">
                  {converted.localTime}
                </p>
                <p className="text-[11px] text-[#5A6B61]">
                  {converted.localDay} ({converted.shortTz})
                </p>
              </div>
            )}
          </div>

          {/* Tutor & Duration Info */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-[#F0ECE1]">
              <span className="text-[#5A6B61] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#2D8B5C]" /> Assigned Faculty:
              </span>
              <span className="font-semibold text-[#161F1A]">
                {classItem.tutorId} {tutor?.realName ? `(${tutor.realName})` : ''}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-[#F0ECE1]">
              <span className="text-[#5A6B61] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#2D8B5C]" /> Session Duration:
              </span>
              <span className="font-semibold text-[#161F1A]">
                {classItem.durationMinutes} Minutes (Standard 30m)
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-[#F0ECE1]">
              <span className="text-[#5A6B61] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2D8B5C]" /> Schedule Type:
              </span>
              <span className="font-semibold text-[#161F1A]">
                {classItem.isRecurring ? 'Weekly Recurring' : 'Single Session'} {classItem.isWeekend ? '(Weekend)' : '(Weekday)'}
              </span>
            </div>

            {tutor?.zoomLink && (
              <div className="flex items-center justify-between py-1 border-b border-[#F0ECE1]">
                <span className="text-[#5A6B61] flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-[#2D8B5C]" /> Classroom Link:
                </span>
                <a
                  href={tutor.zoomLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#2D8B5C] hover:underline truncate max-w-[200px]"
                >
                  {tutor.zoomLink}
                </a>
              </div>
            )}

            {classItem.notes && (
              <div className="pt-1">
                <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">
                  Session Notes
                </span>
                <p className="text-xs text-[#161F1A] mt-0.5 bg-[#FAF9F7] p-2 rounded-md border border-[#EAE6DE]">
                  {classItem.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions Footer */}
        <div className="px-5 py-3 bg-[#FAF9F7] border-t border-[#E3DFD7] flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-[#5A6B61] hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {/* Cancel/Restore Slot Actions */}
            {role === 'admin' && (
              classItem.status === 'Cancelled' ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (onCancel) {
                        await onCancel(classItem.id, 'Scheduled');
                      } else if (onEdit) {
                        await onEdit({ ...classItem, status: 'Scheduled' });
                      }
                      onClose();
                    } catch (err) {
                      console.error("Failed to restore slot:", err);
                      onClose();
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                  title="Uncancel and restore this class slot"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Restore Slot</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (onCancel) {
                        await onCancel(classItem.id, 'Cancelled');
                      } else if (onEdit) {
                        await onEdit({ ...classItem, status: 'Cancelled' });
                      }
                      onClose();
                    } catch (err) {
                      console.error("Failed to cancel slot:", err);
                      onClose();
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                  title="Mark this class session as cancelled"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Cancel Slot</span>
                </button>
              )
            )}

            {/* Student Leave Actions (Visible to Admin only - removed from supervisor) */}
            {role === 'admin' && (
              classItem.status === 'Student on Leave' || classItem.status === 'Student on Leave (Weekly)' ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (onCancel) {
                        await onCancel(classItem.id, 'Scheduled');
                      } else if (onEdit) {
                        await onEdit({ ...classItem, status: 'Scheduled' });
                      }
                      onClose();
                    } catch (err) {
                      console.error("Failed to end leave:", err);
                      onClose();
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                  title="End student leave and schedule class"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>End Leave / Active</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        if (onCancel) {
                          await onCancel(classItem.id, 'Student on Leave');
                        } else if (onEdit) {
                          await onEdit({ ...classItem, status: 'Student on Leave' });
                        }
                        onClose();
                      } catch (err) {
                        console.error("Failed to mark student on leave:", err);
                        onClose();
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                    title="Mark student on leave for today"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Leave (Today)</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        if (onCancel) {
                          await onCancel(classItem.id, 'Student on Leave (Weekly)');
                        } else if (onEdit) {
                          await onEdit({ ...classItem, status: 'Student on Leave (Weekly)' });
                        }
                        onClose();
                      } catch (err) {
                        console.error("Failed to mark student on weekly leave:", err);
                        onClose();
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-[#8C5D08] bg-[#FFF9ED] hover:bg-[#FFF3DB] border border-[#E8A93E]/40 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                    title="Mark student on leave for the whole week"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Leave (Weekly)</span>
                  </button>
                </>
              )
            )}

            {/* Direct Save Lesson Report Button */}
            {onLogLesson && (role === 'tutor' || role === 'admin' || role === 'supervisor') && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogLesson(classItem.studentId);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#2D8B5C] hover:bg-[#1E5C3D] rounded-lg transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer"
                title="Log daily lesson progress directly for this student"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Save Lesson Report</span>
              </button>
            )}

            {role === 'admin' && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(classItem.id);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                title="Remove class slot and send to Recovery Trash"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Slot</span>
              </button>
            )}

            {role === 'admin' && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(classItem);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#2D8B5C] hover:bg-[#1E5C3D] rounded-lg transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Class</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
