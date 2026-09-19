import { Lesson, StudentFee } from '../types';

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
    'Tutor Name / ID',
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
    l.tutorId || '—',
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

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  const cleanTitle = filenamePrefix.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `${cleanTitle}_report_${Date.now()}.csv`;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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

