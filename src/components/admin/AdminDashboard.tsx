import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Calendar,
  BookOpen,
  DollarSign,
  Briefcase,
  Sparkles,
  Plus,
  FileText,
  CheckCircle,
  Clock,
  Video,
  Download,
  Search,
  Filter,
  Key,
  Shield,
  Lock,
  Eye,
  EyeOff,
  Check,
  X,
  UserPlus,
  Trash2,
  AlertTriangle,
  AlertCircle,
  RotateCcw,
  RotateCw,
  MessageSquare,
  PhoneCall,
  Layers,
  ArrowRight,
  ArrowLeft,
  FolderOpen,
  Folder,
  Send,
  Copy,
  ExternalLink,
  ChevronRight,
  Receipt,
  FileImage,
  FileSpreadsheet,
  Palmtree,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import {
  Student,
  Tutor,
  TimetableClass,
  Lesson,
  StudentFee,
  TutorSalary,
  Referral,
  Announcement,
  AttendanceRecord,
  TutorAttendanceRecord,
  DayOfWeek,
  UserProfile,
  DeleteConfirmTarget,
  CourseType,
  StudentStatus
} from '../../types';
import { TimetableGrid } from '../common/TimetableGrid';
import { LessonModal } from '../modals/LessonModal';
import { ClassModal } from '../modals/ClassModal';
import { StudentModal } from '../modals/StudentModal';
import { BulkImportModal } from '../modals/BulkImportModal';
import { TutorModal } from '../modals/TutorModal';
import { FeeModal } from '../modals/FeeModal';
import { FamilyGroupModal } from '../modals/FamilyGroupModal';
import { TrialSmsModal } from '../modals/TrialSmsModal';
import { useAuth } from '../../context/AuthContext';
import { SalaryModal } from '../modals/SalaryModal';
import { ReferralModal } from '../modals/ReferralModal';
import { TutorAttendanceModal } from '../modals/TutorAttendanceModal';
import { CreateUserModal } from '../modals/CreateUserModal';
import { StrictDeleteModal } from '../modals/StrictDeleteModal';
import { LessonMaterialEditModal } from '../modals/LessonMaterialEditModal';
import { LessonEditModal } from '../modals/LessonEditModal';
import { UndoToast, UndoToastItem } from '../common/UndoToast';
import { TrashRecoveryManager } from './TrashRecoveryManager';
import { FeeReceiptModal } from '../modals/FeeReceiptModal';
import { WeeklyProgressReportModal } from '../modals/WeeklyProgressReportModal';
import { MultiDayClassDeleteModal } from '../modals/MultiDayClassDeleteModal';
import { StudentLeaveModal } from '../modals/StudentLeaveModal';
import { ShiftTutorModal } from '../modals/ShiftTutorModal';
import { StudentFolderModal } from '../modals/StudentFolderModal';
import { AcademySecurityTab } from './AcademySecurityTab';
import { ReferralRewardsDashboard } from './ReferralRewardsDashboard';
import { INITIAL_TUTOR_USER_PROFILES } from '../../data/tutorsData';
import { generateInvoicePDF, generateLessonReportPDF } from '../../utils/pdfGenerator';
import { exportLessonsToCSV, exportFeesToCSV, exportFullAcademyBackupJSON } from '../../utils/csvExporter';
import { getCurrencySymbol, formatFeeAmount, ALLOWED_CURRENCIES } from '../../utils/currency';
import { getTimezoneShortCode, getCurrentTeachingDay, convertPKTToStudentTime } from '../../utils/timezone';
import {
  addClass,
  updateClass,
  deleteClass,
  addStudent,
  updateStudent,
  deleteStudent,
  addTutor,
  updateTutor,
  deleteTutor,
  addLesson,
  updateLesson,
  deleteLesson,
  addFee,
  updateFee,
  deleteFee,
  addSalary,
  updateSalary,
  addReferral,
  updateReferral,
  deleteReferral,
  addAnnouncement,
  deleteAnnouncement,
  addAttendanceRecord,
  deleteAttendanceRecord,
  addTutorAttendanceRecord,
  updateTutorAttendanceRecord,
  deleteTutorAttendanceRecord,
  resetUserPassword,
  getSystemUsers,
  getPendingUsers,
  subscribeToPendingUsers,
  approveUserAccount,
  rejectUserAccount,
  deleteSystemUser,
  restoreTrashRecord,
  getAcademySettings,
  updateAcademySettings,
  subscribeToAcademySettings,
  shiftStudentTutor,
  setStudentLeave,
  deleteClassesBatch
} from '../../services/dataService';
import { clearAllAcademyData } from '../../services/seedData';

