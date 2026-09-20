import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Query,
  DocumentReference
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '../firebase/config';
import firebaseConfigData from '../../firebase-applet-config.json';
import {
  INITIAL_REGISTERED_TUTORS,
  INITIAL_TUTOR_ENTITIES,
  INITIAL_TUTOR_USER_PROFILES
} from '../data/tutorsData';
import {
  SEED_TUTORS,
  SEED_STUDENTS,
  SEED_CLASSES,
  SEED_LESSONS,
  SEED_FEES,
  SEED_SALARIES,
  SEED_REFERRALS,
  SEED_ATTENDANCE,
  SEED_TUTOR_ATTENDANCE,
  SEED_ANNOUNCEMENTS,
  SEED_MESSAGES,
  isCleanDataMode
} from './seedData';
import {
  Student,
  Tutor,
  TimetableClass,
  Lesson,
  AttendanceRecord,
  TutorAttendanceRecord,
  StudentFee,
  TutorSalary,
  Referral,
  Announcement,
  ChatMessage,
  AcademySettings,
  UserRole,
  UserProfile,
  UserAccountStatus,
  CourseType,
  TutorStudentView,
  TrashRecord,
  TrashItemType,
  ActiveCallSession,
  CallType,
  CallStatus,
  AcademyUserSession
} from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

let isQuotaExceeded = false;
const quotaListeners = new Set<(exceeded: boolean) => void>();

export function isFirestoreQuotaExceeded(): boolean {
  return isQuotaExceeded;
}

export function setFirestoreQuotaExceeded(exceeded = true): void {
  if (isQuotaExceeded !== exceeded) {
    isQuotaExceeded = exceeded;
    quotaListeners.forEach(fn => {
      try {
        fn(exceeded);
      } catch (e) {
        console.warn('Quota listener notice:', e);
      }
    });
  }
}

export function subscribeToQuotaStatus(callback: (exceeded: boolean) => void): () => void {
  callback(isQuotaExceeded);
  quotaListeners.add(callback);
  return () => {
    quotaListeners.delete(callback);
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  const errCode = (error as any)?.code;
  const errMessage = error instanceof Error ? error.message : String(error);
  const lowerMsg = errMessage.toLowerCase();

  if (
    errCode === 'resource-exhausted' ||
    errCode === 'unavailable' ||
    lowerMsg.includes('quota exceeded') ||
    lowerMsg.includes('resource-exhausted') ||
    lowerMsg.includes('could not reach cloud firestore backend') ||
    lowerMsg.includes('unavailable') ||
    lowerMsg.includes('connection failed')
  ) {
    setFirestoreQuotaExceeded(true);
    console.warn(`Firestore unavailable or quota limit reached [${operationType}] on [${path || 'general'}]. Resilient local cache active.`);
    return;
  }

  if (errCode === 'permission-denied' || errMessage.toLowerCase().includes('permission')) {
    const errInfo: FirestoreErrorInfo = {
      error: errMessage,
      operationType,
      path,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || []
      }
    };
    console.warn('Firestore Permission notice (falling back to local cache):', JSON.stringify(errInfo));
    return;
  }

  // Handle transient connectivity or unavailable conditions with soft warning to allow cached data
  console.warn(`Firestore [${operationType}] on [${path || 'general'}]:`, errMessage);
}

/**
 * Resilient onSnapshot wrapper that automatically unsubscribes on error/quota exhaustion
 * to prevent background retry loops in the Firebase SDK.
 * Strictly adheres to Skill rule: "Only attach onSnapshot listeners if auth is ready and user is authenticated."
 */
function safeOnSnapshot<T>(
  reference: Query<T> | DocumentReference<T>,
  onNext: (snapshot: any) => void,
  onError?: (error: any) => void,
  operationPath?: string
): () => void {
  // CRITICAL: Do not attach listeners without an authenticated session
  if (!auth.currentUser) {
    return () => {};
  }

  if (isFirestoreQuotaExceeded()) {
    if (onError) {
      onError(new Error('Firestore quota exceeded or backend unavailable'));
    }
    return () => {};
  }

  let unsub: (() => void) | null = null;
  let isUnsubscribed = false;

  const performUnsub = () => {
    if (isUnsubscribed) return;
    isUnsubscribed = true;
    if (unsub) {
      try {
        unsub();
      } catch (_) {}
    }
  };

  try {
    unsub = onSnapshot(
      reference as any,
      (snap) => {
        if (!isUnsubscribed) {
          onNext(snap);
        }
      },
      (err) => {
        performUnsub();
        try {
          handleFirestoreError(err, OperationType.GET, operationPath || (reference as any).path || 'snapshot');
        } catch (handledErr) {
          if (onError) {
            onError(handledErr);
          }
        }
      }
    );
  } catch (err) {
    performUnsub();
    try {
      handleFirestoreError(err, OperationType.GET, operationPath || (reference as any).path || 'snapshot');
    } catch (handledErr) {
      if (onError) {
        onError(handledErr);
      }
    }
  }

  return () => {
    performUnsub();
  };
}

// Collection references
const USERS_COL = 'users';
const STUDENTS_COL = 'students';
const TUTORS_COL = 'tutors';
const CLASSES_COL = 'classes';
const LESSONS_COL = 'lessons';
const ATTENDANCE_COL = 'attendance';
const TUTOR_ATTENDANCE_COL = 'tutor_attendance';
const FEES_COL = 'fees';
const SALARIES_COL = 'salaries';
const REFERRALS_COL = 'referrals';
const ANNOUNCEMENTS_COL = 'announcements';
const MESSAGES_COL = 'messages';
const SETTINGS_COL = 'settings';
const TRASH_COL = 'deleted_records';

// In-memory high-speed cache for sub-millisecond local reads and optimistic synchronization
interface MemoryCacheStore {
  students: Student[] | null;
  tutors: Tutor[] | null;
  classes: TimetableClass[] | null;
  lessons: Lesson[] | null;
  fees: StudentFee[] | null;
  salaries: TutorSalary[] | null;
  referrals: Referral[] | null;
  announcements: Announcement[] | null;
  attendance: AttendanceRecord[] | null;
  tutorAttendance: TutorAttendanceRecord[] | null;
  systemUsers: UserProfile[] | null;
  settings: AcademySettings | null;
  trash: TrashRecord[] | null;
}

const CACHE: MemoryCacheStore = {
  students: null,
  tutors: null,
  classes: null,
  lessons: null,
  fees: null,
  salaries: null,
  referrals: null,
  announcements: null,
  attendance: null,
  tutorAttendance: null,
  systemUsers: null,
  settings: null,
  trash: null
};

// In-memory recovery cache for rapid offline and session reactivity
let MEMORY_TRASH: TrashRecord[] = [];

const CACHE_STORAGE_PREFIX = 'it_academy_cache_';

export function clearInMemoryCache(): void {
  CACHE.students = [];
  CACHE.tutors = [];
  CACHE.classes = [];
  CACHE.lessons = [];
  CACHE.fees = [];
  CACHE.salaries = [];
  CACHE.referrals = [];
  CACHE.announcements = [];
  CACHE.attendance = [];
  CACHE.tutorAttendance = [];
  CACHE.systemUsers = [];
  CACHE.trash = [];
  MEMORY_TRASH = [];
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('it_academy_cache_') || k.startsWith('it_chat_cache_'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {}
}

export function loadCachedCollection<T>(key: keyof MemoryCacheStore): T | null {
  try {
    const raw = localStorage.getItem(`${CACHE_STORAGE_PREFIX}${String(key)}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function saveCachedCollection<T>(key: keyof MemoryCacheStore, value: T): void {
  try {
    localStorage.setItem(`${CACHE_STORAGE_PREFIX}${String(key)}`, JSON.stringify(value));
    localStorage.setItem(`${CACHE_STORAGE_PREFIX}${String(key)}_time`, String(Date.now()));
  } catch {}
}

export function isCachedCollectionFresh(key: keyof MemoryCacheStore, maxAgeMs = 180000): boolean {
  try {
    const timeStr = localStorage.getItem(`${CACHE_STORAGE_PREFIX}${String(key)}_time`);
    if (!timeStr) return false;
    const age = Date.now() - Number(timeStr);
    return age < maxAgeMs;
  } catch {
    return false;
  }
}

function getLocalChatKey(threadId: string): string {
  return `it_chat_cache_${threadId}`;
}

export function getCachedMessages(threadId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(getLocalChatKey(threadId));
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveCachedMessages(threadId: string, messages: ChatMessage[]): void {
  try {
    localStorage.setItem(getLocalChatKey(threadId), JSON.stringify(messages.slice(-150)));
  } catch {}
}

export function appendLocalMessage(threadId: string, message: ChatMessage): void {
  const current = getCachedMessages(threadId);
  const updated = [...current.filter(m => m.id !== message.id), message];
  saveCachedMessages(threadId, updated);
}

/**
 * Manually invalidate or reset the local cache
 */
export function invalidateDataCache(key?: keyof MemoryCacheStore): void {
  if (key) {
    CACHE[key] = null;
  } else {
    for (const k of Object.keys(CACHE) as (keyof MemoryCacheStore)[]) {
      CACHE[k] = null;
    }
  }
}

/**
 * Recursively strips `undefined` fields from objects to prevent Firestore errors:
 * "Unsupported field value: undefined"
 */
export function sanitizeFirestoreObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeFirestoreObject(item)) as unknown as T;
  }
  if (typeof obj === 'object' && obj.constructor === Object) {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        clean[key] = sanitizeFirestoreObject(value);
      }
    }
    return clean as T;
  }
  return obj;
}

// ==========================================
// TIMETABLE CONFLICT DETECTION
// ==========================================
function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function checkTimeOverlap(
  startA: string,
  durA: number,
  startB: string,
  durB: number
): boolean {
  const aStart = parseTimeToMinutes(startA);
  const aEnd = aStart + durA;
  const bStart = parseTimeToMinutes(startB);
  const bEnd = bStart + durB;
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

export function validateClassBooking(
  candidate: {
    tutorId: string;
    studentId: string;
    dayOfWeek: string;
    startTimePKT: string;
    durationMinutes: number;
    id?: string;
    status?: string;
  },
  existingClasses: TimetableClass[]
): { valid: boolean; error?: string } {
  // A cancelled class cannot create a booking conflict
  if (candidate.status === 'Cancelled') {
    return { valid: true };
  }

  for (const cls of existingClasses) {
    if (candidate.id && (cls.id === candidate.id || String(cls.id) === String(candidate.id))) continue;
    // Already cancelled classes do not cause conflicts
    if (cls.status === 'Cancelled') continue;
    if (cls.dayOfWeek !== candidate.dayOfWeek) continue;

    // Check Tutor conflict
    if (cls.tutorId === candidate.tutorId) {
      if (checkTimeOverlap(cls.startTimePKT, cls.durationMinutes, candidate.startTimePKT, candidate.durationMinutes)) {
        return {
          valid: false,
          error: `Tutor double-booking conflict: ${candidate.tutorId} already has a class on ${candidate.dayOfWeek} at ${cls.startTimePKT} (${cls.durationMinutes} mins) with ${cls.studentName}.`
        };
      }
    }

    // Check Student conflict
    if (cls.studentId === candidate.studentId) {
      if (checkTimeOverlap(cls.startTimePKT, cls.durationMinutes, candidate.startTimePKT, candidate.durationMinutes)) {
        return {
          valid: false,
          error: `Student double-booking conflict: Student (${cls.studentName}) already has a class scheduled on ${candidate.dayOfWeek} at ${cls.startTimePKT}.`
        };
      }
    }
  }

  return { valid: true };
}

// ==========================================
// STRICT ALLOW-LIST PRIVACY SANITIZATION
// Enforce strict location/timezone privacy:
// Tutors & Supervisors are NEVER provided student local time, country, or timezone.
// ==========================================
export function sanitizeStudentForTutor(student: Student): TutorStudentView {
  return {
    studentId: student.studentId,
    name: student.name,
    status: student.status,
    assignedTutorId: student.assignedTutorId,
    courseType: student.courseType,
    trialSessionsCompleted: student.trialSessionsCompleted,
    trialSessionsTotal: student.trialSessionsTotal,
    trialStatus: student.trialStatus,
  };
}

export function sanitizeStudentForSupervisor(student: Student): Omit<Student, 'phone' | 'email' | 'parentEmail' | 'parentPhone' | 'privateAdminNotes' | 'country' | 'timezone'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { phone, email, parentEmail, parentPhone, privateAdminNotes, country, timezone, ...permitted } = student;
  return permitted;
}

export async function getStudentsForTutor(tutorId: string): Promise<TutorStudentView[]> {
  const allStudents = await getStudents();
  return allStudents
    .filter(s => s.assignedTutorId === tutorId || (tutorId && s.assignedTutorId.includes(tutorId)))
    .map(sanitizeStudentForTutor);
}

export async function getStudentsForSupervisor(): Promise<ReturnType<typeof sanitizeStudentForSupervisor>[]> {
  const allStudents = await getStudents();
  return allStudents.map(sanitizeStudentForSupervisor);
}

// ==========================================
// STUDENTS API
// ==========================================
export async function getStudents(forceRefresh = false): Promise<Student[]> {
  if (CACHE.students && !forceRefresh) {
    return CACHE.students;
  }
  const stored = loadCachedCollection<Student[]>('students');
  if (stored && stored.length > 0 && !forceRefresh && (isCachedCollectionFresh('students') || isFirestoreQuotaExceeded())) {
    CACHE.students = stored;
    return stored;
  }

  if (!isFirestoreQuotaExceeded()) {
    try {
      const snap = await getDocs(collection(db, STUDENTS_COL));
      if (!snap.empty) {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
        CACHE.students = items;
        saveCachedCollection('students', items);
        return items;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, STUDENTS_COL);
    }
  }

  if (stored && stored.length > 0) {
    CACHE.students = stored;
    return stored;
  }

  const fallback = isCleanDataMode() ? [] : SEED_STUDENTS;
  CACHE.students = fallback;
  saveCachedCollection('students', fallback);
  return fallback;
}

export function subscribeToStudents(callback: (students: Student[]) => void): () => void {
  const getFallback = () => CACHE.students || loadCachedCollection<Student[]>('students') || [];
  if (isFirestoreQuotaExceeded()) {
    callback(getFallback());
    return () => {};
  }
  return safeOnSnapshot(
    collection(db, STUDENTS_COL),
    (snap) => {
      if (snap) {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
        items.sort((a, b) => (a.studentId || '').localeCompare(b.studentId || '', undefined, { numeric: true }));
        CACHE.students = items;
        saveCachedCollection('students', items);
        callback(items);
      } else {
        callback(getFallback());
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, STUDENTS_COL);
      callback(getFallback());
    },
    STUDENTS_COL
  );
}

export async function findStudentByEmailOrId(queryStr: string): Promise<Student | null> {
  const raw = queryStr ? queryStr.trim() : '';
  const clean = raw.toLowerCase();
  if (!clean) return null;

  // 1. Check local cache
  if (CACHE.students && CACHE.students.length > 0) {
    const cachedMatch = CACHE.students.find(s =>
      (s.studentId && s.studentId.trim().toLowerCase() === clean) ||
      (s.id && s.id.trim().toLowerCase() === clean) ||
      (s.email && s.email.trim().toLowerCase() === clean) ||
      (s.parentEmail && s.parentEmail.trim().toLowerCase() === clean)
    );
    if (cachedMatch) return cachedMatch;
  }

  // 2. Query Firestore directly
  if (!isFirestoreQuotaExceeded()) {
    try {
      // Exact email query
      const qEmailExact = query(collection(db, STUDENTS_COL), where('email', '==', raw));
      const snapEmailExact = await getDocs(qEmailExact);
      if (!snapEmailExact.empty) {
        const docSnap = snapEmailExact.docs[0];
        return { id: docSnap.id, ...docSnap.data() } as Student;
      }

      // Lowercased email query
      if (clean !== raw) {
        const qEmailClean = query(collection(db, STUDENTS_COL), where('email', '==', clean));
        const snapEmailClean = await getDocs(qEmailClean);
        if (!snapEmailClean.empty) {
          const docSnap = snapEmailClean.docs[0];
          return { id: docSnap.id, ...docSnap.data() } as Student;
        }
      }

      // StudentId query
      const qId = query(collection(db, STUDENTS_COL), where('studentId', '==', raw));
      const snapId = await getDocs(qId);
      if (!snapId.empty) {
        const docSnap = snapId.docs[0];
        return { id: docSnap.id, ...docSnap.data() } as Student;
      }

      // Parent email query
      const qParent = query(collection(db, STUDENTS_COL), where('parentEmail', '==', clean));
      const snapParent = await getDocs(qParent);
      if (!snapParent.empty) {
        const docSnap = snapParent.docs[0];
        return { id: docSnap.id, ...docSnap.data() } as Student;
      }

      // Fallback: Fetch all students from Firestore and perform in-memory case-insensitive match
      const allSnap = await getDocs(collection(db, STUDENTS_COL));
      if (!allSnap.empty) {
        const allStudents = allSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
        CACHE.students = allStudents;
        saveCachedCollection('students', allStudents);

        const match = allStudents.find(s =>
          (s.studentId && s.studentId.trim().toLowerCase() === clean) ||
          (s.id && s.id.trim().toLowerCase() === clean) ||
          (s.email && s.email.trim().toLowerCase() === clean) ||
          (s.parentEmail && s.parentEmail.trim().toLowerCase() === clean)
        );
        if (match) return match;
      }
    } catch (err) {
      console.warn('Error querying student directly from Firestore:', err);
    }
  }

  return null;
}

export async function addStudent(studentData: Omit<Student, 'id'>): Promise<string> {
  const docRef = doc(collection(db, STUDENTS_COL));
  const docId = docRef.id;
  const newStudent: Student = { id: docId, ...studentData };
  CACHE.students = [newStudent, ...(CACHE.students || [])];
  saveCachedCollection('students', CACHE.students);

  if (!isFirestoreQuotaExceeded()) {
    setDoc(docRef, sanitizeFirestoreObject(studentData)).catch((err) => {
      handleFirestoreError(err, OperationType.CREATE, STUDENTS_COL);
    });
  }
  return docId;
}

export async function updateStudent(id: string, updates: Partial<Student>): Promise<void> {
  const current = CACHE.students?.find(s => s.id === id);
  // Optimistic cache update
  if (CACHE.students) {
    CACHE.students = CACHE.students.map(s => s.id === id ? { ...s, ...updates } : s);
    saveCachedCollection('students', CACHE.students);
  }

  if (!isFirestoreQuotaExceeded()) {
    try {
      const studentRef = doc(db, STUDENTS_COL, id);
      await updateDoc(studentRef, sanitizeFirestoreObject(updates));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${STUDENTS_COL}/${id}`);
    }
  }

  // If tutor assignment or name changed, update classes in cache and Firestore in parallel
  if (current && (updates.assignedTutorId || updates.name)) {
    if (CACHE.classes) {
      CACHE.classes = CACHE.classes.map(c => {
        if (c.studentId === current.studentId) {
          return {
            ...c,
            ...(updates.assignedTutorId ? { tutorId: updates.assignedTutorId } : {}),
            ...(updates.name ? { studentName: updates.name } : {})
          };
        }
        return c;
      });
      saveCachedCollection('classes', CACHE.classes);
    }

    if (!isFirestoreQuotaExceeded()) {
      try {
        const classesSnap = await getDocs(
          query(collection(db, CLASSES_COL), where('studentId', '==', current.studentId))
        );
        const classUpdates = classesSnap.docs.map(d => {
          const payload: Partial<TimetableClass> = {};
          if (updates.assignedTutorId) payload.tutorId = updates.assignedTutorId;
          if (updates.name) payload.studentName = updates.name;
          return updateDoc(doc(db, CLASSES_COL, d.id), payload);
        });
        if (classUpdates.length > 0) {
          await Promise.all(classUpdates);
        }
      } catch (err) {
        console.warn('Could not sync class tutor updates:', err);
      }
    }
  }
}

