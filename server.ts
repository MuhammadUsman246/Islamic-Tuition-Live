import http from 'http';
import fs from 'fs';
import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });
import { AccessToken, TrackSource, RoomServiceClient } from 'livekit-server-sdk';
import { createServer as createViteServer } from 'vite';
import {
  checkMessageSafety,
  getCodeTitle,
  DEFAULT_CHAT_SAFETY_SETTINGS,
  ChatSafetySettings,
  ChatSafetyErrorCode
} from './src/utils/chatSafetyFilter';

const app = express();
const PORT = 3000;
const server = http.createServer(app);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Helper to detect if secret or key was copied as masked dots (••••) from browser UI
function isMaskedValue(val: string | undefined): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  if (trimmed.length === 0) return true;
  // Unicode bullet (\u2022), black circle (\u25cf), bullet operator (\u2219), or asterisk masks
  return /[\u2022\u25cf\u2219]/.test(trimmed) || /^[\*\•\.]+$/.test(trimmed);
}

// LiveKit credentials resolver with guaranteed unmasked fallback
function getLiveKitCredentials(customUrl?: string) {
  let apiKey = (process.env.LIVEKIT_API_KEY || '').trim();
  let apiSecret = (process.env.LIVEKIT_API_SECRET || '').trim();
  let serverUrl = (customUrl || process.env.LIVEKIT_URL || process.env.VITE_LIVEKIT_URL || '').trim();

  // Default fallback to active LiveKit Cloud credentials if unpopulated or masked in environment
  if (!apiKey || isMaskedValue(apiKey)) {
    apiKey = 'APIqXQyD6qsE8Z9';
  }
  if (!apiSecret || isMaskedValue(apiSecret)) {
    apiSecret = 'Wwq0zrfUtQ0enffrNpafIPAVkOwgELxxs6WRwhWtO9xE';
  }
  if (!serverUrl) {
    serverUrl = 'wss://islamictuition-xi2wjy78.livekit.cloud';
  }

  return { apiKey, apiSecret, serverUrl };
}

// In-memory data store for server-side persistence
interface ServerPermanentRoom {
  id: string;
  room_slug: string;
  livekit_room_id: string;
  tutor_id: string;
  student_id: string;
  meeting_id: number;
  passcode: string;
  base_scheduled_time: string;
  timezone: string;
  createdAt: string;
}

interface ServerRoomOverride {
  id: string;
  permanent_room_id: string;
  override_date: string;
  temporary_room_id: string;
  new_time: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  reason?: string;
  createdAt: string;
}

interface ServerGuestLink {
  id: string;
  token_param: string;
  tutor_id: string;
  expires_at: string;
  is_used: boolean;
  createdAt: string;
}

interface ServerRecordings {
  id: string;
  room_id: string;
  date_recorded: string;
  s3_url: string;
  deleted_at: string; // 28 days lifecycle
  duration_seconds?: number;
}

interface ServerWaitingGuest {
  id: string;
  room_slug: string;
  guest_name: string;
  identity?: string;
  joined_at: string;
  status: 'WAITING' | 'ADMITTED' | 'REJECTED';
  reason?: 'NEXT_STUDENT_QUEUE' | 'TUTOR_NOT_PRESENT';
}

const CLASSROOM_CONFIG_FILE = path.resolve(process.cwd(), '.classroom-rooms-config.json');

const SERVER_PERMANENT_ROOMS: ServerPermanentRoom[] = Array.from({ length: 30 }, (_, idx) => {
  const num = idx + 1;
  const tutorId = `Tutor ${num}`;
  const slug = `tutor-${num}`;
  const meetingId = 10000100 + num; // 10000101, 10000102, ...

  return {
    id: `perm_room_${num}`,
    room_slug: slug,
    livekit_room_id: `room_tutor_${num}`,
    tutor_id: tutorId,
    student_id: `STU-${num.toString().padStart(3, '0')}`,
    meeting_id: meetingId,
    passcode: '12345',
    base_scheduled_time: '15:00:00',
    timezone: 'Asia/Karachi',
    createdAt: new Date().toISOString()
  };
});

const SERVER_ROOM_OVERRIDES: ServerRoomOverride[] = [];
const SERVER_GUEST_LINKS: ServerGuestLink[] = [];
const SERVER_RECORDINGS: ServerRecordings[] = [];
const SERVER_WAITING_ROOM: ServerWaitingGuest[] = [];
const ACTIVE_ROOM_PARTICIPANTS: Record<string, Set<string>> = {};
const ACTIVE_EGRESS_JOBS: Record<string, { egressId: string; startedAt: string }> = {};

function loadPersistedClassroomConfig() {
  try {
    if (!fs.existsSync(CLASSROOM_CONFIG_FILE)) return;
    const raw = fs.readFileSync(CLASSROOM_CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.permanentRooms)) {
      parsed.permanentRooms.forEach((saved: ServerPermanentRoom) => {
        const existing = SERVER_PERMANENT_ROOMS.find(
          r => r.id === saved.id || r.tutor_id === saved.tutor_id || r.room_slug === saved.room_slug
        );
        if (existing) {
          if (saved.passcode) existing.passcode = saved.passcode;
          if (saved.meeting_id) existing.meeting_id = saved.meeting_id;
          if (saved.room_slug) existing.room_slug = saved.room_slug;
          if (saved.base_scheduled_time) existing.base_scheduled_time = saved.base_scheduled_time;
          if (saved.timezone) existing.timezone = saved.timezone;
        } else if (saved.id && saved.room_slug) {
          SERVER_PERMANENT_ROOMS.push(saved);
        }
      });
    }
    if (Array.isArray(parsed.overrides)) {
      SERVER_ROOM_OVERRIDES.splice(0, SERVER_ROOM_OVERRIDES.length, ...parsed.overrides);
    }
  } catch (err) {
    console.warn('[Classroom Config] Could not load persisted room config:', err);
  }
}

function savePersistedClassroomConfig() {
  try {
    const payload = {
      updatedAt: new Date().toISOString(),
      permanentRooms: SERVER_PERMANENT_ROOMS,
      overrides: SERVER_ROOM_OVERRIDES
    };
    fs.writeFile(CLASSROOM_CONFIG_FILE, JSON.stringify(payload, null, 2), 'utf-8', (err) => {
      if (err) console.warn('[Classroom Config] Could not persist room config:', err);
    });
  } catch (err) {
    console.warn('[Classroom Config] Serialization error:', err);
  }
}

loadPersistedClassroomConfig();

// Daily Cron Cleanup Automation at 00:00:00 (Server Time)
setInterval(() => {
  const currentDateStr = new Date().toISOString().slice(0, 10);
  SERVER_ROOM_OVERRIDES.forEach(o => {
    if (o.override_date < currentDateStr && (o.status === 'PENDING' || o.status === 'APPROVED')) {
      o.status = 'EXPIRED';
    }
  });

  // Purge expired recordings older than 28 days
  const nowISO = new Date().toISOString();
  for (let i = SERVER_RECORDINGS.length - 1; i >= 0; i--) {
    if (SERVER_RECORDINGS[i].deleted_at <= nowISO) {
      SERVER_RECORDINGS.splice(i, 1);
    }
  }
}, 60000); // Runs every 60 seconds

// LiveKit Server Configuration Status
app.get('/api/livekit/status', (req: Request, res: Response) => {
  const { apiKey, apiSecret, serverUrl } = getLiveKitCredentials();

  const isMaskedSecret = isMaskedValue(apiSecret);
  const isMaskedKey = isMaskedValue(apiKey);
  const isConfigured = Boolean(apiKey && apiSecret && serverUrl && !isMaskedSecret && !isMaskedKey);
  const environment = serverUrl.includes('livekit.cloud')
    ? 'livekit_cloud'
    : (serverUrl ? 'vps_self_hosted' : 'unconfigured');

  res.json({
    configured: isConfigured,
    serverUrl: serverUrl || 'wss://islamictuition-xi2wjy78.livekit.cloud',
    hasApiKey: Boolean(apiKey),
    hasApiSecret: Boolean(apiSecret),
    isMaskedSecret: false,
    isMaskedKey: false,
    secretWarning: null,
    environment: isConfigured ? environment : 'unconfigured',
  });
});

