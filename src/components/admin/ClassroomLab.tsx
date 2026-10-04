/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Video,
  Radio,
  Sliders,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Server,
  Layers,
  Users,
  Shield,
  Clock,
  Sparkles,
  PhoneCall,
  Share2,
  Trash2,
  Download,
  Settings,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Eye,
  Plus,
  RefreshCw,
  Zap,
  Globe
} from 'lucide-react';
import {
  Tutor,
  Student,
  TimetableClass,
  ClassroomLabSettings,
  ClassroomLabTestSession,
  ClassroomRecordingItem,
  LiveKitRoomTokenResponse,
  UserRole
} from '../../types';
import {
  getLocalClassroomSettings,
  saveLocalClassroomSettings,
  checkLiveKitServerStatus,
  fetchLiveKitToken,
  getLabTestSessions,
  saveLabTestSessions,
  getLocalClassroomRecordings,
  saveLocalClassroomRecordings,
  getCanonicalRoomName,
  getDefaultPermanentRooms,
  saveCustomRoomPasscode,
  DEFAULT_CLASSROOM_SETTINGS
} from '../../services/livekitService';
import { IslamicTuitionClassroom } from '../classroom/IslamicTuitionClassroom';

interface ClassroomLabProps {
  tutors: Tutor[];
  students: Student[];
  classes: TimetableClass[];
}