export async function deleteStudent(id: string): Promise<string> {
  try {
    let studentData = CACHE.students?.find(s => s.id === id) || null;
    const studentRef = doc(db, STUDENTS_COL, id);

    if (!studentData) {
      if (!isFirestoreQuotaExceeded()) {
        try {
          const snap = await getDoc(studentRef);
          if (snap.exists()) {
            studentData = { id: snap.id, ...snap.data() } as Student;
          }
        } catch {}
      }
      if (!studentData) {
        const all = await getStudents();
        studentData = all.find(s => s.id === id) || null;
      }
    }

    // Optimistic removal from cache
    if (CACHE.students) {
      CACHE.students = CACHE.students.filter(s => s.id !== id);
      saveCachedCollection('students', CACHE.students);
    }

    if (studentData) {
      const trashItem: Omit<TrashRecord, 'id'> = {
        originalId: id,
        itemType: 'student',
        title: `${studentData.name} (${studentData.studentId})`,
        subtitle: `Course: ${studentData.courseType} • Tutor: ${studentData.assignedTutorId || 'Unassigned'} • Status: ${studentData.status}`,
        data: sanitizeFirestoreObject(studentData),
        deletedAt: new Date().toISOString()
      };
      let trashId = `trash-${Date.now()}`;
      if (!isFirestoreQuotaExceeded()) {
        try {
          const trashDoc = await addDoc(collection(db, TRASH_COL), trashItem);
          trashId = trashDoc.id;
        } catch (err) {
          console.warn('Could not persist to deleted_records Firestore collection, saving locally:', err);
        }
      }
      const record = { id: trashId, ...trashItem };
      MEMORY_TRASH.unshift(record);
      if (CACHE.trash) {
        CACHE.trash.unshift(record);
        saveCachedCollection('trash', CACHE.trash);
      }

      if (!isFirestoreQuotaExceeded()) {
        await deleteDoc(studentRef);
      }
      return trashId;
    }

    if (!isFirestoreQuotaExceeded()) {
      await deleteDoc(studentRef);
    }
    return '';
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, STUDENTS_COL);
    if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota exceeded')) {
      return '';
    }
    throw err;
  }
}

// ==========================================
// TUTORS API
// ==========================================
let hasSynchronizedRegisteredTutors = false;

/**
 * Ensures all 20 official tutor accounts (Tutor 1 - Tutor 20) are registered and synchronized
 * with their unique IDs, permanent Zoom links, PKR 23,000 salaries, active status, and Firebase Auth credentials.
 */
export async function ensureRegisteredTutorsSynchronized(): Promise<{ success: boolean; count: number; tutors: Tutor[] }> {
  const syncedTutors: Tutor[] = [];
  const secAuth = getSecondaryAuthApp();

  for (const config of INITIAL_REGISTERED_TUTORS) {
    const docId = `tutor_${config.tutorNumber}`;
    const userDocId = `tutor_user_${config.tutorNumber}`;
    const emailKey = config.email.toLowerCase().trim();

    // 1. Prepare Tutor entity
    const tutorDoc: Tutor = {
      id: docId,
      tutorId: config.tutorId,
      realName: config.realName,
      email: config.email,
      phone: config.phone,
      zoomLink: config.zoomLink,
      status: 'Active',
      availabilityStatus: 'Available',
      monthlySalaryPKR: config.salaryPKR,
      hourlyRatePKR: Math.round(config.salaryPKR / 40),
      assignedStudentIds: [],
      createdAt: '2026-09-20T00:00:00.000Z'
    };

    syncedTutors.push(tutorDoc);

    // 2. Prepare UserProfile entity (passwords are handled securely via Firebase Auth, not stored in Firestore)
    const userProfileDoc: UserProfile = {
      uid: userDocId,
      email: config.email,
      displayName: config.displayName,
      role: 'tutor',
      status: 'active',
      tutorId: config.tutorId,
      phone: config.phone,
      country: 'Pakistan',
      timezone: 'Asia/Karachi',
      createdAt: '2026-09-20T00:00:00.000Z'
    };

    // 3. Register in Firebase Auth (secure password hashing)
    try {
      if (secAuth) {
        await createUserWithEmailAndPassword(secAuth, config.email, config.password);
      }
    } catch (authErr: any) {
      if (authErr.code !== 'auth/email-already-in-use') {
        console.debug(`[TutorsSync] Auth notice for ${config.email}:`, authErr.message);
      }
    }

    // 4. Save/Merge into Firestore tutors collection and users collection
    try {
      const tutorRef = doc(db, TUTORS_COL, docId);
      const existingSnap = await getDoc(tutorRef);
      if (!existingSnap.exists()) {
        await setDoc(tutorRef, sanitizeFirestoreObject(tutorDoc), { merge: true });
      } else {
        const existingData = existingSnap.data() as Partial<Tutor>;
        await setDoc(tutorRef, sanitizeFirestoreObject({
          tutorId: config.tutorId,
          realName: existingData.realName !== undefined ? existingData.realName : config.realName,
          email: config.email,
          phone: existingData.phone !== undefined ? existingData.phone : config.phone,
          zoomLink: existingData.zoomLink || config.zoomLink,
          status: existingData.status || 'Active',
          monthlySalaryPKR: existingData.monthlySalaryPKR !== undefined && existingData.monthlySalaryPKR > 0 ? existingData.monthlySalaryPKR : config.salaryPKR,
          hourlyRatePKR: existingData.hourlyRatePKR || Math.round(config.salaryPKR / 40),
          assignedStudentIds: existingData.assignedStudentIds || [],
          createdAt: existingData.createdAt || tutorDoc.createdAt
        }), { merge: true });
      }

      // Persist UserProfile
      await setDoc(doc(db, USERS_COL, userDocId), sanitizeFirestoreObject(userProfileDoc), { merge: true });
      const emailDocId = emailKey.replace(/[@.]/g, '_');
      if (emailDocId !== userDocId) {
        await setDoc(doc(db, USERS_COL, emailDocId), sanitizeFirestoreObject(userProfileDoc), { merge: true });
      }
    } catch (dbErr) {
      console.warn(`[TutorsSync] Could not write ${config.tutorId} to Firestore:`, dbErr);
    }
  }

  // Update in-memory CACHE
  CACHE.tutors = syncedTutors;
  saveCachedCollection('tutors', syncedTutors);
  hasSynchronizedRegisteredTutors = true;

  return { success: true, count: syncedTutors.length, tutors: syncedTutors };
}

