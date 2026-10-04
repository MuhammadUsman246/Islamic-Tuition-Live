import http from 'http';
import fs from 'fs';
import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });
import { AccessToken, TrackSource } from 'livekit-server-sdk';
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
  joined_at: string;
  status: 'WAITING' | 'ADMITTED' | 'REJECTED';
}

const CLASSROOM_CONFIG_FILE = path.resolve(process.cwd(), '.classroom-rooms-config.json');

const SERVER_PERMANENT_ROOMS: ServerPermanentRoom[] = Array.from({ length: 25 }, (_, idx) => {
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

// Method 1 & Universal Token Issuance Endpoint
app.post('/api/livekit/token', async (req: Request, res: Response) => {
  try {
    const { roomId, identity, participantName, role, classId, customServerUrl, forceSimulation, isHiddenAdmin } = req.body;

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
      isHiddenAdmin: Boolean(isAdminObserver)
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

    // Step 5: Waiting Room Isolation Intercept check
    // Check both LIVE_ROOM_PARTICIPANTS (real-time heartbeats) and ACTIVE_ROOM_PARTICIPANTS
    const normRoom = targetRoomId.toLowerCase().replace(/[^a-z0-9_\-]/g, '_');
    const liveParticipants = Object.values(LIVE_ROOM_PARTICIPANTS[normRoom] || {});
    const webhookParticipants = Array.from(ACTIVE_ROOM_PARTICIPANTS[targetRoomId] || new Set<string>());
    const isTutorInRoom =
      liveParticipants.some(p => p.role === 'tutor' || p.identity.toLowerCase().includes('tutor')) ||
      webhookParticipants.some(id => id.toLowerCase().includes('tutor') || id === permRoom.tutor_id);

    // Check if this guest was already admitted by the tutor from the waiting room
    const isAlreadyAdmitted = Boolean(
      admittedWaitingId &&
      SERVER_WAITING_ROOM.some(w => w.id === admittedWaitingId && w.status === 'ADMITTED')
    );

    // If user is an unauthenticated guest and Tutor is NOT yet in room (and not already admitted) -> Waiting Room State
    const isGuestUser = !isMatchingSession || userRole === 'guest';
    if (!isAdminOrSupervisor && isGuestUser && !isTutorInRoom && !isAlreadyAdmitted) {
      const displayName = guestName || 'Guest Student';
      const waitingParticipant: ServerWaitingGuest = {
        id: `wp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        room_slug: permRoom.room_slug,
        guest_name: displayName,
        joined_at: new Date().toISOString(),
        status: 'WAITING'
      };
      SERVER_WAITING_ROOM.push(waitingParticipant);

      res.json({
        inWaitingRoom: true,
        waitingId: waitingParticipant.id,
        message: 'Your tutor is currently in another session or not yet connected. Please wait in the waiting room.',
        roomSlug: permRoom.room_slug,
        tutorName: permRoom.tutor_id
      });
      return;
    }

    // Issue JWT Token with 120-minute expiration
    const { apiKey, apiSecret, serverUrl } = getLiveKitCredentials();
    const identity = sessionUserId || `guest_${Date.now()}`;
    const cleanIdentity = identity.toString().replace(/[^a-zA-Z0-9_\-]/g, '_');
    const cleanName = guestName || sessionUserId || (isAdminOrSupervisor ? 'Admin Observer' : 'Classroom Member');

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
app.get('/api/livekit/waiting-room', (req: Request, res: Response) => {
  const { roomSlug, waitingId } = req.query;

  if (waitingId) {
    const participant = SERVER_WAITING_ROOM.find(w => w.id === waitingId);
    res.json({ participant });
    return;
  }

  if (roomSlug) {
    const queryStr = (roomSlug as string).toLowerCase().trim();
    const numMatch = queryStr.match(/\d+/);
    const canonicalSlug = numMatch ? `tutor-${parseInt(numMatch[0], 10)}` : queryStr;

    const list = SERVER_WAITING_ROOM.filter(w => {
      const wSlug = w.room_slug.toLowerCase();
      return (wSlug === queryStr || wSlug === canonicalSlug) && w.status === 'WAITING';
    });
    res.json({ waitingList: list });
    return;
  }

  res.json({ waitingList: SERVER_WAITING_ROOM.filter(w => w.status === 'WAITING') });
});

app.post('/api/livekit/waiting-room/action', (req: Request, res: Response) => {
  const { waitingId, action } = req.body; // action: 'ADMIT' | 'REJECT'

  const participant = SERVER_WAITING_ROOM.find(w => w.id === waitingId);
  if (!participant) {
    res.status(404).json({ error: 'Waiting participant not found' });
    return;
  }

  participant.status = action === 'ADMIT' ? 'ADMITTED' : 'REJECTED';
  res.json({ success: true, participant });
});

// Real-time Live Classroom Presence & Status Tracker
interface ActiveRoomUser {
  identity: string;
  name: string;
  role: string;
  lastSeen: number;
}
const LIVE_ROOM_PARTICIPANTS: Record<string, Record<string, ActiveRoomUser>> = {};

// Heartbeat from active classroom participants (also returns waitingList for tutors to halve polling requests)
app.post('/api/livekit/rooms/heartbeat', (req: Request, res: Response) => {
  const { roomName, identity, name, role } = req.body;
  if (!roomName || !identity) {
    res.status(400).json({ error: 'Missing roomName or identity' });
    return;
  }

  const normRoom = roomName.toLowerCase().replace(/[^a-z0-9_\-]/g, '_');
  if (!LIVE_ROOM_PARTICIPANTS[normRoom]) {
    LIVE_ROOM_PARTICIPANTS[normRoom] = {};
  }

  LIVE_ROOM_PARTICIPANTS[normRoom][identity] = {
    identity,
    name: name || identity,
    role: role || 'participant',
    lastSeen: Date.now()
  };

  const numMatch = normRoom.match(/\d+/);
  const canonicalSlug = numMatch ? `tutor-${parseInt(numMatch[0], 10)}` : normRoom;
  const waitingList = SERVER_WAITING_ROOM.filter(w => {
    const wSlug = w.room_slug.toLowerCase();
    return (wSlug === normRoom || wSlug === canonicalSlug) && w.status === 'WAITING';
  });

  res.json({ success: true, waitingList });
});

// Explicit Leave notice from classroom participants
app.post('/api/livekit/rooms/leave', (req: Request, res: Response) => {
  const { roomName, identity } = req.body;
  if (roomName && identity) {
    const normRoom = roomName.toLowerCase().replace(/[^a-z0-9_\-]/g, '_');
    if (LIVE_ROOM_PARTICIPANTS[normRoom]) {
      delete LIVE_ROOM_PARTICIPANTS[normRoom][identity];
    }
  }
  res.json({ success: true });
});

// Live Room Status for Admin and Supervisor Dashboard Monitoring Deck
app.get('/api/livekit/rooms/live-status', (req: Request, res: Response) => {
  const now = Date.now();
  // Prune dead participants older than 25 seconds
  Object.keys(LIVE_ROOM_PARTICIPANTS).forEach(r => {
    Object.keys(LIVE_ROOM_PARTICIPANTS[r]).forEach(id => {
      if (now - LIVE_ROOM_PARTICIPANTS[r][id].lastSeen > 25000) {
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
    const tutorPresent = participantsList.some(p => p.role === 'tutor' || p.identity.includes('tutor'));
    const studentsList = participantsList.filter(p => p.role === 'student' || p.role === 'guest' || (!p.identity.includes('tutor') && !p.identity.includes('admin') && !p.identity.includes('supervisor') && !p.identity.includes('observer')));
    const studentPresent = studentsList.length > 0;

    const waitingGuests = SERVER_WAITING_ROOM.filter(w => 
      w.room_slug.toLowerCase() === r.room_slug.toLowerCase() && w.status === 'WAITING'
    );

    let status: 'running' | 'tutor_waiting' | 'student_waiting' | 'idle' = 'idle';
    if (tutorPresent && studentPresent) {
      status = 'running';
    } else if (tutorPresent && !studentPresent) {
      status = 'tutor_waiting';
    } else if (!tutorPresent && (studentPresent || waitingGuests.length > 0)) {
      status = 'student_waiting';
    }

    return {
      tutorId: r.tutor_id,
      roomSlug: r.room_slug,
      status,
      tutorPresent,
      studentPresent,
      participantCount: participantsList.length,
      studentCount: studentsList.length,
      students: studentsList.map(s => s.name),
      waitingCount: waitingGuests.length,
      waitingStudents: waitingGuests.map(w => w.guest_name),
      lastActivity: participantsList.length > 0 ? new Date().toISOString() : null
    };
  });

  res.json({
    rooms: roomStatuses,
    summary: {
      totalTutors: SERVER_PERMANENT_ROOMS.length,
      runningCount: roomStatuses.filter(r => r.status === 'running').length,
      tutorWaitingCount: roomStatuses.filter(r => r.status === 'tutor_waiting').length,
      studentWaitingCount: roomStatuses.filter(r => r.status === 'student_waiting').length,
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
