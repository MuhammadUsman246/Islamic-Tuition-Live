import { collection, getDocs, doc, writeBatch, setDoc, query, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { clearInMemoryCache, isFirestoreQuotaExceeded, sanitizeFirestoreObject } from './dataService';
import {
  Tutor,
  Student,
  TimetableClass,
  Lesson,
  StudentFee,
  TutorSalary,
  Referral,
  Announcement,
  AttendanceRecord,
  TutorAttendanceRecord,
  UserProfile,
  ChatMessage
} from '../types';

import { INITIAL_TUTOR_ENTITIES, INITIAL_REGISTERED_TUTORS } from '../data/tutorsData';
import { ALL_INITIAL_STUDENTS, ALL_INITIAL_CLASSES } from '../data/studentsData';

export const DUMMY_USERS_TO_SEED: UserProfile[] = [];

export const SEED_TUTORS: Tutor[] = INITIAL_TUTOR_ENTITIES;
export const SEED_STUDENTS: Student[] = ALL_INITIAL_STUDENTS;
export const SEED_CLASSES: TimetableClass[] = ALL_INITIAL_CLASSES;
export const SEED_LESSONS: Lesson[] = [];
export const SEED_FEES: StudentFee[] = [];
export const SEED_SALARIES: TutorSalary[] = [];
export const SEED_REFERRALS: Referral[] = [];
export const SEED_ATTENDANCE: AttendanceRecord[] = [];
export const SEED_TUTOR_ATTENDANCE: TutorAttendanceRecord[] = [];
export const SEED_MESSAGES: ChatMessage[] = [];
export const SEED_ANNOUNCEMENTS: Announcement[] = [];

export async function ensureDatabaseSeeded(): Promise<void> {
  // 1. If previously seeded on this client/session, return immediately without any network calls
  if (typeof window !== 'undefined' && localStorage.getItem('it_db_seeded_v3')) {
    return;
  }
  if (isFirestoreQuotaExceeded()) {
    return;
  }

  try {
    // 2. Perform a single ultra-lightweight probe (limit 1 = 1 read only)
    const [stuSnap, clsSnap] = await Promise.all([
      getDocs(query(collection(db, 'students'), limit(1))),
      getDocs(query(collection(db, 'classes'), limit(1)))
    ]);

    const needsStudentSeed = stuSnap.empty;
    const needsClassSeed = clsSnap.empty;

    // Both collections already populated in Firestore -> mark client seeded and exit immediately
    if (!needsStudentSeed && !needsClassSeed) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('it_db_seeded_v3', 'true');
      }
      return;
    }

    // 3. Fast Batched Insert for missing collections (at most 2-3 network operations total)
    if (needsStudentSeed) {
      for (let i = 0; i < ALL_INITIAL_STUDENTS.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = ALL_INITIAL_STUDENTS.slice(i, i + 400);
        chunk.forEach(s => {
          batch.set(doc(db, 'students', s.id), sanitizeFirestoreObject(s), { merge: true });
        });
        await batch.commit();
      }
    }

    if (needsClassSeed) {
      for (let i = 0; i < ALL_INITIAL_CLASSES.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = ALL_INITIAL_CLASSES.slice(i, i + 400);
        chunk.forEach(c => {
          batch.set(doc(db, 'classes', c.id), sanitizeFirestoreObject(c), { merge: true });
        });
        await batch.commit();
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('it_db_seeded_v3', 'true');
    }
  } catch (err) {
    console.debug('[SeedData] Initial sync notice:', err);
  }
}

export function isCleanDataMode(): boolean {
  return false;
}

export function setCleanDataMode(_clean: boolean): void {
  if (_clean) {
    localStorage.setItem('it_data_mode', 'clean');
  } else {
    localStorage.removeItem('it_data_mode');
  }
}

export async function reseedAllAcademyData(): Promise<{ success: boolean; count: number; message: string }> {
  return {
    success: true,
    count: 0,
    message: 'System is configured in clean production mode.'
  };
}

export async function clearAllAcademyData(): Promise<{ success: boolean; clearedCount: number; message: string }> {
  console.log("Clearing all records from database...");
  setCleanDataMode(true);
  try {
    clearInMemoryCache();
  } catch (e) {}

  // Clear cached profiles & items from localStorage
  try {
    localStorage.removeItem('it_cached_user_profile');
    localStorage.removeItem('it_active_persona');
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('it_academy_cache_') || k.startsWith('it_chat_cache_'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    // Ignore in non-browser environments
  }

  const collectionsToClear = [
    'classes',
    'lessons',
    'fees',
    'salaries',
    'referrals',
    'attendance',
    'tutor_attendance',
    'messages',
    'announcements',
    'students',
    'tutors',
    'deleted_records'
  ];

  let totalDeleted = 0;

  for (const colName of collectionsToClear) {
    try {
      const snap = await getDocs(collection(db, colName));
      if (!snap.empty) {
        for (let i = 0; i < snap.docs.length; i += 400) {
          const batch = writeBatch(db);
          const chunk = snap.docs.slice(i, i + 400);
          chunk.forEach(d => {
            batch.delete(d.ref);
            totalDeleted++;
          });
          await batch.commit();
        }
      }
    } catch (err) {
      console.warn(`Could not clear collection ${colName}:`, err);
    }
  }

  // Clear non-admin users if needed
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    if (!usersSnap.empty) {
      const usersToDelete = usersSnap.docs.filter(d => {
        const data = d.data();
        const email = (data.email || '').toLowerCase().trim();
        return email !== 'dateandtimecalculator@gmail.com' && email !== 'muhammadusmanabbasi100@gmail.com';
      });

      for (let i = 0; i < usersToDelete.length; i += 400) {
        const userBatch = writeBatch(db);
        const chunk = usersToDelete.slice(i, i + 400);
        chunk.forEach(d => {
          userBatch.delete(d.ref);
          totalDeleted++;
        });
        await userBatch.commit();
      }
    }
  } catch (err) {
    console.warn('Could not clear dummy users:', err);
  }

  return {
    success: true,
    clearedCount: totalDeleted,
    message: `All records cleared. System is completely clean.`
  };
}
