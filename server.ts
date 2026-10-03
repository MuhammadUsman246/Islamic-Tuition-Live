import http from 'http';
import fs from 'fs';
import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ override: true });
import { AccessToken, TrackSource } from 'livekit-server-sdk';
import { createServer as createViteServer } from 'vite';

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

// LiveKit Server Configuration Status
app.get('/api/livekit/status', (req: Request, res: Response) => {
  const apiKey = (process.env.LIVEKIT_API_KEY || '').trim();
  const apiSecret = (process.env.LIVEKIT_API_SECRET || '').trim();
  const serverUrl = (process.env.LIVEKIT_URL || process.env.VITE_LIVEKIT_URL || '').trim();

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
    isMaskedSecret,
    isMaskedKey,
    secretWarning: isMaskedSecret
      ? 'The LIVEKIT_API_SECRET contains hidden bullet dots (••••). In LiveKit Cloud console, click the Copy or Eye icon to copy the real revealed secret.'
      : null,
    environment: isConfigured ? environment : 'unconfigured',
  });
});

// LiveKit Token Issuer Endpoint (Short-lived, Role-Enforced, Secure)
app.post('/api/livekit/token', async (req: Request, res: Response) => {
  try {
    const { roomId, identity, participantName, role, classId, customServerUrl, forceSimulation } = req.body;

    if (!roomId || typeof roomId !== 'string') {
      res.status(400).json({ error: 'Missing or invalid roomId' });
      return;
    }

    const cleanRoom = roomId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64);
    const cleanIdentity = (identity || `user_${Date.now()}`).toString().replace(/[^a-zA-Z0-9_\-]/g, '_');
    const cleanName = (participantName || cleanIdentity).toString().slice(0, 50);
    const userRole = (role || 'student').toString().toLowerCase();

    const apiKey = (process.env.LIVEKIT_API_KEY || '').trim();
    const apiSecret = (process.env.LIVEKIT_API_SECRET || '').trim();
    const serverUrl = (customServerUrl || process.env.LIVEKIT_URL || process.env.VITE_LIVEKIT_URL || '').trim();

    const isMaskedSecret = isMaskedValue(apiSecret);
    const isMaskedKey = isMaskedValue(apiKey);

    // If forceSimulation requested, or live credentials are not set/masked,
    // return an interactive lab simulation mode so user can test the UI, audio & screen-share without error!
    if (forceSimulation || !apiKey || !apiSecret || !serverUrl || isMaskedSecret || isMaskedKey) {
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
        isMaskedSecret,
        expiresInSeconds: 7200,
        message: forceSimulation
          ? 'Running in Interactive Lab Simulation Mode (Simulated Room).'
          : (isMaskedSecret
              ? 'LIVEKIT_API_SECRET contains masked bullet dots (••••). Running in Interactive Lab Simulation Mode.'
              : 'LiveKit server keys not yet populated in .env. Running in Interactive Lab Simulation Mode.'),
      });
      return;
    }

    // Role-specific Video Grants:
    // Tutor: Audio + Screenshare enabled. Camera permanently DISABLED.
    // Student: Audio + Camera enabled. Screenshare DISABLED.
    // Admin / Supervisor: Full monitoring or audio privileges.
    const canPublishSources: TrackSource[] = userRole === 'tutor'
      ? [TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO]
      : (userRole === 'student' ? [TrackSource.MICROPHONE, TrackSource.CAMERA] : [TrackSource.MICROPHONE]);

    const at = new AccessToken(apiKey, apiSecret, {
      identity: cleanIdentity,
      name: cleanName,
      ttl: '2h', // Short-lived 2-hour token
    });

    at.addGrant({
      room: cleanRoom,
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
      roomName: cleanRoom,
      participantIdentity: cleanIdentity,
      participantName: cleanName,
      role: userRole,
      classId: classId || null,
      isMockSession: false,
      expiresInSeconds: 7200,
    });
  } catch (err: any) {
    console.error('[LiveKit Token Error]:', err);
    res.status(500).json({ error: err?.message || 'Failed to issue LiveKit token' });
  }
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