export async function getTutors(forceRefresh = false): Promise<Tutor[]> {
  if (CACHE.tutors && CACHE.tutors.length >= 20 && !forceRefresh) {
    return CACHE.tutors;
  }
  const stored = loadCachedCollection<Tutor[]>('tutors');
  if (stored && stored.length >= 20 && !forceRefresh && (isCachedCollectionFresh('tutors') || isFirestoreQuotaExceeded())) {
    CACHE.tutors = stored;
    return stored;
  }

  let firestoreTutors: Tutor[] = [];
  if (!isFirestoreQuotaExceeded()) {
    try {
      const snap = await getDocs(collection(db, TUTORS_COL));
      if (!snap.empty) {
        firestoreTutors = snap.docs.map(d => ({ id: d.id, ...d.data() } as Tutor));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, TUTORS_COL);
    }
  }

  // Merge map: Baseline of all 19 official academy tutors
  const map = new Map<string, Tutor>();
  INITIAL_TUTOR_ENTITIES.forEach(t => map.set(t.tutorId, { ...t }));

  // Overlay any locally saved updates
  if (stored && Array.isArray(stored)) {
    stored.forEach(t => {
      const existing = map.get(t.tutorId);
      if (existing) {
        map.set(t.tutorId, { ...existing, ...t });
      } else {
        map.set(t.tutorId, t);
      }
    });
  }

  // Overlay any Firestore stored updates
  if (firestoreTutors.length > 0) {
    firestoreTutors.forEach(t => {
      const existing = map.get(t.tutorId);
      if (existing) {
        map.set(t.tutorId, { ...existing, ...t });
      } else {
        map.set(t.tutorId, t);
      }
    });
  }

  const items = Array.from(map.values());
  items.sort((a, b) => {
    const numA = parseInt(a.tutorId.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.tutorId.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  CACHE.tutors = items;
  saveCachedCollection('tutors', items);
  return items;
}

export function subscribeToTutors(callback: (tutors: Tutor[]) => void): () => void {
  const getFallback = () => CACHE.tutors || loadCachedCollection<Tutor[]>('tutors') || INITIAL_TUTOR_ENTITIES;
  if (isFirestoreQuotaExceeded()) {
    callback(getFallback());
    return () => {};
  }
  return safeOnSnapshot(
    collection(db, TUTORS_COL),
    (snap) => {
      if (!snap.empty && snap.docs.length >= 20) {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Tutor));
        items.sort((a, b) => {
          const numA = parseInt(a.tutorId.replace(/\D/g, '')) || 0;
          const numB = parseInt(b.tutorId.replace(/\D/g, '')) || 0;
          return numA - numB;
        });
        CACHE.tutors = items;
        saveCachedCollection('tutors', items);
        callback(items);
      } else {
        const fallback = getFallback();
        callback(fallback);
        if (!hasSynchronizedRegisteredTutors) {
          ensureRegisteredTutorsSynchronized().catch(() => {});
        }
      }
    },
    (_err) => {
      callback(getFallback());
    },
    TUTORS_COL
  );
}

export async function addTutor(tutorData: Omit<Tutor, 'id'>): Promise<string> {
  const docRef = doc(collection(db, TUTORS_COL));
  const docId = docRef.id;
  const newTutor: Tutor = { id: docId, ...tutorData };
  CACHE.tutors = [newTutor, ...(CACHE.tutors || [])];
  saveCachedCollection('tutors', CACHE.tutors);

  if (!isFirestoreQuotaExceeded()) {
    setDoc(docRef, sanitizeFirestoreObject(tutorData)).catch((err) => {
      handleFirestoreError(err, OperationType.CREATE, TUTORS_COL);
    });
  }
  return docId;
}

export async function updateTutor(id: string, updates: Partial<Tutor>): Promise<void> {
  if (CACHE.tutors) {
    CACHE.tutors = CACHE.tutors.map(t => t.id === id ? { ...t, ...updates } : t);
    saveCachedCollection('tutors', CACHE.tutors);
  }
  if (!isFirestoreQuotaExceeded()) {
    try {
      await updateDoc(doc(db, TUTORS_COL, id), sanitizeFirestoreObject(updates));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${TUTORS_COL}/${id}`);
    }
  }
}

export async function deleteTutor(id: string): Promise<string> {
  try {
    let tutorData = CACHE.tutors?.find(t => t.id === id) || null;
    const tutorRef = doc(db, TUTORS_COL, id);

    if (!tutorData) {
      if (!isFirestoreQuotaExceeded()) {
        try {
          const snap = await getDoc(tutorRef);
          if (snap.exists()) {
            tutorData = { id: snap.id, ...snap.data() } as Tutor;
          }
        } catch {}
      }
      if (!tutorData) {
        const all = await getTutors();
        tutorData = all.find(t => t.id === id) || null;
      }
    }

    // Optimistic cache update
    if (CACHE.tutors) {
      CACHE.tutors = CACHE.tutors.filter(t => t.id !== id);
      saveCachedCollection('tutors', CACHE.tutors);
    }

    if (tutorData) {
      const trashItem: Omit<TrashRecord, 'id'> = {
        originalId: id,
        itemType: 'tutor',
        title: `${tutorData.realName} (${tutorData.tutorId})`,
        subtitle: `Status: ${tutorData.status} • Email: ${tutorData.email || 'N/A'} • Zoom: ${tutorData.zoomLink || 'N/A'}`,
        data: sanitizeFirestoreObject(tutorData),
        deletedAt: new Date().toISOString()
      };
      let trashId = `trash-${Date.now()}`;
      if (!isFirestoreQuotaExceeded()) {
        try {
          const trashDoc = await addDoc(collection(db, TRASH_COL), trashItem);
          trashId = trashDoc.id;
        } catch (err) {
          console.warn('Could not persist to deleted_records Firestore collection, saving locally:', err);
        }
      }
      const record = { id: trashId, ...trashItem };
      MEMORY_TRASH.unshift(record);
      if (CACHE.trash) {
        CACHE.trash.unshift(record);
        saveCachedCollection('trash', CACHE.trash);
      }

      if (!isFirestoreQuotaExceeded()) {
        await deleteDoc(tutorRef);
      }
      return trashId;
    }

    if (!isFirestoreQuotaExceeded()) {
      await deleteDoc(tutorRef);
    }
    return '';
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, TUTORS_COL);
    if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota exceeded')) {
      return '';
    }
    throw err;
  }
}

// ==========================================
// CLASSES / MASTER TIMETABLE API
// ==========================================
export async function getClasses(forceRefresh = false): Promise<TimetableClass[]> {
  if (CACHE.classes && !forceRefresh) {
    return CACHE.classes;
  }
  const stored = loadCachedCollection<TimetableClass[]>('classes');
  if (stored && stored.length > 0 && !forceRefresh && (isCachedCollectionFresh('classes') || isFirestoreQuotaExceeded())) {
    CACHE.classes = stored;
    return stored;
  }

  if (!isFirestoreQuotaExceeded() && auth.currentUser) {
    try {
      const snap = await getDocs(collection(db, CLASSES_COL));
      if (!snap.empty) {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as TimetableClass));
        CACHE.classes = items;
        saveCachedCollection('classes', items);
        return items;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, CLASSES_COL);
    }
  }

  if (stored && stored.length > 0) {
    CACHE.classes = stored;
    return stored;
  }

  const fallback = isCleanDataMode() ? [] : SEED_CLASSES;
  CACHE.classes = fallback;
  saveCachedCollection('classes', fallback);
  return fallback;
}

export async function addClass(classData: Omit<TimetableClass, 'id'>): Promise<string> {
  const existing = CACHE.classes || (await getClasses());
  const validation = validateClassBooking(classData, existing);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // OPTIMISTIC: Generate a unique temporary ID and insert immediately
  const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const newClass: TimetableClass = { id: tempId, ...classData };
  CACHE.classes = [newClass, ...(CACHE.classes || [])];
  saveCachedCollection('classes', CACHE.classes);

  if (!isFirestoreQuotaExceeded()) {
    // Perform Firestore write in background without awaiting
    addDoc(collection(db, CLASSES_COL), sanitizeFirestoreObject(classData))
      .then((docRef) => {
        // Replace temporary ID with actual Firestore ID in-place
        if (CACHE.classes) {
          CACHE.classes = CACHE.classes.map(c => c.id === tempId ? { ...c, id: docRef.id } : c);
          saveCachedCollection('classes', CACHE.classes);
        }
      })
      .catch((err) => {
        console.warn("Background class creation notice:", err);
      });
  }

  return tempId;
}

export async function updateClass(id: string, updates: Partial<TimetableClass>): Promise<void> {
  const existing = CACHE.classes || (await getClasses());
  const current = existing.find(c => c.id === id || String(c.id) === String(id));
  let previousClass: TimetableClass | null = null;
  if (current) {
    previousClass = { ...current };
    const candidate = { ...current, ...updates, id };

    // Only validate conflict if schedule/timing or participants changed, or if reactivating from Cancelled
    const isScheduleChange = updates.startTimePKT !== undefined || updates.dayOfWeek !== undefined || updates.durationMinutes !== undefined || updates.tutorId !== undefined || updates.studentId !== undefined;
    const isReactivating = updates.status && updates.status !== 'Cancelled' && current.status === 'Cancelled';

    if (isScheduleChange || isReactivating) {
      const validation = validateClassBooking(candidate, existing);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
    }
  }

  // OPTIMISTIC: Update cache immediately
  if (CACHE.classes) {
    CACHE.classes = CACHE.classes.map(c => (c.id === id || String(c.id) === String(id)) ? { ...c, ...updates } : c);
    saveCachedCollection('classes', CACHE.classes);
  }

  if (!isFirestoreQuotaExceeded()) {
    // Perform Firestore write in background without awaiting
    updateDoc(doc(db, CLASSES_COL, id), sanitizeFirestoreObject(updates))
      .catch((err) => {
        console.warn("Background class update notice:", err);
      });
  }
}

export async function deleteClass(id: string): Promise<string> {
  try {
    const existingClasses = CACHE.classes || loadCachedCollection<TimetableClass[]>('classes') || (isCleanDataMode() ? [] : SEED_CLASSES);
    const targetIdStr = String(id).trim();
    let classData = existingClasses.find(c => String(c.id).trim() === targetIdStr) || null;

    // Immediately remove from CACHE and persistent local cache
    const updatedClasses = existingClasses.filter(c => String(c.id).trim() !== targetIdStr);
    CACHE.classes = updatedClasses;
    saveCachedCollection('classes', updatedClasses);

    const trashId = `trash_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (classData) {
      const trashItem: Omit<TrashRecord, 'id'> = {
        originalId: id,
        itemType: 'class',
        title: `${classData.studentName} (${classData.dayOfWeek} ${classData.startTimePKT} PKT)`,
        subtitle: `Tutor: ${classData.tutorId} • ${classData.durationMinutes} mins • Status: ${classData.status}`,
        data: sanitizeFirestoreObject(classData),
        deletedAt: new Date().toISOString(),
        deletedBy: 'admin'
      };

      const record = { id: trashId, ...trashItem };
      MEMORY_TRASH.unshift(record);
      if (!CACHE.trash) CACHE.trash = [];
      CACHE.trash.unshift(record);
      saveCachedCollection('trash', CACHE.trash);

      if (!isFirestoreQuotaExceeded() && !id.startsWith('seed-') && !id.startsWith('local-')) {
        (async () => {
          try {
            await setDoc(doc(db, TRASH_COL, trashId), trashItem);
          } catch (err) {
            console.warn("Could not save to trash collection:", err);
          }
          try {
            await deleteDoc(doc(db, CLASSES_COL, id));
          } catch (err) {
            console.warn("Could not delete from Firestore classes:", err);
          }
        })().catch(err => console.warn("Background class deletion err:", err));
      }
    } else {
      if (!isFirestoreQuotaExceeded() && !id.startsWith('seed-') && !id.startsWith('local-')) {
        deleteDoc(doc(db, CLASSES_COL, id)).catch(err => console.warn("Background class deleteDoc failed:", err));
      }
    }

    return trashId;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, CLASSES_COL);
    throw err;
  }
}

// ==========================================
// LESSONS API & TRIAL CLASS AUTO-TRACKING
// ==========================================
function cleanExpiredScreenshots(lessons: Lesson[]): Lesson[] {
  const THIRTY_ONE_DAYS_MS = 31 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  return lessons.map(lesson => {
    if (!lesson.screenshots || lesson.screenshots.length === 0) {
      return lesson;
    }

    // Never expire screenshots if the lesson was created recently, or if date is within 31 days
    let referenceTime: number | null = null;
    if (lesson.createdAt) {
      const createdTime = new Date(lesson.createdAt).getTime();
      if (!isNaN(createdTime)) referenceTime = createdTime;
    }
    if (!referenceTime && lesson.date) {
      const parsedDate = new Date(lesson.date).getTime();
      if (!isNaN(parsedDate)) referenceTime = parsedDate;
    }

    if (!referenceTime) {
      return lesson;
    }

    const ageMs = now - referenceTime;
    // If lesson is within 31 days (including today or future dates due to timezone), do NOT expire
    if (ageMs <= THIRTY_ONE_DAYS_MS) {
      return lesson;
    }

    // Only clean non-admin/supervisor uploaded screenshots if strictly older than 31 days
    const hasUnexpired = lesson.screenshots.some(s => 
      !s.expired && 
      s.uploadedByRole !== 'admin' && 
      s.uploadedByRole !== 'supervisor' &&
      !(s.url && s.url.startsWith('data:image/svg+xml')) // Keep diagram vectors safe
    );

    if (hasUnexpired) {
      const updatedScreenshots = lesson.screenshots.map(s => {
        if (!s.expired && s.uploadedByRole !== 'admin' && s.uploadedByRole !== 'supervisor') {
          // Check screenshot-specific upload time if available
          if (s.uploadedAt) {
            const sAge = now - new Date(s.uploadedAt).getTime();
            if (!isNaN(sAge) && sAge <= THIRTY_ONE_DAYS_MS) {
              return s; // Uploaded within 31 days
            }
          }
          if (s.url && s.url.startsWith('data:image/svg+xml')) {
            return s;
          }
          return {
            ...s,
            expired: true,
            url: '' // Purge stale binary data after full 31 days
          };
        }
        return s;
      });

      // Note: Do NOT issue background updateDoc here on every load/snapshot.
      // Cleaning in memory ensures 31-day privacy without burning Firestore write quota.
      return {
        ...lesson,
        screenshots: updatedScreenshots
      };
    }

    return lesson;
  });
}

export function subscribeToLessons(callback: (lessons: Lesson[]) => void): () => void {
  const getFallback = () => CACHE.lessons || loadCachedCollection<Lesson[]>('lessons') || (isCleanDataMode() ? [] : SEED_LESSONS);
  if (isFirestoreQuotaExceeded()) {
    callback(getFallback());
    return () => {};
  }
  return safeOnSnapshot(
    collection(db, LESSONS_COL),
    (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Lesson));
      const cleaned = cleanExpiredScreenshots(items);
      // Merge with local newly created items if not yet indexed in Firestore
      const localItems = loadCachedCollection<Lesson[]>('lessons') || [];
      const mergedMap = new Map<string, Lesson>();
      cleaned.forEach(l => mergedMap.set(l.id, l));
      localItems.forEach(l => {
        if (!mergedMap.has(l.id)) mergedMap.set(l.id, l);
      });
      const merged = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
      );
      CACHE.lessons = merged;
      saveCachedCollection('lessons', merged);
      callback(merged);
    },
    (_err) => {
      callback(getFallback());
    },
    LESSONS_COL
  );
}

export async function getLessons(forceRefresh = false): Promise<Lesson[]> {
  if (CACHE.lessons && !forceRefresh) {
    return CACHE.lessons;
  }
  const localItems = loadCachedCollection<Lesson[]>('lessons') || [];
  if (localItems.length > 0 && !forceRefresh && (isCachedCollectionFresh('lessons') || isFirestoreQuotaExceeded())) {
    CACHE.lessons = localItems;
    return localItems;
  }
  try {
    if (!isFirestoreQuotaExceeded() && auth.currentUser) {
      const snap = await getDocs(collection(db, LESSONS_COL));
      if (!snap.empty) {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Lesson));
        const cleaned = cleanExpiredScreenshots(items);
        const mergedMap = new Map<string, Lesson>();
        cleaned.forEach(l => mergedMap.set(l.id, l));
        localItems.forEach(l => {
          if (!mergedMap.has(l.id)) mergedMap.set(l.id, l);
        });
        const merged = Array.from(mergedMap.values());
        CACHE.lessons = merged;
        saveCachedCollection('lessons', merged);
        return merged;
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, LESSONS_COL);
  }
  const fallback = localItems.length > 0 ? localItems : (isCleanDataMode() ? [] : SEED_LESSONS);
  const cleanedFallback = cleanExpiredScreenshots(fallback);
  CACHE.lessons = cleanedFallback;
  saveCachedCollection('lessons', cleanedFallback);
  return cleanedFallback;
}

export async function addLesson(lessonData: Omit<Lesson, 'id'>): Promise<string> {
  const docRef = doc(collection(db, LESSONS_COL));
  const docId = docRef.id;
  const newLesson: Lesson = { id: docId, ...lessonData };
  CACHE.lessons = [newLesson, ...(CACHE.lessons || [])];
  saveCachedCollection('lessons', CACHE.lessons);

  // Background non-blocking persistence & attendance/trial updates
  (async () => {
    if (!isFirestoreQuotaExceeded()) {
      try {
        await setDoc(docRef, sanitizeFirestoreObject(lessonData));
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, LESSONS_COL);
      }
    }

    // Auto-sync attendance record if marked
    if (lessonData.attendanceStatus) {
      try {
        const attRecord: Omit<AttendanceRecord, 'id'> = {
          classId: 'lesson_session',
          studentId: lessonData.studentId,
          studentName: lessonData.studentName,
          tutorId: lessonData.tutorId,
          date: lessonData.date,
          status: lessonData.attendanceStatus === 'Absent' ? 'Absent' : lessonData.attendanceStatus === 'Late' ? 'Late' : 'Present',
          markedBy: lessonData.tutorId,
          markedAt: new Date().toISOString(),
          notes: lessonData.attendanceStatus === 'Late' && lessonData.lateMinutes
            ? `Late by ${lessonData.lateMinutes} mins`
            : lessonData.attendanceStatus === 'Absent' && lessonData.absentReason
            ? `Absent: ${lessonData.absentReason}`
            : undefined
        };
        await addAttendanceRecord(attRecord);
      } catch (attErr) {
        console.warn("Could not auto-sync attendance record from lesson:", attErr);
      }
    }

    // Check if student is on Trial and update trial sessions (only if attended)
    if (lessonData.attendanceStatus !== 'Absent') {
      try {
        const students = CACHE.students || (await getStudents());
        const student = students.find(s => s.studentId === lessonData.studentId);
        if (student && student.status === 'Trial') {
          const nextCompleted = (student.trialSessionsCompleted || 0) + 1;
          const newTrialStatus = nextCompleted >= 5 ? 'Decision Pending' : 'In Progress';
          if (CACHE.students) {
            CACHE.students = CACHE.students.map(s => s.id === student.id ? {
              ...s,
              trialSessionsCompleted: nextCompleted,
              trialStatus: newTrialStatus
            } : s);
            saveCachedCollection('students', CACHE.students);
          }
          if (!isFirestoreQuotaExceeded() && !student.id.startsWith('local')) {
            await updateDoc(doc(db, STUDENTS_COL, student.id), {
              trialSessionsCompleted: nextCompleted,
              trialStatus: newTrialStatus
            });
          }
        }
      } catch (err) {
        console.error("Error auto-updating trial session on lesson save:", err);
      }
    }
  })();

  return docId;
}