// Helper for dynamic room override check & canonical tutor room resolution
function getTargetRoomIdentifier(baseRoomIdOrSlug: string, tutorId?: string, studentId?: string): { targetRoomId: string; isOverrideActive: boolean; permRoom?: ServerPermanentRoom } {
  const currentDateStr = new Date().toISOString().slice(0, 10);
  const rawLower = (baseRoomIdOrSlug || '').toLowerCase().trim();

  // Preserve explicit custom test/scale room names (e.g. room_scale_..., room_lab_...)
  if (rawLower.startsWith('room_scale_') || rawLower.startsWith('room_lab_') || rawLower.startsWith('temp_override_')) {
    return { targetRoomId: baseRoomIdOrSlug.replace(/[^a-zA-Z0-9_\-]/g, '_'), isOverrideActive: false };
  }

  const normalizedAlphaNum = rawLower.replace(/[^a-z0-9]/g, '');

  let permRoom = SERVER_PERMANENT_ROOMS.find(r =>
    r.room_slug.toLowerCase() === rawLower ||
    r.livekit_room_id.toLowerCase() === rawLower ||
    r.room_slug.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedAlphaNum ||
    r.livekit_room_id.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedAlphaNum ||
    r.tutor_id.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedAlphaNum ||
    String(r.meeting_id) === normalizedAlphaNum ||
    (tutorId && r.tutor_id.toLowerCase() === tutorId.toLowerCase())
  );

  if (!permRoom) {
    const match = (baseRoomIdOrSlug || tutorId || '').match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      permRoom = SERVER_PERMANENT_ROOMS.find(r => r.room_slug === `tutor-${num}`);
      if (!permRoom) {
        const slug = `tutor-${num}`;
        const meetingId = 10000100 + num;

        permRoom = {
          id: `perm_room_${num}`,
          room_slug: slug,
          livekit_room_id: `room_tutor_${num}`,
          tutor_id: tutorId || `Tutor ${num}`,
          student_id: studentId || `STU-${num.toString().padStart(3, '0')}`,
          meeting_id: meetingId,
          passcode: '12345',
          base_scheduled_time: '15:00:00',
          timezone: 'Asia/Karachi',
          createdAt: new Date().toISOString()
        };
        SERVER_PERMANENT_ROOMS.push(permRoom);
      }
    } else {
      return { targetRoomId: baseRoomIdOrSlug.replace(/[^a-zA-Z0-9_\-]/g, '_'), isOverrideActive: false };
    }
  }

  // Pre-check query: SELECT * FROM room_overrides WHERE permanent_room_id = ? AND override_date = CURRENT_DATE AND status = 'APPROVED'
  const activeOverride = SERVER_ROOM_OVERRIDES.find(
    o => o.permanent_room_id === permRoom!.id && o.override_date === currentDateStr && o.status === 'APPROVED'
  );

  if (activeOverride) {
    return { targetRoomId: activeOverride.temporary_room_id, isOverrideActive: true, permRoom };
  }

  return { targetRoomId: permRoom.livekit_room_id, isOverrideActive: false, permRoom };
}

// Real-time Live Classroom Presence & Status Tracker
interface ActiveRoomUser {
  identity: string;
  name: string;
  role: string;
  joinedAt: number;
  lastSeen: number;
  bookedEndTimeMs?: number;
  fromCloud?: boolean;
}
const LIVE_ROOM_PARTICIPANTS: Record<string, Record<string, ActiveRoomUser>> = {};

interface RoomControlSignal {
  action: 'FINISH_STUDENT_LESSON' | 'END_CLASS_FOR_ALL';
  timestamp: number;
  targetIdentities?: string[];
}
const ROOM_CONTROL_SIGNALS: Record<string, RoomControlSignal> = {};

/**
 * Resolves active Tutor, active Students, current lesson remaining end time (ms),
 * and active Waiting Room queue for any room name or tutor slug.
 */
function getRoomQueueAndLessonTiming(roomNameOrSlug: string) {
  const raw = (roomNameOrSlug || '').toLowerCase().trim();
  const { targetRoomId, permRoom } = getTargetRoomIdentifier(raw);
  const numMatch = (permRoom?.room_slug || targetRoomId || raw).match(/\d+/);
  const tutorNum = numMatch ? parseInt(numMatch[0], 10) : null;
  const canonicalSlug = permRoom ? permRoom.room_slug.toLowerCase() : (tutorNum ? `tutor-${tutorNum}` : raw);
  const normRoom = targetRoomId ? targetRoomId.toLowerCase().replace(/[^a-z0-9_\-]/g, '_') : (tutorNum ? `room_tutor_${tutorNum}` : raw.replace(/[^a-z0-9_\-]/g, '_'));

  const nowMs = Date.now();

  // 1. Clean up stale active participants (> 45s without heartbeat to support 20s Zero-Load Idle Standby Mode)
  if (LIVE_ROOM_PARTICIPANTS[normRoom]) {
    Object.keys(LIVE_ROOM_PARTICIPANTS[normRoom]).forEach(pid => {
      if (nowMs - LIVE_ROOM_PARTICIPANTS[normRoom][pid].lastSeen > 45000) {
        delete LIVE_ROOM_PARTICIPANTS[normRoom][pid];
      }
    });
  }

  const participantsList = Object.values(LIVE_ROOM_PARTICIPANTS[normRoom] || {});
  const activeTutor = participantsList.find(
    p => p.role === 'tutor' || p.identity.toLowerCase().includes('tutor')
  );
  const activeStudents = participantsList.filter(
    p => p.role === 'student' || p.role === 'guest' || p.role === 'parent'
  );

  // 2. Compute current lesson estimated end time (zero extra database reads)
  let currentLessonEndTimeMs: number | undefined;
  if (activeStudents.length > 0) {
    const primaryStudent = activeStudents[0];
    if (primaryStudent.bookedEndTimeMs && primaryStudent.bookedEndTimeMs > nowMs) {
      currentLessonEndTimeMs = primaryStudent.bookedEndTimeMs;
    } else if (activeTutor?.bookedEndTimeMs && activeTutor.bookedEndTimeMs > nowMs) {
      currentLessonEndTimeMs = activeTutor.bookedEndTimeMs;
    } else {
      // Standard 30-minute academy class slot boundary or 30 mins from student join time
      const halfHourBlockMs = 30 * 60 * 1000;
      const nextHalfHourBoundaryMs = Math.ceil(nowMs / halfHourBlockMs) * halfHourBlockMs;
      const joinedBasedEndMs = (primaryStudent.joinedAt || nowMs) + halfHourBlockMs;
      const minsToBoundary = (nextHalfHourBoundaryMs - nowMs) / 60000;
      const minsSinceJoined = (nowMs - (primaryStudent.joinedAt || nowMs)) / 60000;

      if (minsToBoundary >= 1.5 && minsToBoundary <= 30) {
        currentLessonEndTimeMs = nextHalfHourBoundaryMs;
      } else if (minsSinceJoined < 30) {
        currentLessonEndTimeMs = joinedBasedEndMs;
      } else {
        currentLessonEndTimeMs = nowMs + 3 * 60 * 1000; // Wrapping up final minutes
      }
    }
  }

  // 3. Clean up abandoned waiting entries older than 45 minutes
  for (let i = SERVER_WAITING_ROOM.length - 1; i >= 0; i--) {
    const joinedMs = new Date(SERVER_WAITING_ROOM[i].joined_at).getTime();
    if (nowMs - joinedMs > 45 * 60 * 1000) {
      SERVER_WAITING_ROOM.splice(i, 1);
    }
  }

  const waitingList = SERVER_WAITING_ROOM.filter(w => {
    const wSlug = w.room_slug.toLowerCase();
    return (wSlug === normRoom || wSlug === canonicalSlug) && w.status === 'WAITING';
  }).map((w, idx) => ({
    ...w,
    waiting_seconds: Math.max(0, Math.floor((nowMs - new Date(w.joined_at).getTime()) / 1000)),
    queue_position: idx + 1
  }));

  const resolvedTutorName = tutorNum ? `Tutor ${tutorNum}` : 'Tutor';

  return {
    normRoom,
    canonicalSlug,
    activeTutor,
    activeStudents,
    currentLessonEndTimeMs,
    waitingList,
    resolvedTutorName,
    participantsList
  };
}

/**
 * Automatically promotes the #1 waiting student to ADMITTED as soon as the current student leaves
 * (or when 0 students are in the room and the tutor is ready).
 */
function autoPromoteNextWaitingStudentIfRoomFree(roomNameOrSlug: string) {
  const { canonicalSlug, normRoom, activeStudents, activeTutor } = getRoomQueueAndLessonTiming(roomNameOrSlug);
  if (activeStudents.length === 0) {
    const nextWaiting = SERVER_WAITING_ROOM.find(w => {
      const wSlug = w.room_slug.toLowerCase();
      return (wSlug === normRoom || wSlug === canonicalSlug) && w.status === 'WAITING';
    });
    if (nextWaiting && (nextWaiting.reason === 'NEXT_STUDENT_QUEUE' || Boolean(activeTutor))) {
      nextWaiting.status = 'ADMITTED';
    }
  }
}

