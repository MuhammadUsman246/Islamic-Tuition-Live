import { jsPDF } from 'jspdf';
import { StudentFee, Lesson, Student } from '../types';

/**
 * Generates an official IslamicTuition Fee Invoice / Receipt PDF
 */
export function generateFeeInvoicePDF(fee: StudentFee): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [45, 139, 92]; // #2D8B5C
  const darkColor = [27, 46, 36]; // #1B2E24
  const goldColor = [232, 169, 62]; // #E8A93E
  const grayColor = [120, 130, 125];

  // Header background accent
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 35, 'F');

  // Academy Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('ISLAMICTUITION', 20, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Online Quran Academy Management Portal', 20, 27);

  // Invoice / Receipt badge
  const isPaid = fee.status === 'Paid';
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const title = isPaid ? 'OFFICIAL RECEIPT' : 'FEE INVOICE';
  doc.text(title, 190, 22, { align: 'right' });

  // Metadata block
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE DETAILS', 20, 50);

  doc.setFont('helvetica', 'normal');
  doc.text(`Invoice Number: ${fee.invoiceNumber || 'INV-' + fee.id.slice(0, 8).toUpperCase()}`, 20, 57);
  doc.text(`Billing Period: ${fee.billingPeriod}`, 20, 63);
  doc.text(`Issue Date: ${fee.createdAt ? fee.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)}`, 20, 69);
  doc.text(`Due Date: ${fee.dueDate}`, 20, 75);

  // Student details block
  doc.setFont('helvetica', 'bold');
  doc.text('BILLED TO', 130, 50);

  doc.setFont('helvetica', 'normal');
  if (fee.isFamilyInvoice) {
    doc.text(`Family: ${fee.familyGroupName || fee.studentName}`, 130, 57);
    doc.text(`Parent / Guardian: ${fee.parentName || 'Family Head'}`, 130, 63);
    doc.text(`Type: Consolidated Family Statement`, 130, 69);
  } else {
    doc.text(`Student: ${fee.studentName} (${fee.studentId})`, 130, 57);
    doc.text(`Parent / Guardian: ${fee.parentName || 'N/A'}`, 130, 63);
    doc.text(`Academy: IslamicTuition Portal`, 130, 69);
  }

  // Status Stamp Box
  doc.setDrawColor(isPaid ? primaryColor[0] : goldColor[0], isPaid ? primaryColor[1] : goldColor[1], isPaid ? primaryColor[2] : goldColor[2]);
  doc.setLineWidth(0.8);
  doc.setFillColor(248, 249, 248);
  doc.rect(130, 75, 60, 14, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(isPaid ? primaryColor[0] : goldColor[0], isPaid ? primaryColor[1] : goldColor[1], isPaid ? primaryColor[2] : goldColor[2]);
  doc.text(`STATUS: ${fee.status.toUpperCase()}`, 160, 84, { align: 'center' });

  // Item Table
  const startY = 105;
  doc.setFillColor(240, 244, 241);
  doc.rect(20, startY, 170, 10, 'F');

  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DESCRIPTION', 25, startY + 7);
  doc.text('PERIOD', 110, startY + 7);
  doc.text('AMOUNT', 185, startY + 7, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  let currentY = startY + 20;

  if (fee.isFamilyInvoice && fee.siblingBreakdown && fee.siblingBreakdown.length > 0) {
    fee.siblingBreakdown.forEach((sib) => {
      doc.text(`Tuition: ${sib.studentName} (${sib.studentId})`, 25, currentY);
      doc.text(`${fee.billingPeriod}`, 110, currentY);
      doc.text(`${fee.currency} ${sib.amount.toFixed(2)}`, 185, currentY, { align: 'right' });
      currentY += 8;
    });
  } else {
    doc.text(
      fee.isFamilyInvoice
        ? `Consolidated Family Tuition (${fee.familyGroupName || 'Siblings'})`
        : `Online Quran & Islamic Tuition Classes`,
      25,
      currentY
    );
    doc.text(`${fee.billingPeriod}`, 110, currentY);
    doc.text(`${fee.currency} ${fee.amount.toFixed(2)}`, 185, currentY, { align: 'right' });
    currentY += 8;
  }

  // Discount row if any
  if (fee.discount && fee.discount > 0) {
    currentY += 2;
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text(
      fee.isFamilyInvoice ? `Sibling Package Discount` : `Scholarship / Family Discount`,
      25,
      currentY
    );
    doc.text(`Applied`, 110, currentY);
    doc.text(`-${fee.currency} ${fee.discount.toFixed(2)}`, 185, currentY, { align: 'right' });
    currentY += 8;
  }

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(20, currentY, 190, currentY);

  // Total
  currentY += 8;
  const netAmount = Math.max(0, fee.amount - (fee.discount || 0));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('TOTAL AMOUNT:', 110, currentY);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`${fee.currency} ${netAmount.toFixed(2)}`, 185, currentY, { align: 'right' });

  // Payment note
  currentY += 25;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  if (isPaid && fee.paymentDate) {
    doc.text(`Payment received on ${fee.paymentDate}. Thank you for your continued trust in IslamicTuition.`, 20, currentY);
  } else {
    doc.text(`Please submit tuition payment on or before the due date (${fee.dueDate}) to avoid schedule interruption.`, 20, currentY);
  }

  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('IslamicTuition Academy Portal • Support: info@islamictuition.us • Phone: +1 (718) 618-4848 • Official Record', 105, 280, { align: 'center' });

  doc.save(`IslamicTuition_Invoice_${fee.invoiceNumber || fee.studentId}_${fee.billingPeriod.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Generates an official Student Lesson & Progress Report PDF
 */
export function generateStudentReportPDF(
  student: Student,
  lessons: Lesson[],
  dateRangeLabel: string
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [45, 139, 92];
  const darkColor = [27, 46, 36];
  const goldColor = [232, 169, 62];

  // Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('ISLAMICTUITION ACADEMY', 20, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('STUDENT PROGRESS & LESSON REPORT', 20, 25);

  doc.setFontSize(11);
  doc.text(dateRangeLabel, 190, 22, { align: 'right' });

  // Student Profile Card
  let y = 44;
  doc.setFillColor(247, 249, 248);
  doc.setDrawColor(210, 225, 215);
  doc.rect(20, y, 170, 28, 'FD');

  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Student Name: ${student.name}`, 25, y + 8);
  doc.text(`Student ID: ${student.studentId}`, 25, y + 16);
  doc.text(`Course: ${student.courseType}`, 25, y + 23);

  doc.text(`Assigned Tutor: ${student.assignedTutorId}`, 110, y + 8);
  doc.text(`Status: ${student.status} (${student.trialSessionsCompleted}/${student.trialSessionsTotal} Trials)`, 110, y + 16);
  doc.text(`Country/TZ: ${student.country} (${student.timezone})`, 110, y + 23);

  y += 38;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`Lesson History (${lessons.length} sessions recorded)`, 20, y);

  y += 6;
  if (lessons.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120, 120, 120);
    doc.text('No completed lesson reports found for this period.', 20, y + 10);
  } else {
    // Render lessons list with page overflow protection
    lessons.forEach((lesson) => {
      // Ensure the lesson card (height: 24mm) + padding leaves enough room on the A4 page (297mm height)
      if (y > 245) {
        doc.addPage();
        y = 20;

        // Header for follow-up pages
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 0, 210, 12, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`IslamicTuition Progress Report • ${student.name} (${student.studentId})`, 20, 8);
        y += 10;
      }

      // Box for lesson
      doc.setFillColor(252, 252, 252);
      doc.setDrawColor(230, 230, 230);
      doc.rect(20, y, 170, 24, 'FD');

      // Left column: Date & Type
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.text(`${lesson.date} • ${lesson.lessonType}`, 24, y + 6);

      // Performance or Status badge
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      if (lesson.attendanceStatus === 'Absent') {
        doc.setTextColor(220, 38, 38);
        doc.text('Status: Absent', 185, y + 6, { align: 'right' });
      } else if (lesson.attendanceStatus === 'Late') {
        doc.setTextColor(goldColor[0], goldColor[1], goldColor[2]);
        doc.text(`Status: Late (${lesson.lateMinutes || 10}m)`, 185, y + 6, { align: 'right' });
      } else {
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('Status: Present', 185, y + 6, { align: 'right' });
      }

      // Structured info
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(50, 50, 50);

      let detailStr = '';
      if (lesson.attendanceStatus === 'Absent') {
        detailStr = `Absence Note: ${lesson.absentReason || 'No lesson conducted due to student absence.'}`;
      } else if (lesson.quranDetails) {
        const pageTxt = (lesson.quranDetails.mushafPage || lesson.mushafPage) ? ` [Page ${lesson.quranDetails.mushafPage || lesson.mushafPage}]` : '';
        detailStr = `Quran: Juz ${lesson.quranDetails.juz}, Surah ${lesson.quranDetails.surahName} (Ayahs ${lesson.quranDetails.ayahStart}-${lesson.quranDetails.ayahEnd})${pageTxt}`;
      } else if (lesson.qaidaDetails) {
        detailStr = `Qaida: Page ${lesson.qaidaDetails.pageNumber}, ${lesson.qaidaDetails.lessonSection} (${lesson.qaidaDetails.exerciseLine})`;
      } else if (lesson.salahDetails) {
        detailStr = `Salah: ${lesson.salahDetails.prayerName} - ${lesson.salahDetails.stepSection}`;
      } else {
        detailStr = `Covered: ${lesson.lessonCovered || 'N/A'}`;
      }

      doc.text(detailStr, 24, y + 12);

      if (lesson.attendanceStatus !== 'Absent') {
        const parts: string[] = [];
        if (lesson.memorization) parts.push(`Memorization: ${lesson.memorization}`);
        if (lesson.adaabManners) parts.push(`Adaab: ${lesson.adaabManners}`);
        if (lesson.revision) parts.push(`Revision: ${lesson.revision}`);
        if (lesson.teacherRemarks) parts.push(`Notes: ${lesson.teacherRemarks}`);

        const subText = parts.length > 0 ? parts.join(' | ') : `Covered: ${lesson.lessonCovered}`;
        doc.setFontSize(7.5);
        doc.setTextColor(80, 80, 80);
        doc.text(subText, 24, y + 18);
      }

      y += 27;
    });
  }

  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Certified by IslamicTuition Academic Management • Verified Record', 105, 285, { align: 'center' });

  doc.save(`IslamicTuition_ProgressReport_${student.studentId}_${student.name.replace(/\s+/g, '_')}.pdf`);
}