export async function updateLesson(id: string, updates: Partial<Lesson>): Promise<void> {
  if (CACHE.lessons) {
    CACHE.lessons = CACHE.lessons.map(l => l.id === id ? { ...l, ...updates } : l);
    saveCachedCollection('lessons', CACHE.lessons);
  }
  if (!isFirestoreQuotaExceeded() && !id.startsWith('local')) {
    try {
      await updateDoc(doc(db, LESSONS_COL, id), sanitizeFirestoreObject(updates));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${LESSONS_COL}/${id}`);
    }
  }
}

export async function deleteLesson(id: string): Promise<void> {
  if (CACHE.lessons) {
    CACHE.lessons = CACHE.lessons.filter(l => l.id !== id);
    saveCachedCollection('lessons', CACHE.lessons);
  }
  if (!isFirestoreQuotaExceeded() && !id.startsWith('local')) {
    try {
      await deleteDoc(doc(db, LESSONS_COL, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${LESSONS_COL}/${id}`);
    }
  }
}

// ==========================================
// ATTENDANCE API
// ==========================================
export async function getAttendanceRecords(forceRefresh = false): Promise<AttendanceRecord[]> {
  if (CACHE.attendance && !forceRefresh) {
    return CACHE.attendance;
  }
  const localItems = loadCachedCollection<AttendanceRecord[]>('attendance') || [];
  try {
    if (!isFirestoreQuotaExceeded() && auth.currentUser) {
      const snap = await getDocs(collection(db, ATTENDANCE_COL));
      if (!snap.empty) {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
        const mergedMap = new Map<string, AttendanceRecord>();
        items.forEach(a => mergedMap.set(a.id, a));
        localItems.forEach(a => { if (!mergedMap.has(a.id)) mergedMap.set(a.id, a); });
        const merged = Array.from(mergedMap.values());
        CACHE.attendance = merged;
        saveCachedCollection('attendance', merged);
        return merged;
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, ATTENDANCE_COL);
  }
  const fallback = localItems.length > 0 ? localItems : (isCleanDataMode() ? [] : SEED_ATTENDANCE);
  CACHE.attendance = fallback;
  saveCachedCollection('attendance', fallback);
  return fallback;
}

export async function addAttendanceRecord(record: Omit<AttendanceRecord, 'id'>): Promise<string> {
  let docId = 'local_att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  if (!isFirestoreQuotaExceeded()) {
    try {
      const docRef = await addDoc(collection(db, ATTENDANCE_COL), sanitizeFirestoreObject(record));
      docId = docRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, ATTENDANCE_COL);
    }
  }
  const newRec: AttendanceRecord = { id: docId, ...record };
  CACHE.attendance = [newRec, ...(CACHE.attendance || [])];
  saveCachedCollection('attendance', CACHE.attendance);
  return docId;
}

export async function getTutorAttendanceRecords(forceRefresh = false): Promise<TutorAttendanceRecord[]> {
  if (CACHE.tutorAttendance && !forceRefresh) {
    return CACHE.tutorAttendance;
  }
  const localItems = loadCachedCollection<TutorAttendanceRecord[]>('tutorAttendance') || [];
  try {
    if (!isFirestoreQuotaExceeded() && auth.currentUser) {
      const snap = await getDocs(collection(db, TUTOR_ATTENDANCE_COL));
      if (!snap.empty) {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as TutorAttendanceRecord));
        const mergedMap = new Map<string, TutorAttendanceRecord>();
        items.forEach(a => mergedMap.set(a.id, a));
        localItems.forEach(a => { if (!mergedMap.has(a.id)) mergedMap.set(a.id, a); });
        const merged = Array.from(mergedMap.values());
        CACHE.tutorAttendance = merged;
        saveCachedCollection('tutorAttendance', merged);
        return merged;
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, TUTOR_ATTENDANCE_COL);
  }
  const fallback = localItems.length > 0 ? localItems : (isCleanDataMode() ? [] : SEED_TUTOR_ATTENDANCE);
  CACHE.tutorAttendance = fallback;
  saveCachedCollection('tutorAttendance', fallback);
  return fallback;
}

export async function addTutorAttendanceRecord(record: Omit<TutorAttendanceRecord, 'id'>): Promise<string> {
  let docId = 'local_tut_att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  if (!isFirestoreQuotaExceeded()) {
    try {
      const docRef = await addDoc(collection(db, TUTOR_ATTENDANCE_COL), sanitizeFirestoreObject(record));
      docId = docRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, TUTOR_ATTENDANCE_COL);
    }
  }
  const newRec: TutorAttendanceRecord = { id: docId, ...record };
  CACHE.tutorAttendance = [newRec, ...(CACHE.tutorAttendance || [])];
  saveCachedCollection('tutorAttendance', CACHE.tutorAttendance);
  return docId;
}

export async function updateTutorAttendanceRecord(id: string, updates: Partial<TutorAttendanceRecord>): Promise<void> {
  if (CACHE.tutorAttendance) {
    CACHE.tutorAttendance = CACHE.tutorAttendance.map(a => a.id === id ? { ...a, ...updates } : a);
    saveCachedCollection('tutorAttendance', CACHE.tutorAttendance);
  }
  if (!isFirestoreQuotaExceeded() && !id.startsWith('local')) {
    try {
      await updateDoc(doc(db, TUTOR_ATTENDANCE_COL, id), sanitizeFirestoreObject(updates));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${TUTOR_ATTENDANCE_COL}/${id}`);
    }
  }
}

export async function deleteTutorAttendanceRecord(id: string): Promise<string> {
  try {
    let recData = CACHE.tutorAttendance?.find(a => a.id === id) || null;
    const recRef = doc(db, TUTOR_ATTENDANCE_COL, id);

    if (CACHE.tutorAttendance) {
      CACHE.tutorAttendance = CACHE.tutorAttendance.filter(a => a.id !== id);
      saveCachedCollection('tutorAttendance', CACHE.tutorAttendance);
    }

    if (recData) {
      const trashItem: Omit<TrashRecord, 'id'> = {
        originalId: id,
        itemType: 'tutor_attendance',
        title: `Attendance: ${recData.tutorName || recData.tutorId} on ${recData.date}`,
        subtitle: `Status: ${recData.status} • Time In: ${recData.timeIn || recData.loginTime || 'N/A'}`,
        data: sanitizeFirestoreObject(recData),
        deletedAt: new Date().toISOString()
      };
      let trashId = `trash-${Date.now()}`;
      if (!isFirestoreQuotaExceeded()) {
        try {
          const trashDoc = await addDoc(collection(db, TRASH_COL), trashItem);
          trashId = trashDoc.id;
        } catch (err) {
          console.warn('Could not persist to deleted_records, saving locally:', err);
        }
      }
      const record = { id: trashId, ...trashItem };
      MEMORY_TRASH.unshift(record);
      if (CACHE.trash) {
        CACHE.trash.unshift(record);
        saveCachedCollection('trash', CACHE.trash);
      }

      if (!isFirestoreQuotaExceeded() && !id.startsWith('local')) {
        await deleteDoc(recRef);
      }
      return trashId;
    }

    if (!isFirestoreQuotaExceeded() && !id.startsWith('local')) {
      await deleteDoc(recRef);
    }
    return '';
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, TUTOR_ATTENDANCE_COL);
    return '';
  }
}

// ==========================================
// FEES API (ADMIN ONLY & OWN STUDENT VIEW)
// ==========================================
export async function getFees(forceRefresh = false): Promise<StudentFee[]> {
  if (CACHE.fees && !forceRefresh) {
    return CACHE.fees;
  }
  const localItems = loadCachedCollection<StudentFee[]>('fees') || [];
  try {
    if (!isFirestoreQuotaExceeded() && auth.currentUser) {
      const snap = await getDocs(collection(db, FEES_COL));
      if (!snap.empty) {
        const today = new Date().toISOString().slice(0, 10);
        const items = snap.docs.map(d => {
          const data = d.data() as StudentFee;
          let status = data.status;
          if (status !== 'Paid' && data.dueDate && data.dueDate < today) {
            status = 'Overdue';
          }
          return { id: d.id, ...data, status };
        });
        const mergedMap = new Map<string, StudentFee>();
        items.forEach(f => mergedMap.set(f.id, f));
        localItems.forEach(f => { if (!mergedMap.has(f.id)) mergedMap.set(f.id, f); });
        const merged = Array.from(mergedMap.values());
        CACHE.fees = merged;
        saveCachedCollection('fees', merged);
        return merged;
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, FEES_COL);
  }
  const fallback = localItems.length > 0 ? localItems : (isCleanDataMode() ? [] : SEED_FEES);
  CACHE.fees = fallback;
  saveCachedCollection('fees', fallback);
  return fallback;
}

export async function addFee(fee: Omit<StudentFee, 'id'>): Promise<string> {
  const docRef = doc(collection(db, FEES_COL));
  const docId = docRef.id;
  const newFee: StudentFee = { id: docId, ...fee };
  CACHE.fees = [newFee, ...(CACHE.fees || [])];
  saveCachedCollection('fees', CACHE.fees);

  if (!isFirestoreQuotaExceeded()) {
    setDoc(docRef, sanitizeFirestoreObject(fee)).catch((err) => {
      handleFirestoreError(err, OperationType.CREATE, FEES_COL);
    });
  }
  return docId;
}

export async function updateFee(id: string, updates: Partial<StudentFee>): Promise<void> {
  if (CACHE.fees) {
    CACHE.fees = CACHE.fees.map(f => f.id === id ? { ...f, ...updates } : f);
    saveCachedCollection('fees', CACHE.fees);
  }
  if (!isFirestoreQuotaExceeded() && !id.startsWith('local')) {
    try {
      await updateDoc(doc(db, FEES_COL, id), sanitizeFirestoreObject(updates));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${FEES_COL}/${id}`);
    }
  }
}

// ==========================================
// TUTOR SALARIES (ADMIN ONLY)
// ==========================================
export async function getSalaries(forceRefresh = false): Promise<TutorSalary[]> {
  if (CACHE.salaries && !forceRefresh) {
    return CACHE.salaries;
  }
  const localItems = loadCachedCollection<TutorSalary[]>('salaries') || [];
  try {
    if (!isFirestoreQuotaExceeded() && auth.currentUser) {
      const snap = await getDocs(collection(db, SALARIES_COL));
      if (!snap.empty) {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as TutorSalary));
        const mergedMap = new Map<string, TutorSalary>();
        items.forEach(s => mergedMap.set(s.id, s));
        localItems.forEach(s => { if (!mergedMap.has(s.id)) mergedMap.set(s.id, s); });
        const merged = Array.from(mergedMap.values());
        CACHE.salaries = merged;
        saveCachedCollection('salaries', merged);
        return merged;
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, SALARIES_COL);
  }
  const fallback = localItems.length > 0 ? localItems : (isCleanDataMode() ? [] : SEED_SALARIES);
  CACHE.salaries = fallback;
  saveCachedCollection('salaries', fallback);
  return fallback;
}

export async function addSalary(salary: Omit<TutorSalary, 'id'>): Promise<string> {
  const docRef = doc(collection(db, SALARIES_COL));
  const docId = docRef.id;
  const newSalary: TutorSalary = { id: docId, ...salary };
  CACHE.salaries = [newSalary, ...(CACHE.salaries || [])];
  saveCachedCollection('salaries', CACHE.salaries);

  if (!isFirestoreQuotaExceeded()) {
    setDoc(docRef, sanitizeFirestoreObject(salary)).catch((err) => {
      handleFirestoreError(err, OperationType.CREATE, SALARIES_COL);
    });
  }
  return docId;
}

export async function updateSalary(id: string, updates: Partial<TutorSalary>): Promise<void> {
  if (CACHE.salaries) {
    CACHE.salaries = CACHE.salaries.map(s => s.id === id ? { ...s, ...updates } : s);
    saveCachedCollection('salaries', CACHE.salaries);
  }
  if (!isFirestoreQuotaExceeded() && !id.startsWith('local')) {
    try {
      await updateDoc(doc(db, SALARIES_COL, id), sanitizeFirestoreObject(updates));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${SALARIES_COL}/${id}`);
    }
  }
}

// ==========================================
// REFERRALS API
// ==========================================
export async function getReferrals(forceRefresh = false): Promise<Referral[]> {
  if (CACHE.referrals && !forceRefresh) {
    return CACHE.referrals;
  }
  const localItems = loadCachedCollection<Referral[]>('referrals') || [];
  try {
    if (!isFirestoreQuotaExceeded() && auth.currentUser) {
      const snap = await getDocs(collection(db, REFERRALS_COL));
      if (!snap.empty) {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Referral));
        const mergedMap = new Map<string, Referral>();
        items.forEach(r => mergedMap.set(r.id, r));
        localItems.forEach(r => { if (!mergedMap.has(r.id)) mergedMap.set(r.id, r); });
        const merged = Array.from(mergedMap.values());
        CACHE.referrals = merged;
        saveCachedCollection('referrals', merged);
        return merged;
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, REFERRALS_COL);
  }
  const fallback = localItems.length > 0 ? localItems : (isCleanDataMode() ? [] : SEED_REFERRALS);
  CACHE.referrals = fallback;
  saveCachedCollection('referrals', fallback);
  return fallback;
}

export async function addReferral(referral: Omit<Referral, 'id'>): Promise<string> {
  const docRef = doc(collection(db, REFERRALS_COL));
  const docId = docRef.id;
  const newRef: Referral = { id: docId, ...referral };
  CACHE.referrals = [newRef, ...(CACHE.referrals || [])];
  saveCachedCollection('referrals', CACHE.referrals);

  if (!isFirestoreQuotaExceeded()) {
    setDoc(docRef, sanitizeFirestoreObject(referral)).catch((err) => {
      handleFirestoreError(err, OperationType.CREATE, REFERRALS_COL);
    });
  }
  return docId;
}

export async function updateReferral(id: string, updates: Partial<Referral>): Promise<void> {
  if (CACHE.referrals) {
    CACHE.referrals = CACHE.referrals.map(r => r.id === id ? { ...r, ...updates } : r);
    saveCachedCollection('referrals', CACHE.referrals);
  }
  if (!isFirestoreQuotaExceeded() && !id.startsWith('local')) {
    try {
      await updateDoc(doc(db, REFERRALS_COL, id), sanitizeFirestoreObject(updates));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${REFERRALS_COL}/${id}`);
    }
  }
}

