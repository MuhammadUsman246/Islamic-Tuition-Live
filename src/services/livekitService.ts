/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Room,
  RoomEvent,
  VideoPresets,
  Track,
  ConnectionState,
  LocalAudioTrack,
  LocalVideoTrack,
  RemoteParticipant,
  Participant,
  TrackPublication,
  RemoteTrackPublication,
  RemoteTrack,
} from 'livekit-client';
import {
  ClassroomLabSettings,
  LiveKitRoomTokenResponse,
  ClassroomLabTestSession,
  ClassroomRecordingItem,
  UserRole
} from '../types';

export const DEFAULT_CLASSROOM_SETTINGS: ClassroomLabSettings = {
  classroomEnabled: true,
  testModeOnly: false,
  livekitServerUrl: '',
  allowedTestTutorIds: ['Tutor 1', 'Tutor 2', 'Tutor 3', 'Tutor 4', 'Tutor 5', 'Tutor 6', 'Tutor 7', 'Tutor 8', 'all'],
  allowedTestStudentIds: ['STU-001', 'STU-002', 'STU-003', 'STU-004', 'STU-005', 'all'],
  tutorScreenShareEnabled: true,
  tutorCameraPermanentlyDisabled: true, // Permanent rule
  studentCameraEnabled: true,
  studentScreenShareEnabled: false,
  recordingEnabled: false,
  recordingRetentionDays: 3,
  audioQualityPreset: 'speech_optimized',
  classroomTitle: 'Islamic Tuition Live Quran Classroom',
  welcomeMessage: 'Assalamu Alaykum. Welcome to your live 1-to-1 Quran session.',
};

/**
 * Convert any tutor identifier ("Tutor 3", "TUT-003", "room_tutor_3", "tutor-3")
 * into its canonical URL slug (e.g. "tutor-3").
 */
export function getTutorSlug(tutorInput: any): string {
  if (!tutorInput) return 'tutor-1';
  let tutorStr = '';
  if (typeof tutorInput === 'string') {
    tutorStr = tutorInput.trim();
  } else if (typeof tutorInput === 'object') {
    tutorStr = tutorInput.tutorId || tutorInput.id || tutorInput.realName || '';
  }
  if (!tutorStr) return 'tutor-1';

  const numMatch = tutorStr.match(/\d+/);
  if (numMatch) {
    return `tutor-${parseInt(numMatch[0], 10)}`;
  }
  return tutorStr.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tutor-1';
}

/**
 * Convert any tutor identifier ("TUT-003", "tutor-3", "Tutor 3") into a clean display ID ("Tutor 3").
 */
export function getTutorDisplayId(tutorInput: any): string {
  if (!tutorInput) return 'Tutor 1';
  let tutorStr = '';
  if (typeof tutorInput === 'string') {
    tutorStr = tutorInput.trim();
  } else if (typeof tutorInput === 'object') {
    tutorStr = tutorInput.tutorId || tutorInput.id || tutorInput.realName || '';
  }
  if (!tutorStr) return 'Tutor 1';

  const numMatch = tutorStr.match(/\d+/);
  if (numMatch) {
    return `Tutor ${parseInt(numMatch[0], 10)}`;
  }
  return tutorStr;
}

/**
 * Generate a canonical, deterministic LiveKit room name shared between Tutor, Student, Parent & Admin.
 * Every tutor has one permanent canonical classroom (e.g. "room_tutor_1" for Tutor 1 / tutor-1),
 * ensuring Tutors, Students, Parents, Supervisors, Admins, and /class/tutor-X links always meet in the exact same room.
 */
export function getCanonicalRoomName(tutorInput: any, _studentInput?: any, customRoomName?: string): string {
  if (customRoomName && typeof customRoomName === 'string' && customRoomName.trim()) {
    const trimmed = customRoomName.trim();
    // Check if the custom input is actually a tutor slug or ID like "tutor-1" or "Tutor 1" or "TUT-001"
    const tutorMatch = trimmed.match(/^(?:room[_-])?(?:tutor|tut)[_-\s]*(\d+)$/i);
    if (tutorMatch) {
      return `room_tutor_${parseInt(tutorMatch[1], 10)}`;
    }
    return trimmed.replace(/[^a-zA-Z0-9_\-]/g, '_');
  }

  let tutorStr = 'Tutor 1';
  if (typeof tutorInput === 'string' && tutorInput.trim()) {
    tutorStr = tutorInput.trim();
  } else if (tutorInput && typeof tutorInput === 'object') {
    tutorStr = tutorInput.tutorId || tutorInput.id || tutorInput.realName || tutorInput.displayName || 'Tutor 1';
  }

  // Extract tutor number if present (e.g. "Tutor 1", "tutor-1", "TUT-001", "room_tutor_1" -> "room_tutor_1")
  const numMatch = tutorStr.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0], 10);
    return `room_tutor_${num}`;
  }

  const cleanTutor = tutorStr.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `room_tutor_${cleanTutor}`;
}

