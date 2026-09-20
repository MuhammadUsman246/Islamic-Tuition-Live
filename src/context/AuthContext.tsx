import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  signInWithPopup,
  createUserWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase/config';
import { UserProfile, UserRole } from '../types';
import { INITIAL_REGISTERED_TUTORS } from '../data/tutorsData';
import { ensureDatabaseSeeded } from '../services/seedData';
import { recordUserSessionHeartbeat } from '../services/dataService';

export interface DummyPersona {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  badge: string;
  description: string;
  profile: UserProfile;
}

export const DUMMY_PERSONAS: DummyPersona[] = [];

export const PRESET_USERS: Record<UserRole, UserProfile> = {
  admin: {
    uid: 'admin_user',
    email: 'admin@islamictuition.com',
    displayName: 'Academic Director',
    role: 'admin',
    status: 'active',
    createdAt: new Date().toISOString()
  },
  supervisor: {
    uid: 'supervisor_user',
    email: 'supervisor@islamictuition.com',
    displayName: 'Academic Supervisor',
    role: 'supervisor',
    status: 'active',
    createdAt: new Date().toISOString()
  },
  tutor: {
    uid: 'tutor_user',
    email: 'tutor@islamictuition.com',
    displayName: 'Tutor',
    role: 'tutor',
    status: 'active',
    createdAt: new Date().toISOString()
  },
  student: {
    uid: 'student_user',
    email: 'student@islamictuition.com',
    displayName: 'Student',
    role: 'student',
    status: 'active',
    createdAt: new Date().toISOString()
  },
  parent: {
    uid: 'parent_user',
    email: 'parent@islamictuition.com',
    displayName: 'Parent',
    role: 'parent',
    status: 'active',
    createdAt: new Date().toISOString()
  }
};

export interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  actualRole: UserRole | null;
  adminViewingRole: UserRole | null;
  adminViewingTargetId: string | null;
  activeRole: UserRole | null;
  currentPersonaId: string;
  loading: boolean;
  loginWithEmail: (email: string, pass: string, rememberMe?: boolean) => Promise<void>;
  loginWithEmailOnly: (email: string) => Promise<void>;
  loginWithPersona: (personaId: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  setAdminViewingRole: (role: UserRole | null, targetId?: string | null) => void;
  switchPresetRole: (role: UserRole) => Promise<void>;
  switchPersona: (personaId: string) => Promise<void>;
  checkApprovalStatus: () => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  forceEnterApp: (fallbackProfile?: Partial<UserProfile> | string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Dedicated structured logging helper with timestamps and elapsed time tracking (silent in production)
function authLog(phase: string, message: string, details?: any) {
  if (import.meta.env.PROD) return;
  const time = new Date().toISOString().slice(11, 23);
  if (details !== undefined) {
    console.log(`%c[AuthContext ${time}] [${phase}] ${message}`, 'color: #2D8B5C; font-weight: bold;', details);
  } else {
    console.log(`%c[AuthContext ${time}] [${phase}] ${message}`, 'color: #2D8B5C; font-weight: bold;');
  }
}

function authWarn(phase: string, message: string, err?: any) {
  if (import.meta.env.PROD) return;
  const time = new Date().toISOString().slice(11, 23);
  if (err !== undefined) {
    console.warn(`%c[AuthContext ${time}] [${phase}] ⚠️ ${message}`, 'color: #E65100; font-weight: bold;', err);
  } else {
    console.warn(`%c[AuthContext ${time}] [${phase}] ⚠️ ${message}`, 'color: #E65100; font-weight: bold;');
  }
}

export const isAcademicOwner = (emailStr?: string | null): boolean => {
  if (!emailStr) return false;
  const lower = emailStr.toLowerCase().trim();
  return (
    lower === 'dateandtimecalculator@gmail.com' ||
    lower === 'muhammadusmanabbasi100@gmail.com' ||
    lower.includes('admin')
  );
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    // Synchronously preload from localStorage to prevent initial screen flickering
    try {
      const cached = localStorage.getItem('it_cached_user_profile');
      if (cached) {
        return JSON.parse(cached) as UserProfile;
      }
    } catch {}
    return null;
  });
  const [adminViewingRole, setAdminViewingRoleState] = useState<UserRole | null>(null);
  const [adminViewingTargetId, setAdminViewingTargetId] = useState<string | null>(null);
  const [currentPersonaId, setCurrentPersonaId] = useState<string>('admin_owner');
  const [loading, setLoading] = useState<boolean>(true);

  const actualRole: UserRole | null = userProfile?.role || null;
  // Effective role: allows admin inspection, AND allows dual parent/student users to toggle roles
  const activeRole: UserRole | null = (adminViewingRole && (actualRole === 'admin' || actualRole === 'parent' || actualRole === 'student'))
    ? adminViewingRole
    : actualRole;

  // Timeout helper to prevent any Firestore read/write from hanging indefinitely
  const withTimeout = async <T,>(promise: Promise<T>, ms: number = 1000, fallbackVal: T | null = null): Promise<T | null> => {
    let timeoutId: any;
    const timeoutPromise = new Promise<T | null>((resolve) => {
      timeoutId = setTimeout(() => {
        resolve(fallbackVal);
      }, ms);
    });
    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId);
      return result !== null ? (result as T) : fallbackVal;
    } catch (err) {
      clearTimeout(timeoutId);
      return fallbackVal;
    }
  };

  /**
   * Direct, infallible bypass to immediately exit any loading state and enter dashboard.
   */
  const forceEnterApp = (fallbackProfile?: Partial<UserProfile> | string) => {
    authLog('Bypass', 'forceEnterApp invoked');
    let targetProfile: UserProfile;

    if (typeof fallbackProfile === 'string') {
      const isOwner = isAcademicOwner(fallbackProfile);
      targetProfile = {
        uid: 'user_' + fallbackProfile.replace(/[^a-z0-9]/g, '_'),
        email: fallbackProfile,
        displayName: isOwner ? 'Academic Director (Owner)' : fallbackProfile.split('@')[0],
        role: isOwner ? 'admin' : 'student',
        status: 'active',
        createdAt: new Date().toISOString()
      };
    } else if (fallbackProfile && fallbackProfile.email) {
      targetProfile = {
        uid: fallbackProfile.uid || 'user_bypass',
        email: fallbackProfile.email,
        displayName: fallbackProfile.displayName || 'Academic Director',
        role: fallbackProfile.role || 'admin',
        status: fallbackProfile.status || 'active',
        createdAt: new Date().toISOString(),
        ...fallbackProfile
      };
    } else if (userProfile) {
      targetProfile = userProfile;
    } else {
      // Default to Academic Director Admin
      targetProfile = {
        uid: 'auth_owner_admin',
        email: 'muhammadusmanabbasi100@gmail.com',
        displayName: 'Academic Director (Owner)',
        role: 'admin',
        status: 'active',
        createdAt: new Date().toISOString()
      };
    }

    try {
      localStorage.setItem('it_cached_user_profile', JSON.stringify(targetProfile));
    } catch {}

    setUserProfile(targetProfile);
    setLoading(false);
    authLog('Bypass', 'Dashboard unlocked immediately with profile:', targetProfile.email);
  };

  // Auth state listener for initial session loading
  useEffect(() => {
    let isMounted = true;
    const startTime = Date.now();
    authLog('Init', 'Initializing Firebase Auth state listener...');

    // Failsafe timer to guarantee loading state turns false within 1.5 seconds max
    const failsafeTimer = setTimeout(() => {
      if (isMounted) {
        authWarn('Failsafe', `1.5s timer expired — enforcing loading = false (Elapsed: ${Date.now() - startTime}ms)`);
        setLoading(false);
      }
    }, 1500);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;
      const authEventElapsed = Date.now() - startTime;
      authLog('AuthStateChanged', `Firebase Auth event received after ${authEventElapsed}ms:`, user ? { uid: user.uid, email: user.email } : 'No active session');
      
      setCurrentUser(user);

      if (user) {
        try {
          const isOwnerAdmin = isAcademicOwner(user.email);
          let loadedProf: UserProfile | null = null;

          // 1. Check doc by uid with strict 800ms timeout
          authLog('ProfileFetch', `[1/4] Fetching Firestore doc for UID: ${user.uid}...`);
          try {
            const userDocRef = doc(db, 'users', user.uid);
            const snap = await withTimeout(getDoc(userDocRef), 800);
            if (snap && snap.exists()) {
              loadedProf = snap.data() as UserProfile;
              authLog('ProfileFetch', `Found profile by UID (${loadedProf.role}, status: ${loadedProf.status})`);
            }
          } catch (dbErr) {
            authWarn('ProfileFetch', 'UID doc lookup error/timeout:', dbErr);
          }

          // 2. Check doc by email-safe id with strict 800ms timeout
          if (!loadedProf && user.email) {
            authLog('ProfileFetch', `[2/4] Fetching Firestore doc for Email ID: ${user.email}...`);
            try {
              const emailDocId = user.email.replace(/[@.]/g, '_');
              const snap = await withTimeout(getDoc(doc(db, 'users', emailDocId)), 800);
              if (snap && snap.exists()) {
                loadedProf = snap.data() as UserProfile;
                authLog('ProfileFetch', `Found profile by Email ID (${loadedProf.role}, status: ${loadedProf.status})`);
              }
            } catch (dbErr) {
              authWarn('ProfileFetch', 'Email doc lookup error/timeout:', dbErr);
            }
          }

          // 3. Fallback to cached local profile if matching email
          if (!loadedProf) {
            authLog('ProfileFetch', `[3/4] Checking localStorage cache for profile...`);
            const cached = localStorage.getItem('it_cached_user_profile');
            if (cached) {
              try {
                const parsed = JSON.parse(cached) as UserProfile;
                if (!user.email || parsed.email?.toLowerCase() === user.email.toLowerCase()) {
                  loadedProf = parsed;
                  authLog('ProfileFetch', `Loaded profile from localStorage cache:`, loadedProf.email);
                }
              } catch {}
            }
          }

          // 4. Check registered institutional tutors (Tutor 1 - Tutor 19)
          if (!loadedProf && user.email) {
            const matchedTutor = INITIAL_REGISTERED_TUTORS.find(t => t.email.toLowerCase() === user.email?.toLowerCase());
            if (matchedTutor) {
              loadedProf = {
                uid: user.uid,
                email: matchedTutor.email,
                displayName: matchedTutor.displayName,
                role: 'tutor',
                status: 'active',
                tutorId: matchedTutor.tutorId,
                phone: matchedTutor.phone,
                country: 'Pakistan',
                timezone: 'Asia/Karachi',
                createdAt: new Date().toISOString()
              };
              authLog('ProfileFetch', `Matched registered tutor: ${matchedTutor.tutorId}`);
            }
          }

          // 5. Check predefined personas
          if (!loadedProf && user.email) {
            authLog('ProfileFetch', `Checking predefined academy personas for: ${user.email}...`);
            const matchedPersona = DUMMY_PERSONAS.find(p => p.email.toLowerCase() === user.email?.toLowerCase());
            if (matchedPersona) {
              loadedProf = { ...matchedPersona.profile, uid: user.uid };
              authLog('ProfileFetch', `Matched preset persona: ${matchedPersona.name}`);
            }
          }

          // 6. Construct fallback active profile if new
          if (!loadedProf) {
            const defaultRole: UserRole = isOwnerAdmin
              ? 'admin'
              : user.email?.includes('tutor') 
                ? 'tutor' 
                : user.email?.includes('supervisor')
                  ? 'supervisor'
                  : 'student';

            loadedProf = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || user.email?.split('@')[0] || (isOwnerAdmin ? 'Academic Director (Owner)' : 'User'),
              role: defaultRole,
              status: 'active',
              createdAt: new Date().toISOString()
            };
            authLog('ProfileFetch', `Constructed fresh fallback profile for: ${loadedProf.email} (Role: ${defaultRole})`);
          }

          if (isOwnerAdmin) {
            loadedProf.role = 'admin';
            loadedProf.status = 'active';
          }

          // Cache and apply immediately to React state
          localStorage.setItem('it_cached_user_profile', JSON.stringify(loadedProf));
          setUserProfile(loadedProf);
          setLoading(false);
          authLog('ProfileApplied', `✅ User profile successfully applied in ${Date.now() - startTime}ms:`, {
            email: loadedProf.email,
            role: loadedProf.role,
            status: loadedProf.status,
            displayName: loadedProf.displayName
          });

          // Save to Firestore in background without blocking
          setDoc(doc(db, 'users', user.uid), loadedProf, { merge: true }).catch(writeErr => {
            authWarn('BackgroundSync', 'Could not persist profile update to Firestore:', writeErr);
          });
        } catch (err) {
          authWarn('ProfileFetch', 'Error fetching user profile in onAuthStateChanged:', err);
          // Safety net fallback
          const isOwner = isAcademicOwner(user.email);
          const fallbackProf: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || (isOwner ? 'Academic Director (Owner)' : 'User'),
            role: isOwner ? 'admin' : 'student',
            status: 'active',
            createdAt: new Date().toISOString()
          };
          localStorage.setItem('it_cached_user_profile', JSON.stringify(fallbackProf));
          setUserProfile(fallbackProf);
          setLoading(false);
        }
      } else {
        // No Firebase Auth user - check if we have a cached testing profile session
        authLog('NoAuthUser', 'No Firebase Auth user detected. Inspecting local cache...');
        const cached = localStorage.getItem('it_cached_user_profile');
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as UserProfile;
            authLog('NoAuthUser', 'Restored offline/cached profile from localStorage:', parsed.email);
            setUserProfile(parsed);
          } catch {
            setUserProfile(null);
            setAdminViewingRoleState(null);
            setAdminViewingTargetId(null);
          }
        } else {
          setUserProfile(null);
          setAdminViewingRoleState(null);
          setAdminViewingTargetId(null);
        }
        setLoading(false);
        authLog('Ready', `Auth state resolution complete in ${Date.now() - startTime}ms (loading = false)`);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(failsafeTimer);
      unsubscribe();
    };
  }, []);

  // Continuous Session Heartbeat for Security Auditing
  useEffect(() => {
    if (userProfile && userProfile.uid) {
      recordUserSessionHeartbeat({
        uid: userProfile.uid,
        email: userProfile.email,
        displayName: userProfile.displayName,
        role: userProfile.role,
        tutorId: userProfile.tutorId,
        studentId: userProfile.studentId
      }).catch(e => console.warn('Heartbeat update notice:', e));

      const interval = setInterval(() => {
        recordUserSessionHeartbeat({
          uid: userProfile.uid,
          email: userProfile.email,
          displayName: userProfile.displayName,
          role: userProfile.role,
          tutorId: userProfile.tutorId,
          studentId: userProfile.studentId
        }).catch(e => console.warn('Heartbeat update notice:', e));
      }, 120000);

      return () => clearInterval(interval);
    }
  }, [userProfile?.uid, userProfile?.role, userProfile?.email]);

  const loginWithEmail = async (email: string, pass: string, rememberMe: boolean = true) => {
    const cleanEmail = email.trim().toLowerCase();
    const loginStart = Date.now();
    authLog('loginWithEmail', `Initiating sign-in for: ${cleanEmail}`);
    if (!cleanEmail) throw new Error('Please enter your email address.');
    if (!pass) throw new Error('Please enter your password.');

    const isOwner = isAcademicOwner(cleanEmail);

    try {
      await withTimeout(setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence), 500);
    } catch (pErr) {
      authWarn('loginWithEmail', 'Auth persistence notice:', pErr);
    }

    let cred: any = null;
    try {
      authLog('loginWithEmail', 'Calling signInWithEmailAndPassword...');
      cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      authLog('loginWithEmail', `signInWithEmailAndPassword succeeded in ${Date.now() - loginStart}ms for UID: ${cred?.user?.uid}`);
    } catch (authErr: any) {
      authWarn('loginWithEmail', `signInWithEmailAndPassword failed (${authErr.code}):`, authErr.message);

      // If user account is not yet created in this Firebase project, auto-register with this password
      if (
        authErr.code === 'auth/user-not-found' ||
        authErr.code === 'auth/invalid-credential' ||
        authErr.code === 'auth/invalid-login-credentials'
      ) {
        try {
          authLog('loginWithEmail', 'Attempting auto-provisioning via createUserWithEmailAndPassword...');
          cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
          authLog('loginWithEmail', `createUserWithEmailAndPassword succeeded for UID: ${cred?.user?.uid}`);
        } catch (createErr: any) {
          authWarn('loginWithEmail', 'createUserWithEmailAndPassword result:', createErr.code);
          if (createErr.code === 'auth/email-already-in-use') {
            throw new Error(
              `The password entered is incorrect for ${cleanEmail}. If you forgot your password or previously signed in with Google, please click "Forgot password?" or "Continue with Google".`
            );
          } else if (createErr.code === 'auth/weak-password') {
            throw new Error('Password must be at least 6 characters.');
          } else {
            throw authErr;
          }
        }
      } else if (authErr.code === 'auth/wrong-password') {
        throw new Error(
          `Incorrect password for ${cleanEmail}. If you forgot your password, please click "Forgot password?".`
        );
      } else if (authErr.code === 'auth/too-many-requests') {
        throw new Error(
          'Too many failed attempts. Please wait a moment or reset your password.'
        );
      } else {
        throw authErr;
      }
    }

    if (cred?.user) {
      const user = cred.user;
      authLog('loginWithEmail', `Resolving user profile for UID: ${user.uid}`);
      let prof: UserProfile | null = null;

      // 1. Fetch user profile from Firestore by UID with 800ms timeout
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const snap = await withTimeout(getDoc(userDocRef), 800);
        if (snap && snap.exists()) {
          prof = snap.data() as UserProfile;
          authLog('loginWithEmail', 'Profile loaded from Firestore by UID');
        }
      } catch (dbErr) {
        authWarn('loginWithEmail', 'Firestore read error on UID:', dbErr);
      }

      // 2. Fetch by email-safe doc id with 800ms timeout
      if (!prof) {
        try {
          const emailDocId = cleanEmail.replace(/[@.]/g, '_');
          const snap = await withTimeout(getDoc(doc(db, 'users', emailDocId)), 800);
          if (snap && snap.exists()) {
            prof = snap.data() as UserProfile;
            authLog('loginWithEmail', 'Profile loaded from Firestore by email ID');
          }
        } catch (e) {
          authWarn('loginWithEmail', 'Firestore read error on email ID:', e);
        }
      }

      // 3. Default profile if not found
      if (!prof) {
        const defaultRole: UserRole = isOwner
          ? 'admin'
          : cleanEmail.includes('tutor')
            ? 'tutor'
            : cleanEmail.includes('supervisor')
              ? 'supervisor'
              : cleanEmail.includes('parent')
                ? 'parent'
                : 'student';

        prof = {
          uid: user.uid,
          email: cleanEmail,
          displayName: user.displayName || cleanEmail.split('@')[0] || (isOwner ? 'Academic Director' : 'User'),
          role: defaultRole,
          status: 'active',
          createdAt: new Date().toISOString()
        };
        authLog('loginWithEmail', `Constructed fresh profile with role: ${defaultRole}`);
      }

      // Ensure Owner is always active admin
      if (isOwner) {
        prof.role = 'admin';
        prof.status = 'active';
      }

      // Save to localStorage and update state immediately (synchronous transition)
      localStorage.setItem('it_cached_user_profile', JSON.stringify(prof));
      setUserProfile(prof);
      setLoading(false);
      authLog('loginWithEmail', `✅ Login complete in ${Date.now() - loginStart}ms: ${prof.email} (${prof.role})`);

      // Save to Firestore in background without blocking UI
      setDoc(doc(db, 'users', user.uid), prof, { merge: true }).catch(writeErr => {
        authWarn('loginWithEmail', 'Background Firestore profile save notice:', writeErr);
      });
    }
  };

  const loginWithGoogle = async () => {
    const googleStart = Date.now();
    authLog('loginWithGoogle', 'Initiating Google sign-in popup...');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      authLog('loginWithGoogle', `Google popup succeeded in ${Date.now() - googleStart}ms for: ${user?.email}`);

      if (user && user.email) {
        const normalizedEmail = user.email.toLowerCase();
        const isOwnerAdmin = isAcademicOwner(normalizedEmail);
        let profile: UserProfile | null = null;

        // Fetch existing profile with 800ms timeout
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const snap = await withTimeout(getDoc(userDocRef), 800);
          if (snap && snap.exists()) {
            profile = snap.data() as UserProfile;
            authLog('loginWithGoogle', 'Existing Firestore profile retrieved');
          }
        } catch (dbErr) {
          authWarn('loginWithGoogle', 'Firestore read error on Google login:', dbErr);
        }

        if (!profile) {
          profile = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0] || 'User',
            role: isOwnerAdmin ? 'admin' : 'student',
            status: 'active',
            createdAt: new Date().toISOString()
          };
          authLog('loginWithGoogle', `Created Google user profile with role: ${profile.role}`);
        }

        if (isOwnerAdmin) {
          profile.role = 'admin';
          profile.status = 'active';
        }

        // Apply immediately and transition loading
        localStorage.setItem('it_cached_user_profile', JSON.stringify(profile));
        setUserProfile(profile);
        setLoading(false);
        authLog('loginWithGoogle', `✅ Google sign-in complete in ${Date.now() - googleStart}ms: ${profile.email}`);

        // Sync to Firestore in background
        setDoc(doc(db, 'users', user.uid), profile, { merge: true }).catch(writeErr => {
          authWarn('loginWithGoogle', 'Background write notice:', writeErr);
        });
      }
    } catch (err: any) {
      authWarn('loginWithGoogle', 'Google sign-in error:', err);
      throw err;
    }
  };

  /**
   * Passwordless / Instant Email Sign-In (Legacy Stub):
   */
  const loginWithEmailOnly = async (_email: string) => {
    throw new Error('Please sign in using your email and password.');
  };

  /**
   * Persona Sign-In (Legacy Stub):
   */
  const loginWithPersona = async (_personaId: string) => {
    throw new Error('Demo personas are disabled in production mode.');
  };

  /**
   * Firebase Auth Password Reset Email
   */
  const resetPassword = async (email: string) => {
    if (!email || !email.trim()) {
      throw new Error('Please enter your email address to receive password reset instructions.');
    }
    authLog('resetPassword', `Dispatching reset email to: ${email.trim()}`);
    await sendPasswordResetEmail(auth, email.trim());
  };

  /**
   * Role Switching / Inspection Mode:
   * - Admins can inspect any role (Supervisor, Tutor, Parent, Student).
   * - Parents and Students can toggle between Parent Mode and Student Mode (e.g. for learning parents).
   */
  const setAdminViewingRole = (role: UserRole | null, targetId?: string | null) => {
    if (actualRole !== 'admin' && actualRole !== 'parent' && actualRole !== 'student') {
      authWarn('RoleSwitch', 'Permission denied: Only Admin, Parent, and Student accounts can switch viewing roles.');
      return;
    }
    // Strict safeguard: Non-admins can ONLY toggle between 'parent' and 'student' (or null for default)
    if (actualRole !== 'admin') {
      if (role !== null && role !== 'student' && role !== 'parent') {
        authWarn('RoleSwitch', 'Permission denied: Parents and Students can only toggle between Parent and Student modes.');
        return;
      }
    }
    authLog('RoleSwitch', `Viewing role updated to: ${role || 'Default'} (${targetId || 'All'})`);
    setAdminViewingRoleState(role);
    setAdminViewingTargetId(targetId || null);
  };

  const switchPersona = async (personaId: string) => {
    if (actualRole !== 'admin') {
      authWarn('RoleSwitch', 'Permission denied: Only Admin accounts can switch viewing roles.');
      return;
    }
    const persona = DUMMY_PERSONAS.find(p => p.id === personaId);
    if (persona) {
      authLog('RoleSwitch', `Switched persona to: ${persona.name}`);
      setAdminViewingRoleState(persona.role);
      setAdminViewingTargetId(persona.profile.tutorId || persona.profile.studentId || null);
      setCurrentPersonaId(persona.id);
    }
  };

  const switchPresetRole = async (role: UserRole) => {
    if (actualRole !== 'admin') {
      authWarn('RoleSwitch', 'Permission denied: Only Admin accounts can switch viewing roles.');
      return;
    }
    authLog('RoleSwitch', `Switched preset role to: ${role}`);
    setAdminViewingRoleState(role);
  };

  const checkApprovalStatus = async () => {
    if (!currentUser) return;
    authLog('checkApprovalStatus', `Checking approval status for UID: ${currentUser.uid}`);
    try {
      const snap = await withTimeout(getDoc(doc(db, 'users', currentUser.uid)), 1000);
      if (snap && snap.exists()) {
        const data = snap.data() as UserProfile;
        authLog('checkApprovalStatus', `Live status: ${data.status}`);
        setUserProfile(data);
        localStorage.setItem('it_cached_user_profile', JSON.stringify(data));
      }
    } catch (err) {
      authWarn('checkApprovalStatus', 'Error refreshing approval status:', err);
    }
  };

  /**
   * Safe user profile update:
   * Allows students/parents to update their personalized profile (avatarUrl, bio, favoriteSurah,
   * quranGoal, hobbies, preferredName, themePreference, dailyGoalMinutes) while preventing unauthorized
   * changes to core administrative/academic fields (role, studentId, tutorId, monthlyFee, status).
   */
  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    if (!userProfile) return;

    // Filter out restricted academic/billing fields for non-admin users
    const safeUpdates = { ...updates };
    if (actualRole !== 'admin') {
      delete safeUpdates.role;
      delete safeUpdates.status;
      delete safeUpdates.studentId;
      delete safeUpdates.tutorId;
      delete safeUpdates.linkedStudentIds;
      delete safeUpdates.customClaims;
      delete safeUpdates.approvedAt;
      delete safeUpdates.approvedBy;
    }

    const updatedProfile: UserProfile = {
      ...userProfile,
      ...safeUpdates
    };

    authLog('updateUserProfile', 'Applying profile updates:', safeUpdates);

    // 1. Immediately update state and local persistence
    setUserProfile(updatedProfile);
    localStorage.setItem('it_cached_user_profile', JSON.stringify(updatedProfile));

    // 2. Sync to Firestore in background
    const targetDocId = currentUser?.uid || userProfile.uid || userProfile.email.replace(/[@.]/g, '_');
    const userDocRef = doc(db, 'users', targetDocId);
    setDoc(userDocRef, safeUpdates, { merge: true }).catch(dbErr => {
      authWarn('updateUserProfile', 'Firestore profile sync note (saved locally):', dbErr);
    });
  };

  const logout = async () => {
    authLog('logout', 'Signing out user session...');
    try {
      await fbSignOut(auth);
    } catch (err) {
      authWarn('logout', 'Sign out notice:', err);
    }
    localStorage.removeItem('it_cached_user_profile');
    setUserProfile(null);
    setCurrentUser(null);
    setAdminViewingRoleState(null);
    setAdminViewingTargetId(null);
    setLoading(false);
    authLog('logout', 'Session cleared successfully.');
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        actualRole,
        adminViewingRole,
        adminViewingTargetId,
        activeRole,
        currentPersonaId,
        loading,
        loginWithEmail,
        loginWithEmailOnly,
        loginWithPersona,
        loginWithGoogle,
        resetPassword,
        setAdminViewingRole,
        switchPresetRole,
        switchPersona,
        checkApprovalStatus,
        updateUserProfile,
        forceEnterApp,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