// Aliases and single-lesson PDF generator
export const generateInvoicePDF = generateFeeInvoicePDF;

export function generateLessonReportPDF(lesson: Lesson): void {
  const fallbackStudent: Student = {
    id: lesson.studentId,
    studentId: lesson.studentId,
    name: lesson.studentName,
    email: 'student@islamictuition.com',
    phone: 'N/A',
    parentName: 'Family Guardian',
    parentEmail: 'parent@islamictuition.com',
    parentPhone: 'N/A',
    assignedTutorId: lesson.tutorId,
    status: 'Active',
    courseType: lesson.lessonType,
    country: 'International',
    timezone: 'UTC',
    trialSessionsCompleted: 5,
    trialSessionsTotal: 5,
    trialStatus: 'Converted',
    createdAt: lesson.date
  };

  generateStudentReportPDF(fallbackStudent, [lesson], lesson.month || lesson.date);
}

export interface WeeklyReportData {
  student: Student;
  tutorName?: string;
  startDate: string;
  endDate: string;
  attendanceRate: number; // 0-100
  totalScheduled: number;
  totalAttended: number;
  totalLate: number;
  totalAbsent: number;
  portionRecited: string;
  tajweedObservations: string;
  memorizationProgress: string;
  tutorFeedback: string;
  behaviorScore?: number; // 1-5
  recommendedPractice: string;
}