const CLASSROOM_SETTINGS_STORAGE_KEY = 'it_classroom_lab_settings_v1';
const CLASSROOM_RECORDINGS_STORAGE_KEY = 'it_classroom_recordings_v1';
const CLASSROOM_TEST_SESSIONS_STORAGE_KEY = 'it_classroom_test_sessions_v1';
const CUSTOM_PASSCODES_STORAGE_KEY = 'it_custom_room_passcodes_v1';

const FALLBACK_LIVEKIT_URL = 'wss://islamictuition-xi2wjy78.livekit.cloud';
const FALLBACK_LIVEKIT_KEY = 'APIqXQyD6qsE8Z9';
const FALLBACK_LIVEKIT_SECRET = 'Wwq0zrfUtQ0enffrNpafIPAVkOwgELxxs6WRwhWtO9xE';

function base64UrlEncodeString(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return base64UrlEncodeBytes(bytes);
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * Generates a real RFC-7519 HS256 LiveKit JWT token directly in the browser using WebCrypto.
 * Ensures 100% real LiveKit Cloud connection even on static hosts (e.g. cPanel / Apache .htaccess)
 * where /api/* routes return index.html instead of hitting Node server.ts.
 */
export async function generateBrowserLiveKitToken(params: {
  roomId: string;
  identity: string;
  participantName: string;
  role: UserRole;
  classId?: string;
  customServerUrl?: string;
  isHidden?: boolean;
}): Promise<LiveKitRoomTokenResponse> {
  const cleanRoomName = getCanonicalRoomName(params.roomId, undefined, params.roomId);
  const cleanIdentity = String(params.identity).replace(/[^a-zA-Z0-9_\-]/g, '_');
  const nowSec = Math.floor(Date.now() / 1000);
  const ttlSeconds = 43200; // 12 hours

  const isStealthObserver = Boolean(params.isHidden);
  let canPublishSources: string[] = ['microphone', 'camera', 'screen_share', 'screen_share_audio'];
  if (!isStealthObserver) {
    if (params.role === 'tutor') {
      canPublishSources = ['microphone', 'screen_share', 'screen_share_audio'];
    } else if (params.role === 'student' || params.role === 'guest' || params.role === 'parent') {
      canPublishSources = ['microphone', 'camera'];
    }
  }

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: FALLBACK_LIVEKIT_KEY,
    sub: cleanIdentity,
    name: params.participantName,
    nbf: nowSec - 5,
    exp: nowSec + ttlSeconds,
    metadata: JSON.stringify({ role: params.role, hidden: isStealthObserver }),
    video: isStealthObserver
      ? {
          room: cleanRoomName,
          roomJoin: true,
          canPublish: false,
          canPublishData: false,
          canSubscribe: true,
          hidden: true,
        }
      : {
          room: cleanRoomName,
          roomJoin: true,
          canPublish: true,
          canPublishData: true,
          canSubscribe: true,
          canPublishSources,
        },
  };

  const encodedHeader = base64UrlEncodeString(JSON.stringify(header));
  const encodedPayload = base64UrlEncodeString(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const keyData = new TextEncoder().encode(FALLBACK_LIVEKIT_SECRET);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );
  const encodedSignature = base64UrlEncodeBytes(new Uint8Array(signatureBuffer));
  const jwt = `${signingInput}.${encodedSignature}`;

  return {
    token: jwt,
    serverUrl: (params.customServerUrl || FALLBACK_LIVEKIT_URL).trim(),
    roomName: cleanRoomName,
    participantIdentity: cleanIdentity,
    participantName: params.participantName,
    role: params.role,
    classId: params.classId || null,
    isMockSession: false,
    expiresInSeconds: ttlSeconds,
  };
}