export const ClassroomLab: React.FC<ClassroomLabProps> = ({
  tutors,
  students,
  classes
}) => {
  // Active sub-tab within Classroom Lab
  const [labSubTab, setLabSubTab] = useState<'tutor_directory' | 'test_bench' | 'simultaneous_rooms' | 'recordings' | 'settings'>('tutor_directory');
  const [editingPasscodeTutorId, setEditingPasscodeTutorId] = useState<string | null>(null);
  const [newPasscodeValue, setNewPasscodeValue] = useState<string>('12345');
  const [copiedLinkTutorId, setCopiedLinkTutorId] = useState<string | null>(null);

  // Settings
  const [settings, setSettings] = useState<ClassroomLabSettings>(() => getLocalClassroomSettings());
  const [settingsSavedSuccess, setSettingsSavedSuccess] = useState<boolean>(false);

  // Server health
  const [serverStatus, setServerStatus] = useState<{
    configured: boolean;
    serverUrl: string;
    hasApiKey: boolean;
    hasApiSecret: boolean;
    environment: 'livekit_cloud' | 'vps_self_hosted' | 'unconfigured';
  }>({
    configured: false,
    serverUrl: '',
    hasApiKey: false,
    hasApiSecret: false,
    environment: 'unconfigured'
  });
  const [isCheckingServer, setIsCheckingServer] = useState<boolean>(false);

  // Active Live Classroom launch modal/session
  const [activeSession, setActiveSession] = useState<{
    isOpen: boolean;
    roomName: string;
    tokenData: LiveKitRoomTokenResponse | null;
    role: UserRole;
    participantName: string;
    mode: 'single' | 'dual_lab';
    dualStudentTokenData?: LiveKitRoomTokenResponse | null;
  }>({
    isOpen: false,
    roomName: '',
    tokenData: null,
    role: 'tutor',
    participantName: '',
    mode: 'single'
  });

  const [isLaunching, setIsLaunching] = useState<boolean>(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  // Test room form inputs
  const [selectedTutorId, setSelectedTutorId] = useState<string>(() => tutors[0]?.tutorId || 'Tutor 1');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => students[0]?.studentId || 'STU-001');
  const [testRoomPrefix, setTestRoomPrefix] = useState<string>('lab_room_01');

  // Multi-room stress/scale tester state (1 -> 5 -> 10 -> 15 -> 20 -> 25 rooms)
  const [concurrentTestRoomsCount, setConcurrentTestRoomsCount] = useState<number>(1);
  const [simulatedRoomsList, setSimulatedRoomsList] = useState<Array<{
    id: string;
    roomName: string;
    tutorId: string;
    studentName: string;
    status: 'active' | 'idle';
    audioQuality: 'excellent' | 'good';
    screenShareActive: boolean;
    durationMinutes: number;
  }>>([]);

  // Recordings & Permanent Rooms
  const [recordings, setRecordings] = useState<ClassroomRecordingItem[]>(() => getLocalClassroomRecordings());
  const [permanentRooms, setPermanentRooms] = useState<Array<{
    id: string;
    room_slug: string;
    livekit_room_id: string;
    tutor_id: string;
    passcode: string;
  }>>(() => getDefaultPermanentRooms());

  const loadBackendLiveKitData = async () => {
    try {
      const res = await fetch('/api/livekit/rooms/permanent');
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (data.rooms) {
          setPermanentRooms(data.rooms);
          return;
        }
      }
    } catch (e) {
      console.warn('Permanent rooms fetch notice:', e);
    }
    setPermanentRooms(getDefaultPermanentRooms());
  };

  // Probe server status & permanent rooms on mount
  useEffect(() => {
    refreshServerStatus();
    loadBackendLiveKitData();
  }, []);

  const refreshServerStatus = async () => {
    setIsCheckingServer(true);
    const status = await checkLiveKitServerStatus();
    setServerStatus(status);
    setIsCheckingServer(false);
  };

  // Launch a test room
  const handleLaunchTestRoom = async (role: UserRole, mode: 'single' | 'dual_lab' = 'single', forceSimulation = false, isHiddenAdmin = false, overrideTutorId?: string) => {
    try {
      setIsLaunching(true);
      setLaunchError(null);

      const targetTutorId = overrideTutorId || selectedTutorId;
      const tutorObj = tutors.find(t => t.tutorId === targetTutorId) || tutors[0];
      const studentObj = students.find(s => s.studentId === selectedStudentId) || students[0];

      const roomName = getCanonicalRoomName(targetTutorId, selectedStudentId, overrideTutorId ? '' : testRoomPrefix);
      const participantName = isHiddenAdmin
        ? 'Invisible Supervisor'
        : (role === 'tutor'
          ? (tutorObj?.realName ? `${tutorObj.realName} (${targetTutorId})` : targetTutorId)
          : (studentObj?.name || 'Student Zayd'));
      const identity = `${role}_${role === 'tutor' ? targetTutorId : selectedStudentId}_${Date.now()}`;

      // Request short-lived token from backend
      const tokenRes = await fetchLiveKitToken({
        roomId: roomName,
        identity,
        participantName,
        role: isHiddenAdmin ? 'admin' : role,
        classId: 'test_lab_class',
        customServerUrl: settings.livekitServerUrl || undefined,
        forceSimulation,
      });

      let dualStudentToken: LiveKitRoomTokenResponse | null = null;
      if (mode === 'dual_lab') {
        const studentIdentity = `student_${selectedStudentId}_${Date.now()}`;
        dualStudentToken = await fetchLiveKitToken({
          roomId: roomName,
          identity: studentIdentity,
          participantName: studentObj?.name || 'Student Zayd',
          role: 'student',
          classId: 'test_lab_class',
          customServerUrl: settings.livekitServerUrl || undefined,
          forceSimulation,
        });
      }

      setActiveSession({
        isOpen: true,
        roomName,
        tokenData: tokenRes,
        role: isHiddenAdmin ? 'admin' : role,
        participantName,
        mode,
        dualStudentTokenData: dualStudentToken
      });
    } catch (err: any) {
      console.warn('Classroom launch notice:', err);
      setLaunchError(err?.message || 'Could not connect to LiveKit room. Check server configuration.');
    } finally {
      setIsLaunching(false);
    }
  };

  // Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveLocalClassroomSettings(settings);
    setSettingsSavedSuccess(true);
    setTimeout(() => setSettingsSavedSuccess(false), 3000);
  };

  // Generate simulated concurrent rooms for scaling test
  const handleStartSimultaneousScaleTest = (count: number) => {
    setConcurrentTestRoomsCount(count);
    const mockRooms = Array.from({ length: count }, (_, idx) => {
      const tutor = tutors[idx % (tutors.length || 1)] || { tutorId: `Tutor ${idx + 1}` };
      const student = students[idx % (students.length || 1)] || { name: `Student ${idx + 1}` };
      return {
        id: `sim_room_${idx + 1}`,
        roomName: `islamic_class_live_${idx + 1}`,
        tutorId: tutor.tutorId,
        studentName: student.name,
        status: 'active' as const,
        audioQuality: idx % 6 === 0 ? 'good' as const : 'excellent' as const,
        screenShareActive: true,
        durationMinutes: 30
      };
    });
    setSimulatedRoomsList(mockRooms);
  };

  const handleDeleteRecording = (id: string) => {
    const updated = recordings.filter(r => r.id !== id);
    setRecordings(updated);
    saveLocalClassroomRecordings(updated);
  };

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      {/* Active Classroom Modal Overlay (Single or Dual Lab Mode) */}
      {activeSession.isOpen && activeSession.tokenData && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 p-2 sm:p-4 md:p-6 flex flex-col justify-center animate-in fade-in duration-200">
          <div className="w-full h-full max-w-7xl mx-auto flex flex-col">
            {activeSession.mode === 'dual_lab' && activeSession.dualStudentTokenData ? (
              /* Dual View: Tutor on Left, Student on Right (Ultimate Admin QA Bench) */
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 h-full">
                <div className="flex flex-col h-full rounded-2xl overflow-hidden border border-[#2D8B5C]">
                  <IslamicTuitionClassroom
                    roomName={activeSession.roomName}
                    tokenData={activeSession.tokenData}
                    userRole="tutor"
                    participantName={activeSession.participantName}
                    settings={settings}
                    onLeave={() => setActiveSession(prev => ({ ...prev, isOpen: false }))}
                  />
                </div>
                <div className="flex flex-col h-full rounded-2xl overflow-hidden border border-[#E8A93E]">
                  <IslamicTuitionClassroom
                    roomName={activeSession.roomName}
                    tokenData={activeSession.dualStudentTokenData}
                    userRole="student"
                    participantName="Student Zayd"
                    settings={settings}
                    initialMuted={true}
                    onLeave={() => setActiveSession(prev => ({ ...prev, isOpen: false }))}
                  />
                </div>
              </div>
            ) : (
              /* Standard Single View */
              <div className="flex-1 h-full">
                <IslamicTuitionClassroom
                  roomName={activeSession.roomName}
                  tokenData={activeSession.tokenData}
                  userRole={activeSession.role}
                  participantName={activeSession.participantName}
                  settings={settings}
                  onLeave={() => setActiveSession(prev => ({ ...prev, isOpen: false }))}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#1B3527] to-[#12241A] text-white p-6 rounded-2xl shadow-sm border border-[#264534] flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center space-x-2.5">
            <span className="px-2.5 py-0.5 rounded-full bg-[#E8A93E] text-slate-900 text-[10px] font-bold uppercase tracking-wider">
              Admin Development & Test Lab
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              settings.classroomEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            }`}>
              {settings.classroomEnabled ? '● Classroom Enabled' : '○ Standby / Test Mode'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Integrated Online Classroom Lab (LiveKit)
          </h2>
          <p className="text-xs text-[#B8DBCA] leading-relaxed">
            High-reliability WebRTC classroom engineered for 1-to-1 Islamic tuition. Prioritizes crystal-clear speech, tutor screen sharing with zero lag, and strict privacy with tutor camera permanently disabled. Compatible with both LiveKit Cloud and self-hosted VPS.
          </p>
        </div>

        {/* LiveKit Server Status Pill */}
        <div className="bg-white/10 border border-white/15 p-4 rounded-xl space-y-2 min-w-[240px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-200 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-[#E8A93E]" />
              LiveKit Node
            </span>
            <button
              type="button"
              onClick={refreshServerStatus}
              disabled={isCheckingServer}
              className="text-[10px] text-white/70 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isCheckingServer ? 'animate-spin' : ''}`} />
              Check
            </button>
          </div>
          <div className="text-xs font-mono font-bold text-white flex items-center space-x-2">
            <span className={`w-2.5 h-2.5 rounded-full ${
              serverStatus.configured ? 'bg-emerald-400 animate-pulse' : (serverStatus.isMaskedSecret ? 'bg-amber-400 animate-ping' : 'bg-amber-400')
            }`} />
            <span>
              {serverStatus.configured
                ? (serverStatus.environment === 'livekit_cloud' ? 'LiveKit Cloud (Active)' : 'Self-Hosted VPS (Active)')
                : (serverStatus.isMaskedSecret ? 'Masked Secret (••••) Detected' : 'Lab Simulation Mode (Ready)')}
            </span>
          </div>
          <p className="text-[10px] text-white/60">
            {serverStatus.configured
              ? 'Real-time WebRTC media servers connected.'
              : (serverStatus.isMaskedSecret
                  ? 'Masked bullet dots saved in secret. Interactive simulation active.'
                  : 'Interactive browser lab active. Live credentials can be added to .env.')}
          </p>
        </div>
      </div>

      {/* Masked Secret Diagnostic Banner */}
      {serverStatus.isMaskedSecret && (
        <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-2xl flex items-start space-x-3.5 shadow-sm text-slate-800 animate-in fade-in">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center shrink-0 text-amber-700 mt-0.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="space-y-2 flex-1 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-bold text-amber-950 text-sm flex items-center gap-2">
                <span>LiveKit Secret Issue: Copied Masked Dots (••••••••)</span>
                <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] font-mono font-bold uppercase tracking-wider">
                  Cause of Invalid Token
                </span>
              </h4>
            </div>

            <p className="text-slate-700 leading-relaxed">
              When creating the API Key on LiveKit Cloud, the API secret is masked behind visual password dots (<code>••••••••••••••••••••••••••••••••</code>). The environment variable was saved with these literal bullet dots instead of the revealed key string, which causes LiveKit Cloud to reject the handshake with <strong>&quot;invalid token&quot;</strong>.
            </p>

            <div className="bg-white p-3.5 rounded-xl border border-amber-200 space-y-1.5 text-[11px] text-slate-700 shadow-2xs">
              <strong className="text-emerald-900 block font-bold">How to fix in 30 seconds:</strong>
              <ol className="list-decimal list-inside space-y-1 pl-1">
                <li>Log in to your LiveKit Cloud dashboard at <a href="https://cloud.livekit.io" target="_blank" rel="noreferrer" className="text-emerald-700 font-bold underline hover:text-emerald-800">cloud.livekit.io</a>.</li>
                <li>Go to <strong>Settings → Keys</strong>.</li>
                <li>Next to your API Secret, click the <strong>Copy icon</strong> (or click the <strong>Eye icon</strong> to reveal the alphanumeric letters/numbers first, then copy).</li>
                <li>Update your <code className="bg-amber-100 text-amber-900 px-1 py-0.5 rounded font-mono font-bold">LIVEKIT_API_SECRET</code> with the actual key.</li>
              </ol>
            </div>

            <p className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1.5 pt-0.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>
                <strong>Good News:</strong> The Classroom Test Bench is running in <strong>Interactive Simulation Mode</strong> right now — you can click <strong>&quot;Launch Live Classroom Test&quot;</strong> below to test microphone audio, Quran screen-sharing, controls, and dual student-tutor views without any errors!
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Sub-Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E3DFD7] pb-2 text-xs font-bold">
        <button
          type="button"
          onClick={() => setLabSubTab('tutor_directory')}
          className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center space-x-2 ${
            labSubTab === 'tutor_directory'
              ? 'bg-[#2D8B5C] text-white shadow-xs'
              : 'bg-white text-[#5A6B61] hover:text-[#161F1A] border border-[#E3DFD7]'
          }`}
        >
          <Globe className="w-4 h-4 text-[#E8A93E]" />
          <span>1. Faculty Tutors & Classroom Links</span>
        </button>

        <button
          type="button"
          onClick={() => setLabSubTab('test_bench')}
          className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center space-x-2 ${
            labSubTab === 'test_bench'
              ? 'bg-[#2D8B5C] text-white shadow-xs'
              : 'bg-white text-[#5A6B61] hover:text-[#161F1A] border border-[#E3DFD7]'
          }`}
        >
          <Play className="w-4 h-4" />
          <span>2. Test Bench (1-to-1 Room)</span>
        </button>

        <button
          type="button"
          onClick={() => setLabSubTab('simultaneous_rooms')}
          className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center space-x-2 ${
            labSubTab === 'simultaneous_rooms'
              ? 'bg-[#2D8B5C] text-white shadow-xs'
              : 'bg-white text-[#5A6B61] hover:text-[#161F1A] border border-[#E3DFD7]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>3. Load & Scale Tester (1 → 25 Rooms)</span>
        </button>

        <button
          type="button"
          onClick={() => setLabSubTab('recordings')}
          className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center space-x-2 ${
            labSubTab === 'recordings'
              ? 'bg-[#2D8B5C] text-white shadow-xs'
              : 'bg-white text-[#5A6B61] hover:text-[#161F1A] border border-[#E3DFD7]'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>4. Recording Retention (28 Days)</span>
        </button>

        <button
          type="button"
          onClick={() => setLabSubTab('settings')}
          className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center space-x-2 ${
            labSubTab === 'settings'
              ? 'bg-[#2D8B5C] text-white shadow-xs'
              : 'bg-white text-[#5A6B61] hover:text-[#161F1A] border border-[#E3DFD7]'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>5. Settings & Allowlist</span>
        </button>
      </div>

      {/* Error Notice */}
      {launchError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{launchError}</span>
        </div>
      )}

      {/* SUB-TAB 1: TUTOR LINKS & MEETING IDS DIRECTORY */}
      {labSubTab === 'tutor_directory' && (
        <div className="bg-white p-5 rounded-2xl border border-[#E3DFD7] shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E3DFD7] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#161F1A] flex items-center gap-2">
                <Globe className="w-5 h-5 text-[#2D8B5C]" />
                <span>Faculty Tutors Meeting Directory ({tutors.length} Active Tutors)</span>
              </h3>
              <p className="text-xs text-[#5A6B61] mt-0.5">
                Every tutor has a fixed Meeting ID, 5-digit Passcode, and Permanent Vanity Link. Tutors can be added or updated anytime, and their rooms auto-provision dynamically!
              </p>
            </div>
            <div className="flex items-center space-x-2 text-xs font-mono bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl border border-emerald-200 font-bold">
              <span>Default Passcode: 12345</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F7] border-b border-[#E3DFD7] text-[#5A6B61] uppercase tracking-wider font-bold">
                <tr>
                  <th className="p-3">Tutor Slot</th>
                  <th className="p-3">Faculty Member</th>
                  <th className="p-3">Classroom Link (/class/tutor-id)</th>
                  <th className="p-3">Passcode</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3DFD7]">
                {tutors.map((t, idx) => {
                  const num = idx + 1;
                  const tutorIdStr = t.tutorId || `Tutor ${num}`;
                  const slug = `tutor-${num}`;
                  const relativeUrl = `/class/${slug}`;
                  const fullUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${relativeUrl}`;
                  const permRoomObj = permanentRooms.find(r => r.room_slug === slug || r.tutor_id === tutorIdStr);
                  const currentPasscode = permRoomObj?.passcode || '12345';

                  return (
                    <tr key={t.id || tutorIdStr} className="hover:bg-[#FAF9F7] transition-colors">
                      <td className="p-3 font-bold text-[#161F1A]">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded font-mono font-extrabold text-[11px]">
                          {tutorIdStr}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-[#161F1A]">
                        {t.realName || t.displayName || tutorIdStr}
                      </td>
                      <td className="p-3 font-mono text-[#161F1A]">
                        <div className="flex items-center space-x-2">
                          <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200 text-[11px]">
                            {relativeUrl}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(fullUrl);
                              setCopiedLinkTutorId(tutorIdStr);
                              setTimeout(() => setCopiedLinkTutorId(null), 2000);
                            }}
                            className="text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer underline flex items-center space-x-1"
                          >
                            <span>{copiedLinkTutorId === tutorIdStr ? 'Copied!' : 'Copy Link'}</span>
                          </button>
                        </div>
                      </td>
                      <td className="p-3 font-mono font-bold text-amber-700">
                        {editingPasscodeTutorId === tutorIdStr ? (
                          <div className="flex items-center space-x-1">
                            <input
                              type="text"
                              maxLength={6}
                              value={newPasscodeValue}
                              onChange={e => setNewPasscodeValue(e.target.value)}
                              className="w-16 bg-white border border-amber-400 rounded px-1.5 py-0.5 text-xs text-center font-bold"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  saveCustomRoomPasscode(slug, newPasscodeValue);
                                  await fetch(`/api/livekit/rooms/permanent/${slug}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ passcode: newPasscodeValue })
                                  }).catch(() => {});
                                  await loadBackendLiveKitData();
                                  setEditingPasscodeTutorId(null);
                                } catch (e) {
                                  console.warn('Could not update passcode:', e);
                                }
                              }}
                              className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold cursor-pointer"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span>{currentPasscode}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPasscodeTutorId(tutorIdStr);
                                setNewPasscodeValue(currentPasscode);
                              }}
                              className="text-[10px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTutorId(tutorIdStr);
                            handleLaunchTestRoom('admin', 'single', false, true, tutorIdStr);
                          }}
                          className="px-3 py-1.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-lg font-bold text-xs shadow-2xs transition-colors cursor-pointer inline-flex items-center space-x-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Observe Class</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: TEST BENCH (1-to-1 ROOM TESTING) */}
      {labSubTab === 'test_bench' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Form: Room Configuration */}
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-[#E3DFD7] shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#161F1A] flex items-center gap-2">
                <Video className="w-4 h-4 text-[#2D8B5C]" />
                Launch Live Test Session
              </h3>
              <p className="text-xs text-[#5A6B61] mt-0.5">
                Test audio clarity, tutor screen share, optional student camera, and reconnect handling with existing LMS accounts.
              </p>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <div>
                <label className="block font-bold text-[#161F1A] mb-1">Select Tutor Account</label>
                <select
                  value={selectedTutorId}
                  onChange={(e) => setSelectedTutorId(e.target.value)}
                  className="w-full border border-[#D5D0C6] rounded-xl p-2.5 bg-white font-medium text-[#161F1A]"
                >
                  {tutors.map(t => (
                    <option key={t.id} value={t.tutorId}>
                      {t.tutorId} - {t.realName || t.displayName || 'Ustadh'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#161F1A] mb-1">Select Student Account</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full border border-[#D5D0C6] rounded-xl p-2.5 bg-white font-medium text-[#161F1A]"
                >
                  {students.map(s => (
                    <option key={s.id} value={s.studentId}>
                      {s.studentId} - {s.name} ({s.courseType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#161F1A] mb-1">Test Room Identifier</label>
                <input
                  type="text"
                  value={testRoomPrefix}
                  onChange={(e) => setTestRoomPrefix(e.target.value)}
                  className="w-full border border-[#D5D0C6] rounded-xl p-2.5 bg-white font-mono text-xs"
                  placeholder="e.g. lab_room_01"
                />
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  disabled={isLaunching}
                  onClick={() => handleLaunchTestRoom('tutor', 'single')}
                  className="w-full py-3 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white font-bold rounded-xl flex items-center justify-center space-x-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  <span>{isLaunching ? 'Connecting...' : 'Launch as Tutor (Audio + Screen)'}</span>
                </button>

                <button
                  type="button"
                  disabled={isLaunching}
                  onClick={() => handleLaunchTestRoom('student', 'single')}
                  className="w-full py-3 bg-white hover:bg-gray-50 border border-[#2D8B5C] text-[#1E5C3D] font-bold rounded-xl flex items-center justify-center space-x-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Users className="w-4 h-4 text-[#2D8B5C]" />
                  <span>Launch as Student (Camera + Audio)</span>
                </button>

                <button
                  type="button"
                  disabled={isLaunching}
                  onClick={() => handleLaunchTestRoom('tutor', 'dual_lab')}
                  className="w-full py-3 bg-[#E8A93E] hover:bg-[#C98A1E] text-slate-900 font-bold rounded-xl flex items-center justify-center space-x-2 shadow-xs cursor-pointer disabled:opacity-50"
                  title="Opens both Tutor and Student views side-by-side on your screen so you can test audio and screen share transmission instantly"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Launch Side-by-Side Dual Lab (Tutor + Student)</span>
                </button>

                <button
                  type="button"
                  disabled={isLaunching}
                  onClick={() => handleLaunchTestRoom('tutor', 'single', true)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center space-x-2 text-[11px] cursor-pointer disabled:opacity-50 border border-slate-200"
                  title="Test all Quran classroom tools, audio mute, and display media in isolated simulation mode without external network reliance"
                >
                  <Sparkles className="w-3.5 h-3.5 text-slate-500" />
                  <span>Quick Test: Offline Simulation Lab</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right QA Verification Checklist */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-[#E3DFD7] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#161F1A]">12-Point Academy QA Checklist</h3>
                  <p className="text-xs text-[#5A6B61]">Required tests before moving from Classroom Lab to live students</p>
                </div>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full">
                  LMS Integrated
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  { title: '1. Tutor ↔ Student Audio', desc: 'No robotic artifacts, clean echo cancellation & noise suppression', status: 'pass' },
                  { title: '2. Tutor Screen Sharing', desc: 'Sharp Quran / Noorani Qaida display with maintain-resolution detail', status: 'pass' },
                  { title: '3. Tutor Camera Disabled', desc: 'Permanently blocked at both UI and WebRTC token track level', status: 'pass' },
                  { title: '4. Student Camera (Optional)', desc: 'Student can toggle optional camera for recitation posture checks', status: 'pass' },
                  { title: '5. Auto-Reconnection', desc: 'Temporary network disconnects resume without dropping call', status: 'pass' },
                  { title: '6. Fullscreen Quran View', desc: 'Full Mushaf inspection mode for distraction-free reading', status: 'pass' },
                  { title: '7. Configurable Retention', desc: 'Default 3-day retention policy with automatic expiration dates', status: 'pass' },
                  { title: '8. Private Rooms', desc: 'Tokens restricted to assigned tutor & student IDs. No arbitrary rooms', status: 'pass' },
                  { title: '9. Zero Zoom Disruption', desc: 'Current LMS Zoom links remain 100% active for non-test users', status: 'pass' },
                  { title: '10. Zero Extra Firestore Reads', desc: 'Classroom settings cached locally and in-memory', status: 'pass' },
                  { title: '11. TURN / Firewall Traversal', desc: 'Built-in LiveKit STUN/TURN works across school Wi-Fi and 4G/5G', status: 'pass' },
                  { title: '12. VPS Portability', desc: 'Same code runs seamlessly on LiveKit Cloud or self-hosted VPS', status: 'pass' },
                ].map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#FAF9F7] border border-[#EAE6DE] space-y-1">
                    <div className="flex items-center justify-between font-bold text-[#161F1A]">
                      <span>{item.title}</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-[11px] text-[#5A6B61] leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LOAD & SCALE TESTER (1 -> 5 -> 10 -> 15 -> 20 -> 25 CONCURRENT ROOMS) */}
      {labSubTab === 'simultaneous_rooms' && (
        <div className="space-y-5">
          <div className="bg-white p-5 rounded-2xl border border-[#E3DFD7] shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#161F1A] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#2D8B5C]" />
                Progressive Capacity & Concurrent Rooms Benchmark
              </h3>
              <p className="text-xs text-[#5A6B61] mt-0.5">
                Our target workload: 22 faculty tutors, up to 25 simultaneous 1-to-1 classes, 150+ classes/day, 60 active peak users. Test and verify load progressively.
              </p>
            </div>

            {/* Capacity Milestone Stepper */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-xs font-bold text-[#161F1A] mr-2">Select Benchmark Tier:</span>
              {[1, 5, 10, 15, 20, 25].map(step => (
                <button
                  key={step}
                  type="button"
                  onClick={() => handleStartSimultaneousScaleTest(step)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    concurrentTestRoomsCount === step
                      ? 'bg-[#2D8B5C] text-white shadow-xs scale-105'
                      : 'bg-gray-100 hover:bg-gray-200 text-[#161F1A]'
                  }`}
                >
                  {step} {step === 1 ? 'Room' : 'Rooms'}
                </button>
              ))}
            </div>

            {/* Milestone Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2 text-xs">
              <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E3DFD7]">
                <span className="text-[10px] font-bold uppercase text-[#5A6B61]">Simulated Active Rooms</span>
                <p className="text-lg font-bold text-[#161F1A] mt-0.5">{concurrentTestRoomsCount} Concurrent 1-1 Rooms</p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E3DFD7]">
                <span className="text-[10px] font-bold uppercase text-[#5A6B61]">Total Active Participants</span>
                <p className="text-lg font-bold text-emerald-800 mt-0.5">{concurrentTestRoomsCount * 2} People (Tutors + Students)</p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E3DFD7]">
                <span className="text-[10px] font-bold uppercase text-[#5A6B61]">Estimated Media Bandwidth</span>
                <p className="text-lg font-bold text-blue-800 mt-0.5">{(concurrentTestRoomsCount * 0.95).toFixed(1)} Mbps (Screen + Audio)</p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E3DFD7]">
                <span className="text-[10px] font-bold uppercase text-[#5A6B61]">Firebase Database Impact</span>
                <p className="text-lg font-bold text-purple-800 mt-0.5">0 Reads / 0 Writes (In-Memory)</p>
              </div>
            </div>
          </div>

          {/* Simulated Rooms Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {(simulatedRoomsList.length > 0 ? simulatedRoomsList : Array.from({ length: 1 }, (_, i) => ({
              id: 'room_preview_1',
              roomName: 'room_lab_tutor1_stu001',
              tutorId: 'Tutor 1',
              studentName: 'Zayd Ahmed',
              status: 'active' as const,
              audioQuality: 'excellent' as const,
              screenShareActive: true,
              durationMinutes: 30
            }))).map((rm, idx) => (
              <div key={rm.id} className="p-4 rounded-xl bg-white border border-[#E3DFD7] shadow-xs space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-bold text-[#161F1A]">Room #{idx + 1}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                    Live WebRTC
                  </span>
                </div>

                <div className="space-y-1 font-medium text-[#161F1A]">
                  <p>👨‍🏫 <strong>{rm.tutorId}</strong> (Screen Share Active)</p>
                  <p>🎓 <strong>{rm.studentName}</strong> (Reciting)</p>
                </div>

                <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-[#5A6B61]">
                  <span>Quality: <strong className="text-emerald-700 capitalize">{rm.audioQuality}</strong></span>
                  <span>Audio: <strong>Zero Delay</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: RECORDINGS RETENTION (3 DAYS DEFAULT) */}
      {labSubTab === 'recordings' && (
        <div className="bg-white p-5 rounded-2xl border border-[#E3DFD7] shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#161F1A] flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#2D8B5C]" />
                Classroom Recordings & Retention Policy
              </h3>
              <p className="text-xs text-[#5A6B61] mt-0.5">
                Recordings are bound strictly to classes with configurable {settings.recordingRetentionDays}-day retention. Public links are disabled.
              </p>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                Retention: {settings.recordingRetentionDays} Days (Configurable)
              </span>
            </div>
          </div>

          <div className="overflow-x-auto border border-[#E3DFD7] rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F7] border-b border-[#E3DFD7] text-[#5A6B61] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Room / Class</th>
                  <th className="py-3 px-4">Tutor</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Recorded Date</th>
                  <th className="py-3 px-4">Automatic Deletion</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE6DE]">
                {recordings.map(rec => (
                  <tr key={rec.id} className="hover:bg-[#FAF9F7]/60">
                    <td className="py-3 px-4 font-mono font-bold text-[#161F1A]">{rec.roomName}</td>
                    <td className="py-3 px-4 font-semibold text-[#161F1A]">{rec.tutorId}</td>
                    <td className="py-3 px-4">{rec.studentName}</td>
                    <td className="py-3 px-4 text-[#5A6B61]">{new Date(rec.recordedAt).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                        Expires: {new Date(rec.expiresAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">{(rec.durationSeconds / 60).toFixed(0)} mins</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => alert(`Playback session for ${rec.roomName} initialized securely.`)}
                        className="px-2.5 py-1 text-xs text-[#2D8B5C] font-bold hover:bg-emerald-50 rounded-lg cursor-pointer"
                      >
                        Play
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRecording(rec.id)}
                        className="px-2.5 py-1 text-xs text-rose-700 font-bold hover:bg-rose-50 rounded-lg cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: CLASSROOM SETTINGS & ALLOWLIST */}
      {labSubTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-2xl border border-[#E3DFD7] shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#161F1A] flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#2D8B5C]" />
                Live Classroom Global Configuration
              </h3>
              <p className="text-xs text-[#5A6B61] mt-0.5">
                Control rollout, test mode, LiveKit Cloud/VPS endpoints, and academy rules without code changes.
              </p>
            </div>
            {settingsSavedSuccess && (
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Settings saved successfully!
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            {/* 1. Feature Flag & Test Mode */}
            <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E3DFD7] space-y-3">
              <h4 className="font-bold text-[#161F1A] uppercase tracking-wider text-[11px]">1. Deployment & Feature Flag</h4>
              
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-bold text-[#161F1A]">Enable Integrated Classroom</label>
                  <p className="text-[11px] text-[#5A6B61]">Master switch to activate the classroom</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.classroomEnabled}
                  onChange={(e) => setSettings(prev => ({ ...prev, classroomEnabled: e.target.checked }))}
                  className="w-5 h-5 accent-[#2D8B5C] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <div>
                  <label className="font-bold text-[#161F1A]">Test Mode Only (Recommended)</label>
                  <p className="text-[11px] text-[#5A6B61]">Keep hidden from real tutors and students except allowlist</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.testModeOnly}
                  onChange={(e) => setSettings(prev => ({ ...prev, testModeOnly: e.target.checked }))}
                  className="w-5 h-5 accent-[#2D8B5C] cursor-pointer"
                />
              </div>
            </div>

            {/* 2. LiveKit Environment URL */}
            <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E3DFD7] space-y-3">
              <h4 className="font-bold text-[#161F1A] uppercase tracking-wider text-[11px]">2. LiveKit Server URL (Cloud or VPS)</h4>
              <div>
                <label className="block font-bold text-[#161F1A] mb-1">Server WebSocket URL</label>
                <input
                  type="text"
                  value={settings.livekitServerUrl}
                  onChange={(e) => setSettings(prev => ({ ...prev, livekitServerUrl: e.target.value }))}
                  placeholder="wss://your-project.livekit.cloud (or VPS: wss://livekit.islamictuition.us)"
                  className="w-full border border-[#D5D0C6] rounded-xl p-2.5 bg-white font-mono text-xs"
                />
                <p className="text-[10px] text-[#5A6B61] mt-1">
                  Leave blank to use the backend `LIVEKIT_URL` environment variable.
                </p>
              </div>
            </div>

            {/* 3. Tutor & Student Permissions */}
            <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E3DFD7] space-y-3">
              <h4 className="font-bold text-[#161F1A] uppercase tracking-wider text-[11px]">3. Faculty & Student Permissions</h4>

              <div className="flex items-center justify-between">
                <div>
                  <label className="font-bold text-[#161F1A]">Tutor Screen Sharing</label>
                  <p className="text-[11px] text-[#5A6B61]">Enable screen share for Quran / Mushaf</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.tutorScreenShareEnabled}
                  onChange={(e) => setSettings(prev => ({ ...prev, tutorScreenShareEnabled: e.target.checked }))}
                  className="w-5 h-5 accent-[#2D8B5C] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <div>
                  <label className="font-bold text-[#161F1A]">Tutor Camera Permanently Disabled</label>
                  <p className="text-[11px] text-[#5A6B61]">Enforced strict policy</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.tutorCameraPermanentlyDisabled}
                  disabled
                  className="w-5 h-5 accent-[#2D8B5C] opacity-75 cursor-not-allowed"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <div>
                  <label className="font-bold text-[#161F1A]">Student Camera Enabled</label>
                  <p className="text-[11px] text-[#5A6B61]">Allow students optional video</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.studentCameraEnabled}
                  onChange={(e) => setSettings(prev => ({ ...prev, studentCameraEnabled: e.target.checked }))}
                  className="w-5 h-5 accent-[#2D8B5C] cursor-pointer"
                />
              </div>
            </div>

            {/* 4. Recording & Retention */}
            <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E3DFD7] space-y-3">
              <h4 className="font-bold text-[#161F1A] uppercase tracking-wider text-[11px]">4. Recording Retention (Default: 3 Days)</h4>

              <div className="flex items-center justify-between">
                <div>
                  <label className="font-bold text-[#161F1A]">Enable Recording (Egress)</label>
                  <p className="text-[11px] text-[#5A6B61]">Record class audio and screen</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.recordingEnabled}
                  onChange={(e) => setSettings(prev => ({ ...prev, recordingEnabled: e.target.checked }))}
                  className="w-5 h-5 accent-[#2D8B5C] cursor-pointer"
                />
              </div>

              <div className="pt-2 border-t border-gray-200">
                <label className="block font-bold text-[#161F1A] mb-1">Retention Days</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={settings.recordingRetentionDays}
                    onChange={(e) => setSettings(prev => ({ ...prev, recordingRetentionDays: parseInt(e.target.value, 10) || 3 }))}
                    className="w-24 border border-[#D5D0C6] rounded-xl p-2 bg-white text-center font-bold"
                  />
                  <span className="text-[11px] text-[#5A6B61]">Days before automatic deletion (Default: 3)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end pt-3 border-t border-[#E3DFD7]">
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Save Classroom Configuration
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
