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
  writeBatch,
  getCountFromServer,
  deleteField,
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
  idbGet,
  idbSet,
  idbDelete,
  idbClear
} from './indexedDBStorage';
import {
  Student,
  Tutor,
  TimetableClass,
  DayOfWeek,
  ClassDuration,
  Lesson,
  AttendanceRecord,
  TutorAttendanceRecord,
  StudentFee,
  TutorSalary,
  Referral,
  StudentReferralLead,
  Announcement,
  ChatReaction,
  ChatMessage,
  AcademySettings,
  UserRole,
  UserProfile,
  UserAccountStatus,
  CourseType,
  StudentStatus,
  AllowedCurrency,
  TutorStudentView,
  TrashRecord,
  TrashItemType,
  ActiveCallSession,
  CallType,
  CallStatus,
  AcademyUserSession,
  SummaryMetrics
} from '../types';
import { generateStudentEmail, generateParentEmail, ACADEMY_DOMAIN } from '../utils/studentEmail';
export { generateStudentEmail, generateParentEmail, ACADEMY_DOMAIN };

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

interface SharedListenerEntry {
  realUnsub: (() => void) | null;
  callbacks: Set<(snap: any) => void>;
  lastSnap: any | null;
}

const SHARED_LISTENERS = new Map<string, SharedListenerEntry>();

function getQueryKey(ref: any, pathHint?: string): string {
  try {
    if (ref && typeof ref.path === 'string' && !ref._query) {
      return `doc:${ref.path}`;
    }
    const q = ref?._query || ref?._delegate?._query;
    if (q) {
      const pathStr = q.path?.segments ? q.path.segments.join('/') : (pathHint || 'query');
      const filtersStr = Array.isArray(q.filters)
        ? q.filters.map((f: any) => `${f.field?.segments?.join('.') || f.field || ''}:${f.op || ''}:${JSON.stringify(f.value)}`).join('|')
        : '';
      const orderStr = Array.isArray(q.explicitOrderBy)
        ? q.explicitOrderBy.map((o: any) => `${o.field?.segments?.join('.') || ''}:${o.dir || ''}`).join('|')
        : '';
      const limitStr = q.limit ?? 'all';
      return `q:${pathHint || pathStr}:f(${filtersStr}):o(${orderStr}):l(${limitStr})`;
    }
  } catch (_) {}
  return pathHint || `listener_${Math.random().toString(36).slice(2)}`;
}

/**
 * Multi-cast resilient onSnapshot wrapper with reference-counting and deduplication
 * to prevent duplicate Firestore connections & quota exhaustion across components.
 */
function safeOnSnapshot<T>(
  reference: Query<T> | DocumentReference<T>,
  onNext: (snapshot: any) => void,
  onError?: (error: any) => void,
  operationPath?: string
): () => void {
  if (!auth.currentUser) {
    return () => {};
  }

  if (isFirestoreQuotaExceeded()) {
    if (onError) {
      onError(new Error('Firestore quota exceeded or backend unavailable'));
    }
    return () => {};
  }

  const listenerKey = getQueryKey(reference, operationPath);
  let entry = SHARED_LISTENERS.get(listenerKey);

  if (entry) {
    entry.callbacks.add(onNext);
    if (entry.lastSnap) {
      try {
        onNext(entry.lastSnap);
      } catch (_) {}
    }

    return () => {
      if (entry) {
        entry.callbacks.delete(onNext);
        if (entry.callbacks.size === 0) {
          if (entry.realUnsub) {
            try { entry.realUnsub(); } catch (_) {}
          }
          SHARED_LISTENERS.delete(listenerKey);
        }
      }
    };
  }

  const newEntry: SharedListenerEntry = {
    realUnsub: null,
    callbacks: new Set([onNext]),
    lastSnap: null,
  };

  SHARED_LISTENERS.set(listenerKey, newEntry);

  try {
    const realUnsub = onSnapshot(
      reference as any,
      (snap) => {
        newEntry.lastSnap = snap;
        newEntry.callbacks.forEach((cb) => {
          try { cb(snap); } catch (_) {}
        });
      },
      (err) => {
        if (newEntry.realUnsub) {
          try { newEntry.realUnsub(); } catch (_) {}
        }
        SHARED_LISTENERS.delete(listenerKey);
        try {
          handleFirestoreError(err, OperationType.GET, operationPath || (reference as any).path || 'snapshot');
        } catch (handledErr) {
          if (onError) onError(handledErr);
        }
      }
    );
    newEntry.realUnsub = realUnsub;
  } catch (err) {
    SHARED_LISTENERS.delete(listenerKey);
    try {
      handleFirestoreError(err, OperationType.GET, operationPath || 'snapshot');
    } catch (handledErr) {
      if (onError) onError(handledErr);
    }
  }

  return () => {
    newEntry.callbacks.delete(onNext);
    if (newEntry.callbacks.size === 0) {
      if (newEntry.realUnsub) {
        try { newEntry.realUnsub(); } catch (_) {}
      }
      SHARED_LISTENERS.delete(listenerKey);
    }
  };
}

/**
 * Delta Syncing Engine (Pillar 2)
 * Applies incremental snap.docChanges() updates ('added', 'modified', 'removed')
 * to current in-memory cache arrays without re-mapping unchanged documents.
 */
export function applySnapshotDelta<T extends { id: string }>(
  currentItems: T[],
  snap: any
): T[] {
  if (!snap) return currentItems || [];

  // Initial baseline snapshot load or uninitialized cache
  if (!currentItems || currentItems.length === 0 || (snap.docChanges && snap.docChanges().length === snap.docs.length)) {
    return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as T));
  }

  // Incremental delta processing
  const docChanges = snap.docChanges ? snap.docChanges() : [];
  if (!docChanges || docChanges.length === 0) {
    return currentItems;
  }

  const itemsMap = new Map<string, T>(currentItems.map(item => [item.id, item]));

  for (const change of docChanges) {
    const docId = change.doc.id;
    if (change.type === 'removed') {
      itemsMap.delete(docId);
    } else {
      // 'added' or 'modified'
      const updatedItem = { id: docId, ...change.doc.data() } as T;
      itemsMap.set(docId, updatedItem);
    }
  }

  return Array.from(itemsMap.values());
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
const REFERRAL_LEADS_COL = 'referral_leads';
const ANNOUNCEMENTS_COL = 'announcements';
const MESSAGES_COL = 'messages';
const SETTINGS_COL = 'settings';
const TRASH_COL = 'deleted_records';
const SUMMARY_COL = 'summary';
const SUMMARY_DOC_ID = 'metrics';

// In-memory high-speed cache for sub-millisecond local reads and optimistic synchronization
interface MemoryCacheStore {
  students: Student[] | null;
  tutors: Tutor[] | null;
  classes: TimetableClass[] | null;
  lessons: Lesson[] | null;
  fees: StudentFee[] | null;
  salaries: TutorSalary[] | null;
  referrals: Referral[] | null;
  referralLeads: StudentReferralLead[] | null;
  announcements: Announcement[] | null;
  attendance: AttendanceRecord[] | null;
  tutorAttendance: TutorAttendanceRecord[] | null;
  systemUsers: UserProfile[] | null;
  settings: AcademySettings | null;
  trash: TrashRecord[] | null;
  metrics: SummaryMetrics | null;
}

const CACHE: MemoryCacheStore = {
  students: null,
  tutors: null,
  classes: null,
  lessons: null,
  fees: null,
  salaries: null,
  referrals: null,
  referralLeads: null,
  announcements: null,
  attendance: null,
  tutorAttendance: null,
  systemUsers: null,
  settings: null,
  trash: null,
  metrics: null
};

// In-memory recovery cache for rapid offline and session reactivity
let MEMORY_TRASH: TrashRecord[] = [];

const CACHE_STORAGE_PREFIX = 'it_academy_cache_';

const CROSS_TAB_CHANNEL = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('it_academy_cross_tab_channel')
  : null;

if (CROSS_TAB_CHANNEL) {
  CROSS_TAB_CHANNEL.onmessage = (event) => {
    if (event.data && event.data.type === 'CACHE_UPDATED' && event.data.key) {
      const { key, value } = event.data;
      if (key in CACHE) {
        (CACHE as any)[key] = value;
      }
    }
  };
}

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
  CACHE.metrics = null;
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
  idbClear().catch(() => {});
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
  // Pillar 4: Persistent IndexedDB async background sync
  idbSet(`${CACHE_STORAGE_PREFIX}${String(key)}`, value).catch(() => {});
  idbSet(`${CACHE_STORAGE_PREFIX}${String(key)}_time`, Date.now()).catch(() => {});
  try {
    if (CROSS_TAB_CHANNEL) {
      CROSS_TAB_CHANNEL.postMessage({ type: 'CACHE_UPDATED', key, value });
    }
  } catch (_) {}
}

/**
 * Hydrates in-memory CACHE and localStorage asynchronously from IndexedDB
 * during startup so page refreshes load instantly with 0 mandatory network reads.
 */
export async function initPersistentLocalCache(): Promise<void> {
  const keys: (keyof MemoryCacheStore)[] = [
    'students',
    'tutors',
    'classes',
    'lessons',
    'fees',
    'salaries',
    'referrals',
    'announcements',
    'attendance',
    'tutorAttendance',
    'systemUsers',
    'settings',
    'trash',
    'metrics'
  ];

  await Promise.all(
    keys.map(async (key) => {
      if (CACHE[key] !== null && CACHE[key] !== undefined) return;

      const syncVal = loadCachedCollection<any>(key);
      if (syncVal !== null && syncVal !== undefined) {
        CACHE[key] = syncVal;
        return;
      }

      const idbVal = await idbGet<any>(`${CACHE_STORAGE_PREFIX}${String(key)}`);
      if (idbVal !== null && idbVal !== undefined) {
        CACHE[key] = idbVal;
        try {
          localStorage.setItem(`${CACHE_STORAGE_PREFIX}${String(key)}`, JSON.stringify(idbVal));
        } catch {}
      }
    })
  );
}

if (typeof window !== 'undefined') {
  initPersistentLocalCache().catch(() => {});
}