export function getSavedCustomPasscodes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CUSTOM_PASSCODES_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export function saveCustomRoomPasscode(roomSlug: string, passcode: string): void {
  try {
    const current = getSavedCustomPasscodes();
    current[roomSlug.toLowerCase().trim()] = passcode.trim();
    localStorage.setItem(CUSTOM_PASSCODES_STORAGE_KEY, JSON.stringify(current));
  } catch {}
}

export function getDefaultPermanentRooms() {
  const customMap = getSavedCustomPasscodes();
  return Array.from({ length: 25 }, (_, idx) => {
    const num = idx + 1;
    const slug = `tutor-${num}`;
    return {
      id: `perm_room_${num}`,
      room_slug: slug,
      livekit_room_id: `room_tutor_${num}`,
      tutor_id: `Tutor ${num}`,
      meeting_id: 900000000 + num,
      passcode: customMap[slug] || '12345',
    };
  });
}

/**
 * Load classroom settings with resilient local caching (0 unnecessary Firestore reads)
 */
export function getLocalClassroomSettings(): ClassroomLabSettings {
  try {
    const raw = localStorage.getItem(CLASSROOM_SETTINGS_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_CLASSROOM_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Classroom settings local load error:', e);
  }
  return { ...DEFAULT_CLASSROOM_SETTINGS };
}

/**
 * Save classroom settings locally and sync with Firestore if online
 */
export function saveLocalClassroomSettings(settings: ClassroomLabSettings): void {
  try {
    localStorage.setItem(CLASSROOM_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Classroom settings local save error:', e);
  }
}

/**
 * Fetch a secure short-lived LiveKit token from backend server, with automatic
 * real WebCrypto LiveKit Cloud JWT generation when hosted on static servers.
 */
export async function fetchLiveKitToken(params: {
  roomId: string;
  identity: string;
  participantName: string;
  role: UserRole;
  classId?: string;
  customServerUrl?: string;
  forceSimulation?: boolean;
}): Promise<LiveKitRoomTokenResponse> {
  const canonicalRoomId = getCanonicalRoomName(params.roomId, undefined, params.roomId);

  if (params.forceSimulation) {
    return {
      token: `mock_token_${Date.now()}`,
      serverUrl: params.customServerUrl || FALLBACK_LIVEKIT_URL,
      roomName: canonicalRoomId,
      participantIdentity: params.identity,
      participantName: params.participantName,
      role: params.role,
      classId: params.classId || null,
      isMockSession: true,
      expiresInSeconds: 43200,
      message: 'Running in Interactive Lab Simulation Mode.',
    };
  }

  try {
    const response = await fetch('/api/livekit/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, roomId: canonicalRoomId }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (response.ok && data?.token && !data.isMockSession) {
        return {
          ...data,
          roomName: canonicalRoomId,
        };
      }
      if (data && data.error) {
        throw new Error(data.error);
      }
    }
  } catch (err: any) {
    console.warn('[LiveKit Token Notice] Using direct browser WebCrypto token signer:', err?.message || err);
  }

  // Generate a 100% real LiveKit Cloud JWT token directly in browser (never falls back to fake simulation)
  return generateBrowserLiveKitToken({
    ...params,
    roomId: canonicalRoomId,
  });
}

/**
 * Join a tutor's classroom by slug/ID (e.g. "tutor-10", "Tutor 10", "10") and passcode.
 * Works identically on both backend Express server AND static cPanel/.htaccess deployments.
 */
export async function joinClassroomBySlugOrPasscode(params: {
  roomSlug: string;
  passcode?: string;
  sessionUserId?: string;
  userRole?: UserRole;
  guestName?: string;
  admittedWaitingId?: string;
}): Promise<
  | ({ inWaitingRoom: true; waitingId: string; message: string } & Partial<LiveKitRoomTokenResponse>)
  | ({ inWaitingRoom?: false } & LiveKitRoomTokenResponse)
> {
  // Normalize any full URL or slug (e.g. "https://app.islamictuition.us/class/tutor-10" -> "tutor-10")
  let rawSlug = (params.roomSlug || 'tutor-1').trim();
  if (rawSlug.includes('/')) {
    const parts = rawSlug.split('/').filter(Boolean);
    rawSlug = parts[parts.length - 1] || 'tutor-1';
  }
  const cleanSlug = getTutorSlug(rawSlug);
  const canonicalRoomName = getCanonicalRoomName(cleanSlug);

  try {
    const response = await fetch('/api/c/slug-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        roomSlug: cleanSlug,
      }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to join classroom. Please check your Tutor ID or Passcode.');
      }
      if (data.inWaitingRoom) {
        return data;
      }
      if (data.token && !data.isMockSession) {
        return {
          ...data,
          roomName: canonicalRoomName,
        };
      }
    }
  } catch (err: any) {
    // Re-throw explicit passcode errors from backend
    if (err?.message && err.message.toLowerCase().includes('passcode')) {
      throw err;
    }
  }

  // Fallback for static hosting (e.g. app.islamictuition.us with .htaccess):
  // Validate passcode locally for unauthenticated guests, or allow enrolled/staff users directly
  const role: UserRole = params.userRole || 'student';
  const isPrivilegedRole = role === 'admin' || role === 'supervisor' || role === 'tutor';
  const hasLoggedSession = Boolean(params.sessionUserId && params.sessionUserId.trim().length > 0);
  const savedPasscodes = getSavedCustomPasscodes();
  const expectedPasscode = savedPasscodes[cleanSlug] || '12345';
  const submittedPasscode = (params.passcode || '').trim();

  if (!isPrivilegedRole && !hasLoggedSession && submittedPasscode !== expectedPasscode) {
    throw new Error('Invalid 5-Digit Classroom Passcode. Default passcode is 12345.');
  }
  if (!isPrivilegedRole && submittedPasscode && submittedPasscode !== expectedPasscode) {
    throw new Error('Invalid 5-Digit Classroom Passcode.');
  }

  const isStealth = role === 'admin' || role === 'supervisor';
  const identity = `${role}_${params.sessionUserId || 'member'}_${Date.now()}`;
  const participantName = isStealth
    ? `Invisible ${role === 'admin' ? 'Admin' : 'Supervisor'}`
    : (params.guestName || 'Student');

  return generateBrowserLiveKitToken({
    roomId: canonicalRoomName,
    identity,
    participantName,
    role,
    isHidden: isStealth,
  });
}