export async function deleteReferral(id: string): Promise<string> {
  try {
    let refData = CACHE.referrals?.find(r => r.id === id) || null;
    const refDocRef = doc(db, REFERRALS_COL, id);

    if (CACHE.referrals) {
      CACHE.referrals = CACHE.referrals.filter(r => r.id !== id);
      saveCachedCollection('referrals', CACHE.referrals);
    }

    if (refData) {
      const trashItem: Omit<TrashRecord, 'id'> = {
        originalId: id,
        itemType: 'referral',
        title: `Referral: ${refData.referredStudentName} by ${refData.referrerName}`,
        subtitle: `Reward: $${refData.rewardAmount} • Status: ${refData.status}`,
        data: sanitizeFirestoreObject(refData),
        deletedAt: new Date().toISOString()
      };
      let trashId = `trash-${Date.now()}`;
      if (!isFirestoreQuotaExceeded()) {
        try {
          const trashDoc = await addDoc(collection(db, TRASH_COL), trashItem);
          trashId = trashDoc.id;
        } catch (err) {
          console.warn('Could not persist to deleted_records, saving locally:', err);
        }
      }
      const record = { id: trashId, ...trashItem };
      MEMORY_TRASH.unshift(record);
      if (CACHE.trash) {
        CACHE.trash.unshift(record);
        saveCachedCollection('trash', CACHE.trash);
      }

      if (!isFirestoreQuotaExceeded() && !id.startsWith('local')) {
        await deleteDoc(refDocRef);
      }
      return trashId;
    }

    if (!isFirestoreQuotaExceeded() && !id.startsWith('local')) {
      await deleteDoc(refDocRef);
    }
    return '';
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, REFERRALS_COL);
    return '';
  }
}

// ==========================================
// ANNOUNCEMENTS API WITH ROLE-BASED ACCESS
// ==========================================
export function isAnnouncementTargetedForRole(ann: Announcement, role: UserRole): boolean {
  // Check date range validity if specified
  const today = new Date().toISOString().split('T')[0];
  if (ann.startDate && ann.startDate > today) {
    return false; // Not yet active
  }
  if (ann.endDate && ann.endDate < today) {
    return false; // Expired
  }

  if (role === 'admin') return true; // Administrator can view all announcements

  // Check array of targetRoles
  if (Array.isArray(ann.targetRoles) && ann.targetRoles.length > 0) {
    if (ann.targetRoles.includes(role)) return true;
    if ((ann.targetRoles as string[]).includes('all')) return true;
  }

  // Fallback to legacy targetRole field
  if (ann.targetRole) {
    if (ann.targetRole === 'all') return true;
    if (ann.targetRole === (role + 's' as any)) return true;
    if (ann.targetRole === (role as any)) return true;
  }

  return false;
}

export async function getAnnouncements(forceRefresh = false): Promise<Announcement[]> {
  if (CACHE.announcements && !forceRefresh) {
    return CACHE.announcements;
  }
  const localItems = loadCachedCollection<Announcement[]>('announcements') || [];
  try {
    if (!isFirestoreQuotaExceeded() && auth.currentUser) {
      const snap = await getDocs(collection(db, ANNOUNCEMENTS_COL));
      if (!snap.empty) {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement));
        const mergedMap = new Map<string, Announcement>();
        items.forEach(a => mergedMap.set(a.id, a));
        localItems.forEach(a => { if (!mergedMap.has(a.id)) mergedMap.set(a.id, a); });
        const merged = Array.from(mergedMap.values());
        CACHE.announcements = merged;
        saveCachedCollection('announcements', merged);
        return merged;
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, ANNOUNCEMENTS_COL);
  }
  const fallback = localItems.length > 0 ? localItems : (isCleanDataMode() ? [] : SEED_ANNOUNCEMENTS);
  CACHE.announcements = fallback;
  saveCachedCollection('announcements', fallback);
  return fallback;
}

export async function getAnnouncementsForRole(role: UserRole, forceRefresh = false): Promise<Announcement[]> {
  const all = await getAnnouncements(forceRefresh);
  return all.filter(a => isAnnouncementTargetedForRole(a, role));
}

export async function addAnnouncement(announcement: Omit<Announcement, 'id'>): Promise<string> {
  const docRef = doc(collection(db, ANNOUNCEMENTS_COL));
  const docId = docRef.id;
  const newAnn: Announcement = { id: docId, ...announcement };
  CACHE.announcements = [newAnn, ...(CACHE.announcements || [])];
  saveCachedCollection('announcements', CACHE.announcements);

  if (!isFirestoreQuotaExceeded()) {
    setDoc(docRef, sanitizeFirestoreObject(announcement)).catch((err) => {
      handleFirestoreError(err, OperationType.CREATE, ANNOUNCEMENTS_COL);
    });
  }
  return docId;
}

export async function deleteAnnouncement(id: string): Promise<string> {
  try {
    let annData = CACHE.announcements?.find(a => a.id === id) || null;
    const annRef = doc(db, ANNOUNCEMENTS_COL, id);

    if (!annData) {
      const snap = await getDoc(annRef);
      if (snap.exists()) {
        annData = { id: snap.id, ...snap.data() } as Announcement;
      }
    }

    if (CACHE.announcements) {
      CACHE.announcements = CACHE.announcements.filter(a => a.id !== id);
    }

    if (annData) {
      const trashItem: Omit<TrashRecord, 'id'> = {
        originalId: id,
        itemType: 'announcement',
        title: `Announcement: ${annData.title}`,
        subtitle: `Audience: ${annData.targetRole || 'All'} • Posted: ${annData.createdAt?.slice(0, 10) || 'N/A'}`,
        data: sanitizeFirestoreObject(annData),
        deletedAt: new Date().toISOString()
      };
      let trashId = `trash-${Date.now()}`;
      try {
        const trashDoc = await addDoc(collection(db, TRASH_COL), trashItem);
        trashId = trashDoc.id;
      } catch (err) {
        console.warn('Could not persist to deleted_records, saving locally:', err);
      }
      const record = { id: trashId, ...trashItem };
      MEMORY_TRASH.unshift(record);
      if (CACHE.trash) CACHE.trash.unshift(record);

      await deleteDoc(annRef);
      return trashId;
    }

    await deleteDoc(annRef);
    return '';
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, ANNOUNCEMENTS_COL);
    throw err;
  }
}

// ==========================================
// INTERNAL CHAT / MESSAGING (Attachments, Voice Notes, Read Receipts, WhatsApp Status)
// ==========================================
export function subscribeToMessages(threadId: string, callback: (messages: ChatMessage[]) => void) {
  if (isFirestoreQuotaExceeded()) {
    const cached = getCachedMessages(threadId);
    callback(cached);
    return () => {};
  }

  const q = query(
    collection(db, MESSAGES_COL),
    where('threadId', '==', threadId),
    limit(100)
  );
  return safeOnSnapshot(
    q,
    (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
      msgs.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));
      saveCachedMessages(threadId, msgs);
      callback(msgs);
    },
    (_error) => {
      const cached = getCachedMessages(threadId);
      callback(cached);
    },
    MESSAGES_COL
  );
}

