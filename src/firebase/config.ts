import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  setLogLevel,
} from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigData.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigData.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigData.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigData.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigData.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigData.appId,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

try {
  setLogLevel('silent');
} catch (e) {
  // ignore if unsupported
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

const customDbId = import.meta.env.VITE_FIREBASE_DATABASE_ID || (firebaseConfigData as any).firestoreDatabaseId;
const dbId = (customDbId && customDbId !== '(default)') ? customDbId : undefined;

let firestoreInstance;
try {
  let localCache;
  try {
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (typeof window !== 'undefined' && window.indexedDB && !isIframe) {
      localCache = persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      });
    } else {
      localCache = memoryLocalCache();
    }
  } catch {
    localCache = memoryLocalCache();
  }

  const settings: any = {
    localCache,
    experimentalAutoDetectLongPolling: true,
  };

  if (dbId) {
    firestoreInstance = initializeFirestore(app, settings, dbId);
  } else {
    firestoreInstance = initializeFirestore(app, settings);
  }
} catch {
  firestoreInstance = dbId ? getFirestore(app, dbId) : getFirestore(app);
}

export const db = firestoreInstance;

export default app;