/**
 * Query backend server LiveKit status (with static-host fallback)
 */
export async function checkLiveKitServerStatus(): Promise<{
  configured: boolean;
  serverUrl: string;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  isMaskedSecret?: boolean;
  secretWarning?: string | null;
  environment: 'livekit_cloud' | 'vps_self_hosted' | 'unconfigured';
}> {
  try {
    const res = await fetch('/api/livekit/status');
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      return await res.json();
    }
  } catch (err) {
    console.warn('LiveKit status probe notice:', err);
  }
  return {
    configured: true,
    serverUrl: FALLBACK_LIVEKIT_URL,
    hasApiKey: true,
    hasApiSecret: true,
    isMaskedSecret: false,
    secretWarning: null,
    environment: 'livekit_cloud',
  };
}

/**
 * Create an optimized LiveKit Room instance calibrated specifically for Quran teaching
 * - Prioritizes crystal-clear speech (high speech clarity, zero robotic stutter)
 * - Optimized screen share for sharp Quranic typography & Tajweed marks
 * - Low-bandwidth adaptive degradation so calls NEVER drop on 4G or school Wi-Fi
 */
export function createOptimizedLiveKitRoom(): Room {
  return new Room({
    adaptiveStream: true,
    dynacast: true,
    stopLocalTrackOnUnpublish: true,
    disconnectOnPageLeave: true,
    audioCaptureDefaults: {
      autoGainControl: true,
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
      sampleRate: 48000,
    },
    videoCaptureDefaults: {
      resolution: {
        width: 640,
        height: 480,
        frameRate: 15,
      },
    },
    publishDefaults: {
      // Voice audio is #1 network priority with RED packet-loss recovery (prevents robotic/breaking voice on slow networks)
      audioPreset: {
        maxBitrate: 32_000,
        priority: 'high',
      },
      red: true,
      dtx: true,
      // Student camera capped at compact 480p (180 kbps max, low network priority) to save bandwidth & resources
      videoEncoding: {
        maxBitrate: 180_000,
        maxFramerate: 15,
        priority: 'low',
      },
      // Smart auto-adjusting screen share: 1080p primary + 720p HD fallback layer so slow internet steps down slightly without blurry text or hurting voice
      simulcast: true,
      degradationPreference: 'balanced',
      screenShareSimulcastLayers: [
        VideoPresets.h720,
      ],
      screenShareEncoding: {
        maxBitrate: 800_000,
        maxFramerate: 10,
        priority: 'medium',
      },
    },
  });
}

