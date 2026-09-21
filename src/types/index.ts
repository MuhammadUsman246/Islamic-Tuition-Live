export type UserRole = 'admin' | 'supervisor' | 'tutor' | 'student' | 'parent';
export type UserAccountStatus = 'active' | 'pending_approval' | 'inactive' | 'suspended';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserAccountStatus;
  tutorId?: string; // e.g. "Tutor 1"
  studentId?: string; // e.g. "STU-001"
  linkedStudentIds?: string[]; // For parents: ["STU-001", "STU-002"]
  phone?: string;
  country?: string;
  timezone?: string;
  courseType?: CourseType;
  parentName?: string;
  parentEmail?: string;
  avatarUrl?: string; // Ultra-optimized WebP avatar (< 25 KB)
  preferredName?: string; // Nickname or Kunya
  bio?: string; // Personal bio / about me
  favoriteSurah?: string; // e.g. "Surah Ar-Rahman", "Surah Al-Mulk"
  quranGoal?: string; // e.g. "Complete Juz 30 with Tajweed by Ramadan"
  hobbies?: string; // e.g. "Islamic Calligraphy, Arabic, Football"
  dailyGoalMinutes?: number; // Daily Quran practice goal in minutes (e.g. 20)
  themePreference?: 'emerald' | 'gold' | 'midnight' | 'sage';
  approvedBy?: string;
  approvedAt?: string;
  lastLoginAt?: string;
  lastActiveAt?: string;
  lastLoginIp?: string;
  deviceInfo?: string;
  sessionStatus?: 'online' | 'idle' | 'offline';
  customClaims?: {
    role: UserRole;
    permissions: string[];
    assignedAt?: string;
  };
  createdAt: string;
}

export interface AcademyUserSession {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  tutorId?: string;
  studentId?: string;
  lastActiveTimestamp: string;
  loginTimestamp: string;
  ipAddress?: string;
  userAgent?: string;
  deviceType?: 'Desktop' | 'Mobile' | 'Tablet';
  browser?: string;
  operatingSystem?: string;
  isOnline: boolean;
  status: 'active' | 'idle' | 'terminated';
  location?: string;
}

export interface Tutor {
  id: string; // document id
  tutorId: string; // Operational permanent identifier: "Tutor 1", "Tutor 2", etc.
  realName: string; // Stored separately, visible to Admin
  email: string;
  phone: string;
  zoomLink: string; // Permanent Tutor Zoom link managed by Admin
  status: 'Active' | 'On Leave' | 'Inactive';
  availabilityStatus?: 'Available' | 'Busy';
  hourlyRatePKR?: number;
  monthlySalaryPKR?: number;
  assignedStudentIds: string[];
  notes?: string;
  createdAt: string;
}

export type StudentStatus = 'Trial' | 'Confirmed' | 'Active' | 'Pending' | 'Not Taking' | 'Inactive';
export type TrialStatus = 
  | 'Day 1' 
  | 'Follow-up' 
  | 'Interested' 
  | 'Pending Call' 
  | 'Converted' 
  | 'In Progress' 
  | 'Decision Pending' 
  | 'Not Taking' 
  | 'None';

export type CourseType = 
  | 'Noorani Qaida'
  | 'Quran Reading / Nazra'
  | 'Hifz'
  | 'Tajweed'
  | 'Duas'
  | 'Ahadith'
  | 'Salah / Daily Prayers'
  | 'Islamic Studies';

export type AllowedCurrency = 'USD' | 'CAD' | 'GBP' | 'PKR';

export interface Student {
  id: string; // document id
  studentId: string; // e.g. "STU-001"
  name: string;
  email: string;
  phone: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  parentId?: string;
  assignedTutorId?: string;
  familyGroupId?: string; // e.g. "FAMILY-001" for sibling grouping
  familyGroupName?: string; // e.g. "Ahmed Family"
  status: StudentStatus;
  courseType: CourseType;
  country: string;
  timezone: string; // e.g. "America/New_York", "Europe/London", "Asia/Karachi"
  monthlyFee?: number;
  feeCurrency?: AllowedCurrency;
  trialStartDate?: string;
  trialSessionsCompleted: number;
  trialSessionsTotal: number; // default: 5
  trialStatus: TrialStatus;
  referralSource?: 'Existing Student' | 'Existing Parent' | 'Social Media' | 'Google / Search' | 'WhatsApp / Word of Mouth' | 'Website' | 'Other' | 'None';
  referredByName?: string;
  referredByStudentId?: string;
  referralRewardAmount?: number;
  referralStatus?: ReferralStatus;
  notes?: string;
  privateAdminNotes?: string;
  isOnLeave?: boolean;
  leaveStartDate?: string; // YYYY-MM-DD
  leaveEndDate?: string;   // YYYY-MM-DD
  leaveReason?: string;    // Vacation, Exams, Illness, Family, etc.
  leaveType?: 'Specific Days' | 'Full Month' | 'Custom Range' | 'Indefinite';
  createdAt: string;
}

