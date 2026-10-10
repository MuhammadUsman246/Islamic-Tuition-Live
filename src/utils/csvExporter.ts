import { Lesson, StudentFee, TutorAttendanceRecord } from '../types';
import { getTutorDisplayId } from './tutorPrivacy';

/**
 * Utility to export clean, professional CSV lesson reports
 * formatted as a direct, high-compatibility table for Excel, Google Sheets, or Apple Numbers.
 */
export const exportLessonsToCSV = (
  filenamePrefix: string,
  lessons: Lesson[],
  _timeRangeLabel?: string,
  _extraMetadata?: { studentName?: string; tutorName?: string }
) => {
  const headers = [
    'Lesson Date',
    'Topic / Course',
    'Student Name',
    'Student ID',
    'Tutor ID',
    'Attendance Status',
    'Portion Covered',
    'Mushaf Page No.',
    'Memorization',
    'Adaab & Manners',
    'Revision (Sabaq/Dhor)'
  ];

  const rows = lessons.map(l => [
    l.date || '—',
    l.lessonType || '—',
    l.studentName || '—',
    l.studentId || '—',
    getTutorDisplayId(l.tutorId) || '—',
    l.attendanceStatus || 'Present',
    l.lessonCovered || '—',
    l.mushafPage || l.quranDetails?.mushafPage || '—',
    l.memorization || '—',
    l.adaabManners || '—',
    l.revision || 'None'
  ]);

  const sanitizeCell = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvRows = [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(row => row.map(sanitizeCell).join(','))
  ];

  const csvString = "\uFEFF" + csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const cleanTitle = filenamePrefix.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `${cleanTitle}_report_${Date.now()}.csv`;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Export tuition fees ledger to CSV
 */
export const exportFeesToCSV = (filenamePrefix: string, fees: StudentFee[]) => {
  const headers = [
    'Invoice #',
    'Student Name',
    'Student ID',
    'Parent Name',
    'Billing Period',
    'Amount',
    'Discount',
    'Net Payable',
    'Currency',
    'Due Date',
    'Status',
    'Payment Date',
    'Payment Method',
    'Reference / Notes'
  ];

  const sanitizeCell = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = fees.map(f => [
    f.invoiceNumber || '—',
    f.studentName || '—',
    f.studentId || '—',
    f.parentName || '—',
    f.billingPeriod || '—',
    f.amount ?? 0,
    f.discount ?? 0,
    Math.max(0, (f.amount || 0) - (f.discount || 0)),
    f.currency || 'USD',
    f.dueDate || '—',
    f.status || 'Pending',
    f.paymentDate || '—',
    f.paymentMethod || '—',
    f.paymentReference || f.notes || '—'
  ]);

  const csvRows = [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(row => row.map(sanitizeCell).join(','))
  ];

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  const cleanTitle = filenamePrefix.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `${cleanTitle}_fees_${Date.now()}.csv`;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Export complete academy database snapshot as a structured JSON file
 */
export const exportFullAcademyBackupJSON = (snapshot: {
  exportedAt: string;
  academyName: string;
  data: Record<string, any>;
}) => {
  const jsonStr = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  link.download = `academy_full_backup_${dateStr}_${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export daily tutor attendance shift logs as a clean CSV for payroll and records
 */
export const exportTutorAttendanceToCSV = (
  filenamePrefix: string,
  records: TutorAttendanceRecord[],
  periodLabel?: string
) => {
  const headers = [
    'Date',
    'Tutor ID',
    'Faculty Name',
    'Status',
    'Shift Hours (PKT)',
    'Time In',
    'Time Out',
    'Late Duration (Mins)',
    'Marked By',
    'Notes'
  ];

  const sanitizeCell = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = records.map(r => [
    r.date || '—',
    r.tutorId || '—',
    r.tutorName || '—',
    r.status || 'Present',
    `${r.shiftStartTimePKT || '12:30 AM'} - ${r.shiftEndTimePKT || '07:00 AM'}`,
    r.timeIn || r.loginTime || '—',
    r.timeOut || '—',
    r.lateDurationMinutes ?? 0,
    r.markedBy || 'System',
    r.notes || '—'
  ]);

  const csvRows = [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(row => row.map(sanitizeCell).join(','))
  ];

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  const cleanTitle = filenamePrefix.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `${cleanTitle}_tutor_attendance_${Date.now()}.csv`;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Export monthly faculty punctuality & late audit summary for payroll
 */
export const exportTutorMonthlyAuditToCSV = (
  filenamePrefix: string,
  summaryData: Array<{
    tutorId: string;
    tutorName: string;
    scheduledDays: number;
    presentDays: number;
    lateDays: number;
    totalLateMinutes: number;
    absentDays: number;
    leaveDays: number;
    punctualityRate: number;
    lateDatesBreakdown: string;
  }>
) => {
  const headers = [
    'Tutor ID',
    'Faculty Name',
    'Scheduled Days',
    'On Time Days',
    'Late Days',
    'Total Late Minutes',
    'Absent Days',
    'Leave Days',
    'Punctuality Rate (%)',
    'Late Dates & Minutes Breakdown'
  ];

  const sanitizeCell = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = summaryData.map(s => [
    s.tutorId,
    s.tutorName,
    s.scheduledDays,
    s.presentDays,
    s.lateDays,
    s.totalLateMinutes,
    s.absentDays,
    s.leaveDays,
    `${s.punctualityRate}%`,
    s.lateDatesBreakdown || 'None'
  ]);

  const csvRows = [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(row => row.map(sanitizeCell).join(','))
  ];

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  const cleanTitle = filenamePrefix.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `${cleanTitle}_monthly_audit_${Date.now()}.csv`;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