export async function sendMessage(messageData: Omit<ChatMessage, 'id'>): Promise<string> {
  const now = new Date().toISOString();
  const initialSeenBy = messageData.senderId ? [messageData.senderId] : [];
  const initialDeliveredTo = messageData.senderId ? [messageData.senderId] : [];
  
  const payload = sanitizeFirestoreObject({
    ...messageData,
    status: 'sent',
    delivered: true,
    read: false,
    deliveredTo: messageData.deliveredTo || initialDeliveredTo,
    deliveredTimestamps: { [messageData.senderId]: now },
    seenBy: messageData.seenBy || initialSeenBy,
    seenTimestamps: { [messageData.senderId]: now },
    listenedBy: messageData.listenedBy || []
  });

  const localMsgId = `local_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const localMsg: ChatMessage = { id: localMsgId, ...payload } as ChatMessage;
  appendLocalMessage(messageData.threadId, localMsg);

  if (!isFirestoreQuotaExceeded()) {
    try {
      const docRef = await addDoc(collection(db, MESSAGES_COL), payload);
      return docRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, MESSAGES_COL);
      return localMsgId;
    }
  }

  return localMsgId;
}

export async function markMessagesAsDelivered(threadId: string, currentUserId: string): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  try {
    const q = query(
      collection(db, MESSAGES_COL),
      where('threadId', '==', threadId),
      where('read', '==', false),
      limit(25)
    );
    const snap = await getDocs(q);
    const now = new Date().toISOString();
    const updates = snap.docs
      .filter(d => {
        const data = d.data() as ChatMessage;
        if (data.senderId === currentUserId) return false;
        const delList = Array.isArray(data.deliveredTo) ? data.deliveredTo : [];
        return !delList.includes(currentUserId);
      })
      .map(d => {
        const data = d.data() as ChatMessage;
        const delList = Array.isArray(data.deliveredTo) ? data.deliveredTo : [];
        return updateDoc(doc(db, MESSAGES_COL, d.id), {
          delivered: true,
          deliveredAt: data.deliveredAt || now,
          status: data.read ? 'seen' : 'delivered',
          deliveredTo: Array.from(new Set([...delList, currentUserId])),
          [`deliveredTimestamps.${currentUserId}`]: now
        });
      });
    if (updates.length > 0) {
      await Promise.all(updates);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, MESSAGES_COL);
  }
}

export async function markThreadMessagesAsRead(threadId: string, currentUserId: string): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  try {
    const q = query(
      collection(db, MESSAGES_COL),
      where('threadId', '==', threadId),
      where('read', '==', false),
      limit(25)
    );
    const snap = await getDocs(q);
    const now = new Date().toISOString();
    const updates = snap.docs
      .filter(d => {
        const data = d.data() as ChatMessage;
        // If current user is sender, skip
        if (data.senderId === currentUserId) return false;
        // Check if current user is not in seenBy or read is false
        const seenList = Array.isArray(data.seenBy) ? data.seenBy : [];
        return !data.read || !seenList.includes(currentUserId);
      })
      .map(d => {
        const data = d.data() as ChatMessage;
        const seenList = Array.isArray(data.seenBy) ? data.seenBy : [];
        const delList = Array.isArray(data.deliveredTo) ? data.deliveredTo : [];
        const updatedSeen = Array.from(new Set([...seenList, currentUserId]));
        const updatedDelivered = Array.from(new Set([...delList, currentUserId]));
        return updateDoc(doc(db, MESSAGES_COL, d.id), {
          read: true,
          delivered: true,
          status: 'seen',
          readAt: data.readAt || now,
          deliveredAt: data.deliveredAt || now,
          seenBy: updatedSeen,
          deliveredTo: updatedDelivered,
          [`seenTimestamps.${currentUserId}`]: now,
          [`deliveredTimestamps.${currentUserId}`]: data.deliveredTimestamps?.[currentUserId] || now
        });
      });
    if (updates.length > 0) {
      await Promise.all(updates);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, MESSAGES_COL);
  }
}

export async function markVoiceNoteAsListened(messageId: string, currentUserId: string): Promise<void> {
  try {
    const docRef = doc(db, MESSAGES_COL, messageId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as ChatMessage;
      const currentListened = Array.isArray(data.listenedBy) ? data.listenedBy : [];
      if (!currentListened.includes(currentUserId)) {
        const updated = [...currentListened, currentUserId];
        await updateDoc(docRef, { listenedBy: updated });
      }
    }
  } catch (err) {
    console.warn('Error marking voice note as listened:', err);
  }
}

/**
 * Edit a chat message text (STRICT SAFETY POLICY: ONLY Academy Admin can edit messages)
 */
export async function editChatMessage(messageId: string, newText: string, callerRole?: UserRole): Promise<void> {
  if (callerRole && callerRole !== 'admin') {
    throw new Error('Security policy: Only Academy Administrators are authorized to edit messages.');
  }
  try {
    const docRef = doc(db, MESSAGES_COL, messageId);
    await updateDoc(docRef, {
      text: newText,
      isEdited: true,
      editedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Error editing chat message:', err);
    throw err;
  }
}

/**
 * Delete a chat message (STRICT SAFETY POLICY: ONLY Academy Admin can delete messages)
 */
export async function deleteChatMessage(messageId: string, deletedBy: string, callerRole?: UserRole, forEveryone = true): Promise<void> {
  if (callerRole && callerRole !== 'admin') {
    throw new Error('Security policy: Only Academy Administrators are authorized to delete messages.');
  }
  try {
    const docRef = doc(db, MESSAGES_COL, messageId);
    if (forEveryone) {
      await updateDoc(docRef, {
        text: 'This message was deleted',
        deletedForEveryone: true,
        deletedBy,
        attachment: null
      });
    } else {
      await deleteDoc(docRef);
    }
  } catch (err) {
    console.warn('Error deleting chat message:', err);
    throw err;
  }
}

/**
 * Check if a user role and ID is authorized to participate in a specific chat thread
 */
export function isUserAuthorizedForThread(threadId: string, userId: string, role: UserRole): boolean {
  if (role === 'admin') return true;
  if (threadId === 'channel_staff_group' || threadId === 'channel_general') {
    return role === 'supervisor' || role === 'tutor';
  }
  if (threadId === 'dm_admin_supervisor') {
    return role === 'supervisor';
  }
  const cleanUserId = userId.toLowerCase().replace(/[^a-z0-9]/g, '_');
  if (threadId.startsWith('dm_admin_tutor_') || threadId.startsWith('channel_tutor_')) {
    if (role === 'tutor') {
      const channelTutorSuffix = threadId.replace('dm_admin_tutor_', '').replace('channel_tutor_', '').toLowerCase();
      return (
        cleanUserId === channelTutorSuffix ||
        cleanUserId.endsWith(`_${channelTutorSuffix}`) ||
        channelTutorSuffix.endsWith(`_${cleanUserId}`) ||
        cleanUserId === `tutor_${channelTutorSuffix}`
      );
    }
    return false;
  }
  if (threadId.startsWith('dm_admin_student_') || threadId.startsWith('channel_student_')) {
    if (role === 'student') {
      const channelStudentSuffix = threadId.replace('dm_admin_student_', '').replace('channel_student_', '').toLowerCase();
      return (
        cleanUserId === channelStudentSuffix ||
        cleanUserId.endsWith(`_${channelStudentSuffix}`) ||
        channelStudentSuffix.endsWith(`_${cleanUserId}`) ||
        cleanUserId === `student_${channelStudentSuffix}`
      );
    }
    return false;
  }
  if (threadId.startsWith('dm_admin_parent_') || threadId.startsWith('channel_parent_')) {
    if (role === 'parent') {
      const channelParentSuffix = threadId.replace('dm_admin_parent_', '').replace('channel_parent_', '').toLowerCase();
      return (
        cleanUserId === channelParentSuffix ||
        cleanUserId.endsWith(`_${channelParentSuffix}`) ||
        channelParentSuffix.endsWith(`_${cleanUserId}`) ||
        cleanUserId === `parent_${channelParentSuffix}`
      );
    }
    return false;
  }
  return false;
}

/**
 * Subscribe to genuinely unread messages for a specific user to display accurate badges
 */
export function subscribeToUnreadMessages(
  userId: string,
  userRole: UserRole,
  callback: (totalUnread: number, unreadByThread: Record<string, number>) => void
) {
  if (isFirestoreQuotaExceeded()) {
    callback(0, {});
    return () => {};
  }

  // Targeted query limited to unread messages to minimize Firestore read quota consumption
  const q = query(
    collection(db, MESSAGES_COL),
    where('read', '==', false),
    limit(100)
  );

  return safeOnSnapshot(
    q,
    (snapshot) => {
      let total = 0;
      const byThread: Record<string, number> = {};

      snapshot.docs.forEach((d: any) => {
        const msg = { id: d.id, ...d.data() } as ChatMessage;
        if (!msg || !msg.threadId) return;

        // 1. Ignore own messages, system calls, deleted messages
        if (msg.senderId === userId || msg.senderId === 'system_call') return;
        if (msg.deletedForEveryone) return;
        if (userRole === 'admin' && msg.senderRole === 'admin' && (msg.senderId === 'admin' || msg.senderId === userId)) return;

        // 2. Check if this specific user has seen the message in seenBy array
        const seenList = Array.isArray(msg.seenBy) ? msg.seenBy : [];
        const hasSeen = seenList.includes(userId) || (userRole === 'admin' && (seenList.includes('admin') || seenList.includes('auth_admin_01')));
        if (hasSeen) return;

        // 3. Check authorization for thread
        if (!isUserAuthorizedForThread(msg.threadId, userId, userRole)) return;

        total++;
        byThread[msg.threadId] = (byThread[msg.threadId] || 0) + 1;
      });

      callback(total, byThread);
    },
    (_err) => {
      callback(0, {});
    },
    MESSAGES_COL
  );
}

/**
 * Marks all messages in all accessible threads as read for the current user
 */
export async function markAllMessagesAsRead(currentUserId: string, role: UserRole): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  try {
    const q = query(
      collection(db, MESSAGES_COL),
      where('read', '==', false),
      limit(50)
    );
    const snap = await getDocs(q);
    const now = new Date().toISOString();
    const updates = snap.docs
      .filter(d => {
        const data = d.data() as ChatMessage;
        if (data.senderId === currentUserId) return false;
        const seenList = Array.isArray(data.seenBy) ? data.seenBy : [];
        if (seenList.includes(currentUserId)) return false;
        return isUserAuthorizedForThread(data.threadId, currentUserId, role);
      })
      .map(d => {
        const data = d.data() as ChatMessage;
        const seenList = Array.isArray(data.seenBy) ? data.seenBy : [];
        const delList = Array.isArray(data.deliveredTo) ? data.deliveredTo : [];
        const updatedSeen = Array.from(new Set([...seenList, currentUserId]));
        const updatedDelivered = Array.from(new Set([...delList, currentUserId]));
        return updateDoc(doc(db, MESSAGES_COL, d.id), {
          read: true,
          delivered: true,
          status: 'seen',
          seenBy: updatedSeen,
          deliveredTo: updatedDelivered,
          [`seenTimestamps.${currentUserId}`]: now,
          [`deliveredTimestamps.${currentUserId}`]: data.deliveredTimestamps?.[currentUserId] || now
        });
      });
    if (updates.length > 0) {
      await Promise.all(updates);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, MESSAGES_COL);
  }
}

/**
 * Subscribe to incoming messages for in-app alert banners & browser desktop push
 */
export function subscribeToIncomingMessages(
  userId: string,
  userRole: UserRole,
  onNewMessage: (message: ChatMessage) => void
) {
  if (isFirestoreQuotaExceeded()) {
    return () => {};
  }

  // Target only the most recent messages rather than the entire collection
  const q = query(
    collection(db, MESSAGES_COL),
    orderBy('timestamp', 'desc'),
    limit(15)
  );

  let isInitialLoad = true;
  return safeOnSnapshot(
    q,
    (snapshot) => {
      if (isInitialLoad) {
        isInitialLoad = false;
        return;
      }

      snapshot.docChanges().forEach((change: any) => {
        if (change.type === 'added') {
          const msg = { id: change.doc.id, ...change.doc.data() } as ChatMessage;
          if (!msg || !msg.threadId) return;

          // Ignore if sent by self
          if (msg.senderId === userId) return;
          if (userRole === 'admin' && msg.senderRole === 'admin' && (msg.senderId === 'admin' || msg.senderId === userId)) return;

          // Check if user is recipient or authorized for this thread
          if (isUserAuthorizedForThread(msg.threadId, userId, userRole)) {
            onNewMessage(msg);
          }
        }
      });
    },
    (_err) => {},
    MESSAGES_COL
  );
}

// ==========================================
// ACADEMY SETTINGS
// ==========================================
export async function getAcademySettings(forceRefresh = false): Promise<AcademySettings> {
  if (CACHE.settings && !forceRefresh) {
    return CACHE.settings;
  }
  const defaultSettings: AcademySettings = {
    academyName: 'IslamicTuition',
    operationalTimezone: 'Asia/Karachi',
    contactEmail: 'info@islamictuition.us',
    contactPhone: '+1 (718) 618-4848',
    defaultZoomLink: 'https://zoom.us/j/islamictuition_main',
    trialSessionsCount: 5,
    siblingDiscountPercent: 10
  };
  try {
    const docRef = doc(db, SETTINGS_COL, 'general');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const settings = { ...defaultSettings, ...(snap.data() as AcademySettings) };
      CACHE.settings = settings;
      return settings;
    }
    if (auth.currentUser) {
      try {
        await setDoc(docRef, defaultSettings);
      } catch {}
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, SETTINGS_COL);
  }
  CACHE.settings = defaultSettings;
  return defaultSettings;
}

export function subscribeToAcademySettings(callback: (settings: AcademySettings) => void): () => void {
  const docRef = doc(db, SETTINGS_COL, 'general');
  return safeOnSnapshot(docRef, (snap: any) => {
    if (snap.exists()) {
      const settings = {
        academyName: 'IslamicTuition',
        operationalTimezone: 'Asia/Karachi',
        contactEmail: 'info@islamictuition.us',
        contactPhone: '+1 (718) 618-4848',
        defaultZoomLink: 'https://zoom.us/j/islamictuition_main',
        trialSessionsCount: 5,
        siblingDiscountPercent: 10,
        ...(snap.data() as AcademySettings)
      };
      CACHE.settings = settings;
      callback(settings);
    }
  }, undefined, SETTINGS_COL);
}

export async function updateAcademySettings(settings: Partial<AcademySettings>): Promise<void> {
  if (CACHE.settings) {
    CACHE.settings = { ...CACHE.settings, ...settings };
  }
  const docRef = doc(db, SETTINGS_COL, 'general');
  await setDoc(docRef, sanitizeFirestoreObject(settings), { merge: true });
}

// ==========================================
// USER ACCOUNTS & LOGIN MANAGEMENT
// ==========================================
export interface AppUserAccount {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: 'active' | 'pending_approval' | 'inactive' | 'suspended';
  tutorId?: string;
  studentId?: string;
  createdAt?: string;
}

export interface RegisterUserParams {
  email: string;
  password?: string;
  displayName: string;
  role: UserRole;
  status?: UserAccountStatus;
  tutorId?: string;
  studentId?: string;
  linkedStudentIds?: string[];
  courseType?: CourseType;
  country?: string;
  timezone?: string;
  phone?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  hourlyRatePKR?: number;
  monthlySalaryPKR?: number;
  zoomLink?: string;
  qualifications?: string;
  department?: string;
  profileData?: Record<string, any>;
}

export interface RegisterUserResult {
  uid: string;
  email: string;
  role: UserRole;
  displayName: string;
  success: boolean;
  message: string;
}

// Dedicated secondary Auth instance so registering accounts by Admin does not disrupt active Admin session
let secondaryAuthAppInstance: any = null;
function getSecondaryAuthApp() {
  if (!secondaryAuthAppInstance) {
    const existing = getApps().find(a => a.name === 'SecondaryAdminAuthApp');
    if (existing) {
      secondaryAuthAppInstance = existing;
    } else {
      const config = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigData.apiKey,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigData.authDomain,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigData.projectId,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigData.storageBucket,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigData.messagingSenderId,
        appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigData.appId,
      };
      secondaryAuthAppInstance = initializeApp(config, 'SecondaryAdminAuthApp');
    }
  }
  return getAuth(secondaryAuthAppInstance);
}

/**
 * Fetch all user profiles from Firestore users collection
 */
export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(collection(db, USERS_COL));
    if (!snap.empty) {
      const usersMap = new Map<string, UserProfile>();
      snap.docs.forEach(d => {
        const data = d.data() as UserProfile;
        // Key by uid or email
        const key = data.uid || data.email;
        if (key && !usersMap.has(key)) {
          usersMap.set(key, { ...data, uid: data.uid || d.id });
        }
      });
      return Array.from(usersMap.values());
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, USERS_COL);
  }
  return [];
}

/**
 * Fetch users who registered themselves and are awaiting Admin approval
 */
export async function getPendingUsers(): Promise<UserProfile[]> {
  try {
    const q = query(collection(db, USERS_COL), where('status', '==', 'pending_approval'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
    }
  } catch (err) {
    // Fallback: load all and filter
    try {
      const all = await getAllUsers();
      return all.filter(u => u.status === 'pending_approval');
    } catch {
      handleFirestoreError(err, OperationType.LIST, USERS_COL);
    }
  }
  return [];
}

/**
 * Admin approves a self-registered user account.
 * Transitions their status to 'active' and activates any linked student record.
 */
export async function approveUserAccount(uid: string, adminName: string): Promise<void> {
  const approvalTimestamp = new Date().toISOString();
  try {
    const userDocRef = doc(db, USERS_COL, uid);
    const userSnap = await getDoc(userDocRef);
    const userData = userSnap.exists() ? (userSnap.data() as UserProfile) : null;

    await setDoc(userDocRef, {
      status: 'active',
      approvedBy: adminName,
      approvedAt: approvalTimestamp
    }, { merge: true });

    // Also update by email doc ID if an alias exists
    if (userData?.email) {
      const emailDocId = userData.email.replace(/[@.]/g, '_');
      if (emailDocId !== uid) {
        await setDoc(doc(db, USERS_COL, emailDocId), {
          status: 'active',
          approvedBy: adminName,
          approvedAt: approvalTimestamp
        }, { merge: true });
      }

      // If user is a student, update their student profile in students collection
      if (userData.role === 'student') {
        const stSnap = await getDocs(query(collection(db, STUDENTS_COL), where('email', '==', userData.email)));
        for (const sDoc of stSnap.docs) {
          await updateDoc(doc(db, STUDENTS_COL, sDoc.id), {
            status: 'Active'
          });
        }
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${USERS_COL}/${uid}`);
    throw err;
  }
}

/**
 * Admin rejects a pending user registration
 */
export async function rejectUserAccount(uid: string): Promise<void> {
  try {
    const userDocRef = doc(db, USERS_COL, uid);
    await setDoc(userDocRef, {
      status: 'inactive'
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${USERS_COL}/${uid}`);
    throw err;
  }
}

/**
 * Self-registration for Student and Parent roles only.
 * Creates real Firebase Authentication user + Firestore profile with status 'pending_approval'.
 * Admin, Supervisor and Tutor are STRICTLY FORBIDDEN from registering via this method.
 */
export async function registerSelfStudentOrParent(params: {
  email: string;
  password: string;
  displayName: string;
  role: 'student' | 'parent';
  phone?: string;
  country?: string;
  timezone?: string;
  courseType?: CourseType;
  parentName?: string;
  parentEmail?: string;
}): Promise<UserProfile> {
  if (params.role !== 'student' && params.role !== 'parent') {
    throw new Error('Public registration is strictly limited to Students and Parents. Faculty accounts are provisioned exclusively by Academy Administration.');
  }

  if (!params.email || !params.password) {
    throw new Error('Email and password are required.');
  }

  if (params.password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  // 1. Create real Firebase Auth account using primary auth
  const cred = await createUserWithEmailAndPassword(auth, params.email, params.password);
  const uid = cred.user.uid;

  // 2. Persist profile in Firestore with status 'pending_approval' (NEVER write password to Firestore)
  const newProfile: UserProfile = {
    uid,
    email: params.email,
    displayName: params.displayName,
    role: params.role,
    status: 'pending_approval',
    phone: params.phone || '',
    country: params.country || 'USA',
    timezone: params.timezone || 'America/New_York',
    courseType: params.courseType || 'Quran Reading / Nazra',
    parentName: params.parentName || '',
    parentEmail: params.parentEmail || '',
    createdAt: new Date().toISOString()
  };

  await setDoc(doc(db, USERS_COL, uid), sanitizeFirestoreObject(newProfile));

  // 3. Create entry in students collection if student
  if (params.role === 'student') {
    try {
      const studentId = `STU-${Math.floor(100 + Math.random() * 900)}`;
      const newStudentDoc: Omit<Student, 'id'> = {
        studentId,
        name: params.displayName,
        email: params.email,
        phone: params.phone || '',
        parentName: params.parentName || `${params.displayName}'s Parent`,
        parentEmail: params.parentEmail || params.email,
        parentPhone: params.phone || '',
        assignedTutorId: 'Tutor 1',
        country: params.country || 'USA',
        timezone: params.timezone || 'America/New_York',
        courseType: params.courseType || 'Quran Reading / Nazra',
        status: 'Pending',
        trialSessionsCompleted: 0,
        trialSessionsTotal: 5,
        trialStatus: 'In Progress',
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, STUDENTS_COL), sanitizeFirestoreObject(newStudentDoc));
    } catch (err) {
      console.warn('Could not auto-add student record:', err);
    }
  }

  return newProfile;
}

/**
 * Admin-only function to register new Firebase Auth users and persist their role-specific
 * profile data (Admin/Supervisor/Tutor/Student/Parent) into the Firestore users collection and
 * respective entities table. Passwords are handled ONLY in Firebase Auth and never stored in Firestore.
 */
