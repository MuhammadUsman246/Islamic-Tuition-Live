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
 * Fetch a secure short-lived LiveKit token from backend server
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
  try {
    const response = await fetch('/api/livekit/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (response.ok) {
        return data;
      }
      if (data && data.error) {
        throw new Error(data.error);
      }
    }

    // If server returned non-JSON (e.g. HTML or text), read error text safely
    const rawText = await response.text().catch(() => '');
    console.warn('[LiveKit Token Notice] Non-JSON backend response:', response.status, rawText.slice(0, 100));

    // Fallback to Interactive Lab Simulation Token so classroom UI always functions
    const mockToken = `mock_token_${Date.now()}`;
    return {
      token: mockToken,
      serverUrl: params.customServerUrl || 'wss://demo.livekit.cloud',
      roomName: params.roomId,
      participantIdentity: params.identity,
      participantName: params.participantName,
      role: params.role,
      classId: params.classId || null,
      isMockSession: true,
      expiresInSeconds: 7200,
      message: 'Running in Interactive Lab Simulation Mode.',
    };
  } catch (err: any) {
    console.warn('[LiveKit Token Notice] Request error:', err?.message || err);
    const mockToken = `mock_token_${Date.now()}`;
    return {
      token: mockToken,
      serverUrl: params.customServerUrl || 'wss://demo.livekit.cloud',
      roomName: params.roomId,
      participantIdentity: params.identity,
      participantName: params.participantName,
      role: params.role,
      classId: params.classId || null,
      isMockSession: true,
      expiresInSeconds: 7200,
      message: 'Running in Interactive Lab Simulation Mode.',
    };
  }
}

/**
 * Query backend server LiveKit status
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
    configured: false,
    serverUrl: '',
    hasApiKey: false,
    hasApiSecret: false,
    isMaskedSecret: false,
    secretWarning: null,
    environment: 'unconfigured',
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
    if (res.ok) {
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