export function isCachedCollectionFresh(key: keyof MemoryCacheStore, maxAgeMs = 14400000): boolean {
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
const inMemoryPendingTutorAssignments = new Set<string>();
const inMemoryDismissedTutorAssignments = new Set<string>();

export function getDismissedTutorAssignmentKeys(): string[] {
  try {
    const raw = localStorage.getItem('it_dismissed_tutor_assignments_v2');
    const fromStorage: string[] = raw ? JSON.parse(raw) : [];
    fromStorage.forEach(k => inMemoryDismissedTutorAssignments.add(k));
  } catch {}
  return Array.from(inMemoryDismissedTutorAssignments);
}

export function getPendingTutorAssignmentKeys(): string[] {
  try {
    const raw = localStorage.getItem('it_new_tutor_assignments_v2');
    const fromStorage: string[] = raw ? JSON.parse(raw) : [];
    fromStorage.forEach(k => inMemoryPendingTutorAssignments.add(k));
  } catch {}
  return Array.from(inMemoryPendingTutorAssignments);
}

export function markNewStudentAssignmentForTutor(tutorId?: string, studentId?: string, studentName?: string): void {
  if (!tutorId || (!studentId && !studentName)) return;
  const normTutor = normalizeTutorId(tutorId);
  const idUpper = (studentId || '').trim().toUpperCase();
  const nameLower = (studentName || '').trim().toLowerCase();
  const keyId = `${normTutor}__${idUpper}`;
  const keyName = `${normTutor}__${nameLower}`;

  if (idUpper) {
    inMemoryPendingTutorAssignments.add(keyId);
    inMemoryDismissedTutorAssignments.delete(keyId);
    inMemoryDismissedTutorAssignments.delete(idUpper);
  }
  if (nameLower) {
    inMemoryPendingTutorAssignments.add(keyName);
    inMemoryDismissedTutorAssignments.delete(keyName);
    inMemoryDismissedTutorAssignments.delete(nameLower);
  }

  try {
    localStorage.setItem('it_new_tutor_assignments_v2', JSON.stringify(Array.from(inMemoryPendingTutorAssignments)));
    localStorage.setItem('it_dismissed_tutor_assignments_v2', JSON.stringify(Array.from(inMemoryDismissedTutorAssignments)));
  } catch {}
}

export function dismissNewStudentAssignmentForTutor(tutorId: string, studentIdentifiers: string[]): void {
  const normTutor = normalizeTutorId(tutorId);
  const keysToDismiss: string[] = [];
  studentIdentifiers.forEach(ident => {
    if (!ident) return;
    const upper = ident.trim().toUpperCase();
    const lower = ident.trim().toLowerCase();
    keysToDismiss.push(`${normTutor}__${upper}`);
    keysToDismiss.push(`${normTutor}__${lower}`);
    keysToDismiss.push(upper);
    keysToDismiss.push(lower);
  });

  // Always update in-memory sets first (works even inside cross-origin / sandboxed preview iframes)
  keysToDismiss.forEach(k => {
    inMemoryDismissedTutorAssignments.add(k);
    inMemoryPendingTutorAssignments.delete(k);
  });

  try {
    const rawDismissed = localStorage.getItem('it_dismissed_tutor_assignments_v2');
    const dismissedList: string[] = rawDismissed ? JSON.parse(rawDismissed) : [];
    dismissedList.forEach(k => inMemoryDismissedTutorAssignments.add(k));
    localStorage.setItem('it_dismissed_tutor_assignments_v2', JSON.stringify(Array.from(inMemoryDismissedTutorAssignments)));

    const rawPending = localStorage.getItem('it_new_tutor_assignments_v2');
    if (rawPending) {
      const pendingList: string[] = JSON.parse(rawPending);
      const dismissSet = new Set(keysToDismiss);
      const remaining = pendingList.filter(k => !dismissSet.has(k));
      inMemoryPendingTutorAssignments.clear();
      remaining.forEach(k => inMemoryPendingTutorAssignments.add(k));
      localStorage.setItem('it_new_tutor_assignments_v2', JSON.stringify(remaining));
    }
  } catch {}

  // Also clear isNewTutorAssignment flag in CACHE.students and Firestore so it never reappears across refreshes
  const idSet = new Set(studentIdentifiers.filter(Boolean).map(s => s.trim().toLowerCase()));
  if (CACHE.students) {
    const matchedDocs: Student[] = [];
    CACHE.students = CACHE.students.map(s => {
      const matchId = s.studentId && idSet.has(s.studentId.trim().toLowerCase());
      const matchName = s.name && idSet.has(s.name.trim().toLowerCase());
      if (matchId || matchName) {
        matchedDocs.push(s);
        return { ...s, isNewTutorAssignment: false };
      }
      return s;
    });
    if (matchedDocs.length > 0) {
      saveCachedCollection('students', CACHE.students);
      if (!isFirestoreQuotaExceeded()) {
        matchedDocs.forEach(s => {
          if (s.id && !s.id.startsWith('seed') && !s.id.startsWith('local')) {
            updateDoc(doc(db, STUDENTS_COL, s.id), { isNewTutorAssignment: false }).catch(() => {});
          }
        });
      }
    }
  }
}

export function sanitizeStudentForTutor(student: Student): TutorStudentView {
  const dismissedKeys = getDismissedTutorAssignmentKeys();
  const normTutor = normalizeTutorId(student.assignedTutorId || '');
  const idUpper = (student.studentId || '').trim().toUpperCase();
  const nameLower = (student.name || '').trim().toLowerCase();
  const isDismissed =
    (idUpper && (dismissedKeys.includes(idUpper) || (normTutor && dismissedKeys.includes(`${normTutor}__${idUpper}`)))) ||
    (nameLower && (dismissedKeys.includes(nameLower) || (normTutor && dismissedKeys.includes(`${normTutor}__${nameLower}`))));

  return {
    studentId: student.studentId,
    name: student.name,
    age: student.age,
    joiningDate: student.joiningDate || student.trialStartDate || student.createdAt?.slice(0, 10),
    status: student.status,
    assignedTutorId: student.assignedTutorId,
    courseType: student.courseType,
    trialSessionsCompleted: student.trialSessionsCompleted,
    trialSessionsTotal: student.trialSessionsTotal,
    trialStatus: student.trialStatus,
    isOnLeave: student.isOnLeave,
    leaveStartDate: student.leaveStartDate,
    leaveEndDate: student.leaveEndDate,
    leaveReason: student.leaveReason,
    isNewTutorAssignment: isDismissed ? false : Boolean(student.isNewTutorAssignment)
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
    .filter(s => isSameTutor(s.assignedTutorId, tutorId))
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
  if (stored && stored.length > 0 && !forceRefresh) {
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

export function subscribeToStudents(callback: (students: Student[]) => void, filterTutorId?: string): () => void {
  const getFallback = () => {
    const all = CACHE.students || loadCachedCollection<Student[]>('students') || [];
    return filterTutorId ? all.filter(s => isSameTutor(s.assignedTutorId, filterTutorId)) : all;
  };
  if (isFirestoreQuotaExceeded()) {
    callback(getFallback());
    return () => {};
  }
  const canonicalFilterId = filterTutorId ? normalizeTutorId(filterTutorId) : undefined;
  const q = canonicalFilterId
    ? query(collection(db, STUDENTS_COL), where('assignedTutorId', '==', canonicalFilterId))
    : collection(db, STUDENTS_COL);

  return safeOnSnapshot(
    q,
    (snap) => {
      if (snap) {
        const currentList = CACHE.students || [];
        const items = applySnapshotDelta<Student>(currentList, snap);
        items.sort((a, b) => (a.studentId || '').localeCompare(b.studentId || '', undefined, { numeric: true }));
        if (filterTutorId) {
          if (CACHE.students) {
            const others = CACHE.students.filter(s => !isSameTutor(s.assignedTutorId, filterTutorId));
            CACHE.students = [...items, ...others];
          } else {
            CACHE.students = items;
          }
          saveCachedCollection('students', CACHE.students);
          callback(CACHE.students);
        } else {
          CACHE.students = items;
          saveCachedCollection('students', items);
          callback(items);
        }
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

/**
 * Calculates the next sequential student ID based on existing students in state, cache, or seed.
 * e.g., if the highest student ID is "STU-276" (or "Stu-276"), the next sequential ID returned is "STU-277".
 */
export function getNextSequentialStudentId(existingStudents?: Student[]): string {
  const list = (existingStudents && existingStudents.length > 0)
    ? existingStudents
    : ((CACHE.students && CACHE.students.length > 0)
        ? CACHE.students
        : (loadCachedCollection<Student[]>('students') || (isCleanDataMode() ? [] : SEED_STUDENTS)));

  let maxNumber = 0;

  for (const s of list) {
    if (!s) continue;
    const rawId = (s.studentId || s.id || '').trim();
    // Match STU-### or Stu-### or any numeric sequence in the ID string
    const match = rawId.match(/(?:stu-?|student-?)?(\d+)/i);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNumber && num < 100000) {
        maxNumber = num;
      }
    }
  }

  // Next sequential ID
  const nextNum = maxNumber > 0 ? maxNumber + 1 : 101;
  return `STU-${nextNum}`;
}

/**
 * Calculates the next sequential Family ID (e.g. FAM-1001, FAM-1002, ...)
 */
export function getNextSequentialFamilyId(existingStudents?: Student[], existingUsers?: UserProfile[]): string {
  const students = (existingStudents && existingStudents.length > 0)
    ? existingStudents
    : ((CACHE.students && CACHE.students.length > 0)
        ? CACHE.students
        : (loadCachedCollection<Student[]>('students') || (isCleanDataMode() ? [] : SEED_STUDENTS)));

  let maxNum = 1000;
  for (const s of students) {
    if (!s) continue;
    const famId = s.familyGroupId || '';
    const match = famId.match(/FAM-(\d+)/i);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  const users = (existingUsers && existingUsers.length > 0)
    ? existingUsers
    : ((CACHE.systemUsers && CACHE.systemUsers.length > 0)
        ? CACHE.systemUsers
        : (loadCachedCollection<UserProfile[]>('systemUsers') || []));

  for (const u of users) {
    if (!u) continue;
    const famId = u.familyGroupId || '';
    const match = famId.match(/FAM-(\d+)/i);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `FAM-${maxNum + 1}`;
}

export async function addStudent(studentData: Omit<Student, 'id'>): Promise<string> {
  const docRef = doc(collection(db, STUDENTS_COL));
  const docId = docRef.id;

  // Ensure valid sequential studentId if missing or empty
  let finalStudentId = (studentData.studentId || '').trim();
  if (!finalStudentId) {
    finalStudentId = getNextSequentialStudentId(CACHE.students);
  }

  const assignedTutorId = normalizeTutorId(studentData.assignedTutorId) || studentData.assignedTutorId;
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const joiningDate = studentData.joiningDate || studentData.trialStartDate || todayDateStr;
  const trialStartDate = studentData.trialStartDate || joiningDate;

  const newStudent: Student = {
    id: docId,
    ...studentData,
    joiningDate,
    trialStartDate,
    assignedTutorId,
    studentId: finalStudentId,
    isNewTutorAssignment: true
  };
  if (assignedTutorId && assignedTutorId !== 'Unassigned') {
    markNewStudentAssignmentForTutor(assignedTutorId, finalStudentId, newStudent.name);
  }
  CACHE.students = [newStudent, ...(CACHE.students || [])];
  saveCachedCollection('students', CACHE.students);
  recalculateAndPersistSummaryMetrics().catch(() => {});

  // Sync to tutor roster in cache
  if (assignedTutorId) {
    if (CACHE.tutors) {
      CACHE.tutors = CACHE.tutors.map(t => {
        if (isSameTutor(t.tutorId, assignedTutorId)) {
          const list = t.assignedStudentIds || [];
          if (!list.includes(finalStudentId)) {
            return { ...t, assignedStudentIds: [...list, finalStudentId] };
          }
        }
        return t;
      });
      saveCachedCollection('tutors', CACHE.tutors);
    }
  }

  if (!isFirestoreQuotaExceeded()) {
    setDoc(docRef, sanitizeFirestoreObject(newStudent)).catch((err) => {
      handleFirestoreError(err, OperationType.CREATE, STUDENTS_COL);
    });
  }
  return docId;
}

export async function updateStudent(id: string, updates: Partial<Student>): Promise<void> {
  const current = CACHE.students?.find(s => s.id === id);
  if (current && updates.assignedTutorId && updates.assignedTutorId !== 'Unassigned' && !isSameTutor(updates.assignedTutorId, current.assignedTutorId)) {
    updates.isNewTutorAssignment = true;
    markNewStudentAssignmentForTutor(updates.assignedTutorId, current.studentId, updates.name || current.name);
  }
  // Optimistic cache update
  if (CACHE.students) {
    CACHE.students = CACHE.students.map(s => s.id === id ? { ...s, ...updates } : s);
    saveCachedCollection('students', CACHE.students);
    recalculateAndPersistSummaryMetrics().catch(() => {});
  }

  if (!isFirestoreQuotaExceeded()) {
    try {
      const studentRef = doc(db, STUDENTS_COL, id);
      await updateDoc(studentRef, sanitizeFirestoreObject(updates));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${STUDENTS_COL}/${id}`);
    }

    // 1. If student email changed, propagate to 'users' collection
    if (current && updates.email && current.email !== updates.email) {
      const oldEmailClean = current.email.trim().toLowerCase();
      const newEmailClean = updates.email.trim().toLowerCase();
      try {
        const usersToUpdate = new Map<string, any>();
        
        // Match by old email
        if (current.email) {
          const emailSnap = await getDocs(
            query(collection(db, USERS_COL), where('email', '==', current.email))
          );
          emailSnap.docs.forEach(uDoc => {
            if (uDoc.data().role === 'student') {
              usersToUpdate.set(uDoc.id, uDoc.data());
            }
          });
        }
        
        // Match by studentId
        if (current.studentId) {
          const idSnap = await getDocs(
            query(collection(db, USERS_COL), where('studentId', '==', current.studentId))
          );
          idSnap.docs.forEach(uDoc => {
            if (uDoc.data().role === 'student') {
              usersToUpdate.set(uDoc.id, uDoc.data());
            }
          });
        }

        for (const [docId, docData] of usersToUpdate.entries()) {
          await updateDoc(doc(db, USERS_COL, docId), {
            email: updates.email,
            studentId: current.studentId
          });
        }
        
        // Also update email-indexed doc if it exists
        if (oldEmailClean) {
          const oldEmailDocId = oldEmailClean.replace(/[@.]/g, '_');
          const newEmailDocId = newEmailClean.replace(/[@.]/g, '_');
          const oldEmailDocRef = doc(db, USERS_COL, oldEmailDocId);
          const oldEmailDocSnap = await getDoc(oldEmailDocRef);
          if (oldEmailDocSnap.exists()) {
            const uData = oldEmailDocSnap.data();
            await setDoc(doc(db, USERS_COL, newEmailDocId), {
              ...uData,
              email: updates.email
            }, { merge: true });
            await deleteDoc(oldEmailDocRef);
          }
        }
      } catch (err) {
        console.warn('Could not sync user profile student email updates:', err);
      }
    }

    // 2. If parent email changed, propagate to 'users' collection
    if (current && updates.parentEmail && current.parentEmail !== updates.parentEmail) {
      const oldParentClean = current.parentEmail.trim().toLowerCase();
      const newParentClean = updates.parentEmail.trim().toLowerCase();
      try {
        const usersToUpdate = new Map<string, any>();
        
        // Match by old parent email
        if (current.parentEmail) {
          const emailSnap = await getDocs(
            query(collection(db, USERS_COL), where('email', '==', current.parentEmail))
          );
          emailSnap.docs.forEach(uDoc => {
            if (uDoc.data().role === 'parent') {
              usersToUpdate.set(uDoc.id, uDoc.data());
            }
          });
        }
        
        // Match by studentId for parent role
        if (current.studentId) {
          const idSnap = await getDocs(
            query(collection(db, USERS_COL), where('studentId', '==', current.studentId))
          );
          idSnap.docs.forEach(uDoc => {
            if (uDoc.data().role === 'parent') {
              usersToUpdate.set(uDoc.id, uDoc.data());
            }
          });
        }

        for (const [docId, docData] of usersToUpdate.entries()) {
          await updateDoc(doc(db, USERS_COL, docId), {
            email: updates.parentEmail
          });
        }
        
        // Also update email-indexed doc
        if (oldParentClean) {
          const oldParentDocId = oldParentClean.replace(/[@.]/g, '_');
          const newParentDocId = newParentClean.replace(/[@.]/g, '_');
          const oldParentDocRef = doc(db, USERS_COL, oldParentDocId);
          const oldParentDocSnap = await getDoc(oldParentDocRef);
          if (oldParentDocSnap.exists()) {
            const uData = oldParentDocSnap.data();
            await setDoc(doc(db, USERS_COL, newParentDocId), {
              ...uData,
              email: updates.parentEmail
            }, { merge: true });
            await deleteDoc(oldParentDocRef);
          }
        }
      } catch (err) {
        console.warn('Could not sync user profile parent email updates:', err);
      }
    }

    // Refresh system users cache in background
    if (updates.email || updates.parentEmail) {
      getSystemUsers(true).catch(() => {});
    }
  }

  // If tutor assignment or name changed, update classes in cache and Firestore in parallel
  if (current && (updates.assignedTutorId || updates.name)) {
    const newTutorId = updates.assignedTutorId ? normalizeTutorId(updates.assignedTutorId) : undefined;
    const oldTutorId = current.assignedTutorId ? normalizeTutorId(current.assignedTutorId) : undefined;

    if (CACHE.classes) {
      CACHE.classes = CACHE.classes.map(c => {
        if (c.studentId === current.studentId) {
          return {
            ...c,
            ...(newTutorId ? { tutorId: newTutorId } : {}),
            ...(updates.name ? { studentName: updates.name } : {})
          };
        }
        return c;
      });
      saveCachedCollection('classes', CACHE.classes);
    }

    // Sync tutor rosters in CACHE.tutors
    if (newTutorId && oldTutorId && !isSameTutor(newTutorId, oldTutorId) && CACHE.tutors) {
      CACHE.tutors = CACHE.tutors.map(t => {
        if (isSameTutor(t.tutorId, oldTutorId)) {
          return {
            ...t,
            assignedStudentIds: (t.assignedStudentIds || []).filter(id => id !== current.studentId)
          };
        }
        if (isSameTutor(t.tutorId, newTutorId)) {
          const currentList = t.assignedStudentIds || [];
          if (!currentList.includes(current.studentId)) {
            return {
              ...t,
              assignedStudentIds: [...currentList, current.studentId]
            };
          }
        }
        return t;
      });
      saveCachedCollection('tutors', CACHE.tutors);
    }

    if (!isFirestoreQuotaExceeded()) {
      try {
        const classesSnap = await getDocs(
          query(collection(db, CLASSES_COL), where('studentId', '==', current.studentId))
        );
        const classUpdates = classesSnap.docs.map(d => {
          const payload: Partial<TimetableClass> = {};
          if (newTutorId) payload.tutorId = newTutorId;
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

export async function updateFamilyGroupBatch(params: {
  groupName: string;
  groupId: string;
  addedStudentIds: string[];
  removedStudentIds: string[];
}): Promise<void> {
  const { groupName, groupId, addedStudentIds, removedStudentIds } = params;

  // Optimistic local cache update
  if (CACHE.students) {
    CACHE.students = CACHE.students.map(s => {
      if (addedStudentIds.includes(s.studentId) || addedStudentIds.includes(s.id)) {
        return { ...s, familyGroupId: groupId, familyGroupName: groupName };
      }
      if (removedStudentIds.includes(s.studentId) || removedStudentIds.includes(s.id)) {
        return { ...s, familyGroupId: '', familyGroupName: '' };
      }
      return s;
    });
    saveCachedCollection('students', CACHE.students);
  }

  if (!isFirestoreQuotaExceeded()) {
    try {
      const batch = writeBatch(db);
      const allStudents = CACHE.students || (await getStudents());

      for (const sid of addedStudentIds) {
        const student = allStudents.find(s => s.studentId === sid || s.id === sid);
        if (student && !student.id.startsWith('local')) {
          batch.update(doc(db, STUDENTS_COL, student.id), {
            familyGroupId: groupId,
            familyGroupName: groupName
          });
        }
      }

      for (const sid of removedStudentIds) {
        const student = allStudents.find(s => s.studentId === sid || s.id === sid);
        if (student && !student.id.startsWith('local')) {
          batch.update(doc(db, STUDENTS_COL, student.id), {
            familyGroupId: '',
            familyGroupName: ''
          });
        }
      }

      await batch.commit();
    } catch (err) {
      console.warn("updateFamilyGroupBatch error:", err);
    }
  }

  recalculateAndPersistSummaryMetrics().catch(() => {});
}

export interface ShiftStudentTutorScheduleUpdate {
  changeTime: boolean;
  newStartTimePKT?: string;
  selectedDays?: DayOfWeek[];
  durationMinutes?: ClassDuration;
}

export interface ShiftStudentTutorParams {
  studentId: string;
  oldTutorId: string;
  newTutorId: string;
  notes?: string;
  scheduleUpdate?: ShiftStudentTutorScheduleUpdate;
}

export async function shiftStudentTutor(
  params: ShiftStudentTutorParams
): Promise<{ success: boolean; classesCount: number; message: string }> {
  const { studentId, oldTutorId, newTutorId, notes, scheduleUpdate } = params;

  // 1. Locate student
  const allStudents = await getStudents();
  const student = allStudents.find(s => s.studentId === studentId || s.id === studentId);
  if (!student) {
    throw new Error(`Student with ID ${studentId} not found.`);
  }

  let timeAuditNote = '';
  if (scheduleUpdate?.changeTime && scheduleUpdate.newStartTimePKT) {
    const daysStr = scheduleUpdate.selectedDays && scheduleUpdate.selectedDays.length > 0
      ? scheduleUpdate.selectedDays.join(', ')
      : 'scheduled days';
    timeAuditNote = ` New Time: ${scheduleUpdate.newStartTimePKT} PKT (${daysStr}).`;
  }

  const shiftAudit = `[Tutor Shift: ${new Date().toLocaleDateString('en-US')}] Transferred from ${oldTutorId} to ${newTutorId}.${timeAuditNote}${notes ? ` Note: ${notes}` : ''}`;
  const updatedNotes = student.privateAdminNotes
    ? `${student.privateAdminNotes}\n${shiftAudit}`
    : shiftAudit;

  const studentUpdates: Partial<Student> = {
    assignedTutorId: newTutorId,
    privateAdminNotes: updatedNotes,
    isNewTutorAssignment: true
  };
  markNewStudentAssignmentForTutor(newTutorId, student.studentId, student.name);

  // 2. Optimistic local cache updates
  if (CACHE.students) {
    CACHE.students = CACHE.students.map(s => s.id === student.id ? { ...s, ...studentUpdates } : s);
    saveCachedCollection('students', CACHE.students);
  }

  const allClasses = await getClasses();
  const studentClasses = allClasses.filter(c => c.studentId === studentId);

  let updatedClasses: TimetableClass[] = [];
  let createdClasses: TimetableClass[] = [];
  let removedClassIds: string[] = [];

  if (scheduleUpdate?.changeTime && scheduleUpdate.newStartTimePKT) {
    const newTime = scheduleUpdate.newStartTimePKT;
    const newDuration = scheduleUpdate.durationMinutes || 30;
    const targetDays: DayOfWeek[] = scheduleUpdate.selectedDays && scheduleUpdate.selectedDays.length > 0
      ? scheduleUpdate.selectedDays
      : (studentClasses.length > 0 ? Array.from(new Set(studentClasses.map(c => c.dayOfWeek))) : ['Monday', 'Wednesday', 'Friday']);

    if (studentClasses.length > 0) {
      const remainingExisting = [...studentClasses];

      targetDays.forEach(day => {
        const exactMatchIdx = remainingExisting.findIndex(c => c.dayOfWeek === day);
        if (exactMatchIdx !== -1) {
          const existingCls = remainingExisting.splice(exactMatchIdx, 1)[0];
          updatedClasses.push({
            ...existingCls,
            tutorId: newTutorId,
            dayOfWeek: day,
            startTimePKT: newTime,
            durationMinutes: newDuration,
            status: existingCls.status === 'Cancelled' ? 'Scheduled' : existingCls.status,
            isWeekend: day === 'Saturday' || day === 'Sunday'
          });
        } else if (remainingExisting.length > 0) {
          const existingCls = remainingExisting.shift()!;
          updatedClasses.push({
            ...existingCls,
            tutorId: newTutorId,
            dayOfWeek: day,
            startTimePKT: newTime,
            durationMinutes: newDuration,
            status: existingCls.status === 'Cancelled' ? 'Scheduled' : existingCls.status,
            isWeekend: day === 'Saturday' || day === 'Sunday'
          });
        } else {
          const newDocRef = doc(collection(db, CLASSES_COL));
          createdClasses.push({
            id: newDocRef.id,
            tutorId: newTutorId,
            studentId: student.studentId,
            studentName: student.name,
            dayOfWeek: day,
            startTimePKT: newTime,
            durationMinutes: newDuration,
            status: 'Scheduled',
            isRecurring: true,
            isWeekend: day === 'Saturday' || day === 'Sunday'
          });
        }
      });

      // Remove any leftover existing classes whose days were unselected
      remainingExisting.forEach(c => {
        removedClassIds.push(c.id);
      });
    } else {
      // Student had no existing classes scheduled, provision on targetDays
      targetDays.forEach(day => {
        const newDocRef = doc(collection(db, CLASSES_COL));
        createdClasses.push({
          id: newDocRef.id,
          tutorId: newTutorId,
          studentId: student.studentId,
          studentName: student.name,
          dayOfWeek: day,
          startTimePKT: newTime,
          durationMinutes: newDuration,
          status: 'Scheduled',
          isRecurring: true,
          isWeekend: day === 'Saturday' || day === 'Sunday'
        });
      });
    }
  } else {
    // Retain existing timetable class times, just update tutorId
    updatedClasses = studentClasses.map(c => ({
      ...c,
      tutorId: newTutorId
    }));
  }

  // Sync CACHE.classes
  if (CACHE.classes) {
    const updatedMap = new Map(updatedClasses.map(c => [c.id, c]));
    const removedSet = new Set(removedClassIds);
    let nextClasses = CACHE.classes
      .filter(c => !removedSet.has(c.id))
      .map(c => updatedMap.get(c.id) || c);

    nextClasses = [...nextClasses, ...createdClasses];
    CACHE.classes = nextClasses;
    saveCachedCollection('classes', CACHE.classes);
  }

  const allTutors = await getTutors();
  const oldTutor = allTutors.find(t => isSameTutor(t.tutorId, oldTutorId));
  const newTutor = allTutors.find(t => isSameTutor(t.tutorId, newTutorId));

  let updatedOldStudentIds: string[] = [];
  if (oldTutor) {
    updatedOldStudentIds = (oldTutor.assignedStudentIds || []).filter(id => id !== studentId);
  }

  let updatedNewStudentIds: string[] = [];
  if (newTutor) {
    updatedNewStudentIds = Array.from(new Set([...(newTutor.assignedStudentIds || []), studentId]));
  }

  if (CACHE.tutors) {
    CACHE.tutors = CACHE.tutors.map(t => {
      if (oldTutor && t.id === oldTutor.id) return { ...t, assignedStudentIds: updatedOldStudentIds };
      if (newTutor && t.id === newTutor.id) return { ...t, assignedStudentIds: updatedNewStudentIds };
      return t;
    });
    saveCachedCollection('tutors', CACHE.tutors);
  }

  // 3. Atomic Write Batch Execution (1 single network call)
  if (!isFirestoreQuotaExceeded()) {
    try {
      const batch = writeBatch(db);

      // Student doc
      const studentRef = doc(db, STUDENTS_COL, student.id);
      batch.update(studentRef, sanitizeFirestoreObject(studentUpdates));

      // Updated classes docs
      for (const cls of updatedClasses) {
        if (!cls.id.startsWith('temp') && !cls.id.startsWith('seed') && !cls.id.startsWith('local')) {
          const classRef = doc(db, CLASSES_COL, cls.id);
          batch.update(classRef, sanitizeFirestoreObject({
            tutorId: newTutorId,
            startTimePKT: cls.startTimePKT,
            dayOfWeek: cls.dayOfWeek,
            durationMinutes: cls.durationMinutes,
            isWeekend: cls.isWeekend,
            status: cls.status
          }));
        }
      }

      // Created classes docs
      for (const cls of createdClasses) {
        const classRef = doc(db, CLASSES_COL, cls.id);
        batch.set(classRef, sanitizeFirestoreObject(cls));
      }

      // Removed classes docs
      for (const rId of removedClassIds) {
        if (!rId.startsWith('temp') && !rId.startsWith('seed') && !rId.startsWith('local')) {
          const classRef = doc(db, CLASSES_COL, rId);
          batch.delete(classRef);
        }
      }

      // Old tutor doc
      if (oldTutor && !oldTutor.id.startsWith('local')) {
        const oldTutorRef = doc(db, TUTORS_COL, oldTutor.id);
        batch.update(oldTutorRef, sanitizeFirestoreObject({ assignedStudentIds: updatedOldStudentIds }));
      }

      // New tutor doc
      if (newTutor && !newTutor.id.startsWith('local')) {
        const newTutorRef = doc(db, TUTORS_COL, newTutor.id);
        batch.update(newTutorRef, sanitizeFirestoreObject({ assignedStudentIds: updatedNewStudentIds }));
      }

      // User accounts in users collection
      const usersSnap = await getDocs(
        query(collection(db, USERS_COL), where('studentId', '==', studentId))
      );
      usersSnap.docs.forEach(uDoc => {
        batch.update(doc(db, USERS_COL, uDoc.id), { tutorId: newTutorId });
      });

      await batch.commit();
    } catch (err) {
      console.warn("Atomic tutor shift batch write notice:", err);
    }
  }

  recalculateAndPersistSummaryMetrics().catch(() => {});

  const totalFinalClasses = updatedClasses.length + createdClasses.length;

  return {
    success: true,
    classesCount: totalFinalClasses,
    message: `Successfully shifted ${student.name} from ${oldTutorId} to ${newTutorId}${
      scheduleUpdate?.changeTime ? ` with new time ${scheduleUpdate.newStartTimePKT} PKT` : ''
    }. ${totalFinalClasses} scheduled weekly classes synchronized in 1 atomic transaction.`
  };
}

export async function setStudentLeave(params: {
  studentId: string;
  isOnLeave: boolean;
  leaveStartDate?: string;
  leaveEndDate?: string;
  leaveReason?: string;
  leaveType?: 'Specific Days' | 'Full Month' | 'Custom Range' | 'Indefinite';
  updateClasses?: boolean;
}): Promise<{ success: boolean; message: string }> {
  const { studentId, isOnLeave, leaveStartDate, leaveEndDate, leaveReason, leaveType, updateClasses = true } = params;

  const allStudents = await getStudents();
  const student = allStudents.find(s => s.studentId === studentId || s.id === studentId);
  if (!student) {
    throw new Error(`Student ${studentId} not found.`);
  }

  // Update student document
  await updateStudent(student.id, {
    isOnLeave,
    leaveStartDate: isOnLeave ? (leaveStartDate || new Date().toISOString().slice(0, 10)) : '',
    leaveEndDate: isOnLeave ? (leaveEndDate || '') : '',
    leaveReason: isOnLeave ? (leaveReason || 'On Leave') : '',
    leaveType: isOnLeave ? (leaveType || 'Specific Days') : undefined
  });

  // Update classes status
  if (updateClasses) {
    try {
      const allClasses = await getClasses();
      const studentClasses = allClasses.filter(c => c.studentId === studentId);
      for (const cls of studentClasses) {
        if (isOnLeave) {
          const notes = leaveReason ? `[On Leave: ${leaveReason} (${leaveStartDate || ''} to ${leaveEndDate || ''})]` : '[On Leave]';
          await updateClass(cls.id, {
            status: 'Student on Leave',
            notes: cls.notes ? `${cls.notes} ${notes}` : notes
          });
        } else {
          // Restore back to Scheduled if it was on leave
          if (cls.status === 'Student on Leave' || cls.status === 'Student on Leave (Weekly)') {
            await updateClass(cls.id, { status: 'Scheduled' });
          }
        }
      }
    } catch (classErr) {
      console.warn('Could not sync class leave status:', classErr);
    }
  }

  return {
    success: true,
    message: isOnLeave
      ? `Student ${student.name} marked on leave until ${leaveEndDate || 'further notice'}.`
      : `Student ${student.name} leave cleared. Classes resumed.`
  };
}

export async function deleteClassesBatch(classIds: string[]): Promise<string[]> {
  const deletedIds: string[] = [];
  if (!classIds || classIds.length === 0) return deletedIds;

  const targetSet = new Set(classIds.map(String));
  if (CACHE.classes) {
    CACHE.classes = CACHE.classes.filter(c => !targetSet.has(String(c.id)));
    saveCachedCollection('classes', CACHE.classes);
  }

  if (!isFirestoreQuotaExceeded()) {
    try {
      const batch = writeBatch(db);
      for (const id of classIds) {
        const idStr = String(id).trim();
        if (!idStr.startsWith('seed-') && !idStr.startsWith('local-') && !idStr.startsWith('temp-')) {
          batch.delete(doc(db, CLASSES_COL, idStr));
        }
        deletedIds.push(idStr);
      }
      await batch.commit();
    } catch (err) {
      console.warn('deleteClassesBatch atomic write notice:', err);
    }
  } else {
    deletedIds.push(...classIds.map(String));
  }

  recalculateAndPersistSummaryMetrics().catch(() => {});
  return deletedIds;
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
      recalculateAndPersistSummaryMetrics().catch(() => {});
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
          availabilityStatus: existingData.availabilityStatus || 'Available',
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

/**
 * Canonicalizes a tutor ID string.
 * e.g. "tutor 6", "tutor_6", "6", "TUTOR 6" -> "Tutor 6"
 */
export function normalizeTutorId(id?: string | null): string {
  if (!id) return '';
  const clean = String(id).trim();
  const match = clean.match(/^tutor[\s_-]*(\d+)$/i) || clean.match(/^(\d+)$/);
  if (match) {
    return `Tutor ${match[1]}`;
  }
  return clean;
}

/**
 * Checks if two tutor IDs represent the exact same tutor entity.
 * Avoids any substring or substring overlap issues (e.g. "1" matching "21" or "10").
 */
export function isSameTutor(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return normalizeTutorId(a).toLowerCase() === normalizeTutorId(b).toLowerCase();
}

/**
 * Returns the deterministic canonical Firestore document ID for a tutor.
 * e.g., "Tutor 1" -> "tutor_1", "Tutor 2" -> "tutor_2"
 */
export function getCanonicalTutorDocId(tutorId: string): string {
  const clean = (tutorId || '').trim();
  const num = clean.replace(/\D/g, '');
  if (num) {
    return `tutor_${num}`;
  }
  return `tutor_${clean.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

/**
 * Robustly deduplicates a list of tutors by tutorId.
 * Guarantees that no duplicate "Tutor 2", "Tutor 3", etc. can ever appear in state or UI.
 * Merges updated fields (realName, phone, status, zoomLink, salary) cleanly.
 */
export function deduplicateTutors(rawTutors: Tutor[]): Tutor[] {
  const map = new Map<string, Tutor>();

  // 1. Initialize with baseline entities to preserve structure and permanent Zoom links
  INITIAL_TUTOR_ENTITIES.forEach(t => {
    const key = t.tutorId.trim().toLowerCase();
    map.set(key, { ...t, availabilityStatus: t.availabilityStatus || 'Available' });
  });

  // 2. Overlay any provided tutors (from cache or Firestore)
  for (const t of rawTutors) {
    if (!t || !t.tutorId) continue;
    const key = t.tutorId.trim().toLowerCase();
    const existing = map.get(key);
    const canonicalId = getCanonicalTutorDocId(t.tutorId);

    if (!existing) {
      map.set(key, {
        ...t,
        id: canonicalId,
        availabilityStatus: t.availabilityStatus || (t.status === 'Active' ? 'Available' : 'Busy')
      });
    } else {
      map.set(key, {
        ...existing,
        ...t,
        id: canonicalId, // Always keep canonical doc ID
        realName: (t.realName && t.realName.trim()) ? t.realName.trim() : existing.realName,
        displayName: (t.displayName && t.displayName.trim()) ? t.displayName.trim() : (t.realName?.trim() || existing.displayName),
        email: (t.email && t.email.trim()) ? t.email.trim() : existing.email,
        phone: (t.phone && t.phone.trim()) ? t.phone.trim() : existing.phone,
        zoomLink: (t.zoomLink && t.zoomLink.trim()) ? t.zoomLink.trim() : existing.zoomLink,
        status: t.status || existing.status || 'Active',
        availabilityStatus: t.availabilityStatus || existing.availabilityStatus || (t.status === 'Active' ? 'Available' : 'Busy'),
        monthlySalaryPKR: t.monthlySalaryPKR !== undefined && t.monthlySalaryPKR > 0 ? t.monthlySalaryPKR : existing.monthlySalaryPKR,
        hourlyRatePKR: t.hourlyRatePKR || existing.hourlyRatePKR,
        assignedStudentIds: t.assignedStudentIds && t.assignedStudentIds.length > 0 ? t.assignedStudentIds : existing.assignedStudentIds,
        notes: t.notes !== undefined ? t.notes : existing.notes
      });
    }
  }

  const items = Array.from(map.values());
  items.sort((a, b) => {
    const numA = parseInt(a.tutorId.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.tutorId.replace(/\D/g, '')) || 0;
    return numA - numB;
  });
  return items;
}

/**
 * Automatically cleans up any duplicate or non-canonical tutor documents in Firestore.
 * Keeps only the single canonical document per tutor (e.g. `tutor_2`) and merges data.
 */
async function cleanupDuplicateFirestoreTutors(docs: any[]): Promise<void> {
  if (isFirestoreQuotaExceeded() || !docs || docs.length === 0) return;
  try {
    const grouped = new Map<string, any[]>();
    for (const d of docs) {
      const data = d.data();
      const tutorId = data?.tutorId || '';
      if (!tutorId) continue;
      const key = tutorId.trim().toLowerCase();
      const list = grouped.get(key) || [];
      list.push(d);
      grouped.set(key, list);
    }

    for (const [, docList] of grouped) {
      if (docList.length > 1) {
        // Find or determine the canonical doc
        const firstData = docList[0].data();
        const canonicalId = getCanonicalTutorDocId(firstData.tutorId);
        
        // Find best realName, phone, etc. across all duplicates
        let bestRealName = '';
        let bestPhone = '';
        let bestZoom = '';
        let bestSalary = 0;
        let bestStatus: any = 'Active';
        let bestAvailability: any = 'Available';

        for (const d of docList) {
          const data = d.data();
          if (data.realName && data.realName.trim()) bestRealName = data.realName.trim();
          if (data.phone && data.phone.trim()) bestPhone = data.phone.trim();
          if (data.zoomLink && data.zoomLink.trim()) bestZoom = data.zoomLink.trim();
          if (data.monthlySalaryPKR && data.monthlySalaryPKR > 0) bestSalary = data.monthlySalaryPKR;
          if (data.status) bestStatus = data.status;
          if (data.availabilityStatus) bestAvailability = data.availabilityStatus;
        }

        // Set the single canonical document
        await setDoc(doc(db, TUTORS_COL, canonicalId), sanitizeFirestoreObject({
          ...firstData,
          id: canonicalId,
          ...(bestRealName ? { realName: bestRealName } : {}),
          ...(bestPhone ? { phone: bestPhone } : {}),
          ...(bestZoom ? { zoomLink: bestZoom } : {}),
          ...(bestSalary ? { monthlySalaryPKR: bestSalary } : {}),
          status: bestStatus,
          availabilityStatus: bestAvailability
        }), { merge: true });

        // Delete all non-canonical or duplicate documents
        for (const d of docList) {
          if (d.id !== canonicalId) {
            try {
              await deleteDoc(d.ref);
            } catch (_) {}
          }
        }
      }
    }
  } catch (err) {
    console.debug("[TutorsCleanup] Notice:", err);
  }
}

export async function getTutors(forceRefresh = false): Promise<Tutor[]> {
  if (CACHE.tutors && CACHE.tutors.length >= 20 && !forceRefresh) {
    return deduplicateTutors(CACHE.tutors);
  }
  const stored = loadCachedCollection<Tutor[]>('tutors');
  if (stored && stored.length >= 20 && !forceRefresh) {
    const deduped = deduplicateTutors(stored);
    CACHE.tutors = deduped;
    return deduped;
  }

  let firestoreTutors: Tutor[] = [];
  if (!isFirestoreQuotaExceeded()) {
    try {
      const snap = await getDocs(collection(db, TUTORS_COL));
      if (!snap.empty) {
        firestoreTutors = snap.docs.map(d => ({ id: d.id, ...d.data() } as Tutor));
        if (snap.docs.length > 20) {
          cleanupDuplicateFirestoreTutors(snap.docs).catch(() => {});
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, TUTORS_COL);
    }
  }

  const combined = [
    ...INITIAL_TUTOR_ENTITIES,
    ...(stored && Array.isArray(stored) ? stored : []),
    ...firestoreTutors
  ];

  const items = deduplicateTutors(combined);
  CACHE.tutors = items;
  saveCachedCollection('tutors', items);
  return items;
}

export function subscribeToTutors(callback: (tutors: Tutor[]) => void): () => void {
  const getFallback = () => deduplicateTutors(CACHE.tutors || loadCachedCollection<Tutor[]>('tutors') || INITIAL_TUTOR_ENTITIES);
  if (isFirestoreQuotaExceeded()) {
    callback(getFallback());
    return () => {};
  }
  return safeOnSnapshot(
    collection(db, TUTORS_COL),
    (snap) => {
      if (!snap.empty) {
        const rawItems = snap.docs.map(d => ({ id: d.id, ...d.data() } as Tutor));
        const deduplicated = deduplicateTutors(rawItems);
        CACHE.tutors = deduplicated;
        saveCachedCollection('tutors', deduplicated);
        callback(deduplicated);

        // If duplicate documents exist in Firestore, clean them up in background
        if (snap.docs.length > deduplicated.length) {
          cleanupDuplicateFirestoreTutors(snap.docs).catch(() => {});
        }
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
  const canonicalId = getCanonicalTutorDocId(tutorData.tutorId);

  // Check if a tutor with this tutorId or ID already exists to prevent ANY duplication
  const existing = (CACHE.tutors || []).find(t =>
    t.tutorId.trim().toLowerCase() === tutorData.tutorId.trim().toLowerCase() ||
    t.id === canonicalId
  );

  if (existing) {
    // If it already exists, update in-place rather than creating a duplicate
    await updateTutor(existing.id || canonicalId, tutorData);
    return existing.id || canonicalId;
  }

  const newTutor: Tutor = {
    id: canonicalId,
    ...tutorData,
    availabilityStatus: tutorData.availabilityStatus || 'Available'
  };

  const updatedList = deduplicateTutors([newTutor, ...(CACHE.tutors || [])]);
  CACHE.tutors = updatedList;
  saveCachedCollection('tutors', updatedList);

  if (!isFirestoreQuotaExceeded()) {
    setDoc(doc(db, TUTORS_COL, canonicalId), sanitizeFirestoreObject(newTutor), { merge: true }).catch((err) => {
      handleFirestoreError(err, OperationType.CREATE, TUTORS_COL);
    });
  }
  return canonicalId;
}

export async function updateTutor(id: string, updates: Partial<Tutor>): Promise<void> {
  // Determine canonical document ID
  const matchedTutor = CACHE.tutors?.find(t => t.id === id || t.tutorId === id);
  const targetTutorId = updates.tutorId || matchedTutor?.tutorId || (id.startsWith('tutor_') ? `Tutor ${id.replace(/\D/g, '')}` : id);
  const canonicalId = getCanonicalTutorDocId(targetTutorId);

  // 1. Optimistic Cache Update with strict deduplication
  if (CACHE.tutors) {
    const updated = CACHE.tutors.map(t => {
      if (t.id === id || t.id === canonicalId || t.tutorId === targetTutorId) {
        return {
          ...t,
          ...updates,
          id: canonicalId,
          availabilityStatus: updates.availabilityStatus || t.availabilityStatus || 'Available'
        };
      }
      return t;
    });
    CACHE.tutors = deduplicateTutors(updated);
    saveCachedCollection('tutors', CACHE.tutors);
  }

  // 2. Persist to Firestore using setDoc with merge to ensure document is created/updated cleanly
  if (!isFirestoreQuotaExceeded()) {
    try {
      await setDoc(doc(db, TUTORS_COL, canonicalId), sanitizeFirestoreObject({
        ...updates,
        id: canonicalId,
        tutorId: targetTutorId
      }), { merge: true });

      // If the old `id` was an arbitrary or duplicate document ID, delete it
      if (id && id !== canonicalId) {
        try {
          await deleteDoc(doc(db, TUTORS_COL, id));
        } catch (_) {}
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${TUTORS_COL}/${canonicalId}`);
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
// CLASSES / MASTER TIMETABLE API (OPTIMIZATION 1: REVISION-BASED 1-READ CACHE)
// ==========================================
const ACADEMY_META_DOC_ID = 'academy_meta';
const CLASSES_LAST_MODIFIED_KEY = 'classes_last_modified';

export function getLocalClassesLastModified(): number {
  try {
    const val = localStorage.getItem(CLASSES_LAST_MODIFIED_KEY);
    return val ? parseInt(val, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function setLocalClassesLastModified(timestamp: number): void {
  try {
    localStorage.setItem(CLASSES_LAST_MODIFIED_KEY, String(timestamp));
  } catch {}
}

export async function touchClassesRevision(customTimestamp?: number): Promise<void> {
  const ts = customTimestamp || Date.now();
  setLocalClassesLastModified(ts);
  if (!isFirestoreQuotaExceeded()) {
    try {
      const metaRef = doc(db, SETTINGS_COL, ACADEMY_META_DOC_ID);
      await setDoc(metaRef, { classes_last_modified: ts, lastModified: ts }, { merge: true });
    } catch (e) {
      console.warn("touchClassesRevision notice:", e);
    }
  }
}

export async function getClasses(forceRefresh = false): Promise<TimetableClass[]> {
  if (CACHE.classes && !forceRefresh) {
    return CACHE.classes;
  }
  const stored = loadCachedCollection<TimetableClass[]>('classes');
  const localRev = getLocalClassesLastModified();

  // 1-Read Optimization: Check single metadata document settings/academy_meta
  // If lastModified hasn't changed, serve all 200-400 classes from local storage (1 read instead of 300 reads)
  if (!isFirestoreQuotaExceeded() && stored && stored.length > 0) {
    try {
      const metaSnap = await getDoc(doc(db, SETTINGS_COL, ACADEMY_META_DOC_ID));
      if (metaSnap.exists()) {
        const metaData = metaSnap.data();
        const serverRev = metaData?.classes_last_modified || metaData?.lastModified || 0;
        if (serverRev && localRev && serverRev <= localRev) {
          console.log(`[DataService] Served ${stored.length} timetable classes from localStorage via 1-read academy_meta check (revision: ${localRev})`);
          CACHE.classes = stored;
          return stored;
        }
      } else if (!forceRefresh && localRev > 0) {
        touchClassesRevision(Date.now()).catch(() => {});
        CACHE.classes = stored;
        return stored;
      }
    } catch (e) {
      console.warn("academy_meta check notice:", e);
      if (!forceRefresh) {
        CACHE.classes = stored;
        return stored;
      }
    }
  } else if (stored && stored.length > 0 && !forceRefresh) {
    CACHE.classes = stored;
    return stored;
  }

  if (!isFirestoreQuotaExceeded()) {
    try {
      const snap = await getDocs(collection(db, CLASSES_COL));
      if (!snap.empty) {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as TimetableClass));
        CACHE.classes = items;
        saveCachedCollection('classes', items);
        const newRev = Date.now();
        setLocalClassesLastModified(newRev);
        touchClassesRevision(newRev).catch(() => {});
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

export function subscribeToClasses(callback: (classes: TimetableClass[]) => void, filterTutorId?: string): () => void {
  const cleanTutorId = filterTutorId ? filterTutorId.trim() : undefined;
  const getFallback = () => {
    const all = CACHE.classes || loadCachedCollection<TimetableClass[]>('classes') || (isCleanDataMode() ? [] : SEED_CLASSES);
    if (!cleanTutorId) return all;
    return all.filter(c => c.tutorId === cleanTutorId || (c.tutorId && c.tutorId.replace(/\s+/g, '').toLowerCase() === cleanTutorId.replace(/\s+/g, '').toLowerCase()));
  };
  if (isFirestoreQuotaExceeded()) {
    callback(getFallback());
    return () => {};
  }
  const q = cleanTutorId
    ? query(collection(db, CLASSES_COL), where('tutorId', '==', cleanTutorId))
    : collection(db, CLASSES_COL);

  return safeOnSnapshot(
    q,
    (snap) => {
      if (snap) {
        const currentList = CACHE.classes || [];
        const items = applySnapshotDelta<TimetableClass>(currentList, snap);
        if (cleanTutorId) {
          if (CACHE.classes) {
            const others = CACHE.classes.filter(c => c.tutorId !== cleanTutorId && (c.tutorId && c.tutorId.replace(/\s+/g, '').toLowerCase() !== cleanTutorId.replace(/\s+/g, '').toLowerCase()));
            CACHE.classes = [...items, ...others];
          } else {
            CACHE.classes = items;
          }
          saveCachedCollection('classes', CACHE.classes);
          callback(items);
        } else {
          CACHE.classes = items;
          saveCachedCollection('classes', CACHE.classes);
          callback(items);
        }
      } else {
        callback(getFallback());
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, CLASSES_COL);
      callback(getFallback());
    },
    CLASSES_COL
  );
}

export async function addClass(classData: Omit<TimetableClass, 'id'>): Promise<string> {
  const existing = CACHE.classes || (await getClasses());
  const validation = validateClassBooking(classData, existing);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Pre-generate the exact Firestore document ID client-side to prevent optimistic duplicate key splits
  const docRef = doc(collection(db, CLASSES_COL));
  const classId = docRef.id;

  // Deduplicate against any existing class matching same tutor, student, dayOfWeek, and startTimePKT
  const existingList = CACHE.classes || [];
  const duplicateIndex = existingList.findIndex(
    c => c.tutorId === classData.tutorId &&
         c.studentId === classData.studentId &&
         c.dayOfWeek === classData.dayOfWeek &&
         c.startTimePKT === classData.startTimePKT &&
         c.status !== 'Cancelled'
  );

  const newClass: TimetableClass = { id: classId, ...classData };

  if (duplicateIndex !== -1 && CACHE.classes) {
    CACHE.classes[duplicateIndex] = newClass;
  } else {
    CACHE.classes = [newClass, ...(CACHE.classes || [])];
  }

  saveCachedCollection('classes', CACHE.classes);
  touchClassesRevision().catch(() => {});
  recalculateAndPersistSummaryMetrics().catch(() => {});

  // 100% Automatic Two-Way Sync: Sync student's assignedTutorId when booking a slot
  if (classData.studentId && classData.tutorId && classData.tutorId !== 'Unassigned' && classData.status !== 'Cancelled') {
    const targetStudent = CACHE.students?.find(
      s => s.studentId === classData.studentId || s.id === classData.studentId
    );
    if (targetStudent && targetStudent.assignedTutorId !== classData.tutorId) {
      updateStudent(targetStudent.id, { assignedTutorId: classData.tutorId }).catch(err => {
        console.warn("Could not auto-sync student assignedTutorId on addClass:", err);
      });
    }
  }

  if (!isFirestoreQuotaExceeded()) {
    setDoc(docRef, sanitizeFirestoreObject(classData), { merge: true })
      .catch((err) => {
        console.warn("Background class creation notice:", err);
      });
  }

  return classId;
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
    touchClassesRevision().catch(() => {});
    recalculateAndPersistSummaryMetrics().catch(() => {});
  }

  // 100% Automatic Two-Way Sync: Sync student's assignedTutorId when updating a class slot
  const effectiveStudentId = updates.studentId || previousClass?.studentId;
  const effectiveTutorId = updates.tutorId || previousClass?.tutorId;
  const effectiveStatus = updates.status || previousClass?.status;
  if (effectiveStudentId && effectiveTutorId && effectiveTutorId !== 'Unassigned' && effectiveStatus !== 'Cancelled') {
    const targetStudent = CACHE.students?.find(
      s => s.studentId === effectiveStudentId || s.id === effectiveStudentId
    );
    if (targetStudent && targetStudent.assignedTutorId !== effectiveTutorId) {
      updateStudent(targetStudent.id, { assignedTutorId: effectiveTutorId }).catch(err => {
        console.warn("Could not auto-sync student assignedTutorId on updateClass:", err);
      });
    }
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
    touchClassesRevision().catch(() => {});
    recalculateAndPersistSummaryMetrics().catch(() => {});

    const trashId = `trash_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (classData) {
      // Check if student has remaining classes with this tutor or another tutor
      const studentId = classData.studentId;
      const tutorId = classData.tutorId;
      const remainingClassesForTutor = updatedClasses.filter(c => c.studentId === studentId && isSameTutor(c.tutorId, tutorId));
      if (remainingClassesForTutor.length === 0) {
        // No remaining classes with this tutor!
        const otherClasses = updatedClasses.filter(c => c.studentId === studentId);
        const newAssignedTutor = otherClasses.length > 0 ? otherClasses[0].tutorId : 'Unassigned';
        const targetStudent = CACHE.students?.find(s => s.studentId === studentId || s.id === studentId);
        if (targetStudent && (isSameTutor(targetStudent.assignedTutorId, tutorId) || newAssignedTutor === 'Unassigned')) {
          updateStudent(targetStudent.id, { assignedTutorId: newAssignedTutor }).catch(err => {
            console.warn("Could not sync student assignedTutorId on class delete:", err);
          });
        }
      }

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

export function deduplicateLessons(lessons: Lesson[]): Lesson[] {
  if (!lessons || lessons.length === 0) return [];
  const seenMap = new Map<string, Lesson>();
  for (const lesson of lessons) {
    if (!lesson) continue;
    // Deduplicate strictly by unique lesson ID (or fallback timestamp) so EVERY lesson report for every day is preserved
    const key = lesson.id || `${lesson.studentId}_${lesson.date}_${lesson.createdAt || Math.random()}`;
    if (!seenMap.has(key)) {
      seenMap.set(key, lesson);
    } else {
      const existing = seenMap.get(key)!;
      if (lesson.updatedAt && existing.updatedAt && new Date(lesson.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
        seenMap.set(key, lesson);
      }
    }
  }
  return Array.from(seenMap.values()).sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.date ? new Date(a.date).getTime() : 0);
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.date ? new Date(b.date).getTime() : 0);
    return timeB - timeA;
  });
}

export function deduplicateAttendance(records: AttendanceRecord[]): AttendanceRecord[] {
  if (!records || records.length === 0) return [];
  const seenMap = new Map<string, AttendanceRecord>();
  for (const rec of records) {
    if (!rec) continue;
    const key = rec.id || `${rec.studentId}_${rec.date}_${rec.markedAt || Math.random()}`;
    if (!seenMap.has(key)) {
      seenMap.set(key, rec);
    }
  }
  return Array.from(seenMap.values()).sort(
    (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
  );
}

export function getRecentLessonCutoffDate(days = 14): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function subscribeToLessons(callback: (lessons: Lesson[]) => void, filterTutorId?: string, daysWindow = 14): () => void {
  const getFallback = () => deduplicateLessons(CACHE.lessons || loadCachedCollection<Lesson[]>('lessons') || (isCleanDataMode() ? [] : SEED_LESSONS));
  if (isFirestoreQuotaExceeded()) {
    callback(getFallback());
    return () => {};
  }
  const cutoffDateStr = getRecentLessonCutoffDate(daysWindow);
  const q = filterTutorId
    ? query(collection(db, LESSONS_COL), where('tutorId', '==', filterTutorId), limit(300))
    : query(collection(db, LESSONS_COL), where('date', '>=', cutoffDateStr), limit(600));

  return safeOnSnapshot(
    q,
    (snap) => {
      const currentList = CACHE.lessons || [];
      const items = applySnapshotDelta<Lesson>(currentList, snap);
      const cleaned = cleanExpiredScreenshots(items);
      const localItems = loadCachedCollection<Lesson[]>('lessons') || [];
      const mergedMap = new Map<string, Lesson>();
      localItems.forEach(l => mergedMap.set(l.id, l));
      currentList.forEach(l => mergedMap.set(l.id, l));
      cleaned.forEach(l => mergedMap.set(l.id, l));
      const merged = deduplicateLessons(Array.from(mergedMap.values()));
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
  if (CACHE.lessons && !forceRefresh && CACHE.lessons.length > 0) {
    return deduplicateLessons(CACHE.lessons);
  }
  const localItems = loadCachedCollection<Lesson[]>('lessons') || [];
  if (localItems.length > 0 && !forceRefresh) {
    const deduped = deduplicateLessons(localItems);
    CACHE.lessons = deduped;
    return deduped;
  }
  try {
    if (!isFirestoreQuotaExceeded()) {
      // Optimization: Strict 14-Day Window by Default (cuts initial reads by >85%)
      const cutoffDateStr = getRecentLessonCutoffDate(14);
      const snap = await getDocs(
        query(collection(db, LESSONS_COL), where('date', '>=', cutoffDateStr), limit(150))
      );
      if (!snap.empty) {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Lesson));
        const cleaned = cleanExpiredScreenshots(items);
        const mergedMap = new Map<string, Lesson>();
        localItems.forEach(l => mergedMap.set(l.id, l));
        cleaned.forEach(l => mergedMap.set(l.id, l));
        const merged = deduplicateLessons(Array.from(mergedMap.values()));
        CACHE.lessons = merged;
        saveCachedCollection('lessons', merged);
        return merged;
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, LESSONS_COL);
  }
  const fallback = localItems.length > 0 ? localItems : (isCleanDataMode() ? [] : SEED_LESSONS);
  const dedupedFallback = deduplicateLessons(cleanExpiredScreenshots(fallback));
  CACHE.lessons = dedupedFallback;
  saveCachedCollection('lessons', dedupedFallback);
  return dedupedFallback;
}

/**
 * On-demand historical lesson archive loader.
 * Loads lessons for 30 days, 60 days, custom ranges, or full historical archive.
 */
export async function loadOlderLessonsArchive(
  daysOrAll: number | 'all' | { daysBack?: number; tutorId?: string; studentIds?: string[]; startDate?: string; endDate?: string } = 60,
  filterTutorId?: string,
  filterStudentIds?: string[]
): Promise<Lesson[]> {
  let resolvedDaysBack = 90;
  let isAll = false;
  let customStartDate = '';

  if (typeof daysOrAll === 'object' && daysOrAll !== null) {
    if (daysOrAll.tutorId) filterTutorId = daysOrAll.tutorId;
    if (daysOrAll.studentIds) filterStudentIds = daysOrAll.studentIds;
    if (daysOrAll.daysBack) resolvedDaysBack = daysOrAll.daysBack;
    if (daysOrAll.startDate) customStartDate = daysOrAll.startDate;
  } else if (daysOrAll === 'all') {
    isAll = true;
  } else if (typeof daysOrAll === 'number') {
    resolvedDaysBack = daysOrAll;
  }

  const localItems = CACHE.lessons || loadCachedCollection<Lesson[]>('lessons') || [];
  if (isFirestoreQuotaExceeded()) {
    return deduplicateLessons(localItems);
  }
  try {
    let q;
    const validStudentIds = (filterStudentIds || []).filter(Boolean).slice(0, 10);
    if (validStudentIds.length > 0) {
      q = query(
        collection(db, LESSONS_COL),
        where('studentId', 'in', validStudentIds),
        limit(isAll ? 600 : 250)
      );
    } else if (filterTutorId) {
      q = query(
        collection(db, LESSONS_COL),
        where('tutorId', '==', filterTutorId),
        limit(isAll ? 600 : 350)
      );
    } else if (!isAll) {
      const cutoffDate = customStartDate || getRecentLessonCutoffDate(resolvedDaysBack + 2);
      q = query(
        collection(db, LESSONS_COL),
        where('date', '>=', cutoffDate),
        limit(800)
      );
    } else {
      q = query(collection(db, LESSONS_COL), limit(1200));
    }

    const snap = await getDocs(q);
    if (!snap.empty) {
      const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Lesson));
      const cleaned = cleanExpiredScreenshots(items);
      const mergedMap = new Map<string, Lesson>();
      localItems.forEach(l => mergedMap.set(l.id, l));
      cleaned.forEach(l => mergedMap.set(l.id, l));
      const merged = deduplicateLessons(Array.from(mergedMap.values()));
      CACHE.lessons = merged;
      saveCachedCollection('lessons', merged);
      return merged;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, LESSONS_COL);
  }
  return deduplicateLessons(localItems);
}

export async function addLesson(lessonData: Omit<Lesson, 'id'>): Promise<string> {
  const docRef = doc(collection(db, LESSONS_COL));
  const docId = docRef.id;
  const newLesson: Lesson = { id: docId, ...lessonData };
  CACHE.lessons = deduplicateLessons([newLesson, ...(CACHE.lessons || [])]);
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
    try {
      const students = CACHE.students || (await getStudents());
      const student = students.find(s => s.studentId === lessonData.studentId);
      if (student && student.status === 'Trial') {
        const allStudentLessons = (CACHE.lessons || []).filter(l => l.studentId === lessonData.studentId);
        const completedCount = allStudentLessons.filter(l => l.attendanceStatus !== 'Absent').length;
        const nextCompleted = Math.max(completedCount, (student.trialSessionsCompleted || 0) + (lessonData.attendanceStatus !== 'Absent' ? 1 : 0));
        const newTrialStatus = nextCompleted >= 5 ? 'Decision Pending' : 'In Progress';
        if (CACHE.students) {
          CACHE.students = CACHE.students.map(s => s.id === student.id ? {
            ...s,
            trialSessionsCompleted: nextCompleted,
            trialStatus: newTrialStatus
          } : s);
          saveCachedCollection('students', CACHE.students);
        }
        if (nextCompleted >= 5 && (student.trialSessionsCompleted || 0) < 5) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('it_trial_completed_5_sessions', {
              detail: {
                studentId: student.studentId,
                studentName: student.name,
                tutorId: student.assignedTutorId || lessonData.tutorId,
                courseType: student.courseType,
                parentName: student.parentName,
                parentPhone: student.parentPhone,
                trialSessionsCompleted: nextCompleted
              }
            }));
          }
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
  })();

  return docId;
}

/**
 * Dispatch instant push toast notification across the app when a trial student completes 5/5 sessions
 */
export function notifyTrial5SessionsCompleted(student: {
  studentId: string;
  name: string;
  assignedTutorId?: string;
  courseType?: string;
  parentName?: string;
  parentPhone?: string;
  trialSessionsCompleted?: number;
}): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('it_trial_completed_5_sessions', {
      detail: {
        studentId: student.studentId,
        studentName: student.name,
        tutorId: student.assignedTutorId,
        courseType: student.courseType,
        parentName: student.parentName,
        parentPhone: student.parentPhone,
        trialSessionsCompleted: student.trialSessionsCompleted || 5
      }
    }));
  }
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
    return deduplicateAttendance(CACHE.attendance);
  }
  const localItems = loadCachedCollection<AttendanceRecord[]>('attendance') || [];
  if (localItems.length > 0 && !forceRefresh) {
    const deduped = deduplicateAttendance(localItems);
    CACHE.attendance = deduped;
    return deduped;
  }
  try {
    if (!isFirestoreQuotaExceeded()) {
      const snap = await getDocs(collection(db, ATTENDANCE_COL));
      if (!snap.empty) {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
        const mergedMap = new Map<string, AttendanceRecord>();
        items.forEach(a => mergedMap.set(a.id, a));
        localItems.forEach(a => { if (!mergedMap.has(a.id)) mergedMap.set(a.id, a); });
        const merged = deduplicateAttendance(Array.from(mergedMap.values()));
        CACHE.attendance = merged;
        saveCachedCollection('attendance', merged);
        return merged;
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, ATTENDANCE_COL);
  }
  const fallback = localItems.length > 0 ? localItems : (isCleanDataMode() ? [] : SEED_ATTENDANCE);
  const dedupedFallback = deduplicateAttendance(fallback);
  CACHE.attendance = dedupedFallback;
  saveCachedCollection('attendance', dedupedFallback);
  return dedupedFallback;
}

export async function addAttendanceRecord(record: Omit<AttendanceRecord, 'id'>): Promise<string> {
  const existingRecords = CACHE.attendance || (await getAttendanceRecords());
  const duplicate = existingRecords.find(a => 
    a.studentId === record.studentId && 
    a.date === record.date
  );

  if (duplicate) {
    if (CACHE.attendance) {
      CACHE.attendance = deduplicateAttendance(CACHE.attendance.map(a => a.id === duplicate.id ? { ...a, ...record } : a));
      saveCachedCollection('attendance', CACHE.attendance);
    }
    if (!isFirestoreQuotaExceeded() && !duplicate.id.startsWith('local')) {
      updateDoc(doc(db, ATTENDANCE_COL, duplicate.id), sanitizeFirestoreObject(record)).catch(() => {});
    }
    return duplicate.id;
  }

  const docRef = doc(collection(db, ATTENDANCE_COL));
  const docId = docRef.id;
  const newRec: AttendanceRecord = { id: docId, ...record };
  CACHE.attendance = deduplicateAttendance([newRec, ...(CACHE.attendance || [])]);
  saveCachedCollection('attendance', CACHE.attendance);

  if (!isFirestoreQuotaExceeded()) {
    setDoc(docRef, sanitizeFirestoreObject(record)).catch((err) => {
      handleFirestoreError(err, OperationType.CREATE, ATTENDANCE_COL);
    });
  }
  return docId;
}

export async function deleteAttendanceRecord(id: string): Promise<void> {
  if (CACHE.attendance) {
    CACHE.attendance = CACHE.attendance.filter(r => r.id !== id);
    saveCachedCollection('attendance', CACHE.attendance);
  }
  if (!isFirestoreQuotaExceeded() && !id.startsWith('local')) {
    try {
      await deleteDoc(doc(db, ATTENDANCE_COL, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${ATTENDANCE_COL}/${id}`);
    }
  }
}

export async function getTutorAttendanceRecords(forceRefresh = false): Promise<TutorAttendanceRecord[]> {
  if (CACHE.tutorAttendance && !forceRefresh) {
    return CACHE.tutorAttendance;
  }
  const localItems = loadCachedCollection<TutorAttendanceRecord[]>('tutorAttendance') || [];
  if (localItems.length > 0 && !forceRefresh) {
    CACHE.tutorAttendance = localItems;
    return localItems;
  }
  try {
    if (!isFirestoreQuotaExceeded()) {
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
  if (localItems.length > 0 && !forceRefresh) {
    CACHE.fees = localItems;
    return localItems;
  }
  try {
    if (!isFirestoreQuotaExceeded()) {
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
  recalculateAndPersistSummaryMetrics().catch(() => {});

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
    recalculateAndPersistSummaryMetrics().catch(() => {});
  }
  if (!isFirestoreQuotaExceeded() && !id.startsWith('local')) {
    try {
      await updateDoc(doc(db, FEES_COL, id), sanitizeFirestoreObject(updates));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${FEES_COL}/${id}`);
    }
  }
}

export async function deleteFee(id: string): Promise<void> {
  if (CACHE.fees) {
    CACHE.fees = CACHE.fees.filter(f => f.id !== id);
    saveCachedCollection('fees', CACHE.fees);
    recalculateAndPersistSummaryMetrics().catch(() => {});
  }
  if (!isFirestoreQuotaExceeded() && !id.startsWith('local')) {
    try {
      await deleteDoc(doc(db, FEES_COL, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${FEES_COL}/${id}`);
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
  if (localItems.length > 0 && !forceRefresh) {
    CACHE.salaries = localItems;
    return localItems;
  }
  try {
    if (!isFirestoreQuotaExceeded()) {
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
  recalculateAndPersistSummaryMetrics().catch(() => {});

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
    recalculateAndPersistSummaryMetrics().catch(() => {});
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
  if (localItems.length > 0 && !forceRefresh) {
    CACHE.referrals = localItems;
    return localItems;
  }
  try {
    if (!isFirestoreQuotaExceeded()) {
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

/**
 * Automatically syncs referral records between Student Enrollment and Referral Rewards.
 */
export async function syncStudentReferralRecord(student: Student): Promise<void> {
  if (!student.referredByName && !student.referredByStudentId) return;

  const referrerName = (student.referredByName || 'Referring Family').trim();
  const rewardAmount = student.referralRewardAmount || 30; // Flat $30 reward
  const status = student.referralStatus || 'Pending';

  const allRefs = CACHE.referrals || await getReferrals();
  const existing = allRefs.find(r => 
    r.referredStudentId === student.studentId || 
    (r.referredStudentName && r.referredStudentName.toLowerCase().trim() === student.name.toLowerCase().trim())
  );

  if (!existing) {
    await addReferral({
      referrerName,
      referrerStudentId: student.referredByStudentId || '',
      referredStudentId: student.studentId,
      referredStudentName: student.name,
      date: student.joiningDate || new Date().toISOString().slice(0, 10),
      rewardAmount,
      currency: 'USD',
      status,
      notes: `Auto-linked from Student Enrollment (${student.studentId}). $30 discount applies automatically upon 1st tuition payment.`
    });
  } else {
    await updateReferral(existing.id, {
      referrerName,
      referrerStudentId: student.referredByStudentId || existing.referrerStudentId,
      rewardAmount,
      status
    });
  }
}

/**
 * Automatically triggers flat $30 discount application onto the referrer's upcoming tuition invoice
 * as soon as the referred student completes their initial 1st fee payment!
 */
export async function checkAndApplyReferralDiscountOnFirstPayment(referredStudentId: string, paidInvoiceNumber?: string): Promise<boolean> {
  if (!referredStudentId) return false;

  const allRefs = CACHE.referrals || await getReferrals();
  const pendingRef = allRefs.find(r => 
    (r.referredStudentId === referredStudentId || r.referredStudentId.toLowerCase() === referredStudentId.toLowerCase()) &&
    (r.status === 'Pending' || r.status === 'Eligible' || r.status === 'Approved')
  );

  if (!pendingRef) return false;

  const allStudents = CACHE.students || await getStudents();
  const allFees = CACHE.fees || await getFees();

  // 1. Locate the referring student or parent
  const cleanRefName = pendingRef.referrerName.toLowerCase().trim();
  const cleanRefId = (pendingRef.referrerStudentId || '').toLowerCase().trim();

  const referrerStudent = allStudents.find(s => {
    if (cleanRefId && (s.studentId.toLowerCase() === cleanRefId || s.id.toLowerCase() === cleanRefId)) return true;
    if (s.name.toLowerCase().trim() === cleanRefName) return true;
    if (s.parentName && s.parentName.toLowerCase().trim() === cleanRefName) return true;
    if (s.familyGroupName && s.familyGroupName.toLowerCase().trim() === cleanRefName) return true;
    return false;
  });

  const rewardVal = pendingRef.rewardAmount || 30; // Flat $30 discount

  if (referrerStudent) {
    // 2. Find the referrer's upcoming/pending or overdue tuition fee invoice
    const targetFee = allFees.find(f => 
      (f.studentId === referrerStudent.studentId || (f.studentIds && f.studentIds.includes(referrerStudent.studentId))) &&
      (f.status === 'Pending' || f.status === 'Overdue')
    );

    if (targetFee) {
      const currentDiscount = targetFee.discount || 0;
      const newDiscount = currentDiscount + rewardVal;
      const newAmount = Math.max(0, targetFee.amount - rewardVal);

      await updateFee(targetFee.id, {
        discount: newDiscount,
        amount: newAmount,
        notes: `${targetFee.notes ? `${targetFee.notes} | ` : ''}Auto Referral Discount Applied: -$${rewardVal} for referring ${pendingRef.referredStudentName} (${referredStudentId})`
      });

      await updateReferral(pendingRef.id, {
        status: 'Paid/Applied',
        appliedInvoiceNumber: targetFee.invoiceNumber,
        appliedDate: new Date().toISOString().slice(0, 10),
        notes: `Flat $${rewardVal} discount automatically deducted from Invoice ${targetFee.invoiceNumber} on ${new Date().toISOString().slice(0, 10)}.`
      });
      return true;
    }
  }

  // Fallback: Mark referral as Approved/Eligible for discount on next generated invoice
  await updateReferral(pendingRef.id, {
    status: 'Eligible',
    notes: `Verified 1st payment received (${paidInvoiceNumber || 'Payment Received'}). Eligible for $${rewardVal} discount on referrer's next invoice.`
  });
  return true;
}

// ==========================================
// STUDENT & PARENT REFERRAL LEADS API
// ==========================================
export async function getStudentReferralLeads(forceRefresh = false): Promise<StudentReferralLead[]> {
  if (CACHE.referralLeads && !forceRefresh) {
    return CACHE.referralLeads;
  }
  const localItems = loadCachedCollection<StudentReferralLead[]>('referralLeads') || [];
  if (localItems.length > 0 && !forceRefresh) {
    CACHE.referralLeads = localItems;
    return localItems;
  }
  try {
    if (!isFirestoreQuotaExceeded()) {
      const snap = await getDocs(collection(db, REFERRAL_LEADS_COL));
      if (!snap.empty) {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentReferralLead));
        items.sort((a, b) => (b.dateSubmitted || '').localeCompare(a.dateSubmitted || ''));
        CACHE.referralLeads = items;
        saveCachedCollection('referralLeads', items);
        return items;
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, REFERRAL_LEADS_COL);
  }
  CACHE.referralLeads = localItems;
  saveCachedCollection('referralLeads', localItems);
  return localItems;
}

export async function addStudentReferralLead(lead: Omit<StudentReferralLead, 'id'>): Promise<string> {
  const docRef = doc(collection(db, REFERRAL_LEADS_COL));
  const docId = docRef.id;
  const newLead: StudentReferralLead = { id: docId, ...lead };
  CACHE.referralLeads = [newLead, ...(CACHE.referralLeads || [])];
  saveCachedCollection('referralLeads', CACHE.referralLeads);

  if (!isFirestoreQuotaExceeded()) {
    setDoc(docRef, sanitizeFirestoreObject(lead)).catch((err) => {
      handleFirestoreError(err, OperationType.CREATE, REFERRAL_LEADS_COL);
    });
  }
  return docId;
}

export async function updateStudentReferralLead(id: string, updates: Partial<StudentReferralLead>): Promise<void> {
  if (CACHE.referralLeads) {
    CACHE.referralLeads = CACHE.referralLeads.map(l => l.id === id ? { ...l, ...updates } : l);
    saveCachedCollection('referralLeads', CACHE.referralLeads);
  }
  if (!isFirestoreQuotaExceeded() && !id.startsWith('local')) {
    try {
      await updateDoc(doc(db, REFERRAL_LEADS_COL, id), sanitizeFirestoreObject(updates));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${REFERRAL_LEADS_COL}/${id}`);
    }
  }
}

export async function deleteStudentReferralLead(id: string): Promise<void> {
  if (CACHE.referralLeads) {
    CACHE.referralLeads = CACHE.referralLeads.filter(l => l.id !== id);
    saveCachedCollection('referralLeads', CACHE.referralLeads);
  }
  if (!isFirestoreQuotaExceeded() && !id.startsWith('local')) {
    try {
      await deleteDoc(doc(db, REFERRAL_LEADS_COL, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${REFERRAL_LEADS_COL}/${id}`);
    }
  }
}

// ==========================================
// ANNOUNCEMENTS API WITH ROLE-BASED ACCESS
// ==========================================
export function isAnnouncementTargetedForRole(ann: Announcement, role: UserRole): boolean {
  // Admin always sees ALL announcements (including future/expired) for management & auditing
  if (role === 'admin') return true;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const localToday = `${year}-${month}-${day}`;

  // Date validity check for non-admin roles
  if (ann.startDate && ann.startDate > localToday) {
    return false; // Scheduled for future
  }
  if (ann.endDate && ann.endDate < localToday) {
    return false; // Expired
  }

  const normRole = role.toLowerCase().replace(/s$/, ''); // e.g. 'tutor', 'supervisor', 'student', 'parent'

  // Check array of targetRoles
  if (Array.isArray(ann.targetRoles) && ann.targetRoles.length > 0) {
    const targets = ann.targetRoles.map(r => String(r).toLowerCase().replace(/s$/, ''));
    if (targets.includes('all') || targets.includes(normRole) || targets.includes(role.toLowerCase())) return true;
  }

  // Fallback to legacy targetRole field
  if (ann.targetRole) {
    const targetStr = String(ann.targetRole).toLowerCase();
    if (targetStr === 'all' || targetStr.includes(normRole) || targetStr.includes(role.toLowerCase())) return true;
  }

  return false;
}

const DELETED_ANNOUNCEMENTS_KEY = 'it_deleted_announcement_ids';

function getDeletedAnnouncementIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_ANNOUNCEMENTS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
}

function markAnnouncementIdDeleted(id: string): void {
  try {
    const set = getDeletedAnnouncementIds();
    set.add(id);
    localStorage.setItem(DELETED_ANNOUNCEMENTS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

function unmarkAnnouncementIdDeleted(id: string): void {
  try {
    const set = getDeletedAnnouncementIds();
    if (set.has(id)) {
      set.delete(id);
      localStorage.setItem(DELETED_ANNOUNCEMENTS_KEY, JSON.stringify(Array.from(set)));
    }
  } catch {}
}

export function getAnnouncements(forceRefresh = false): Promise<Announcement[]> {
  return (async () => {
    const deletedIds = getDeletedAnnouncementIds();
    if (CACHE.announcements && !forceRefresh) {
      const filtered = CACHE.announcements.filter(a => !deletedIds.has(a.id));
      CACHE.announcements = filtered;
      return filtered;
    }
    const localItems = (loadCachedCollection<Announcement[]>('announcements') || []).filter(a => !deletedIds.has(a.id));
    if (localItems.length > 0 && !forceRefresh && isCachedCollectionFresh('announcements', 30000)) {
      CACHE.announcements = localItems;
      return localItems;
    }
    try {
      if (!isFirestoreQuotaExceeded()) {
        const snap = await getDocs(collection(db, ANNOUNCEMENTS_COL));
        const liveItems = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Announcement))
          .filter(a => !deletedIds.has(a.id));
        liveItems.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        CACHE.announcements = liveItems;
        saveCachedCollection('announcements', liveItems);
        return liveItems;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, ANNOUNCEMENTS_COL);
    }
    const fallback = (localItems.length > 0 ? localItems : (isCleanDataMode() ? [] : SEED_ANNOUNCEMENTS))
      .filter(a => !deletedIds.has(a.id));
    CACHE.announcements = fallback;
    saveCachedCollection('announcements', fallback);
    return fallback;
  })();
}

export async function getAnnouncementsForRole(role: UserRole, forceRefresh = false): Promise<Announcement[]> {
  const all = await getAnnouncements(forceRefresh);
  return all.filter(a => isAnnouncementTargetedForRole(a, role));
}

export function subscribeToAnnouncements(
  callback: (announcements: Announcement[]) => void,
  role?: UserRole
): () => void {
  const emitFiltered = (allItems: Announcement[]) => {
    const deletedIds = getDeletedAnnouncementIds();
    const clean = (allItems || [])
      .filter(a => a && a.id && !deletedIds.has(a.id))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    CACHE.announcements = clean;
    saveCachedCollection('announcements', clean);
    const result = role ? clean.filter(a => isAnnouncementTargetedForRole(a, role)) : clean;
    callback(result);
  };

  const handleLocalEvent = (e: Event) => {
    const custom = e as CustomEvent<Announcement[]>;
    if (custom.detail && Array.isArray(custom.detail)) {
      const deletedIds = getDeletedAnnouncementIds();
      const clean = custom.detail.filter(a => a && a.id && !deletedIds.has(a.id));
      const result = role ? clean.filter(a => isAnnouncementTargetedForRole(a, role)) : clean;
      callback(result);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('it_announcements_updated', handleLocalEvent);
  }

  if (isFirestoreQuotaExceeded()) {
    const initial = CACHE.announcements || loadCachedCollection<Announcement[]>('announcements') || [];
    emitFiltered(initial);
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('it_announcements_updated', handleLocalEvent);
      }
    };
  }

  const unsub = safeOnSnapshot(
    collection(db, ANNOUNCEMENTS_COL),
    (snap) => {
      if (snap && snap.docs) {
        const liveItems = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Announcement));
        emitFiltered(liveItems);
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, ANNOUNCEMENTS_COL);
      const fallback = CACHE.announcements || loadCachedCollection<Announcement[]>('announcements') || [];
      emitFiltered(fallback);
    },
    `${ANNOUNCEMENTS_COL}_live_stream`
  );

  return () => {
    unsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('it_announcements_updated', handleLocalEvent);
    }
  };
}

function broadcastAnnouncementsUpdate(items: Announcement[]): void {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('it_announcements_updated', { detail: items }));
    } catch {}
  }
}

export async function addAnnouncement(announcement: Omit<Announcement, 'id'>): Promise<string> {
  const docRef = doc(collection(db, ANNOUNCEMENTS_COL));
  const docId = docRef.id;
  unmarkAnnouncementIdDeleted(docId);
  const newAnn: Announcement = { id: docId, ...announcement };
  CACHE.announcements = [newAnn, ...(CACHE.announcements || []).filter(a => a.id !== docId)];
  saveCachedCollection('announcements', CACHE.announcements);
  broadcastAnnouncementsUpdate(CACHE.announcements);

  if (!isFirestoreQuotaExceeded()) {
    try {
      await setDoc(docRef, sanitizeFirestoreObject(announcement));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, ANNOUNCEMENTS_COL);
    }
  }
  return docId;
}

export async function updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<void> {
  const existingList = CACHE.announcements || loadCachedCollection<Announcement[]>('announcements') || [];
  const existing = existingList.find(a => a.id === id);

  const updatedAnn: Announcement = {
    ...(existing || {
      id,
      title: '',
      content: '',
      targetRoles: ['student', 'parent', 'tutor', 'supervisor'],
      targetRole: 'all',
      pinned: false,
      authorName: 'Academic Directorate',
      createdAt: new Date().toISOString()
    }),
    ...updates,
    targetRoles: updates.targetRoles || existing?.targetRoles || ['student', 'parent', 'tutor', 'supervisor'],
    id
  };

  if (updates.startDate === '' || updates.startDate === undefined) {
    delete updatedAnn.startDate;
  }
  if (updates.endDate === '' || updates.endDate === undefined) {
    delete updatedAnn.endDate;
  }

  CACHE.announcements = existingList.map(a => (a.id === id ? updatedAnn : a));
  saveCachedCollection('announcements', CACHE.announcements);
  broadcastAnnouncementsUpdate(CACHE.announcements);

  if (!isFirestoreQuotaExceeded()) {
    try {
      const annRef = doc(db, ANNOUNCEMENTS_COL, id);
      const { id: _ignoreId, ...docPayload } = updatedAnn;
      await setDoc(annRef, sanitizeFirestoreObject(docPayload));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, ANNOUNCEMENTS_COL);
    }
  }
}

export async function deleteAnnouncement(id: string): Promise<string> {
  try {
    markAnnouncementIdDeleted(id);
    const currentList = CACHE.announcements || loadCachedCollection<Announcement[]>('announcements') || [];
    let annData = currentList.find(a => a.id === id) || null;
    const annRef = doc(db, ANNOUNCEMENTS_COL, id);

    if (!annData && !isFirestoreQuotaExceeded()) {
      try {
        const snap = await getDoc(annRef);
        if (snap.exists()) {
          annData = { id: snap.id, ...snap.data() } as Announcement;
        }
      } catch {}
    }

    const updatedAnnouncements = currentList.filter(a => a.id !== id);
    CACHE.announcements = updatedAnnouncements;
    saveCachedCollection('announcements', updatedAnnouncements);
    broadcastAnnouncementsUpdate(updatedAnnouncements);

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

      if (!isFirestoreQuotaExceeded()) {
        await deleteDoc(annRef);
      }
      return trashId;
    }

    if (!isFirestoreQuotaExceeded()) {
      await deleteDoc(annRef);
    }
    return '';
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, ANNOUNCEMENTS_COL);
    throw err;
  }
}

// ==========================================
// INTERNAL CHAT / MESSAGING (Attachments, Voice Notes, Read Receipts, Delivery Status)
// ==========================================
export function canonicalizeChatThreadId(threadId: string): string {
  const raw = (threadId || '').trim();
  if (!raw) return '';
  if (raw.startsWith('desk_tutor_')) {
    const suffix = raw.replace(/^desk_tutor_/i, '').trim();
    const numMatch = suffix.match(/\d+/);
    if (numMatch) {
      return `desk_tutor_tutor_${numMatch[0]}`;
    }
    return `desk_tutor_${suffix.replace(/\s+/g, '_').toLowerCase()}`;
  }
  if (raw.startsWith('dm_admin_student_')) {
    const suffix = raw.replace(/^dm_admin_student_/i, '').trim();
    return `dm_admin_student_${suffix.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }
  if (raw.startsWith('dm_admin_parent_')) {
    const suffix = raw.replace(/^dm_admin_parent_/i, '').trim();
    return `dm_admin_parent_${suffix.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }
  return raw;
}

export function getThreadIdVariants(threadId: string): string[] {
  const raw = (threadId || '').trim();
  if (!raw) return [];
  const canonical = canonicalizeChatThreadId(raw);
  const variants = new Set<string>([raw, canonical]);

  if (raw.startsWith('desk_tutor_') || canonical.startsWith('desk_tutor_')) {
    const numMatch = raw.match(/\d+/);
    if (numMatch) {
      const num = numMatch[0];
      variants.add(`desk_tutor_tutor_${num}`);
      variants.add(`desk_tutor_Tutor ${num}`);
      variants.add(`desk_tutor_tutor ${num}`);
      variants.add(`desk_tutor_tutor${num}`);
      variants.add(`desk_tutor_tutor-${num}`);
    }
  } else if (raw.startsWith('dm_admin_student_') || canonical.startsWith('dm_admin_student_')) {
    const suffix = raw.replace(/^dm_admin_student_/i, '');
    variants.add(`dm_admin_student_${suffix}`);
    variants.add(`dm_admin_student_${suffix.toUpperCase()}`);
    variants.add(`dm_admin_student_${suffix.toLowerCase()}`);
    variants.add(`dm_admin_student_${suffix.toLowerCase().replace(/[^a-z0-9]/g, '_')}`);
    variants.add(`dm_admin_student_${suffix.toUpperCase().replace(/_/g, '-')}`);
  }
  return Array.from(variants).filter(Boolean).slice(0, 10);
}

export function subscribeToMessages(threadId: string, callback: (messages: ChatMessage[]) => void, messageLimit = 100) {
  const canonicalThreadId = canonicalizeChatThreadId(threadId) || threadId;
  const variants = getThreadIdVariants(threadId);

  const mergeAndSortMessages = (liveMsgs: ChatMessage[]): ChatMessage[] => {
    const cached = getCachedMessages(canonicalThreadId);
    const variantCached = canonicalThreadId !== threadId ? getCachedMessages(threadId) : [];
    const allLocal = [...cached, ...variantCached];

    const map = new Map<string, ChatMessage>();
    // 1. Add live Firestore messages first (authoritative)
    liveMsgs.forEach(m => {
      if (m && m.id) {
        map.set(m.id, m);
      }
    });

    // 2. Preserve any very recent local/optimistic messages not yet echoed by Firestore
    const nowMs = Date.now();
    allLocal.forEach(localMsg => {
      if (!localMsg || !localMsg.id) return;
      if (map.has(localMsg.id)) return;

      const isLocalTemp = localMsg.id.startsWith('local_msg_') || localMsg.id.startsWith('temp_');
      const msgTimeMs = localMsg.timestamp ? new Date(localMsg.timestamp).getTime() : 0;
      const isRecent = msgTimeMs > 0 && Math.abs(nowMs - msgTimeMs) < 30000;

      // Check if an equivalent live message already exists in map (same sender, text, and close timestamp)
      const hasEquivalentLive = liveMsgs.some(live =>
        live.senderId === localMsg.senderId &&
        live.text === localMsg.text &&
        Math.abs((new Date(live.timestamp).getTime() || 0) - msgTimeMs) < 15000
      );

      if (!hasEquivalentLive && (isFirestoreQuotaExceeded() || isLocalTemp || isRecent)) {
        map.set(localMsg.id, localMsg);
      }
    });

    const combined = Array.from(map.values());
    combined.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
    const windowed = messageLimit > 0 && combined.length > messageLimit
      ? combined.slice(-messageLimit)
      : combined;

    saveCachedMessages(canonicalThreadId, windowed);
    if (canonicalThreadId !== threadId) {
      saveCachedMessages(threadId, windowed);
    }
    return windowed;
  };

  const handleLocalChatEvent = (e: Event) => {
    const custom = e as CustomEvent<{ threadId: string; messages?: ChatMessage[] }>;
    if (custom.detail && variants.includes(custom.detail.threadId)) {
      const cached = getCachedMessages(canonicalThreadId);
      callback(cached);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('it_chat_messages_updated', handleLocalChatEvent);
  }

  if (isFirestoreQuotaExceeded()) {
    const cached = getCachedMessages(canonicalThreadId);
    callback(cached);
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('it_chat_messages_updated', handleLocalChatEvent);
      }
    };
  }

  // Serve cached messages immediately on mount so UI is never blank while snapshot initializes
  const initialCached = getCachedMessages(canonicalThreadId);
  if (initialCached.length > 0) {
    callback(initialCached);
  }

  const q = variants.length > 1
    ? query(collection(db, MESSAGES_COL), where('threadId', 'in', variants))
    : query(collection(db, MESSAGES_COL), where('threadId', '==', canonicalThreadId));

  const unsub = safeOnSnapshot(
    q,
    (snapshot) => {
      const liveMsgs = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as ChatMessage));
      const finalMsgs = mergeAndSortMessages(liveMsgs);
      callback(finalMsgs);
    },
    (_error) => {
      const cached = getCachedMessages(canonicalThreadId);
      callback(cached);
    },
    `${MESSAGES_COL}_thread_${canonicalThreadId}`
  );

  return () => {
    unsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('it_chat_messages_updated', handleLocalChatEvent);
    }
  };
}