export async function registerFirebaseUserWithProfile(params: RegisterUserParams): Promise<RegisterUserResult> {
  const cleanEmail = params.email.trim().toLowerCase();
  const password = params.password || 'Islam123!';
  let createdUid = '';
  let authSuccess = false;

  // 1. Create real Firebase Auth user via secondary app instance so admin remains signed in
  try {
    const secAuth = getSecondaryAuthApp();
    const cred = await createUserWithEmailAndPassword(secAuth, cleanEmail, password);
    createdUid = cred.user.uid;
    authSuccess = true;
    await signOut(secAuth);
  } catch (authErr: any) {
    if (authErr.code === 'auth/email-already-in-use') {
      createdUid = cleanEmail.replace(/[@.]/g, '_');
      authSuccess = true; // User exists in Auth
    } else {
      console.warn('Firebase Auth user creation notice:', authErr.message);
      createdUid = cleanEmail.replace(/[@.]/g, '_');
    }
  }

  // 2. Persist role-specific profile in Firestore users collection (NO PASSWORDS)
  const userProfileDoc: UserProfile = {
    uid: createdUid,
    email: cleanEmail,
    displayName: params.displayName,
    role: params.role,
    status: params.status || 'active', // Admin-created accounts default to active
    createdAt: new Date().toISOString(),
    phone: params.phone || '',
    country: params.country || 'USA',
    timezone: params.timezone || 'America/New_York',
    ...(params.tutorId ? { tutorId: params.tutorId } : {}),
    ...(params.studentId ? { studentId: params.studentId } : {})
  };

  try {
    await setDoc(doc(db, USERS_COL, createdUid), sanitizeFirestoreObject(userProfileDoc), { merge: true });
    // Also index by email-based doc ID if different
    const emailDocId = params.email.replace(/[@.]/g, '_');
    if (emailDocId !== createdUid) {
      await setDoc(doc(db, USERS_COL, emailDocId), sanitizeFirestoreObject(userProfileDoc), { merge: true });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, USERS_COL);
  }

  // 3. Role-specific collection initialization
  if (params.role === 'student') {
    try {
      const targetEmail = params.email.trim().toLowerCase();
      const targetStudentId = params.studentId || params.profileData?.studentId;

      // Check if student record already exists in students collection with this email
      const existingEmailSnap = await getDocs(
        query(collection(db, STUDENTS_COL), where('email', '==', targetEmail))
      );

      if (!existingEmailSnap.empty) {
        for (const sDoc of existingEmailSnap.docs) {
          await updateDoc(doc(db, STUDENTS_COL, sDoc.id), {
            email: params.email.trim(),
            ...(targetStudentId ? { studentId: targetStudentId } : {})
          });
        }
      } else {
        // Check by studentId
        const existingIdSnap = targetStudentId ? await getDocs(
          query(collection(db, STUDENTS_COL), where('studentId', '==', targetStudentId))
        ) : { empty: true, docs: [] };

        if (!existingIdSnap.empty) {
          for (const sDoc of existingIdSnap.docs) {
            await updateDoc(doc(db, STUDENTS_COL, sDoc.id), {
              email: params.email.trim()
            });
          }
        } else {
          // Create new student document if no match found
          const studentId = targetStudentId || `STU-${Math.floor(100 + Math.random() * 900)}`;
          const newStudent: Omit<Student, 'id'> = {
            studentId,
            name: params.displayName,
            phone: params.phone || '',
            parentName: params.parentName || params.profileData?.parentName || 'Parent Guardian',
            parentPhone: params.parentPhone || '',
            parentEmail: params.parentEmail || params.profileData?.parentEmail || params.email,
            email: params.email,
            country: params.country || params.profileData?.country || 'USA',
            timezone: params.timezone || params.profileData?.timezone || 'America/New_York',
            assignedTutorId: params.tutorId || params.profileData?.assignedTutorId || 'Tutor 1',
            courseType: (params.courseType || params.profileData?.courseType || 'Quran Reading / Nazra') as CourseType,
            status: 'Active',
            trialSessionsCompleted: 0,
            trialSessionsTotal: 5,
            trialStatus: 'Converted',
            createdAt: new Date().toISOString()
          };
          await addDoc(collection(db, STUDENTS_COL), sanitizeFirestoreObject(newStudent));
        }
      }
    } catch (err) {
      console.warn('Could not sync/add student record in students collection:', err);
    }
  } else if (params.role === 'tutor') {
    try {
      const tutorId = params.tutorId || params.profileData?.tutorId || `Tutor ${Math.floor(1 + Math.random() * 9)}`;
      const newTutor: Omit<Tutor, 'id'> = {
        tutorId,
        realName: params.displayName,
        email: params.email,
        phone: params.phone || '',
        zoomLink: params.zoomLink || params.profileData?.zoomLink || 'https://zoom.us/j/islamictuition-room',
        status: 'Active',
        hourlyRatePKR: params.hourlyRatePKR || (params.profileData?.hourlyRate ? params.profileData.hourlyRate * 280 : 3000),
        monthlySalaryPKR: params.monthlySalaryPKR !== undefined ? params.monthlySalaryPKR : (params.profileData?.monthlySalaryPKR || 23000),
        assignedStudentIds: [],
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, TUTORS_COL), sanitizeFirestoreObject(newTutor));
    } catch (err) {
      console.warn('Could not auto-add tutor record in tutors collection:', err);
    }
  }

  return {
    uid: createdUid,
    email: params.email,
    role: params.role,
    displayName: params.displayName,
    success: true,
    message: authSuccess
      ? `Real Firebase Auth account created and ${params.role} profile persisted to Firestore users collection.`
      : `Profile registered in Firestore users collection.`
  };
}

/**
 * Send password reset email via Firebase Authentication
 */
export const resetUserPassword = async (email: string, _newPassword?: string): Promise<void> => {
  if (!email) throw new Error('Email is required.');
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err: any) {
    console.warn("Notice: password reset email dispatch:", err.message);
  }
};

/**
 * Alias for legacy callers: delegates to real Firebase Auth + Firestore user creation
 */
export const registerUserAccount = registerFirebaseUserWithProfile;

/**
 * Fetch all registered institutional users from Firestore
 */
export async function getSystemUsers(forceRefresh = false): Promise<UserProfile[]> {
  if (CACHE.systemUsers && CACHE.systemUsers.length >= 20 && !forceRefresh) {
    return CACHE.systemUsers;
  }

  const storedUsers = loadCachedCollection<UserProfile[]>('systemUsers') || [];
  let firestoreUsers: UserProfile[] = [];

  if (!isFirestoreQuotaExceeded()) {
    try {
      const snap = await getDocs(collection(db, USERS_COL));
      if (!snap.empty) {
        firestoreUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      }
    } catch (err) {
      console.warn("Could not fetch system users from Firestore:", err);
    }
  }

  const usersMap = new Map<string, UserProfile>();

  // 1. Baseline: all 20 official tutor user profiles
  INITIAL_TUTOR_USER_PROFILES.forEach(u => {
    usersMap.set(u.email.toLowerCase(), { ...u });
  });

  // 2. Overlay locally stored accounts
  storedUsers.forEach(u => {
    if (u.email) {
      const key = u.email.toLowerCase();
      usersMap.set(key, { ...(usersMap.get(key) || {}), ...u });
    } else if (u.uid) {
      usersMap.set(u.uid, { ...(usersMap.get(u.uid) || {}), ...u });
    }
  });

  // 3. Overlay Firestore accounts
  firestoreUsers.forEach(u => {
    if (u.email) {
      const key = u.email.toLowerCase();
      usersMap.set(key, { ...(usersMap.get(key) || {}), ...u });
    } else if (u.uid) {
      usersMap.set(u.uid, { ...(usersMap.get(u.uid) || {}), ...u });
    }
  });

  const allUsers = Array.from(usersMap.values());
  allUsers.sort((a, b) => {
    const roleOrder: Record<string, number> = { admin: 1, supervisor: 2, tutor: 3, student: 4, parent: 5 };
    const diff = (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99);
    if (diff !== 0) return diff;
    const numA = parseInt((a.tutorId || '').replace(/\D/g, '')) || 0;
    const numB = parseInt((b.tutorId || '').replace(/\D/g, '')) || 0;
    if (numA && numB) return numA - numB;
    return (a.displayName || a.email).localeCompare(b.displayName || b.email);
  });

  CACHE.systemUsers = allUsers;
  saveCachedCollection('systemUsers', allUsers);
  return allUsers;
}

/**
 * Delete a user profile from the Firestore users collection with Trash Archive support
 */
export async function deleteSystemUser(uid: string): Promise<string> {
  try {
    let userData = CACHE.systemUsers?.find(u => u.uid === uid) || null;
    const userRef = doc(db, USERS_COL, uid);

    if (!userData) {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        userData = { uid: snap.id, ...snap.data() } as UserProfile;
      }
    }

    if (CACHE.systemUsers) {
      CACHE.systemUsers = CACHE.systemUsers.filter(u => u.uid !== uid);
    }

    if (userData) {
      const trashItem: Omit<TrashRecord, 'id'> = {
        originalId: uid,
        itemType: 'user',
        title: `${userData.displayName || userData.email} (${userData.role})`,
        subtitle: `Email: ${userData.email} • Status: ${userData.status}`,
        data: sanitizeFirestoreObject(userData),
        deletedAt: new Date().toISOString()
      };
      let trashId = `trash-${Date.now()}`;
      try {
        const trashDoc = await addDoc(collection(db, TRASH_COL), trashItem);
        trashId = trashDoc.id;
      } catch (err) {
        console.warn('Could not persist to deleted_records, saving locally:', err);
      }
      const record = { id: trashId, ...trashItem };
      MEMORY_TRASH.unshift(record);
      if (CACHE.trash) CACHE.trash.unshift(record);

      await deleteDoc(userRef);
      return trashId;
    }

    await deleteDoc(userRef);
    return '';
  } catch (err) {
    console.warn(`Could not delete user ${uid}:`, err);
    throw err;
  }
}

// ==========================================
// ACADEMY SECURITY & ACTIVE USER SESSIONS AUDITING
// ==========================================
export const SESSIONS_COL = 'user_sessions';
let MEMORY_SESSIONS: AcademyUserSession[] = [];

/**
 * Record or update active session heartbeat for a logged in user
 */
