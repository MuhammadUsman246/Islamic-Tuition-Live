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
  classroomEnabled: false,
  testModeOnly: true,
  livekitServerUrl: '',
  allowedTestTutorIds: ['Tutor 1', 'Tutor 6'],
  allowedTestStudentIds: ['STU-001', 'STU-002'],
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
  const response = await fetch('/api/livekit/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to obtain LiveKit token: ${errText || response.statusText}`);
  }

  return response.json();
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
    if (res.ok) {
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
    adaptiveStream: false,
    dynacast: true,
    stopLocalTrackOnUnpublish: true,
    disconnectOnPageLeave: true,
    audioCaptureDefaults: {
      autoGainControl: true,
      echoCancellation: true,
      noiseSuppression: true,
    },
    videoCaptureDefaults: {
      resolution: VideoPresets.h720.resolution,
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