interface AdminDashboardProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  students: Student[];
  tutors: Tutor[];
  classes: TimetableClass[];
  lessons: Lesson[];
  fees: StudentFee[];
  salaries: TutorSalary[];
  referrals: Referral[];
  announcements: Announcement[];
  attendance: AttendanceRecord[];
  tutorAttendance: TutorAttendanceRecord[];
  onRefreshData: () => Promise<void>;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentTab,
  setCurrentTab,
  students,
  tutors,
  classes,
  lessons,
  fees,
  salaries,
  referrals,
  announcements,
  attendance,
  tutorAttendance,
  onRefreshData
}) => {
  const { userProfile } = useAuth();

  // Modal states
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<{ day: DayOfWeek; time: string } | undefined>();
  const [selectedClass, setSelectedClass] = useState<TimetableClass | null>(null);

  const [isLessonModalOpen, setIsLessonModalOpen] = useState<boolean>(false);
  const [selectedStudentForLesson, setSelectedStudentForLesson] = useState<string>('');
  const [isStudentModalOpen, setIsStudentModalOpen] = useState<boolean>(false);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState<boolean>(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // 360° All-in-One Student Dossier Profile Modal State
  const [isDossierOpen, setIsDossierOpen] = useState<boolean>(false);
  const [dossierStudent, setDossierStudent] = useState<Student | null>(null);

  const openStudent360 = (studentOrId: Student | string) => {
    if (typeof studentOrId === 'string') {
      const found = students.find(s => s.studentId === studentOrId || s.id === studentOrId || s.name === studentOrId);
      if (found) {
        setDossierStudent(found);
        setIsDossierOpen(true);
      }
    } else if (studentOrId) {
      setDossierStudent(studentOrId);
      setIsDossierOpen(true);
    }
  };

  const [isFeeModalOpen, setIsFeeModalOpen] = useState<boolean>(false);
  const [selectedFee, setSelectedFee] = useState<StudentFee | null>(null);
  const [viewingReceiptFee, setViewingReceiptFee] = useState<StudentFee | null>(null);

  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState<boolean>(false);
  const [selectedSalary, setSelectedSalary] = useState<TutorSalary | null>(null);

  // Tutor modal & selection (Item 9)
  const [isTutorModalOpen, setIsTutorModalOpen] = useState<boolean>(false);
  const [selectedTutor, setSelectedTutor] = useState<Tutor | null>(null);

  // Referral modal & selection (Item 11)
  const [isReferralModalOpen, setIsReferralModalOpen] = useState<boolean>(false);
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);

  // Tutor attendance modal & selection (Item 13)
  const [isTutorAttendanceModalOpen, setIsTutorAttendanceModalOpen] = useState<boolean>(false);
  const [selectedTutorAttendanceRecord, setSelectedTutorAttendanceRecord] = useState<TutorAttendanceRecord | null>(null);

  // Governance password reset state (Item 17)
  const [resetPasswordModalUser, setResetPasswordModalUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [resetFeedbackMsg, setResetFeedbackMsg] = useState<string>('');

  // Filters
  const [tutorFilter, setTutorFilter] = useState<string>('all');

  // Naturally sorted tutors (Tutor 1, Tutor 2, Tutor 3, ..., Tutor 10)
  const sortedTutors = useMemo(() => {
    return [...tutors].sort((a, b) => (a.tutorId || '').localeCompare(b.tutorId || '', undefined, { numeric: true, sensitivity: 'base' }));
  }, [tutors]);
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [adminStudentSearchQuery, setAdminStudentSearchQuery] = useState<string>('');
  const [studentStatusFilter, setStudentStatusFilter] = useState<string>('all');
  const [feeStatusFilter, setFeeStatusFilter] = useState<string>('all');

  // Student Folder & Lesson Editing states
  const [inspectedStudent, setInspectedStudent] = useState<Student | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [editLessonCovered, setEditLessonCovered] = useState<string>('');
  const [editLessonRevision, setEditLessonRevision] = useState<string>('');
  const [editLessonHomework, setEditLessonHomework] = useState<string>('');
  const [editLessonRemarks, setEditLessonRemarks] = useState<string>('');
  const [editLessonPerformance, setEditLessonPerformance] = useState<string>('');
  const [editLessonScreenshots, setEditLessonScreenshots] = useState<{ url: string, name: string }[]>([]);
  const [isUpdatingLesson, setIsUpdatingLesson] = useState<boolean>(false);

  // Monthly Sheets States
  const [selectedStudentForSheet, setSelectedStudentForSheet] = useState<Student | null>(null);
  const [inspectedStudentTab, setInspectedStudentTab] = useState<'ledger' | 'sheet'>('ledger');

  // Spreadsheet-based reports state
  const [lessonsViewMode, setLessonsViewMode] = useState<'cards' | 'spreadsheet'>('spreadsheet');
  const [spreadsheetPeriod, setSpreadsheetPeriod] = useState<'all' | 'weekly' | 'monthly'>('all');
  const [spreadsheetSearchQuery, setSpreadsheetSearchQuery] = useState<string>('');
  
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [rowEditDate, setRowEditDate] = useState<string>('');
  const [rowEditCovered, setRowEditCovered] = useState<string>('');
  const [rowEditMemorization, setRowEditMemorization] = useState<string>('');
  const [rowEditAdaabManners, setRowEditAdaabManners] = useState<string>('');
  const [rowEditRevision, setRowEditRevision] = useState<string>('');
  const [rowEditHomework, setRowEditHomework] = useState<string>('');
  const [rowEditRemarks, setRowEditRemarks] = useState<string>('');
  const [rowEditPerformance, setRowEditPerformance] = useState<string>('');
  const [rowEditLessonType, setRowEditLessonType] = useState<string>('Quran');

  // Lesson Material & Full Edit Modals for Admin
  const [adminMaterialLesson, setAdminMaterialLesson] = useState<Lesson | null>(null);
  const [isAdminMaterialModalOpen, setIsAdminMaterialModalOpen] = useState<boolean>(false);
  const [adminFullEditLesson, setAdminFullEditLesson] = useState<Lesson | null>(null);
  const [isAdminFullEditModalOpen, setIsAdminFullEditModalOpen] = useState<boolean>(false);

  // Real student records search for Admin (matches name or student ID)
  const matchedAdminStudents = adminStudentSearchQuery.trim()
    ? students.filter(s =>
        s.name.toLowerCase().includes(adminStudentSearchQuery.trim().toLowerCase()) ||
        s.studentId.toLowerCase().includes(adminStudentSearchQuery.trim().toLowerCase())
      )
    : [];

  // User registration modal state
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState<boolean>(false);

  // Hide toggles for Options/Settings areas
  const [hideOperationalSettings, setHideOperationalSettings] = useState<boolean>(false);
  const [hideDataGovernance, setHideDataGovernance] = useState<boolean>(false);
  const [hideUserGovernance, setHideUserGovernance] = useState<boolean>(false);

  // Announcement creation form state with multiple target roles
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [newAnnRoles, setNewAnnRoles] = useState<string[]>(['all']);
  const [newAnnStartDate, setNewAnnStartDate] = useState('');
  const [newAnnEndDate, setNewAnnEndDate] = useState('');

  // Attendance quick marking state
  const [attStudentId, setAttStudentId] = useState(students[0]?.studentId || '');
  const [attStatus, setAttStatus] = useState<'Present' | 'Absent' | 'Excused'>('Present');
  const [attendanceSubTab, setAttendanceSubTab] = useState<'students' | 'tutors'>('students');

  // Fee Tab sub-filters and search
  const [feeTabFilter, setFeeTabFilter] = useState<'all' | 'Paid' | 'Submitted' | 'Pending' | 'Overdue'>('all');
  const [feeSearchQuery, setFeeSearchQuery] = useState<string>('');
  const [feeCurrencyFilter, setFeeCurrencyFilter] = useState<string>('all');

  // System User Accounts state
  const [systemUsers, setSystemUsers] = useState<UserProfile[]>(INITIAL_TUTOR_USER_PROFILES);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Strict Deletion & Undo State
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<DeleteConfirmTarget | null>(null);
  const [undoToast, setUndoToast] = useState<UndoToastItem | null>(null);
  
  // Slot Deletion History Stacks (Undo / Redo)
  const [undoStack, setUndoStack] = useState<any[]>([]);
  const [redoStack, setRedoStack] = useState<any[]>([]);

  // Family Group & Trial SMS State
  const [isFamilyGroupModalOpen, setIsFamilyGroupModalOpen] = useState<boolean>(false);
  const [isTrialSmsModalOpen, setIsTrialSmsModalOpen] = useState<boolean>(false);
  const [selectedTrialStudent, setSelectedTrialStudent] = useState<Student | null>(null);

  // Multi-day class deletion modal state
  const [multiDeleteTargetClass, setMultiDeleteTargetClass] = useState<TimetableClass | null>(null);
  const [isMultiDeleteModalOpen, setIsMultiDeleteModalOpen] = useState<boolean>(false);

  // Student leave / vacation modal state
  const [studentForLeave, setStudentForLeave] = useState<Student | null>(null);
  const [isStudentLeaveModalOpen, setIsStudentLeaveModalOpen] = useState<boolean>(false);

  // Student tutor shift / transfer modal state
  const [studentForShift, setStudentForShift] = useState<Student | null>(null);
  const [isShiftTutorModalOpen, setIsShiftTutorModalOpen] = useState<boolean>(false);

  // Weekly Progress Report Modal State
  const [isWeeklyReportModalOpen, setIsWeeklyReportModalOpen] = useState<boolean>(false);
  const [weeklyReportStudentId, setWeeklyReportStudentId] = useState<string>('');

  // Operational Settings State
  const [academyName, setAcademyName] = useState(() => localStorage.getItem('it_academy_name') || 'Islamic Tuition');
  const [academyPhone, setAcademyPhone] = useState(() => localStorage.getItem('it_academy_phone') || '+1 (718) 618-4848');
  const [academyTimezone, setAcademyTimezone] = useState(() => localStorage.getItem('it_academy_tz') || 'Asia/Karachi');
  const [headOfficeEmail, setHeadOfficeEmail] = useState(() => localStorage.getItem('it_academy_email') || 'info@islamictuition.us');
  const [trialSessionsCount, setTrialSessionsCount] = useState<number>(() => {
    const saved = localStorage.getItem('it_trial_sessions_count');
    return saved ? parseInt(saved, 10) : 5;
  });
  const [siblingDiscountPercent, setSiblingDiscountPercent] = useState<number>(() => {
    const saved = localStorage.getItem('it_sibling_discount_percent');
    return saved ? parseInt(saved, 10) : 10;
  });
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState(false);

  // Sync settings with Cloud Firestore in real time
  useEffect(() => {
    // Initial fetch from Firestore
    getAcademySettings().then((liveSettings) => {
      if (liveSettings) {
        if (liveSettings.academyName) setAcademyName(liveSettings.academyName);
        if (liveSettings.contactPhone) setAcademyPhone(liveSettings.contactPhone);
        if (liveSettings.operationalTimezone) setAcademyTimezone(liveSettings.operationalTimezone);
        if (liveSettings.contactEmail) setHeadOfficeEmail(liveSettings.contactEmail);
        if (liveSettings.trialSessionsCount) setTrialSessionsCount(liveSettings.trialSessionsCount);
        if (liveSettings.siblingDiscountPercent !== undefined) setSiblingDiscountPercent(liveSettings.siblingDiscountPercent);

        localStorage.setItem('it_academy_name', liveSettings.academyName || 'Islamic Tuition');
        localStorage.setItem('it_academy_phone', liveSettings.contactPhone || '+1 (718) 618-4848');
        localStorage.setItem('it_academy_tz', liveSettings.operationalTimezone || 'Asia/Karachi');
        localStorage.setItem('it_academy_email', liveSettings.contactEmail || 'info@islamictuition.us');
        if (liveSettings.trialSessionsCount) localStorage.setItem('it_trial_sessions_count', String(liveSettings.trialSessionsCount));
        if (liveSettings.siblingDiscountPercent !== undefined) localStorage.setItem('it_sibling_discount_percent', String(liveSettings.siblingDiscountPercent));
      }
    }).catch(() => {});

    // Live subscription
    const unsub = subscribeToAcademySettings((liveSettings) => {
      if (liveSettings) {
        if (liveSettings.academyName) setAcademyName(liveSettings.academyName);
        if (liveSettings.contactPhone) setAcademyPhone(liveSettings.contactPhone);
        if (liveSettings.operationalTimezone) setAcademyTimezone(liveSettings.operationalTimezone);
        if (liveSettings.contactEmail) setHeadOfficeEmail(liveSettings.contactEmail);
        if (liveSettings.trialSessionsCount) setTrialSessionsCount(liveSettings.trialSessionsCount);
        if (liveSettings.siblingDiscountPercent !== undefined) setSiblingDiscountPercent(liveSettings.siblingDiscountPercent);

        localStorage.setItem('it_academy_name', liveSettings.academyName || 'Islamic Tuition');
        localStorage.setItem('it_academy_phone', liveSettings.contactPhone || '+1 (718) 618-4848');
        localStorage.setItem('it_academy_tz', liveSettings.operationalTimezone || 'Asia/Karachi');
        localStorage.setItem('it_academy_email', liveSettings.contactEmail || 'info@islamictuition.us');
        if (liveSettings.trialSessionsCount) localStorage.setItem('it_trial_sessions_count', String(liveSettings.trialSessionsCount));
        if (liveSettings.siblingDiscountPercent !== undefined) localStorage.setItem('it_sibling_discount_percent', String(liveSettings.siblingDiscountPercent));
      }
    });

    return () => unsub();
  }, []);

  const handleSaveOperationalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = academyName.trim();
    const cleanPhone = academyPhone.trim();
    const cleanTz = academyTimezone.trim();
    const cleanEmail = headOfficeEmail.trim();

    localStorage.setItem('it_academy_name', cleanName);
    localStorage.setItem('it_academy_phone', cleanPhone);
    localStorage.setItem('it_academy_tz', cleanTz);
    localStorage.setItem('it_academy_email', cleanEmail);
    localStorage.setItem('it_trial_sessions_count', String(trialSessionsCount));
    localStorage.setItem('it_sibling_discount_percent', String(siblingDiscountPercent));

    try {
      await updateAcademySettings({
        academyName: cleanName,
        contactPhone: cleanPhone,
        operationalTimezone: cleanTz,
        contactEmail: cleanEmail,
        trialSessionsCount,
        siblingDiscountPercent
      });
    } catch (err) {
      console.warn('Could not persist settings to Cloud Firestore immediately:', err);
    }

    setSettingsSaveSuccess(true);
    setTimeout(() => setSettingsSaveSuccess(false), 3500);
  };

  // Overview Tab Widgets State
  const [overviewFeeFilter, setOverviewFeeFilter] = useState<'all' | 'submitted' | 'overdue' | 'pending'>('all');
  const [overviewTrialFilter, setOverviewTrialFilter] = useState<'all' | 'day1' | 'followup' | 'decision'>('all');
  const [copiedReminderId, setCopiedReminderId] = useState<string | null>(null);

  const getPaymentReminderMessage = (fee: StudentFee) => {
    const brand = academyName.trim() || 'Islamic Tuition';
    return `Assalamu Alaikum ${fee.parentName || 'Parent'},\n\nThis is a friendly reminder from ${brand} regarding tuition invoice ${fee.invoiceNumber} for ${fee.studentName} (${fee.billingPeriod}).\n\n📌 Amount Due: ${getCurrencySymbol(fee.currency)}${fee.amount}\n📅 Due Date: ${fee.dueDate}\n\nPlease share the transfer receipt once settled so we can update your student ledger.\n\nJazakAllah Khair,\n${brand} Administration`;
  };

  const handleCopyPaymentReminder = (fee: StudentFee) => {
    const msg = getPaymentReminderMessage(fee);
    navigator.clipboard.writeText(msg);
    setCopiedReminderId(fee.id);
    setTimeout(() => setCopiedReminderId(null), 3000);
  };

  const handleSendWhatsAppFeeReminder = (fee: StudentFee) => {
    const phoneRaw = (fee.parentPhone || '').replace(/[^0-9]/g, '');
    const msg = getPaymentReminderMessage(fee);
    const encoded = encodeURIComponent(msg);
    if (phoneRaw && phoneRaw.length >= 7) {
      window.open(`https://wa.me/${phoneRaw}?text=${encoded}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }
  };

  const handleQuickMarkPaid = async (fee: StudentFee) => {
    const todayDate = new Date().toISOString().slice(0, 10);
    await updateFee(fee.id, {
      status: 'Paid',
      paymentDate: todayDate,
      paymentMethod: 'Direct Payment (Admin Settle)'
    });
    await onRefreshData();
  };

  const handleQuickTrialStatusChange = async (student: Student, newTrialStatus: any) => {
    const isConverting = newTrialStatus === 'Converted';
    await updateStudent(student.id, {
      trialStatus: newTrialStatus,
      status: isConverting ? 'Active' : 'Trial'
    });
    await onRefreshData();
  };

  const handleSaveFamilyGroup = async (groupName: string, selectedStudentIds: string[]) => {
    const groupId = 'fam_' + groupName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const updateOps: Promise<void>[] = [];

    for (const sid of selectedStudentIds) {
      const student = students.find(s => s.studentId === sid);
      if (student) {
        updateOps.push(updateStudent(student.id, {
          familyGroupId: groupId,
          familyGroupName: groupName
        }));
      }
    }

    const removedStudents = students.filter(
      s => (s.familyGroupId === groupId || s.familyGroupName === groupName) && !selectedStudentIds.includes(s.studentId)
    );
    for (const rem of removedStudents) {
      updateOps.push(updateStudent(rem.id, {
        familyGroupId: '',
        familyGroupName: ''
      }));
    }

    await Promise.all(updateOps);
    await onRefreshData();
  };

  const handleRemoveFromFamily = async (studentId: string) => {
    const student = students.find(s => s.studentId === studentId);
    if (student) {
      await updateStudent(student.id, {
        familyGroupId: '',
        familyGroupName: ''
      });
      await onRefreshData();
    }
  };

  const handleSendTrialSms = async (studentId: string, phone: string, message: string) => {
    const student = students.find(s => s.studentId === studentId);
    if (student) {
      const noteEntry = `\n[SMS Reminder Sent ${new Date().toLocaleDateString()}] to ${phone}: ${message.slice(0, 60)}...`;
      await updateStudent(student.id, {
        privateAdminNotes: (student.privateAdminNotes || '') + noteEntry
      });
      await onRefreshData();
    }
  };

  const handleUndoRestore = async (trashId: string) => {
    const actionIndex = undoStack.findIndex(a => a.trashId === trashId);
    const action = actionIndex !== -1 ? undoStack[actionIndex] : null;

    await restoreTrashRecord(trashId);
    await onRefreshData();
    await loadSystemUsers();

    if (action) {
      setUndoStack(prev => prev.filter((_, idx) => idx !== actionIndex));
      setRedoStack(prev => [...prev, action]);
    }
  };

  const handleUndoAction = async () => {
    if (undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    try {
      await restoreTrashRecord(action.trashId);
      await onRefreshData();
      await loadSystemUsers();
      setUndoStack(prev => prev.slice(0, -1));
      setRedoStack(prev => [...prev, action]);
      setUndoToast(null);
    } catch (err: any) {
      alert(`Failed to undo: ${err.message}`);
    }
  };

  const handleRedoAction = async () => {
    if (redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1];
    try {
      const newTrashId = await deleteClass(action.originalId);
      await onRefreshData();
      await loadSystemUsers();
      
      const updatedAction = { ...action, trashId: newTrashId };
      setRedoStack(prev => prev.slice(0, -1));
      setUndoStack(prev => [...prev, updatedAction]);
    } catch (err: any) {
      alert(`Failed to redo: ${err.message}`);
    }
  };

  const loadSystemUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const users = await getSystemUsers();
      setSystemUsers(users && users.length >= 20 ? users : INITIAL_TUTOR_USER_PROFILES);
    } catch (err) {
      console.warn("Could not load system users:", err);
      setSystemUsers(INITIAL_TUTOR_USER_PROFILES);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Real-time Pending Registrations State
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [approvingUid, setApprovingUid] = useState<string | null>(null);
  const [rejectingUid, setRejectingUid] = useState<string | null>(null);
  const [assignTutorMap, setAssignTutorMap] = useState<Record<string, string>>({});
  const [assignCourseMap, setAssignCourseMap] = useState<Record<string, CourseType>>({});
  const [assignStatusMap, setAssignStatusMap] = useState<Record<string, StudentStatus>>({});

  useEffect(() => {
    loadSystemUsers();
    // Live subscription for new pending self-registrations
    const unsub = subscribeToPendingUsers((pending) => {
      setPendingUsers(pending);
    });
    return () => unsub();
  }, []);

  const handleApprovePendingUser = async (user: UserProfile) => {
    setApprovingUid(user.uid);
    try {
      const studentMatch = students.find(s =>
        (user.studentId && s.studentId === user.studentId) ||
        (user.email && s.email && s.email.toLowerCase().trim() === user.email.toLowerCase().trim())
      );
      const selectedTutor = assignTutorMap[user.uid] || user.tutorId || studentMatch?.assignedTutorId || (tutors.length > 0 ? tutors[0].tutorId : 'Tutor 6');
      const selectedCourse = assignCourseMap[user.uid] || user.courseType || studentMatch?.courseType || 'Quran Reading / Nazra';
      const selectedStatus = assignStatusMap[user.uid] || 'Active';

      await approveUserAccount(user.uid, 'Director / Admin', {
        assignedTutorId: selectedTutor,
        courseType: selectedCourse,
        studentStatus: selectedStatus
      });

      await onRefreshData();
      await loadSystemUsers();
      setPendingUsers(prev => prev.filter(p => p.uid !== user.uid));
    } catch (err: any) {
      alert(`Failed to approve user: ${err.message}`);
    } finally {
      setApprovingUid(null);
    }
  };

  const handleRejectPendingUser = async (user: UserProfile) => {
    if (!window.confirm(`Are you sure you want to decline registration for ${user.displayName || user.email}?`)) return;
    setRejectingUid(user.uid);
    try {
      await rejectUserAccount(user.uid, 'Director / Admin');
      await onRefreshData();
      await loadSystemUsers();
      setPendingUsers(prev => prev.filter(p => p.uid !== user.uid));
    } catch (err: any) {
      alert(`Failed to decline user: ${err.message}`);
    } finally {
      setRejectingUid(null);
    }
  };

  // Filtered classes for Timetable
  const filteredClasses = tutorFilter === 'all'
    ? classes
    : classes.filter(c => c.tutorId === tutorFilter);

  // Current time & day in PKT
  const currentTeachingDay = getCurrentTeachingDay();
  const todayStr = new Date().toISOString().slice(0, 10);

  // KPI Calculations
  const activeStudentsCount = students.filter(s => s.status === 'Active').length;
  const trialStudentsCount = students.filter(s => s.status === 'Trial').length;
  const decisionPendingTrials = students.filter(s => s.status === 'Trial' && (s.trialSessionsCompleted || 0) >= 5);
  const totalFeesPaid = fees
    .filter(f => f.status === 'Paid')
    .reduce((acc, f) => acc + f.amount, 0);
  const pendingFeesCount = fees.filter(f => f.status === 'Pending' || f.status === 'Overdue').length;

  // Overdue, Pending, and Submitted fee breakdowns for Overview
  const overdueFeesList = fees.filter(f => f.status === 'Overdue' || (f.status === 'Pending' && f.dueDate < todayStr));
  const pendingFeesList = fees.filter(f => f.status === 'Pending' && f.dueDate >= todayStr);
  const submittedFeesList = fees.filter(f => f.status === 'Payment Submitted');
  const totalOverdueAmount = overdueFeesList.reduce((acc, f) => acc + f.amount, 0);
  const totalPendingAmount = pendingFeesList.reduce((acc, f) => acc + f.amount, 0);
  const totalSubmittedAmount = submittedFeesList.reduce((acc, f) => acc + (f.amount - (f.discount || 0)), 0);

  // Trials breakdown for Overview
  const trialStudentsList = students.filter(s => s.status === 'Trial');
  const day1TrialsList = trialStudentsList.filter(s => s.trialStatus === 'Day 1' || (s.trialSessionsCompleted || 0) <= 1);
  const followUpTrialsList = trialStudentsList.filter(s => s.trialStatus === 'Follow-up' || s.trialStatus === 'Interested' || s.trialStatus === 'Pending Call');

  // Today's classes sorted chronologically
  const todayClassesList = classes
    .filter(c => c.dayOfWeek === currentTeachingDay)
    .sort((a, b) => a.startTimePKT.localeCompare(b.startTimePKT));

  // Handlers
  const handleSaveClass = async (
    classData: Omit<TimetableClass, 'id'>,
    id?: string,
    additionalDays?: DayOfWeek[]
  ) => {
    if (id) {
      await updateClass(id, classData);
    } else {
      const ops = [addClass(classData)];
      if (additionalDays && additionalDays.length > 0) {
        for (const extraDay of additionalDays) {
          ops.push(addClass({
            ...classData,
            dayOfWeek: extraDay,
            isWeekend: extraDay === 'Saturday' || extraDay === 'Sunday'
          }));
        }
      }
      await Promise.all(ops);
    }
    await onRefreshData();
  };

  const handleDeleteClass = async (classId: string) => {
    const cls = classes.find(c => c.id === classId || String(c.id) === String(classId));
    if (!cls) {
      try {
        await deleteClass(classId);
        await onRefreshData();
      } catch (err) {
        console.error("Failed to delete class directly:", err);
      }
      return;
    }

    // Check if this student has multiple slots with this tutor
    const matchingSlots = classes.filter(
      c => c.studentId === cls.studentId && c.tutorId === cls.tutorId
    );

    if (matchingSlots.length > 1) {
      setMultiDeleteTargetClass(cls);
      setIsMultiDeleteModalOpen(true);
      return;
    }

    setDeleteConfirmTarget({
      id: classId,
      itemType: 'class',
      title: `${cls.studentName} — ${cls.dayOfWeek} at ${cls.startTimePKT} PKT`,
      description: 'The weekly scheduled timetable slot will be removed from the active calendar.',
      details: {
        Student: cls.studentName,
        StudentID: cls.studentId,
        Faculty: cls.tutorId,
        DayOfWeek: cls.dayOfWeek,
        TimeSlot: `${cls.startTimePKT} PKT`,
        Duration: `${cls.durationMinutes} Minutes`
      },
      onConfirm: async () => {
        try {
          const trashId = await deleteClass(classId);
          await onRefreshData();
          const action = {
            trashId,
            originalId: classId,
            title: `Class for ${cls.studentName} (${cls.dayOfWeek} ${cls.startTimePKT})`,
            studentName: cls.studentName,
            dayOfWeek: cls.dayOfWeek,
            startTimePKT: cls.startTimePKT,
            classData: cls
          };
          setUndoStack(prev => [...prev, action]);
          setRedoStack([]); // Clear redo stack on new action
          setUndoToast({
            trashId,
            title: `Class for ${cls.studentName} (${cls.dayOfWeek} ${cls.startTimePKT})`,
            itemType: 'class'
          });
        } catch (err) {
          console.error("Failed to execute class deletion:", err);
        }
      }
    });
  };

  const handleConfirmMultiDayDelete = async (classIds: string[], summary: string) => {
    try {
      for (const id of classIds) {
        const targetCls = classes.find(c => c.id === id);
        const trashId = await deleteClass(id);
        if (targetCls) {
          setUndoStack(prev => [...prev, {
            trashId,
            originalId: id,
            title: `Class for ${targetCls.studentName} (${targetCls.dayOfWeek} ${targetCls.startTimePKT})`,
            studentName: targetCls.studentName,
            dayOfWeek: targetCls.dayOfWeek,
            startTimePKT: targetCls.startTimePKT,
            classData: targetCls
          }]);
        }
      }
      await onRefreshData();
      setUndoToast({
        trashId: 'batch',
        title: `${classIds.length} slot(s) deleted: ${summary}`,
        itemType: 'class'
      });
    } catch (err) {
      console.error("Failed to execute multi-day deletion:", err);
    }
  };

  const handleSaveStudentLeave = async (params: {
    studentId: string;
    isOnLeave: boolean;
    leaveStartDate?: string;
    leaveEndDate?: string;
    leaveReason?: string;
    leaveType?: 'Specific Days' | 'Full Month' | 'Custom Range' | 'Indefinite';
    updateClasses?: boolean;
  }) => {
    await setStudentLeave(params);
    await onRefreshData();
  };

  const handleShiftStudentTutor = async (params: {
    studentId: string;
    oldTutorId: string;
    newTutorId: string;
    notes?: string;
  }) => {
    const res = await shiftStudentTutor(params);
    await onRefreshData();
    alert(res.message);
  };

  const handleCancelClass = async (classId: string, newStatus: TimetableClass['status']) => {
    try {
      await updateClass(classId, { status: newStatus });
      await onRefreshData();
    } catch (err: any) {
      console.error("Failed to update class status:", err);
    }
  };

  const handleSaveStudent = async (studentData: Omit<Student, 'id'>, id?: string) => {
    if (id) {
      const existingStudent = students.find(s => s.id === id || s.studentId === studentData.studentId);
      if (
        existingStudent &&
        existingStudent.assignedTutorId &&
        studentData.assignedTutorId &&
        existingStudent.assignedTutorId !== studentData.assignedTutorId
      ) {
        // Automatically shift scheduled timetable classes, live Zoom link, and rosters
        await shiftStudentTutor({
          studentId: existingStudent.studentId,
          oldTutorId: existingStudent.assignedTutorId,
          newTutorId: studentData.assignedTutorId,
          notes: 'Updated via Student Registry profile editor'
        });
      }
      await updateStudent(id, studentData);
    } else {
      await addStudent(studentData);
    }

    // Auto-flow student fee into Fee section if monthly fee is specified (Item 3)
    if (studentData.monthlyFee && studentData.monthlyFee > 0) {
      const currentBillingPeriod = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date());
      const existingFee = fees.find(f => f.studentId === studentData.studentId && f.billingPeriod === currentBillingPeriod);
      if (!existingFee) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);
        await addFee({
          invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          studentId: studentData.studentId,
          studentName: studentData.name,
          parentName: studentData.parentName || studentData.name,
          amount: studentData.monthlyFee,
          currency: (studentData.feeCurrency || 'USD') as any,
          billingPeriod: currentBillingPeriod,
          dueDate: dueDate.toISOString().slice(0, 10),
          status: 'Pending',
          notes: 'Auto-generated tuition invoice from student registration',
          createdAt: new Date().toISOString()
        });
      }
    }
    await onRefreshData();
  };

  const handleDeleteStudent = async (id: string) => {
    const st = students.find(s => s.id === id || s.studentId === id);
    if (!st) return;
    setDeleteConfirmTarget({
      id: st.id,
      itemType: 'student',
      title: `${st.name} (${st.studentId})`,
      description: 'Removing this student will archive their profile, timetable slots, and history to the Recovery Trash.',
      details: {
        FullName: st.name,
        StudentID: st.studentId,
        Course: st.courseType,
        AssignedTutor: st.assignedTutorId || 'Unassigned',
        ParentContact: st.parentName || st.parentEmail || 'N/A',
        Status: st.status
      },
      onConfirm: async () => {
        const trashId = await deleteStudent(st.id);
        await onRefreshData();
        await loadSystemUsers();
        setUndoToast({
          trashId,
          title: `Student: ${st.name} (${st.studentId})`,
          itemType: 'student'
        });
      }
    });
  };

  const handleSaveLesson = async (lessonData: Omit<Lesson, 'id'>) => {
    await addLesson(lessonData);
    await onRefreshData();
  };

  const handleUpdateLessonReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLesson || isUpdatingLesson) return;
    setIsUpdatingLesson(true);
    try {
      await updateLesson(editingLesson.id, {
        lessonCovered: editLessonCovered,
        revision: editLessonCovered ? editLessonRevision : undefined,
        homework: editLessonHomework,
        teacherRemarks: editLessonRemarks,
        performance: editLessonPerformance as any,
        screenshots: editLessonScreenshots
      });
      setEditingLesson(null);
      await onRefreshData();
    } catch (err: any) {
      alert("Error updating lesson report: " + err.message);
    } finally {
      setIsUpdatingLesson(false);
    }
  };

  const handleDeleteLessonReport = async (lessonId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this lesson report? This action cannot be undone.")) return;
    try {
      await deleteLesson(lessonId);
      await onRefreshData();
    } catch (err: any) {
      alert("Error deleting lesson report: " + err.message);
    }
  };

  const handleSaveSpreadsheetRow = async (lessonId: string) => {
    try {
      await updateLesson(lessonId, {
        date: rowEditDate,
        lessonType: rowEditLessonType,
        lessonCovered: rowEditCovered,
        memorization: rowEditMemorization,
        adaabManners: rowEditAdaabManners,
        revision: rowEditRevision,
        homework: rowEditHomework,
        teacherRemarks: rowEditRemarks,
        performance: (rowEditPerformance ? rowEditPerformance : undefined) as any
      });
      setEditingRowId(null);
      await onRefreshData();
    } catch (err: any) {
      alert("Error saving spreadsheet row: " + err.message);
    }
  };

  const handleSaveFee = async (feeData: Omit<StudentFee, 'id'>, id?: string) => {
    if (id) {
      await updateFee(id, feeData);
    } else {
      await addFee(feeData);
    }
    await onRefreshData();
  };

  const handleSaveSalary = async (salaryData: Omit<TutorSalary, 'id'>, id?: string) => {
    if (id) {
      await updateSalary(id, salaryData);
    } else {
      await addSalary(salaryData);
    }
    await onRefreshData();
  };

  const handleSaveTutor = async (tutorData: Omit<Tutor, 'id'>, id?: string) => {
    if (id) {
      await updateTutor(id, tutorData);
    } else {
      await addTutor(tutorData);
    }
    await onRefreshData();
  };

  const handleDeleteTutor = async (id: string, tutorName: string) => {
    const tutor = tutors.find(t => t.id === id || t.tutorId === id);
    const tutorDisplayName = tutor?.realName || tutorName;
    const tutorClasses = classes.filter(c => c.tutorId === (tutor?.tutorId || id));
    
    setDeleteConfirmTarget({
      id: id,
      itemType: 'tutor',
      title: `${tutorDisplayName} (${tutor?.tutorId || id})`,
      description: `Deleting this faculty tutor will archive their profile. Note: ${tutorClasses.length} timetable classes will need reassignment.`,
      details: {
        FacultyName: tutorDisplayName,
        TutorID: tutor?.tutorId || id,
        Email: tutor?.email || 'N/A',
        ActiveClasses: tutorClasses.length,
        Status: tutor?.status || 'Active'
      },
      onConfirm: async () => {
        const trashId = await deleteTutor(id);
        await onRefreshData();
        await loadSystemUsers();
        setUndoToast({
          trashId,
          title: `Faculty Tutor: ${tutorDisplayName}`,
          itemType: 'tutor'
        });
      }
    });
  };

  const handleSaveReferral = async (referralData: Omit<Referral, 'id'>, id?: string) => {
    if (id) {
      await updateReferral(id, referralData);
    } else {
      await addReferral(referralData);
    }
    await onRefreshData();
  };

  const handleDeleteReferral = async (id: string) => {
    const ref = referrals.find(r => r.id === id);
    if (!ref) return;
    setDeleteConfirmTarget({
      id: ref.id,
      itemType: 'referral',
      title: `Referral: ${ref.referredStudentName}`,
      description: 'The referral bonus record will be moved to the Recovery Trash.',
      details: {
        Referrer: ref.referrerName,
        ReferredStudent: ref.referredStudentName,
        RewardAmount: `$${ref.rewardAmount}`,
        Status: ref.status
      },
      onConfirm: async () => {
        const trashId = await deleteReferral(ref.id);
        await onRefreshData();
        setUndoToast({
          trashId,
          title: `Referral for ${ref.referredStudentName}`,
          itemType: 'referral'
        });
      }
    });
  };

  const handleSaveTutorAttendance = async (record: Omit<TutorAttendanceRecord, 'id'>, id?: string) => {
    if (id) {
      await updateTutorAttendanceRecord(id, record);
    } else {
      await addTutorAttendanceRecord(record);
    }
    await onRefreshData();
  };

  const handleDeleteTutorAttendance = async (id: string) => {
    const rec = tutorAttendance.find(r => r.id === id);
    if (!rec) return;
    setDeleteConfirmTarget({
      id: rec.id,
      itemType: 'tutor_attendance',
      title: `Attendance: ${rec.tutorName || rec.tutorId} on ${rec.date}`,
      description: 'This tutor attendance record will be moved to the Recovery Trash.',
      details: {
        Tutor: rec.tutorName || rec.tutorId,
        Date: rec.date,
        Status: rec.status,
        TimeIn: rec.timeIn || rec.loginTime || 'N/A'
      },
      onConfirm: async () => {
        const trashId = await deleteTutorAttendanceRecord(rec.id);
        await onRefreshData();
        setUndoToast({
          trashId,
          title: `Attendance log for ${rec.tutorName || rec.tutorId}`,
          itemType: 'tutor_attendance'
        });
      }
    });
  };

  const handleDeleteAnnouncement = async (annId: string) => {
    const ann = announcements.find(a => a.id === annId);
    if (!ann) return;
    setDeleteConfirmTarget({
      id: ann.id,
      itemType: 'announcement',
      title: ann.title,
      description: 'The announcement will be moved to the Recovery Trash.',
      details: {
        Title: ann.title,
        Audience: ann.targetRole || 'All Academy',
        PostedDate: ann.createdAt?.slice(0, 10) || 'N/A'
      },
      onConfirm: async () => {
        const trashId = await deleteAnnouncement(ann.id);
        await onRefreshData();
        setUndoToast({
          trashId,
          title: `Announcement: ${ann.title}`,
          itemType: 'announcement'
        });
      }
    });
  };

  const handleDeleteSystemUser = async (user: UserProfile) => {
    setDeleteConfirmTarget({
      id: user.uid,
      itemType: 'user',
      title: `${user.displayName || user.email} (${user.role})`,
      description: 'The user account credentials and roles will be removed and archived.',
      details: {
        AccountName: user.displayName || 'N/A',
        Email: user.email,
        Role: user.role,
        Status: user.status
      },
      onConfirm: async () => {
        const trashId = await deleteSystemUser(user.uid);
        await loadSystemUsers();
        await onRefreshData();
        setUndoToast({
          trashId,
          title: `User Account: ${user.displayName || user.email}`,
          itemType: 'user'
        });
      }
    });
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle || !newAnnContent) return;
    const targetRoles = newAnnRoles.length === 0 || newAnnRoles.includes('all') ? ['all'] : newAnnRoles;
    await addAnnouncement({
      title: newAnnTitle,
      content: newAnnContent,
      targetRoles: targetRoles as any,
      targetRole: targetRoles.join(', '),
      pinned: false,
      authorName: 'Academic Directorate',
      startDate: newAnnStartDate || undefined,
      endDate: newAnnEndDate || undefined,
      createdAt: new Date().toISOString()
    });
    setNewAnnTitle('');
    setNewAnnContent('');
    setNewAnnRoles(['all']);
    setNewAnnStartDate('');
    setNewAnnEndDate('');
    await onRefreshData();
  };

  const handleMarkAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    const st = students.find(s => s.studentId === attStudentId);
    if (!st) return;
    await addAttendanceRecord({
      classId: 'manual_admin',
      studentId: st.studentId,
      studentName: st.name,
      tutorId: st.assignedTutorId,
      date: new Date().toISOString().slice(0, 10),
      status: attStatus,
      markedBy: 'Admin',
      markedAt: new Date().toISOString()
    });
    alert(`Attendance marked as ${attStatus} for ${st.name}`);
    await onRefreshData();
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* Timetable Slot History (Undo & Redo Utility Bar) */}
      <div id="admin_slot_history_toolbar" className="bg-[#FAF9F7] border border-[#E3DFD7] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-[#2D8B5C]" />
          <div>
            <h4 className="text-xs font-bold text-slate-800">Timetable Scheduler Controls</h4>
            <p className="text-[10px] text-slate-500">Easily reverse slot modifications in real-time</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Undo Button */}
          <button
            type="button"
            onClick={handleUndoAction}
            disabled={undoStack.length === 0}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              undoStack.length > 0
                ? 'bg-white text-slate-800 border-[#E3DFD7] hover:bg-slate-50 hover:shadow-xs'
                : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
            }`}
            title={undoStack.length > 0 ? `Undo delete: ${undoStack[undoStack.length - 1].title}` : 'Nothing to undo'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Undo Deletion ({undoStack.length})</span>
          </button>

          {/* Redo Button */}
          <button
            type="button"
            onClick={handleRedoAction}
            disabled={redoStack.length === 0}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              redoStack.length > 0
                ? 'bg-white text-slate-800 border-[#E3DFD7] hover:bg-slate-50 hover:shadow-xs'
                : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
            }`}
            title={redoStack.length > 0 ? `Redo delete: ${redoStack[redoStack.length - 1].title}` : 'Nothing to redo'}
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Redo Deletion ({redoStack.length})</span>
          </button>
        </div>
      </div>

      {/* Admin Student Quick Search (Accessible only to Admin) */}
      <div id="admin_student_search_widget" className="bg-white border border-[#E3DFD7] rounded-xl p-3.5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5 flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-[#5A6B61] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="admin_student_search_input"
                type="text"
                value={adminStudentSearchQuery}
                onChange={(e) => setAdminStudentSearchQuery(e.target.value)}
                placeholder="Search students by name or Student ID (e.g. STU-101)..."
                className="w-full pl-9 pr-8 py-2 bg-[#FAF9F7] border border-[#E3DFD7] rounded-lg text-xs text-[#161F1A] placeholder-[#5A6B61] focus:outline-none focus:ring-1 focus:ring-[#2D8B5C] focus:border-[#2D8B5C] transition-all"
              />
              {adminStudentSearchQuery && (
                <button
                  type="button"
                  onClick={() => setAdminStudentSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="text-xs text-[#5A6B61] flex items-center gap-1.5 shrink-0">
            <Users className="w-3.5 h-3.5 text-[#2D8B5C]" />
            <span>
              {adminStudentSearchQuery.trim()
                ? `${matchedAdminStudents.length} matching student${matchedAdminStudents.length === 1 ? '' : 's'}`
                : `${students.length} real student records`}
            </span>
          </div>
        </div>

        {/* Display only matching students when search query is entered */}
        {adminStudentSearchQuery.trim() && (
          <div className="mt-3 pt-3 border-t border-[#EAE6DE]">
            {matchedAdminStudents.length === 0 ? (
              <p className="py-3 text-center text-xs text-[#5A6B61]">
                No student found matching "<span className="font-semibold text-[#161F1A]">{adminStudentSearchQuery}</span>" by name or Student ID.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {matchedAdminStudents.map(st => (
                  <div
                    key={st.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-lg bg-[#FAF9F7] hover:bg-emerald-50/50 border border-[#E3DFD7] hover:border-[#2D8B5C]/30 transition-all text-xs"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="font-mono font-bold text-[#161F1A] bg-white px-2 py-0.5 rounded border border-[#E3DFD7] text-[11px]">
                        {st.studentId}
                      </span>
                      <div>
                        <div className="font-semibold text-[#161F1A] flex items-center gap-2">
                          <span>{st.name}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
                            st.status === 'Trial' ? 'bg-amber-100 text-amber-800' :
                            st.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {st.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#5A6B61] flex items-center gap-2 mt-0.5">
                          <span>Course: {st.courseType}</span>
                          <span>•</span>
                          <span>Tutor: {st.assignedTutorId}</span>
                          {st.timezone && (
                            <>
                              <span>•</span>
                              <span className="font-mono font-medium text-[#2D8B5C]" title={st.timezone}>
                                {getTimezoneShortCode(st.timezone)} ({st.country})
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      id={`open_student_view_${st.studentId}`}
                      onClick={() => openStudent360(st)}
                      className="px-3 py-1.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white font-bold rounded-lg shadow-2xs transition-colors cursor-pointer text-xs flex items-center space-x-1.5"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Student File</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 1. OVERVIEW TAB */}
      {currentTab === 'overview' && (
        <div className="space-y-6">
          {/* Prominent Pending Online Registrations Approval Banner */}
          {pendingUsers.length > 0 && (
            <div id="admin_pending_registrations_banner" className="bg-gradient-to-r from-[#FFF9ED] via-amber-50 to-emerald-50/40 border-2 border-[#E8A93E] p-4 sm:p-5 rounded-2xl shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200/60">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center relative shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-white animate-ping" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        {pendingUsers.length} New Registration{pendingUsers.length > 1 ? 's' : ''} Awaiting Admin Approval
                      </h3>
                      <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-[10px] font-bold uppercase tracking-wider">
                        Action Required
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Prospective students and parents who submitted self-registration online. Review details, assign faculty tutor, and approve to activate access.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCurrentTab('users')}
                  className="text-xs font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors shrink-0 self-start sm:self-center cursor-pointer"
                >
                  Manage in Users Tab →
                </button>
              </div>

              {/* Pending Users Review Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {pendingUsers.map(user => {
                  const isApproving = approvingUid === user.uid;
                  const isRejecting = rejectingUid === user.uid;
                  const assignedTutor = assignTutorMap[user.uid] || 'Tutor 1';
                  const assignedCourse = assignCourseMap[user.uid] || user.courseType || 'Quran Reading / Nazra';
                  const assignedStatus = assignStatusMap[user.uid] || 'Active';

                  return (
                    <div
                      key={user.uid}
                      className="bg-white p-3.5 rounded-xl border border-amber-200/80 shadow-2xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">{user.displayName || 'Prospective User'}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              user.role === 'student' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {user.role}
                            </span>
                            {user.studentId && (
                              <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {user.studentId}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">{user.email}</p>
                          {user.phone && <p className="text-[11px] text-slate-500 mt-0.5">📞 {user.phone}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-medium text-slate-400 block">
                            {user.country || 'USA'} ({getTimezoneShortCode(user.timezone || 'America/New_York')})
                          </span>
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-1 inline-block font-semibold">
                            Pending Review
                          </span>
                        </div>
                      </div>

                      {/* Course and Tutor Assignment Controls */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[#FAF9F7] p-2.5 rounded-lg border border-[#EAE6DE] text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Course</label>
                          <select
                            value={assignedCourse}
                            onChange={(e) => setAssignCourseMap(prev => ({ ...prev, [user.uid]: e.target.value as CourseType }))}
                            className="w-full bg-white border border-[#D5D0C6] rounded px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-[#2D8B5C]"
                          >
                            <option value="Quran Reading / Nazra">Quran Reading / Nazra</option>
                            <option value="Tajweed Rules & Pronunciation">Tajweed Rules</option>
                            <option value="Hifz / Memorization">Hifz / Memorization</option>
                            <option value="Islamic Studies & Duas">Islamic Studies</option>
                            <option value="Arabic Language Basics">Arabic Language</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Assign Faculty</label>
                          <select
                            value={assignedTutor}
                            onChange={(e) => setAssignTutorMap(prev => ({ ...prev, [user.uid]: e.target.value }))}
                            className="w-full bg-white border border-[#D5D0C6] rounded px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-[#2D8B5C]"
                          >
                            {sortedTutors.map(t => (
                              <option key={t.id} value={t.tutorId}>
                                {t.tutorId} - {t.realName || t.tutorId}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Initial Status</label>
                          <select
                            value={assignedStatus}
                            onChange={(e) => setAssignStatusMap(prev => ({ ...prev, [user.uid]: e.target.value as StudentStatus }))}
                            className="w-full bg-white border border-[#D5D0C6] rounded px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-[#2D8B5C]"
                          >
                            <option value="Active">Active Student</option>
                            <option value="Trial">Free Trial (5 Sessions)</option>
                          </select>
                        </div>
                      </div>

                      {/* Approval Action Buttons */}
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isRejecting || isApproving}
                          onClick={() => handleRejectPendingUser(user)}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isRejecting ? 'Declining...' : 'Decline'}
                        </button>
                        <button
                          type="button"
                          disabled={isRejecting || isApproving}
                          onClick={() => handleApprovePendingUser(user)}
                          className="px-4 py-1.5 text-xs font-bold text-white bg-[#2D8B5C] hover:bg-[#1E5C3D] rounded-lg shadow-2xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isApproving ? 'Activating Account...' : 'Approve & Activate Access'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Decision Pending Banner if any trials finished 5 sessions */}
          {decisionPendingTrials.length > 0 && (
            <div className="bg-[#FFF9ED] border border-[#E8A93E] p-4 rounded-xl flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-[#E8A93E]/20 flex items-center justify-center text-[#C98A1E]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#8C5D08] uppercase tracking-wider">
                    {decisionPendingTrials.length} Trial Students Completed 5 Sessions
                  </h4>
                  <p className="text-xs text-[#161F1A]">
                    Students have completed all free trial sessions and await parent confirmation & registration decision.
                  </p>
                </div>
              </div>
              <button
                id="review_trials_action_button"
                onClick={() => setCurrentTab('trials')}
                className="px-3.5 py-1.5 bg-[#E8A93E] text-white rounded-lg text-xs font-semibold hover:bg-[#C98A1E] transition-colors"
              >
                Review Trials
              </button>
            </div>
          )}

          {/* KPI Cards Grid - Enhanced with Direct Navigations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => setCurrentTab('students')}
              className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs hover:border-[#2D8B5C]/40 hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#5A6B61] uppercase tracking-wider group-hover:text-[#2D8B5C] transition-colors">Active Students</span>
                <span className="p-2 rounded-lg bg-[#2D8B5C]/10 text-[#2D8B5C] group-hover:bg-[#2D8B5C] group-hover:text-white transition-all"><Users className="w-4 h-4" /></span>
              </div>
              <p className="text-2xl font-bold text-[#161F1A] mt-2">{activeStudentsCount}</p>
              <p className="text-[11px] text-[#5A6B61] mt-1 flex items-center justify-between">
                <span>{trialStudentsCount} in trial pipeline</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#2D8B5C] transition-colors" />
              </p>
            </div>

            <div
              onClick={() => setCurrentTab('trials')}
              className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs hover:border-amber-400 hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#5A6B61] uppercase tracking-wider group-hover:text-[#8C5D08] transition-colors">Trials Pipeline</span>
                <span className="p-2 rounded-lg bg-amber-100 text-[#8C5D08] group-hover:bg-[#E8A93E] group-hover:text-white transition-all"><Sparkles className="w-4 h-4" /></span>
              </div>
              <p className="text-2xl font-bold text-[#161F1A] mt-2">{trialStudentsCount}</p>
              <p className="text-[11px] text-[#5A6B61] mt-1 flex items-center justify-between">
                <span>{day1TrialsList.length} Day 1 • {followUpTrialsList.length} Follow-up</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#8C5D08] transition-colors" />
              </p>
            </div>

            <div
              onClick={() => setCurrentTab('fees')}
              className={`p-5 rounded-xl border shadow-xs transition-all cursor-pointer group ${
                overdueFeesList.length > 0
                  ? 'bg-rose-50/30 border-rose-200 hover:border-rose-400'
                  : 'bg-white border-[#E3DFD7] hover:border-emerald-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#5A6B61] uppercase tracking-wider group-hover:text-rose-700 transition-colors">Fees & Invoices</span>
                <span className={`p-2 rounded-lg transition-all ${
                  overdueFeesList.length > 0
                    ? 'bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white'
                    : 'bg-emerald-50 text-emerald-700 group-hover:bg-[#2D8B5C] group-hover:text-white'
                }`}>
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline space-x-2 mt-2">
                <p className="text-2xl font-bold text-[#161F1A]">${totalFeesPaid}</p>
                {overdueFeesList.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                    {overdueFeesList.length} Overdue
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#5A6B61] mt-1 flex items-center justify-between">
                <span>{pendingFeesList.length} pending collection</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#2D8B5C] transition-colors" />
              </p>
            </div>

            <div
              onClick={() => setCurrentTab('timetable')}
              className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs hover:border-[#2D8B5C]/40 hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#5A6B61] uppercase tracking-wider group-hover:text-[#2D8B5C] transition-colors">
                  Today's Live Classes
                </span>
                <span className="p-2 rounded-lg bg-[#2D8B5C]/10 text-[#2D8B5C] group-hover:bg-[#2D8B5C] group-hover:text-white transition-all"><Calendar className="w-4 h-4" /></span>
              </div>
              <p className="text-2xl font-bold text-[#161F1A] mt-2">{todayClassesList.length}</p>
              <p className="text-[11px] text-[#5A6B61] mt-1 flex items-center justify-between">
                <span>{currentTeachingDay} PKT Schedule</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#2D8B5C] transition-colors" />
              </p>
            </div>
          </div>



          {/* Quick Actions Row */}
          <div className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-[#161F1A]">Quick Academy Actions</h3>
              <p className="text-xs text-[#5A6B61]">Fast shortcuts to schedule, register, or record reports</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                id="quick_add_student_button"
                onClick={() => {
                  setSelectedStudent(null);
                  setIsStudentModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-lg bg-[#2D8B5C] text-white text-xs font-semibold hover:bg-[#1E5C3D] transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register Student</span>
              </button>

              <button
                id="quick_schedule_class_button"
                onClick={() => {
                  setSelectedClass(null);
                  setIsClassModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-lg bg-white border border-[#D5D0C6] text-[#161F1A] text-xs font-semibold hover:bg-gray-50 transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-[#2D8B5C]" />
                <span>Schedule Class</span>
              </button>

              <button
                id="quick_record_lesson_button"
                onClick={() => setIsLessonModalOpen(true)}
                className="px-3.5 py-2 rounded-lg bg-white border border-[#D5D0C6] text-[#161F1A] text-xs font-semibold hover:bg-gray-50 transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#E8A93E]" />
                <span>Log Lesson</span>
              </button>

              <button
                id="quick_create_invoice_button"
                onClick={() => {
                  setSelectedFee(null);
                  setIsFeeModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-lg bg-white border border-[#D5D0C6] text-[#161F1A] text-xs font-semibold hover:bg-gray-50 transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>Issue Invoice</span>
              </button>

              <button
                id="quick_weekly_report_button"
                onClick={() => {
                  setWeeklyReportStudentId(students[0]?.studentId || '');
                  setIsWeeklyReportModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-700 text-white text-xs font-bold hover:from-emerald-700 hover:to-teal-800 transition-colors flex items-center space-x-1.5 cursor-pointer shadow-2xs"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Weekly Parent Report</span>
              </button>
            </div>
          </div>

          {/* SECTION 1: URGENT FINANCIAL ACTION CENTER (OVERDUE & PENDING FEES) */}
          <div className="bg-white rounded-xl border border-[#E3DFD7] shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-[#EDEAE3] bg-gradient-to-r from-rose-50/40 via-amber-50/30 to-white flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <h3 className="text-sm font-bold text-[#161F1A]">Urgent Tuition Fee Action Center</h3>
                  {overdueFeesList.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      {overdueFeesList.length} Past Due
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#5A6B61] mt-0.5">
                  Overdue accounts, pending collections, and instant 1-click settlement & WhatsApp/SMS reminders.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                {/* Filter pills */}
                <div className="inline-flex rounded-lg border border-[#D5D0C6] p-0.5 bg-white text-xs">
                  <button
                    type="button"
                    onClick={() => setOverviewFeeFilter('all')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      overviewFeeFilter === 'all'
                        ? 'bg-[#2D8B5C] text-white shadow-2xs'
                        : 'text-[#5A6B61] hover:text-[#161F1A]'
                    }`}
                  >
                    All Needs Attention ({overdueFeesList.length + pendingFeesList.length + submittedFeesList.length})
                  </button>
                  {submittedFeesList.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setOverviewFeeFilter('submitted')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        overviewFeeFilter === 'submitted'
                          ? 'bg-purple-700 text-white shadow-2xs'
                          : 'text-purple-800 hover:bg-purple-50'
                      }`}
                    >
                      📥 Notices Submitted ({submittedFeesList.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOverviewFeeFilter('overdue')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      overviewFeeFilter === 'overdue'
                        ? 'bg-rose-700 text-white shadow-2xs'
                        : 'text-rose-700 hover:bg-rose-50'
                    }`}
                  >
                    🚨 Overdue ({overdueFeesList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverviewFeeFilter('pending')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      overviewFeeFilter === 'pending'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'text-amber-800 hover:bg-amber-50'
                    }`}
                  >
                    ⏳ Pending ({pendingFeesList.length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentTab('fees')}
                  className="px-3 py-1.5 bg-[#FAF9F7] border border-[#D5D0C6] hover:bg-gray-100 text-[#161F1A] text-xs font-semibold rounded-lg flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  <span>Open Full Fee Ledger</span>
                  <ArrowRight className="w-3 h-3 text-[#2D8B5C]" />
                </button>
              </div>
            </div>

            {/* Prominent Payment Notices Awaiting Confirmation Banner */}
            {submittedFeesList.length > 0 && (
              <div className="p-4 bg-purple-50/90 border-b border-purple-200 flex flex-wrap items-center justify-between gap-3 text-xs text-purple-900">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-lg bg-purple-600 text-white shrink-0">
                    <Clock className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <span className="font-bold text-sm block text-purple-950">
                      {submittedFeesList.length} Payment Notice{submittedFeesList.length > 1 ? 's' : ''} Awaiting Manual Admin Confirmation
                    </span>
                    <span className="text-[11px] text-purple-800">
                      Parents/Students have reported transferring tuition. Please verify incoming bank or PayPal transactions and click <strong>Confirm Received</strong> to officially issue the Paid receipt.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentTab('fees');
                    setFeeTabFilter('Submitted');
                  }}
                  className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  Review All Submissions ({submittedFeesList.length})
                </button>
              </div>
            )}

            {/* Invoices List / Table */}
            {(() => {
              const displayedOverviewFees = fees.filter(f => {
                const isPastDue = f.status === 'Overdue' || (f.status === 'Pending' && f.dueDate < todayStr);
                const isPendingActive = f.status === 'Pending' && f.dueDate >= todayStr;
                const isSubmitted = f.status === 'Payment Submitted';
                if (overviewFeeFilter === 'submitted') return isSubmitted;
                if (overviewFeeFilter === 'overdue') return isPastDue && f.status !== 'Paid';
                if (overviewFeeFilter === 'pending') return isPendingActive;
                return (isPastDue || isPendingActive || isSubmitted) && f.status !== 'Paid';
              }).slice(0, 8);

              if (displayedOverviewFees.length === 0) {
                return (
                  <div className="p-8 text-center bg-white space-y-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#2D8B5C] flex items-center justify-center mx-auto">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <h4 className="text-xs font-bold text-[#161F1A]">All Tuition Fees Up to Date!</h4>
                    <p className="text-xs text-[#5A6B61] max-w-sm mx-auto">
                      No invoices currently require urgent settlement. You can generate new monthly invoices from the Fees tab.
                    </p>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF9F7] border-b border-[#EDEAE3] text-[#5A6B61] font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2.5 px-4">Invoice #</th>
                        <th className="py-2.5 px-4">Student & Family</th>
                        <th className="py-2.5 px-4">Parent Contact</th>
                        <th className="py-2.5 px-4">Billing Period</th>
                        <th className="py-2.5 px-4">Amount Due</th>
                        <th className="py-2.5 px-4">Due Date</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">Instant Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDEAE3]">
                      {displayedOverviewFees.map(f => {
                        const isPastDue = f.status === 'Overdue' || (f.status === 'Pending' && f.dueDate < todayStr);

                        return (
                          <tr
                            key={f.id}
                            className={`hover:bg-[#FAF9F7]/80 transition-colors ${
                              isPastDue ? 'bg-rose-50/20 border-l-4 border-l-rose-500' : ''
                            }`}
                          >
                            <td className="py-3 px-4 font-mono font-bold text-[#161F1A]">
                              <div className="flex flex-col items-start gap-1">
                                <span>{f.invoiceNumber}</span>
                                {f.isFamilyInvoice && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                    <Users className="w-2.5 h-2.5" />
                                    <span>Family Combined</span>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-[#161F1A] block">
                                {f.isFamilyInvoice ? (f.familyGroupName || f.studentName) : f.studentName}
                              </span>
                              <span className="text-[10px] font-mono text-[#5A6B61]">{f.studentId}</span>
                              {f.isFamilyInvoice && f.siblingBreakdown && f.siblingBreakdown.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {f.siblingBreakdown.map((s, idx) => (
                                    <span key={idx} className="text-[9px] bg-gray-100 text-gray-700 px-1.5 py-0.2 rounded">
                                      {s.studentName} ({getCurrencySymbol(f.currency)}{s.amount})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-medium text-[#161F1A] block">{f.parentName || 'N/A'}</span>
                              <span className="text-[11px] text-[#5A6B61]">{f.parentPhone || f.parentEmail}</span>
                            </td>
                            <td className="py-3 px-4 text-[#5A6B61]">{f.billingPeriod}</td>
                            <td className="py-3 px-4 font-mono font-bold text-sm text-[#161F1A]">
                              {getCurrencySymbol(f.currency)}{f.amount.toLocaleString()}
                              {f.discount ? (
                                <span className="text-[9px] text-green-700 block">
                                  (-{getCurrencySymbol(f.currency)}{f.discount} disc)
                                </span>
                              ) : null}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`text-xs font-mono font-bold ${
                                isPastDue ? 'text-rose-700' : 'text-[#5A6B61]'
                              }`}>
                                {f.dueDate}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {f.status === 'Payment Submitted' ? (
                                <div className="space-y-1">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300 inline-flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-purple-700 animate-pulse" />
                                    Notice Submitted
                                  </span>
                                  <span className="text-[10px] font-semibold text-purple-900 block">
                                    {f.paymentMethod || 'Bank Transfer'}
                                    {f.paymentReference ? ` • ${f.paymentReference}` : ''}
                                  </span>
                                  {f.paymentMtcnNumber && (
                                    <span className="inline-block text-[10px] font-mono font-bold text-amber-900 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                                      MTCN: {f.paymentMtcnNumber}
                                    </span>
                                  )}
                                  {f.receiptImage && (
                                    <div>
                                      <button
                                        type="button"
                                        onClick={() => setViewingReceiptFee(f)}
                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300 transition-colors cursor-pointer"
                                        title="View attached WebP receipt"
                                      >
                                        <FileImage className="w-3 h-3 text-[#2D8B5C]" />
                                        <span>Receipt Slip ({f.receiptCompressedSizeKB ? `${f.receiptCompressedSizeKB} KB` : 'WebP'})</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : isPastDue ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" /> Overdue
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right space-x-1.5">
                              {f.status === 'Payment Submitted' ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await updateFee(f.id, {
                                        status: 'Paid',
                                        paymentDate: f.paymentDate || todayStr,
                                        paymentMethod: f.paymentMethod || 'Bank Transfer (Admin Confirmed)',
                                        adminConfirmedAt: new Date().toISOString(),
                                        adminConfirmedBy: userProfile?.displayName || 'Admin'
                                      });
                                      if (onRefreshData) {
                                        await onRefreshData();
                                      }
                                    }}
                                    className="px-2.5 py-1 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-md transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1"
                                    title="Verify bank deposit and confirm fee as officially Paid"
                                  >
                                    <CheckCircle className="w-3 h-3" />
                                    Confirm Received
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (confirm(`Decline payment notice for ${f.studentName}? This reverts the invoice back to Pending status.`)) {
                                        await updateFee(f.id, {
                                          status: 'Pending',
                                          paymentProofNote: 'Payment notice declined: funds not found in bank account.'
                                        });
                                        if (onRefreshData) {
                                          await onRefreshData();
                                        }
                                      }
                                    }}
                                    className="px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors cursor-pointer"
                                    title="Decline notice if funds were not received"
                                  >
                                    Decline
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleQuickMarkPaid(f)}
                                  className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
                                  title="Mark as Paid immediately"
                                >
                                  Mark Paid
                                </button>
                              )}

                              {/* In-App Fee Receipt */}
                              <button
                                type="button"
                                onClick={() => setViewingReceiptFee(f)}
                                className="px-2 py-1 text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer inline-flex items-center gap-1"
                                title="Open Official In-App Fee Receipt"
                              >
                                <Receipt className="w-3 h-3 text-emerald-700" />
                                Receipt
                              </button>

                              {/* PDF Invoice Download */}
                              <button
                                type="button"
                                onClick={() => generateInvoicePDF(f)}
                                className="px-2 py-1 text-xs font-semibold bg-[#2D8B5C]/10 text-[#2D8B5C] hover:bg-[#2D8B5C]/20 rounded-md transition-colors cursor-pointer"
                                title="Download PDF Invoice / Receipt"
                              >
                                PDF
                              </button>

                              {/* WhatsApp Direct Reminder */}
                              <button
                                type="button"
                                onClick={() => handleSendWhatsAppFeeReminder(f)}
                                className="px-2 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                title="Open WhatsApp with customized fee reminder text"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>WhatsApp</span>
                              </button>

                              {/* Copy Reminder Text */}
                              <button
                                type="button"
                                onClick={() => handleCopyPaymentReminder(f)}
                                className="px-2 py-1 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors cursor-pointer"
                                title="Copy Payment Reminder Text for WhatsApp / SMS"
                              >
                                {copiedReminderId === f.id ? (
                                  <span className="text-emerald-700 font-bold">Copied!</span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <Copy className="w-3 h-3" /> Copy
                                  </span>
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>

          {/* SECTION 2: ACTIVE PROSPECTIVE TRIALS PIPELINE COMMAND CENTER */}
          <div className="bg-white rounded-xl border border-[#E3DFD7] shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-[#EDEAE3] bg-gradient-to-r from-amber-50/40 via-emerald-50/20 to-white flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-[#C98A1E]" />
                  <h3 className="text-sm font-bold text-[#161F1A]">Prospective Trials Pipeline (Day 1 & Follow-ups)</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    {trialStudentsList.length} Active Trials
                  </span>
                </div>
                <p className="text-xs text-[#5A6B61] mt-0.5">
                  Track 5-session milestones, dispatch automated parent SMS reminders, and log conversion outcomes.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                {/* Filter Pills */}
                <div className="inline-flex rounded-lg border border-[#D5D0C6] p-0.5 bg-white text-xs">
                  <button
                    type="button"
                    onClick={() => setOverviewTrialFilter('all')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      overviewTrialFilter === 'all'
                        ? 'bg-[#2D8B5C] text-white shadow-2xs'
                        : 'text-[#5A6B61] hover:text-[#161F1A]'
                    }`}
                  >
                    All ({trialStudentsList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverviewTrialFilter('day1')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      overviewTrialFilter === 'day1'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-blue-700 hover:bg-blue-50'
                    }`}
                  >
                    Day 1 ({day1TrialsList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverviewTrialFilter('followup')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      overviewTrialFilter === 'followup'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'text-amber-700 hover:bg-amber-50'
                    }`}
                  >
                    Follow-up ({followUpTrialsList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverviewTrialFilter('decision')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      overviewTrialFilter === 'decision'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'text-purple-700 hover:bg-purple-50'
                    }`}
                  >
                    Decision Ready ({decisionPendingTrials.length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentTab('trials')}
                  className="px-3 py-1.5 bg-[#FAF9F7] border border-[#D5D0C6] hover:bg-gray-100 text-[#161F1A] text-xs font-semibold rounded-lg flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  <span>Open All Trials</span>
                  <ArrowRight className="w-3 h-3 text-[#2D8B5C]" />
                </button>
              </div>
            </div>

            {/* Trial Cards Grid */}
            {(() => {
              const displayedOverviewTrials = trialStudentsList.filter(s => {
                if (overviewTrialFilter === 'day1') return s.trialStatus === 'Day 1' || (s.trialSessionsCompleted || 0) <= 1;
                if (overviewTrialFilter === 'followup') return s.trialStatus === 'Follow-up' || s.trialStatus === 'Interested' || s.trialStatus === 'Pending Call';
                if (overviewTrialFilter === 'decision') return (s.trialSessionsCompleted || 0) >= 5;
                return true;
              }).slice(0, 4);

              if (displayedOverviewTrials.length === 0) {
                return (
                  <div className="p-8 text-center bg-white space-y-2">
                    <p className="text-xs text-[#5A6B61]">No prospective trials in this stage filter.</p>
                  </div>
                );
              }

              return (
                <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {displayedOverviewTrials.map(st => {
                    const sessionsDone = st.trialSessionsCompleted || 0;
                    const maxSessions = 5;
                    const pct = Math.min(100, Math.round((sessionsDone / maxSessions) * 100));

                    return (
                      <div
                        key={st.id}
                        className="bg-[#FAF9F7] p-4 rounded-xl border border-[#E3DFD7] hover:border-[#2D8B5C]/40 transition-all space-y-3 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="font-bold text-sm text-[#161F1A]">{st.name}</h4>
                              <span className="font-mono text-[10px] text-[#5A6B61]">({st.studentId})</span>
                            </div>
                            <p className="text-xs text-[#5A6B61] mt-0.5">
                              {st.courseType} • Assigned: <strong className="text-[#2D8B5C]">{st.assignedTutorId || 'Unassigned'}</strong>
                            </p>
                          </div>

                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            st.trialStatus === 'Day 1' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                            st.trialStatus === 'Follow-up' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                            st.trialStatus === 'Interested' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                            st.trialStatus === 'Pending Call' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                            sessionsDone >= 5 ? 'bg-purple-100 text-purple-800 border-purple-200' :
                            'bg-gray-100 text-gray-800 border-gray-200'
                          }`}>
                            {st.trialStatus || (sessionsDone >= 5 ? 'Decision Pending' : 'Day 1')}
                          </span>
                        </div>

                        {/* 5-Session Visual Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#5A6B61]">Trial Sessions:</span>
                            <span className="font-mono font-bold text-[#161F1A]">{sessionsDone} / {maxSessions}</span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                sessionsDone >= 5 ? 'bg-purple-600' : 'bg-[#2D8B5C]'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {/* Contact details */}
                        <div className="text-[11px] text-[#5A6B61] flex items-center justify-between pt-1 border-t border-[#EAE6DE]">
                          <span>Parent: <strong className="text-[#161F1A]">{st.parentName || 'N/A'}</strong></span>
                          <span>{st.parentPhone || st.parentEmail || 'No contact'}</span>
                        </div>

                        {/* Quick Actions Footer */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex items-center space-x-1.5">
                            {/* SMS Reminder */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTrialStudent(st);
                                setIsTrialSmsModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-white border border-[#D5D0C6] hover:bg-emerald-50 text-[#1E5C3D] rounded-md text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
                              title="Send WhatsApp / SMS Reminder"
                            >
                              <Send className="w-3 h-3 text-[#2D8B5C]" />
                              <span>SMS Reminder</span>
                            </button>

                            {/* Quick Stage Advance */}
                            <select
                              value={st.trialStatus || 'Day 1'}
                              onChange={(e) => handleQuickTrialStatusChange(st, e.target.value)}
                              className="bg-white border border-[#D5D0C6] rounded-md text-[11px] px-2 py-1 font-medium cursor-pointer"
                            >
                              <option value="Day 1">Day 1</option>
                              <option value="Follow-up">Follow-up</option>
                              <option value="Interested">Interested</option>
                              <option value="Pending Call">Pending Call</option>
                            </select>
                          </div>

                          {/* Convert to Enrolled */}
                          <button
                            type="button"
                            onClick={() => handleQuickTrialStatusChange(st, 'Converted')}
                            className="px-3 py-1 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-md text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer shadow-2xs"
                            title="Convert into regular enrolled active student"
                          >
                            <CheckCircle className="w-3 h-3" />
                            <span>Enroll Student</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* SECTION 3: TODAY'S LIVE CLASSES AGENDA (REPLACES MASSIVE TIMETABLE GRID) */}
          <div className="bg-white rounded-xl border border-[#E3DFD7] shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-[#EDEAE3] bg-gradient-to-r from-emerald-50/50 via-[#FAF9F7] to-white flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-[#2D8B5C]" />
                  <h3 className="text-sm font-bold text-[#161F1A]">
                    Today's Live Classes & Teaching Agenda ({currentTeachingDay})
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2D8B5C]/10 text-[#1E5C3D] border border-[#2D8B5C]/20">
                    {todayClassesList.length} Sessions Today
                  </span>
                </div>
                <p className="text-xs text-[#5A6B61] mt-0.5">
                  Real-time operational agenda calibrated in Asia/Karachi (PKT). Access live classes, student timezone conversions, and lesson reporting.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSlot({ day: currentTeachingDay, time: '05:00' });
                    setSelectedClass(null);
                    setIsClassModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-[#2D8B5C] text-white text-xs font-semibold rounded-lg hover:bg-[#1E5C3D] flex items-center space-x-1 transition-colors cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Schedule Class</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentTab('timetable')}
                  className="px-3.5 py-1.5 bg-white border border-[#D5D0C6] text-[#161F1A] text-xs font-semibold rounded-lg hover:bg-gray-50 flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  <span>Open 7-Day Master Timetable</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#2D8B5C]" />
                </button>
              </div>
            </div>

            {/* Today's Classes List */}
            {todayClassesList.length === 0 ? (
              <div className="p-8 text-center bg-white space-y-2">
                <Calendar className="w-8 h-8 text-gray-300 mx-auto" />
                <h4 className="text-xs font-bold text-[#161F1A]">No Classes Scheduled For Today ({currentTeachingDay})</h4>
                <p className="text-xs text-[#5A6B61] max-w-sm mx-auto">
                  There are no operational slots booked for today. You can review the full 7-day schedule or schedule a new class.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#EDEAE3] max-h-96 overflow-y-auto">
                {todayClassesList.map(cls => {
                  const matchingStudent = students.find(s => s.studentId === cls.studentId);
                  const isTrial = matchingStudent?.status === 'Trial' || cls.status === 'Trial';
                  const studentTime = matchingStudent?.timezone
                    ? convertPKTToStudentTime(currentTeachingDay, cls.startTimePKT, matchingStudent.timezone)
                    : null;

                  return (
                    <div
                      key={cls.id}
                      className="p-3.5 sm:px-5 hover:bg-[#FAF9F7] transition-colors flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      {/* Left: Time & Student */}
                      <div className="flex items-center space-x-3 min-w-[220px]">
                        <div className="w-18 shrink-0 text-center py-1.5 px-2 rounded-lg bg-[#FAF9F7] border border-[#E3DFD7]">
                          <span className="font-mono font-bold text-xs text-[#161F1A] block">{cls.startTimePKT}</span>
                          <span className="text-[9px] text-[#5A6B61] font-mono">PKT</span>
                        </div>

                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm text-[#161F1A]">{cls.studentName}</span>
                            <span className="font-mono text-[10px] text-[#5A6B61]">({cls.studentId})</span>
                            {isTrial && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                Trial
                              </span>
                            )}
                            {matchingStudent?.isOnLeave && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-0.5" title={`On leave until ${matchingStudent.leaveEndDate || 'specified date'}`}>
                                <Palmtree className="w-2.5 h-2.5" /> On Leave
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#5A6B61] mt-0.5 flex items-center gap-2">
                            <span>Course: {matchingStudent?.courseType || 'Quran'}</span>
                            {studentTime && (
                              <>
                                <span>•</span>
                                <span className="text-[#2D8B5C] font-mono">
                                  Student Time: {studentTime.localTime} ({getTimezoneShortCode(matchingStudent?.timezone || '')})
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Middle: Tutor Tag & Status */}
                      <div className="flex items-center space-x-2">
                        <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-900">
                          {cls.tutorId}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          cls.status === 'Cancelled' ? 'bg-rose-100 text-rose-800' :
                          cls.status === 'Completed' ? 'bg-blue-100 text-blue-800' :
                          cls.status === 'Student on Leave' ? 'bg-indigo-100 text-indigo-800' :
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          {cls.status}
                        </span>
                      </div>

                      {/* Right: Quick Operational Actions */}
                      <div className="flex items-center space-x-2">
                        {/* Zoom Live Meeting Button */}
                        <a
                          href={tutors.find(t => t.tutorId === cls.tutorId)?.zoomLink || 'https://zoom.us'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-md text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
                          title={`Join ${cls.tutorId} Classroom (${tutors.find(t => t.tutorId === cls.tutorId)?.zoomLink || 'https://zoom.us'})`}
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>Join Classroom</span>
                        </a>

                        {/* Log Lesson Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudentForLesson(cls.studentId);
                            setIsLessonModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-white border border-[#D5D0C6] hover:bg-gray-50 text-[#161F1A] rounded-md text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
                          title="Log Lesson Recitation & Progress"
                        >
                          <BookOpen className="w-3 h-3 text-[#E8A93E]" />
                          <span>Log Lesson</span>
                        </button>

                        {/* Edit Class */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedClass(cls);
                            setIsClassModalOpen(true);
                          }}
                          className="px-2 py-1 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                          title="Edit Class Details"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Lessons & Staff Attendance Snapshot */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Lessons */}
            <div className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#161F1A] uppercase tracking-wider">Recent Lesson Reports</h4>
                <button
                  onClick={() => setCurrentTab('lessons')}
                  className="text-xs text-[#2D8B5C] font-semibold hover:underline"
                >
                  View All ({lessons.length})
                </button>
              </div>
              <div className="space-y-2.5">
                {lessons.slice(0, 4).map((l) => (
                  <div key={l.id} className="p-3 rounded-lg border border-[#EAE6DE] bg-[#FAF9F7] text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#161F1A]">{l.studentName} ({l.studentId})</span>
                      <span className="font-medium text-[#2D8B5C]">{l.tutorId}</span>
                    </div>
                    <p className="text-[11px] text-[#5A6B61] mt-0.5">{l.lessonCovered}</p>
                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#E3DFD7] text-[10px] text-[#5A6B61]">
                      <span>{l.date}</span>
                      <span className="font-semibold text-emerald-700">{l.performance}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tutor Punctuality Snapshot */}
            <div className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#161F1A] uppercase tracking-wider">Tutor Login & Punctuality</h4>
                <span className="text-[11px] text-[#5A6B61]">Recorded automatically</span>
              </div>
              <div className="space-y-2.5">
                {tutorAttendance.map((ta) => (
                  <div key={ta.id} className="p-3 rounded-lg border border-[#EAE6DE] flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#161F1A]">{ta.tutorId} - {ta.tutorName}</span>
                      <p className="text-[11px] text-[#5A6B61]">{ta.notes}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        ta.status === 'On Time' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {ta.status} {ta.lateDurationMinutes > 0 ? `(${ta.lateDurationMinutes}m late)` : ''}
                      </span>
                      <p className="text-[10px] text-[#5A6B61] mt-0.5 font-mono">{ta.loginTime} PKT</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. TIMETABLE TAB */}
      {currentTab === 'timetable' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#161F1A]">
                Academy Master Timetable
              </h3>
              <p className="text-xs text-[#5A6B61]">
                Authoritative schedule calibrated in Asia/Karachi (PKT). Double-booking conflicts are automatically blocked.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center px-2.5 py-1.5 border border-[#EDEAE3] bg-[#FAF9F7] text-xs font-semibold text-[#5A6B61] rounded-lg">
                👥 All Tutors Combined
              </span>

              <button
                id="add_class_button"
                onClick={() => {
                  setSelectedClass(null);
                  setIsClassModalOpen(true);
                }}
                className="px-4 py-1.5 bg-[#2D8B5C] text-white text-xs font-semibold rounded-lg hover:bg-[#1E5C3D] flex items-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Schedule New Class</span>
              </button>
            </div>
          </div>

          {/* Individual Tutor Snapshot when a specific tutor is selected */}
          {tutorFilter !== 'all' && (() => {
            const indTutor = tutors.find(t => t.tutorId === tutorFilter);
            const indClasses = classes.filter(c => c.tutorId === tutorFilter);
            const indStudents = students.filter(s => s.assignedTutorId === tutorFilter);
            return (
              <div className="bg-white p-4 rounded-xl border border-[#E3DFD7] shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-[#2D8B5C]/10 text-[#2D8B5C] flex items-center justify-center font-bold">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#161F1A] text-sm">{indTutor?.realName} ({indTutor?.tutorId})</h4>
                    <p className="text-[#5A6B61] text-[11px]">{indTutor?.email} • {indTutor?.phone}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-[#5A6B61]">Assigned Students: <strong className="text-[#161F1A]">{indStudents.length}</strong></span>
                  <span className="text-[#5A6B61]">Weekly Classes: <strong className="text-[#2D8B5C]">{indClasses.length}</strong></span>
                  <a
                    href={indTutor?.zoomLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-[#FAF9F7] border border-[#D5D0C6] rounded-md text-[#2D8B5C] font-mono hover:bg-emerald-50"
                  >
                    Zoom Classroom ↗
                  </a>
                </div>
              </div>
            );
          })()}

          <TimetableGrid
            key={tutorFilter}
            classes={filteredClasses}
            role="admin"
            currentTutorId={tutorFilter === 'all' ? undefined : tutorFilter}
            onTutorFilterChange={setTutorFilter}
            students={students}
            tutors={tutors}
            onAddClass={(slot) => {
              setSelectedSlot(slot);
              setSelectedClass(null);
              setIsClassModalOpen(true);
            }}
            onEditClass={(cls) => {
              setSelectedClass(cls);
              setIsClassModalOpen(true);
            }}
            onDeleteClass={handleDeleteClass}
            onCancelClass={handleCancelClass}
            onLogLesson={(studentId) => {
              setSelectedStudentForLesson(studentId);
              setIsLessonModalOpen(true);
            }}
          />
        </div>
      )}

      {/* 3. STUDENTS TAB */}
      {currentTab === 'students' && (
        <div className="space-y-4">
          {inspectedStudent ? (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#E3DFD7] pb-4">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      setInspectedStudent(null);
                      setEditingLesson(null);
                    }}
                    className="p-1.5 rounded-lg border border-[#E3DFD7] bg-white text-[#5A6B61] hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-extrabold text-[#161F1A]">{inspectedStudent.name}</h3>
                      <span className="text-xs font-mono font-bold bg-[#2D8B5C]/10 text-[#1E5C3D] px-2 py-0.5 rounded border border-[#2D8B5C]/20">
                        {inspectedStudent.studentId}
                      </span>
                    </div>
                    <p className="text-xs text-[#5A6B61]">
                      Detailed Academic Ledger, Lesson Progression, and Performance Summary.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedStudent(inspectedStudent);
                    setIsStudentModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-white border border-[#D5D0C6] text-[#161F1A] text-xs font-bold rounded-lg hover:bg-gray-50 flex items-center space-x-1.5 shadow-2xs"
                >
                  <span>Edit Registry Profile</span>
                </button>
              </div>

              {/* Bento-style Profile Info Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-[#E3DFD7] space-y-1">
                  <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Course Enrolled</span>
                  <p className="text-xs font-extrabold text-[#161F1A]">{inspectedStudent.courseType}</p>
                  <p className="text-[11px] text-[#2D8B5C] font-semibold">Tutor ID: {inspectedStudent.assignedTutorId}</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[#E3DFD7] space-y-1">
                  <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Parent & Contacts</span>
                  <p className="text-xs font-bold text-[#161F1A] truncate">{inspectedStudent.parentName || 'N/A'}</p>
                  <p className="text-[10px] text-[#5A6B61] font-mono truncate">{inspectedStudent.parentPhone || inspectedStudent.parentEmail || inspectedStudent.phone || 'No phone'}</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[#E3DFD7] space-y-1">
                  <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Academy Status</span>
                  <div className="pt-0.5">
                    {inspectedStudent.status === 'Trial' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF9ED] text-[#8C5D08] border border-[#E8A93E]/40 inline-flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Trial ({inspectedStudent.trialSessionsCompleted || 0}/5)
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        inspectedStudent.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {inspectedStudent.status}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#5A6B61] font-mono mt-1">Country: {inspectedStudent.country}</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[#E3DFD7] space-y-1">
                  <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Financial & Timezone</span>
                  <p className="text-xs font-extrabold text-[#1E5C3D]">
                    {inspectedStudent.monthlyFee ? `${getCurrencySymbol(inspectedStudent.feeCurrency)}${inspectedStudent.monthlyFee.toLocaleString()}/mo` : 'Free/Unspecified'}
                  </p>
                  <p className="text-[10px] text-[#5A6B61] truncate font-mono">Timezone: {getTimezoneShortCode(inspectedStudent.timezone)}</p>
                </div>
              </div>

              {/* Tab Selector inside Detail view */}
              {true ? (
                /* Lesson Reports Ledger */
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-[#E3DFD7] pb-2">
                    <h4 className="text-sm font-bold text-[#161F1A] flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-[#2D8B5C]" />
                      Academic Lessons & Report History ({lessons.filter(l => l.studentId === inspectedStudent.studentId).length})
                    </h4>
                    <button
                      onClick={() => {
                        setSelectedStudentForLesson(inspectedStudent.studentId);
                        setIsLessonModalOpen(true);
                      }}
                      className="px-3 py-1 bg-[#2D8B5C] text-white text-xs font-bold rounded-lg hover:bg-[#1E5C3D] flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Record Lesson</span>
                    </button>
                  </div>

                  {lessons.filter(l => l.studentId === inspectedStudent.studentId).length === 0 ? (
                    <div className="py-12 text-center text-xs text-[#5A6B61] italic bg-white rounded-xl border border-dashed border-[#E3DFD7] p-6 space-y-2">
                      <Folder className="w-8 h-8 mx-auto text-[#D5D0C6]" />
                      <p>No lesson reports have been compiled yet for this student.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                    {lessons
                      .filter(l => l.studentId === inspectedStudent.studentId)
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((lesson) => {
                        const isEditing = editingLesson?.id === lesson.id;
                        return (
                          <div key={lesson.id} className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs space-y-3">
                            {/* Lesson Entry Header */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <span className="text-[10px] font-bold text-[#2D8B5C] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-wider">
                                  {lesson.lessonType}
                                </span>
                                <h5 className="text-xs font-bold text-[#161F1A] mt-1.5">
                                  Conducted by <strong>{lesson.tutorId}</strong> on {lesson.date} ({lesson.month})
                                </h5>
                              </div>

                              <div className="flex items-center space-x-2">
                                {lesson.performance && (
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${
                                    lesson.performance === 'Excellent' ? 'bg-emerald-100 text-emerald-800' :
                                    lesson.performance === 'Good' ? 'bg-emerald-50 text-emerald-700' :
                                    lesson.performance === 'Satisfactory' ? 'bg-blue-50 text-blue-800' :
                                    lesson.performance === 'Average' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                    {lesson.performance}
                                  </span>
                                )}

                                 <button
                                  onClick={() => generateLessonReportPDF(lesson)}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-[#161F1A] bg-[#FAF9F7] border border-[#D5D0C6] rounded hover:bg-gray-100 flex items-center space-x-1"
                                >
                                  <Download className="w-3.5 h-3.5 text-[#2D8B5C]" />
                                  <span>PDF</span>
                                </button>

                                <button
                                  onClick={() => {
                                    if (isEditing) {
                                      setEditingLesson(null);
                                    } else {
                                      setEditingLesson(lesson);
                                      setEditLessonCovered(lesson.lessonCovered || '');
                                      setEditLessonRevision(lesson.revision || '');
                                      setEditLessonHomework(lesson.homework || '');
                                      setEditLessonRemarks(lesson.teacherRemarks || '');
                                      setEditLessonPerformance(lesson.performance || '');
                                      setEditLessonScreenshots(lesson.screenshots || []);
                                    }
                                  }}
                                  className={`px-2.5 py-1 text-[11px] font-bold rounded border transition-all ${
                                    isEditing
                                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                                      : 'bg-[#2D8B5C]/10 text-[#1E5C3D] border-[#2D8B5C]/20 hover:bg-[#2D8B5C]/20'
                                  }`}
                                >
                                  {isEditing ? 'Cancel' : 'Edit Report'}
                                </button>

                                <button
                                  onClick={() => handleDeleteLessonReport(lesson.id)}
                                  className="px-2.5 py-1 text-[11px] font-extrabold text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 flex items-center space-x-1 cursor-pointer transition-colors"
                                  title="Permanently delete this entire lesson report"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </div>

                            {/* Edit Form Mode */}
                            {isEditing ? (
                              <form onSubmit={handleUpdateLessonReport} className="p-4 bg-amber-50/20 border border-amber-200/50 rounded-xl space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div>
                                    <label className="block text-[10px] font-bold text-[#5A6B61] uppercase mb-1">Lesson Covered</label>
                                    <input
                                      type="text"
                                      value={editLessonCovered}
                                      onChange={(e) => setEditLessonCovered(e.target.value)}
                                      className="w-full text-xs border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
                                      required
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-bold text-[#5A6B61] uppercase mb-1">Revision (Sabaq / Sabqi)</label>
                                    <input
                                      type="text"
                                      value={editLessonRevision}
                                      onChange={(e) => setEditLessonRevision(e.target.value)}
                                      className="w-full text-xs border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-bold text-[#5A6B61] uppercase mb-1">Performance Status</label>
                                    <select
                                      value={editLessonPerformance}
                                      onChange={(e) => setEditLessonPerformance(e.target.value)}
                                      className="w-full text-xs border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
                                    >
                                      <option value="Excellent">Excellent</option>
                                      <option value="Good">Good</option>
                                      <option value="Average">Average</option>
                                      <option value="Weak">Weak</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-[10px] font-bold text-[#5A6B61] uppercase mb-1">Homework</label>
                                    <input
                                      type="text"
                                      value={editLessonHomework}
                                      onChange={(e) => setEditLessonHomework(e.target.value)}
                                      className="w-full text-xs border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-bold text-[#5A6B61] uppercase mb-1">Teacher Remarks</label>
                                    <input
                                      type="text"
                                      value={editLessonRemarks}
                                      onChange={(e) => setEditLessonRemarks(e.target.value)}
                                      className="w-full text-xs border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1.5 p-3.5 bg-[#FAF9F7] rounded-lg border border-[#E3DFD7]">
                                  <label className="block text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider">
                                    Manage Lesson Screenshots ({editLessonScreenshots.length})
                                  </label>
                                  {editLessonScreenshots.length === 0 ? (
                                    <p className="text-[11px] text-[#5A6B61] italic">No screenshots attached.</p>
                                  ) : (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                      {editLessonScreenshots.map((scr, idx) => (
                                        <div key={idx} className="relative group w-16 h-12 rounded-lg overflow-hidden border border-[#D5D0C6] bg-gray-50">
                                          <img src={scr.url} alt={scr.name} className="object-cover w-full h-full" referrerPolicy="no-referrer" />
                                          <button
                                            type="button"
                                            onClick={() => setEditLessonScreenshots(prev => prev.filter((_, i) => i !== idx))}
                                            className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] hover:bg-red-800 cursor-pointer shadow-xs font-bold"
                                            title="Delete this screenshot"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <p className="text-[10px] text-[#5A6B61] pt-1">
                                    Click "✕" on any image to permanently remove incorrect screenshot entries before saving.
                                  </p>
                                </div>

                                <div className="flex justify-end space-x-2 pt-2 border-t border-amber-200/30">
                                  <button
                                    type="submit"
                                    disabled={isUpdatingLesson}
                                    className="px-4 py-1.5 bg-[#2D8B5C] text-white text-xs font-bold rounded-lg hover:bg-[#1E5C3D]"
                                  >
                                    {isUpdatingLesson ? 'Saving...' : 'Save Report Update'}
                                  </button>
                                </div>
                              </form>
                            ) : (
                              /* Standard View Mode */
                              <>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-[#FAF9F7] p-3 rounded-lg border border-[#E3DFD7]">
                                  <div>
                                    <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Lesson Covered</span>
                                    <p className="font-semibold text-[#161F1A] mt-0.5">{lesson.lessonCovered}</p>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Revision (Sabaq)</span>
                                    <p className="font-semibold text-[#161F1A] mt-0.5">{lesson.revision || 'None'}</p>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Homework</span>
                                    <p className="font-semibold text-[#161F1A] mt-0.5">{lesson.homework || 'Review daily'}</p>
                                  </div>
                                </div>

                                {lesson.teacherRemarks && (
                                  <p className="text-xs text-[#5A6B61] italic">
                                    <strong>Teacher Remarks:</strong> {lesson.teacherRemarks}
                                  </p>
                                )}

                                {/* Screenshots */}
                                {lesson.screenshots && lesson.screenshots.length > 0 && (
                                  <div className="flex gap-2.5 pt-2 border-t border-dashed border-[#E3DFD7]">
                                    {lesson.screenshots.map((scr, idx) => (
                                      !scr.url ? null : (
                                        <div
                                          key={idx}
                                          onClick={() => setActivePreviewImage(scr.url)}
                                          className="relative rounded-lg overflow-hidden border border-[#D5D0C6] hover:border-[#2D8B5C] bg-[#FAF9F7] w-16 h-12 cursor-zoom-in transition-all"
                                        >
                                          <img src={scr.url} alt={scr.name} referrerPolicy="no-referrer" className="object-cover w-full h-full" />
                                        </div>
                                      )
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
              ) : null}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#161F1A]">Students Registry</h3>
                  <p className="text-xs text-[#5A6B61]">
                    Complete directory of registered students, parents, timezones, and assigned tutors.
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setIsBulkImportModalOpen(true)}
                    className="px-4 py-1.5 bg-white border border-[#D5D0C6] text-[#161F1A] text-xs font-semibold rounded-lg hover:bg-gray-50 flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-[#2D8B5C]" />
                    <span>Bulk Student Importer</span>
                  </button>
                  <button
                    id="register_student_button"
                    onClick={() => {
                      setSelectedStudent(null);
                      setIsStudentModalOpen(true);
                    }}
                    className="px-4 py-1.5 bg-[#2D8B5C] text-white text-xs font-semibold rounded-lg hover:bg-[#1E5C3D] flex items-center space-x-1.5 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Student</span>
                  </button>
                </div>
              </div>

              {/* Filters Bar */}
              <div className="p-3.5 bg-white border border-[#E3DFD7] rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2 flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-[#5A6B61]" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search students by name or Student ID..."
                    className="w-full border-none focus:outline-none text-xs"
                  />
                </div>
                  <div className="flex items-center space-x-3">
                  <label className="text-[#5A6B61] font-medium">Status Filter:</label>
                  <select
                    value={studentStatusFilter}
                    onChange={(e) => setStudentStatusFilter(e.target.value)}
                    className="border border-[#D5D0C6] rounded-md px-2.5 py-1 text-xs bg-white"
                  >
                    <option value="all">All Statuses ({students.length})</option>
                    <option value="on_leave">🏖️ On Leave ({students.filter(s => s.isOnLeave).length})</option>
                    <option value="Trial">Trial</option>
                    <option value="Active">Active</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>

              {/* Students Table */}
              <div className="bg-white border border-[#E3DFD7] rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF9F7] border-b border-[#E3DFD7] text-[#5A6B61] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Student ID</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Course</th>
                      <th className="py-3 px-4">Assigned Tutor</th>
                      <th className="py-3 px-4">Parent Details</th>
                      <th className="py-3 px-4">Tuition Fee</th>
                      <th className="py-3 px-4">Timezone</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE6DE]">
                    {students
                      .filter(s => {
                        const matchSearch = s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                          s.studentId.toLowerCase().includes(studentSearch.toLowerCase()) ||
                          s.parentName?.toLowerCase().includes(studentSearch.toLowerCase());
                        const matchStatus = studentStatusFilter === 'all'
                          ? true
                          : studentStatusFilter === 'on_leave'
                          ? Boolean(s.isOnLeave)
                          : s.status === studentStatusFilter;
                        return matchSearch && matchStatus;
                      })
                      .map(st => (
                        <tr key={st.id} className="hover:bg-[#FAF9F7]/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-[#161F1A]">
                            <button
                              onClick={() => openStudent360(st)}
                              className="font-mono font-bold text-[#2D8B5C] hover:underline cursor-pointer text-xs"
                              title="Click to view Student File & Record"
                            >
                              {st.studentId}
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => openStudent360(st)}
                              className="font-bold text-[#161F1A] hover:text-[#2D8B5C] text-left block cursor-pointer"
                              title="Click to view Student File & Record"
                            >
                              {st.name}
                            </button>
                            <span className="text-[11px] text-[#5A6B61]">{st.email}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              {st.status === 'Trial' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF9ED] text-[#8C5D08] border border-[#E8A93E]/40 flex items-center w-max gap-1">
                                  <Sparkles className="w-3 h-3" /> Trial ({st.trialSessionsCompleted || 0}/5)
                                </span>
                              ) : (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  st.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {st.status}
                                </span>
                              )}
                              {st.isOnLeave && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center w-max gap-1" title={`${st.leaveReason || 'On leave'} (${st.leaveStartDate || ''} to ${st.leaveEndDate || 'indefinite'})`}>
                                  <Palmtree className="w-2.5 h-2.5 text-amber-700" />
                                  On Leave
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-medium text-[#161F1A]">{st.courseType}</td>
                          <td className="py-3 px-4 font-semibold text-[#2D8B5C]">{st.assignedTutorId}</td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-[#161F1A] block">{st.parentName || 'N/A'}</span>
                            <span className="text-[11px] text-[#5A6B61]">{st.parentPhone || st.parentEmail}</span>
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-[#161F1A]">
                            {st.monthlyFee ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-bold">
                                {getCurrencySymbol(st.feeCurrency)}{st.monthlyFee.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-gray-400 font-normal">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[#5A6B61]">
                            <span className="font-mono text-xs font-semibold text-[#161F1A]" title={st.timezone}>
                              {getTimezoneShortCode(st.timezone)}
                            </span>
                            <span className="text-[11px] text-[#5A6B61] ml-1.5">
                              ({st.country})
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5 flex-wrap gap-y-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setStudentForShift(st);
                                  setIsShiftTutorModalOpen(true);
                                }}
                                className="px-2 py-1 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-semibold rounded flex items-center space-x-1 cursor-pointer"
                                title={`Shift/transfer ${st.name} to another tutor`}
                              >
                                <ArrowRight className="w-3 h-3" />
                                <span>Shift</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setStudentForLeave(st);
                                  setIsStudentLeaveModalOpen(true);
                                }}
                                className={`px-2 py-1 text-xs font-semibold rounded flex items-center space-x-1 cursor-pointer ${
                                  st.isOnLeave
                                    ? 'text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300'
                                    : 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                                }`}
                                title={st.isOnLeave ? "Manage active leave status" : "Set student on leave for days or month"}
                              >
                                <Palmtree className="w-3 h-3" />
                                <span>{st.isOnLeave ? 'On Leave' : 'Leave'}</span>
                              </button>
                              <button
                                onClick={() => openStudent360(st)}
                                className="px-2.5 py-1 text-xs text-white bg-[#2D8B5C] font-bold hover:bg-[#1E5C3D] rounded flex items-center space-x-1 shadow-2xs cursor-pointer"
                                title="Open Student File & Record"
                              >
                                <FolderOpen className="w-3.5 h-3.5" />
                                <span>Student File</span>
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedStudent(st);
                                  setIsStudentModalOpen(true);
                                }}
                                className="px-2 py-1 text-xs text-[#2D8B5C] font-semibold hover:bg-[#2D8B5C]/10 rounded cursor-pointer"
                                title="Edit registry details"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(st.id)}
                                className="px-2 py-1 text-xs text-red-600 font-semibold hover:bg-red-50 rounded cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* 4. TUTORS TAB (CRUD, Permanent Zoom, Status - Item 9) */}
      {currentTab === 'tutors' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#161F1A]">Faculty & Tutor Management</h3>
              <p className="text-xs text-[#5A6B61]">
                Full CRUD control: onboard tutors, manage status, permanent Zoom links, and salary compensation.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedTutor(null);
                setIsTutorModalOpen(true);
              }}
              className="px-4 py-1.5 bg-[#2D8B5C] text-white text-xs font-semibold rounded-lg hover:bg-[#1E5C3D] flex items-center space-x-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Tutor</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedTutors.map((tutor, idx) => {
              const tutorClasses = classes.filter(c => c.tutorId === tutor.tutorId);
              const tutorStudents = students.filter(s => s.assignedTutorId === tutor.tutorId);
              return (
                <div key={`${tutor.id || tutor.tutorId}_${idx}`} className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#2D8B5C] tracking-wide uppercase">{tutor.tutorId}</span>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <h4 className="text-sm font-bold text-[#161F1A]">{tutor.realName || tutor.tutorId}</h4>
                        <button
                          type="button"
                          onClick={async () => {
                            const current = tutor.availabilityStatus || (tutor.status === 'Active' ? 'Available' : 'Busy');
                            const next = current === 'Available' ? 'Busy' : 'Available';
                            await updateTutor(tutor.id, { availabilityStatus: next });
                            if (onRefreshData) await onRefreshData();
                          }}
                          title="Click to toggle Live Availability (Available / Busy)"
                          className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold tracking-wider uppercase inline-flex items-center gap-1 shrink-0 cursor-pointer transition-all hover:scale-105 active:scale-95 ${
                            (tutor.availabilityStatus || (tutor.status === 'Active' ? 'Available' : 'Busy')) === 'Available'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            (tutor.availabilityStatus || (tutor.status === 'Active' ? 'Available' : 'Busy')) === 'Available' 
                              ? 'bg-[#25D366]' 
                              : 'bg-amber-500'
                          }`} />
                          {tutor.availabilityStatus || (tutor.status === 'Active' ? 'Available' : 'Busy')}
                        </button>
                      </div>
                      <p className="text-xs text-[#5A6B61]">{tutor.email}{tutor.phone ? ` • ${tutor.phone}` : ''}</p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      tutor.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {tutor.status}
                    </span>
                  </div>

                  {/* Permanent Zoom link */}
                  <div className="p-3 bg-[#FAF9F7] rounded-lg border border-[#E3DFD7] space-y-1">
                    <span className="text-[11px] font-bold text-[#5A6B61] uppercase tracking-wider flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-[#2D8B5C]" /> Permanent Zoom Classroom Link
                    </span>
                    <a
                      href={tutor.zoomLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#2D8B5C] font-mono hover:underline truncate block"
                    >
                      {tutor.zoomLink}
                    </a>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs py-1 border-t border-b border-[#EAE6DE] text-center">
                    <div>
                      <span className="text-[10px] text-[#5A6B61] block">Assigned Students</span>
                      <strong className="text-xs text-[#161F1A]">{tutorStudents.length}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#5A6B61] block">Weekly Classes</span>
                      <strong className="text-xs text-[#2D8B5C]">{tutorClasses.length}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#5A6B61] block">Salary (PKR)</span>
                      <strong className="text-xs text-[#161F1A]">PKR {tutor.monthlySalaryPKR?.toLocaleString()}</strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      onClick={async () => {
                        const newStatus = tutor.status === 'Active' ? 'Inactive' : 'Active';
                        await updateTutor(tutor.id, { status: newStatus });
                        await onRefreshData();
                      }}
                      className="text-xs font-semibold text-[#5A6B61] hover:text-[#161F1A] cursor-pointer"
                    >
                      {tutor.status === 'Active' ? 'Deactivate Tutor' : 'Activate Tutor'}
                    </button>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedTutor(tutor);
                          setIsTutorModalOpen(true);
                        }}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-md transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTutor(tutor.id, tutor.realName)}
                        className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-md transition-colors cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. LESSONS HISTORY TAB */}
      {currentTab === 'lessons' && (() => {
        const handleExportCSV = (filteredLessons: Lesson[]) => {
          exportLessonsToCSV('Admin Academic Lessons', filteredLessons, `Filter Period (${spreadsheetPeriod.toUpperCase()})`);
        };

        const filteredSpreadsheetLessons = lessons
          .filter(l => {
            // 1. Search Query filter
            const searchLower = spreadsheetSearchQuery.toLowerCase();
            const matchSearch = !spreadsheetSearchQuery.trim() || 
              (l.studentName || '').toLowerCase().includes(searchLower) ||
              (l.studentId || '').toLowerCase().includes(searchLower) ||
              (l.tutorId || '').toLowerCase().includes(searchLower) ||
              (l.lessonCovered || '').toLowerCase().includes(searchLower);

            // 2. Period Filter
            if (!matchSearch) return false;
            if (spreadsheetPeriod === 'all') return true;

            const lessonTime = new Date(l.date).getTime();
            const nowTime = Date.now();
            const diffDays = (nowTime - lessonTime) / (1000 * 60 * 60 * 24);

            if (spreadsheetPeriod === 'weekly') {
              return diffDays <= 7;
            }
            if (spreadsheetPeriod === 'monthly') {
              return diffDays <= 31;
            }
            return true;
          })
          .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-[#161F1A]">Lesson History & Academic Reports</h3>
                <p className="text-xs text-[#5A6B61]">
                  Complete directory of lesson logs, progress cards, and spreadsheet academic reports.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsLessonModalOpen(true)}
                  className="px-4 py-1.5 bg-[#2D8B5C] text-white text-xs font-semibold rounded-lg hover:bg-[#1E5C3D] flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Record New Lesson</span>
                </button>
              </div>
            </div>

            {/* Header Filters & View Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E3DFD7] shadow-3xs">
              <div className="flex items-center space-x-3">
                <span className="text-xs font-bold text-[#5A6B61]">View Layout:</span>
                <div className="inline-flex bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => setLessonsViewMode('spreadsheet')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      lessonsViewMode === 'spreadsheet' ? 'bg-[#2D8B5C] text-white shadow-2xs' : 'text-[#5A6B61] hover:text-[#161F1A]'
                    }`}
                  >
                    📊 Spreadsheet Grid
                  </button>
                  <button
                    onClick={() => setLessonsViewMode('cards')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      lessonsViewMode === 'cards' ? 'bg-[#2D8B5C] text-white shadow-2xs' : 'text-[#5A6B61] hover:text-[#161F1A]'
                    }`}
                  >
                    📋 Feed Cards
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center space-x-2 bg-gray-50 border border-[#D5D0C6] px-2.5 py-1 rounded-lg">
                  <Search className="w-3.5 h-3.5 text-[#5A6B61]" />
                  <input
                    type="text"
                    placeholder="Filter sheet by Student/Tutor..."
                    value={spreadsheetSearchQuery}
                    onChange={(e) => setSpreadsheetSearchQuery(e.target.value)}
                    className="bg-transparent border-none text-xs focus:outline-none w-44"
                  />
                </div>

                <div className="inline-flex bg-gray-100 p-1 rounded-lg text-xs">
                  <button
                    onClick={() => setSpreadsheetPeriod('all')}
                    className={`px-2.5 py-1 font-bold rounded cursor-pointer transition-all ${
                      spreadsheetPeriod === 'all' ? 'bg-white text-[#2D8B5C] shadow-3xs' : 'text-[#5A6B61]'
                    }`}
                  >
                    All Time
                  </button>
                  <button
                    onClick={() => setSpreadsheetPeriod('weekly')}
                    className={`px-2.5 py-1 font-bold rounded cursor-pointer transition-all ${
                      spreadsheetPeriod === 'weekly' ? 'bg-white text-[#2D8B5C] shadow-3xs' : 'text-[#5A6B61]'
                    }`}
                  >
                    Weekly (7 Days)
                  </button>
                  <button
                    onClick={() => setSpreadsheetPeriod('monthly')}
                    className={`px-2.5 py-1 font-bold rounded cursor-pointer transition-all ${
                      spreadsheetPeriod === 'monthly' ? 'bg-white text-[#2D8B5C] shadow-3xs' : 'text-[#5A6B61]'
                    }`}
                  >
                    Monthly (30 Days)
                  </button>
                </div>

                <button
                  onClick={() => handleExportCSV(filteredSpreadsheetLessons)}
                  className="px-3 py-1.5 bg-white border border-[#D5D0C6] text-xs font-bold rounded-lg hover:bg-gray-50 flex items-center space-x-1 cursor-pointer shadow-3xs"
                  title="Download spreadsheet as a compatible CSV sheet"
                >
                  <Download className="w-3.5 h-3.5 text-[#2D8B5C]" />
                  <span>Export to CSV</span>
                </button>
              </div>
            </div>

            {lessonsViewMode === 'spreadsheet' ? (
              /* Spreadsheet Grid Mode */
              <div className="bg-white border border-[#E3DFD7] rounded-xl overflow-hidden shadow-xs">
                <div className="bg-[#FAF9F7] px-4 py-3 border-b border-[#E3DFD7] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-1.5 text-xs text-[#161F1A] font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2D8B5C]" />
                    <span>Academic Spreadsheet Workspace ({filteredSpreadsheetLessons.length} Rows)</span>
                  </div>
                  <span className="text-[10px] text-[#5A6B61] font-mono">
                    Double-click or click "Edit Row" to edit cells inline. Complete admin database override enabled.
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#FAF9F7] border-b border-[#E3DFD7] text-[#5A6B61] font-bold uppercase tracking-wider text-[10px]">
                      <tr className="divide-x divide-[#EAE6DE]">
                        <th className="py-2.5 px-3 text-center bg-gray-50/50 w-12 font-mono">Row</th>
                        <th className="py-2.5 px-3 w-28">Date</th>
                        <th className="py-2.5 px-3 w-40">Student Details</th>
                        <th className="py-2.5 px-3 w-28">Lesson Type</th>
                        <th className="py-2.5 px-3 min-w-[180px]">Lesson Covered</th>
                        <th className="py-2.5 px-3 min-w-[150px]">Memorization</th>
                        <th className="py-2.5 px-3 min-w-[150px]">Adaab & Manners</th>
                        <th className="py-2.5 px-3 min-w-[150px]">Revision (Sabaq)</th>
                        <th className="py-2.5 px-3 w-28">Tutor</th>
                        <th className="py-2.5 px-3 text-center w-28">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAE6DE] font-mono text-xs">
                      {filteredSpreadsheetLessons.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-12 text-center text-xs text-[#5A6B61] italic font-sans bg-white">
                            No matching academic entries found in the spreadsheet range.
                          </td>
                        </tr>
                      ) : (
                        filteredSpreadsheetLessons.map((l, index) => {
                          const isRowEditing = editingRowId === l.id;
                          return (
                            <tr key={l.id} className={`hover:bg-[#FAF9F7]/40 transition-colors divide-x divide-[#EAE6DE] ${isRowEditing ? 'bg-amber-50/20' : ''}`}>
                              {/* Index Column */}
                              <td className="py-2 px-3 text-center font-mono font-bold text-gray-400 bg-gray-50/30 text-[11px]">{index + 1}</td>

                              {/* Date Column */}
                              <td className="py-2 px-3">
                                {isRowEditing ? (
                                  <input
                                    type="date"
                                    value={rowEditDate}
                                    onChange={(e) => setRowEditDate(e.target.value)}
                                    className="w-full text-xs border border-amber-300 rounded px-1.5 py-0.5 bg-white font-mono focus:outline-none"
                                  />
                                ) : (
                                  <span className="text-[#161F1A]">{l.date}</span>
                                )}
                              </td>

                              {/* Student Name/ID */}
                              <td className="py-2 px-3 font-sans">
                                <span className="font-bold text-[#161F1A] block truncate">{l.studentName}</span>
                                <span className="text-[10px] text-[#5A6B61] font-mono">{l.studentId}</span>
                              </td>

                              {/* Lesson Type */}
                              <td className="py-2 px-3">
                                {isRowEditing ? (
                                  <select
                                    value={rowEditLessonType}
                                    onChange={(e) => setRowEditLessonType(e.target.value)}
                                    className="w-full text-xs border border-amber-300 rounded px-1.5 py-0.5 bg-white focus:outline-none"
                                  >
                                    <option value="Qaida">Qaida</option>
                                    <option value="Quran">Quran</option>
                                    <option value="Hifz">Hifz</option>
                                    <option value="Tajweed">Tajweed</option>
                                    <option value="Salah">Salah</option>
                                    <option value="Dua">Dua</option>
                                  </select>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-emerald-50 text-[#1E5C3D] rounded border border-emerald-100 text-[10px] font-bold uppercase">
                                    {l.lessonType}
                                  </span>
                                )}
                              </td>

                              {/* Lesson Covered */}
                              <td className="py-2 px-3 font-sans">
                                {isRowEditing ? (
                                  <input
                                    type="text"
                                    value={rowEditCovered}
                                    onChange={(e) => setRowEditCovered(e.target.value)}
                                    className="w-full text-xs border border-amber-300 rounded px-2 py-0.5 bg-white focus:outline-none"
                                  />
                                ) : (
                                  <span className="text-[#161F1A] line-clamp-1" title={l.lessonCovered}>{l.lessonCovered}</span>
                                )}
                              </td>

                              {/* Memorization */}
                              <td className="py-2 px-3 font-sans">
                                {isRowEditing ? (
                                  <input
                                    type="text"
                                    value={rowEditMemorization}
                                    onChange={(e) => setRowEditMemorization(e.target.value)}
                                    className="w-full text-xs border border-amber-300 rounded px-2 py-0.5 bg-white focus:outline-none"
                                  />
                                ) : (
                                  <span className="text-[#B87314] font-medium line-clamp-1" title={l.memorization || ''}>{l.memorization || '—'}</span>
                                )}
                              </td>

                              {/* Adaab & Manners */}
                              <td className="py-2 px-3 font-sans">
                                {isRowEditing ? (
                                  <input
                                    type="text"
                                    value={rowEditAdaabManners}
                                    onChange={(e) => setRowEditAdaabManners(e.target.value)}
                                    className="w-full text-xs border border-amber-300 rounded px-2 py-0.5 bg-white focus:outline-none"
                                  />
                                ) : (
                                  <span className="text-[#2D8B5C] font-medium line-clamp-1" title={l.adaabManners || ''}>{l.adaabManners || '—'}</span>
                                )}
                              </td>

                              {/* Revision */}
                              <td className="py-2 px-3 font-sans">
                                {isRowEditing ? (
                                  <input
                                    type="text"
                                    value={rowEditRevision}
                                    onChange={(e) => setRowEditRevision(e.target.value)}
                                    className="w-full text-xs border border-amber-300 rounded px-2 py-0.5 bg-white focus:outline-none"
                                  />
                                ) : (
                                  <span className="text-[#161F1A] line-clamp-1" title={l.revision || ''}>{l.revision || '—'}</span>
                                )}
                              </td>

                              {/* Tutor */}
                              <td className="py-2 px-3 font-sans font-semibold text-[#2D8B5C] truncate">{l.tutorId}</td>

                              {/* Actions Column */}
                              <td className="py-2 px-3 text-center font-sans">
                                {isRowEditing ? (
                                  <div className="flex items-center justify-center space-x-1.5">
                                    <button
                                      onClick={() => handleSaveSpreadsheetRow(l.id)}
                                      className="px-2.5 py-1 bg-[#2D8B5C] text-white text-[10px] font-bold rounded cursor-pointer hover:bg-[#1E5C3D]"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingRowId(null)}
                                      className="px-2 py-1 bg-gray-200 text-[#5A6B61] text-[10px] font-bold rounded cursor-pointer hover:bg-gray-300"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center space-x-1">
                                    <button
                                      onClick={() => {
                                        setEditingRowId(l.id);
                                        setRowEditDate(l.date || '');
                                        setRowEditLessonType(l.lessonType || 'Quran');
                                        setRowEditCovered(l.lessonCovered || '');
                                        setRowEditMemorization(l.memorization || '');
                                        setRowEditAdaabManners(l.adaabManners || '');
                                        setRowEditRevision(l.revision || '');
                                        setRowEditHomework(l.homework || '');
                                        setRowEditRemarks(l.teacherRemarks || '');
                                        setRowEditPerformance(l.performance || '');
                                      }}
                                      className="px-2 py-0.5 bg-[#2D8B5C]/10 text-[#1E5C3D] border border-[#2D8B5C]/20 text-[10px] font-bold rounded hover:bg-[#2D8B5C]/20 transition-all cursor-pointer"
                                    >
                                      Inline
                                    </button>
                                    <button
                                      onClick={() => {
                                        setAdminMaterialLesson(l);
                                        setIsAdminMaterialModalOpen(true);
                                      }}
                                      className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold rounded hover:bg-blue-100 transition-all cursor-pointer whitespace-nowrap"
                                      title="View & Edit Lesson Screenshots and Teaching Materials"
                                    >
                                      📷 Material ({l.screenshots?.length || 0})
                                    </button>
                                    <button
                                      onClick={() => {
                                        setAdminFullEditLesson(l);
                                        setIsAdminFullEditModalOpen(true);
                                      }}
                                      className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold rounded hover:bg-amber-100 transition-all cursor-pointer whitespace-nowrap"
                                      title="Full Lesson Edit & Authority Override"
                                    >
                                      Full Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteLessonReport(l.id)}
                                      className="px-1.5 py-0.5 text-red-600 hover:bg-red-50 text-[10px] font-bold rounded border border-transparent hover:border-red-100 cursor-pointer"

                                      title="Permanently Delete"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Feed Cards Mode */
              <div className="space-y-3">
                {filteredSpreadsheetLessons.length === 0 ? (
                  <p className="py-12 text-center text-xs text-[#5A6B61] italic bg-white rounded-xl border border-dashed border-[#E3DFD7]">
                    No lesson reports available in this range.
                  </p>
                ) : (
                  filteredSpreadsheetLessons.map((lesson) => (
                    <div key={lesson.id} className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-[#2D8B5C]/10 text-[#2D8B5C] flex items-center justify-center font-bold text-xs">
                            <BookOpen className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-[#161F1A]">
                              {lesson.studentName} ({lesson.studentId}) — {lesson.lessonType}
                            </h4>
                            <p className="text-[11px] text-[#5A6B61]">
                              Conducted by <strong>{lesson.tutorId}</strong> on {lesson.date} ({lesson.month})
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {lesson.performance}
                          </span>
                          <button
                            onClick={() => {
                              setAdminFullEditLesson(lesson);
                              setIsAdminFullEditModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs font-bold text-[#161F1A] bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 cursor-pointer"
                            title="Full lesson details override"
                          >
                            Edit Lesson
                          </button>
                          <button
                            onClick={() => {
                              setAdminMaterialLesson(lesson);
                              setIsAdminMaterialModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs font-bold text-[#1E5C3D] bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 cursor-pointer flex items-center space-x-1"
                            title="Inspect / Edit / Replace Screenshots & Materials"
                          >
                            <span>📷 Edit Material ({lesson.screenshots?.length || 0})</span>
                          </button>
                          <button
                            onClick={() => generateLessonReportPDF(lesson)}
                            className="px-2.5 py-1 text-xs font-medium text-[#161F1A] bg-[#FAF9F7] border border-[#D5D0C6] rounded-md hover:bg-gray-100 flex items-center space-x-1 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-[#2D8B5C]" />
                            <span>PDF Report</span>
                          </button>
                          <button
                            onClick={() => handleDeleteLessonReport(lesson.id)}
                            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded font-bold cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-[#FAF9F7] p-3 rounded-lg border border-[#E3DFD7]">
                        <div>
                          <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Lesson Covered</span>
                          <p className="font-medium text-[#161F1A] mt-0.5">{lesson.lessonCovered}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Revision (Sabaq)</span>
                          <p className="font-medium text-[#161F1A] mt-0.5">{lesson.revision || 'None'}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">Homework</span>
                          <p className="font-medium text-[#161F1A] mt-0.5">{lesson.homework || 'Review daily'}</p>
                        </div>
                      </div>

                      {lesson.teacherRemarks && (
                        <p className="text-xs text-[#5A6B61] italic">
                          <strong>Teacher Remarks:</strong> {lesson.teacherRemarks}
                        </p>
                      )}

                      {/* Screenshots Gallery & Material Audit */}
                      <div className="space-y-1.5 pt-1.5 border-t border-dashed border-[#E3DFD7]">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">
                            Lesson Materials / Screenshots ({lesson.screenshots?.length || 0}):
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setAdminMaterialLesson(lesson);
                              setIsAdminMaterialModalOpen(true);
                            }}
                            className="text-[11px] font-bold text-[#1E5C3D] hover:underline cursor-pointer"
                          >
                            + Manage Materials
                          </button>
                        </div>
                        {lesson.screenshots && lesson.screenshots.length > 0 ? (
                          <div className="flex flex-wrap gap-2.5">
                            {lesson.screenshots.map((scr, idx) => (
                              !scr.url ? null : (
                                <div
                                  key={idx}
                                  onClick={() => setActivePreviewImage(scr.url)}
                                  className="relative group rounded-lg overflow-hidden border border-[#D5D0C6] hover:border-[#2D8B5C] bg-[#FAF9F7] w-20 h-14 cursor-zoom-in transition-all shadow-xs"
                                >
                                  <img
                                    src={scr.url}
                                    alt={scr.name}
                                    referrerPolicy="no-referrer"
                                    className="object-cover w-full h-full group-hover:scale-105 transition-transform"
                                  />
                                </div>
                              )
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-[#5A6B61] italic">
                            No screenshots uploaded yet. Click "+ Manage Materials" to attach Mushaf or Qaida pages.
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* 6. TRIAL CLASSES (DAY 1 & FOLLOW-UP MANAGEMENT) */}
      {currentTab === 'trials' && (() => {
        const trialStudents = students.filter(s => s.status === 'Trial' || s.trialStatus === 'Day 1' || s.trialStatus === 'Follow-up' || s.trialStatus === 'Interested' || s.trialStatus === 'Pending Call');

        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#161F1A]">Trial Class Management (Day 1 & Follow-up)</h3>
                <p className="text-xs text-[#5A6B61]">
                  Track prospective students through Day 1 initial sessions, Follow-up classes, SMS reminders, and enrollment conversion.
                </p>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                  {trialStudents.length} Active Trials
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trialStudents.length === 0 ? (
                <div className="col-span-2 bg-white p-8 rounded-xl border border-[#E3DFD7] text-center text-[#5A6B61]">
                  <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="font-semibold text-[#161F1A]">No trial students active</p>
                  <p className="text-xs mt-1">Register a new student with status "Trial" to begin tracking.</p>
                </div>
              ) : (
                trialStudents.map((st) => {
                  const completed = st.trialSessionsCompleted || 0;
                  const isFinished = completed >= 5;
                  const percentage = Math.min((completed / 5) * 100, 100);
                  const currentTrialStage = st.trialStatus || (completed <= 1 ? 'Day 1' : 'Follow-up');

                  return (
                    <div key={st.id} className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs space-y-4 hover:border-[#2D8B5C]/30 transition-all">
                      {/* Top Header & Stage Indicator */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono font-bold text-[#5A6B61]">{st.studentId}</span>
                            {/* Primary Stage Indicator: Day 1 or Follow-up */}
                            {currentTrialStage === 'Day 1' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                                Day 1 (Initial Class)
                              </span>
                            ) : currentTrialStage === 'Follow-up' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                                Follow-up Stage
                              </span>
                            ) : currentTrialStage === 'Interested' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Interested
                              </span>
                            ) : currentTrialStage === 'Pending Call' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                Pending Call
                              </span>
                            ) : isFinished ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF9ED] text-[#8C5D08] border border-[#E8A93E]">
                                Decision Pending
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-800">
                                In Progress
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-[#161F1A] mt-1">{st.name}</h4>
                          <p className="text-xs text-[#5A6B61]">
                            Parent: <strong>{st.parentName || 'N/A'}</strong> • {st.parentPhone || st.parentEmail || 'No phone'}
                          </p>
                        </div>

                        {/* Quick SMS Trigger */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTrialStudent(st);
                            setIsTrialSmsModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#1E5C3D] text-xs font-bold border border-emerald-200 flex items-center space-x-1 transition-colors cursor-pointer shrink-0"
                          title="Send quick SMS reminder to parent"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>SMS Reminder</span>
                        </button>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1.5 bg-[#FAF9F7] p-3 rounded-lg border border-[#EAE6DE]">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-[#5A6B61]">Trial Sessions Completed:</span>
                          <span className="text-[#161F1A] font-mono">{completed} / 5 Sessions</span>
                        </div>
                        <div className="w-full h-2.5 bg-[#EAE6DE] rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isFinished ? 'bg-[#E8A93E]' : 'bg-[#2D8B5C]'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Log Trial Outcome Controls */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-[#5A6B61] uppercase tracking-wider">
                          <span>Log Trial Outcome / Stage:</span>
                          <span className="text-emerald-700 font-normal normal-case">Updates in real-time</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              await updateStudent(st.id, { trialStatus: 'Day 1' });
                              await onRefreshData();
                            }}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                              currentTrialStage === 'Day 1'
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            Day 1
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              await updateStudent(st.id, { trialStatus: 'Follow-up' });
                              await onRefreshData();
                            }}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                              currentTrialStage === 'Follow-up'
                                ? 'bg-purple-600 text-white border-purple-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            Follow-up
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              await updateStudent(st.id, { trialStatus: 'Interested' });
                              await onRefreshData();
                            }}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                              currentTrialStage === 'Interested'
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            Interested
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              await updateStudent(st.id, { trialStatus: 'Pending Call' });
                              await onRefreshData();
                            }}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                              currentTrialStage === 'Pending Call'
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            Pending Call
                          </button>
                        </div>
                      </div>

                      {/* Footer Actions Row */}
                      <div className="pt-3 border-t border-[#EAE6DE] flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const next = Math.min(completed + 1, 5);
                            await updateStudent(st.id, {
                              trialSessionsCompleted: next,
                              trialStatus: next >= 5 ? 'Decision Pending' : 'Follow-up'
                            });
                            await onRefreshData();
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-[#161F1A] bg-[#FAF9F7] border border-[#D5D0C6] rounded-md hover:bg-gray-100 cursor-pointer"
                        >
                          +1 Session ({completed}/5)
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            await updateStudent(st.id, {
                              status: 'Confirmed',
                              trialStatus: 'Converted'
                            });
                            await onRefreshData();
                            // Prompt enrollment modal directly
                            setSelectedStudent({
                              ...st,
                              status: 'Confirmed',
                              trialStatus: 'Converted'
                            });
                            setIsStudentModalOpen(true);
                          }}
                          className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#2D8B5C] hover:bg-[#1E5C3D] rounded-md shadow-xs flex items-center space-x-1.5 cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Convert to Enrolled Student</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })()}

      {/* 7. STUDENT FEES & INVOICES */}
      {currentTab === 'fees' && (() => {
        const todayStr = new Date().toISOString().slice(0, 10);

        // Classify fees
        const paidFees = fees.filter(f => f.status === 'Paid');
        const submittedFees = fees.filter(f => f.status === 'Payment Submitted');
        const pendingFees = fees.filter(f => f.status === 'Pending' && f.dueDate >= todayStr);
        const overdueFees = fees.filter(f => f.status === 'Overdue' || (f.status === 'Pending' && f.dueDate < todayStr));

        // Group currency totals helper (Item 10: Selected currency only)
        const formatCurrencyTotals = (items: StudentFee[]) => {
          const filtered = feeCurrencyFilter === 'all' 
            ? items 
            : items.filter(item => item.currency === feeCurrencyFilter);
          
          const map: Record<string, number> = {};
          filtered.forEach(item => {
            const net = item.amount - (item.discount || 0);
            map[item.currency] = (map[item.currency] || 0) + net;
          });
          const parts = Object.entries(map).map(([cur, sum]) => `${getCurrencySymbol(cur)}${sum.toLocaleString()}`);
          if (parts.length > 0) return parts.join(' • ');
          return feeCurrencyFilter !== 'all' ? `${getCurrencySymbol(feeCurrencyFilter)}0` : '$0';
        };

        // Filter by sub-tab, search, and currency
        const displayedFees = fees.filter(f => {
          const isOverdue = f.status === 'Overdue' || (f.status === 'Pending' && f.dueDate < todayStr);
          
          let matchesTab = true;
          if (feeTabFilter === 'Paid') matchesTab = f.status === 'Paid';
          else if (feeTabFilter === 'Submitted') matchesTab = f.status === 'Payment Submitted';
          else if (feeTabFilter === 'Pending') matchesTab = f.status === 'Pending' && !isOverdue;
          else if (feeTabFilter === 'Overdue') matchesTab = isOverdue;

          const matchesSearch = !feeSearchQuery ||
            f.studentName.toLowerCase().includes(feeSearchQuery.toLowerCase()) ||
            f.invoiceNumber.toLowerCase().includes(feeSearchQuery.toLowerCase()) ||
            (f.parentName && f.parentName.toLowerCase().includes(feeSearchQuery.toLowerCase())) ||
            f.billingPeriod.toLowerCase().includes(feeSearchQuery.toLowerCase());

          const matchesCur = feeCurrencyFilter === 'all' || f.currency === feeCurrencyFilter;

          return matchesTab && matchesSearch && matchesCur;
        });

        return (
          <div className="space-y-4">
            {/* Header & New Invoice Button */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#161F1A]">Student Fees & Invoices Engine</h3>
                <p className="text-xs text-[#5A6B61]">
                  Family combined billing, multi-currency tracking, real-time revenue analytics, and automated status calculations.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsFamilyGroupModalOpen(true)}
                  className="px-3.5 py-2 bg-white border border-[#D5D0C6] text-[#161F1A] text-xs font-semibold rounded-lg hover:bg-gray-50 flex items-center space-x-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <Users className="w-4 h-4 text-[#2D8B5C]" />
                  <span>Manage Family Groups</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFee(null);
                    setIsFeeModalOpen(true);
                  }}
                  className="px-4 py-2 bg-[#2D8B5C] text-white text-xs font-semibold rounded-lg hover:bg-[#1E5C3D] flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Invoice</span>
                </button>
              </div>
            </div>

            {/* Financial Summary Calculation Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Total Invoiced */}
              <div className="bg-white p-4 rounded-xl border border-[#E3DFD7] shadow-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#5A6B61] uppercase tracking-wider">Total Invoiced</span>
                  <span className="p-1.5 rounded-lg bg-gray-100 text-gray-700">
                    <FileText className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="text-lg font-bold text-[#161F1A]">
                  {fees.length} <span className="text-xs font-normal text-[#5A6B61]">invoices</span>
                </div>
                <div className="text-[11px] font-mono text-[#5A6B61] truncate" title={formatCurrencyTotals(fees)}>
                  {formatCurrencyTotals(fees)}
                </div>
              </div>

              {/* Total Paid */}
              <div 
                onClick={() => setFeeTabFilter('Paid')}
                className="bg-white p-4 rounded-xl border border-emerald-200 hover:border-emerald-400 cursor-pointer shadow-xs space-y-1 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Collected / Paid</span>
                  <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                    <CheckCircle className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="text-lg font-bold text-emerald-900">
                  {paidFees.length} <span className="text-xs font-normal text-emerald-700">invoices</span>
                </div>
                <div className="text-[11px] font-mono text-emerald-700 truncate" title={formatCurrencyTotals(paidFees)}>
                  {formatCurrencyTotals(paidFees)}
                </div>
              </div>

              {/* Submitted / Awaiting Confirmation */}
              <div 
                onClick={() => setFeeTabFilter('Submitted')}
                className="bg-white p-4 rounded-xl border border-purple-200 hover:border-purple-400 cursor-pointer shadow-xs space-y-1 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">Awaiting Verification</span>
                  <span className="p-1.5 rounded-lg bg-purple-50 text-purple-700">
                    <Clock className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="text-lg font-bold text-purple-900">
                  {submittedFees.length} <span className="text-xs font-normal text-purple-700">submitted</span>
                </div>
                <div className="text-[11px] font-mono text-purple-700 truncate" title={formatCurrencyTotals(submittedFees)}>
                  {formatCurrencyTotals(submittedFees)}
                </div>
              </div>

              {/* Total Pending */}
              <div 
                onClick={() => setFeeTabFilter('Pending')}
                className="bg-white p-4 rounded-xl border border-amber-200 hover:border-amber-400 cursor-pointer shadow-xs space-y-1 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Pending Collection</span>
                  <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
                    <Clock className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="text-lg font-bold text-amber-900">
                  {pendingFees.length} <span className="text-xs font-normal text-amber-700">awaiting</span>
                </div>
                <div className="text-[11px] font-mono text-amber-700 truncate" title={formatCurrencyTotals(pendingFees)}>
                  {formatCurrencyTotals(pendingFees)}
                </div>
              </div>

              {/* Total Overdue */}
              <div 
                onClick={() => setFeeTabFilter('Overdue')}
                className="bg-white p-4 rounded-xl border border-rose-200 hover:border-rose-400 cursor-pointer shadow-xs space-y-1 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Overdue Invoices</span>
                  <span className="p-1.5 rounded-lg bg-rose-50 text-rose-700">
                    <DollarSign className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="text-lg font-bold text-rose-900">
                  {overdueFees.length} <span className="text-xs font-normal text-rose-700">past due</span>
                </div>
                <div className="text-[11px] font-mono text-rose-700 truncate" title={formatCurrencyTotals(overdueFees)}>
                  {formatCurrencyTotals(overdueFees)}
                </div>
              </div>
            </div>

            {/* Sub-Tabs: All | Paid | Pending | Overdue */}
            <div className="bg-white p-3 rounded-xl border border-[#E3DFD7] shadow-xs flex flex-wrap items-center justify-between gap-3">
              {/* Tab Pills */}
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setFeeTabFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                    feeTabFilter === 'all'
                      ? 'bg-[#161F1A] text-white'
                      : 'bg-[#FAF9F7] text-[#5A6B61] hover:bg-gray-100'
                  }`}
                >
                  <span>All Invoices</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white">
                    {fees.length}
                  </span>
                </button>

                <button
                  onClick={() => setFeeTabFilter('Paid')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                    feeTabFilter === 'Paid'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  <span>Paid</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    feeTabFilter === 'Paid' ? 'bg-white/20 text-white' : 'bg-emerald-200 text-emerald-900'
                  }`}>
                    {paidFees.length}
                  </span>
                </button>

                <button
                  onClick={() => setFeeTabFilter('Submitted')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                    feeTabFilter === 'Submitted'
                      ? 'bg-purple-700 text-white'
                      : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
                  }`}
                >
                  <span>Payment Submitted</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    feeTabFilter === 'Submitted' ? 'bg-white/20 text-white' : 'bg-purple-200 text-purple-900'
                  }`}>
                    {submittedFees.length}
                  </span>
                </button>

                <button
                  onClick={() => setFeeTabFilter('Pending')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                    feeTabFilter === 'Pending'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  <span>Pending</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    feeTabFilter === 'Pending' ? 'bg-white/20 text-white' : 'bg-amber-200 text-amber-900'
                  }`}>
                    {pendingFees.length}
                  </span>
                </button>

                <button
                  onClick={() => setFeeTabFilter('Overdue')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                    feeTabFilter === 'Overdue'
                      ? 'bg-rose-700 text-white'
                      : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                  }`}
                >
                  <span>Overdue</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    feeTabFilter === 'Overdue' ? 'bg-white/20 text-white' : 'bg-rose-200 text-rose-900'
                  }`}>
                    {overdueFees.length}
                  </span>
                </button>
              </div>

              {/* Search & Currency Filter */}
              <div className="flex items-center space-x-2 text-xs">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#5A6B61] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search student, parent, invoice #..."
                    value={feeSearchQuery}
                    onChange={(e) => setFeeSearchQuery(e.target.value)}
                    className="pl-8 pr-2.5 py-1.5 text-xs bg-[#FAF9F7] border border-[#D5D0C6] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2D8B5C] w-48 sm:w-60"
                  />
                </div>

                <select
                  value={feeCurrencyFilter}
                  onChange={(e) => setFeeCurrencyFilter(e.target.value)}
                  className="bg-[#FAF9F7] border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 text-xs text-[#161F1A] focus:outline-none focus:ring-1 focus:ring-[#2D8B5C]"
                >
                  <option value="all">All Currencies</option>
                  <option value="USD">USD ($)</option>
                  <option value="CAD">CAD (C$)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="PKR">PKR (Rs)</option>
                </select>

                <button
                  type="button"
                  onClick={() => exportFeesToCSV(`Tuition_Fees_${feeTabFilter}`, displayedFees)}
                  className="px-3 py-1.5 rounded-lg border border-[#D5D0C6] bg-white hover:bg-gray-50 text-xs font-semibold text-[#161F1A] flex items-center space-x-1.5 shadow-2xs transition-colors cursor-pointer shrink-0"
                  title="Export filtered invoices to CSV spreadsheet"
                >
                  <Download className="w-3.5 h-3.5 text-[#2D8B5C]" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Invoices Table */}
            <div className="bg-white border border-[#E3DFD7] rounded-xl overflow-hidden shadow-xs">
              {displayedFees.length === 0 ? (
                <div className="p-8 text-center space-y-2 text-[#5A6B61]">
                  <FileText className="w-8 h-8 text-[#9cb4a6] mx-auto" />
                  <p className="text-xs font-semibold text-[#161F1A]">
                    No invoices matching the current filter ({feeTabFilter})
                  </p>
                  <p className="text-[11px]">
                    Try adjusting your search criteria or switch to another tab.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF9F7] border-b border-[#E3DFD7] text-[#5A6B61] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Parent Details</th>
                      <th className="py-3 px-4">Billing Period</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Due Date</th>
                      <th className="py-3 px-4">Payment Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE6DE]">
                    {displayedFees.map(f => {
                      const isPastDue = (f.status === 'Overdue') || (f.status === 'Pending' && f.dueDate < todayStr);

                      return (
                        <tr
                          key={f.id}
                          className={`hover:bg-[#FAF9F7]/60 transition-colors ${
                            isPastDue && f.status !== 'Paid' ? 'bg-rose-50/25 border-l-4 border-l-rose-500' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-mono font-bold text-[#161F1A]">
                            <div className="flex flex-col items-start gap-1">
                              <span>{f.invoiceNumber}</span>
                              {f.isFamilyInvoice && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                  <Users className="w-3 h-3" />
                                  <span>Family Combined</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => openStudent360(f.studentId || f.studentName)}
                              className="font-bold text-[#161F1A] hover:text-[#2D8B5C] text-left block cursor-pointer"
                              title="Click to view Student File & Record"
                            >
                              {f.isFamilyInvoice ? (f.familyGroupName || f.studentName) : f.studentName}
                            </button>
                            <button
                              type="button"
                              onClick={() => openStudent360(f.studentId || f.studentName)}
                              className="text-[10px] font-mono text-[#2D8B5C] hover:underline block cursor-pointer"
                              title="Click to view Student File & Record"
                            >
                              {f.studentId}
                            </button>
                            {f.isFamilyInvoice && f.siblingBreakdown && f.siblingBreakdown.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {f.siblingBreakdown.map((s, idx) => (
                                  <span key={idx} className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.2 rounded">
                                    {s.studentName} ({getCurrencySymbol(f.currency)}{s.amount})
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[#161F1A] font-medium block">{f.parentName || 'N/A'}</span>
                            <span className="text-[11px] text-[#5A6B61]">{f.parentPhone || f.parentEmail}</span>
                          </td>
                          <td className="py-3 px-4 text-[#5A6B61] font-medium">{f.billingPeriod}</td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-[#161F1A] text-sm font-mono">
                              {getCurrencySymbol(f.currency)}{f.amount.toLocaleString()}
                            </span>
                            {f.discount ? (
                              <span className="text-[10px] text-green-700 block font-mono">
                                (-{getCurrencySymbol(f.currency)}{f.discount.toLocaleString()} discount)
                              </span>
                            ) : null}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-xs font-mono ${isPastDue && f.status !== 'Paid' ? 'text-rose-700 font-bold' : 'text-[#5A6B61]'}`}>
                              {f.dueDate}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {f.status === 'Paid' ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Paid {f.paymentDate ? `(${f.paymentDate})` : ''}
                              </span>
                            ) : f.status === 'Payment Submitted' ? (
                              <div className="space-y-1">
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300 inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-purple-700 animate-pulse" />
                                  Payment Submitted
                                </span>
                                <span className="text-[10px] font-semibold text-purple-900 block">
                                  {f.paymentMethod || 'Bank Transfer'}{f.paymentReference ? ` • ${f.paymentReference}` : ''}
                                </span>
                                {f.paymentMtcnNumber && (
                                  <span className="inline-block text-[10px] font-mono font-bold text-amber-900 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                                    MTCN: {f.paymentMtcnNumber}
                                  </span>
                                )}
                                {f.receiptImage && (
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => setViewingReceiptFee(f)}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300 transition-colors cursor-pointer"
                                      title="View attached WebP receipt"
                                    >
                                      <FileImage className="w-3 h-3 text-[#2D8B5C]" />
                                      <span>Receipt ({f.receiptCompressedSizeKB ? `${f.receiptCompressedSizeKB} KB` : 'WebP'})</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : isPastDue ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Overdue
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5">
                            {f.status === 'Payment Submitted' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await updateFee(f.id, {
                                      status: 'Paid',
                                      paymentDate: f.paymentDate || todayStr,
                                      paymentMethod: f.paymentMethod || 'Bank Transfer (Admin Confirmed)',
                                      adminConfirmedAt: new Date().toISOString(),
                                      adminConfirmedBy: userProfile?.displayName || 'Admin'
                                    });
                                    if (onRefreshData) {
                                      await onRefreshData();
                                    }
                                  }}
                                  className="px-2.5 py-1 text-xs text-white bg-emerald-600 hover:bg-emerald-700 font-bold rounded-md transition-colors shadow-2xs inline-flex items-center gap-1 cursor-pointer"
                                  title="Verify bank deposit and confirm fee as officially Paid"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  Confirm Received
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (confirm(`Decline payment notice for ${f.studentName}? This reverts the invoice back to Pending status.`)) {
                                      await updateFee(f.id, {
                                        status: 'Pending',
                                        paymentProofNote: 'Payment notice declined: funds not found in bank account.'
                                      });
                                      if (onRefreshData) {
                                        await onRefreshData();
                                      }
                                    }
                                  }}
                                  className="px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors cursor-pointer"
                                  title="Decline notice if funds were not received"
                                >
                                  Decline
                                </button>
                              </>
                            ) : f.status !== 'Paid' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleSendWhatsAppFeeReminder(f)}
                                  className="px-2 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                  title="Send WhatsApp payment reminder directly to parent"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  <span>WhatsApp</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopyPaymentReminder(f)}
                                  className="px-2 py-1 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors cursor-pointer inline-flex items-center gap-1"
                                  title="Copy reminder text"
                                >
                                  {copiedReminderId === f.id ? (
                                    <span className="text-emerald-700 font-bold">Copied!</span>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={async () => {
                                    await updateFee(f.id, {
                                      status: 'Paid',
                                      paymentDate: todayStr,
                                      adminConfirmedAt: new Date().toISOString(),
                                      adminConfirmedBy: userProfile?.displayName || 'Admin'
                                    });
                                    if (onRefreshData) {
                                      await onRefreshData();
                                    }
                                  }}
                                  className="px-2.5 py-1 text-xs text-white bg-emerald-600 hover:bg-emerald-700 font-semibold rounded-md transition-colors shadow-2xs cursor-pointer"
                                >
                                  Mark Paid
                                </button>
                              </>
                            ) : null}
                            <button
                              onClick={() => {
                                setSelectedFee(f);
                                setIsFeeModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs text-gray-700 font-semibold bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm(`Are you absolutely sure you want to delete fee invoice ${f.invoiceNumber} for ${f.studentName} permanently?`)) {
                                  await deleteFee(f.id);
                                  if (onRefreshData) {
                                    await onRefreshData();
                                  }
                                }
                              }}
                              className="px-2 py-1 text-xs text-rose-700 font-bold bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors cursor-pointer"
                              title="Delete fee invoice permanently"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );
      })()}

      {/* 8. TUTOR SALARIES (ADMIN ONLY) */}
      {currentTab === 'salaries' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#161F1A]">Tutor Monthly Salaries (PKR)</h3>
              <p className="text-xs text-[#5A6B61]">
                Operational staff compensation recorded strictly in Pakistani Rupees (PKR).
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedSalary(null);
                setIsSalaryModalOpen(true);
              }}
              className="px-4 py-1.5 bg-[#2D8B5C] text-white text-xs font-semibold rounded-lg hover:bg-[#1E5C3D] flex items-center space-x-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Record Salary Disbursement</span>
            </button>
          </div>

          <div className="bg-white border border-[#E3DFD7] rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F7] border-b border-[#E3DFD7] text-[#5A6B61] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Tutor</th>
                  <th className="py-3 px-4">Real Name</th>
                  <th className="py-3 px-4">Month</th>
                  <th className="py-3 px-4">Salary (PKR)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Disbursed Date</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE6DE]">
                {salaries.map(sal => (
                  <tr key={sal.id} className="hover:bg-[#FAF9F7]/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-[#2D8B5C]">{sal.tutorId}</td>
                    <td className="py-3 px-4 font-semibold text-[#161F1A]">{sal.tutorName}</td>
                    <td className="py-3 px-4">{sal.month}</td>
                    <td className="py-3 px-4 font-bold text-[#161F1A]">PKR {sal.monthlySalary?.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        sal.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {sal.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#5A6B61]">{sal.paymentDate || 'Pending'}</td>
                    <td className="py-3 px-4 text-[#5A6B61]">{sal.notes}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {sal.status !== 'Paid' && (
                        <button
                          onClick={async () => {
                            await updateSalary(sal.id, {
                              status: 'Paid',
                              paymentDate: new Date().toISOString().slice(0, 10)
                            });
                            await onRefreshData();
                          }}
                          className="px-2 py-1 text-xs text-emerald-700 font-semibold hover:bg-emerald-50 rounded"
                        >
                          Mark Paid
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedSalary(sal);
                          setIsSalaryModalOpen(true);
                        }}
                        className="px-2 py-1 text-xs text-gray-700 font-semibold hover:bg-gray-100 rounded"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 9. REFERRALS REWARDS DASHBOARD */}
      {currentTab === 'referrals' && (
        <ReferralRewardsDashboard
          referrals={referrals}
          students={students}
          fees={fees}
          onAddReferral={() => {
            setSelectedReferral(null);
            setIsReferralModalOpen(true);
          }}
          onEditReferral={(ref) => {
            setSelectedReferral(ref);
            setIsReferralModalOpen(true);
          }}
          onDeleteReferral={handleDeleteReferral}
          onApplyDiscount={async (ref) => {
            const matchedFee = fees.find(f => f.studentId === ref.referredStudentId && f.status !== 'Paid') || fees.find(f => f.status !== 'Paid');
            if (matchedFee) {
              await updateFee(matchedFee.id, { discount: (matchedFee.discount || 0) + ref.rewardAmount });
              await updateReferral(ref.id, { status: 'Applied' });
              await onRefreshData();
              alert(`Applied ${ref.currency} ${ref.rewardAmount} discount to invoice #${matchedFee.invoiceNumber || matchedFee.id.slice(0,6)}!`);
            } else {
              await updateReferral(ref.id, { status: 'Applied' });
              await onRefreshData();
              alert(`Referral reward marked as applied.`);
            }
          }}
          onMarkPaid={async (ref) => {
            await updateReferral(ref.id, { status: 'Paid' });
            await onRefreshData();
          }}
        />
      )}

      {/* 9.5 ACADEMY SECURITY TAB */}
      {currentTab === 'security' && (
        <AcademySecurityTab
          systemUsers={systemUsers}
          onRefreshData={onRefreshData}
        />
      )}

      {/* 10. ANNOUNCEMENTS TAB */}
      {currentTab === 'announcements' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#161F1A]">Broadcast New Academy Announcement</h3>
            <form onSubmit={handleCreateAnnouncement} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#161F1A] mb-1">Title</label>
                <input
                  type="text"
                  value={newAnnTitle}
                  onChange={(e) => setNewAnnTitle(e.target.value)}
                  placeholder="e.g. Ramadan Adjusted Timetables & Class Shifts..."
                  className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#161F1A] mb-1.5">
                  Target Audience (Select One or Multiple Roles)
                </label>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setNewAnnRoles(['all'])}
                    className={`px-3 py-1.5 rounded-lg font-semibold border transition-all cursor-pointer ${
                      newAnnRoles.includes('all')
                        ? 'bg-[#2D8B5C] text-white border-[#2D8B5C] shadow-xs'
                        : 'bg-[#FAF9F7] text-[#5A6B61] border-[#D5D0C6] hover:bg-gray-100'
                    }`}
                  >
                    🌐 Everyone (All Roles)
                  </button>
                  {[
                    { id: 'tutor', label: '👨‍🏫 Tutors' },
                    { id: 'supervisor', label: '🔍 Supervisors' },
                    { id: 'student', label: '🎓 Students' },
                    { id: 'parent', label: '👨‍👩‍👧 Parents' }
                  ].map((roleItem) => {
                    const isSelected = !newAnnRoles.includes('all') && newAnnRoles.includes(roleItem.id);
                    return (
                      <button
                        key={roleItem.id}
                        type="button"
                        onClick={() => {
                          let current = newAnnRoles.filter(r => r !== 'all');
                          if (current.includes(roleItem.id)) {
                            current = current.filter(r => r !== roleItem.id);
                          } else {
                            current.push(roleItem.id);
                          }
                          if (current.length === 0) current = ['all'];
                          setNewAnnRoles(current);
                        }}
                        className={`px-3 py-1.5 rounded-lg font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#2D8B5C] text-white border-[#2D8B5C] shadow-xs'
                            : 'bg-[#FAF9F7] text-[#5A6B61] border-[#D5D0C6] hover:bg-gray-100'
                        }`}
                      >
                        {roleItem.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-[#5A6B61] mt-1">
                  Active target: <strong>{newAnnRoles.includes('all') ? 'All Academy Members' : newAnnRoles.join(' + ').toUpperCase()}</strong>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#161F1A] mb-1">Notice Content</label>
                <textarea
                  rows={3}
                  value={newAnnContent}
                  onChange={(e) => setNewAnnContent(e.target.value)}
                  placeholder="Official notice details..."
                  className="w-full border border-[#D5D0C6] rounded-lg p-2 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">Show From Date (Optional)</label>
                  <input
                    type="date"
                    value={newAnnStartDate}
                    onChange={(e) => setNewAnnStartDate(e.target.value)}
                    className="w-full border border-[#D5D0C6] rounded-lg px-3 py-1.5 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">Auto-Expire / Hide Date (Optional)</label>
                  <input
                    type="date"
                    value={newAnnEndDate}
                    onChange={(e) => setNewAnnEndDate(e.target.value)}
                    className="w-full border border-[#D5D0C6] rounded-lg px-3 py-1.5 text-xs bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2D8B5C] text-white text-xs font-semibold rounded-lg hover:bg-[#1E5C3D] cursor-pointer shadow-xs"
                >
                  Publish Announcement
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-3">
            {announcements.map(ann => (
              <div key={ann.id} className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-[#161F1A]">{ann.title}</h4>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center gap-1">
                      {(ann.targetRoles && ann.targetRoles.length > 0 ? ann.targetRoles : [ann.targetRole || 'all']).map((r, idx) => (
                        <span key={idx} className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 capitalize">
                          {r}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => handleDeleteAnnouncement(ann.id)}
                      className="text-xs text-rose-600 hover:text-rose-700 hover:underline font-medium cursor-pointer ml-2"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[#5A6B61] leading-relaxed">{ann.content}</p>
                <div className="flex flex-wrap items-center justify-between text-[10px] text-[#5A6B61] pt-1">
                  <div>
                    Posted by {ann.authorName} on {new Date(ann.createdAt).toLocaleDateString()}
                  </div>
                  {(ann.startDate || ann.endDate) && (
                    <div className="flex items-center gap-1.5 font-medium bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                      <span>⏱️ Active:</span>
                      <span>{ann.startDate || 'Immediate'}</span>
                      <span>→</span>
                      <span>{ann.endDate || 'No Expiry'}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 11. ATTENDANCE TAB (Student Attendance + Tutor Shifts Attendance - Item 13) */}
      {currentTab === 'attendance' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E3DFD7] pb-3">
            <div>
              <h3 className="text-base font-bold text-[#161F1A]">Academy Attendance Records</h3>
              <p className="text-xs text-[#5A6B61]">
                Unified tracking for student daily Quran classes and faculty shifts & punctuality.
              </p>
            </div>

            {/* Sub-tab Switcher */}
            <div className="inline-flex rounded-lg border border-[#D5D0C6] p-0.5 bg-[#FAF9F7] text-xs">
              <button
                type="button"
                onClick={() => setAttendanceSubTab('students')}
                className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  attendanceSubTab === 'students'
                    ? 'bg-[#2D8B5C] text-white shadow-2xs'
                    : 'text-[#5A6B61] hover:text-[#161F1A]'
                }`}
              >
                🎓 Student Attendance
              </button>
              <button
                type="button"
                onClick={() => setAttendanceSubTab('tutors')}
                className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  attendanceSubTab === 'tutors'
                    ? 'bg-[#2D8B5C] text-white shadow-2xs'
                    : 'text-[#5A6B61] hover:text-[#161F1A]'
                }`}
              >
                ⏰ Tutor Shifts & Attendance (Item 13)
              </button>
            </div>
          </div>

          {attendanceSubTab === 'students' ? (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-xl border border-[#E3DFD7] shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-[#161F1A]">Quick Student Attendance Marking</h3>
                <form onSubmit={handleMarkAttendance} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#161F1A] mb-1">Student</label>
                    <select
                      value={attStudentId}
                      onChange={(e) => setAttStudentId(e.target.value)}
                      className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white"
                    >
                      {students.map(s => (
                        <option key={s.id} value={s.studentId}>{s.name} ({s.studentId})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#161F1A] mb-1">Status</label>
                    <select
                      value={attStatus}
                      onChange={(e) => setAttStatus(e.target.value as any)}
                      className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white"
                    >
                      <option value="Present">Present</option>
                      <option value="Absent">Absent</option>
                      <option value="Excused">Excused</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#2D8B5C] text-white text-xs font-semibold rounded-lg hover:bg-[#1E5C3D] cursor-pointer"
                  >
                    Save Attendance
                  </button>
                </form>
              </div>

              <div className="bg-white border border-[#E3DFD7] rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF9F7] border-b border-[#E3DFD7] text-[#5A6B61] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Marked By</th>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE6DE]">
                    {attendance.map(a => (
                      <tr key={a.id} className="hover:bg-[#FAF9F7]/60">
                        <td className="py-3 px-4 font-semibold text-[#161F1A]">{a.studentName} ({a.studentId})</td>
                        <td className="py-3 px-4">{a.date}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.status === 'Present' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#5A6B61]">{a.markedBy}</td>
                        <td className="py-3 px-4 text-[#5A6B61] font-mono">{a.markedAt}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm(`Are you sure you want to delete the attendance log for ${a.studentName} on ${a.date}?`)) {
                                await deleteAttendanceRecord(a.id);
                                if (onRefreshData) {
                                  await onRefreshData();
                                }
                              }
                            }}
                            className="px-2 py-1 text-xs text-rose-700 font-bold bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Tutor Shifts Attendance (Item 13) */
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                  <div className="p-3 bg-white border border-[#E3DFD7] rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-[#5A6B61]">Logged Shifts</span>
                    <p className="text-lg font-bold text-[#161F1A]">{tutorAttendance.length}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-emerald-800">On Time</span>
                    <p className="text-lg font-bold text-emerald-900">{tutorAttendance.filter(t => t.status === 'Present').length}</p>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-amber-800">Late Arrivals</span>
                    <p className="text-lg font-bold text-amber-900">{tutorAttendance.filter(t => t.status === 'Late').length}</p>
                  </div>
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-rose-800">Total Late Time</span>
                    <p className="text-lg font-bold text-rose-900">
                      {tutorAttendance.reduce((acc, t) => acc + (t.lateDurationMinutes || 0), 0)} min
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedTutorAttendanceRecord(null);
                    setIsTutorAttendanceModalOpen(true);
                  }}
                  className="px-4 py-2 bg-[#2D8B5C] text-white text-xs font-semibold rounded-lg hover:bg-[#1E5C3D] flex items-center space-x-1.5 shadow-xs cursor-pointer self-stretch sm:self-auto justify-center"
                >
                  <Plus className="w-4 h-4" />
                  <span>Log Tutor Shift</span>
                </button>
              </div>

              <div className="bg-white border border-[#E3DFD7] rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF9F7] border-b border-[#E3DFD7] text-[#5A6B61] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Tutor</th>
                      <th className="py-3 px-4">Shift Date</th>
                      <th className="py-3 px-4">Shift Hours (PKT)</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Late Mins</th>
                      <th className="py-3 px-4">Marked By</th>
                      <th className="py-3 px-4">Notes / Substitute</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE6DE]">
                    {tutorAttendance.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-[#5A6B61]">
                          No tutor shift records logged yet. Click "Log Tutor Shift" above.
                        </td>
                      </tr>
                    ) : (
                      tutorAttendance.map(rec => (
                        <tr key={rec.id} className="hover:bg-[#FAF9F7]/60">
                          <td className="py-3 px-4">
                            <span className="font-bold text-[#161F1A] block">{rec.tutorName}</span>
                            <span className="text-[10px] font-mono text-[#2D8B5C]">{rec.tutorId}</span>
                          </td>
                          <td className="py-3 px-4 font-mono">{rec.date}</td>
                          <td className="py-3 px-4 font-mono text-[#5A6B61]">
                            {rec.timeIn || '01:00'} - {rec.timeOut || '05:00'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              rec.status === 'Present'
                                ? 'bg-emerald-100 text-emerald-800'
                                : rec.status === 'Late'
                                ? 'bg-amber-100 text-amber-800'
                                : rec.status === 'Absent'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {rec.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold">
                            {(rec.lateDurationMinutes || 0) > 0 ? (
                              <span className="text-amber-700">+{rec.lateDurationMinutes}m</span>
                            ) : (
                              <span className="text-[#5A6B61]">0m</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[#5A6B61]">{rec.markedBy || 'Supervisor'}</td>
                          <td className="py-3 px-4 text-[#5A6B61] max-w-xs truncate">{rec.notes || '-'}</td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              onClick={() => {
                                setSelectedTutorAttendanceRecord(rec);
                                setIsTutorAttendanceModalOpen(true);
                              }}
                              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-md transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteTutorAttendance(rec.id)}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-md transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 12. SETTINGS TAB */}
      {currentTab === 'settings' && (
        <div className="space-y-6 max-w-2xl">
          {/* Settings Tab Top Bar */}
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#E3DFD7]">
            <div>
              <h2 className="text-base font-bold text-[#161F1A]">Academy Settings & Options</h2>
              <p className="text-xs text-[#5A6B61]">Manage operational settings, test data governance, and user accounts.</p>
            </div>
            <button
              type="button"
              onClick={() => setCurrentTab('trash')}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-[#D5D0C6] bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 text-xs font-semibold text-[#161F1A] transition-colors cursor-pointer shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Recovery Trash</span>
            </button>
            <button
              type="button"
              id="toggle_hide_all_settings"
              onClick={() => {
                const anyOpen = !hideOperationalSettings || !hideDataGovernance || !hideUserGovernance;
                setHideOperationalSettings(anyOpen);
                setHideDataGovernance(anyOpen);
                setHideUserGovernance(anyOpen);
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-[#D5D0C6] bg-white hover:bg-[#FAF9F7] text-xs font-semibold text-[#161F1A] transition-colors cursor-pointer shadow-2xs"
            >
              {(!hideOperationalSettings || !hideDataGovernance || !hideUserGovernance) ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-[#5A6B61]" />
                  <span>Hide All</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-[#2D8B5C]" />
                  <span>Show All</span>
                </>
              )}
            </button>
          </div>

          {/* 1. Operational Settings */}
          <div className="bg-white p-6 rounded-xl border border-[#E3DFD7] shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#161F1A]">Academy Operational Settings</h3>
                <p className="text-xs text-[#5A6B61] mt-0.5">Core operational rules and master timezone parameters</p>
              </div>
              <button
                type="button"
                id="toggle_hide_operational_settings"
                onClick={() => setHideOperationalSettings(prev => !prev)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-[#D5D0C6] hover:bg-[#FAF9F7] text-xs font-semibold text-[#161F1A] transition-colors cursor-pointer shrink-0"
                title={hideOperationalSettings ? "Show operational settings options" : "Hide operational settings options"}
              >
                {hideOperationalSettings ? (
                  <>
                    <Eye className="w-3.5 h-3.5 text-[#2D8B5C]" />
                    <span>Show</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-[#5A6B61]" />
                    <span>Hide</span>
                  </>
                )}
              </button>
            </div>

            {!hideOperationalSettings && (
              <form onSubmit={handleSaveOperationalSettings} className="space-y-4 text-xs pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#5A6B61] mb-1">Academy Name</label>
                    <input
                      type="text"
                      value={academyName}
                      onChange={(e) => setAcademyName(e.target.value)}
                      className="w-full border border-[#D5D0C6] rounded-lg p-2.5 bg-white text-[#161F1A] focus:ring-2 focus:ring-[#2D8B5C] outline-none"
                      placeholder="e.g. Islamic Tuition"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#5A6B61] mb-1">Academy WhatsApp / Contact Number</label>
                    <input
                      type="text"
                      value={academyPhone}
                      onChange={(e) => setAcademyPhone(e.target.value)}
                      className="w-full border border-[#D5D0C6] rounded-lg p-2.5 bg-white text-[#161F1A] focus:ring-2 focus:ring-[#2D8B5C] outline-none"
                      placeholder="+1 (718) 618-4848"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#5A6B61] mb-1">Operational Timezone (Master Reference)</label>
                    <select
                      value={academyTimezone}
                      onChange={(e) => setAcademyTimezone(e.target.value)}
                      className="w-full border border-[#D5D0C6] rounded-lg p-2.5 bg-white text-[#161F1A] font-semibold text-[#2D8B5C] focus:ring-2 focus:ring-[#2D8B5C] outline-none"
                    >
                      <option value="Asia/Karachi">Asia/Karachi (Pakistan Standard Time - PKT)</option>
                      <option value="Asia/Dubai">Asia/Dubai (Gulf Standard Time - GST)</option>
                      <option value="Europe/London">Europe/London (GMT / BST)</option>
                      <option value="America/New_York">America/New_York (Eastern Time - EST)</option>
                      <option value="America/Chicago">America/Chicago (Central Time - CST)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (Pacific Time - PST)</option>
                      <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                      <option value="UTC">UTC (Coordinated Universal Time)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#5A6B61] mb-1">Head Office Email</label>
                    <input
                      type="email"
                      value={headOfficeEmail}
                      onChange={(e) => setHeadOfficeEmail(e.target.value)}
                      className="w-full border border-[#D5D0C6] rounded-lg p-2.5 bg-white text-[#161F1A] focus:ring-2 focus:ring-[#2D8B5C] outline-none"
                      placeholder="info@islamictuition.us"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7]">
                  <div>
                    <label className="block font-semibold text-[#161F1A] mb-1">Standard Free Trial Sessions</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="1"
                        max="15"
                        value={trialSessionsCount}
                        onChange={(e) => setTrialSessionsCount(parseInt(e.target.value, 10) || 1)}
                        className="w-24 border border-[#D5D0C6] rounded-lg p-2 bg-white text-center font-bold text-[#8C5D08] focus:ring-2 focus:ring-[#2D8B5C] outline-none"
                      />
                      <span className="text-[11px] text-[#5A6B61]">Sessions before conversion alert</span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#161F1A] mb-1">Default Sibling / Family Discount</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={siblingDiscountPercent}
                        onChange={(e) => setSiblingDiscountPercent(parseInt(e.target.value, 10) || 0)}
                        className="w-24 border border-[#D5D0C6] rounded-lg p-2 bg-white text-center font-bold text-[#2D8B5C] focus:ring-2 focus:ring-[#2D8B5C] outline-none"
                      />
                      <span className="text-[11px] text-[#5A6B61]">% applied to multi-child invoices</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  {settingsSaveSuccess ? (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 animate-fade-in">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      Settings & Discount rates saved successfully!
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#5A6B61]">Changes take effect immediately across all fee and timetable calculations.</span>
                  )}

                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold rounded-lg text-white bg-[#2D8B5C] hover:bg-[#1E5C3D] transition-colors shadow-xs cursor-pointer flex items-center space-x-1.5"
                  >
                    <span>Save Operational Settings</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* 2. Live Academy Database Backup & Snapshot */}
          <div className="bg-white p-6 rounded-xl border border-[#E3DFD7] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-[#161F1A] flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-[#2D8B5C]" />
                    Academy Database Backup & Export
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    🟢 Live Production Data
                  </span>
                </div>
                <p className="text-xs text-[#5A6B61] mt-1">
                  Export complete encrypted JSON snapshots of all live academy records (students, faculty, classes, lesson logs, fees, and attendance) for local backup and compliance.
                </p>
              </div>

              <div className="flex items-center space-x-2 shrink-0 self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => {
                    exportFullAcademyBackupJSON({
                      exportedAt: new Date().toISOString(),
                      academyName: localStorage.getItem('it_academy_name') || 'IslamicTuition Academy',
                      data: {
                        students,
                        tutors,
                        classes,
                        lessons,
                        fees,
                        salaries,
                        referrals,
                        announcements,
                        attendance,
                        tutorAttendance
                      }
                    });
                  }}
                  className="px-4 py-2.5 text-xs font-bold rounded-lg text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 shadow-xs transition-colors whitespace-nowrap flex items-center space-x-2 cursor-pointer"
                  title="Export a complete offline JSON snapshot of all live academy database collections"
                >
                  <Download className="w-4 h-4 text-emerald-800" />
                  <span>Download Full Academy Backup (JSON)</span>
                </button>
              </div>
            </div>
          </div>

          {/* 3. User Accounts & Password Governance */}
          <div className="bg-white p-6 rounded-xl border border-[#E3DFD7] shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-[#161F1A] flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-[#2D8B5C]" />
                  User Accounts & Login Governance
                </h4>
                <p className="text-xs text-[#5A6B61] mt-0.5">
                  Oversee real accounts, register new Firebase Auth users with role profiles, and manage access keys.
                </p>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateUserModalOpen(true)}
                  className="px-3.5 py-1.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register New User Account</span>
                </button>

                <button
                  type="button"
                  id="toggle_hide_user_governance"
                  onClick={() => setHideUserGovernance(prev => !prev)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-[#D5D0C6] hover:bg-[#FAF9F7] text-xs font-semibold text-[#161F1A] transition-colors cursor-pointer bg-white"
                  title={hideUserGovernance ? "Show user accounts options" : "Hide user accounts options"}
                >
                  {hideUserGovernance ? (
                    <>
                      <Eye className="w-3.5 h-3.5 text-[#2D8B5C]" />
                      <span>Show</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-[#5A6B61]" />
                      <span>Hide</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {!hideUserGovernance && (
              <div className="space-y-4 text-xs pt-1">
                {/* 0. Pending Self-Registrations Awaiting Approval */}
                <div id="users_tab_pending_approvals" className="bg-[#FFF9ED] p-3.5 rounded-xl border border-[#E8A93E] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      <span className="font-bold text-[#161F1A] text-xs sm:text-sm">
                        Pending Self-Registrations ({pendingUsers.length})
                      </span>
                    </div>
                    <span className="text-[11px] text-amber-800 font-semibold bg-amber-100 px-2 py-0.5 rounded-full">
                      {pendingUsers.length === 0 ? 'All Reviewed' : `${pendingUsers.length} Awaiting Approval`}
                    </span>
                  </div>

                  {pendingUsers.length === 0 ? (
                    <div className="p-3 bg-white/80 border border-amber-200/60 rounded-lg text-center text-[#5A6B61]">
                      <p className="font-medium text-xs text-slate-700">No new student or parent registrations pending review.</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        When users register via the enrollment form, they will appear here and in the Overview tab for immediate faculty assignment and activation.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {pendingUsers.map(user => {
                        const isApproving = approvingUid === user.uid;
                        const isRejecting = rejectingUid === user.uid;
                        const assignedTutor = assignTutorMap[user.uid] || 'Tutor 1';
                        const assignedCourse = assignCourseMap[user.uid] || user.courseType || 'Quran Reading / Nazra';
                        const assignedStatus = assignStatusMap[user.uid] || 'Active';

                        return (
                          <div key={user.uid} className="p-3 bg-white border border-amber-200 rounded-lg shadow-2xs space-y-2.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900">{user.displayName || 'Prospective User'}</span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                    user.role === 'student' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {user.role}
                                  </span>
                                  {user.studentId && (
                                    <span className="font-mono text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                      {user.studentId}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-[#5A6B61] font-mono">{user.email}</p>
                                {user.phone && <p className="text-[10px] text-slate-500">Phone: {user.phone}</p>}
                              </div>
                              <div className="text-left sm:text-right text-[11px] text-slate-500">
                                <span>{user.country || 'USA'} • {getTimezoneShortCode(user.timezone || 'America/New_York')}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[#FAF9F7] p-2 rounded-md border border-[#EAE6DE] text-xs">
                              <div>
                                <label className="block text-[9px] font-bold text-slate-600 uppercase mb-0.5">Course</label>
                                <select
                                  value={assignedCourse}
                                  onChange={(e) => setAssignCourseMap(prev => ({ ...prev, [user.uid]: e.target.value as CourseType }))}
                                  className="w-full bg-white border border-[#D5D0C6] rounded px-1.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-[#2D8B5C]"
                                >
                                  <option value="Quran Reading / Nazra">Quran Reading / Nazra</option>
                                  <option value="Tajweed Rules & Pronunciation">Tajweed Rules</option>
                                  <option value="Hifz / Memorization">Hifz / Memorization</option>
                                  <option value="Islamic Studies & Duas">Islamic Studies</option>
                                  <option value="Arabic Language Basics">Arabic Language</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[9px] font-bold text-slate-600 uppercase mb-0.5">Assign Faculty</label>
                                <select
                                  value={assignedTutor}
                                  onChange={(e) => setAssignTutorMap(prev => ({ ...prev, [user.uid]: e.target.value }))}
                                  className="w-full bg-white border border-[#D5D0C6] rounded px-1.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-[#2D8B5C]"
                                >
                                  {sortedTutors.map(t => (
                                    <option key={t.id} value={t.tutorId}>
                                      {t.tutorId} - {t.realName || t.tutorId}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[9px] font-bold text-slate-600 uppercase mb-0.5">Initial Status</label>
                                <select
                                  value={assignedStatus}
                                  onChange={(e) => setAssignStatusMap(prev => ({ ...prev, [user.uid]: e.target.value as StudentStatus }))}
                                  className="w-full bg-white border border-[#D5D0C6] rounded px-1.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-[#2D8B5C]"
                                >
                                  <option value="Active">Active Student</option>
                                  <option value="Trial">Free Trial (5 Sessions)</option>
                                </select>
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                disabled={isRejecting || isApproving}
                                onClick={() => handleRejectPendingUser(user)}
                                className="px-3 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {isRejecting ? 'Declining...' : 'Decline'}
                              </button>
                              <button
                                type="button"
                                disabled={isRejecting || isApproving}
                                onClick={() => handleApprovePendingUser(user)}
                                className="px-3.5 py-1 text-xs font-bold text-white bg-[#2D8B5C] hover:bg-[#1E5C3D] rounded shadow-2xs transition-colors flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{isApproving ? 'Activating...' : 'Approve & Activate'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 1. Admins & Supervisors */}
                <div className="bg-[#FAF9F7] p-3 rounded-lg border border-[#E3DFD7] space-y-2">
                  <span className="font-bold text-[#161F1A] block">Academy Leadership & Administration</span>
                  {(() => {
                    const adminsAndSupervisors = systemUsers.filter(u => u.role === 'admin' || u.role === 'supervisor');
                    const hasOwnerInList = adminsAndSupervisors.some(u => {
                      const em = (u.email || '').toLowerCase();
                      return em === 'muhammadusmanabbasi100@gmail.com' || em === 'dateandtimecalculator@gmail.com';
                    });
                    const displayList = hasOwnerInList
                      ? adminsAndSupervisors
                      : [
                          {
                            uid: 'primary_admin',
                            email: 'muhammadusmanabbasi100@gmail.com',
                            displayName: 'Muhammad Usman',
                            role: 'admin' as const,
                            status: 'active' as const,
                            createdAt: new Date().toISOString()
                          },
                          ...adminsAndSupervisors
                        ];

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {displayList.map(u => (
                          <div key={u.uid} className="p-2.5 bg-white border border-[#E3DFD7] rounded-md flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-[#161F1A] flex items-center gap-1.5">
                                <span>{u.displayName || (u.role === 'admin' ? 'Academy Director' : 'Academic Supervisor')}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                  u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {u.role}
                                </span>
                              </p>
                              <p className="text-[11px] text-[#5A6B61] font-mono">{u.email}</p>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <button
                                onClick={() => {
                                  setResetPasswordModalUser({ name: u.displayName || u.email, email: u.email, role: u.role });
                                  setNewPasswordInput('admin123');
                                  setResetFeedbackMsg('');
                                }}
                                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-[11px] font-semibold rounded cursor-pointer"
                              >
                                Reset Key
                              </button>
                              {u.email !== 'dateandtimecalculator@gmail.com' && u.email !== 'muhammadusmanabbasi100@gmail.com' && (
                                <button
                                  onClick={() => handleDeleteSystemUser(u)}
                                  className="p-1 text-gray-400 hover:text-rose-600 rounded cursor-pointer"
                                  title="Delete user account"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* 2. Faculty Tutors */}
                <div className="bg-[#FAF9F7] p-3 rounded-lg border border-[#E3DFD7] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#161F1A]">Faculty Tutors</span>
                    <span className="text-[11px] text-[#5A6B61]">{tutors.length} registered</span>
                  </div>
                  {tutors.length === 0 ? (
                    <div className="p-4 bg-white border border-[#E3DFD7] rounded-md text-center text-[#5A6B61]">
                      <p className="font-medium">No faculty tutors registered yet.</p>
                      <p className="text-[11px] mt-0.5">Click "Register New User Account" above to add your academy tutors.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {sortedTutors.map(t => (
                        <div key={t.id} className="p-2.5 bg-white border border-[#E3DFD7] rounded-md flex items-center justify-between">
                          <div>
                            <div className="flex items-center space-x-1.5 flex-wrap">
                              <p className="font-semibold text-[#161F1A]">{t.realName ? `${t.realName} (${t.tutorId})` : t.tutorId}</p>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase inline-flex items-center gap-1 ${
                                t.availabilityStatus === 'Available'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                <span className={`w-1 h-1 rounded-full ${t.availabilityStatus === 'Available' ? 'bg-[#25D366]' : 'bg-amber-500'}`} />
                                {t.availabilityStatus || 'Busy'}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#5A6B61] font-mono">{t.email}</p>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <button
                              onClick={() => {
                                setResetPasswordModalUser({ name: t.realName || t.tutorId, email: t.email, role: 'tutor' });
                                setNewPasswordInput('tutor123');
                                setResetFeedbackMsg('');
                              }}
                              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-[11px] font-semibold rounded cursor-pointer"
                            >
                              Reset Key
                            </button>
                            <button
                              onClick={() => handleDeleteTutor(t.id, t.realName)}
                              className="p-1 text-gray-400 hover:text-rose-600 rounded cursor-pointer"
                              title="Delete tutor"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Students & Parents */}
                <div className="bg-[#FAF9F7] p-3 rounded-lg border border-[#E3DFD7] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#161F1A]">Students & Parents</span>
                    <span className="text-[11px] text-[#5A6B61]">{students.length} registered</span>
                  </div>
                  {students.length === 0 ? (
                    <div className="p-4 bg-white border border-[#E3DFD7] rounded-md text-center text-[#5A6B61]">
                      <p className="font-medium">No students or parents registered yet.</p>
                      <p className="text-[11px] mt-0.5">Students can self-register via the academy enrollment portal or be created directly.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {students.map(s => (
                        <div key={s.id} className="p-2.5 bg-white border border-[#E3DFD7] rounded-md space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-[#161F1A]">{s.name} <span className="font-normal text-[#5A6B61]">({s.studentId})</span></p>
                              <p className="text-[11px] text-[#5A6B61] font-mono">{s.email || 'No student email'}</p>
                            </div>
                            <div className="flex items-center space-x-1">
                              {s.email && (
                                <button
                                  onClick={() => {
                                    setResetPasswordModalUser({ name: s.name, email: s.email, role: 'student' });
                                    setNewPasswordInput('quran123');
                                    setResetFeedbackMsg('');
                                  }}
                                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-[10px] font-semibold rounded cursor-pointer"
                                >
                                  Reset Key
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteStudent(s.id)}
                                className="p-1 text-gray-400 hover:text-rose-600 rounded cursor-pointer"
                                title="Delete student"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          {s.parentEmail && (
                            <div className="flex items-center justify-between pt-1 border-t border-[#EAE6DE]">
                              <div>
                                <p className="text-[11px] text-[#5A6B61]">Parent: {s.parentName}</p>
                                <p className="text-[10px] text-[#5A6B61] font-mono">{s.parentEmail}</p>
                              </div>
                              <button
                                onClick={() => {
                                  setResetPasswordModalUser({ name: s.parentName, email: s.parentEmail, role: 'parent' });
                                  setNewPasswordInput('parent123');
                                  setResetFeedbackMsg('');
                                }}
                                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-[10px] font-semibold rounded cursor-pointer"
                              >
                                Reset Parent
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 13. TRASH & RECOVERY TAB */}
      {currentTab === 'trash' && (
        <TrashRecoveryManager onDataRestored={onRefreshData} />
      )}

      {/* Modals */}
      <ClassModal
        isOpen={isClassModalOpen}
        onClose={() => setIsClassModalOpen(false)}
        onSave={handleSaveClass}
        onDelete={handleDeleteClass}
        tutors={tutors}
        students={students}
        initialSlot={selectedSlot}
        initialClass={selectedClass}
        existingClasses={classes}
        defaultTutorId={tutorFilter === 'all' ? undefined : tutorFilter}
      />

      <StudentModal
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        onSave={handleSaveStudent}
        tutors={tutors}
        students={students}
        initialStudent={selectedStudent}
      />

      <BulkImportModal
        isOpen={isBulkImportModalOpen}
        onClose={() => setIsBulkImportModalOpen(false)}
        onSuccess={async () => {
          await onRefreshData();
          setIsBulkImportModalOpen(false);
        }}
        students={students}
        tutors={tutors}
      />

      <TutorModal
        isOpen={isTutorModalOpen}
        onClose={() => setIsTutorModalOpen(false)}
        onSave={handleSaveTutor}
        initialTutor={selectedTutor}
        existingTutorsCount={tutors.length}
      />

      <LessonModal
        isOpen={isLessonModalOpen}
        onClose={() => setIsLessonModalOpen(false)}
        onSave={handleSaveLesson}
        students={students}
        initialStudentId={selectedStudentForLesson}
      />

      {/* Lesson Material & Screenshot Edit Modal for Admin */}
      <LessonMaterialEditModal
        isOpen={isAdminMaterialModalOpen}
        onClose={() => {
          setIsAdminMaterialModalOpen(false);
          setAdminMaterialLesson(null);
        }}
        lesson={adminMaterialLesson}
        userRole="admin"
        userName="Administrator"
        onRefreshData={onRefreshData}
        onPreviewImage={(url) => setActivePreviewImage(url)}
      />

      {/* Lesson Full Edit Modal for Admin */}
      <LessonEditModal
        isOpen={isAdminFullEditModalOpen}
        onClose={() => {
          setIsAdminFullEditModalOpen(false);
          setAdminFullEditLesson(null);
        }}
        lesson={adminFullEditLesson}
        userRole="admin"
        userName="Administrator"
        onRefreshData={onRefreshData}
        onOpenMaterialModal={(lesson) => {
          setAdminMaterialLesson(lesson);
          setIsAdminMaterialModalOpen(true);
        }}
      />

      <FeeModal
        isOpen={isFeeModalOpen}
        onClose={() => setIsFeeModalOpen(false)}
        onSave={handleSaveFee}
        students={students}
        initialFee={selectedFee}
      />

      <FeeReceiptModal
        isOpen={!!viewingReceiptFee}
        onClose={() => setViewingReceiptFee(null)}
        fee={viewingReceiptFee}
        student={students.find(s => s.studentId === viewingReceiptFee?.studentId) || null}
      />

      <SalaryModal
        isOpen={isSalaryModalOpen}
        onClose={() => setIsSalaryModalOpen(false)}
        onSave={handleSaveSalary}
        tutors={tutors}
        initialSalary={selectedSalary}
      />

      <ReferralModal
        isOpen={isReferralModalOpen}
        onClose={() => setIsReferralModalOpen(false)}
        onSave={handleSaveReferral}
        students={students}
        initialReferral={selectedReferral}
      />

      <TutorAttendanceModal
        isOpen={isTutorAttendanceModalOpen}
        onClose={() => setIsTutorAttendanceModalOpen(false)}
        onSave={handleSaveTutorAttendance}
        tutors={tutors}
        initialRecord={selectedTutorAttendanceRecord}
        markedByRole="Admin"
      />

      {/* Password Reset Modal Dialog (Item 17) */}
      {resetPasswordModalUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E3DFD7] shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EAE6DE] pb-3">
              <div className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-[#2D8B5C]" />
                <h3 className="font-bold text-sm text-[#161F1A]">Reset Account Password</h3>
              </div>
              <button
                onClick={() => setResetPasswordModalUser(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#FAF9F7] rounded-lg border border-[#E3DFD7] space-y-1">
                <p><strong>User:</strong> {resetPasswordModalUser.name}</p>
                <p><strong>Email:</strong> <span className="font-mono">{resetPasswordModalUser.email}</span></p>
                <p className="capitalize"><strong>Role:</strong> {resetPasswordModalUser.role}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#161F1A] mb-1">New Password</label>
                <input
                  type="text"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Enter new password..."
                  className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs font-mono bg-white"
                  required
                />
              </div>

              {resetFeedbackMsg && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{resetFeedbackMsg}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#EAE6DE]">
              <button
                onClick={() => setResetPasswordModalUser(null)}
                className="px-3 py-1.5 text-xs text-[#5A6B61] hover:text-[#161F1A] font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newPasswordInput.trim()) return;
                  try {
                    await resetUserPassword(resetPasswordModalUser.email, newPasswordInput.trim());
                    setResetFeedbackMsg(`Password successfully updated to "${newPasswordInput.trim()}". User can log in immediately.`);
                    setTimeout(() => {
                      setResetPasswordModalUser(null);
                    }, 1400);
                  } catch (err: any) {
                    alert("Failed to reset password: " + err.message);
                  }
                }}
                className="px-4 py-1.5 bg-[#2D8B5C] text-white text-xs font-semibold rounded-lg hover:bg-[#1E5C3D] cursor-pointer"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User & Role Profile Modal */}
      <CreateUserModal
        isOpen={isCreateUserModalOpen}
        onClose={() => setIsCreateUserModalOpen(false)}
        onSuccess={onRefreshData}
        availableTutors={tutors}
        students={students}
      />

      {/* Family Group Management Modal */}
      <FamilyGroupModal
        isOpen={isFamilyGroupModalOpen}
        onClose={() => setIsFamilyGroupModalOpen(false)}
        students={students}
        onSaveFamilyGroup={handleSaveFamilyGroup}
        onRemoveFromFamily={handleRemoveFromFamily}
      />

      {/* Trial SMS Quick Trigger Modal */}
      <TrialSmsModal
        isOpen={isTrialSmsModalOpen}
        onClose={() => {
          setIsTrialSmsModalOpen(false);
          setSelectedTrialStudent(null);
        }}
        student={selectedTrialStudent}
        tutor={tutors.find(t => t.tutorId === selectedTrialStudent?.tutorId) || null}
        onSendSms={handleSendTrialSms}
      />

      {/* Weekly Progress Report to Parents Modal */}
      <WeeklyProgressReportModal
        isOpen={isWeeklyReportModalOpen}
        onClose={() => {
          setIsWeeklyReportModalOpen(false);
          setWeeklyReportStudentId('');
        }}
        students={students}
        lessons={lessons}
        attendanceRecords={attendance}
        tutors={tutors}
        initialStudentId={weeklyReportStudentId}
      />

      {/* Multi-Day Timetable Slot Batch Deletion Modal */}
      <MultiDayClassDeleteModal
        isOpen={isMultiDeleteModalOpen}
        onClose={() => {
          setIsMultiDeleteModalOpen(false);
          setMultiDeleteTargetClass(null);
        }}
        targetClass={multiDeleteTargetClass}
        allClasses={classes}
        onConfirmDelete={handleConfirmMultiDayDelete}
      />

      {/* Student Leave / Vacation Management Modal */}
      <StudentLeaveModal
        isOpen={isStudentLeaveModalOpen}
        onClose={() => {
          setIsStudentLeaveModalOpen(false);
          setStudentForLeave(null);
        }}
        student={studentForLeave}
        onSaveLeave={handleSaveStudentLeave}
      />

      {/* Shift Student to New Tutor Modal */}
      <ShiftTutorModal
        isOpen={isShiftTutorModalOpen}
        onClose={() => {
          setIsShiftTutorModalOpen(false);
          setStudentForShift(null);
        }}
        student={studentForShift}
        tutors={tutors}
        classes={classes}
        onConfirmShift={handleShiftStudentTutor}
      />

      {/* Master Student File & Academic Record Modal */}
      <StudentFolderModal
        isOpen={isDossierOpen}
        onClose={() => {
          setIsDossierOpen(false);
          setDossierStudent(null);
        }}
        student={dossierStudent}
        tutors={tutors}
        classes={classes}
        lessons={lessons}
        fees={fees}
        students={students}
        onEditStudent={(st) => {
          setIsDossierOpen(false);
          setSelectedStudent(st);
          setIsStudentModalOpen(true);
        }}
        onOpenFeeModal={(studentId) => {
          const stFee = fees.find(f => f.studentId === studentId) || null;
          setSelectedFee(stFee);
          setIsFeeModalOpen(true);
        }}
        onOpenLessonModal={(studentId) => {
          setSelectedStudentForLesson(studentId);
          setIsLessonModalOpen(true);
        }}
        onOpenShiftTutorModal={(st) => {
          setStudentForShift(st);
          setIsShiftTutorModalOpen(true);
        }}
        onRefreshData={onRefreshData}
      />

      {/* Strict Capitalized "DELETE" Confirmation Modal */}
      <StrictDeleteModal
        isOpen={!!deleteConfirmTarget}
        onClose={() => setDeleteConfirmTarget(null)}
        itemType={deleteConfirmTarget?.itemType || 'class'}
        title={deleteConfirmTarget?.title || ''}
        subtitle={deleteConfirmTarget?.description || ''}
        details={deleteConfirmTarget?.details}
        onConfirm={deleteConfirmTarget?.onConfirm || (() => {})}
      />

      {/* Floating Undo Toast for Instant Recovery */}
      <UndoToast
        item={undoToast}
        onClose={() => setUndoToast(null)}
        onUndo={handleUndoRestore}
      />

      {/* Admin Safety Audit Lightbox */}
      {activePreviewImage && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in cursor-zoom-out" onClick={() => setActivePreviewImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center justify-center bg-black/40 p-2 rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <img src={activePreviewImage} alt="Audit Preview" referrerPolicy="no-referrer" className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" />
            
            <div className="mt-3 flex items-center space-x-3 bg-white/95 p-2 rounded-xl shadow-lg border border-[#E3DFD7]">
              <a
                href={activePreviewImage}
                download="lesson-audit-screenshot.png"
                className="px-3.5 py-1.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-bold rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save to Audit Log</span>
              </a>
              <button
                onClick={() => setActivePreviewImage(null)}
                className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Close ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