/**
 * Generates an official Weekly Progress Report Summary Card PDF for parents
 */
export function generateWeeklyProgressReportPDF(data: WeeklyReportData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [45, 139, 92]; // #2D8B5C
  const darkColor = [27, 46, 36]; // #1B2E24
  const goldColor = [232, 169, 62]; // #E8A93E
  const lightBg = [248, 250, 248];

  // Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 36, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('ISLAMICTUITION ACADEMY', 20, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('WEEKLY ACADEMIC PROGRESS & PERFORMANCE REPORT', 20, 26);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`WEEK: ${data.startDate} — ${data.endDate}`, 190, 22, { align: 'right' });

  // Student Profile Card
  let y = 46;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(210, 225, 215);
  doc.rect(20, y, 170, 30, 'FD');

  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Student: ${data.student.name}`, 25, y + 8);
  doc.text(`Student ID: ${data.student.studentId}`, 25, y + 16);
  doc.text(`Course: ${data.student.courseType}`, 25, y + 24);

  doc.text(`Parent: ${data.student.parentName || 'Guardian'}`, 110, y + 8);
  doc.text(`Assigned Faculty: ${data.tutorName || data.student.assignedTutorId}`, 110, y + 16);
  doc.text(`Country / Timezone: ${data.student.country} (${data.student.timezone})`, 110, y + 24);

  // Section 1: Weekly Attendance & Punctuality Breakdown
  y += 38;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('1. WEEKLY ATTENDANCE & PUNCTUALITY', 20, y);

  y += 6;
  // Metric boxes
  const boxWidth = 39;
  const metrics = [
    { label: 'Attendance Rate', val: `${Math.round(data.attendanceRate)}%`, color: data.attendanceRate >= 80 ? primaryColor : goldColor },
    { label: 'Classes Attended', val: `${data.totalAttended} / ${data.totalScheduled}`, color: primaryColor },
    { label: 'Late Sessions', val: `${data.totalLate}`, color: goldColor },
    { label: 'Absences', val: `${data.totalAbsent}`, color: data.totalAbsent > 0 ? [220, 38, 38] : primaryColor }
  ];

  metrics.forEach((m, idx) => {
    const bx = 20 + idx * (boxWidth + 4.5);
    doc.setFillColor(252, 252, 252);
    doc.setDrawColor(225, 230, 225);
    doc.rect(bx, y, boxWidth, 20, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 110, 105);
    doc.text(m.label, bx + boxWidth / 2, y + 6, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(m.color[0], m.color[1], m.color[2]);
    doc.text(m.val, bx + boxWidth / 2, y + 15, { align: 'center' });
  });

  // Section 2: Syllabus & Portions Recited
  y += 28;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('2. PORTION RECITED & LESSON COVERAGE', 20, y);

  y += 6;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(220, 230, 222);
  doc.rect(20, y, 170, 26, 'FD');

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('Covered Portions & Lessons:', 25, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(50, 60, 55);
  const splitPortions = doc.splitTextToSize(data.portionRecited || 'Regular daily syllabus lessons completed according to study schedule.', 160);
  doc.text(splitPortions, 25, y + 14);

  // Section 3: Tajweed & Memorization Progress
  y += 34;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('3. TAJWEED & MEMORIZATION EVALUATION', 20, y);

  y += 6;
  // Split into two side-by-side cards
  const halfWidth = 82.5;
  
  // Left card: Tajweed
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(225, 230, 225);
  doc.rect(20, y, halfWidth, 34, 'FD');
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('Tajweed & Pronunciation:', 25, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(70, 80, 75);
  const tajweedLines = doc.splitTextToSize(data.tajweedObservations || 'Good adherence to Makharij principles and articulation rules.', halfWidth - 10);
  doc.text(tajweedLines, 25, y + 14);

  // Right card: Memorization
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(225, 230, 225);
  doc.rect(107.5, y, halfWidth, 34, 'FD');
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('Memorization & Duas / Adaab:', 112.5, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(70, 80, 75);
  const memLines = doc.splitTextToSize(data.memorizationProgress || 'Daily revision and prescribed prayers practiced with confidence.', halfWidth - 10);
  doc.text(memLines, 112.5, y + 14);

  // Section 4: Faculty Feedback & Recommendations
  y += 42;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('4. TUTOR FEEDBACK & NEXT WEEK GOALS', 20, y);

  y += 6;
  doc.setFillColor(255, 253, 247);
  doc.setDrawColor(235, 215, 180);
  doc.rect(20, y, 170, 36, 'FD');

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(140, 93, 8);
  doc.text('Tutor Observations & Parental Recommendations:', 25, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  const feedbackLines = doc.splitTextToSize(
    `"${data.tutorFeedback || 'The student displayed great enthusiasm and focus during lessons this week.'}"\n\nRecommended Daily Home Practice: ${data.recommendedPractice || '15-20 minutes daily recitation revision before Maghrib.'}`,
    160
  );
  doc.text(feedbackLines, 25, y + 14);

  // Footer & Official Seal
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('OFFICIAL WEEKLY EVALUATION REPORT • ISLAMICTUITION ACADEMY', 105, 280, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 130, 125);
  doc.text('Generated with IslamicTuition Academic Management System • www.islamictuition.com', 105, 285, { align: 'center' });

  doc.save(`Weekly_Progress_Report_${data.student.studentId}_${data.startDate}_to_${data.endDate}.pdf`);
}

/**
 * Builds a ready-to-send WhatsApp summary message for parents
 */
export function getWeeklyProgressReportWhatsAppMessage(data: WeeklyReportData): string {
  const brand = 'IslamicTuition Academy';
  const attendanceEmoji = data.attendanceRate >= 90 ? '🌟 Excellent' : data.attendanceRate >= 75 ? '✅ Good' : '⚠️ Needs Focus';

  return `📊 *Weekly Progress Report — ${brand}*

Assalamu Alaikum Dear Parent (${data.student.parentName || 'Guardian'}),

Here is the weekly Quran & Islamic Studies performance summary for *${data.student.name}* (*${data.student.studentId}*):

📅 *Period:* ${data.startDate} to ${data.endDate}
📖 *Course:* ${data.student.courseType}
👳 *Tutor:* ${data.tutorName || data.student.assignedTutorId}

--------------------------------------
📈 *Attendance & Punctuality:*
• Attendance Rate: *${Math.round(data.attendanceRate)}%* (${attendanceEmoji})
• Attended: *${data.totalAttended} of ${data.totalScheduled} classes*
• Late: ${data.totalLate} | Absences: ${data.totalAbsent}

📖 *Portion Recited This Week:*
${data.portionRecited || 'Completed scheduled syllabus lessons with steady progress.'}

🔍 *Tajweed & Pronunciation:*
${data.tajweedObservations || 'Good adherence to rules and clear articulation.'}

💡 *Tutor Feedback:*
"${data.tutorFeedback || 'MashaAllah, great dedication shown this week!'}"

🎯 *Recommended Home Revision:*
${data.recommendedPractice || '15-20 minutes daily recitation before class.'}
--------------------------------------

JazakAllah Khair for your continuous support in your child's Quranic journey!

Warm regards,
*Academic Management Team*
${brand}`;
}