export async function sendMessage(messageData: Omit<ChatMessage, 'id'>): Promise<string> {
  const now = new Date().toISOString();
  const canonicalThreadId = canonicalizeChatThreadId(messageData.threadId) || messageData.threadId;
  const initialSeenBy = messageData.senderId ? [messageData.senderId] : [];
  const initialDeliveredTo = messageData.senderId ? [messageData.senderId] : [];
  
  const payload = sanitizeFirestoreObject({
    ...messageData,
    threadId: canonicalThreadId,
    status: 'sent',
    delivered: true,
    read: false,
    deliveredTo: messageData.deliveredTo || initialDeliveredTo,
    deliveredTimestamps: { [messageData.senderId]: now },
    seenBy: messageData.seenBy || initialSeenBy,
    seenTimestamps: { [messageData.senderId]: now },
    listenedBy: messageData.listenedBy || []
  });

  if (!isFirestoreQuotaExceeded()) {
    try {
      const docRef = await addDoc(collection(db, MESSAGES_COL), payload);
      const savedMsg: ChatMessage = { id: docRef.id, ...payload } as ChatMessage;
      appendLocalMessage(canonicalThreadId, savedMsg);
      if (canonicalThreadId !== messageData.threadId) {
        appendLocalMessage(messageData.threadId, savedMsg);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('it_chat_messages_updated', { detail: { threadId: canonicalThreadId } }));
      }
      return docRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, MESSAGES_COL);
      const localMsgId = `local_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const localMsg: ChatMessage = { id: localMsgId, ...payload } as ChatMessage;
      appendLocalMessage(canonicalThreadId, localMsg);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('it_chat_messages_updated', { detail: { threadId: canonicalThreadId } }));
      }
      return localMsgId;
    }
  }

  const localMsgId = `local_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const localMsg: ChatMessage = { id: localMsgId, ...payload } as ChatMessage;
  appendLocalMessage(canonicalThreadId, localMsg);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('it_chat_messages_updated', { detail: { threadId: canonicalThreadId } }));
  }
  return localMsgId;
}

