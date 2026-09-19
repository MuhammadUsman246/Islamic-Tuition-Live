import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { clearInMemoryCache } from './dataService';
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

export const DUMMY_USERS_TO_SEED: UserProfile[] = [];

export async function ensureDatabaseSeeded(): Promise<void> {
  // Real database mode: no dummy data is seeded
  return;
}

export const SEED_TUTORS: Tutor[] = [];
export const SEED_STUDENTS: Student[] = [];
export const SEED_CLASSES: TimetableClass[] = [];
export const SEED_LESSONS: Lesson[] = [];
export const SEED_FEES: StudentFee[] = [];
export const SEED_SALARIES: TutorSalary[] = [];
export const SEED_REFERRALS: Referral[] = [];
export const SEED_ATTENDANCE: AttendanceRecord[] = [];
export const SEED_TUTOR_ATTENDANCE: TutorAttendanceRecord[] = [];
export const SEED_MESSAGES: ChatMessage[] = [];
export const SEED_ANNOUNCEMENTS: Announcement[] = [];

export function isCleanDataMode(): boolean {
  return true;
}

export function setCleanDataMode(_clean: boolean): void {
  localStorage.setItem('it_data_mode', 'clean');
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
        return email !== 'dateandtimecalculator@gmail.com';
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