/**
 * Local simulation storage for Classroom Lab test sessions (0 Firestore quota consumed)
 */
export function getLabTestSessions(): ClassroomLabTestSession[] {
  try {
    const raw = localStorage.getItem(CLASSROOM_TEST_SESSIONS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [
    {
      id: 'session_demo_1',
      roomName: 'room_lab_tutor1_stu001',
      tutorId: 'Tutor 1',
      tutorName: 'Ustadh Muhammad (Tutor 1)',
      studentId: 'STU-001',
      studentName: 'Zayd Ahmed',
      status: 'idle',
      durationMinutes: 30,
      simulatedNetworkCondition: 'excellent',
    },
    {
      id: 'session_demo_2',
      roomName: 'room_lab_tutor6_stu005',
      tutorId: 'Tutor 6',
      tutorName: 'Ustadh Bilal (Tutor 6)',
      studentId: 'STU-005',
      studentName: 'Hamza Khan',
      status: 'idle',
      durationMinutes: 30,
      simulatedNetworkCondition: 'poor_mobile_4g',
    }
  ];
}

export function saveLabTestSessions(sessions: ClassroomLabTestSession[]): void {
  try {
    localStorage.setItem(CLASSROOM_TEST_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch {}
}

/**
 * Recordings Manager (Simulated + Storage Ready with Configurable 3-day retention)
 */
export function getLocalClassroomRecordings(): ClassroomRecordingItem[] {
  try {
    const raw = localStorage.getItem(CLASSROOM_RECORDINGS_STORAGE_KEY);
    if (raw) {
      const parsed: ClassroomRecordingItem[] = JSON.parse(raw);
      // Clean up expired items based on retention
      const now = new Date().toISOString();
      return parsed.map(r => ({
        ...r,
        status: r.expiresAt && r.expiresAt < now ? 'expired' : r.status,
      }));
    }
  } catch {}

  const now = Date.now();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  return [
    {
      id: 'rec_101',
      roomName: 'room_class_cls_01',
      classId: 'cls_01',
      tutorId: 'Tutor 1',
      studentName: 'Zayd Ahmed',
      recordedAt: new Date(now - 14 * 3600 * 1000).toISOString(),
      expiresAt: new Date(now - 14 * 3600 * 1000 + threeDaysMs).toISOString(),
      durationSeconds: 1740, // 29 min
      sizeBytes: 42 * 1024 * 1024, // 42 MB
      status: 'ready',
    },
    {
      id: 'rec_102',
      roomName: 'room_class_cls_04',
      classId: 'cls_04',
      tutorId: 'Tutor 6',
      studentName: 'Amina Tariq',
      recordedAt: new Date(now - 38 * 3600 * 1000).toISOString(),
      expiresAt: new Date(now - 38 * 3600 * 1000 + threeDaysMs).toISOString(),
      durationSeconds: 1820, // 30 min
      sizeBytes: 55 * 1024 * 1024, // 55 MB
      status: 'ready',
    }
  ];
}

export function saveLocalClassroomRecordings(recordings: ClassroomRecordingItem[]): void {
  try {
    localStorage.setItem(CLASSROOM_RECORDINGS_STORAGE_KEY, JSON.stringify(recordings));
  } catch {}
}

export interface LiveRoomStatusItem {
  tutorId: string;
  roomSlug: string;
  status: 'running' | 'tutor_waiting' | 'student_waiting' | 'idle';
  tutorPresent: boolean;
  studentPresent: boolean;
  participantCount: number;
  studentCount: number;
  students: string[];
  waitingCount: number;
  waitingStudents: string[];
  lastActivity: string | null;
}

export interface LiveRoomsStatusResponse {
  rooms: LiveRoomStatusItem[];
  summary: {
    totalTutors: number;
    runningCount: number;
    tutorWaitingCount: number;
    studentWaitingCount: number;
    idleCount: number;
  };
}

/**
 * Fetch real-time live status for all classrooms from server
 */
export async function fetchLiveRoomsStatus(): Promise<LiveRoomsStatusResponse> {
  try {
    const res = await fetch('/api/livekit/rooms/live-status');
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Live rooms status fetch notice:', e);
  }
  return {
    rooms: [],
    summary: {
      totalTutors: 0,
      runningCount: 0,
      tutorWaitingCount: 0,
      studentWaitingCount: 0,
      idleCount: 0
    }
  };
}