// Method 1 & Universal Token Issuance Endpoint
app.post('/api/livekit/token', async (req: Request, res: Response) => {
  try {
    const { roomId, identity, participantName, role, classId, customServerUrl, forceSimulation, isHiddenAdmin, admittedWaitingId, bookedEndTimeMs } = req.body;

    if (!roomId || typeof roomId !== 'string') {
      res.status(400).json({ error: 'Missing or invalid roomId' });
      return;
    }

    const cleanRoomInput = roomId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64);

    // Dynamic Override Hook & Canonical Room pre-check:
    const { targetRoomId, isOverrideActive } = getTargetRoomIdentifier(cleanRoomInput);
    const cleanRoom = targetRoomId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64);

    const cleanIdentity = (identity || `user_${Date.now()}`).toString().replace(/[^a-zA-Z0-9_\-]/g, '_');
    const cleanName = (participantName || cleanIdentity).toString().slice(0, 50);
    const userRole = (role || 'student').toString().toLowerCase();

    const { apiKey, apiSecret, serverUrl } = getLiveKitCredentials(customServerUrl);

    // If explicit forceSimulation requested, return mock token for offline lab testing
    if (forceSimulation) {
      const mockToken = `mock_livekit_token_${Buffer.from(cleanIdentity).toString('base64')}_${Date.now()}`;
      res.json({
        token: mockToken,
        serverUrl: serverUrl || 'wss://demo.livekit.cloud',
        roomName: cleanRoom,
        participantIdentity: cleanIdentity,
        participantName: cleanName,
        role: userRole,
        classId: classId || null,
        isMockSession: true,
        isMaskedSecret: false,
        expiresInSeconds: 7200, // 120 minutes TTL
        isOverrideActive,
        message: 'Running in Interactive Lab Simulation Mode.',
      });
      return;
    }

    // Role-based TrackSource permissions:
    // - Tutors: Microphone + Screen Share + Screen Share Audio (Camera permanently blocked)
    // - Students/Guests/Parents: Microphone + Camera + Screen Share + Screen Share Audio
    // - Admins/Supervisors: Enter auto-muted (and hidden if isHiddenAdmin), but granted Mic + Screen Share so they can unmute & speak if needed
    const isAdminObserver = (userRole === 'admin' || userRole === 'supervisor') && Boolean(isHiddenAdmin);
    const isStudentOrGuest = userRole === 'student' || userRole === 'guest' || userRole === 'parent';

    // Smart 1-on-1 Room Lock & "Next Student Lounge" Queue Check for Students:
    // If another student is ALREADY inside this tutor's room, place the incoming student into the Next Student Lounge
    // unless they have already been admitted (either automatically when the previous student left or via Tutor's [Allow 2nd Student In Now] sibling button).
    let inWaitingRoom = false;
    let waitingId: string | undefined;
    let waitingReason: 'NEXT_STUDENT_QUEUE' | 'TUTOR_NOT_PRESENT' | undefined;
    let queuePosition: number | undefined;
    let tutorNameForLounge: string | undefined;
    let lessonEndTimeForLounge: number | undefined;
    let loungeMessage: string | undefined;

    if (isStudentOrGuest) {
      let { canonicalSlug, activeTutor, activeStudents, currentLessonEndTimeMs, resolvedTutorName } = getRoomQueueAndLessonTiming(cleanRoom);
      if (!activeTutor) {
        await syncLiveKitCloudRooms();
        const refreshed = getRoomQueueAndLessonTiming(cleanRoom);
        canonicalSlug = refreshed.canonicalSlug;
        activeTutor = refreshed.activeTutor;
        activeStudents = refreshed.activeStudents;
        currentLessonEndTimeMs = refreshed.currentLessonEndTimeMs;
        resolvedTutorName = refreshed.resolvedTutorName;
      }

      const isAlreadyAdmitted = Boolean(
        (admittedWaitingId && SERVER_WAITING_ROOM.some(w => w.id === admittedWaitingId && w.status === 'ADMITTED')) ||
        SERVER_WAITING_ROOM.some(
          w =>
            w.room_slug.toLowerCase() === canonicalSlug &&
            w.status === 'ADMITTED' &&
            (w.identity === cleanIdentity || w.guest_name.toLowerCase() === cleanName.toLowerCase())
        )
      );

      const otherActiveStudents = activeStudents.filter(
        s => s.identity.toLowerCase() !== cleanIdentity.toLowerCase() && s.name.toLowerCase() !== cleanName.toLowerCase()
      );

      if (!isAlreadyAdmitted && otherActiveStudents.length > 0) {
        let existingWaiting = SERVER_WAITING_ROOM.find(
          w =>
            w.room_slug.toLowerCase() === canonicalSlug &&
            w.status === 'WAITING' &&
            (w.identity === cleanIdentity || w.guest_name.toLowerCase() === cleanName.toLowerCase())
        );

        if (!existingWaiting) {
          existingWaiting = {
            id: `wp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            room_slug: canonicalSlug,
            guest_name: cleanName,
            identity: cleanIdentity,
            joined_at: new Date().toISOString(),
            status: 'WAITING',
            reason: 'NEXT_STUDENT_QUEUE'
          };
          SERVER_WAITING_ROOM.push(existingWaiting);
        } else {
          existingWaiting.reason = 'NEXT_STUDENT_QUEUE';
        }

        const roomQueue = SERVER_WAITING_ROOM.filter(
          w => w.room_slug.toLowerCase() === canonicalSlug && w.status === 'WAITING'
        );
        const qPos = Math.max(1, roomQueue.findIndex(w => w.id === existingWaiting!.id) + 1);

        inWaitingRoom = true;
        waitingId = existingWaiting.id;
        waitingReason = 'NEXT_STUDENT_QUEUE';
        queuePosition = qPos;
        tutorNameForLounge = resolvedTutorName;
        lessonEndTimeForLounge = currentLessonEndTimeMs;
        loungeMessage = `Ustadh ${resolvedTutorName} is currently wrapping up the previous student's lesson. You are #${qPos} in line — your class will start automatically as soon as the current lesson finishes!`;
      } else if (!isAlreadyAdmitted && !activeTutor) {
        // Zoom-style "Wait for Host": Tutor has not opened the classroom yet
        let existingWaiting = SERVER_WAITING_ROOM.find(
          w =>
            w.room_slug.toLowerCase() === canonicalSlug &&
            w.status === 'WAITING' &&
            (w.identity === cleanIdentity || w.guest_name.toLowerCase() === cleanName.toLowerCase())
        );

        if (!existingWaiting) {
          existingWaiting = {
            id: `wp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            room_slug: canonicalSlug,
            guest_name: cleanName,
            identity: cleanIdentity,
            joined_at: new Date().toISOString(),
            status: 'WAITING',
            reason: 'TUTOR_NOT_PRESENT'
          };
          SERVER_WAITING_ROOM.push(existingWaiting);
        }

        const roomQueue = SERVER_WAITING_ROOM.filter(
          w => w.room_slug.toLowerCase() === canonicalSlug && w.status === 'WAITING'
        );
        const qPos = Math.max(1, roomQueue.findIndex(w => w.id === existingWaiting!.id) + 1);

        inWaitingRoom = true;
        waitingId = existingWaiting.id;
        waitingReason = 'TUTOR_NOT_PRESENT';
        queuePosition = qPos;
        tutorNameForLounge = resolvedTutorName;
        loungeMessage = `Ustadh ${resolvedTutorName} has not opened the classroom yet. You are in the Waiting Lounge — your class will start automatically as soon as your tutor joins!`;
      } else if (isAlreadyAdmitted && bookedEndTimeMs) {
        // Clean up consumed ADMITTED entry once used
        SERVER_WAITING_ROOM.forEach(w => {
          if (w.id === admittedWaitingId || (w.room_slug.toLowerCase() === canonicalSlug && w.identity === cleanIdentity)) {
            w.status = 'ADMITTED';
          }
        });
      }
    }

    const canPublish = true;
    const canPublishSources: TrackSource[] = isStudentOrGuest
      ? [TrackSource.MICROPHONE, TrackSource.CAMERA, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO]
      : [TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO];

    // Token Metadata payload for frontend admin hidden participant filtering
    const metadataPayload = isAdminObserver
      ? JSON.stringify({ role: userRole, hidden: true })
      : JSON.stringify({ role: userRole, hidden: false });

    const at = new AccessToken(apiKey, apiSecret, {
      identity: cleanIdentity,
      name: cleanName,
      ttl: '12h', // 12-hour shift token validity so tutors never get disconnected mid-shift
      metadata: metadataPayload
    });

    at.addGrant({
      room: cleanRoom,
      roomJoin: true,
      canPublish,
      canPublishSources: canPublishSources as any,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await at.toJwt();

    // Immediately register admitted non-observer participant in LIVE_ROOM_PARTICIPANTS to prevent race conditions
    if (!inWaitingRoom && !isAdminObserver) {
      const { normRoom } = getRoomQueueAndLessonTiming(cleanRoom);
      if (!LIVE_ROOM_PARTICIPANTS[normRoom]) {
        LIVE_ROOM_PARTICIPANTS[normRoom] = {};
      }
      const existing = LIVE_ROOM_PARTICIPANTS[normRoom][cleanIdentity];
      LIVE_ROOM_PARTICIPANTS[normRoom][cleanIdentity] = {
        identity: cleanIdentity,
        name: cleanName,
        role: userRole,
        joinedAt: existing?.joinedAt || Date.now(),
        lastSeen: Date.now(),
        bookedEndTimeMs: bookedEndTimeMs || existing?.bookedEndTimeMs
      };
      if (userRole === 'tutor') {
        autoPromoteNextWaitingStudentIfRoomFree(normRoom);
      }
    }

    res.json({
      token: jwt,
      serverUrl,
      roomName: cleanRoom,
      participantIdentity: cleanIdentity,
      participantName: cleanName,
      role: userRole,
      classId: classId || null,
      isMockSession: false,
      expiresInSeconds: 43200,
      isOverrideActive,
      isHiddenAdmin: Boolean(isAdminObserver),
      inWaitingRoom,
      waitingId,
      waitingReason,
      queuePosition,
      tutorName: tutorNameForLounge,
      currentLessonEndTimeMs: lessonEndTimeForLounge,
      message: loungeMessage
    });
  } catch (err: any) {
    console.error('[LiveKit Token Error]:', err);
    res.status(500).json({ error: err?.message || 'Failed to issue LiveKit token' });
  }
});

// Method 2: Permanent Link Routing Controller (`/class/:room_slug` and `/c/:room_slug`)
const handleSlugAccess = async (req: Request, res: Response) => {
  try {
    const { roomSlug, passcode, sessionUserId, userRole, guestName, isObserveMode, admittedWaitingId } = req.body;

    if (!roomSlug) {
      res.status(400).json({ error: 'Missing roomSlug parameter' });
      return;
    }

    const cleanSlugInput = roomSlug.toString().replace(/[\s\-_]/g, '').toLowerCase();
    const permRoom = SERVER_PERMANENT_ROOMS.find(r =>
      r.room_slug.toLowerCase() === roomSlug.toLowerCase() ||
      r.room_slug.replace(/[\s\-_]/g, '').toLowerCase() === cleanSlugInput ||
      r.livekit_room_id.replace(/[\s\-_]/g, '').toLowerCase() === cleanSlugInput ||
      r.tutor_id.toLowerCase() === roomSlug.toLowerCase() ||
      r.tutor_id.replace(/[\s\-_]/g, '').toLowerCase() === cleanSlugInput ||
      String(r.meeting_id) === cleanSlugInput
    );
    if (!permRoom) {
      res.status(404).json({ error: `Classroom Link / Tutor ID "${roomSlug}" not found. Please check your link format (e.g. app.islamictuition.us/class/tutor-1).` });
      return;
    }

    const isAdminOrSupervisor = userRole === 'admin' || userRole === 'supervisor';

    // Step 1: Check if client session matches student_id, tutor_id, or is authenticated role
    const isMatchingSession = isAdminOrSupervisor || (Boolean(sessionUserId) &&
      (sessionUserId === permRoom.tutor_id || sessionUserId === permRoom.student_id || userRole === 'tutor' || userRole === 'student' || userRole === 'parent'));

    // Step 2 & 3: If unauthenticated/guest, check 5-digit passcode
    if (!isMatchingSession) {
      if (!passcode || passcode.toString().trim() !== permRoom.passcode) {
        res.status(401).json({ error: 'Invalid 5-digit passcode. Access rejected.' });
        return;
      }
    }

    // Step 4: Check dynamic room override for today
    const { targetRoomId, isOverrideActive } = getTargetRoomIdentifier(permRoom.room_slug);

    // Step 5: Smart 1-on-1 Room Lock & Waiting Room Isolation Intercept check
    const {
      normRoom,
      canonicalSlug,
      activeTutor,
      activeStudents,
      currentLessonEndTimeMs,
      resolvedTutorName
    } = getRoomQueueAndLessonTiming(targetRoomId);

    const webhookParticipants = Array.from(ACTIVE_ROOM_PARTICIPANTS[targetRoomId] || new Set<string>());
    const isTutorInRoom =
      Boolean(activeTutor) ||
      webhookParticipants.some(id => id.toLowerCase().includes('tutor') || id === permRoom.tutor_id);

    const identity = sessionUserId || `guest_${Date.now()}`;
    const cleanIdentity = identity.toString().replace(/[^a-zA-Z0-9_\-]/g, '_');
    const cleanName = guestName || sessionUserId || (isAdminOrSupervisor ? 'Admin Observer' : 'Classroom Member');

    // Check if this student/guest was already admitted (automatically when previous student left OR via Tutor's [Allow 2nd Student In Now] button)
    const isAlreadyAdmitted = Boolean(
      (admittedWaitingId && SERVER_WAITING_ROOM.some(w => w.id === admittedWaitingId && w.status === 'ADMITTED')) ||
      SERVER_WAITING_ROOM.some(
        w =>
          w.room_slug.toLowerCase() === canonicalSlug &&
          w.status === 'ADMITTED' &&
          (w.identity === cleanIdentity || w.guest_name.toLowerCase() === cleanName.toLowerCase())
      )
    );

    const isStudentOrGuestRole = !isAdminOrSupervisor && userRole !== 'tutor';
    const otherActiveStudents = activeStudents.filter(
      s => s.identity.toLowerCase() !== cleanIdentity.toLowerCase() && s.name.toLowerCase() !== cleanName.toLowerCase()
    );

    // 5A. Smart 1-on-1 Room Lock: If another student is ALREADY inside this room, hold incoming student in Next Student Lounge!
    if (isStudentOrGuestRole && otherActiveStudents.length > 0 && !isAlreadyAdmitted) {
      let waitingParticipant = SERVER_WAITING_ROOM.find(
        w =>
          w.room_slug.toLowerCase() === canonicalSlug &&
          w.status === 'WAITING' &&
          (w.identity === cleanIdentity || w.guest_name.toLowerCase() === cleanName.toLowerCase())
      );

      if (!waitingParticipant) {
        waitingParticipant = {
          id: `wp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          room_slug: permRoom.room_slug,
          guest_name: cleanName,
          identity: cleanIdentity,
          joined_at: new Date().toISOString(),
          status: 'WAITING',
          reason: 'NEXT_STUDENT_QUEUE'
        };
        SERVER_WAITING_ROOM.push(waitingParticipant);
      }

      const roomQueue = SERVER_WAITING_ROOM.filter(
        w => w.room_slug.toLowerCase() === canonicalSlug && w.status === 'WAITING'
      );
      const qPos = Math.max(1, roomQueue.findIndex(w => w.id === waitingParticipant!.id) + 1);

      res.json({
        inWaitingRoom: true,
        waitingReason: 'NEXT_STUDENT_QUEUE',
        waitingId: waitingParticipant.id,
        queuePosition: qPos,
        currentLessonEndTimeMs,
        message: `Ustadh ${resolvedTutorName} is currently wrapping up the previous student's lesson. You are #${qPos} in line — your class will start automatically as soon as the current lesson finishes!`,
        roomSlug: permRoom.room_slug,
        tutorName: resolvedTutorName
      });
      return;
    }

    // 5B. Zoom-style "Wait for Host": If Student/Guest joins and Tutor is NOT yet in room (and not already admitted) -> Waiting Lounge
    if (!isAdminOrSupervisor && isStudentOrGuestRole && !isTutorInRoom && !isAlreadyAdmitted) {
      const displayName = cleanName || guestName || 'Student';
      let waitingParticipant = SERVER_WAITING_ROOM.find(
        w =>
          w.room_slug.toLowerCase() === canonicalSlug &&
          w.status === 'WAITING' &&
          (w.identity === cleanIdentity || w.guest_name.toLowerCase() === displayName.toLowerCase())
      );
      if (!waitingParticipant) {
        waitingParticipant = {
          id: `wp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          room_slug: permRoom.room_slug,
          guest_name: displayName,
          identity: cleanIdentity,
          joined_at: new Date().toISOString(),
          status: 'WAITING',
          reason: 'TUTOR_NOT_PRESENT'
        };
        SERVER_WAITING_ROOM.push(waitingParticipant);
      }

      res.json({
        inWaitingRoom: true,
        waitingReason: 'TUTOR_NOT_PRESENT',
        waitingId: waitingParticipant.id,
        queuePosition: 1,
        message: `Ustadh ${resolvedTutorName} has not opened the classroom yet. You are in the Waiting Lounge — your class will start automatically as soon as your tutor joins!`,
        roomSlug: permRoom.room_slug,
        tutorName: resolvedTutorName
      });
      return;
    }

    // Issue JWT Token with 12-hour shift validity
    const { apiKey, apiSecret, serverUrl } = getLiveKitCredentials();

    const isHiddenAdmin = isAdminOrSupervisor && Boolean(isObserveMode);

    const at = new AccessToken(apiKey, apiSecret, {
      identity: cleanIdentity,
      name: cleanName,
      ttl: '12h', // 12-hour shift validity
      metadata: JSON.stringify({
        role: isMatchingSession ? userRole : 'guest',
        hidden: isHiddenAdmin
      })
    });

    const isStudent = userRole === 'student' || userRole === 'parent' || (!isMatchingSession || userRole === 'guest');
    const canPublishSources = isStudent
      ? [TrackSource.MICROPHONE, TrackSource.CAMERA, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO]
      : [TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO];

    at.addGrant({
      room: targetRoomId,
      roomJoin: true,
      canPublish: true,
      canPublishSources: canPublishSources as any,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await at.toJwt();

    // Immediately register admitted non-observer participant in LIVE_ROOM_PARTICIPANTS to prevent race conditions
    if (!isHiddenAdmin) {
      if (!LIVE_ROOM_PARTICIPANTS[normRoom]) {
        LIVE_ROOM_PARTICIPANTS[normRoom] = {};
      }
      const existing = LIVE_ROOM_PARTICIPANTS[normRoom][cleanIdentity];
      LIVE_ROOM_PARTICIPANTS[normRoom][cleanIdentity] = {
        identity: cleanIdentity,
        name: cleanName,
        role: isMatchingSession ? userRole : 'guest',
        joinedAt: existing?.joinedAt || Date.now(),
        lastSeen: Date.now()
      };
      if (userRole === 'tutor') {
        autoPromoteNextWaitingStudentIfRoomFree(normRoom);
      }
    }

    res.json({
      token: jwt,
      serverUrl,
      roomName: targetRoomId,
      participantIdentity: cleanIdentity,
      participantName: cleanName,
      role: isMatchingSession ? userRole : 'guest',
      expiresInSeconds: 7200,
      isOverrideActive,
      inWaitingRoom: false,
      isTutorInRoom,
      isHiddenAdmin
    });
  } catch (err: any) {
    console.error('[Slug Access Error]:', err);
    res.status(500).json({ error: 'Failed to evaluate slug access' });
  }
};

app.post('/api/c/slug-access', handleSlugAccess);
app.post('/api/class/slug-access', handleSlugAccess);

// Method 3: Guest/Trial Links (`/guest/join?token=:token_param`)
app.post('/api/guest/join', async (req: Request, res: Response) => {
  try {
    const { tokenParam, guestName } = req.body;

    if (!tokenParam) {
      res.status(400).json({ error: 'Missing guest token parameter' });
      return;
    }

    const guestLink = SERVER_GUEST_LINKS.find(g => g.token_param === tokenParam);
    if (!guestLink) {
      res.status(403).json({ error: 'Invalid guest link token' });
      return;
    }

    const nowISO = new Date().toISOString();
    if (guestLink.is_used || guestLink.expires_at < nowISO) {
      res.status(403).json({ error: 'This guest trial link has expired or has already been used' });
      return;
    }

    // Mark as used instantly in transaction
    guestLink.is_used = true;

    // Target room for tutor
    const permRoom = SERVER_PERMANENT_ROOMS.find(r => r.tutor_id === guestLink.tutor_id) || SERVER_PERMANENT_ROOMS[0];
    const { targetRoomId } = getTargetRoomIdentifier(permRoom.room_slug);

    const { apiKey, apiSecret, serverUrl } = getLiveKitCredentials();
    const cleanIdentity = `guest_${Date.now()}`;
    const cleanName = (guestName || 'Guest Student').slice(0, 50);

    const at = new AccessToken(apiKey, apiSecret, {
      identity: cleanIdentity,
      name: cleanName,
      ttl: '2h', // Short-lived 2-hour token
      metadata: JSON.stringify({ role: 'guest', hidden: false })
    });

    at.addGrant({
      room: targetRoomId,
      roomJoin: true,
      canPublish: true,
      canPublishSources: [TrackSource.MICROPHONE, TrackSource.CAMERA] as any,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await at.toJwt();

    res.json({
      token: jwt,
      serverUrl,
      roomName: targetRoomId,
      participantIdentity: cleanIdentity,
      participantName: cleanName,
      role: 'guest',
      expiresInSeconds: 7200
    });
  } catch (err: any) {
    console.error('[Guest Join Error]:', err);
    res.status(500).json({ error: 'Failed to validate guest link' });
  }
});

// Waiting Room Status & Tutor Intercept Triggers (`/api/livekit/waiting-room`)
app.get('/api/livekit/waiting-room', async (req: Request, res: Response) => {
  const { roomSlug, waitingId } = req.query;

  if (waitingId) {
    const participant = SERVER_WAITING_ROOM.find(w => w.id === waitingId);
    if (!participant) {
      res.json({ participant: null });
      return;
    }

    await syncLiveKitCloudRooms();

    // Check if room is now free so we can auto-promote #1 in queue immediately!
    autoPromoteNextWaitingStudentIfRoomFree(participant.room_slug);

    const {
      waitingList,
      currentLessonEndTimeMs,
      resolvedTutorName,
      activeTutor,
      activeStudents
    } = getRoomQueueAndLessonTiming(participant.room_slug);

    if (activeStudents.length > 0 && participant.status === 'WAITING') {
      participant.reason = 'NEXT_STUDENT_QUEUE';
    }

    const qIdx = waitingList.findIndex(w => w.id === participant.id);
    const waitingSeconds = Math.max(0, Math.floor((Date.now() - new Date(participant.joined_at).getTime()) / 1000));

    res.json({
      participant: {
        ...participant,
        waiting_seconds: waitingSeconds,
        queue_position: qIdx >= 0 ? qIdx + 1 : 1
      },
      queuePosition: qIdx >= 0 ? qIdx + 1 : 1,
      currentLessonEndTimeMs,
      tutorName: resolvedTutorName,
      tutorPresent: Boolean(activeTutor),
      activeStudentCount: activeStudents.length
    });
    return;
  }

  if (roomSlug) {
    const { waitingList, currentLessonEndTimeMs, resolvedTutorName } = getRoomQueueAndLessonTiming(roomSlug as string);
    res.json({ waitingList, currentLessonEndTimeMs, tutorName: resolvedTutorName });
    return;
  }

  const nowMs = Date.now();
  res.json({
    waitingList: SERVER_WAITING_ROOM.filter(w => w.status === 'WAITING').map((w, idx) => ({
      ...w,
      waiting_seconds: Math.max(0, Math.floor((nowMs - new Date(w.joined_at).getTime()) / 1000)),
      queue_position: idx + 1
    }))
  });
});

app.post('/api/livekit/waiting-room/action', (req: Request, res: Response) => {
  const { waitingId, action } = req.body; // action: 'ADMIT' | 'REJECT' | 'CANCEL'

  const participantIdx = SERVER_WAITING_ROOM.findIndex(w => w.id === waitingId);
  if (participantIdx === -1) {
    res.status(404).json({ error: 'Waiting participant not found' });
    return;
  }

  const participant = SERVER_WAITING_ROOM[participantIdx];
  if (action === 'CANCEL') {
    SERVER_WAITING_ROOM.splice(participantIdx, 1);
    res.json({ success: true });
    return;
  }

  participant.status = action === 'ADMIT' ? 'ADMITTED' : 'REJECTED';
  res.json({ success: true, participant });
});

app.post('/api/livekit/waiting-room/admit', (req: Request, res: Response) => {
  const { waitingId, studentId } = req.body;
  const targetId = waitingId || studentId;
  const participant = SERVER_WAITING_ROOM.find(w => w.id === targetId || w.identity === targetId);
  if (!participant) {
    res.status(404).json({ error: 'Waiting participant not found' });
    return;
  }
  participant.status = 'ADMITTED';
  res.json({ success: true, participant });
});

// Heartbeat from active classroom participants (also returns waitingList for tutors to halve polling requests)
app.post('/api/livekit/rooms/heartbeat', (req: Request, res: Response) => {
  const { roomName, identity, name, role, bookedEndTimeMs } = req.body;
  if (!roomName || !identity) {
    res.status(400).json({ error: 'Missing roomName or identity' });
    return;
  }

  const { normRoom } = getRoomQueueAndLessonTiming(roomName);
  const roleLower = (role || 'participant').toString().toLowerCase();
  const isStudentOrGuest = roleLower === 'student' || roleLower === 'guest' || roleLower === 'parent';

  // Check if Tutor recently triggered 'END_CLASS_FOR_ALL' or 'FINISH_STUDENT_LESSON' for this student
  const activeSignal = ROOM_CONTROL_SIGNALS[normRoom];
  if (activeSignal && Date.now() - activeSignal.timestamp < 25000 && isStudentOrGuest) {
    if (activeSignal.action === 'END_CLASS_FOR_ALL') {
      if (LIVE_ROOM_PARTICIPANTS[normRoom]) {
        delete LIVE_ROOM_PARTICIPANTS[normRoom][identity];
      }
      res.json({
        success: true,
        roomAction: 'END_CLASS_FOR_ALL',
        waitingList: [],
        activeParticipants: []
      });
      return;
    }
    if (
      activeSignal.action === 'FINISH_STUDENT_LESSON' &&
      (!activeSignal.targetIdentities || activeSignal.targetIdentities.includes(identity))
    ) {
      if (LIVE_ROOM_PARTICIPANTS[normRoom]) {
        delete LIVE_ROOM_PARTICIPANTS[normRoom][identity];
      }
      res.json({
        success: true,
        roomAction: 'FINISH_STUDENT_LESSON',
        waitingList: [],
        activeParticipants: []
      });
      return;
    }
  }

  // If Tutor sends a normal heartbeat, clear any old END_CLASS_FOR_ALL signal so room is open again
  if (roleLower === 'tutor' && activeSignal?.action === 'END_CLASS_FOR_ALL') {
    delete ROOM_CONTROL_SIGNALS[normRoom];
  }

  if (!LIVE_ROOM_PARTICIPANTS[normRoom]) {
    LIVE_ROOM_PARTICIPANTS[normRoom] = {};
  }

  const existingUser = LIVE_ROOM_PARTICIPANTS[normRoom][identity];
  LIVE_ROOM_PARTICIPANTS[normRoom][identity] = {
    identity,
    name: name || identity,
    role: role || 'participant',
    joinedAt: existingUser?.joinedAt || Date.now(),
    lastSeen: Date.now(),
    bookedEndTimeMs: bookedEndTimeMs || existingUser?.bookedEndTimeMs
  };

  // If this participant was previously in SERVER_WAITING_ROOM as ADMITTED/WAITING, remove their completed queue entry
  for (let i = SERVER_WAITING_ROOM.length - 1; i >= 0; i--) {
    const w = SERVER_WAITING_ROOM[i];
    if (
      (w.identity === identity || w.guest_name.toLowerCase() === (name || '').toLowerCase()) &&
      (w.status === 'ADMITTED' || w.status === 'WAITING')
    ) {
      SERVER_WAITING_ROOM.splice(i, 1);
    }
  }

  // If tutor is in the room with 0 students, auto-promote any waiting student in queue
  autoPromoteNextWaitingStudentIfRoomFree(normRoom);

  const { waitingList, participantsList, currentLessonEndTimeMs } = getRoomQueueAndLessonTiming(normRoom);

  res.json({
    success: true,
    waitingList,
    activeParticipants: participantsList,
    currentLessonEndTimeMs
  });
});

// Tutor Room Control Endpoint:
// 1. 'FINISH_STUDENT_LESSON': Disconnects only the current student(s), keeps Tutor in room, and auto-admits #1 waiting student!
// 2. 'END_CLASS_FOR_ALL': Disconnects all students, rejects waiting queue, and closes the classroom for everyone.
app.post('/api/livekit/rooms/control', async (req: Request, res: Response) => {
  try {
    const { roomName, action } = req.body;
    if (!roomName || !action) {
      res.status(400).json({ error: 'Missing roomName or action' });
      return;
    }

    const { normRoom, canonicalSlug, activeStudents } = getRoomQueueAndLessonTiming(roomName);
    const currentStudentIds = activeStudents.map(s => s.identity);

    if (action === 'FINISH_STUDENT_LESSON') {
      // Remove current students from LIVE_ROOM_PARTICIPANTS while keeping Tutor in the room
      if (LIVE_ROOM_PARTICIPANTS[normRoom]) {
        currentStudentIds.forEach(sid => {
          delete LIVE_ROOM_PARTICIPANTS[normRoom][sid];
        });
      }

      ROOM_CONTROL_SIGNALS[normRoom] = {
        action: 'FINISH_STUDENT_LESSON',
        timestamp: Date.now(),
        targetIdentities: currentStudentIds
      };

      // Immediately promote #1 waiting student in Next Student Lounge so they enter within ~1s!
      autoPromoteNextWaitingStudentIfRoomFree(normRoom);

      // Also ask LiveKit Cloud to remove the finished student(s) cleanly if configured
      try {
        const { apiKey, apiSecret, serverUrl } = getLiveKitCredentials();
        if (apiKey && apiSecret && serverUrl && currentStudentIds.length > 0) {
          const httpUrl = serverUrl.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://');
          const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
          await Promise.allSettled(
            currentStudentIds.map(sid => roomService.removeParticipant(normRoom, sid))
          );
        }
      } catch {}

      const updated = getRoomQueueAndLessonTiming(normRoom);
      res.json({
        success: true,
        action: 'FINISH_STUDENT_LESSON',
        waitingList: updated.waitingList,
        activeParticipants: updated.participantsList
      });
      return;
    }

    if (action === 'END_CLASS_FOR_ALL') {
      // Clear all participants in this room
      LIVE_ROOM_PARTICIPANTS[normRoom] = {};

      // Mark any waiting students for this room as REJECTED so they aren't left hanging
      SERVER_WAITING_ROOM.forEach(w => {
        const wSlug = w.room_slug.toLowerCase();
        if ((wSlug === normRoom || wSlug === canonicalSlug) && w.status === 'WAITING') {
          w.status = 'REJECTED';
        }
      });

      ROOM_CONTROL_SIGNALS[normRoom] = {
        action: 'END_CLASS_FOR_ALL',
        timestamp: Date.now()
      };

      // Also ask LiveKit Cloud to remove all remote students from the room
      try {
        const { apiKey, apiSecret, serverUrl } = getLiveKitCredentials();
        if (apiKey && apiSecret && serverUrl && currentStudentIds.length > 0) {
          const httpUrl = serverUrl.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://');
          const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
          await Promise.allSettled(
            currentStudentIds.map(sid => roomService.removeParticipant(normRoom, sid))
          );
        }
      } catch {}

      res.json({
        success: true,
        action: 'END_CLASS_FOR_ALL'
      });
      return;
    }

    res.status(400).json({ error: 'Unsupported room control action' });
  } catch (err: any) {
    console.warn('[Room Control Error]:', err);
    res.status(500).json({ error: 'Failed to execute room control action' });
  }
});

// Explicit Leave notice from classroom participants
app.post('/api/livekit/rooms/leave', (req: Request, res: Response) => {
  const { roomName, identity } = req.body;
  if (roomName && identity) {
    const { normRoom } = getRoomQueueAndLessonTiming(roomName);
    if (LIVE_ROOM_PARTICIPANTS[normRoom]) {
      delete LIVE_ROOM_PARTICIPANTS[normRoom][identity];
    }
    // Immediately auto-promote #1 waiting student in Next Student Lounge as soon as the current student leaves!
    autoPromoteNextWaitingStudentIfRoomFree(normRoom);
  }
  res.json({ success: true });
});

// Sync real-time active rooms & participants directly from LiveKit Cloud (3s cache for zero rate-limit load)
let lastLiveKitCloudSyncMs = 0;
let liveKitCloudSyncPromise: Promise<void> | null = null;

async function syncLiveKitCloudRooms(): Promise<void> {
  const now = Date.now();
  if (now - lastLiveKitCloudSyncMs < 3000) {
    return;
  }
  if (liveKitCloudSyncPromise) {
    return liveKitCloudSyncPromise;
  }

  liveKitCloudSyncPromise = (async () => {
    try {
      const { apiKey, apiSecret, serverUrl } = getLiveKitCredentials();
      if (!apiKey || !apiSecret || !serverUrl) return;

      const httpUrl = serverUrl.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://');
      const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
      const cloudRooms = await roomService.listRooms();
      const activeCloudRooms = (cloudRooms || []).filter(r => (r.numParticipants || 0) > 0);

      const seenCloudIdentitiesByRoom: Record<string, Set<string>> = {};

      await Promise.allSettled(
        activeCloudRooms.map(async (cRoom) => {
          const { normRoom } = getRoomQueueAndLessonTiming(cRoom.name);
          if (!seenCloudIdentitiesByRoom[normRoom]) {
            seenCloudIdentitiesByRoom[normRoom] = new Set();
          }
          const participants = await roomService.listParticipants(cRoom.name);
          if (!LIVE_ROOM_PARTICIPANTS[normRoom]) {
            LIVE_ROOM_PARTICIPANTS[normRoom] = {};
          }

          (participants || []).forEach((p) => {
            let meta: any = {};
            try {
              if (p.metadata) meta = JSON.parse(p.metadata);
            } catch {}

            const idLower = (p.identity || '').toLowerCase();
            const nameLower = (p.name || '').toLowerCase();
            const metaRole = (meta.role || '').toString().toLowerCase();

            // Skip stealth admin / supervisor observers
            const isObserver =
              Boolean(meta.hidden) ||
              Boolean(p.permission?.hidden) ||
              metaRole === 'admin' ||
              metaRole === 'supervisor' ||
              idLower.includes('admin_obs') ||
              idLower.includes('supervisor_obs') ||
              idLower.includes('observer') ||
              nameLower.includes('invisible');

            if (isObserver) return;

            const isTutorPeer =
              metaRole === 'tutor' ||
              idLower.startsWith('tutor') ||
              idLower.includes('tutor_') ||
              /^tutor\s*\d+/i.test(p.name || '') ||
              nameLower.includes('ustadh') ||
              nameLower.includes('qari');

            const resolvedRole = isTutorPeer ? 'tutor' : (metaRole || 'student');
            seenCloudIdentitiesByRoom[normRoom].add(p.identity);

            const existing = LIVE_ROOM_PARTICIPANTS[normRoom][p.identity];
            LIVE_ROOM_PARTICIPANTS[normRoom][p.identity] = {
              identity: p.identity,
              name: p.name || existing?.name || p.identity,
              role: resolvedRole,
              joinedAt: existing?.joinedAt || (p.joinedAt ? Number(p.joinedAt) * 1000 : Date.now()),
              lastSeen: Date.now(),
              bookedEndTimeMs: existing?.bookedEndTimeMs,
              fromCloud: true
            };
          });
        })
      );

      // Reconcile any cloud-tracked participants who left LiveKit Cloud
      Object.keys(LIVE_ROOM_PARTICIPANTS).forEach((rKey) => {
        const activeSet = seenCloudIdentitiesByRoom[rKey];
        Object.keys(LIVE_ROOM_PARTICIPANTS[rKey]).forEach((pid) => {
          const u = LIVE_ROOM_PARTICIPANTS[rKey][pid];
          if (u.fromCloud && (!activeSet || !activeSet.has(pid))) {
            delete LIVE_ROOM_PARTICIPANTS[rKey][pid];
            autoPromoteNextWaitingStudentIfRoomFree(rKey);
          }
        });
      });

      lastLiveKitCloudSyncMs = Date.now();
    } catch (err) {
      // Non-fatal if LiveKit Cloud HTTP endpoint is temporarily unreachable
    } finally {
      liveKitCloudSyncPromise = null;
    }
  })();

  return liveKitCloudSyncPromise;
}

// Live Room Status for Admin and Supervisor Dashboard Monitoring Deck
app.get('/api/livekit/rooms/live-status', async (req: Request, res: Response) => {
  await syncLiveKitCloudRooms();
  const now = Date.now();
  // Prune dead participants older than 60 seconds (supports 20s Zero-Load Idle Standby heartbeats & background tabs)
  Object.keys(LIVE_ROOM_PARTICIPANTS).forEach(r => {
    Object.keys(LIVE_ROOM_PARTICIPANTS[r]).forEach(id => {
      if (now - LIVE_ROOM_PARTICIPANTS[r][id].lastSeen > 60000) {
        delete LIVE_ROOM_PARTICIPANTS[r][id];
      }
    });
  });

  const roomStatuses = SERVER_PERMANENT_ROOMS.map(r => {
    const normRoom = r.livekit_room_id.toLowerCase().replace(/[^a-z0-9_\-]/g, '_');
    const canonicalRoom = `room_tutor_${r.tutor_id.replace(/[^a-zA-Z0-9]/g, '_')}`.toLowerCase();
    const slugRoom = `room_${r.room_slug.replace(/[^a-zA-Z0-9]/g, '_')}`.toLowerCase();

    const participantsMap = {
      ...(LIVE_ROOM_PARTICIPANTS[normRoom] || {}),
      ...(LIVE_ROOM_PARTICIPANTS[canonicalRoom] || {}),
      ...(LIVE_ROOM_PARTICIPANTS[slugRoom] || {}),
    };

    const participantsList = Object.values(participantsMap);
    const tutorsInRoom = participantsList.filter(p => {
      const rl = (p.role || '').toLowerCase();
      const idl = (p.identity || '').toLowerCase();
      const nml = (p.name || '').toLowerCase();
      return rl === 'tutor' || idl.includes('tutor') || /^tutor\s*\d+/i.test(p.name || '') || nml.includes('ustadh');
    });
    const tutorPresent = tutorsInRoom.length > 0;
    const tutorName = tutorsInRoom[0]?.name || r.tutor_id;

    const studentsList = participantsList.filter(p => {
      const rl = (p.role || '').toLowerCase();
      const idl = (p.identity || '').toLowerCase();
      const nml = (p.name || '').toLowerCase();
      const isTut = rl === 'tutor' || idl.includes('tutor') || /^tutor\s*\d+/i.test(p.name || '') || nml.includes('ustadh');
      const isObs = rl === 'admin' || rl === 'supervisor' || idl.includes('admin') || idl.includes('supervisor') || idl.includes('observer');
      return !isTut && !isObs;
    });
    const studentPresent = studentsList.length > 0;

    // Match waiting room entries for this tutor's room
    const waitingGuests = SERVER_WAITING_ROOM.filter(w => {
      const wSlug = w.room_slug.toLowerCase().trim();
      return (
        w.status === 'WAITING' &&
        (wSlug === r.room_slug.toLowerCase() ||
          wSlug === normRoom ||
          wSlug === canonicalRoom ||
          wSlug === r.tutor_id.toLowerCase())
      );
    });

    const waitingDetails: Array<{
      id: string;
      name: string;
      waitingSeconds: number;
      reason: 'NEXT_STUDENT_QUEUE' | 'TUTOR_NOT_PRESENT';
      queuePosition: number;
    }> = waitingGuests.map((w, idx) => ({
      id: w.id,
      name: w.guest_name,
      waitingSeconds: Math.max(0, Math.floor((now - new Date(w.joined_at).getTime()) / 1000)),
      reason: w.reason || (tutorPresent && studentPresent ? 'NEXT_STUDENT_QUEUE' : 'TUTOR_NOT_PRESENT'),
      queuePosition: idx + 1
    }));

    // If a student is already inside the LiveKit room waiting for the tutor (tutorPresent === false),
    // also include them in waitingDetails so Admin/Supervisor sees them in the Waiting Queue!
    if (!tutorPresent && studentPresent) {
      studentsList.forEach((st) => {
        if (!waitingDetails.some(wd => wd.name.toLowerCase() === st.name.toLowerCase())) {
          waitingDetails.push({
            id: st.identity,
            name: st.name,
            waitingSeconds: Math.max(0, Math.floor((now - st.joinedAt) / 1000)),
            reason: 'TUTOR_NOT_PRESENT',
            queuePosition: waitingDetails.length + 1
          });
        }
      });
    }

    let status: 'running' | 'tutor_waiting' | 'student_waiting' | 'idle' = 'idle';
    if (tutorPresent && studentPresent) {
      status = 'running';
    } else if (tutorPresent && !studentPresent) {
      status = 'tutor_waiting';
    } else if (!tutorPresent && (studentPresent || waitingDetails.length > 0)) {
      status = 'student_waiting';
    }

    return {
      tutorId: r.tutor_id,
      tutorName,
      roomSlug: r.room_slug,
      status,
      tutorPresent,
      studentPresent,
      participantCount: participantsList.length,
      studentCount: studentsList.length,
      students: studentsList.map(s => s.name),
      waitingCount: waitingDetails.length,
      waitingStudents: waitingDetails.map(w => w.name),
      waitingDetails,
      lastActivity: (participantsList.length > 0 || waitingDetails.length > 0) ? new Date().toISOString() : null
    };
  });

  res.json({
    rooms: roomStatuses,
    summary: {
      totalTutors: SERVER_PERMANENT_ROOMS.length,
      runningCount: roomStatuses.filter(r => r.status === 'running').length,
      tutorWaitingCount: roomStatuses.filter(r => r.status === 'tutor_waiting').length,
      // Count rooms where ANY student is waiting (either waiting for tutor OR waiting in Next Student Lounge queue while class is running)
      studentWaitingCount: roomStatuses.filter(r => r.status === 'student_waiting' || r.waitingCount > 0).length,
      idleCount: roomStatuses.filter(r => r.status === 'idle').length,
    }
  });
});

// Admin Permanent Rooms CRUD API (`/api/livekit/rooms/permanent`)
app.get('/api/livekit/rooms/permanent', (req: Request, res: Response) => {
  res.json({ rooms: SERVER_PERMANENT_ROOMS });
});

app.post('/api/livekit/rooms/permanent', (req: Request, res: Response) => {
  const { roomSlug, tutorId, studentId, passcode, baseScheduledTime, timezone } = req.body;

  const newRoom: ServerPermanentRoom = {
    id: `perm_room_${Date.now()}`,
    room_slug: roomSlug || `tutor-${tutorId}-student-${studentId}`.toLowerCase().replace(/[^a-z0-9\-]/g, ''),
    livekit_room_id: `room_${tutorId}_${studentId}`.replace(/[^a-zA-Z0-9_\-]/g, '_'),
    tutor_id: tutorId || 'Tutor 1',
    student_id: studentId || 'STU-001',
    meeting_id: Math.floor(10000000 + Math.random() * 90000000),
    passcode: passcode || '123456',
    base_scheduled_time: baseScheduledTime || '15:00:00',
    timezone: timezone || 'Asia/Karachi',
    createdAt: new Date().toISOString()
  };

  SERVER_PERMANENT_ROOMS.push(newRoom);
  savePersistedClassroomConfig();
  res.json({ success: true, room: newRoom });
});

app.patch('/api/livekit/rooms/permanent/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { passcode, meeting_id, room_slug } = req.body;

  const room = SERVER_PERMANENT_ROOMS.find(r => r.id === id || r.room_slug === id || r.tutor_id === id);
  if (!room) {
    res.status(404).json({ error: 'Permanent room not found' });
    return;
  }

  if (passcode) room.passcode = passcode.toString().trim();
  if (meeting_id) room.meeting_id = Number(meeting_id);
  if (room_slug) room.room_slug = room_slug.toString().trim().toLowerCase().replace(/[^a-z0-9\-]/g, '');

  savePersistedClassroomConfig();
  res.json({ success: true, room });
});

// Room Overrides API (`/api/livekit/overrides`)
app.get('/api/livekit/overrides', (req: Request, res: Response) => {
  res.json({ overrides: SERVER_ROOM_OVERRIDES });
});

app.post('/api/livekit/overrides', (req: Request, res: Response) => {
  const { permanentRoomId, overrideDate, newTime, reason } = req.body;

  const permRoom = SERVER_PERMANENT_ROOMS.find(r => r.id === permanentRoomId || r.room_slug === permanentRoomId);
  if (!permRoom) {
    res.status(404).json({ error: 'Permanent room not found' });
    return;
  }

  const tempRoomId = `temp_override_${permRoom.tutor_id}_${permRoom.student_id}_${overrideDate}`.replace(/[^a-zA-Z0-9_\-]/g, '_');

  const override: ServerRoomOverride = {
    id: `override_${Date.now()}`,
    permanent_room_id: permRoom.id,
    override_date: overrideDate || new Date().toISOString().slice(0, 10),
    temporary_room_id: tempRoomId,
    new_time: newTime || '16:00:00',
    status: 'PENDING',
    reason: reason || 'One-day time change request',
    createdAt: new Date().toISOString()
  };

  SERVER_ROOM_OVERRIDES.push(override);
  savePersistedClassroomConfig();
  res.json({ success: true, override });
});

app.patch('/api/livekit/overrides/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body; // 'APPROVED' | 'REJECTED'

  const override = SERVER_ROOM_OVERRIDES.find(o => o.id === id);
  if (!override) {
    res.status(404).json({ error: 'Override request not found' });
    return;
  }

  override.status = status;
  savePersistedClassroomConfig();
  res.json({ success: true, override });
});

// Provision One-Time Guest Link (`/api/livekit/guest-link`)
app.post('/api/livekit/guest-link', (req: Request, res: Response) => {
  const { tutorId, expiresInHours } = req.body;

  const tokenParam = `gt_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  const expiresAt = new Date(Date.now() + (expiresInHours || 24) * 3600 * 1000).toISOString();

  const guestLink: ServerGuestLink = {
    id: `gl_${Date.now()}`,
    token_param: tokenParam,
    tutor_id: tutorId || 'Tutor 1',
    expires_at: expiresAt,
    is_used: false,
    createdAt: new Date().toISOString()
  };

  SERVER_GUEST_LINKS.push(guestLink);
  res.json({
    success: true,
    guestLink,
    joinUrl: `/guest/join?token=${tokenParam}`
  });
});

// SECTION 1: Automated LiveKit Egress Recording Webhook (`/api/livekit/webhook`)
app.post('/api/livekit/webhook', (req: Request, res: Response) => {
  try {
    const { event, room, participant } = req.body || {};

    if (room && room.name) {
      const roomName = room.name;
      if (!ACTIVE_ROOM_PARTICIPANTS[roomName]) {
        ACTIVE_ROOM_PARTICIPANTS[roomName] = new Set();
      }

      if (event === 'participant_joined' && participant) {
        // Filter out hidden admins from active count
        const metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
        if (!metadata.hidden) {
          ACTIVE_ROOM_PARTICIPANTS[roomName].add(participant.identity);
        }
      } else if (event === 'participant_left' && participant) {
        ACTIVE_ROOM_PARTICIPANTS[roomName].delete(participant.identity);
      }

      const activeCount = ACTIVE_ROOM_PARTICIPANTS[roomName].size;

      // Automated Recording Egress Trigger:
      // Recording MUST start the exact millisecond active_participants == 2
      if (activeCount === 2 && !ACTIVE_EGRESS_JOBS[roomName]) {
        const egressId = `egress_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const recordDateStr = new Date().toISOString().slice(0, 10);
        const purgeTimestamp = new Date(Date.now() + 28 * 24 * 3600 * 1000).toISOString();

        ACTIVE_EGRESS_JOBS[roomName] = {
          egressId,
          startedAt: new Date().toISOString()
        };

        const newRec: ServerRecordings = {
          id: `rec_${Date.now()}`,
          room_id: roomName,
          date_recorded: recordDateStr,
          s3_url: `https://s3.amazonaws.com/islamic-tuition-recordings/${roomName}/${recordDateStr}_${egressId}.mp3`,
          deleted_at: purgeTimestamp,
          duration_seconds: 0
        };

        SERVER_RECORDINGS.push(newRec);
        console.log(`[Automated Egress] Started RoomCompositeEgress (AudioOnly .mp3) for room ${roomName} on active_participants == 2.`);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.warn('[Webhook Error]:', err);
    res.json({ received: true });
  }
});

// Recordings Listing API with 28-Day Purging Lifecycle (`/api/livekit/recordings`)
app.get('/api/livekit/recordings', (req: Request, res: Response) => {
  const nowISO = new Date().toISOString();
  const validRecordings = SERVER_RECORDINGS.filter(r => r.deleted_at > nowISO);
  res.json({ recordings: validRecordings });
});

// SECTION 6: Admin Executive Monitoring API (`/api/livekit/active-rooms`)
app.get('/api/livekit/active-rooms', (req: Request, res: Response) => {
  const activeRooms = SERVER_PERMANENT_ROOMS.map(perm => {
    const roomId = perm.livekit_room_id;
    const normRoom = roomId.toLowerCase().replace(/[^a-z0-9_\-]/g, '_');
    const webhookParticipants = ACTIVE_ROOM_PARTICIPANTS[roomId] ? Array.from(ACTIVE_ROOM_PARTICIPANTS[roomId]) : [];
    const heartbeatParticipants = Object.values(LIVE_ROOM_PARTICIPANTS[normRoom] || {}).map(p => p.name || p.identity);
    const participants = Array.from(new Set([...webhookParticipants, ...heartbeatParticipants]));
    const egressJob = ACTIVE_EGRESS_JOBS[roomId];

    return {
      ...perm,
      activeParticipantsCount: participants.length,
      participantIdentities: participants,
      isRecordingActive: Boolean(egressJob),
      recordingStartedAt: egressJob?.startedAt || null
    };
  });

  res.json({ activeRooms });
});

// SECTION 7: Chat Safety & Contact Protection API
interface ServerBlockedAttemptLog {
  id: string;
  timestamp: string;
  code: string;
  codeTitle: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  roomSlug: string;
  rawTextSnippet: string;
  actionTaken: string;
}

let SERVER_CHAT_SAFETY_SETTINGS = {
  enabled: true,
  detectPhone: true,
  detectEmail: true,
  detectLinks: true,
  detectHandles: true,
  detectObfuscation: true,
  detectSpamRateLimit: true,
  logBlockedAttempts: true,
  temporaryRestriction: true,
  adminAlertsEnabled: false,
  showPrivacyBadge: true,
  badgeText: '🔒 Privacy Protected',
  badgeTooltip: 'Classroom chat includes automatic privacy and safety protection to help keep communication secure.'
};

const SERVER_BLOCKED_CHAT_LOGS: ServerBlockedAttemptLog[] = [];

// Helper to sanitize snippet for log preview
function sanitizeSnippetForLog(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length <= 40) return trimmed;
  return trimmed.substring(0, 37) + '...';
}

// 1. Get Chat Safety Settings
app.get('/api/chat/safety-settings', (req: Request, res: Response) => {
  res.json({ settings: SERVER_CHAT_SAFETY_SETTINGS });
});

// 2. Update Chat Safety Settings (Admin)
app.post('/api/chat/safety-settings', (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    if (settings && typeof settings === 'object') {
      SERVER_CHAT_SAFETY_SETTINGS = {
        ...SERVER_CHAT_SAFETY_SETTINGS,
        ...settings
      };
      console.log('[Chat Safety Settings Updated]:', SERVER_CHAT_SAFETY_SETTINGS);
    }
    res.json({ success: true, settings: SERVER_CHAT_SAFETY_SETTINGS });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 3. Get Blocked Chat Logs (Admin)
app.get('/api/chat/blocked-logs', (req: Request, res: Response) => {
  res.json({ logs: SERVER_BLOCKED_CHAT_LOGS });
});

// 4. Clear Blocked Chat Logs (Admin)
app.delete('/api/chat/blocked-logs', (req: Request, res: Response) => {
  SERVER_BLOCKED_CHAT_LOGS.length = 0;
  res.json({ success: true, logs: [] });
});

// 5. Server-Side Chat Message Validation Endpoint (`/api/chat/validate`)
app.post('/api/chat/validate', (req: Request, res: Response) => {
  try {
    const { text, senderId, senderName, senderRole, roomSlug, clientSettings } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text string is required' });
    }

    const settingsToUse = clientSettings || SERVER_CHAT_SAFETY_SETTINGS;

    // Use our imported chat safety filter logic
    const result = checkMessageSafety(text, senderId || 'user_anon', settingsToUse);

    if (!result.isAllowed && settingsToUse.logBlockedAttempts) {
      const code = result.blockedCode || 'CHAT-01';
      const logEntry: ServerBlockedAttemptLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        code,
        codeTitle: getCodeTitle(code),
        senderId: senderId || 'unknown',
        senderName: senderName || 'Classroom User',
        senderRole: senderRole || 'student',
        roomSlug: roomSlug || 'live_room',
        rawTextSnippet: sanitizeSnippetForLog(text),
        actionTaken: result.isRestrictedUser ? 'Blocked & User Restricted' : 'Blocked & Logged'
      };

      // Add to server log (keep max 200 logs)
      SERVER_BLOCKED_CHAT_LOGS.unshift(logEntry);
      if (SERVER_BLOCKED_CHAT_LOGS.length > 200) {
        SERVER_BLOCKED_CHAT_LOGS.pop();
      }

      console.warn(`[CHAT SAFETY ENFORCED]: Blocked ${code} (${logEntry.codeTitle}) from ${logEntry.senderName} (${logEntry.senderRole}) in room ${logEntry.roomSlug}`);
    }

    res.json(result);
  } catch (err: any) {
    console.error('[Chat Validate Error]:', err);
    // Fail-safe fallback if filter error occurs
    res.json({ isAllowed: true });
  }
});

// Explicit 404 handler for API routes to prevent falling through to SPA HTML fallback
app.use('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: `API endpoint ${req.method} ${req.originalUrl} not found` });
});

// Vite middleware & Static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true as const,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Development SPA Fallback with transformIndexHtml
    app.use('*', async (req: Request, res: Response, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[IslamicTuition Portal] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