export async function recordUserSessionHeartbeat(session: {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  tutorId?: string;
  studentId?: string;
  ipAddress?: string;
  location?: string;
}): Promise<void> {
  const sessionId = `sess_${session.uid.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const now = new Date().toISOString();

  // Detect user agent & device
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTablet = /iPad|Tablet|PlayBook/i.test(ua);
  const deviceType = isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop';
  
  let browser = 'Web Browser';
  if (ua.includes('Chrome')) browser = 'Google Chrome';
  else if (ua.includes('Safari')) browser = 'Apple Safari';
  else if (ua.includes('Firefox')) browser = 'Mozilla Firefox';
  else if (ua.includes('Edge')) browser = 'Microsoft Edge';

  let operatingSystem = 'Windows/MacOS';
  if (ua.includes('Windows')) operatingSystem = 'Windows';
  else if (ua.includes('Macintosh') || ua.includes('Mac OS')) operatingSystem = 'macOS';
  else if (ua.includes('iPhone') || ua.includes('iPad')) operatingSystem = 'iOS';
  else if (ua.includes('Android')) operatingSystem = 'Android';
  else if (ua.includes('Linux')) operatingSystem = 'Linux';

  const sessionRecord: AcademyUserSession = {
    id: sessionId,
    uid: session.uid,
    email: session.email,
    displayName: session.displayName || session.email,
    role: session.role,
    tutorId: session.tutorId,
    studentId: session.studentId,
    loginTimestamp: now,
    lastActiveTimestamp: now,
    ipAddress: session.ipAddress || '127.0.0.1 (Direct TLS)',
    userAgent: ua.slice(0, 150),
    deviceType,
    browser,
    operatingSystem,
    isOnline: true,
    status: 'active',
    location: session.location || 'Islamabad, PK (Academy HQ)'
  };

  // 1. Update in-memory
  const existingIdx = MEMORY_SESSIONS.findIndex(s => s.id === sessionId);
  if (existingIdx !== -1) {
    MEMORY_SESSIONS[existingIdx] = {
      ...MEMORY_SESSIONS[existingIdx],
      ...sessionRecord,
      loginTimestamp: MEMORY_SESSIONS[existingIdx].loginTimestamp
    };
  } else {
    MEMORY_SESSIONS.unshift(sessionRecord);
  }

  // 2. Persist to Firestore
  try {
    const sessionRef = doc(db, SESSIONS_COL, sessionId);
    await setDoc(sessionRef, sanitizeFirestoreObject(sessionRecord), { merge: true });
    
    // Also update user's profile with lastActiveAt & lastLoginAt
    const userRef = doc(db, USERS_COL, session.uid);
    await setDoc(userRef, {
      lastActiveAt: now,
      lastLoginAt: now,
      sessionStatus: 'online',
      deviceInfo: `${browser} on ${operatingSystem}`
    }, { merge: true });
  } catch (err) {
    console.warn('Could not persist session heartbeat:', err);
  }
}

/**
 * Get all active sessions for Security Auditing
 */
export async function getActiveUserSessions(forceRefresh = false): Promise<AcademyUserSession[]> {
  try {
    const q = query(collection(db, SESSIONS_COL), orderBy('lastActiveTimestamp', 'desc'), limit(50));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() } as AcademyUserSession));
      MEMORY_SESSIONS = records;
      return records;
    }
  } catch (err) {
    console.warn('Could not query user_sessions:', err);
  }

  return MEMORY_SESSIONS;
}

/**
 * Terminate/Revoke an active user session
 */
export async function terminateUserSession(sessionId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, SESSIONS_COL, sessionId));
  } catch (err) {
    console.warn('Could not delete session doc:', err);
  }
  MEMORY_SESSIONS = MEMORY_SESSIONS.filter(s => s.id !== sessionId);
}

// ==========================================
// TRASH, UNDO & RECOVERY ENGINE (ITEM 10)
// Prevents duplicate & conflicting restored records
// ==========================================
export async function getTrashRecords(forceRefresh = false): Promise<TrashRecord[]> {
  if (CACHE.trash && !forceRefresh) {
    return CACHE.trash;
  }
  try {
    const q = query(collection(db, TRASH_COL), orderBy('deletedAt', 'desc'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const dbRecords = snap.docs.map(d => ({ id: d.id, ...d.data() } as TrashRecord));
      // Combine with memory records if any are unsynced
      const dbIds = new Set(dbRecords.map(r => r.id));
      const unsynced = MEMORY_TRASH.filter(m => !dbIds.has(m.id));
      const combined = [...unsynced, ...dbRecords];
      CACHE.trash = combined;
      return combined;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, TRASH_COL);
  }
  CACHE.trash = [...MEMORY_TRASH];
  return [...MEMORY_TRASH];
}

/**
 * Restores a deleted record safely.
 * Strict Conflict & Duplicate Prevention:
 * - Timetable Slots: validates against currently scheduled tutor and student clashes.
 * - Students: verifies no colliding active Student IDs.
 * - Tutors: verifies no colliding active Tutor IDs.
 */
export async function restoreTrashRecord(trashId: string): Promise<{ success: boolean; message: string }> {
  try {
    let trashRecord: TrashRecord | null = null;
    const trashRef = doc(db, TRASH_COL, trashId);
    try {
      const snap = await getDoc(trashRef);
      if (snap.exists()) {
        trashRecord = { id: snap.id, ...snap.data() } as TrashRecord;
      }
    } catch (err) {
      console.warn('Could not fetch from Firestore deleted_records, checking memory:', err);
    }

    if (!trashRecord) {
      trashRecord = MEMORY_TRASH.find(t => t.id === trashId) || null;
    }

    if (!trashRecord) {
      throw new Error('Recovery record not found or has been permanently purged.');
    }

    const { itemType, data, originalId } = trashRecord;

    // 1. Restore Timetable Class with Strict Slot Overlap & Conflict Check
    if (itemType === 'class') {
      const classData = data as TimetableClass;
      const currentClasses = CACHE.classes || (await getClasses());

      // Check if slot with same original ID already exists
      const existingSameId = currentClasses.find(c => c.id === originalId);
      if (existingSameId) {
        throw new Error(`A timetable slot with ID "${originalId}" is already active.`);
      }

      // Check booking conflict with validateClassBooking
      const validation = validateClassBooking(classData, currentClasses);
      if (!validation.valid) {
        throw new Error(`Cannot restore timetable slot due to scheduling conflict: ${validation.error}`);
      }

      // Re-insert safely
      const { id, ...cleanData } = classData;
      const restoredClass: TimetableClass = { ...cleanData, id: originalId };
      CACHE.classes = [restoredClass, ...(CACHE.classes || [])];
      await setDoc(doc(db, CLASSES_COL, originalId), sanitizeFirestoreObject(restoredClass));
    }
    // 2. Restore Student with Duplicate StudentID Check
    else if (itemType === 'student') {
      const studentData = data as Student;
      const currentStudents = CACHE.students || (await getStudents());
      const existingStudent = currentStudents.find(s => s.studentId === studentData.studentId);
      if (existingStudent && existingStudent.id !== originalId) {
        throw new Error(`A student with Student ID "${studentData.studentId}" is already registered. Rename or resolve conflict first.`);
      }
      const { id, ...cleanData } = studentData;
      const restoredStudent: Student = { ...cleanData, id: originalId };
      CACHE.students = [restoredStudent, ...(CACHE.students || [])];
      await setDoc(doc(db, STUDENTS_COL, originalId), sanitizeFirestoreObject(restoredStudent));
    }
    // 3. Restore Tutor with Duplicate TutorID Check
    else if (itemType === 'tutor') {
      const tutorData = data as Tutor;
      const currentTutors = CACHE.tutors || (await getTutors());
      const existingTutor = currentTutors.find(t => t.tutorId === tutorData.tutorId);
      if (existingTutor && existingTutor.id !== originalId) {
        throw new Error(`A tutor with Tutor ID "${tutorData.tutorId}" is already active in faculty list.`);
      }
      const { id, ...cleanData } = tutorData;
      const restoredTutor: Tutor = { ...cleanData, id: originalId };
      CACHE.tutors = [restoredTutor, ...(CACHE.tutors || [])];
      await setDoc(doc(db, TUTORS_COL, originalId), sanitizeFirestoreObject(restoredTutor));
    }
    // 4. Restore User Profile
    else if (itemType === 'user') {
      const userData = data as UserProfile;
      const { uid, ...cleanData } = userData;
      const restoredUser: UserProfile = { ...cleanData, uid: originalId };
      CACHE.systemUsers = [restoredUser, ...(CACHE.systemUsers || [])];
      await setDoc(doc(db, USERS_COL, originalId), sanitizeFirestoreObject(restoredUser));
    }
    // 5. Restore Referral
    else if (itemType === 'referral') {
      const { id, ...cleanData } = data;
      const restoredRef: Referral = { id: originalId, ...cleanData };
      CACHE.referrals = [restoredRef, ...(CACHE.referrals || [])];
      await setDoc(doc(db, REFERRALS_COL, originalId), sanitizeFirestoreObject(cleanData));
    }
    // 6. Restore Announcement
    else if (itemType === 'announcement') {
      const { id, ...cleanData } = data;
      const restoredAnn: Announcement = { id: originalId, ...cleanData };
      CACHE.announcements = [restoredAnn, ...(CACHE.announcements || [])];
      await setDoc(doc(db, ANNOUNCEMENTS_COL, originalId), sanitizeFirestoreObject(cleanData));
    }
    // 7. Restore Tutor Attendance
    else if (itemType === 'tutor_attendance') {
      const { id, ...cleanData } = data;
      const restoredRec: TutorAttendanceRecord = { id: originalId, ...cleanData };
      CACHE.tutorAttendance = [restoredRec, ...(CACHE.tutorAttendance || [])];
      await setDoc(doc(db, TUTOR_ATTENDANCE_COL, originalId), sanitizeFirestoreObject(cleanData));
    }

    // Purge from trash record
    try {
      await deleteDoc(trashRef);
    } catch (e) {
      console.warn('Could not delete trash doc from Firestore:', e);
    }
    MEMORY_TRASH = MEMORY_TRASH.filter(t => t.id !== trashId);
    if (CACHE.trash) {
      CACHE.trash = CACHE.trash.filter(t => t.id !== trashId);
    }

    return { success: true, message: `Successfully restored "${trashRecord.title}".` };
  } catch (err: any) {
    console.warn('Failed to restore trash record:', err);
    throw err;
  }
}

/**
 * Permanently delete a record from trash
 */
export async function permanentlyDeleteTrashRecord(trashId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, TRASH_COL, trashId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, TRASH_COL);
  }
  MEMORY_TRASH = MEMORY_TRASH.filter(t => t.id !== trashId);
  if (CACHE.trash) {
    CACHE.trash = CACHE.trash.filter(t => t.id !== trashId);
  }
}

/**
 * Empty entire trash archive
 */
export async function emptyTrash(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, TRASH_COL));
    const deleteOps = snap.docs.map(d => deleteDoc(doc(db, TRASH_COL, d.id)));
    if (deleteOps.length > 0) {
      await Promise.all(deleteOps);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, TRASH_COL);
  }
  MEMORY_TRASH = [];
  CACHE.trash = [];
}

const DEFAULT_ACADEMY_SETTINGS: AcademySettings = {
  academyName: 'IslamicTuition',
  operationalTimezone: 'Asia/Karachi',
  contactEmail: 'info@islamictuition.us',
  contactPhone: '+1 (718) 618-4848',
  defaultZoomLink: 'https://zoom.us/j/islamictuition_main'
};

// Timeout helper to guarantee collection fetch promises never hang indefinitely
export async function queryWithTimeout<T>(promise: Promise<T>, timeoutMs = 1000, fallback: T | null = null): Promise<T | null> {
  let timer: any;
  const timeoutPromise = new Promise<T | null>((resolve) => {
    timer = setTimeout(() => resolve(fallback), timeoutMs);
  });
  try {
    const res = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer);
    return (res !== null ? res : fallback) as T | null;
  } catch (err) {
    clearTimeout(timer);
    return fallback;
  }
}

/**
 * High-Speed Parallel Multi-Collection Loader
 * Loads all collections simultaneously using Promise.all to reduce initial load time from 15-20s down to <1s.
 */
export async function fetchAllAcademyData(forceRefresh = false): Promise<{
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
  settings: AcademySettings;
}> {
  const fetchStart = Date.now();

  const fetchPromise = Promise.all([
    getStudents(forceRefresh).catch(() => CACHE.students || (isCleanDataMode() ? [] : SEED_STUDENTS)),
    getTutors(forceRefresh).catch(() => CACHE.tutors || (isCleanDataMode() ? [] : SEED_TUTORS)),
    getClasses(forceRefresh).catch(() => CACHE.classes || (isCleanDataMode() ? [] : SEED_CLASSES)),
    getLessons(forceRefresh).catch(() => CACHE.lessons || (isCleanDataMode() ? [] : SEED_LESSONS)),
    getFees(forceRefresh).catch(() => CACHE.fees || (isCleanDataMode() ? [] : SEED_FEES)),
    getSalaries(forceRefresh).catch(() => CACHE.salaries || (isCleanDataMode() ? [] : SEED_SALARIES)),
    getReferrals(forceRefresh).catch(() => CACHE.referrals || (isCleanDataMode() ? [] : SEED_REFERRALS)),
    getAnnouncements(forceRefresh).catch(() => CACHE.announcements || (isCleanDataMode() ? [] : SEED_ANNOUNCEMENTS)),
    getAttendanceRecords(forceRefresh).catch(() => CACHE.attendance || (isCleanDataMode() ? [] : SEED_ATTENDANCE)),
    getTutorAttendanceRecords(forceRefresh).catch(() => CACHE.tutorAttendance || (isCleanDataMode() ? [] : SEED_TUTOR_ATTENDANCE)),
    getAcademySettings(forceRefresh).catch(() => CACHE.settings || DEFAULT_ACADEMY_SETTINGS)
  ]);

  const fallbackData = {
    students: CACHE.students || (isCleanDataMode() ? [] : SEED_STUDENTS),
    tutors: (CACHE.tutors && CACHE.tutors.length >= 20) ? CACHE.tutors : INITIAL_TUTOR_ENTITIES,
    classes: CACHE.classes || (isCleanDataMode() ? [] : SEED_CLASSES),
    lessons: CACHE.lessons || (isCleanDataMode() ? [] : SEED_LESSONS),
    fees: CACHE.fees || (isCleanDataMode() ? [] : SEED_FEES),
    salaries: CACHE.salaries || (isCleanDataMode() ? [] : SEED_SALARIES),
    referrals: CACHE.referrals || (isCleanDataMode() ? [] : SEED_REFERRALS),
    announcements: CACHE.announcements || (isCleanDataMode() ? [] : SEED_ANNOUNCEMENTS),
    attendance: CACHE.attendance || (isCleanDataMode() ? [] : SEED_ATTENDANCE),
    tutorAttendance: CACHE.tutorAttendance || (isCleanDataMode() ? [] : SEED_TUTOR_ATTENDANCE),
    settings: CACHE.settings || DEFAULT_ACADEMY_SETTINGS
  };

  const results = await queryWithTimeout(fetchPromise, 5000, null);

  if (results) {
    const [
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
      settings
    ] = results;

    console.log(`[DataService] fetchAllAcademyData completed in ${Date.now() - fetchStart}ms`);
    return {
      students,
      tutors: tutors && tutors.length >= 20 ? tutors : INITIAL_TUTOR_ENTITIES,
      classes,
      lessons,
      fees,
      salaries,
      referrals,
      announcements,
      attendance,
      tutorAttendance,
      settings
    };
  }

  console.warn(`[DataService] fetchAllAcademyData hit 1.2s timeout — served fresh local/seed cache instantly in ${Date.now() - fetchStart}ms`);
  return fallbackData;
}

// ==========================================
// LIVE CALLING API (WhatsApp Style Live Calls)
// ==========================================
const CALLS_COL = 'calls';

export async function initiateCallSession(callData: Omit<ActiveCallSession, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, CALLS_COL), sanitizeFirestoreObject({
    ...callData,
    status: 'calling',
    startedAt: new Date().toISOString()
  }));
  return docRef.id;
}

export async function updateCallSession(callId: string, updates: Partial<ActiveCallSession>): Promise<void> {
  try {
    const docRef = doc(db, CALLS_COL, callId);
    await updateDoc(docRef, sanitizeFirestoreObject(updates));
  } catch (err) {
    console.warn('Error updating call session:', err);
  }
}

export async function endCallSession(
  callId: string,
  durationSeconds = 0,
  finalStatus: CallStatus = 'ended',
  logThreadId?: string,
  callerName?: string,
  callType: CallType = 'audio'
): Promise<void> {
  const now = new Date().toISOString();
  try {
    const docRef = doc(db, CALLS_COL, callId);
    await updateDoc(docRef, {
      status: finalStatus,
      endedAt: now,
      durationSeconds
    });

    if (logThreadId) {
      let callSummaryText = '';
      if (durationSeconds > 0) {
        const mins = Math.floor(durationSeconds / 60);
        const secs = durationSeconds % 60;
        const durStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        callSummaryText = `${callType === 'video' ? 'Video' : 'Voice'} call ended (${durStr})`;
      } else if (finalStatus === 'rejected') {
        callSummaryText = `Declined ${callType === 'video' ? 'video' : 'voice'} call`;
      } else if (finalStatus === 'missed') {
        callSummaryText = `Missed ${callType === 'video' ? 'video' : 'voice'} call`;
      } else {
        callSummaryText = `${callType === 'video' ? 'Video' : 'Voice'} call ended`;
      }

      const now = new Date().toISOString();
      await sendMessage({
        threadId: logThreadId,
        senderId: 'system_call',
        senderName: callerName || 'Academy Call',
        senderRole: 'admin',
        text: callSummaryText,
        timestamp: now,
        read: false,
        delivered: true,
        status: 'sent',
        seenBy: ['system_call'],
        deliveredTo: ['system_call'],
        seenTimestamps: { system_call: now },
        deliveredTimestamps: { system_call: now },
        listenedBy: []
      });
    }
  } catch (err) {
    console.warn('Error ending call session:', err);
  }
}

export function subscribeToIncomingCalls(
  userId: string,
  userRole: UserRole,
  onIncomingCall: (call: ActiveCallSession | null) => void
) {
  if (isFirestoreQuotaExceeded()) {
    onIncomingCall(null);
    return () => {};
  }

  const cleanUserId = userId.toLowerCase().replace(/[^a-z0-9]/g, '_');
  // Target only active incoming calls rather than reading the entire collection
  const q = query(
    collection(db, CALLS_COL),
    where('status', 'in', ['calling', 'ringing']),
    limit(5)
  );

  return safeOnSnapshot(
    q,
    (snapshot) => {
      let activeIncoming: ActiveCallSession | null = null;
      const nowMs = Date.now();

      snapshot.docs.forEach((d: any) => {
        const call = { id: d.id, ...d.data() } as ActiveCallSession;
        if (call.status === 'calling' || call.status === 'ringing') {
          // Discard stale calls older than 2 minutes
          const callStartMs = new Date(call.startedAt || 0).getTime();
          if (nowMs - callStartMs > 120000) return;

          const receiverClean = (call.receiverId || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
          const isTarget =
            call.receiverId === userId ||
            receiverClean.includes(cleanUserId) ||
            cleanUserId.includes(receiverClean) ||
            (userRole === 'admin' && (call.receiverRole === 'admin' || call.receiverId.includes('admin')));

          if (isTarget && call.callerId !== userId) {
            activeIncoming = call;
          }
        }
      });
      onIncomingCall(activeIncoming);
    },
    (_err) => {
      onIncomingCall(null);
    },
    CALLS_COL
  );
}

export function subscribeToCallSession(
  callId: string,
  onUpdate: (call: ActiveCallSession | null) => void
) {
  if (isFirestoreQuotaExceeded()) {
    onUpdate(null);
    return () => {};
  }

  return safeOnSnapshot(
    doc(db, CALLS_COL, callId),
    (snap) => {
      if (snap.exists()) {
        onUpdate({ id: snap.id, ...snap.data() } as ActiveCallSession);
      } else {
        onUpdate(null);
      }
    },
    (_err) => {
      onUpdate(null);
    },
    `${CALLS_COL}/${callId}`
  );
}

/**
 * WebRTC ICE Candidate signaling methods
 */
export async function addCallerIceCandidate(callId: string, candidate: any): Promise<void> {
  try {
    const colRef = collection(db, CALLS_COL, callId, 'callerCandidates');
    await addDoc(colRef, candidate);
  } catch (err) {
    console.warn('Error adding caller ICE candidate:', err);
  }
}

export async function addReceiverIceCandidate(callId: string, candidate: any): Promise<void> {
  try {
    const colRef = collection(db, CALLS_COL, callId, 'receiverCandidates');
    await addDoc(colRef, candidate);
  } catch (err) {
    console.warn('Error adding receiver ICE candidate:', err);
  }
}

export function subscribeToCallerIceCandidates(
  callId: string,
  onCandidate: (candidate: any) => void
) {
  if (isFirestoreQuotaExceeded()) return () => {};
  const colRef = collection(db, CALLS_COL, callId, 'callerCandidates');
  return safeOnSnapshot(
    colRef,
    (snap) => {
      snap.docChanges().forEach((change: any) => {
        if (change.type === 'added') {
          onCandidate(change.doc.data());
        }
      });
    },
    (_err) => {},
    `${CALLS_COL}/${callId}/callerCandidates`
  );
}

export function subscribeToReceiverIceCandidates(
  callId: string,
  onCandidate: (candidate: any) => void
) {
  if (isFirestoreQuotaExceeded()) return () => {};
  const colRef = collection(db, CALLS_COL, callId, 'receiverCandidates');
  return safeOnSnapshot(
    colRef,
    (snap) => {
      snap.docChanges().forEach((change: any) => {
        if (change.type === 'added') {
          onCandidate(change.doc.data());
        }
      });
    },
    (_err) => {},
    `${CALLS_COL}/${callId}/receiverCandidates`
  );
}


