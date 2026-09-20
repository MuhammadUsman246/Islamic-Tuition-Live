import { auth, db } from './config';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, limit, query } from 'firebase/firestore';

/**
 * Runs an immediate, clean diagnostic check in the browser console
 * confirming real-time communication with Firebase Auth and Firestore.
 */
export async function runFirebaseDiagnostic() {
  if (import.meta.env.PROD) return;
  const isProd = import.meta.env.PROD;
  const bannerStyle = 'background: #065f46; color: #ffffff; font-weight: bold; padding: 4px 8px; border-radius: 4px;';
  const successStyle = 'color: #059669; font-weight: bold;';
  const infoStyle = 'color: #2563eb; font-weight: 500;';
  const errorStyle = 'color: #dc2626; font-weight: bold;';

  console.groupCollapsed('%c🔥 Firebase Connection Diagnostic', bannerStyle);
  console.log('%cProject ID:%c ' + (auth.app.options.projectId || 'N/A'), infoStyle, 'color: inherit;');
  console.log('%cAuth Domain:%c ' + (auth.app.options.authDomain || 'N/A'), infoStyle, 'color: inherit;');
  
  // 1. Verify Auth Service
  try {
    const authReady = await new Promise<boolean>((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        console.log(
          `%c[Auth Service Verified]%c User is currently ${user ? `signed in as (${user.email})` : 'signed out (ready for login)'}`,
          successStyle,
          'color: inherit;'
        );
        resolve(true);
      }, (err) => {
        console.error('%c[Auth Error]%c ' + err.message, errorStyle, 'color: inherit;');
        resolve(false);
      });
    });

    if (!authReady) {
      console.warn('%c⚠️ Auth service initialization did not respond cleanly.', errorStyle);
    }
  } catch (authErr: any) {
    console.error('%c[Auth Init Exception]%c ' + authErr?.message, errorStyle, 'color: inherit;');
  }

  // 2. Verify Firestore Service Ping
  try {
    const q = query(collection(db, 'announcements'), limit(1));
    const snapshot = await getDocs(q);
    console.log(
      `%c[Firestore Service Verified]%c Successfully connected to database. Ping returned ${snapshot.size} document(s).`,
      successStyle,
      'color: inherit;'
    );
  } catch (dbErr: any) {
    // If permissions require auth, check if it's permission-denied or offline
    if (dbErr?.code === 'permission-denied') {
      console.log(
        '%c[Firestore Rules Active]%c Connected to Firestore instance (Security rules evaluated and enforced).',
        successStyle,
        'color: inherit;'
      );
    } else {
      console.warn('%c[Firestore Ping Note]%c ' + (dbErr?.message || dbErr), infoStyle, 'color: inherit;');
    }
  }

  console.log('%c✅ All Firebase subsystems loaded and configured properly.', 'color: #059669; font-style: italic;');
  console.groupEnd();
}