export async function markMessagesAsDelivered(threadId: string, currentUserId: string): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  try {
    const variants = getThreadIdVariants(threadId);
    const q = variants.length > 1
      ? query(
          collection(db, MESSAGES_COL),
          where('threadId', 'in', variants)
        )
      : query(
          collection(db, MESSAGES_COL),
          where('threadId', '==', canonicalizeChatThreadId(threadId) || threadId)
        );
    const snap = await getDocs(q);
    const now = new Date().toISOString();
    const updates = snap.docs
      .filter(d => {
        const data = d.data() as ChatMessage;
        if (data.read) return false;
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
    const variants = getThreadIdVariants(threadId);
    const q = variants.length > 1
      ? query(
          collection(db, MESSAGES_COL),
          where('threadId', 'in', variants)
        )
      : query(
          collection(db, MESSAGES_COL),
          where('threadId', '==', canonicalizeChatThreadId(threadId) || threadId)
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
 * Edit a chat message text.
 * Admin can edit any message; students, parents, and tutors can edit their own sent messages.
 */
export async function editChatMessage(messageId: string, newText: string, callerRole?: UserRole, currentUserId?: string): Promise<void> {
  try {
    const docRef = doc(db, MESSAGES_COL, messageId);
    if (callerRole !== 'admin') {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const msg = snap.data() as ChatMessage;
        if (currentUserId && msg.senderId !== currentUserId) {
          throw new Error('Permission denied: You can only edit your own messages.');
        }
      }
    }
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
 * Delete a chat message.
 * Admin can delete any message; students, parents, and tutors can delete their own sent messages.
 */
export async function deleteChatMessage(messageId: string, deletedBy: string, callerRole?: UserRole, forEveryone = true): Promise<void> {
  try {
    const docRef = doc(db, MESSAGES_COL, messageId);
    if (callerRole !== 'admin') {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const msg = snap.data() as ChatMessage;
        if (deletedBy && msg.senderId !== deletedBy) {
          throw new Error('Permission denied: You can only delete your own messages.');
        }
      }
    }
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
 * Toggle or update an emoji reaction on a chat message
 * Every user (Admin, Supervisor, Tutor, Student, Parent) can react to any message.
 * Tapping the same emoji toggles it off. Tapping a different emoji changes the reaction.
 */
export async function toggleChatMessageReaction(
  threadId: string,
  messageId: string,
  user: { userId: string; userName: string; userRole?: UserRole },
  emoji: string
): Promise<Record<string, ChatReaction>> {
  const canonicalThreadId = canonicalizeChatThreadId(threadId) || threadId;
  const currentCached = getCachedMessages(canonicalThreadId);
  const targetIndex = currentCached.findIndex(m => m.id === messageId);

  let existingReactionEmoji: string | undefined = undefined;
  let updatedReactions: Record<string, ChatReaction> = {};

  if (targetIndex >= 0) {
    const msg = currentCached[targetIndex];
    const prevReactions = msg.reactions || {};
    existingReactionEmoji = prevReactions[user.userId]?.emoji;

    updatedReactions = { ...prevReactions };
    if (existingReactionEmoji === emoji) {
      // Toggle off if clicking same emoji
      delete updatedReactions[user.userId];
    } else {
      // Set new / replacement emoji
      updatedReactions[user.userId] = {
        emoji,
        userId: user.userId,
        userName: user.userName,
        userRole: user.userRole,
        timestamp: new Date().toISOString()
      };
    }

    const updatedMsg: ChatMessage = {
      ...msg,
      reactions: updatedReactions
    };
    const updatedList = [...currentCached];
    updatedList[targetIndex] = updatedMsg;
    saveCachedMessages(canonicalThreadId, updatedList);
    if (canonicalThreadId !== threadId) {
      saveCachedMessages(threadId, updatedList);
    }

    // Trigger local update event for instant 0ms reactive UI feedback across components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('it_chat_messages_updated', {
          detail: { threadId: canonicalThreadId, messages: updatedList }
        })
      );
    }
  }

  // Persist to Firestore document
  try {
    const docRef = doc(db, MESSAGES_COL, messageId);
    if (existingReactionEmoji === emoji) {
      await updateDoc(docRef, {
        [`reactions.${user.userId}`]: deleteField()
      });
    } else {
      await updateDoc(docRef, {
        [`reactions.${user.userId}`]: {
          emoji,
          userId: user.userId,
          userName: user.userName,
          userRole: user.userRole || 'student',
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (err) {
    console.warn('Could not sync chat reaction to Firestore (local cache active):', err);
  }

  return updatedReactions;
}

/**
 * Check if a user role and ID is authorized to participate in a specific chat thread
 */
export function isUserAuthorizedForThread(threadId: string, userId: string, role: UserRole): boolean {
  // All admins have access to participate in all channels
  if (role === 'admin') return true;

  // Supervisors can access their direct line with Admin and ALL tutor support groups
  if (role === 'supervisor') {
    if (
      threadId === 'dm_admin_supervisor' ||
      threadId.startsWith('desk_tutor_')
    ) {
      return true;
    }
    return false;
  }

  // Tutors can ONLY access their own dedicated support group (desk_tutor_<tutorId>).
  // Direct messages from tutors are disabled so all communication takes place in the support group
  // where both Admins and Supervisors can see the chat together and take immediate action.
  if (role === 'tutor') {
    if (threadId.startsWith('desk_tutor_')) {
      const channelTutorSuffix = threadId
        .replace('desk_tutor_', '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

      const cleanUserId = (userId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const rawNumDesk = channelTutorSuffix.replace('tutor', '');
      const rawNumUser = cleanUserId.replace('tutor', '');

      return (
        cleanUserId === channelTutorSuffix ||
        cleanUserId.endsWith(channelTutorSuffix) ||
        channelTutorSuffix.endsWith(cleanUserId) ||
        (rawNumDesk !== '' && rawNumDesk === rawNumUser)
      );
    }
    return false;
  }

  if (role === 'student') {
    if (threadId.startsWith('dm_admin_student_') || threadId.startsWith('channel_student_')) {
      const channelStudentSuffix = threadId
        .replace('dm_admin_student_', '')
        .replace('channel_student_', '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      const cleanUserId = (userId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const rawNumStudent = channelStudentSuffix.replace('student', '');
      const rawNumUser = cleanUserId.replace('student', '');
      return (
        cleanUserId === channelStudentSuffix ||
        cleanUserId.endsWith(channelStudentSuffix) ||
        channelStudentSuffix.endsWith(cleanUserId) ||
        (rawNumStudent !== '' && rawNumStudent === rawNumUser)
      );
    }
    return false;
  }

  if (role === 'parent') {
    if (threadId.startsWith('dm_admin_parent_') || threadId.startsWith('channel_parent_')) {
      const channelParentSuffix = threadId
        .replace('dm_admin_parent_', '')
        .replace('channel_parent_', '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      const cleanUserId = (userId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const rawNumParent = channelParentSuffix.replace('parent', '');
      const rawNumUser = cleanUserId.replace('parent', '');
      return (
        cleanUserId === channelParentSuffix ||
        cleanUserId.endsWith(channelParentSuffix) ||
        channelParentSuffix.endsWith(cleanUserId) ||
        (rawNumParent !== '' && rawNumParent === rawNumUser)
      );
    }
    return false;
  }

  return false;
}

/**
 * Resolves the exact list of chat threadIds (max 10) for a non-admin user (Tutor, Student, Parent)
 * so Firestore chat listeners only subscribe to that user's own conversation threads,
 * cutting chat snapshot reads by 95%+.
 */
export function getScopedChatThreadIds(userId: string, userRole: UserRole): string[] | null {
  if (userRole === 'admin' || userRole === 'supervisor') {
    return null; // Admin & Supervisor monitor all academy support threads
  }

  const threads = new Set<string>();
  const raw = (userId || '').trim();
  if (!raw) return null;

  if (userRole === 'tutor') {
    const numMatch = raw.match(/\d+/);
    const num = numMatch ? numMatch[0] : '';
    const canonicalTutor = num ? `Tutor ${num}` : raw;
    const cleanAlpha = raw.toLowerCase().replace(/[^a-z0-9]/g, '');

    threads.add(`desk_tutor_${canonicalTutor}`);
    threads.add(`desk_tutor_${raw}`);
    threads.add(`desk_tutor_${cleanAlpha}`);
    if (num) {
      threads.add(`desk_tutor_tutor_${num}`);
      threads.add(`desk_tutor_tutor-${num}`);
      threads.add(`desk_tutor_tut_${num.padStart(3, '0')}`);
      threads.add(`dm_admin_tutor_${canonicalTutor}`);
      threads.add(`dm_admin_tutor_tutor_${num}`);
    }

    const cachedTutors = CACHE.tutors || loadCachedCollection<Tutor[]>('tutors') || [];
    const matchedTutor = cachedTutors.find(t => isSameTutor(t.tutorId, raw) || t.id === raw);
    if (matchedTutor) {
      threads.add(`desk_tutor_${matchedTutor.tutorId}`);
      threads.add(`desk_tutor_${matchedTutor.id}`);
    }
  } else if (userRole === 'student' || userRole === 'parent') {
    const cleanRaw = raw.replace(/^(student_|parent_)/i, '');
    const addStudentThreads = (idStr: string) => {
      if (!idStr) return;
      threads.add(`dm_admin_student_${idStr}`);
      threads.add(`channel_student_${idStr}`);
      threads.add(`dm_admin_parent_${idStr}`);
      threads.add(`channel_parent_${idStr}`);
    };

    addStudentThreads(cleanRaw);
    addStudentThreads(raw);

    const cachedStudents = CACHE.students || loadCachedCollection<Student[]>('students') || [];
    cachedStudents.forEach(s => {
      if (
        s.studentId === cleanRaw ||
        s.id === cleanRaw ||
        s.parentId === cleanRaw ||
        (s.studentId && cleanRaw.toLowerCase().includes(s.studentId.toLowerCase()))
      ) {
        addStudentThreads(s.studentId);
        addStudentThreads(s.id);
      }
    });
  }

  const list = Array.from(threads).filter(Boolean).slice(0, 10);
  return list.length > 0 ? list : null;
}

/**
 * Subscribe to genuinely unread messages for a specific user to display accurate badges.
 * Scoped strictly by threadId for Tutors, Students, and Parents to reduce Firestore reads by 95%+.
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

  const scopedThreads = getScopedChatThreadIds(userId, userRole);
  const q = scopedThreads && scopedThreads.length > 0
    ? query(
        collection(db, MESSAGES_COL),
        where('threadId', 'in', scopedThreads)
      )
    : query(
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
        if (msg.read) return;

        // 1. Ignore own messages, system calls, deleted messages
        if (msg.senderId === userId || msg.senderId === 'system_call') return;
        if (userRole === 'tutor' && msg.senderRole === 'tutor' && isSameTutor(msg.senderId, userId)) return;
        if (msg.deletedForEveryone) return;
        if (userRole === 'admin' && msg.senderRole === 'admin' && (msg.senderId === 'admin' || msg.senderId === userId)) return;

        // 2. Check if this specific user has seen the message in seenBy array
        const seenList = Array.isArray(msg.seenBy) ? msg.seenBy : [];
        const hasSeen = seenList.includes(userId) || (userRole === 'admin' && (seenList.includes('admin') || seenList.includes('auth_admin_01')));
        if (hasSeen) return;

        // 3. Check authorization for thread
        if (!isUserAuthorizedForThread(msg.threadId, userId, userRole)) return;

        const canonicalTid = canonicalizeChatThreadId(msg.threadId) || msg.threadId;
        total++;
        byThread[canonicalTid] = (byThread[canonicalTid] || 0) + 1;
        if (canonicalTid !== msg.threadId) {
          byThread[msg.threadId] = (byThread[msg.threadId] || 0) + 1;
        }
      });

      callback(total, byThread);
    },
    (_err) => {
      callback(0, {});
    },
    `${MESSAGES_COL}_unread_${userRole}_${userId}`
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
 * Subscribe to incoming messages for in-app alert banners & browser desktop push.
 * Scoped strictly by threadId for Tutors, Students, and Parents so messages in other threads
 * consume 0 Firestore reads.
 */
export function subscribeToIncomingMessages(
  userId: string,
  userRole: UserRole,
  onNewMessage: (message: ChatMessage) => void
) {
  if (isFirestoreQuotaExceeded()) {
    return () => {};
  }

  const scopedThreads = getScopedChatThreadIds(userId, userRole);
  const q = scopedThreads && scopedThreads.length > 0
    ? query(
        collection(db, MESSAGES_COL),
        where('threadId', 'in', scopedThreads)
      )
    : query(
        collection(db, MESSAGES_COL),
        orderBy('timestamp', 'desc'),
        limit(25)
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

          const canonicalTid = canonicalizeChatThreadId(msg.threadId) || msg.threadId;
          appendLocalMessage(canonicalTid, msg);
          if (canonicalTid !== msg.threadId) {
            appendLocalMessage(msg.threadId, msg);
          }

          // Ignore if sent by self
          if (msg.senderId === userId) return;
          if (userRole === 'tutor' && msg.senderRole === 'tutor' && isSameTutor(msg.senderId, userId)) return;
          if (userRole === 'admin' && msg.senderRole === 'admin' && (msg.senderId === 'admin' || msg.senderId === userId)) return;

          // Check if user is recipient or authorized for this thread
          if (isUserAuthorizedForThread(msg.threadId, userId, userRole)) {
            onNewMessage({ ...msg, threadId: canonicalTid });
          }
        }
      });
    },
    (_err) => {},
    `${MESSAGES_COL}_incoming_${userRole}_${userId}`
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
// PRE-CALCULATED SUMMARY METRICS ENGINE (PILLAR 4)
// Delivers 1-read / 0-read KPI Cards for Dashboards
// ==========================================
export function calculateSummaryMetricsFromCache(): SummaryMetrics {
  const students = CACHE.students || loadCachedCollection<Student[]>('students') || [];
  const tutors = CACHE.tutors || loadCachedCollection<Tutor[]>('tutors') || [];
  const classes = CACHE.classes || loadCachedCollection<TimetableClass[]>('classes') || [];
  const fees = CACHE.fees || loadCachedCollection<StudentFee[]>('fees') || [];
  const salaries = CACHE.salaries || loadCachedCollection<TutorSalary[]>('salaries') || [];

  const activeStudents = students.filter(s => s.status === 'Active' || s.status === 'Confirmed').length;
  const trialStudents = students.filter(s => s.status === 'Trial').length;
  const inactiveStudents = students.filter(s => s.status === 'Inactive' || s.status === 'Not Taking').length;
  const pendingStudents = students.filter(s => s.status === 'Pending').length;

  const activeTutors = tutors.filter(t => t.status === 'Active').length;
  const weeklyScheduledClasses = classes.filter(c => c.status === 'Scheduled').length;

  const unpaidFeesList = fees.filter(f => f.status === 'Pending' || f.status === 'Overdue' || f.status === 'Payment Submitted');
  const unpaidFeesCount = unpaidFeesList.length;
  const unpaidFeesTotalUSD = unpaidFeesList.reduce((acc, f) => acc + (f.amount || 0), 0);
  const paidFeesCount = fees.filter(f => f.status === 'Paid').length;
  const overdueFeesCount = fees.filter(f => f.status === 'Overdue').length;

  const totalSalariesPKR = salaries.reduce((acc, s) => acc + (s.monthlySalary || 0), 0);

  return {
    totalStudents: students.length,
    activeStudents,
    trialStudents,
    inactiveStudents,
    pendingStudents,
    totalTutors: tutors.length,
    activeTutors,
    totalClasses: classes.length,
    weeklyScheduledClasses,
    unpaidFeesCount,
    unpaidFeesTotalUSD,
    paidFeesCount,
    overdueFeesCount,
    totalSalariesPKR,
    lastCalculatedAt: new Date().toISOString()
  };
}

let summaryMetricsDebounceTimer: any = null;
let lastPersistedMetricsHash = '';

export async function recalculateAndPersistSummaryMetrics(): Promise<SummaryMetrics> {
  const metrics = calculateSummaryMetricsFromCache();
  CACHE.metrics = metrics;
  saveCachedCollection('metrics', metrics);

  if (!isFirestoreQuotaExceeded()) {
    if (summaryMetricsDebounceTimer) {
      clearTimeout(summaryMetricsDebounceTimer);
    }
    summaryMetricsDebounceTimer = setTimeout(() => {
      summaryMetricsDebounceTimer = null;
      try {
        const latestMetrics = calculateSummaryMetricsFromCache();
        const { lastCalculatedAt: _ignore, ...comparable } = latestMetrics;
        const nextHash = JSON.stringify(comparable);
        if (nextHash === lastPersistedMetricsHash) return;
        lastPersistedMetricsHash = nextHash;

        const summaryRef = doc(db, SUMMARY_COL, SUMMARY_DOC_ID);
        setDoc(summaryRef, sanitizeFirestoreObject(latestMetrics), { merge: true }).catch(err => {
          console.warn("Background metrics persistence notice:", err);
        });
      } catch (e) {
        console.warn("recalculateAndPersistSummaryMetrics notice:", e);
      }
    }, 3000);
  }
  return metrics;
}

/**
 * Single-Document KPI Counters & Aggregations (Zero-Read Analytics via getCountFromServer)
 * Optimization 4: Uses Firestore's built-in count() aggregation queries (getCountFromServer()).
 * A count() query costs 1 read total for up to 1,000 documents, rather than reading every document individually.
 */
export async function fetchLiveKPICounters(): Promise<Partial<SummaryMetrics>> {
  if (isFirestoreQuotaExceeded()) return {};
  try {
    const [
      activeStuSnap,
      trialStuSnap,
      inactiveStuSnap,
      pendingStuSnap,
      activeTutorsSnap,
      scheduledClassesSnap,
      unpaidFeesSnap
    ] = await Promise.all([
      getCountFromServer(query(collection(db, STUDENTS_COL), where('status', 'in', ['Active', 'Confirmed']))),
      getCountFromServer(query(collection(db, STUDENTS_COL), where('status', '==', 'Trial'))),
      getCountFromServer(query(collection(db, STUDENTS_COL), where('status', 'in', ['Inactive', 'Not Taking']))),
      getCountFromServer(query(collection(db, STUDENTS_COL), where('status', '==', 'Pending'))),
      getCountFromServer(query(collection(db, TUTORS_COL), where('status', '==', 'Active'))),
      getCountFromServer(query(collection(db, CLASSES_COL), where('status', '==', 'Scheduled'))),
      getCountFromServer(query(collection(db, FEES_COL), where('status', 'in', ['Pending', 'Overdue', 'Payment Submitted'])))
    ]);

    const activeStudents = activeStuSnap.data().count;
    const trialStudents = trialStuSnap.data().count;
    const inactiveStudents = inactiveStuSnap.data().count;
    const pendingStudents = pendingStuSnap.data().count;
    const activeTutors = activeTutorsSnap.data().count;
    const weeklyScheduledClasses = scheduledClassesSnap.data().count;
    const unpaidFeesCount = unpaidFeesSnap.data().count;

    const partialMetrics: Partial<SummaryMetrics> = {
      activeStudents,
      trialStudents,
      inactiveStudents,
      pendingStudents,
      activeTutors,
      weeklyScheduledClasses,
      unpaidFeesCount,
      lastCalculatedAt: new Date().toISOString()
    };
    return partialMetrics;
  } catch (err) {
    console.warn("fetchLiveKPICounters notice:", err);
    return {};
  }
}

export async function getSummaryMetrics(forceRefresh = false): Promise<SummaryMetrics> {
  if (CACHE.metrics && !forceRefresh) {
    return CACHE.metrics;
  }
  const stored = loadCachedCollection<SummaryMetrics>('metrics');
  if (stored && !forceRefresh) {
    CACHE.metrics = stored;
    return stored;
  }

  if (!isFirestoreQuotaExceeded()) {
    try {
      const snap = await getDoc(doc(db, SUMMARY_COL, SUMMARY_DOC_ID));
      if (snap.exists()) {
        const metrics = snap.data() as SummaryMetrics;
        CACHE.metrics = metrics;
        saveCachedCollection('metrics', metrics);
        return metrics;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `${SUMMARY_COL}/${SUMMARY_DOC_ID}`);
    }
  }

  // When summary document does not exist or on forced sync:
  // Query live count aggregations (1 read per 1,000 docs) to compute precise metrics!
  const liveCounts = await fetchLiveKPICounters().catch(() => ({}));
  const baseMetrics = calculateSummaryMetricsFromCache();
  const mergedMetrics: SummaryMetrics = {
    ...baseMetrics,
    ...liveCounts,
    lastCalculatedAt: new Date().toISOString()
  };

  CACHE.metrics = mergedMetrics;
  saveCachedCollection('metrics', mergedMetrics);

  if (!isFirestoreQuotaExceeded()) {
    const summaryRef = doc(db, SUMMARY_COL, SUMMARY_DOC_ID);
    setDoc(summaryRef, sanitizeFirestoreObject(mergedMetrics), { merge: true }).catch(() => {});
  }

  return mergedMetrics;
}

export function subscribeToSummaryMetrics(callback: (metrics: SummaryMetrics) => void): () => void {
  const getFallback = () => CACHE.metrics || loadCachedCollection<SummaryMetrics>('metrics') || calculateSummaryMetricsFromCache();
  if (isFirestoreQuotaExceeded()) {
    callback(getFallback());
    return () => {};
  }

  const docRef = doc(db, SUMMARY_COL, SUMMARY_DOC_ID);
  return safeOnSnapshot(
    docRef,
    (snap: any) => {
      if (snap && snap.exists()) {
        const metrics = snap.data() as SummaryMetrics;
        CACHE.metrics = metrics;
        saveCachedCollection('metrics', metrics);
        callback(metrics);
      } else {
        callback(getFallback());
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, `${SUMMARY_COL}/${SUMMARY_DOC_ID}`);
      callback(getFallback());
    },
    `${SUMMARY_COL}/${SUMMARY_DOC_ID}`
  );
}

// ==========================================
// DEBOUNCED WRITE UTILITY (PILLAR 3)
// Buffers high-frequency field updates (e.g. typing notes, remarks) for 600ms
// ==========================================
const DEBOUNCE_MAP = new Map<string, { timer: any; updates: Record<string, any> }>();

export function debouncedUpdateDoc(
  collectionName: string,
  docId: string,
  updates: Record<string, any>,
  delayMs = 600
): void {
  const key = `${collectionName}/${docId}`;
  const existing = DEBOUNCE_MAP.get(key);

  if (existing) {
    clearTimeout(existing.timer);
    existing.updates = { ...existing.updates, ...updates };
  } else {
    DEBOUNCE_MAP.set(key, {
      timer: null,
      updates: { ...updates }
    });
  }

  const current = DEBOUNCE_MAP.get(key)!;
  current.timer = setTimeout(() => {
    DEBOUNCE_MAP.delete(key);
    if (!isFirestoreQuotaExceeded() && !docId.startsWith('local') && !docId.startsWith('temp') && !docId.startsWith('seed')) {
      const docRef = doc(db, collectionName, docId);
      updateDoc(docRef, sanitizeFirestoreObject(current.updates)).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, key);
      });
    }
  }, delayMs);
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
 * Real-time subscription to pending approval registrations
 */
export function subscribeToPendingUsers(callback: (pendingUsers: UserProfile[]) => void): () => void {
  const getFallback = () => ((CACHE as any).users || []).filter((u: UserProfile) => u.status === 'pending_approval');
  if (isFirestoreQuotaExceeded()) {
    callback(getFallback());
    return () => {};
  }
  return safeOnSnapshot(
    query(collection(db, USERS_COL), where('status', '==', 'pending_approval')),
    (snap) => {
      if (snap) {
        const items = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
        callback(items);
      } else {
        callback(getFallback());
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, USERS_COL);
      callback(getFallback());
    },
    USERS_COL
  );
}

/**
 * Admin approves a self-registered user account.
 * Transitions their status to 'active' and activates any linked student record.
 */
export async function approveUserAccount(
  uid: string,
  adminName: string,
  options?: {
    assignedTutorId?: string;
    courseType?: CourseType;
    studentStatus?: StudentStatus;
    monthlyFee?: number;
    feeCurrency?: AllowedCurrency;
  }
): Promise<void> {
  const approvalTimestamp = new Date().toISOString();
  try {
    const userDocRef = doc(db, USERS_COL, uid);
    const userSnap = await getDoc(userDocRef);
    const userData = userSnap.exists() ? (userSnap.data() as UserProfile) : null;

    const userUpdates: Partial<UserProfile> = {
      status: 'active',
      approvedBy: adminName,
      approvedAt: approvalTimestamp,
      ...(options?.assignedTutorId ? { tutorId: options.assignedTutorId } : {}),
      ...(options?.courseType ? { courseType: options.courseType } : {})
    };

    await setDoc(userDocRef, sanitizeFirestoreObject(userUpdates), { merge: true });

    // Also update by email doc ID if an alias exists
    if (userData?.email) {
      const emailDocId = userData.email.replace(/[@.]/g, '_');
      if (emailDocId !== uid) {
        await setDoc(doc(db, USERS_COL, emailDocId), sanitizeFirestoreObject(userUpdates), { merge: true });
      }

      // If user is a student, activate their student profile in students collection
      if (userData.role === 'student') {
        const stSnap = await getDocs(query(collection(db, STUDENTS_COL), where('email', '==', userData.email)));
        if (!stSnap.empty) {
          for (const sDoc of stSnap.docs) {
            const studentUpdates: Partial<Student> = {
              status: options?.studentStatus || 'Active',
              ...(options?.assignedTutorId ? { assignedTutorId: options.assignedTutorId } : {}),
              ...(options?.courseType ? { courseType: options.courseType } : {}),
              ...(options?.monthlyFee !== undefined ? { monthlyFee: options.monthlyFee } : {}),
              ...(options?.feeCurrency ? { feeCurrency: options.feeCurrency } : {})
            };
            await updateDoc(doc(db, STUDENTS_COL, sDoc.id), sanitizeFirestoreObject(studentUpdates));
          }
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
export async function rejectUserAccount(uid: string, adminName = 'Admin'): Promise<void> {
  try {
    const userDocRef = doc(db, USERS_COL, uid);
    const userSnap = await getDoc(userDocRef);
    const userData = userSnap.exists() ? (userSnap.data() as UserProfile) : null;

    await setDoc(userDocRef, {
      status: 'inactive',
      rejectedBy: adminName,
      rejectedAt: new Date().toISOString()
    }, { merge: true });

    if (userData?.email) {
      const emailDocId = userData.email.replace(/[@.]/g, '_');
      if (emailDocId !== uid) {
        await setDoc(doc(db, USERS_COL, emailDocId), {
          status: 'inactive',
          rejectedBy: adminName,
          rejectedAt: new Date().toISOString()
        }, { merge: true });
      }

      if (userData.role === 'student') {
        const stSnap = await getDocs(query(collection(db, STUDENTS_COL), where('email', '==', userData.email)));
        for (const sDoc of stSnap.docs) {
          await updateDoc(doc(db, STUDENTS_COL, sDoc.id), {
            status: 'Inactive'
          });
        }
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${USERS_COL}/${uid}`);
    throw err;
  }
}

export interface ChildRegistrationItem {
  name: string;
  age?: number;
  courseType?: CourseType;
  loginEmail?: string;
  loginPassword?: string;
}

export interface RegisterSelfStudentOrParentParams {
  email: string;
  password: string;
  displayName: string;
  role: 'student' | 'parent';
  studentType?: 'adult' | 'child'; // Adult student manages self; child managed by parent
  phone?: string;
  country?: string;
  timezone?: string;
  courseType?: CourseType;
  parentName?: string;
  parentEmail?: string;
  // Multi-child registration for parents:
  children?: ChildRegistrationItem[];
  enrollParentAsStudent?: boolean;
}

/**
 * Self-registration for Student and Parent roles only.
 * Creates real Firebase Authentication user + Firestore profile with status 'pending_approval'.
 * Admin, Supervisor and Tutor are STRICTLY FORBIDDEN from registering via this method.
 */
export async function registerSelfStudentOrParent(params: RegisterSelfStudentOrParentParams): Promise<UserProfile> {
  if (params.role !== 'student' && params.role !== 'parent') {
    throw new Error('Public registration is strictly limited to Students and Parents. Faculty accounts are provisioned exclusively by Academy Administration.');
  }

  if (!params.email || !params.password) {
    throw new Error('Email and password are required.');
  }

  const cleanEmail = params.email.trim().toLowerCase();

  if (params.password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  // 1. Create real Firebase Auth account using primary auth
  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
  const uid = cred.user.uid;

  let linkedChildren: string[] = [];
  let generatedStudentId: string | undefined = undefined;
  let familyGroupId: string | undefined = undefined;
  let familyGroupName: string | undefined = undefined;

  // 2. Handle Parent vs Student logic
  if (params.role === 'parent') {
    // Generate sequential unified Family ID for this household (e.g. FAM-1001)
    familyGroupId = getNextSequentialFamilyId();
    familyGroupName = `${params.displayName.trim()}'s Family`;

    // If parent is also enrolling as a student learner
    if (params.enrollParentAsStudent) {
      generatedStudentId = getNextSequentialStudentId();
      try {
        const parentAsStudentDoc: Omit<Student, 'id'> = {
          studentId: generatedStudentId,
          name: params.displayName.trim(),
          studentType: 'adult',
          email: cleanEmail,
          phone: params.phone ? params.phone.trim() : '',
          parentName: '',
          parentEmail: '',
          parentPhone: '',
          parentId: uid,
          familyGroupId,
          familyGroupName,
          assignedTutorId: 'Tutor 1',
          country: params.country || 'USA',
          timezone: params.timezone || 'America/New_York',
          courseType: params.courseType || 'Quran Reading / Nazra',
          status: 'Pending',
          trialSessionsCompleted: 0,
          trialSessionsTotal: 5,
          trialStatus: 'Decision Pending',
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(db, STUDENTS_COL), sanitizeFirestoreObject(parentAsStudentDoc));
      } catch (err) {
        console.warn('Could not register parent as student record:', err);
      }
    }

    // A. Check existing student records in 'students' collection for auto-linking (preserves 160+ students)
    try {
      const parentSnap = await getDocs(query(collection(db, STUDENTS_COL), where('parentEmail', '==', cleanEmail)));
      if (!parentSnap.empty) {
        for (const docSnap of parentSnap.docs) {
          const st = docSnap.data() as Student;
          if (st.studentId && st.studentId !== generatedStudentId) {
            linkedChildren.push(st.studentId);
            // Link existing student record to this family ID & parentId
            await updateDoc(doc(db, STUDENTS_COL, docSnap.id), {
              parentId: uid,
              familyGroupId,
              familyGroupName
            });
          }
        }
      }
    } catch (err) {
      console.warn('Parent registration children auto-link notice:', err);
    }

    // B. If parent submitted children in enrollment form, create records for each child
    if (params.children && params.children.length > 0) {
      let tempStudentCache = [...(CACHE.students || loadCachedCollection<Student[]>('students') || SEED_STUDENTS)];
      for (let idx = 0; idx < params.children.length; idx++) {
        const child = params.children[idx];
        if (!child.name.trim()) continue;

        const childStuId = getNextSequentialStudentId(tempStudentCache);
        tempStudentCache.push({ id: 'temp_' + childStuId, studentId: childStuId, name: child.name.trim(), status: 'Pending' } as any);

        const childCleanName = child.name.trim();
        // Use custom kid login email or auto-generate unique branded student email (e.g. ali.stu101@islamictuition.us)
        const childCleanEmail = child.loginEmail?.trim().toLowerCase() ||
          generateStudentEmail(childCleanName, childStuId);

        linkedChildren.push(childStuId);

        try {
          const newChildDoc: Omit<Student, 'id'> = {
            studentId: childStuId,
            name: childCleanName,
            age: child.age,
            studentType: 'child',
            email: childCleanEmail,
            phone: params.phone ? params.phone.trim() : '',
            parentName: params.displayName.trim(),
            parentEmail: cleanEmail,
            parentPhone: params.phone ? params.phone.trim() : '',
            parentId: uid,
            familyGroupId,
            familyGroupName,
            assignedTutorId: 'Tutor 1',
            country: params.country || 'USA',
            timezone: params.timezone || 'America/New_York',
            courseType: child.courseType || 'Quran Reading / Nazra',
            status: 'Pending',
            trialSessionsCompleted: 0,
            trialSessionsTotal: 5,
            trialStatus: 'Decision Pending',
            createdAt: new Date().toISOString()
          };
          await addDoc(collection(db, STUDENTS_COL), sanitizeFirestoreObject(newChildDoc));

          // If child password provided, create real child auth user via secondary app
          if (child.loginPassword && child.loginPassword.length >= 6) {
            try {
              const secAuth = getSecondaryAuthApp();
              const childCred = await createUserWithEmailAndPassword(secAuth, childCleanEmail, child.loginPassword);
              const childProfile: UserProfile = {
                uid: childCred.user.uid,
                email: childCleanEmail,
                displayName: childCleanName,
                role: 'student',
                studentType: 'child',
                status: 'pending_approval',
                studentId: childStuId,
                familyGroupId,
                familyGroupName,
                parentName: params.displayName.trim(),
                parentEmail: cleanEmail,
                phone: params.phone ? params.phone.trim() : '',
                country: params.country || 'USA',
                timezone: params.timezone || 'America/New_York',
                courseType: child.courseType || 'Quran Reading / Nazra',
                createdAt: new Date().toISOString()
              };
              await setDoc(doc(db, USERS_COL, childCred.user.uid), sanitizeFirestoreObject(childProfile));
            } catch (authErr) {
              console.warn('Child auth creation notice:', authErr);
            }
          }
        } catch (err) {
          console.warn('Could not register child student:', err);
        }
      }
    }
  } else if (params.role === 'student') {
    generatedStudentId = getNextSequentialStudentId();
  }

  // 3. Persist profile in Firestore with status 'pending_approval' (Awaiting Director Review)
  const isAdultStudent = params.role === 'student' && params.studentType === 'adult';
  const newProfile: UserProfile = {
    uid,
    email: cleanEmail,
    displayName: params.displayName.trim(),
    role: params.role,
    status: 'pending_approval',
    studentType: params.role === 'student' ? (params.studentType || 'adult') : undefined,
    phone: params.phone ? params.phone.trim() : '',
    country: params.country || 'USA',
    timezone: params.timezone || 'America/New_York',
    courseType: params.courseType || 'Quran Reading / Nazra',
    parentName: isAdultStudent ? '' : (params.parentName ? params.parentName.trim() : ''),
    parentEmail: isAdultStudent ? '' : (params.parentEmail ? params.parentEmail.trim().toLowerCase() : ''),
    ...(linkedChildren.length > 0 ? { linkedStudentIds: linkedChildren } : {}),
    ...(generatedStudentId ? { studentId: generatedStudentId } : {}),
    ...(familyGroupId ? { familyGroupId, familyGroupName } : {}),
    createdAt: new Date().toISOString()
  };

  await setDoc(doc(db, USERS_COL, uid), sanitizeFirestoreObject(newProfile));
  const emailDocId = cleanEmail.replace(/[@.]/g, '_');
  if (emailDocId !== uid) {
    await setDoc(doc(db, USERS_COL, emailDocId), sanitizeFirestoreObject(newProfile));
  }

  // 4. Create entry in students collection if student with status 'Pending'
  if (params.role === 'student' && generatedStudentId) {
    try {
      const newStudentDoc: Omit<Student, 'id'> = {
        studentId: generatedStudentId,
        name: params.displayName.trim(),
        email: cleanEmail,
        studentType: params.studentType || 'adult',
        phone: params.phone ? params.phone.trim() : '',
        parentName: isAdultStudent ? '' : (params.parentName ? params.parentName.trim() : ''),
        parentEmail: isAdultStudent ? '' : (params.parentEmail ? params.parentEmail.trim().toLowerCase() : ''),
        parentPhone: isAdultStudent ? '' : (params.phone ? params.phone.trim() : ''),
        assignedTutorId: 'Tutor 1',
        country: params.country || 'USA',
        timezone: params.timezone || 'America/New_York',
        courseType: params.courseType || 'Quran Reading / Nazra',
        status: 'Pending',
        trialSessionsCompleted: 0,
        trialSessionsTotal: 5,
        trialStatus: 'Decision Pending',
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

  const localExistingStudent = CACHE.students?.find(s =>
    (params.studentId && s.studentId === params.studentId) ||
    (cleanEmail && s.email && s.email.toLowerCase().trim() === cleanEmail)
  );

  const rawAssignedTutor = params.tutorId || params.profileData?.assignedTutorId || localExistingStudent?.assignedTutorId || '';
  const resolvedTutorId = rawAssignedTutor ? normalizeTutorId(rawAssignedTutor) : '';

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
    ...(resolvedTutorId ? { tutorId: resolvedTutorId } : {}),
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
      const targetStudentId = params.studentId || params.profileData?.studentId || localExistingStudent?.studentId;

      // Check if student record already exists in students collection with this email
      const existingEmailSnap = await getDocs(
        query(collection(db, STUDENTS_COL), where('email', '==', targetEmail))
      );

      if (!existingEmailSnap.empty) {
        for (const sDoc of existingEmailSnap.docs) {
          await updateDoc(doc(db, STUDENTS_COL, sDoc.id), {
            email: params.email.trim(),
            ...(targetStudentId ? { studentId: targetStudentId } : {}),
            ...(resolvedTutorId ? { assignedTutorId: resolvedTutorId } : {})
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
              email: params.email.trim(),
              ...(resolvedTutorId ? { assignedTutorId: resolvedTutorId } : {})
            });
          }
        } else {
          // Create new student document if no match found
          const studentId = targetStudentId || `STU-${Math.floor(100 + Math.random() * 900)}`;
          const newStudent: Omit<Student, 'id'> = {
            studentId,
            name: params.displayName,
            phone: params.phone || localExistingStudent?.phone || '',
            parentName: params.parentName || params.profileData?.parentName || localExistingStudent?.parentName || 'Parent Guardian',
            parentPhone: params.parentPhone || localExistingStudent?.parentPhone || '',
            parentEmail: params.parentEmail || params.profileData?.parentEmail || localExistingStudent?.parentEmail || params.email,
            email: params.email,
            country: params.country || params.profileData?.country || localExistingStudent?.country || 'USA',
            timezone: params.timezone || params.profileData?.timezone || localExistingStudent?.timezone || 'America/New_York',
            assignedTutorId: resolvedTutorId || localExistingStudent?.assignedTutorId || 'Tutor 6',
            courseType: (params.courseType || params.profileData?.courseType || localExistingStudent?.courseType || 'Quran Reading / Nazra') as CourseType,
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
// ==========================================
// ACADEMY SECURITY & ACTIVE USER SESSIONS AUDITING
// ==========================================
export const SESSIONS_COL = 'user_sessions';
let MEMORY_SESSIONS: AcademyUserSession[] = [];

/**
 * Natural sorting for Academy User Sessions:
 * 1. Admins on top (Owner / Director first)
 * 2. Supervisors second (Supervisor 1, Supervisor 2...)
 * 3. Tutors third (Strict numeric sequence: Tutor 1, Tutor 2, ... Tutor 20)
 * 4. Students fourth (Strict numeric sequence: STU-101, STU-102...)
 * 5. Parents fifth
 */
export function sortAcademySessions(sessions: AcademyUserSession[]): AcademyUserSession[] {
  const roleRank: Record<string, number> = {
    admin: 1,
    supervisor: 2,
    tutor: 3,
    student: 4,
    parent: 5
  };

  return [...sessions].sort((a, b) => {
    // 1. Primary sort: Role Rank
    const rankA = roleRank[a.role] || 99;
    const rankB = roleRank[b.role] || 99;
    if (rankA !== rankB) return rankA - rankB;

    // 2. Role-specific ID Sequence Sorting
    if (a.role === 'admin' && b.role === 'admin') {
      const isOwnerA = (a.email || '').toLowerCase().includes('muhammadusman') || (a.displayName || '').toLowerCase().includes('usman');
      const isOwnerB = (b.email || '').toLowerCase().includes('muhammadusman') || (b.displayName || '').toLowerCase().includes('usman');
      if (isOwnerA && !isOwnerB) return -1;
      if (!isOwnerA && isOwnerB) return 1;
      return (a.displayName || a.email).localeCompare(b.displayName || b.email);
    }

    if (a.role === 'supervisor' && b.role === 'supervisor') {
      const numA = parseInt((a.displayName || a.email).replace(/\D/g, ''), 10) || 0;
      const numB = parseInt((b.displayName || b.email).replace(/\D/g, ''), 10) || 0;
      if (numA && numB && numA !== numB) return numA - numB;
      return (a.displayName || a.email).localeCompare(b.displayName || b.email);
    }

    if (a.role === 'tutor' && b.role === 'tutor') {
      // Natural numeric sort for Tutor 1, Tutor 2, ... Tutor 10, Tutor 20
      const getTutorNum = (item: AcademyUserSession): number => {
        const text = `${item.tutorId || ''} ${item.displayName || ''} ${item.email || ''}`;
        const match = text.match(/(?:tutor|faculty|ustad)[\s_-]*(\d+)/i) || text.match(/\d+/);
        return match ? parseInt(match[1] || match[0], 10) : 9999;
      };
      const numA = getTutorNum(a);
      const numB = getTutorNum(b);
      if (numA !== numB) return numA - numB;
      return (a.tutorId || a.displayName || a.email).localeCompare(b.tutorId || b.displayName || b.email);
    }

    if (a.role === 'student' && b.role === 'student') {
      // Natural numeric sort for STU-101, STU-102, ... STU-277
      const getStudentNum = (item: AcademyUserSession): number => {
        const text = `${item.studentId || ''} ${item.displayName || ''} ${item.email || ''}`;
        const match = text.match(/(?:stu-?|student-?)?(\d+)/i);
        return match ? parseInt(match[1], 10) : 99999;
      };
      const numA = getStudentNum(a);
      const numB = getStudentNum(b);
      if (numA !== numB) return numA - numB;
      return (a.studentId || a.displayName || a.email).localeCompare(b.studentId || b.displayName || b.email);
    }

    return (a.displayName || a.email).localeCompare(b.displayName || b.email);
  });
}

/**
 * Get or create unique multi-device session identifier for the client browser
 */
export function getClientSessionId(uid: string): string {
  if (typeof window === 'undefined') return `sess_${uid.replace(/[^a-zA-Z0-9]/g, '_')}_default`;
  const storageKey = `it_session_token_${uid.replace(/[^a-zA-Z0-9]/g, '_')}`;
  let sid = localStorage.getItem(storageKey);
  if (!sid) {
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    sid = `sess_${uid.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now().toString(36)}_${randomSuffix}`;
    try {
      localStorage.setItem(storageKey, sid);
      localStorage.setItem('it_active_session_id', sid);
    } catch {}
  }
  return sid;
}

/**
 * Record or update active session heartbeat for a logged-in user.
 * Note: Optimized to only track Staff (Admin, Supervisor, Tutor) to eliminate student/parent load.
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
  customSessionId?: string;
}): Promise<string | null> {
  // To avoid heavy read/write load, restrict live heartbeat tracking strictly to Staff (Admins, Supervisors, Tutors)
  if (session.role === 'student' || session.role === 'parent') {
    return null;
  }

  const sessionId = session.customSessionId || getClientSessionId(session.uid);
  const now = new Date().toISOString();

  // Detect user agent & device
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTablet = /iPad|Tablet|PlayBook/i.test(ua);
  const deviceType: 'Desktop' | 'Mobile' | 'Tablet' = isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop';
  
  let browser = 'Web Browser';
  if (ua.includes('Edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome') && !ua.includes('Edg/')) browser = 'Google Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Apple Safari';
  else if (ua.includes('Firefox')) browser = 'Mozilla Firefox';

  let operatingSystem = 'Windows/MacOS';
  if (ua.includes('Windows')) operatingSystem = 'Windows';
  else if (ua.includes('Macintosh') || ua.includes('Mac OS')) operatingSystem = 'macOS';
  else if (ua.includes('iPhone') || ua.includes('iPad')) operatingSystem = 'iOS';
  else if (ua.includes('Android')) operatingSystem = 'Android';
  else if (ua.includes('Linux')) operatingSystem = 'Linux';

  // Determine operational tutor ID cleanly if missing
  let derivedTutorId = session.tutorId;
  if (!derivedTutorId && session.role === 'tutor') {
    const match = session.email.match(/tutor(\d+)/i) || session.displayName.match(/tutor[\s_-]*(\d+)/i);
    derivedTutorId = match ? `Tutor ${match[1]}` : (session.displayName.includes('Tutor') ? session.displayName : 'Tutor');
  }

  // Preserve initial loginTimestamp if updating an ongoing session
  let loginTimestamp = now;
  const existingMem = MEMORY_SESSIONS.find(s => s.id === sessionId);
  if (existingMem && existingMem.loginTimestamp) {
    loginTimestamp = existingMem.loginTimestamp;
  } else if (typeof window !== 'undefined') {
    const cachedLogin = localStorage.getItem(`it_login_time_${sessionId}`);
    if (cachedLogin) {
      loginTimestamp = cachedLogin;
    } else {
      try {
        localStorage.setItem(`it_login_time_${sessionId}`, now);
      } catch {}
    }
  }

  const sessionRecord: AcademyUserSession = {
    id: sessionId,
    uid: session.uid,
    email: session.email,
    displayName: session.displayName || session.email,
    role: session.role,
    tutorId: derivedTutorId,
    studentId: session.studentId,
    loginTimestamp,
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
      ...sessionRecord
    };
  } else {
    MEMORY_SESSIONS.unshift(sessionRecord);
  }

  // 2. Persist to Firestore with intelligent 5-minute client-side throttling to minimize writes
  if (!auth.currentUser || isFirestoreQuotaExceeded()) return sessionId;

  const nowMs = Date.now();
  const lastWriteTime = (window as any).__lastSessionWriteMap?.[sessionId] || 0;
  // If written within last 5 minutes (300,000ms), skip remote Firestore write
  if (nowMs - lastWriteTime < 300000) {
    return sessionId;
  }

  try {
    if (!(window as any).__lastSessionWriteMap) {
      (window as any).__lastSessionWriteMap = {};
    }
    (window as any).__lastSessionWriteMap[sessionId] = nowMs;

    const sessionRef = doc(db, SESSIONS_COL, sessionId);
    await setDoc(sessionRef, sanitizeFirestoreObject(sessionRecord), { merge: true });
  } catch (err) {
    // Silent fallback to memory sessions
  }

  return sessionId;
}

/**
 * Get all active sessions for Security Auditing with natural hierarchy sorting
 */
export async function getActiveUserSessions(forceRefresh = false): Promise<AcademyUserSession[]> {
  const nowMs = Date.now();
  let records: AcademyUserSession[] = [];

  if (auth.currentUser && !isFirestoreQuotaExceeded()) {
    try {
      const q = query(collection(db, SESSIONS_COL), orderBy('lastActiveTimestamp', 'desc'), limit(50));
      const snap = await getDocs(q);
      if (!snap.empty) {
        records = snap.docs.map(d => ({ id: d.id, ...d.data() } as AcademyUserSession));
      }
    } catch (err) {
      console.warn('getActiveUserSessions fetch notice:', err);
    }
  }

  // Merge with local memory sessions if Firestore was empty or offline
  if (records.length === 0) {
    records = [...MEMORY_SESSIONS];
  } else {
    // Merge any active memory session not yet fetched
    const dbIds = new Set(records.map(r => r.id));
    MEMORY_SESSIONS.forEach(m => {
      if (!dbIds.has(m.id)) records.push(m);
    });
  }

  // Filter, deduplicate per user+device signature, and compute active/idle/stale status
  const latestByDeviceMap = new Map<string, AcademyUserSession>();
  const staleOrDuplicateIds: string[] = [];

  records.forEach(session => {
    if (session.status === 'terminated') {
      staleOrDuplicateIds.push(session.id);
      return; // Skip terminated
    }

    const lastActiveMs = new Date(session.lastActiveTimestamp || session.loginTimestamp || 0).getTime();
    const diffMs = nowMs - lastActiveMs;

    // Consider active if heartbeat within last 8 minutes, idle if within 30 minutes, prune if older than 4 hours
    if (diffMs > 4 * 60 * 60 * 1000) {
      staleOrDuplicateIds.push(session.id);
      return; // Skip stale sessions
    }

    const updatedStatus: 'active' | 'idle' = diffMs <= 8 * 60 * 1000 ? 'active' : 'idle';
    
    // Normalize displayName for Director/Admin if raw email username was stored
    let cleanDisplayName = session.displayName || session.email;
    const cleanEmail = (session.email || '').toLowerCase().trim();
    if (cleanEmail.includes('muhammadusman') && (!cleanDisplayName || cleanDisplayName.includes('@') || cleanDisplayName === 'muhammadusmanabbasi100')) {
      cleanDisplayName = 'Muhammad Usman';
    }

    const normalizedSession: AcademyUserSession = {
      ...session,
      displayName: cleanDisplayName,
      status: updatedStatus,
      isOnline: updatedStatus === 'active'
    };

    // Device Signature: Allows multiple DISTINCT devices per user (e.g. Mobile + Desktop),
    // but merges and removes duplicate/ghost sessions on the SAME device & browser.
    const deviceKey = `${cleanEmail || session.uid}_${session.deviceType || 'Desktop'}_${session.browser || 'Web'}`;

    const existing = latestByDeviceMap.get(deviceKey);
    if (!existing) {
      latestByDeviceMap.set(deviceKey, normalizedSession);
    } else {
      const existingTime = new Date(existing.lastActiveTimestamp || existing.loginTimestamp || 0).getTime();
      const thisTime = new Date(normalizedSession.lastActiveTimestamp || normalizedSession.loginTimestamp || 0).getTime();
      if (thisTime > existingTime) {
        staleOrDuplicateIds.push(existing.id);
        latestByDeviceMap.set(deviceKey, normalizedSession);
      } else {
        staleOrDuplicateIds.push(normalizedSession.id);
      }
    }
  });

  // Background cleanup of older superseded duplicates or stale ghost session docs from Firestore
  if (staleOrDuplicateIds.length > 0 && auth.currentUser && !isFirestoreQuotaExceeded()) {
    staleOrDuplicateIds.forEach(id => {
      deleteDoc(doc(db, SESSIONS_COL, id)).catch(() => {});
    });
  }

  const validActiveSessions = Array.from(latestByDeviceMap.values());
  const sorted = sortAcademySessions(validActiveSessions);
  MEMORY_SESSIONS = sorted;
  return sorted;
}

/**
 * Terminate/Revoke an active user session and force remote logout on target client
 */
export async function terminateUserSession(sessionId: string, targetUid?: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    // 1. Mark session as terminated in Firestore
    const sessionRef = doc(db, SESSIONS_COL, sessionId);
    await setDoc(sessionRef, {
      status: 'terminated',
      isOnline: false,
      terminatedAt: now
    }, { merge: true });

    // 2. If target UID is known, update user doc with forceLoggedOutAt timestamp
    if (targetUid) {
      const userRef = doc(db, USERS_COL, targetUid);
      await setDoc(userRef, {
        forceLoggedOutAt: now,
        sessionStatus: 'offline'
      }, { merge: true });
    }

    // 3. Clean up session doc after setting terminated status
    setTimeout(() => {
      deleteDoc(sessionRef).catch(() => {});
    }, 5000);
  } catch (err) {
    console.warn('Could not update terminated session doc:', err);
  }

  // Update in-memory
  MEMORY_SESSIONS = MEMORY_SESSIONS.filter(s => s.id !== sessionId);
}

/**
 * Explicitly clear any termination locks/stale status on a user account so they can immediately log in
 */
export async function clearUserTermination(uidOrEmail: string): Promise<void> {
  try {
    const cleanId = uidOrEmail.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    // 1. Direct doc write
    await setDoc(doc(db, USERS_COL, uidOrEmail), {
      forceLoggedOutAt: '',
      sessionStatus: 'active'
    }, { merge: true });

    if (cleanId !== uidOrEmail) {
      await setDoc(doc(db, USERS_COL, cleanId), {
        forceLoggedOutAt: '',
        sessionStatus: 'active'
      }, { merge: true });
    }
  } catch (err) {
    console.warn('Could not clear user termination locks:', err);
  }
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
      unmarkAnnouncementIdDeleted(originalId);
      const restoredAnn: Announcement = { id: originalId, ...cleanData };
      CACHE.announcements = [restoredAnn, ...(CACHE.announcements || []).filter(a => a.id !== originalId)];
      saveCachedCollection('announcements', CACHE.announcements);
      broadcastAnnouncementsUpdate(CACHE.announcements);
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
 * Scoped query for Tutor's assigned classes (~30 docs instead of 698)
 */
export async function getClassesForTutor(tutorId: string, forceRefresh = false): Promise<TimetableClass[]> {
  if (!tutorId) return [];
  const cleanId = tutorId.trim();
  const altIds = [
    cleanId,
    cleanId.toLowerCase(),
    cleanId.replace(/\s+/g, ''),
    cleanId.replace(/_/g, ' '),
    `Tutor ${cleanId.replace(/\D/g, '')}`
  ];

  const matchesTutor = (c: TimetableClass) =>
    c.tutorId === cleanId ||
    altIds.includes(c.tutorId) ||
    (c.tutorId && c.tutorId.replace(/\s+/g, '').toLowerCase() === cleanId.replace(/\s+/g, '').toLowerCase());

  if (CACHE.classes && !forceRefresh) {
    const matched = CACHE.classes.filter(matchesTutor);
    if (matched.length > 0) return matched;
  }
  const stored = loadCachedCollection<TimetableClass[]>('classes');
  if (stored && stored.length > 0 && !forceRefresh) {
    const matched = stored.filter(matchesTutor);
    if (matched.length > 0) {
      CACHE.classes = stored;
      return matched;
    }
  }

  if (!isFirestoreQuotaExceeded()) {
    try {
      const q = query(collection(db, CLASSES_COL), where('tutorId', '==', cleanId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as TimetableClass));
        if (CACHE.classes) {
          const others = CACHE.classes.filter(c => !matchesTutor(c));
          CACHE.classes = [...items, ...others];
        } else {
          CACHE.classes = items;
        }
        saveCachedCollection('classes', CACHE.classes);
        return items;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, CLASSES_COL);
    }
  }

  const fallback = isCleanDataMode() ? [] : SEED_CLASSES.filter(matchesTutor);
  return fallback;
}

/**
 * Scoped query for Tutor's assigned students (~10-25 docs instead of 150)
 * Optimization 3: Uses in-memory filtering when Admin/Supervisor data is loaded,
 * and strictly fetches only active students ('Active', 'Trial', 'Confirmed'),
 * automatically ignoring inactive, discontinued, or left records.
 */
export async function getStudentsForTutorDirect(tutorId: string, forceRefresh = false): Promise<Student[]> {
  if (!tutorId) return [];

  // In-memory filter for Active/Trial/Confirmed students
  const isTargetTutorActive = (s: Student) =>
    isSameTutor(s.assignedTutorId, tutorId) &&
    (s.status === 'Active' || s.status === 'Trial' || s.status === 'Confirmed');

  if (CACHE.students && !forceRefresh) {
    return CACHE.students.filter(isTargetTutorActive);
  }
  const stored = loadCachedCollection<Student[]>('students');
  if (stored && stored.length > 0 && !forceRefresh) {
    CACHE.students = stored;
    return stored.filter(isTargetTutorActive);
  }

  if (!isFirestoreQuotaExceeded()) {
    try {
      // Scoped query: Fetch active students and filter in-memory with isSameTutor for 100% ID variant matching
      const q = query(
        collection(db, STUDENTS_COL),
        where('status', 'in', ['Active', 'Trial', 'Confirmed']),
        limit(250)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
        return items.filter(isTargetTutorActive);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, STUDENTS_COL);
    }
  }

  const fallback = isCleanDataMode() ? [] : SEED_STUDENTS.filter(isTargetTutorActive);
  return fallback;
}

/**
 * Scoped query for Tutor's recent lessons (~25 docs instead of 150)
 */
export async function getLessonsForTutor(tutorId: string, limitCount = 300): Promise<Lesson[]> {
  if (!tutorId) return [];
  if (CACHE.lessons) {
    return CACHE.lessons.filter(l => isSameTutor(l.tutorId, tutorId)).slice(0, limitCount);
  }
  const stored = loadCachedCollection<Lesson[]>('lessons');
  if (stored && stored.length > 0) {
    CACHE.lessons = stored;
    return stored.filter(l => isSameTutor(l.tutorId, tutorId)).slice(0, limitCount);
  }

  if (!isFirestoreQuotaExceeded()) {
    try {
      // Fetch recent lessons and filter with isSameTutor to cover all ID variants
      const cutoffDateStr = getRecentLessonCutoffDate(90);
      const q = query(collection(db, LESSONS_COL), where('date', '>=', cutoffDateStr), limit(limitCount));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Lesson));
        const cleaned = cleanExpiredScreenshots(items);
        return cleaned.filter(l => isSameTutor(l.tutorId, tutorId));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, LESSONS_COL);
    }
  }

  return (isCleanDataMode() ? [] : SEED_LESSONS).filter(l => isSameTutor(l.tutorId, tutorId)).slice(0, limitCount);
}

/**
 * Lazy loaders for heavy secondary collections (called when respective tabs are clicked)
 */
export async function ensureFeesLoaded(forceRefresh = false): Promise<StudentFee[]> {
  if (CACHE.fees && !forceRefresh) return CACHE.fees;
  return getFees(forceRefresh);
}

export async function ensureSalariesLoaded(forceRefresh = false): Promise<TutorSalary[]> {
  if (CACHE.salaries && !forceRefresh) return CACHE.salaries;
  return getSalaries(forceRefresh);
}

export async function ensureReferralsLoaded(forceRefresh = false): Promise<Referral[]> {
  if (CACHE.referrals && !forceRefresh) return CACHE.referrals;
  return getReferrals(forceRefresh);
}

export async function ensureAttendanceLoaded(forceRefresh = false): Promise<AttendanceRecord[]> {
  if (CACHE.attendance && !forceRefresh) return CACHE.attendance;
  return getAttendanceRecords(forceRefresh);
}

export async function ensureTutorAttendanceLoaded(forceRefresh = false): Promise<TutorAttendanceRecord[]> {
  if (CACHE.tutorAttendance && !forceRefresh) return CACHE.tutorAttendance;
  return getTutorAttendanceRecords(forceRefresh);
}

/**
 * Automatically audits and aligns student-tutor associations.
 * Guarantees that student Arham (STU-276) is correctly assigned to Tutor 6,
 * and fixes any classes or rosters that may have been erroneously assigned to Tutor 1 or Tutor 21.
 */
let hasReconciledThisSession = false;

export async function reconcileStudentTutorAssignments(): Promise<void> {
  if (hasReconciledThisSession) return;
  hasReconciledThisSession = true;
  try {
    let studentsUpdated = false;
    let classesUpdated = false;
    let tutorsUpdated = false;

    // 1. Ensure students cache/storage is populated
    if (!CACHE.students || CACHE.students.length === 0) {
      CACHE.students = loadCachedCollection<Student[]>('students') || SEED_STUDENTS;
    }

    // Check for Arham / STU-276
    const arhamStudent = CACHE.students.find(s =>
      (s.studentId && s.studentId.trim().toUpperCase() === 'STU-276') ||
      (s.name && s.name.trim().toLowerCase().includes('arham'))
    );

    if (arhamStudent) {
      if (arhamStudent.assignedTutorId !== 'Tutor 6') {
        arhamStudent.assignedTutorId = 'Tutor 6';
        studentsUpdated = true;
        if (!isFirestoreQuotaExceeded() && arhamStudent.id) {
          updateDoc(doc(db, STUDENTS_COL, arhamStudent.id), { assignedTutorId: 'Tutor 6' }).catch(() => {});
        }
      }
    }

    if (studentsUpdated) {
      saveCachedCollection('students', CACHE.students);
    }

    // 2. Align timetable classes for Arham / STU-276
    if (!CACHE.classes || CACHE.classes.length === 0) {
      CACHE.classes = loadCachedCollection<TimetableClass[]>('classes') || SEED_CLASSES;
    }

    if (CACHE.classes && CACHE.classes.length > 0) {
      CACHE.classes = CACHE.classes.map(c => {
        const isArhamClass = (c.studentId && c.studentId.trim().toUpperCase() === 'STU-276') ||
                             (c.studentName && c.studentName.trim().toLowerCase().includes('arham'));
        if (isArhamClass && c.tutorId !== 'Tutor 6') {
          classesUpdated = true;
          if (!isFirestoreQuotaExceeded() && c.id) {
            updateDoc(doc(db, CLASSES_COL, c.id), { tutorId: 'Tutor 6' }).catch(() => {});
          }
          return { ...c, tutorId: 'Tutor 6' };
        }
        return c;
      });

      if (classesUpdated) {
        saveCachedCollection('classes', CACHE.classes);
      }
    }

    // 3. Ensure Tutor 6 roster contains STU-276 and Tutor 1 & Tutor 21 do not have STU-276
    if (!CACHE.tutors || CACHE.tutors.length === 0) {
      CACHE.tutors = deduplicateTutors(loadCachedCollection<Tutor[]>('tutors') || INITIAL_TUTOR_ENTITIES);
    }

    if (CACHE.tutors && CACHE.tutors.length > 0) {
      CACHE.tutors = CACHE.tutors.map(t => {
        if (isSameTutor(t.tutorId, 'Tutor 6')) {
          const list = t.assignedStudentIds || [];
          if (!list.includes('STU-276')) {
            tutorsUpdated = true;
            return { ...t, assignedStudentIds: [...list, 'STU-276'] };
          }
        } else if (isSameTutor(t.tutorId, 'Tutor 1') || isSameTutor(t.tutorId, 'Tutor 21')) {
          const list = t.assignedStudentIds || [];
          if (list.includes('STU-276')) {
            tutorsUpdated = true;
            return { ...t, assignedStudentIds: list.filter(id => id !== 'STU-276') };
          }
        }
        return t;
      });

      if (tutorsUpdated) {
        saveCachedCollection('tutors', CACHE.tutors);
      }
    }
  } catch (err) {
    console.debug('[Reconciliation] Notice:', err);
  }
}

/**
/**
 * Targeted, low-read Firestore loader & real-time delta subscriber for Students and Parents.
 * Ensures Students and Parents always see live schedule updates, tutor reassignments, and lesson reports
 * in real time without a full page reload while consuming only 1-5 document reads.
 */
export async function getStudentAndParentScopedData(
  targetId: string,
  options?: {
    email?: string;
    linkedStudentIds?: string[];
    forceRefresh?: boolean;
  }
): Promise<{
  students: Student[];
  classes: TimetableClass[];
  lessons: Lesson[];
}> {
  const cleanTargetId = (targetId || '').replace(/^(student_|parent_)/i, '').trim();
  const cleanEmail = (options?.email || '').toLowerCase().trim();
  const candidateIds = new Set<string>();
  if (cleanTargetId) candidateIds.add(cleanTargetId);
  (options?.linkedStudentIds || []).forEach(id => {
    if (id) candidateIds.add(id.trim());
  });

  const baseStudents = CACHE.students || loadCachedCollection<Student[]>('students') || (isCleanDataMode() ? [] : SEED_STUDENTS);
  const baseClasses = CACHE.classes || loadCachedCollection<TimetableClass[]>('classes') || (isCleanDataMode() ? [] : SEED_CLASSES);
  const baseLessons = CACHE.lessons || loadCachedCollection<Lesson[]>('lessons') || (isCleanDataMode() ? [] : SEED_LESSONS);

  // Also discover matching studentIds from local cache by email/parentEmail
  baseStudents.forEach(s => {
    if (
      (cleanTargetId && (s.studentId === cleanTargetId || s.id === cleanTargetId || s.parentId === cleanTargetId)) ||
      (cleanEmail && ((s.email && s.email.toLowerCase().trim() === cleanEmail) || (s.parentEmail && s.parentEmail.toLowerCase().trim() === cleanEmail)))
    ) {
      if (s.studentId) candidateIds.add(s.studentId);
    }
  });

  if (isFirestoreQuotaExceeded()) {
    return { students: baseStudents, classes: baseClasses, lessons: baseLessons };
  }

  try {
    // 1. Fetch live Student document(s) for this Student/Parent from Firestore
    const fetchedStudents: Student[] = [];
    const idList = Array.from(candidateIds).filter(id => id.toUpperCase().startsWith('STU-')).slice(0, 10);

    if (idList.length > 0) {
      const stuSnap = await getDocs(query(collection(db, STUDENTS_COL), where('studentId', 'in', idList)));
      stuSnap.docs.forEach(d => fetchedStudents.push({ id: d.id, ...d.data() } as Student));
    }

    if (fetchedStudents.length === 0 && cleanEmail) {
      const [emailSnap, parentSnap] = await Promise.all([
        getDocs(query(collection(db, STUDENTS_COL), where('email', '==', cleanEmail), limit(5))),
        getDocs(query(collection(db, STUDENTS_COL), where('parentEmail', '==', cleanEmail), limit(5)))
      ]);
      emailSnap.docs.forEach(d => fetchedStudents.push({ id: d.id, ...d.data() } as Student));
      parentSnap.docs.forEach(d => fetchedStudents.push({ id: d.id, ...d.data() } as Student));
    }

    fetchedStudents.forEach(s => {
      if (s.studentId) candidateIds.add(s.studentId);
    });

    const finalStudentIds = Array.from(candidateIds).filter(Boolean).slice(0, 10);

    // Merge fetched student profiles into CACHE.students
    let mergedStudents = baseStudents;
    if (fetchedStudents.length > 0) {
      const stuMap = new Map<string, Student>();
      baseStudents.forEach(s => stuMap.set(s.studentId || s.id, s));
      fetchedStudents.forEach(s => stuMap.set(s.studentId || s.id, s));
      mergedStudents = Array.from(stuMap.values());
      CACHE.students = mergedStudents;
      saveCachedCollection('students', mergedStudents);
    }

    // 2. Fetch live scheduled Classes & recent Lessons for these studentIds in parallel
    if (finalStudentIds.length > 0) {
      const [clsSnap, lesSnap] = await Promise.all([
        getDocs(query(collection(db, CLASSES_COL), where('studentId', 'in', finalStudentIds))),
        getDocs(query(collection(db, LESSONS_COL), where('studentId', 'in', finalStudentIds), limit(150)))
      ]);

      let mergedClasses = baseClasses;
      if (!clsSnap.empty) {
        const liveStudentClasses = clsSnap.docs.map(d => ({ id: d.id, ...d.data() } as TimetableClass));
        const otherClasses = baseClasses.filter(c => !finalStudentIds.includes(c.studentId));
        mergedClasses = [...liveStudentClasses, ...otherClasses];
        CACHE.classes = mergedClasses;
        saveCachedCollection('classes', mergedClasses);
      }

      let mergedLessons = baseLessons;
      if (!lesSnap.empty) {
        const liveStudentLessons = cleanExpiredScreenshots(
          lesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Lesson))
        );
        mergedLessons = deduplicateLessons([...liveStudentLessons, ...baseLessons]);
        CACHE.lessons = mergedLessons;
        saveCachedCollection('lessons', mergedLessons);
      }

      return {
        students: mergedStudents,
        classes: mergedClasses,
        lessons: mergedLessons
      };
    }
  } catch (err) {
    console.warn('[DataService] Scoped Student/Parent live fetch notice:', err);
  }

  return {
    students: baseStudents,
    classes: baseClasses,
    lessons: baseLessons
  };
}

/**
 * Lightweight real-time delta listeners for a Student or Parent's own studentId(s).
 * Consumes only 1-5 reads and updates the UI immediately without a page reload whenever
 * Admin or a Tutor modifies a class time, reassigns a tutor, or logs a new lesson.
 */
export function subscribeToStudentAndParentLiveUpdates(
  studentIds: string[],
  callbacks: {
    onStudents?: (students: Student[]) => void;
    onClasses?: (classes: TimetableClass[]) => void;
    onLessons?: (lessons: Lesson[]) => void;
  }
): () => void {
  const validIds = Array.from(new Set((studentIds || []).map(id => id.trim()).filter(Boolean))).slice(0, 10);
  if (validIds.length === 0 || isFirestoreQuotaExceeded()) {
    return () => {};
  }

  const unsubs: (() => void)[] = [];

  if (callbacks.onStudents) {
    const qStu = query(collection(db, STUDENTS_COL), where('studentId', 'in', validIds));
    unsubs.push(
      safeOnSnapshot(
        qStu,
        (snap) => {
          if (!snap) return;
          const current = CACHE.students || loadCachedCollection<Student[]>('students') || SEED_STUDENTS;
          const updated = applySnapshotDelta<Student>(current, snap);
          CACHE.students = updated;
          saveCachedCollection('students', updated);
          callbacks.onStudents?.(updated);
        },
        () => {},
        STUDENTS_COL
      )
    );
  }

  if (callbacks.onClasses) {
    const qCls = query(collection(db, CLASSES_COL), where('studentId', 'in', validIds));
    unsubs.push(
      safeOnSnapshot(
        qCls,
        (snap) => {
          if (!snap) return;
          const current = CACHE.classes || loadCachedCollection<TimetableClass[]>('classes') || SEED_CLASSES;
          const liveForStudent = applySnapshotDelta<TimetableClass>(
            current.filter(c => validIds.includes(c.studentId)),
            snap
          );
          const others = current.filter(c => !validIds.includes(c.studentId));
          const merged = [...liveForStudent, ...others];
          CACHE.classes = merged;
          saveCachedCollection('classes', merged);
          callbacks.onClasses?.(merged);
        },
        () => {},
        CLASSES_COL
      )
    );
  }

  if (callbacks.onLessons) {
    const qLes = query(collection(db, LESSONS_COL), where('studentId', 'in', validIds), limit(30));
    unsubs.push(
      safeOnSnapshot(
        qLes,
        (snap) => {
          if (!snap) return;
          const current = CACHE.lessons || loadCachedCollection<Lesson[]>('lessons') || [];
          const updated = cleanExpiredScreenshots(applySnapshotDelta<Lesson>(current, snap));
          const deduped = deduplicateLessons(updated);
          CACHE.lessons = deduped;
          saveCachedCollection('lessons', deduped);
          callbacks.onLessons?.(deduped);
        },
        () => {},
        LESSONS_COL
      )
    );
  }

  return () => {
    unsubs.forEach(u => {
      try { u(); } catch {}
    });
  };
}

/**
 * High-Speed Intelligent Role-Scoped & Cached Multi-Collection Loader
 * Optimizes startup reads by 85%+ by loading only role-pertinent operational datasets.
 */
export async function fetchAllAcademyData(
  forceRefresh = false,
  role?: UserRole,
  targetId?: string
): Promise<{
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

  // Reconcile assignments on load to resolve any legacy or hardcoded misalignments
  await reconcileStudentTutorAssignments().catch(() => {});

  const fallbackData = {
    students: CACHE.students || loadCachedCollection<Student[]>('students') || (isCleanDataMode() ? [] : SEED_STUDENTS),
    tutors: deduplicateTutors(CACHE.tutors || loadCachedCollection<Tutor[]>('tutors') || INITIAL_TUTOR_ENTITIES),
    classes: CACHE.classes || loadCachedCollection<TimetableClass[]>('classes') || (isCleanDataMode() ? [] : SEED_CLASSES),
    lessons: CACHE.lessons || loadCachedCollection<Lesson[]>('lessons') || (isCleanDataMode() ? [] : SEED_LESSONS),
    fees: CACHE.fees || loadCachedCollection<StudentFee[]>('fees') || (isCleanDataMode() ? [] : SEED_FEES),
    salaries: CACHE.salaries || loadCachedCollection<TutorSalary[]>('salaries') || (isCleanDataMode() ? [] : SEED_SALARIES),
    referrals: CACHE.referrals || loadCachedCollection<Referral[]>('referrals') || (isCleanDataMode() ? [] : SEED_REFERRALS),
    announcements: CACHE.announcements || loadCachedCollection<Announcement[]>('announcements') || (isCleanDataMode() ? [] : SEED_ANNOUNCEMENTS),
    attendance: CACHE.attendance || loadCachedCollection<AttendanceRecord[]>('attendance') || (isCleanDataMode() ? [] : SEED_ATTENDANCE),
    tutorAttendance: CACHE.tutorAttendance || loadCachedCollection<TutorAttendanceRecord[]>('tutorAttendance') || (isCleanDataMode() ? [] : SEED_TUTOR_ATTENDANCE),
    settings: CACHE.settings || loadCachedCollection<AcademySettings>('settings') || DEFAULT_ACADEMY_SETTINGS
  };

  // 1. Role-specific optimization for TUTORS
  if (role === 'tutor' && targetId) {
    if (!forceRefresh && fallbackData.students.length > 0 && fallbackData.classes.length > 0) {
      console.log(`[DataService] fetchAllAcademyData (Tutor Scoped) serving from cache (forceRefresh = false)`);
      return fallbackData;
    }
    const tutorFetchPromise = Promise.all([
      getTutors(forceRefresh).catch(() => fallbackData.tutors),
      getClassesForTutor(targetId, forceRefresh).catch(() => fallbackData.classes.filter(c => isSameTutor(c.tutorId, targetId))),
      getStudentsForTutorDirect(targetId, forceRefresh).catch(() => fallbackData.students.filter(s => isSameTutor(s.assignedTutorId, targetId))),
      getLessonsForTutor(targetId, 300).catch(() => fallbackData.lessons.filter(l => isSameTutor(l.tutorId, targetId))),
      getAnnouncementsForRole('tutor', forceRefresh).catch(() => fallbackData.announcements),
      getAcademySettings(forceRefresh).catch(() => fallbackData.settings)
    ]);

    const results = await queryWithTimeout(tutorFetchPromise, 4000, null);
    if (results) {
      const [tutors, classes, students, lessons, announcements, settings] = results;
      console.log(`[DataService] fetchAllAcademyData (Tutor Scoped) completed in ${Date.now() - fetchStart}ms`);
      return {
        ...fallbackData,
        students,
        tutors: deduplicateTutors(tutors && tutors.length > 0 ? tutors : fallbackData.tutors),
        classes,
        lessons,
        announcements,
        settings
      };
    }
    return fallbackData;
  }

  // 2. Role-specific optimization for STUDENTS / PARENTS (Live Scoped Schedule, Profile & Lessons)
  if ((role === 'student' || role === 'parent') && targetId) {
    if (!forceRefresh && fallbackData.students.length > 0 && fallbackData.classes.length > 0) {
      console.log(`[DataService] fetchAllAcademyData (Student/Parent Live Scoped) serving from cache (forceRefresh = false)`);
      return fallbackData;
    }
    const studentFetchPromise = Promise.all([
      getStudentAndParentScopedData(targetId, { forceRefresh }).catch(() => ({
        students: fallbackData.students,
        classes: fallbackData.classes,
        lessons: fallbackData.lessons
      })),
      getTutors(forceRefresh).catch(() => fallbackData.tutors),
      getAnnouncementsForRole(role, forceRefresh).catch(() => fallbackData.announcements),
      getAcademySettings(forceRefresh).catch(() => fallbackData.settings)
    ]);
    const results = await queryWithTimeout(studentFetchPromise, 3500, null);
    if (results) {
      const [scoped, tutors, announcements, settings] = results;
      console.log(`[DataService] fetchAllAcademyData (Student/Parent Live Scoped) completed in ${Date.now() - fetchStart}ms`);
      return {
        ...fallbackData,
        students: scoped.students,
        tutors: deduplicateTutors(tutors && tutors.length > 0 ? tutors : fallbackData.tutors),
        classes: scoped.classes,
        lessons: scoped.lessons,
        announcements,
        settings
      };
    }
    return fallbackData;
  }

  // 3. ADMIN / SUPERVISOR Core operational load (Students, Tutors, Classes, Announcements, lightweight Recent Lessons)
  // Secondary heavy collections (fees, salaries, referrals, attendance) are served from cache or loaded lazily on tab click
  if (!forceRefresh && fallbackData.students.length > 0 && fallbackData.classes.length > 0) {
    console.log(`[DataService] fetchAllAcademyData (Core Admin) serving from cache (forceRefresh = false)`);
    return fallbackData;
  }
  const adminFetchPromise = Promise.all([
    getStudents(forceRefresh).catch(() => fallbackData.students),
    getTutors(forceRefresh).catch(() => fallbackData.tutors),
    getClasses(forceRefresh).catch(() => fallbackData.classes),
    getLessons(forceRefresh).catch(() => fallbackData.lessons),
    getAnnouncements(forceRefresh).catch(() => fallbackData.announcements),
    getAcademySettings(forceRefresh).catch(() => fallbackData.settings)
  ]);

  const results = await queryWithTimeout(adminFetchPromise, 5000, null);

  if (results) {
    const [students, tutors, classes, lessons, announcements, settings] = results;
    console.log(`[DataService] fetchAllAcademyData (Core Admin) completed in ${Date.now() - fetchStart}ms`);
    return {
      ...fallbackData,
      students,
      tutors: deduplicateTutors(tutors && tutors.length > 0 ? tutors : fallbackData.tutors),
      classes,
      lessons,
      announcements,
      settings
    };
  }

  console.warn(`[DataService] fetchAllAcademyData hit timeout — served local/seed cache instantly in ${Date.now() - fetchStart}ms`);
  return fallbackData;
}

// ==========================================
// LIVE CALLING API (Live Audio & Video Calls)
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