/**
 * Allow-list representation of student data for Tutors.
 * STRICTLY eliminates phone, email, parent contact, fees, private notes, country, and timezone.
 * Tutors operate strictly in Pakistan Time (PKT) without access to student geographic/local timezone data.
 */
export interface TutorStudentView {
  studentId: string;
  name: string;
  status: StudentStatus;
  assignedTutorId: string;
  courseType: CourseType;
  trialSessionsCompleted: number;
  trialSessionsTotal: number;
  trialStatus: TrialStatus;
  isOnLeave?: boolean;
  leaveStartDate?: string;
  leaveEndDate?: string;
  leaveReason?: string;
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export type ClassDuration = 30 | 45 | 60;

// Strict operational time slots from PKT 1:00 AM to 7:00 AM in 30-minute intervals
export const PKT_TIME_SLOTS = [
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
  '06:30'
] as const;

export type PktTimeSlot = typeof PKT_TIME_SLOTS[number];

export interface TimetableClass {
  id: string;
  tutorId: string; // Operational Tutor ID (e.g. "Tutor 1")
  studentId: string;
  studentName: string;
  dayOfWeek: DayOfWeek;
  startTimePKT: string; // Format: "HH:mm" in Asia/Karachi (e.g. "05:00")
  durationMinutes: ClassDuration;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'Make-up' | 'Student on Leave' | 'Student on Leave (Weekly)';
  isRecurring: boolean;
  isWeekend: boolean;
  notes?: string;
}

export type LessonPerformance = 'Excellent' | 'Good' | 'Satisfactory' | 'Needs Improvement';

export interface QuranLessonDetails {
  juz: number;
  surahNumber: number;
  surahName: string;
  ayahStart: number;
  ayahEnd: number;
  mushafPage?: string | number; // Optional physical Mushaf page number (e.g. 52, 417)
}

export interface QaidaLessonDetails {
  qaidaName?: string; // e.g. "Norani Qaida"
  pageNumber: number;
  lessonName?: string; // e.g. "Lesson 1: THE ALPHABETS"
  lessonSection: string; // e.g. "Main", "Exercise", "Test"
  exerciseLine: string; // e.g. "Lines 1-6"
}

export interface SalahLessonDetails {
  prayerName: string;
  stepSection: string;
  notes?: string;
}

export interface LessonScreenshot {
  url: string; // WebP compressed Base64 data URL
  name: string;
  size: number;
  uploadedAt: string;
  expired?: boolean;
  uploadedByRole?: 'tutor' | 'admin' | 'supervisor';
  notes?: string;
}

export interface Lesson {
  id: string;
  studentId: string;
  studentName: string;
  tutorId: string;
  date: string; // YYYY-MM-DD
  month: string; // Format: "Month YYYY", e.g. "September 2026"
  lessonType: CourseType;
  attendanceStatus?: AttendanceStatus;
  lateMinutes?: number;
  absentReason?: string;
  mushafPage?: string | number;
  memorization?: string; // e.g. "4th Kalma", "5th Kalma", "Salah / Rakat", "Dua Qunoot"
  adaabManners?: string; // e.g. "Manners of drinking", "Manners of entering", "Steps of wudu"
  quranDetails?: QuranLessonDetails;
  qaidaDetails?: QaidaLessonDetails;
  salahDetails?: SalahLessonDetails;
  lessonCovered: string;
  revision?: string;
  mistakes?: string;
  weakAreas?: string;
  homework?: string;
  teacherRemarks?: string;
  nextLesson?: string;
  performance?: LessonPerformance;
  screenshots?: LessonScreenshot[];
  // Safety & Security Audit (Supervisor & Admin)
  safetyStatus?: 'Safe' | 'Flagged' | 'Audited' | 'Pending Review';
  safetyNotes?: string;
  auditedBy?: string;
  auditedAt?: string;
  // Material / Screenshot Quality Review
  materialQualityStatus?: '100% Verified' | 'Needs Correction' | 'Replaced by Admin' | 'Replaced by Supervisor';
  materialNotes?: string;
  createdAt: string;
}

export type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'Cancelled' | 'Make-up';

export interface AttendanceRecord {
  id: string;
  classId: string;
  studentId: string;
  studentName: string;
  tutorId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  markedBy: string;
  markedAt: string;
  notes?: string;
}

export type TutorAttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused' | 'On Time' | 'Leave';

export interface TutorAttendanceRecord {
  id: string;
  tutorId: string;
  tutorName: string;
  date: string; // YYYY-MM-DD
  month?: string; // e.g. "September 2026"
  loginTime?: string; // HH:mm
  timeIn?: string; // HH:mm
  timeOut?: string; // HH:mm
  status: TutorAttendanceStatus;
  lateDurationMinutes?: number;
  notes?: string;
  markedBy?: string;
  markedAt?: string;
}

export type Currency = 'USD' | 'CAD' | 'GBP' | 'EUR' | 'AUD' | 'PKR';
export type FeeStatus = 'Paid' | 'Pending' | 'Overdue' | 'Waived' | 'Payment Submitted';

export interface SiblingFeeItem {
  studentId: string;
  studentName: string;
  amount: number;
}

export interface StudentFee {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  parentName: string;
  parentEmail?: string;
  parentPhone?: string;
  amount: number;
  currency: Currency;
  billingPeriod: string; // e.g. "September 2026"
  dueDate: string; // YYYY-MM-DD
  paymentDate?: string;
  paymentMethod?: string;
  paymentSubmittedAt?: string;
  paymentSubmittedBy?: string; // 'Parent' | 'Student'
  paymentReference?: string;
  paymentProofNote?: string;
  receiptImage?: string; // Client-side compressed WebP base64 image data URL
  receiptOriginalFileName?: string;
  receiptCompressedSizeKB?: number;
  receiptReductionPercent?: number;
  paymentRemittanceService?: string; // 'Zelle' | 'Western Union' | 'Ria' | 'MoneyGram' | 'Remitly' | 'WorldRemit' | 'Wise' | etc.
  paymentMtcnNumber?: string; // MTCN / Transfer PIN / Transaction Tracking number for cash pick-up
  paymentSenderName?: string; // Full sender name used at cash pick-up/remittance
  adminConfirmedBy?: string;
  adminConfirmedAt?: string;
  status: FeeStatus;
  discount?: number;
  isFamilyInvoice?: boolean;
  familyGroupId?: string;
  familyGroupName?: string;
  studentIds?: string[]; // Multiple sibling student IDs covered by this combined fee
  siblingBreakdown?: SiblingFeeItem[];
  notes?: string;
  createdAt: string;
}

export interface TutorSalary {
  id: string;
  tutorId: string;
  tutorName: string;
  monthlySalary: number;
  currency: 'PKR';
  month: string; // e.g. "September 2026"
  status: 'Paid' | 'Unpaid';
  paymentDate?: string;
  deduction?: number;
  notes?: string;
  createdAt: string;
}

export type ReferralStatus = 'Pending' | 'Approved' | 'Paid/Applied' | 'Eligible' | 'Given' | 'Paid' | 'Applied';

export interface Referral {
  id: string;
  referrerName: string;
  referredStudentId: string;
  referredStudentName: string;
  date: string;
  rewardAmount: number; // default: 30
  currency: 'USD';
  status: ReferralStatus;
  notes?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  targetRoles: UserRole[]; // e.g. ['parent'] or ['tutor', 'supervisor']
  targetRole?: 'all' | 'tutors' | 'students' | 'parents' | 'supervisors'; // fallback for backward-compatibility
  pinned: boolean;
  authorName: string;
  link?: string;
  startDate?: string; // Optional start date for time-based visibility (YYYY-MM-DD)
  endDate?: string;   // Optional end date for automatic expiration (YYYY-MM-DD)
  createdAt: string;
}

export interface ChatAttachment {
  type: 'audio' | 'image' | 'file';
  name: string;
  url: string;
  size?: number;
  duration?: number; // duration in seconds for voice notes
  format?: string; // e.g. 'webp', 'audio/webm', 'pdf'
  mediaExpired?: boolean;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  recipientId?: string;
  recipientRole?: UserRole;
  text: string;
  timestamp: string;
  read: boolean;
  delivered?: boolean;
  status?: 'sent' | 'delivered' | 'seen';
  readAt?: string;
  deliveredAt?: string;
  seenBy?: string[]; // IDs of users who saw the message (WhatsApp group seen receipts & 1-1 double-blue ticks)
  deliveredTo?: string[]; // IDs of users the message has been delivered to
  seenTimestamps?: Record<string, string>; // userId -> ISO timestamp
  deliveredTimestamps?: Record<string, string>; // userId -> ISO timestamp
  listenedBy?: string[]; // IDs of users who listened to voice notes (WhatsApp blue microphone status)
  attachment?: ChatAttachment;
  isEdited?: boolean;
  editedAt?: string;
  deletedForEveryone?: boolean;
  deletedBy?: string;
}

export interface ChatThread {
  id: string;
  participantIds: string[];
  participantNames: string[];
  participantRoles: UserRole[];
  lastMessageText: string;
  lastMessageTimestamp: string;
  unreadCountFor: Record<string, number>;
}

export interface AcademySettings {
  academyName: string;
  operationalTimezone: string; // "Asia/Karachi"
  contactEmail: string;
  contactPhone: string;
  logoUrl?: string;
  defaultZoomLink?: string;
  trialSessionsCount?: number;
  siblingDiscountPercent?: number;
}

export type TrashItemType = 'class' | 'student' | 'tutor' | 'user' | 'referral' | 'announcement' | 'tutor_attendance';

export interface TrashRecord {
  id: string; // Unique trash id in deleted_records collection
  originalId: string;
  itemType: TrashItemType;
  title: string;
  subtitle?: string;
  data: any;
  deletedAt: string; // ISO string
  deletedBy?: string;
}

export interface DeleteConfirmTarget {
  id: string;
  itemType: TrashItemType;
  title: string;
  description?: string;
  details?: Record<string, string | number | undefined>;
  onConfirm: () => Promise<void> | void;
}

export type CallType = 'audio' | 'video';
export type CallStatus = 'calling' | 'ringing' | 'connected' | 'ended' | 'rejected' | 'busy' | 'missed';

export interface ActiveCallSession {
  id: string; // document id in calls collection
  callerId: string;
  callerName: string;
  callerRole: UserRole;
  receiverId: string;
  receiverName: string;
  receiverRole: UserRole;
  threadId: string;
  type: CallType;
  status: CallStatus;
  startedAt: string; // ISO string
  connectedAt?: string; // ISO string
  endedAt?: string; // ISO string
  durationSeconds?: number;
  offer?: { type: 'offer' | 'answer' | 'pranswer' | 'rollback'; sdp: string };
  answer?: { type: 'offer' | 'answer' | 'pranswer' | 'rollback'; sdp: string };
  isScreenSharing?: boolean;
  screenSharingUserId?: string;
  screenSharingUserName?: string;
}

export type RiskTier = 'Critical Risk' | 'Moderate Risk' | 'Stable' | 'Excelling';

export interface AIStudentInsight {
  studentId: string;
  studentName: string;
  riskTier: RiskTier;
  riskScore: number; // 0 to 100
  retentionProbability: number; // 0 to 100%
  attendanceHealth: 'Excellent' | 'Good' | 'Fair' | 'Inconsistent' | 'Critical' | 'At-Risk';
  academicVelocity: 'Fast Track' | 'Steady' | 'Active' | 'Slow' | 'Stalled' | 'Declining';
  summary: string;
  rootCauseFactors: string[];
  recommendedInterventions: string[];
  suggestedParentMessage: string;
  predictedImpact: string;
  analyzedAt?: string;
}

export interface StudentInterventionLog {
  id: string;
  studentId: string;
  studentName: string;
  date: string;
  riskTierAtTime: RiskTier;
  actionTaken: string;
  channel: 'WhatsApp' | 'Phone Call' | 'In-Person/Zoom' | 'Email' | 'Syllabus Adjustment';
  notes?: string;
  executedBy: string;
  status: 'Initiated' | 'In Progress' | 'Resolved' | 'Follow-up Needed';
  outcomeFeedback?: string;
}

