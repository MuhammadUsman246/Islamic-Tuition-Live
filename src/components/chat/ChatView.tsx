import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send,
  MessageSquare,
  Users,
  CheckCheck,
  Check,
  Search,
  Mic,
  FileText,
  Image as ImageIcon,
  X,
  Square,
  Download,
  Volume2,
  ChevronLeft,
  ChevronDown,
  Bell,
  BellOff,
  HardDrive,
  Trash2,
  Sparkles,
  Info,
  Paperclip,
  RefreshCw,
  Copy,
  CheckCircle2,
  Filter,
  CheckCircle,
  Phone,
  PhoneCall,
  Video,
  UserCheck,
  GraduationCap,
  BookOpen,
  Pencil,
  Ban
} from 'lucide-react';
import { ChatMessage, UserRole, Student, Tutor, ChatAttachment, ActiveCallSession, CallType } from '../../types';
import {
  subscribeToMessages,
  sendMessage,
  getStudents,
  getTutors,
  markThreadMessagesAsRead,
  markMessagesAsDelivered,
  markVoiceNoteAsListened,
  subscribeToUnreadMessages,
  markAllMessagesAsRead,
  initiateCallSession,
  subscribeToIncomingCalls,
  editChatMessage,
  deleteChatMessage
} from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';
import { AudioPlayer } from './AudioPlayer';
import { LiveCallModal } from './LiveCallModal';
import {
  compressAndConvertToWebP,
  processAudioVoiceNote,
  processDocumentAttachment,
  cleanupOldChatMedia,
  getChatStorageStats,
  requestDesktopNotificationPermission,
  isDesktopNotificationPermitted,
  sendDesktopNotification,
  getCleanAudioConstraints,
  getSupportedAudioMimeType,
  createCleanAudioStream
} from '../../utils/chatMediaUtils';

export interface ChannelDef {
  id: string;
  name: string;
  category: 'staff_group' | 'direct_admin' | 'tutor_desk';
  description: string;
  targetUserId?: string;
  targetRole?: UserRole;
  avatarText: string;
}

interface ChatViewProps {
  initialThreadId?: string;
  students?: Student[];
  tutors?: Tutor[];
}

export const ChatView: React.FC<ChatViewProps> = ({ initialThreadId, students: propStudents, tutors: propTutors }) => {
  const { userProfile, activeRole, adminViewingRole, adminViewingTargetId } = useAuth();
  const role: UserRole = activeRole || userProfile?.role || 'admin';
  const currentUserId = (adminViewingRole && adminViewingTargetId)
    ? `${role}_${adminViewingTargetId}`
    : (role === 'tutor' && userProfile?.tutorId ? userProfile.tutorId : (userProfile?.uid || 'user'));

  const [students, setStudents] = useState<Student[]>(() => propStudents && propStudents.length > 0 ? propStudents : []);
  const [tutors, setTutors] = useState<Tutor[]>(() => propTutors && propTutors.length > 0 ? propTutors : []);
  const [messageLimit, setMessageLimit] = useState<number>(35);
  const [, setLoadingData] = useState(false);

  // Sync props when updated from parent without extra Firestore reads
  useEffect(() => {
    if (propStudents && propStudents.length > 0) setStudents(propStudents);
    if (propTutors && propTutors.length > 0) setTutors(propTutors);
  }, [propStudents, propTutors]);

  // Fallback metadata loader only if not provided by parent/cache
  useEffect(() => {
    if (students.length > 0 && tutors.length > 0) return;
    let mounted = true;
    const fetchMeta = async () => {
      try {
        const [stList, tuList] = await Promise.all([getStudents(), getTutors()]);
        if (mounted) {
          if (students.length === 0) setStudents(stList);
          if (tutors.length === 0) setTutors(tuList);
        }
      } catch (err) {
        console.warn('Could not fetch students/tutors for chat:', err);
      }
    };
    fetchMeta();
    return () => {
      mounted = false;
    };
  }, [students.length, tutors.length]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Attachment menu popover state
  const [showAttachMenu, setShowAttachMenu] = useState<boolean>(false);

  // Compression state indicator
  const [isCompressingImage, setIsCompressingImage] = useState<boolean>(false);
  const [compressionStats, setCompressionStats] = useState<{
    originalSizeKB: number;
    compressedSizeKB: number;
    reductionPercent: number;
  } | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [showMicPermissionModal, setShowMicPermissionModal] = useState<boolean>(false);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const cleanAudioContextRef = useRef<AudioContext | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const recordingTimerRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Message Editing and Deletion states
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [, setDeletingMsgId] = useState<string | null>(null);

  // Pending attachment to send
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null);

  // Lightbox Modal for viewing full images
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Storage Stats & Optimization State
  const [storageStats, setStorageStats] = useState<{
    totalMessages: number;
    mediaMessagesCount: number;
    expiredMediaCount: number;
    estimatedStorageMB: number;
  } | null>(null);
  const [isCleaningStorage, setIsCleaningStorage] = useState(false);
  const [storageCleanupMessage, setStorageCleanupMessage] = useState<string | null>(null);
  const [showStorageModal, setShowStorageModal] = useState(false);

  // Desktop Notifications State
  const [notificationsAllowed, setNotificationsAllowed] = useState<boolean>(() => isDesktopNotificationPermitted());

  // Real-time unread messages count per channel
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});

  // WhatsApp Filter Pills: 'all' | 'unread' | 'tutors' | 'students' | 'staff' | 'direct'
  const [filterTab, setFilterTab] = useState<'all' | 'unread' | 'tutors' | 'students' | 'staff' | 'direct'>('all');

  // Active Live Call Session Modal State
  const [activeCallSession, setActiveCallSession] = useState<ActiveCallSession | null>(null);

  // Message Info Modal state (Seen by, Delivered to, Not delivered)
  const [selectedMessageInfo, setSelectedMessageInfo] = useState<ChatMessage | null>(null);

  // Search inside active conversation
  const [inChatSearchOpen, setInChatSearchOpen] = useState<boolean>(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState<string>('');

  // Copy text feedback tracker
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Scroll to bottom helper
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Subscribe to live unread counts
  useEffect(() => {
    const unsub = subscribeToUnreadMessages(currentUserId, role, (_total, byThread) => {
      setUnreadMap(byThread || {});
    });
    return () => unsub();
  }, [currentUserId, role]);

  // Request desktop notification permission on initial mount if supported
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationsAllowed(Notification.permission === 'granted');
    }
  }, []);

  // Live Call Initiation Handler
  const handleStartCall = async (
    targetUserId: string,
    targetUserName: string,
    targetRole: UserRole,
    callType: CallType = 'audio',
    threadId: string = activeThreadId
  ) => {
    try {
      const callData: Omit<ActiveCallSession, 'id'> = {
        callerId: currentUserId,
        callerName: effectiveDisplayName,
        callerRole: role,
        receiverId: targetUserId,
        receiverName: targetUserName,
        receiverRole: targetRole,
        threadId,
        type: callType,
        status: 'calling',
        startedAt: new Date().toISOString()
      };
      const callId = await initiateCallSession(callData);
      setActiveCallSession({ id: callId, ...callData });
    } catch (err: any) {
      console.warn('Error starting call:', err);
      alert('Could not start call: ' + (err.message || 'Please check network'));
    }
  };

  // Compute effective display name respecting inspection mode
  const effectiveDisplayName = useMemo(() => {
    if (role === 'tutor' || adminViewingRole === 'tutor') {
      const currentTutorId = adminViewingTargetId || userProfile?.tutorId || '';
      const match = tutors.find(t => t.tutorId.toLowerCase() === currentTutorId.toLowerCase() || t.tutorId.toLowerCase().replace(/[^a-z0-9]/g, '') === currentTutorId.toLowerCase().replace(/[^a-z0-9]/g, ''));
      if (match) {
        return match.realName ? `${match.realName} (${match.tutorId})` : match.tutorId;
      }
      return userProfile?.displayName || currentTutorId || 'Tutor';
    }
    if (adminViewingRole === 'supervisor') {
      return userProfile?.displayName || 'Academic Supervisor';
    }
    if (adminViewingRole === 'student') {
      const match = students.find(s => s.studentId === adminViewingTargetId);
      if (match) return match.name || match.studentId;
      return userProfile?.displayName || adminViewingTargetId || 'Student';
    }
    if (adminViewingRole === 'parent') {
      return userProfile?.displayName || 'Parent';
    }
    return userProfile?.displayName || userProfile?.email?.split('@')[0] || 'User';
  }, [role, adminViewingRole, adminViewingTargetId, tutors, students, userProfile]);

  // Strict Chat Structure & Permissions:
  // 1. Dedicated Tutor Support Groups:
  //    - Each tutor has their own private group with [That Specific Tutor + All Admins + All Supervisors].
  //    - Formatted as e.g. "Umar Nazakat (Tutor 3) (Support Group)" so tutors are clearly identified by Tutor ID.
  //    - There is NO group where all staff/tutors are combined.
  //    - Tutors cannot send direct messages to Admin; they must message in this Support Group where both Admins and Supervisors see the chat.
  // 2. Direct 1-to-1 Channels:
  //    - For Supervisors: Displays strictly as "Admin".
  //    - For Students / Parents: Displays as "Admin".
  const availableChannels = useMemo<ChannelDef[]>(() => {
    const channels: ChannelDef[] = [];

    // Role-specific channels
    if (role === 'admin') {
      // Direct 1-to-1 with Academic Supervisor
      channels.push({
        id: 'dm_admin_supervisor',
        name: 'Academic Supervisor',
        category: 'direct_admin',
        description: 'Direct 1-to-1 administrative line with Academic Supervisor.',
        targetRole: 'supervisor',
        avatarText: 'AS'
      });

      // Tutor Support Groups (Admin + Supervisors + That Specific Tutor)
      tutors.forEach(t => {
        const tKey = t.tutorId.replace(/\s+/g, '_').toLowerCase();
        const tutorLabel = t.realName ? `${t.realName} (${t.tutorId})` : t.tutorId;
        channels.push({
          id: `desk_tutor_${tKey}`,
          name: `${tutorLabel} (Support Group)`,
          category: 'tutor_desk',
          description: `Support group with ${tutorLabel}, Admins, and Supervisors.`,
          targetUserId: t.tutorId,
          targetRole: 'tutor',
          avatarText: (t.realName || t.tutorId).slice(0, 2).toUpperCase()
        });
      });

      // Students 1-to-1 (Admin can message each student)
      students.forEach(s => {
        channels.push({
          id: `dm_admin_student_${s.studentId.toLowerCase()}`,
          name: `${s.name} (${s.studentId})`,
          category: 'direct_admin',
          description: `Direct 1-to-1 student support line with ${s.name}.`,
          targetUserId: s.studentId,
          targetRole: 'student',
          avatarText: s.name.slice(0, 2).toUpperCase()
        });
      });

      // Parents 1-to-1 (Admin can message each parent)
      const seenParents = new Set<string>();
      students.forEach(s => {
        if (s.parentName) {
          const pKey = (s.parentId || s.parentEmail || s.studentId).toLowerCase().replace(/[^a-z0-9]/g, '_');
          if (!seenParents.has(pKey)) {
            seenParents.add(pKey);
            channels.push({
              id: `dm_admin_parent_${pKey}`,
              name: `${s.parentName} (${s.name}'s Parent)`,
              category: 'direct_admin',
              description: `Direct 1-to-1 parent desk for ${s.parentName}.`,
              targetUserId: s.parentId,
              targetRole: 'parent',
              avatarText: s.parentName.slice(0, 2).toUpperCase()
            });
          }
        }
      });
    } else if (role === 'supervisor') {
      // Supervisor 1-to-1 with Admin (strictly "Admin")
      channels.push({
        id: 'dm_admin_supervisor',
        name: 'Admin',
        category: 'direct_admin',
        description: 'Direct 1-to-1 priority desk with Administration.',
        targetRole: 'admin',
        avatarText: 'AD'
      });

      // Supervisor can monitor and coordinate in ALL tutor support groups
      tutors.forEach(t => {
        const tKey = t.tutorId.replace(/\s+/g, '_').toLowerCase();
        const tutorLabel = t.realName ? `${t.realName} (${t.tutorId})` : t.tutorId;
        channels.push({
          id: `desk_tutor_${tKey}`,
          name: `${tutorLabel} (Support Group)`,
          category: 'tutor_desk',
          description: `Support group with ${tutorLabel}, Admins, and Supervisors.`,
          targetUserId: t.tutorId,
          targetRole: 'tutor',
          avatarText: (t.realName || t.tutorId).slice(0, 2).toUpperCase()
        });
      });
    } else if (role === 'tutor') {
      // Tutor has their own dedicated Support Group (with Admin & Supervisors)
      // Direct 1-to-1 with Admin is intentionally removed so tutors cannot bypass the group.
      // All messages are sent here so both Admins and Supervisors are present and can see all chat.
      const currentTutorId = adminViewingTargetId || userProfile?.tutorId || (tutors.length > 0 ? tutors[0].tutorId : 'tutor_1');
      const tKey = currentTutorId.replace(/\s+/g, '_').toLowerCase();

      channels.push({
        id: `desk_tutor_${tKey}`,
        name: 'Admin & Supervisor Group',
        category: 'tutor_desk',
        description: 'Group chat with Admin and Academic Supervisors. Report student delays, attendance, or requests here.',
        targetRole: 'admin',
        avatarText: 'AS'
      });
    } else if (role === 'student') {
      // Student has 1-to-1 line with Admin ONLY
      const currentStudentId = adminViewingTargetId || userProfile?.studentId || userProfile?.uid || (students.length > 0 ? students[0].studentId : 'student');
      const sKey = currentStudentId.toLowerCase().replace(/[^a-z0-9]/g, '_');
      channels.push({
        id: `dm_admin_student_${sKey}`,
        name: 'Admin',
        category: 'direct_admin',
        description: 'Direct 1-to-1 student support line with Admin.',
        targetRole: 'admin',
        avatarText: 'AD'
      });
    } else if (role === 'parent') {
      // Parent has 1-to-1 line with Admin ONLY
      const currentParentKey = (adminViewingTargetId || userProfile?.uid || userProfile?.email || 'parent').toLowerCase().replace(/[^a-z0-9]/g, '_');
      channels.push({
        id: `dm_admin_parent_${currentParentKey}`,
        name: 'Admin',
        category: 'direct_admin',
        description: 'Direct 1-to-1 parent support line with Admin.',
        targetRole: 'admin',
        avatarText: 'AD'
      });
    }

    // Ensure strictly unique channel IDs
    const uniqueChannels: ChannelDef[] = [];
    const seenIds = new Set<string>();
    for (const c of channels) {
      if (!seenIds.has(c.id)) {
        seenIds.add(c.id);
        uniqueChannels.push(c);
      }
    }
    return uniqueChannels;
  }, [role, userProfile?.uid, userProfile?.tutorId, userProfile?.studentId, userProfile?.email, adminViewingRole, adminViewingTargetId, students, tutors]);

  const [activeThreadId, setActiveThreadId] = useState<string>(() => {
    if (initialThreadId && availableChannels.some(c => c.id === initialThreadId)) {
      return initialThreadId;
    }
    return availableChannels[0]?.id || '';
  });

  const [mobileChatView, setMobileChatView] = useState<'channels' | 'messages'>('messages');

  // Switch to initialThreadId if provided from outside
  useEffect(() => {
    if (initialThreadId && availableChannels.some(c => c.id === initialThreadId)) {
      setActiveThreadId(initialThreadId);
      setMobileChatView('messages');
    }
  }, [initialThreadId, availableChannels]);

  // Keep activeThreadId valid
  useEffect(() => {
    if (availableChannels.length > 0) {
      if (!availableChannels.some(c => c.id === activeThreadId)) {
        setActiveThreadId(availableChannels[0].id);
      }
    }
  }, [availableChannels, activeThreadId]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [searchChannel, setSearchChannel] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mark messages as delivered and read when thread is active
  useEffect(() => {
    if (activeThreadId && currentUserId) {
      markMessagesAsDelivered(activeThreadId, currentUserId);
      markThreadMessagesAsRead(activeThreadId, currentUserId);
    }
  }, [activeThreadId, currentUserId, messages.length]);

  // Reset messageLimit when switching active thread
  useEffect(() => {
    setMessageLimit(35);
  }, [activeThreadId]);

  // Subscribe to active thread with 35-message windowing limit
  useEffect(() => {
    if (!activeThreadId) return;
    const unsub = subscribeToMessages(activeThreadId, (msgs) => {
      setMessages(msgs);
    }, messageLimit);
    return () => unsub();
  }, [activeThreadId, messageLimit]);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Scroll listener to show/hide "Scroll to Bottom" button
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 180;
    setShowScrollBottomBtn(isUp);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const activeChannel = availableChannels.find(c => c.id === activeThreadId) || availableChannels[0] || {
    id: 'support_group',
    name: 'Admin & Supervisor Group',
    category: 'tutor_desk' as const,
    description: 'Support Communications',
    avatarText: 'AS'
  };

  // Timestamp formatting
  const formatMessageTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(d);
    } catch {
      return iso;
    }
  };

  const formatMessageFullDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const today = new Date();
      const isToday = d.toDateString() === today.toDateString();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = d.toDateString() === yesterday.toDateString();

      if (isToday) return 'Today';
      if (isYesterday) return 'Yesterday';
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }).format(d);
    } catch {
      return iso;
    }
  };

  // Filter messages in active conversation by search query
  const displayedMessages = useMemo(() => {
    if (!inChatSearchQuery.trim()) return messages;
    const q = inChatSearchQuery.toLowerCase();
    return messages.filter(m => (
      (m.text && m.text.toLowerCase().includes(q)) ||
      (m.senderName && m.senderName.toLowerCase().includes(q)) ||
      (m.attachment && m.attachment.name.toLowerCase().includes(q))
    ));
  }, [messages, inChatSearchQuery]);

  // Group messages by date for WhatsApp date bubbles
  const groupedMessages = useMemo(() => {
    const groups: { dateLabel: string; items: ChatMessage[] }[] = [];
    displayedMessages.forEach((msg) => {
      const dateLabel = formatMessageFullDate(msg.timestamp);
      const existing = groups.find(g => g.dateLabel === dateLabel);
      if (existing) {
        existing.items.push(msg);
      } else {
        groups.push({ dateLabel, items: [msg] });
      }
    });
    return groups;
  }, [displayedMessages]);

  // Helper: Format seconds to M:SS (e.g. 0:05, 1:23)
  const formatVoiceTime = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = Math.floor(totalSec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // ==========================================
  // VOICE NOTE RECORDING FLOW (CRYSTAL CLEAR WHATSAPP QUALITY AUDIO)
  // ==========================================
  const startRecording = async () => {
    setMicPermissionError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicPermissionError('Microphone recording is not supported in this browser.');
        return;
      }

      // 1. Request microphone with native hardware noise suppression, acoustic echo cancellation, and AGC
      const rawStream = await navigator.mediaDevices.getUserMedia({ audio: getCleanAudioConstraints() });
      mediaStreamRef.current = rawStream;
      audioChunksRef.current = [];

      // 2. Select optimal speech container (Opus 48kHz / 64kbps speech profile matching WhatsApp)
      const mimeType = getSupportedAudioMimeType();
      const recorderOptions: MediaRecorderOptions = {
        audioBitsPerSecond: 64000
      };
      if (mimeType) {
        recorderOptions.mimeType = mimeType;
      }

      const mediaRecorder = new MediaRecorder(rawStream, recorderOptions);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recordingStartTimeRef.current = Date.now();
      // Start recording continuous stream without micro-chunk timeslice fragmentation
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      // Keep seconds counter mathematically synchronized with real elapsed time
      recordingTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
        setRecordingSeconds(elapsed);
      }, 250);
    } catch (err: any) {
      console.warn('Microphone permission or access error:', err);
      setMicPermissionError('Microphone is blocked. Click the lock or microphone icon in your browser address bar and choose "Allow" to record voice notes.');
    }
  };

  // Option A: Stop recording and load preview for listening before sending
  const stopAndPreviewVoiceNote = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    const elapsedSeconds = Math.max(1, Math.floor((Date.now() - recordingStartTimeRef.current) / 1000));
    const mimeType = getSupportedAudioMimeType() || 'audio/webm';

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setRecordedAudioBlob(audioBlob);
        const previewUrl = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(previewUrl);

        try {
          const { dataUrl, size } = await processAudioVoiceNote(audioBlob);
          setPendingAttachment({
            type: 'audio',
            name: `Voice Note (${formatVoiceTime(elapsedSeconds)})`,
            url: dataUrl,
            duration: elapsedSeconds,
            size,
            format: mimeType
          });
        } catch (err) {
          console.warn('Voice note processing error:', err);
        }
      };
      mediaRecorderRef.current.stop();
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
  };

  // Option B: One-click direct send without intermediate preview screen
  const stopAndSendDirectVoiceNote = async () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    const elapsedSeconds = Math.max(1, Math.floor((Date.now() - recordingStartTimeRef.current) / 1000));
    const mimeType = getSupportedAudioMimeType() || 'audio/webm';

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        try {
          const { dataUrl, size } = await processAudioVoiceNote(audioBlob);
          const voiceAttachment: ChatAttachment = {
            type: 'audio',
            name: `Voice Note (${formatVoiceTime(elapsedSeconds)})`,
            url: dataUrl,
            duration: elapsedSeconds,
            size,
            format: mimeType
          };
          await executeSendMessage(voiceAttachment, '');
        } catch (err) {
          console.warn('Voice note direct send error:', err);
        }
      };
      mediaRecorderRef.current.stop();
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  // Stop recording legacy alias
  const stopRecording = () => {
    stopAndPreviewVoiceNote();
  };

  const discardVoiceNote = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (cleanAudioContextRef.current) {
      cleanAudioContextRef.current.close().catch(() => {});
      cleanAudioContextRef.current = null;
    }
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }
    setIsRecording(false);
    setRecordedAudioBlob(null);
    setRecordedAudioUrl(null);
    setPendingAttachment(null);
    setRecordingSeconds(0);
    setCompressionStats(null);
  };

  // ==========================================
  // IMAGE AUTOMATIC WEBP CONVERSION
  // ==========================================
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingImage(true);
    setCompressionStats(null);
    setShowAttachMenu(false);

    try {
      const result = await compressAndConvertToWebP(file, 1200, 0.75);
      const originalKB = Math.round(result.originalSize / 1024);
      const compressedKB = Math.round(result.size / 1024);
      const reduction = Math.round(((result.originalSize - result.size) / result.originalSize) * 100);

      setCompressionStats({
        originalSizeKB: originalKB,
        compressedSizeKB: compressedKB,
        reductionPercent: Math.max(0, reduction)
      });

      setPendingAttachment({
        type: 'image',
        name: result.name,
        url: result.dataUrl,
        size: result.size,
        format: 'webp'
      });
    } catch (err: any) {
      console.warn('Image compression error:', err);
      alert('Unable to process image: ' + err.message);
    } finally {
      setIsCompressingImage(false);
      e.target.value = '';
    }
  };

  // ==========================================
  // DOCUMENT / FILE UPLOAD
  // ==========================================
  const handleDocFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowAttachMenu(false);
    try {
      const { dataUrl, size, name } = await processDocumentAttachment(file);
      setPendingAttachment({
        type: 'file',
        name,
        url: dataUrl,
        size,
        format: file.name.split('.').pop() || 'doc'
      });
    } catch (err: any) {
      alert(err.message || 'File processing failed');
    } finally {
      e.target.value = '';
    }
  };

  // ==========================================
  // SEND MESSAGE
  // ==========================================
  const executeSendMessage = async (attachmentOverride?: ChatAttachment | null, textOverride?: string) => {
    const textToSend = textOverride !== undefined ? textOverride.trim() : inputText.trim();
    const attachmentPayload = attachmentOverride !== undefined ? attachmentOverride : (pendingAttachment ? { ...pendingAttachment } : null);

    if ((!textToSend && !attachmentPayload) || sending) return;

    if (!availableChannels.some(c => c.id === activeThreadId)) {
      alert('Security violation: You do not have permission to post in this channel.');
      return;
    }
    if (activeThreadId.startsWith('desk_tutor_') && (role === 'student' || role === 'parent')) {
      alert('Security violation: Only staff members may communicate in this group.');
      return;
    }

    const now = new Date().toISOString();
    const payload: Omit<ChatMessage, 'id'> = {
      threadId: activeThreadId,
      senderId: currentUserId,
      senderName: effectiveDisplayName,
      senderRole: role,
      text: textToSend || (attachmentPayload ? `Shared ${attachmentPayload.name}` : ''),
      timestamp: now,
      read: false,
      delivered: true,
      status: 'sent',
      seenBy: [currentUserId],
      deliveredTo: [currentUserId],
      seenTimestamps: { [currentUserId]: now },
      deliveredTimestamps: { [currentUserId]: now },
      listenedBy: [],
      ...(attachmentPayload ? { attachment: attachmentPayload } : {})
    };

    const optimisticMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      ...payload
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText('');
    setPendingAttachment(null);
    setRecordedAudioUrl(null);
    setRecordedAudioBlob(null);
    setCompressionStats(null);
    setSending(true);

    try {
      await sendMessage(payload);
    } catch (err: any) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await executeSendMessage();
  };

  // ==========================================
  // MESSAGE EDIT & DELETE ACTIONS (STRICTLY ADMIN ONLY)
  // ==========================================
  const handleStartEditMessage = (msg: ChatMessage) => {
    if (role !== 'admin') {
      alert('Security policy: Only Academy Administrators are authorized to edit messages.');
      return;
    }
    setEditingMessage(msg);
    setEditingText(msg.text || '');
  };

  const handleSaveEditMessage = async () => {
    if (role !== 'admin') {
      alert('Security policy: Only Academy Administrators are authorized to edit messages.');
      return;
    }
    if (!editingMessage || !editingText.trim()) return;
    const newText = editingText.trim();
    const targetId = editingMessage.id;
    try {
      await editChatMessage(targetId, newText, role);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === targetId
            ? { ...m, text: newText, isEdited: true, editedAt: new Date().toISOString() }
            : m
        )
      );
      setEditingMessage(null);
      setEditingText('');
    } catch (err: any) {
      alert('Could not update message: ' + (err.message || 'Permission denied'));
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (role !== 'admin') {
      alert('Security policy: Only Academy Administrators are authorized to delete messages.');
      return;
    }
    const isConfirm = window.confirm('Are you sure you want to delete this message for everyone in the conversation?');
    if (!isConfirm) return;

    try {
      setDeletingMsgId(msgId);
      await deleteChatMessage(msgId, currentUserId, role, true);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                text: 'This message was deleted',
                deletedForEveryone: true,
                deletedBy: currentUserId,
                attachment: undefined
              }
            : m
        )
      );
    } catch (err: any) {
      alert('Could not delete message: ' + (err.message || 'Permission denied'));
    } finally {
      setDeletingMsgId(null);
    }
  };

  // Copy message text helper
  const handleCopyMessageText = (msg: ChatMessage) => {
    if (!msg.text) return;
    navigator.clipboard.writeText(msg.text).then(() => {
      setCopiedMsgId(msg.id);
      setTimeout(() => setCopiedMsgId(null), 2000);
    });
  };

  // Mark all as read in all channels
  const handleMarkAllAsRead = async () => {
    try {
      await markAllMessagesAsRead(currentUserId, role);
      setUnreadMap({});
    } catch (err) {
      console.warn('Could not mark all as read:', err);
    }
  };

  // Storage Stats & Cleanup
  const handleOpenStorageModal = async () => {
    setShowStorageModal(true);
    const stats = await getChatStorageStats();
    setStorageStats(stats);
  };

  const handleRunStorageCleanup = async (days = 30) => {
    setIsCleaningStorage(true);
    setStorageCleanupMessage(null);
    try {
      const result = await cleanupOldChatMedia(days);
      const updatedStats = await getChatStorageStats();
      setStorageStats(updatedStats);
      const freedMB = (result.freedBytesEstimate / (1024 * 1024)).toFixed(2);
      setStorageCleanupMessage(
        `Storage optimized successfully! Purged media from ${result.cleanedCount} message(s) older than ${days} days, freeing ~${freedMB} MB. All message histories, timestamps, and read receipts are fully preserved.`
      );
    } catch (err: any) {
      setStorageCleanupMessage(`Cleanup note: ${err.message}`);
    } finally {
      setIsCleaningStorage(false);
    }
  };

  const handleVoiceNoteListened = (msgId: string) => {
    markVoiceNoteAsListened(msgId, currentUserId);
  };

  const handleToggleNotifications = async () => {
    if (notificationsAllowed) return;
    const granted = await requestDesktopNotificationPermission();
    setNotificationsAllowed(granted);
    if (granted) {
      sendDesktopNotification('welcome_notif', 'Desktop Notifications Enabled', 'You will receive instant alerts for new academy messages.');
    }
  };

  // Filter channels based on search query and category pill
  const filteredChannels = availableChannels.filter((c) => {
    const matchesSearch = !searchChannel ||
      c.name.toLowerCase().includes(searchChannel.toLowerCase()) ||
      c.description.toLowerCase().includes(searchChannel.toLowerCase());

    if (!matchesSearch) return false;

    if (filterTab === 'unread') {
      return (unreadMap[c.id] || 0) > 0;
    }
    if (filterTab === 'staff') {
      return c.category === 'staff_group' || c.category === 'tutor_desk';
    }
    if (filterTab === 'direct') {
      return c.category === 'direct_admin';
    }
    return true;
  });

  // Calculate genuinely accessible unread count to prevent fake badges
  const totalUnreadAll = useMemo(() => {
    return availableChannels.reduce((acc, c) => acc + (unreadMap[c.id] || 0), 0);
  }, [availableChannels, unreadMap]);

  // Helper for computing participant list for Message Info dialog
  const getThreadParticipants = (threadId: string) => {
    if (threadId.startsWith('desk_tutor_')) {
      const tKey = threadId.replace('desk_tutor_', '').toLowerCase();
      const matchedTutor = tutors.find(t => t.tutorId.toLowerCase().replace(/[^a-z0-9]/g, '_') === tKey || t.tutorId.toLowerCase() === tKey);
      const tName = matchedTutor ? (matchedTutor.realName ? `${matchedTutor.realName} (${matchedTutor.tutorId})` : matchedTutor.tutorId) : 'Tutor';
      return [
        { id: 'admin', name: 'Admin', role: 'admin' as UserRole },
        { id: 'supervisor', name: 'Academic Supervisor', role: 'supervisor' as UserRole },
        { id: matchedTutor?.tutorId || tKey, name: tName, role: 'tutor' as UserRole }
      ];
    }
    const channel = availableChannels.find(c => c.id === threadId);
    if (channel) {
      const targetLabel = (role === 'tutor' && channel.targetRole === 'admin') ? 'Admin' : channel.name;
      return [
        { id: currentUserId, name: effectiveDisplayName, role: role },
        { id: channel.targetUserId || 'recipient', name: targetLabel, role: channel.targetRole || 'admin' as UserRole }
      ];
    }
    return [{ id: currentUserId, name: effectiveDisplayName, role: role }];
  };

  return (
    <div id="academy_whatsapp_chat" className="max-w-7xl mx-auto space-y-3 font-sans">
      {/* Hidden File Inputs for real browser file picking */}
      <input
        type="file"
        ref={imageInputRef}
        onChange={handleImageFileChange}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleDocFileChange}
        accept=".pdf,.doc,.docx,.txt,.csv,.png,.jpg,.webp"
        className="hidden"
      />

      {/* Main WhatsApp-Style Two-Column Container */}
      <div className="bg-[#FFFFFF] rounded-2xl border border-[#E9EDEF] shadow-md flex flex-col md:flex-row h-[650px] sm:h-[740px] overflow-hidden">
        {/* ======================================================== */}
        {/* LEFT COLUMN: WhatsApp Chats Sidebar                      */}
        {/* ======================================================== */}
        <div className={`w-full md:w-[360px] lg:w-[400px] border-r border-[#E9EDEF] bg-[#FFFFFF] flex-col shrink-0 ${mobileChatView === 'channels' ? 'flex h-full' : 'hidden md:flex'}`}>
          {/* Sidebar Top Header */}
          <div className="h-16 px-4 bg-[#F0F2F5] border-b border-[#E9EDEF] flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-[#1E5C3D] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  {effectiveDisplayName ? effectiveDisplayName.slice(0, 2).toUpperCase() : 'IT'}
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#25D366] border-2 border-white" title="Online" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#111B21] truncate">
                  Chats
                </h3>
                <p className="text-[11px] text-[#54656F] truncate uppercase font-semibold">
                  {role} Portal
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              {/* Mark All as Read Button (only if unread messages exist) */}
              {totalUnreadAll > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="p-2 rounded-full text-[#54656F] hover:text-[#00A884] hover:bg-black/5 transition-colors cursor-pointer"
                  title="Mark all conversations as read"
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
              )}

              {/* Desktop Notification Button */}
              <button
                type="button"
                onClick={handleToggleNotifications}
                className={`p-2 rounded-full transition-colors cursor-pointer ${
                  notificationsAllowed
                    ? 'text-[#2D8B5C] hover:bg-black/5'
                    : 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                }`}
                title={notificationsAllowed ? "Desktop notifications active" : "Enable desktop push notifications"}
              >
                {notificationsAllowed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              </button>

              {/* Storage Guard (Admin & Supervisor) */}
              {(role === 'admin' || role === 'supervisor') && (
                <button
                  type="button"
                  onClick={handleOpenStorageModal}
                  className="p-2 rounded-full text-[#54656F] hover:bg-black/5 transition-colors cursor-pointer"
                  title="Storage Optimization & Quota Guard"
                >
                  <HardDrive className="w-4 h-4 text-[#2D8B5C]" />
                </button>
              )}
            </div>
          </div>

          {/* Search Box */}
          <div className="p-2.5 border-b border-[#F0F2F5] bg-[#FFFFFF]">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-[#54656F] absolute left-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search or start a new chat"
                value={searchChannel}
                onChange={(e) => setSearchChannel(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#F0F2F5] text-[#111B21] placeholder-[#8696A0] rounded-lg border-none focus:ring-1 focus:ring-[#2D8B5C] focus:bg-white focus:outline-none transition-all"
              />
              {searchChannel && (
                <button
                  type="button"
                  onClick={() => setSearchChannel('')}
                  className="absolute right-2.5 text-[#8696A0] hover:text-[#111B21] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* WhatsApp Filter Pills */}
          <div className="px-3 py-2 flex items-center space-x-1.5 border-b border-[#F0F2F5] overflow-x-auto no-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                filterTab === 'all'
                  ? 'bg-[#E7FCE8] text-[#1E5C3D] font-bold'
                  : 'bg-[#F0F2F5] text-[#54656F] hover:bg-[#E9EDEF]'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('unread')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
                filterTab === 'unread'
                  ? 'bg-[#E7FCE8] text-[#1E5C3D] font-bold'
                  : 'bg-[#F0F2F5] text-[#54656F] hover:bg-[#E9EDEF]'
              }`}
            >
              <span>Unread</span>
              {totalUnreadAll > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#25D366] text-white">
                  {totalUnreadAll}
                </span>
              )}
            </button>
            {/* Admin-only directory tabs: Tutors and Students must NOT be visible to tutors or supervisors */}
            {role === 'admin' && (
              <>
                <button
                  type="button"
                  onClick={() => setFilterTab('tutors')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
                    filterTab === 'tutors'
                      ? 'bg-[#E7FCE8] text-[#1E5C3D] font-bold'
                      : 'bg-[#F0F2F5] text-[#54656F] hover:bg-[#E9EDEF]'
                  }`}
                >
                  <span>Tutors</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-semibold">
                    {tutors.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('students')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
                    filterTab === 'students'
                      ? 'bg-[#E7FCE8] text-[#1E5C3D] font-bold'
                      : 'bg-[#F0F2F5] text-[#54656F] hover:bg-[#E9EDEF]'
                  }`}
                >
                  <span>Students</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-semibold">
                    {students.length}
                  </span>
                </button>
              </>
            )}
            {role !== 'student' && role !== 'parent' && (
              <button
                type="button"
                onClick={() => setFilterTab('staff')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                  filterTab === 'staff'
                    ? 'bg-[#E7FCE8] text-[#1E5C3D] font-bold'
                    : 'bg-[#F0F2F5] text-[#54656F] hover:bg-[#E9EDEF]'
                }`}
              >
                Groups
              </button>
            )}
            <button
              type="button"
              onClick={() => setFilterTab('direct')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                filterTab === 'direct'
                  ? 'bg-[#E7FCE8] text-[#1E5C3D] font-bold'
                  : 'bg-[#F0F2F5] text-[#54656F] hover:bg-[#E9EDEF]'
              }`}
            >
              Direct
            </button>
          </div>

          {/* List Rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#F0F2F5]">
            {/* 1. TUTOR LIST VIEW (Strictly Admin-Only) */}
            {filterTab === 'tutors' && role === 'admin' ? (
              tutors
                .filter(t => {
                  if (!searchChannel) return true;
                  const q = searchChannel.toLowerCase();
                  return (
                    t.tutorId.toLowerCase().includes(q) ||
                    (t.realName && t.realName.toLowerCase().includes(q)) ||
                    (t.email && t.email.toLowerCase().includes(q))
                  );
                })
                .map((tutor) => {
                  const tKey = tutor.tutorId.replace(/\s+/g, '_').toLowerCase();
                  const dmThreadId = `desk_tutor_${tKey}`;
                  const tutorDisplayName = (role === 'admin' || role === 'supervisor') && tutor.realName
                    ? `${tutor.realName} (${tutor.tutorId})`
                    : tutor.tutorId;

                  return (
                    <div
                      key={tutor.id || tutor.tutorId}
                      className="px-3.5 py-3 bg-[#FFFFFF] hover:bg-[#F5F6F6] transition-colors flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <div className="w-11 h-11 rounded-full bg-[#0284C7] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                            {tutor.tutorId.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <h4 className="text-sm font-semibold text-[#111B21] truncate">
                              {tutorDisplayName}
                            </h4>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                              {tutor.status || 'Active'}
                            </span>
                          </div>
                          <p className="text-xs text-[#54656F] truncate flex items-center gap-1.5">
                            <span>{tutor.assignedStudents?.length || 0} Students Assigned</span>
                            <span>•</span>
                            <span className="font-mono text-[11px] text-slate-500">{tutor.hourlyRate ? `$${tutor.hourlyRate}/hr` : 'Faculty'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveThreadId(dmThreadId);
                            setMobileChatView('messages');
                          }}
                          className="p-2 rounded-full hover:bg-black/5 text-[#00A884] hover:text-[#008f6f] cursor-pointer"
                          title="Message Tutor"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartCall(tutor.tutorId, tutorDisplayName, 'tutor', 'audio', dmThreadId)}
                          className="p-2 rounded-full hover:bg-black/5 text-[#00A884] hover:text-[#008f6f] cursor-pointer"
                          title="Voice Call"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartCall(tutor.tutorId, tutorDisplayName, 'tutor', 'video', dmThreadId)}
                          className="p-2 rounded-full hover:bg-black/5 text-[#00A884] hover:text-[#008f6f] cursor-pointer"
                          title="Video Call"
                        >
                          <Video className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
            ) : filterTab === 'students' && role === 'admin' ? (
              /* 2. STUDENT LIST VIEW (Strictly Admin-Only) */
              students
                .filter(s => {
                  if (!searchChannel) return true;
                  const q = searchChannel.toLowerCase();
                  return (
                    s.name.toLowerCase().includes(q) ||
                    s.studentId.toLowerCase().includes(q) ||
                    (s.courseType && s.courseType.toLowerCase().includes(q))
                  );
                })
                .map((student) => {
                  const sKey = student.studentId.toLowerCase().replace(/[^a-z0-9]/g, '_');
                  const dmThreadId = `dm_admin_student_${sKey}`;

                  return (
                    <div
                      key={student.id || student.studentId}
                      className="px-3.5 py-3 bg-[#FFFFFF] hover:bg-[#F5F6F6] transition-colors flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <div className="w-11 h-11 rounded-full bg-[#D97706] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                            {student.name.slice(0, 2).toUpperCase()}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <h4 className="text-sm font-semibold text-[#111B21] truncate">
                              {student.name}
                            </h4>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                              {student.studentId}
                            </span>
                          </div>
                          <p className="text-xs text-[#54656F] truncate flex items-center gap-1.5">
                            <span className="font-medium text-[#111B21]">{student.courseType || 'Quranic Studies'}</span>
                            <span>•</span>
                            <span>{student.assignedTutorId || 'Unassigned'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveThreadId(dmThreadId);
                            setMobileChatView('messages');
                          }}
                          className="p-2 rounded-full hover:bg-black/5 text-[#00A884] hover:text-[#008f6f] cursor-pointer"
                          title="Message Student"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartCall(student.studentId, student.name, 'student', 'audio', dmThreadId)}
                          className="p-2 rounded-full hover:bg-black/5 text-[#00A884] hover:text-[#008f6f] cursor-pointer"
                          title="Voice Call"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartCall(student.studentId, student.name, 'student', 'video', dmThreadId)}
                          className="p-2 rounded-full hover:bg-black/5 text-[#00A884] hover:text-[#008f6f] cursor-pointer"
                          title="Video Call"
                        >
                          <Video className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
            ) : filteredChannels.length === 0 ? (
              /* 3. DEFAULT CHANNELS VIEW */
              <div className="p-8 text-center text-xs text-[#54656F] space-y-2">
                <MessageSquare className="w-8 h-8 text-[#8696A0] mx-auto stroke-1" />
                <p className="font-semibold text-[#111B21]">
                  {filterTab === 'unread' ? 'All caught up' : 'No chats found'}
                </p>
                <p>
                  {filterTab === 'unread'
                    ? 'You have no unread messages in any of your permitted channels.'
                    : 'No active conversations match your current filter.'}
                </p>
                {filterTab === 'unread' && totalUnreadAll > 0 && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleMarkAllAsRead}
                      className="px-3 py-1.5 bg-[#00A884] text-white rounded-lg text-xs font-semibold hover:bg-[#008f6f] cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Sync & Clear Badges</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              filteredChannels.map((channel) => {
                const isActive = channel.id === activeThreadId;
                const unreadCount = unreadMap[channel.id] || 0;
                const isStaffGroup = channel.category === 'staff_group';

                return (
                  <button
                    key={channel.id}
                    onClick={() => {
                      setActiveThreadId(channel.id);
                      setMobileChatView('messages');
                      setInChatSearchOpen(false);
                      setInChatSearchQuery('');
                    }}
                    className={`w-full text-left px-3.5 py-3 transition-colors flex items-center space-x-3 cursor-pointer ${
                      isActive
                        ? 'bg-[#F0F2F5]'
                        : 'bg-[#FFFFFF] hover:bg-[#F5F6F6]'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shadow-xs ${
                        channel.category === 'tutor_desk'
                          ? 'bg-gradient-to-br from-[#00A884] to-[#0284C7] text-white'
                          : isStaffGroup
                          ? 'bg-[#00A884] text-white'
                          : channel.targetRole === 'supervisor'
                          ? 'bg-[#7C3AED] text-white'
                          : channel.targetRole === 'tutor'
                          ? 'bg-[#0284C7] text-white'
                          : channel.targetRole === 'student'
                          ? 'bg-[#D97706] text-white'
                          : 'bg-[#1E5C3D] text-white'
                      }`}>
                        {channel.category === 'tutor_desk' ? (
                          <GraduationCap className="w-6 h-6" />
                        ) : isStaffGroup ? (
                          <Users className="w-6 h-6" />
                        ) : (
                          <span>{channel.avatarText}</span>
                        )}
                      </div>
                    </div>

                    {/* Chat Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h4 className="text-sm font-semibold text-[#111B21] truncate">
                          {channel.name}
                        </h4>
                        <span className={`text-[11px] shrink-0 font-mono ${
                          unreadCount > 0 ? 'text-[#25D366] font-bold' : 'text-[#667781]'
                        }`}>
                          {channel.category === 'tutor_desk' ? 'Group' : 'Direct'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs text-[#54656F] truncate flex items-center gap-1">
                          {channel.category === 'tutor_desk' ? (
                            <span className="text-[#0284C7] font-medium">
                              {role === 'tutor' ? 'Admin & Academic Supervisors' : 'Admin, Supervisors & Tutor'}
                            </span>
                          ) : (
                            <span>{channel.description}</span>
                          )}
                        </p>
                        {unreadCount > 0 && (
                          <span className="w-5 h-5 rounded-full text-[11px] font-bold bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-xs">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: WhatsApp Chat Window & Wallpaper           */}
        {/* ======================================================== */}
        <div className={`flex-1 flex-col min-w-0 bg-[#EFEAE2] relative ${mobileChatView === 'messages' ? 'flex h-full' : 'hidden md:flex'}`}>
          {/* Subtle WhatsApp Geometric Doodle Wallpaper */}
          <div
            className="absolute inset-0 opacity-[0.07] pointer-events-none bg-repeat"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000000' fill-opacity='1' fill-rule='evenodd'%3E%3Cpath d='M40 38c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0-28c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 56c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm28-28c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-56 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm38-16.5l2.8-2.8-2.8-2.8-2.8 2.8 2.8 2.8zm-20 0l2.8-2.8-2.8-2.8-2.8 2.8 2.8 2.8zm20 33l2.8-2.8-2.8-2.8-2.8 2.8 2.8 2.8zm-20 0l2.8-2.8-2.8-2.8-2.8 2.8 2.8 2.8z'/%3E%3C/g%3E%3C/svg%3E")`
            }}
          />

          {/* Chat Window Top Bar */}
          <div className="h-16 px-4 bg-[#F0F2F5] border-b border-[#E9EDEF] flex items-center justify-between gap-2 z-10 shrink-0">
            <div className="flex items-center min-w-0 space-x-3">
              <button
                type="button"
                onClick={() => setMobileChatView('channels')}
                className="md:hidden p-1.5 rounded-full hover:bg-black/5 text-[#54656F] cursor-pointer"
                title="Back to all chats"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-xs ${
                activeChannel.category === 'tutor_desk'
                  ? 'bg-gradient-to-br from-[#00A884] to-[#0284C7] text-white'
                  : activeChannel.category === 'staff_group'
                  ? 'bg-[#00A884] text-white'
                  : 'bg-[#1E5C3D] text-white'
              }`}>
                {activeChannel.category === 'tutor_desk' ? (
                  <GraduationCap className="w-5 h-5" />
                ) : activeChannel.category === 'staff_group' ? (
                  <Users className="w-5 h-5" />
                ) : (
                  <span>{activeChannel.avatarText}</span>
                )}
              </div>

              <div className="min-w-0">
                <h4 className="text-sm font-bold text-[#111B21] truncate">
                  {activeChannel.name}
                </h4>
                <p className="text-[11px] text-[#54656F] truncate">
                  {activeChannel.category === 'tutor_desk'
                    ? (role === 'tutor'
                        ? 'Admin & Academic Supervisors'
                        : `Admin & Supervisors with ${activeChannel.name.replace(' (Support Group)', '')}`)
                    : 'End-to-end encrypted private line'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 text-[#54656F]">
              {/* Call Buttons */}
              <div className="flex items-center space-x-1 border-r border-[#E9EDEF] pr-1.5 mr-1">
                <button
                  type="button"
                  onClick={() => {
                    const targetId = activeChannel.targetUserId || (activeChannel.targetRole === 'admin' ? 'admin' : 'supervisor');
                    const targetName = activeChannel.name;
                    const targetRole = activeChannel.targetRole || (role === 'admin' ? 'tutor' : 'admin');
                    handleStartCall(targetId, targetName, targetRole, 'audio', activeChannel.id);
                  }}
                  className="p-2 rounded-full hover:bg-black/5 text-[#00A884] hover:text-[#008f6f] transition-colors cursor-pointer"
                  title="Start Voice Call"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetId = activeChannel.targetUserId || (activeChannel.targetRole === 'admin' ? 'admin' : 'supervisor');
                    const targetName = activeChannel.name;
                    const targetRole = activeChannel.targetRole || (role === 'admin' ? 'tutor' : 'admin');
                    handleStartCall(targetId, targetName, targetRole, 'video', activeChannel.id);
                  }}
                  className="p-2 rounded-full hover:bg-black/5 text-[#00A884] hover:text-[#008f6f] transition-colors cursor-pointer"
                  title="Start Video Call"
                >
                  <Video className="w-4 h-4" />
                </button>
              </div>

              {/* In-chat search toggle */}
              <button
                type="button"
                onClick={() => {
                  setInChatSearchOpen(prev => !prev);
                  if (inChatSearchOpen) setInChatSearchQuery('');
                }}
                className={`p-2 rounded-full transition-colors cursor-pointer ${
                  inChatSearchOpen ? 'bg-[#00A884]/15 text-[#00A884]' : 'hover:bg-black/5 text-[#54656F]'
                }`}
                title="Search inside this conversation"
              >
                <Search className="w-4 h-4" />
              </button>

              <span className="hidden sm:inline-block px-2.5 py-1 rounded-md bg-white/80 border border-[#E9EDEF] text-[10px] font-mono text-[#54656F]">
                PKT (UTC+5)
              </span>
            </div>
          </div>

          {/* Floating Microphone Permission Prompt Banner */}
          {micPermissionError && (
            <div className="mx-3 mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-2 shadow-xs z-20 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center space-x-2 min-w-0">
                <Mic className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="truncate">
                  {micPermissionError}
                </span>
              </div>
              <div className="flex items-center space-x-1.5 shrink-0">
                <button
                  type="button"
                  onClick={startRecording}
                  className="px-2 py-1 bg-[#00A884] hover:bg-[#008f6f] text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Allow & Record
                </button>
                <button
                  type="button"
                  onClick={() => setMicPermissionError(null)}
                  className="p-1 text-amber-700 hover:text-amber-950 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* In-Conversation Search Bar */}
          {inChatSearchOpen && (
            <div className="p-2.5 bg-[#FFFFFF] border-b border-[#E9EDEF] flex items-center space-x-2 z-20 shadow-xs animate-in fade-in slide-in-from-top-1">
              <Search className="w-4 h-4 text-[#8696A0] shrink-0" />
              <input
                type="text"
                value={inChatSearchQuery}
                onChange={(e) => setInChatSearchQuery(e.target.value)}
                placeholder="Search messages in this chat..."
                className="flex-1 bg-[#F0F2F5] text-xs px-3 py-1.5 rounded-lg border-none focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                autoFocus
              />
              {inChatSearchQuery && (
                <button
                  type="button"
                  onClick={() => setInChatSearchQuery('')}
                  className="p-1 text-[#8696A0] hover:text-[#111B21] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* MESSAGES STREAM                                          */}
          {/* ======================================================== */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 p-3 sm:p-5 overflow-y-auto space-y-4 z-10 relative"
          >
            {displayedMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#54656F] space-y-3 p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-[#FFFFFF] shadow-sm text-[#00A884] flex items-center justify-center">
                  <MessageSquare className="w-7 h-7 stroke-[1.5]" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <p className="text-sm font-bold text-[#111B21]">
                    {inChatSearchQuery ? 'No matching messages found' : activeChannel.name}
                  </p>
                  <p className="text-xs text-[#54656F]">
                    {inChatSearchQuery
                      ? 'Try searching with a different term.'
                      : 'Messages are delivered in real time. Send text, record voice notes with recitation, or upload documents and photos.'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Load Older Messages Pagination Button */}
                {messages.length >= messageLimit && (
                  <div className="flex justify-center my-2">
                    <button
                      type="button"
                      onClick={() => setMessageLimit(prev => prev + 35)}
                      className="px-3.5 py-1.5 rounded-full bg-white/95 hover:bg-white text-[#00A884] hover:text-[#008f6f] border border-[#E9EDEF] shadow-xs text-xs font-medium flex items-center space-x-1.5 transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Load older messages (Showing {messages.length})</span>
                    </button>
                  </div>
                )}
                {groupedMessages.map((group) => (
                <div key={group.dateLabel} className="space-y-2.5">
                  {/* WhatsApp Center Date Bubble */}
                  <div className="flex justify-center my-2">
                    <span className="px-3 py-1 rounded-lg bg-[#FFFFFF] shadow-xs text-[11px] font-medium text-[#54656F] border border-[#E9EDEF]/80 uppercase tracking-wide">
                      {group.dateLabel}
                    </span>
                  </div>

                  {group.items.map((m) => {
                    const isMe = m.senderId === currentUserId;
                    const formattedTime = formatMessageTimestamp(m.timestamp);
                    const isGroupChat = activeThreadId === 'channel_staff_group' || activeThreadId.startsWith('desk_tutor_');
                    const seenByList = Array.isArray(m.seenBy) ? m.seenBy : [];
                    const deliveredToList = Array.isArray(m.deliveredTo) ? m.deliveredTo : [];
                    const listenedByList = Array.isArray(m.listenedBy) ? m.listenedBy : [];
                    const isListened = listenedByList.length > 0;

                    // WhatsApp Read Receipts:
                    // Seen: Double Blue Check (34B7F1)
                    // Delivered: Double Gray Check (8696A0)
                    // Sent: Single Gray Check (8696A0)
                    const isSeen = isGroupChat
                      ? seenByList.length > 1
                      : (m.read || m.status === 'seen' || seenByList.some(id => id !== m.senderId));

                    const isDelivered = isGroupChat
                      ? deliveredToList.length > 1 || m.delivered
                      : (m.delivered || deliveredToList.some(id => id !== m.senderId));

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative`}
                      >
                        {/* Message Bubble Container */}
                        <div
                          className={`relative max-w-[88%] sm:max-w-md p-2.5 sm:p-3 rounded-2xl shadow-xs text-xs leading-relaxed transition-all hover:shadow-md ${
                            isMe
                              ? 'bg-[#D9FDD3] text-[#111B21] rounded-tr-xs'
                              : 'bg-[#FFFFFF] text-[#111B21] rounded-tl-xs'
                          }`}
                        >
                          {/* Quick Action Toolbar on Hover */}
                          <div className={`absolute top-1.5 ${isMe ? 'left-2 -translate-x-full pr-1.5' : 'right-2 translate-x-full pl-1.5'} hidden group-hover:flex items-center space-x-1 z-20`}>
                            {m.text && !m.deletedForEveryone && (
                              <button
                                type="button"
                                onClick={() => handleCopyMessageText(m)}
                                className="p-1 rounded-md bg-white/90 shadow-xs border border-gray-200 text-gray-600 hover:text-black cursor-pointer"
                                title="Copy message text"
                              >
                                {copiedMsgId === m.id ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}

                            {/* Edit message (Strict Safety Policy: ONLY Academy Admin can edit messages) */}
                            {!m.deletedForEveryone && m.text && role === 'admin' && (
                              <button
                                type="button"
                                onClick={() => handleStartEditMessage(m)}
                                className="p-1 rounded-md bg-white/90 shadow-xs border border-gray-200 text-blue-600 hover:bg-blue-50 cursor-pointer"
                                title="Edit message (Admin only)"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Delete message (Strict Safety Policy: ONLY Academy Admin can delete messages) */}
                            {!m.deletedForEveryone && role === 'admin' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(m.id)}
                                className="p-1 rounded-md bg-white/90 shadow-xs border border-gray-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                                title="Delete message for everyone (Admin only)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {(isMe || role === 'admin') && !m.deletedForEveryone && (
                              <button
                                type="button"
                                onClick={() => setSelectedMessageInfo(m)}
                                className="p-1 rounded-md bg-white/90 shadow-xs border border-gray-200 text-gray-600 hover:text-black cursor-pointer"
                                title="Message Info (Seen & Delivered)"
                              >
                                <Info className="w-3.5 h-3.5 text-[#00A884]" />
                              </button>
                            )}
                          </div>

                          {/* Sender name for group chats (Incoming) */}
                          {!isMe && (
                            <div className="flex items-center gap-1.5 mb-1 text-[11px]">
                              <span className={`font-bold ${
                                m.senderRole === 'admin'
                                  ? 'text-[#1E5C3D]'
                                  : m.senderRole === 'supervisor'
                                  ? 'text-[#7C3AED]'
                                  : m.senderRole === 'tutor'
                                  ? 'text-[#0284C7]'
                                  : 'text-[#D97706]'
                              }`}>
                                {(role === 'tutor' && m.senderRole === 'admin') ? 'Admin' : m.senderName}
                              </span>
                              <span className="text-[9px] px-1 py-0.2 rounded bg-black/5 text-[#54656F] font-mono uppercase font-semibold">
                                {m.senderRole}
                              </span>
                            </div>
                          )}

                          {/* Attachment Content */}
                          {!m.deletedForEveryone && m.attachment && (
                            <div className="mb-2">
                              {/* Expired Media Guard */}
                              {m.attachment.mediaExpired || !m.attachment.url ? (
                                <div className="p-2.5 rounded-lg bg-black/5 border border-black/10 text-xs text-[#54656F] flex items-center space-x-2">
                                  <HardDrive className="w-4 h-4 text-amber-500 shrink-0" />
                                  <span className="italic">
                                    Media archived to preserve academy quota ({m.attachment.name}). Message text preserved.
                                  </span>
                                </div>
                              ) : (
                                <>
                                  {/* 1. Voice Note Player */}
                                  {m.attachment.type === 'audio' && (
                                    <div className="space-y-1">
                                      <AudioPlayer
                                        src={m.attachment.url}
                                        duration={m.attachment.duration}
                                        fileName={m.attachment.name}
                                        isMe={isMe}
                                        listened={isListened}
                                        onListen={() => handleVoiceNoteListened(m.id)}
                                      />
                                    </div>
                                  )}

                                  {/* 2. Photo (WebP Optimized) */}
                                  {m.attachment.type === 'image' && (
                                    <div className="space-y-1">
                                      <img
                                        src={m.attachment.url}
                                        alt={m.attachment.name}
                                        onClick={() => setPreviewImageUrl(m.attachment?.url || null)}
                                        className="max-h-64 w-auto rounded-xl object-cover cursor-pointer hover:opacity-95 transition-opacity"
                                      />
                                      <div className="flex items-center justify-between text-[10px] text-[#54656F] pt-0.5">
                                        <span className="truncate max-w-[180px]">
                                          {m.attachment.name}
                                        </span>
                                        <a
                                          href={m.attachment.url}
                                          download={m.attachment.name}
                                          className="text-[#00A884] hover:underline flex items-center gap-0.5 font-medium"
                                        >
                                          <Download className="w-3 h-3" /> Save
                                        </a>
                                      </div>
                                    </div>
                                  )}

                                  {/* 3. Document Attachment */}
                                  {m.attachment.type === 'file' && (
                                    <a
                                      href={m.attachment.url}
                                      download={m.attachment.name}
                                      className="p-2.5 rounded-xl bg-[#F0F2F5] border border-[#E9EDEF] flex items-center justify-between gap-3 text-[#111B21] hover:bg-[#E9EDEF] transition-colors"
                                    >
                                      <div className="flex items-center space-x-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-[#2D8B5C]/10 text-[#2D8B5C] flex items-center justify-center shrink-0">
                                          <FileText className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="font-semibold text-xs truncate max-w-[180px]">{m.attachment.name}</p>
                                          {m.attachment.size && (
                                            <span className="text-[10px] text-[#54656F] font-mono">
                                              {(m.attachment.size / 1024).toFixed(1)} KB
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <Download className="w-4 h-4 text-[#54656F] shrink-0" />
                                    </a>
                                  )}
                                </>
                              )}
                            </div>
                          )}

                          {/* Message Text or Deleted Placeholder */}
                          {m.deletedForEveryone ? (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 italic py-0.5 select-none">
                              <Ban className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span>This message was deleted</span>
                            </div>
                          ) : m.text ? (
                            <p className="whitespace-pre-wrap select-text">
                              {m.text}
                              {m.isEdited && (
                                <span className="text-[10px] text-gray-500 italic ml-1 select-none font-normal">
                                  (edited)
                                </span>
                              )}
                            </p>
                          ) : null}

                          {/* Timestamp & Delivery Status Ticks */}
                          <div className="flex items-center justify-end space-x-1 mt-1 text-[10px] text-[#667781] select-none">
                            <span className="font-mono tabular-nums">{formattedTime}</span>

                            {isMe && (
                              <div
                                onClick={() => setSelectedMessageInfo(m)}
                                className="flex items-center ml-0.5 cursor-pointer hover:opacity-80"
                                title="Click to view message delivery info"
                              >
                                {isSeen ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-[#34B7F1]" title="Seen / Read by recipient(s) (Double Blue Ticks)" />
                                ) : isDelivered ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-[#8696A0]" title="Delivered to recipient device(s) (Double Gray Ticks)" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 text-[#8696A0]" title="Sent to server (Single Gray Tick)" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          )}
            <div ref={messagesEndRef} />
          </div>

          {/* Floating Scroll to Bottom Button */}
          {showScrollBottomBtn && (
            <button
              type="button"
              onClick={scrollToBottom}
              className="absolute bottom-20 right-5 z-20 w-9 h-9 rounded-full bg-white shadow-lg border border-[#E9EDEF] text-[#54656F] hover:text-[#111B21] flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
              title="Scroll to latest message"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          )}

          {/* ======================================================== */}
          {/* ACTIVE RECORDING STATUS BAR                              */}
          {/* ======================================================== */}
          {isRecording && (
            <div className="px-4 py-3 bg-[#FFFFFF] border-t border-[#E9EDEF] flex flex-wrap items-center justify-between gap-2 shadow-sm z-20">
              <div className="flex items-center space-x-2.5">
                <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
                <Mic className="w-4 h-4 text-rose-600 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-rose-900">
                    Recording Voice Note
                  </span>
                  <span className="text-[10px] text-emerald-700 flex items-center gap-1 font-medium">
                    <Sparkles className="w-3 h-3 text-emerald-600" /> Auto noise cancellation active
                  </span>
                </div>
                <span className="font-mono text-xs font-bold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-md ml-1">
                  {formatVoiceTime(recordingSeconds)}
                </span>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                {/* Cancel / Discard */}
                <button
                  type="button"
                  onClick={discardVoiceNote}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer"
                  title="Discard recording"
                >
                  Discard
                </button>

                {/* Option 1: Preview before sending */}
                <button
                  type="button"
                  onClick={stopAndPreviewVoiceNote}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                  title="Listen to recording before sending"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Preview</span>
                </button>

                {/* Option 2: ONE-CLICK DIRECT SEND */}
                <button
                  type="button"
                  onClick={stopAndSendDirectVoiceNote}
                  className="px-3.5 py-1.5 bg-[#00A884] hover:bg-[#008f6f] text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs cursor-pointer active:scale-95 transition-transform"
                  title="Send immediately in one click"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Direct Send</span>
                </button>
              </div>
            </div>
          )}

          {/* WebP Compression Processing Bar */}
          {isCompressingImage && (
            <div className="px-4 py-2 bg-sky-50 border-t border-sky-200 flex items-center justify-between text-xs text-sky-900 z-20">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-600 animate-spin" />
                <span className="font-semibold">Converting photo to WebP format for optimal storage...</span>
              </div>
            </div>
          )}

          {/* Pending Attachment Preview Bar */}
          {pendingAttachment && !isRecording && (
            <div className="px-4 py-2.5 bg-[#FFFFFF] border-t border-[#E9EDEF] flex flex-wrap items-center justify-between gap-2 text-xs text-[#111B21] z-20 shadow-xs">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {pendingAttachment.type === 'audio' && (
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <Volume2 className="w-4 h-4 text-[#00A884] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-xs block">Voice Note ({pendingAttachment.duration}s)</span>
                      {recordedAudioUrl && (
                        <audio
                          src={recordedAudioUrl}
                          controls
                          className="h-7 w-full max-w-xs mt-1"
                        />
                      )}
                    </div>
                  </div>
                )}
                {pendingAttachment.type === 'image' && (
                  <div className="flex items-center gap-2.5">
                    <img
                      src={pendingAttachment.url}
                      alt="Thumbnail"
                      className="w-9 h-9 object-cover rounded-lg border border-[#E9EDEF]"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold truncate max-w-xs">{pendingAttachment.name}</span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px]">
                          WebP
                        </span>
                      </div>
                      {compressionStats && (
                        <p className="text-[10px] text-[#54656F] font-mono">
                          Size: {compressionStats.compressedSizeKB} KB (saved {compressionStats.reductionPercent}%)
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {pendingAttachment.type === 'file' && (
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#2D8B5C]" />
                    <span className="font-semibold truncate max-w-xs">{pendingAttachment.name}</span>
                    {pendingAttachment.size && (
                      <span className="text-[10px] text-[#54656F] font-mono">
                        ({(pendingAttachment.size / 1024).toFixed(1)} KB)
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={discardVoiceNote}
                  className="text-[#8696A0] hover:text-rose-600 p-1 rounded-md cursor-pointer"
                  title="Remove attachment"
                >
                  <X className="w-4 h-4" />
                </button>
                {pendingAttachment.type === 'audio' && (
                  <button
                    type="button"
                    onClick={() => executeSendMessage()}
                    className="px-3 py-1 bg-[#00A884] hover:bg-[#008f6f] text-white rounded-lg text-xs font-semibold flex items-center space-x-1 shadow-xs cursor-pointer active:scale-95 transition-transform"
                    title="Send voice note"
                  >
                    <Send className="w-3 h-3" />
                    <span>Send</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* BOTTOM COMPOSER                                          */}
          {/* ======================================================== */}
          <div className="p-2.5 sm:p-3 bg-[#F0F2F5] border-t border-[#E9EDEF] flex items-center space-x-2 z-20">
            {/* Attachment Button & Popup Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAttachMenu(prev => !prev)}
                className="p-2 rounded-full text-[#54656F] hover:bg-black/5 transition-colors cursor-pointer"
                title="Attach photo or document"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {/* WhatsApp Attachment Popup Menu */}
              {showAttachMenu && (
                <div className="absolute bottom-12 left-0 bg-[#FFFFFF] rounded-2xl shadow-xl border border-[#E9EDEF] p-2 space-y-1 w-48 z-30 animate-in fade-in slide-in-from-bottom-2">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-[#111B21] hover:bg-[#F0F2F5] rounded-xl flex items-center space-x-2.5 cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <span>Photos & Videos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-[#111B21] hover:bg-[#F0F2F5] rounded-xl flex items-center space-x-2.5 cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-full bg-violet-500 text-white flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span>Document</span>
                  </button>
                </div>
              )}
            </div>

            {/* Main Text Input Form */}
            <form onSubmit={handleSend} className="flex-1 flex items-center space-x-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a message"
                className="flex-1 bg-white text-[#111B21] placeholder-[#8696A0] text-xs sm:text-sm px-4 py-2.5 rounded-xl border-none focus:outline-none focus:ring-1 focus:ring-[#2D8B5C] shadow-2xs"
              />

              {/* Microphone or Send Button */}
              {inputText.trim() || pendingAttachment ? (
                <button
                  type="submit"
                  disabled={sending}
                  className="w-10 h-10 rounded-full bg-[#00A884] hover:bg-[#008f6f] text-white flex items-center justify-center shrink-0 shadow-xs transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Send message"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isRecording}
                  className="w-10 h-10 rounded-full bg-[#00A884] hover:bg-[#008f6f] text-white flex items-center justify-center shrink-0 shadow-xs transition-transform active:scale-95 cursor-pointer"
                  title="Record voice note"
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* WHATSAPP MESSAGE INFO MODAL                              */}
      {/* ======================================================== */}
      {selectedMessageInfo && (selectedMessageInfo.senderId === currentUserId || role === 'admin') && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setSelectedMessageInfo(null)}
        >
          <div
            className="bg-[#FFFFFF] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-[#E9EDEF]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <Info className="w-5 h-5 text-[#00A884]" />
                <h4 className="font-bold text-sm text-[#111B21]">Message Info</h4>
              </div>
              <button
                onClick={() => setSelectedMessageInfo(null)}
                className="p-1 text-[#8696A0] hover:text-[#111B21] rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message Bubble Summary */}
            <div className="p-3 bg-[#F0F2F5] rounded-xl border border-[#E9EDEF] text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#111B21]">{selectedMessageInfo.senderName}</span>
                <span className="text-[10px] font-mono text-[#54656F]">{formatMessageTimestamp(selectedMessageInfo.timestamp)}</span>
              </div>
              <p className="text-[#111B21] whitespace-pre-wrap">{selectedMessageInfo.text || 'Attachment message'}</p>
            </div>

            {/* Read & Delivery Details */}
            <div className="space-y-3 text-xs max-h-64 overflow-y-auto pr-1">
              {/* 1. Read By / Seen By */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-bold text-[#111B21]">
                  <div className="flex items-center gap-1.5 text-[#34B7F1]">
                    <CheckCheck className="w-4 h-4" />
                    <span>Read by</span>
                  </div>
                  <span className="text-[11px] text-[#54656F]">
                    {selectedMessageInfo.seenBy?.length || 1} participant(s)
                  </span>
                </div>
                <div className="space-y-1">
                  {selectedMessageInfo.seenBy && selectedMessageInfo.seenBy.length > 0 ? (
                    selectedMessageInfo.seenBy.map((uid) => {
                      const timeStr = selectedMessageInfo.seenTimestamps?.[uid];
                      const nameMatch = getThreadParticipants(selectedMessageInfo.threadId).find(p => p.id === uid)?.name;
                      return (
                        <div key={uid} className="flex items-center justify-between p-2 rounded-lg bg-sky-50/60 border border-sky-100">
                          <span className="font-semibold text-[#111B21]">
                            {uid === currentUserId ? 'You (Sender)' : nameMatch || `User ${uid}`}
                          </span>
                          <span className="text-[10px] font-mono text-sky-800">
                            {timeStr ? formatMessageTimestamp(timeStr) : 'Read'}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-[11px] text-[#54656F] italic pl-2">No read receipts yet</p>
                  )}
                </div>
              </div>

              {/* 2. Delivered To */}
              <div className="space-y-1.5 pt-2 border-t border-[#F0F2F5]">
                <div className="flex items-center justify-between font-bold text-[#111B21]">
                  <div className="flex items-center gap-1.5 text-[#8696A0]">
                    <CheckCheck className="w-4 h-4" />
                    <span>Delivered to</span>
                  </div>
                  <span className="text-[11px] text-[#54656F]">
                    {selectedMessageInfo.deliveredTo?.length || 1} participant(s)
                  </span>
                </div>
                <div className="space-y-1">
                  {selectedMessageInfo.deliveredTo && selectedMessageInfo.deliveredTo.length > 0 ? (
                    selectedMessageInfo.deliveredTo.map((uid) => {
                      const timeStr = selectedMessageInfo.deliveredTimestamps?.[uid];
                      const nameMatch = getThreadParticipants(selectedMessageInfo.threadId).find(p => p.id === uid)?.name;
                      return (
                        <div key={uid} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100">
                          <span className="font-medium text-[#111B21]">
                            {uid === currentUserId ? 'You (Sender)' : nameMatch || `User ${uid}`}
                          </span>
                          <span className="text-[10px] font-mono text-[#54656F]">
                            {timeStr ? formatMessageTimestamp(timeStr) : 'Delivered'}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-[11px] text-[#54656F] italic pl-2">Delivered to server</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                type="button"
                onClick={() => setSelectedMessageInfo(null)}
                className="px-4 py-1.5 bg-[#00A884] hover:bg-[#008f6f] text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MICROPHONE PERMISSION GUIDE MODAL                        */}
      {/* ======================================================== */}
      {showMicPermissionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setShowMicPermissionModal(false)}
        >
          <div
            className="bg-[#FFFFFF] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-[#E9EDEF]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                  <Mic className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#111B21]">Microphone Access Required</h4>
                  <p className="text-[11px] text-[#54656F]">To record recitation and voice notes</p>
                </div>
              </div>
              <button
                onClick={() => setShowMicPermissionModal(false)}
                className="p-1 text-[#8696A0] hover:text-[#111B21] rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#111B21]">
              <p className="leading-relaxed">
                Your browser requires explicit permission to access the microphone for recording voice notes and recitation recordings.
              </p>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-amber-900">
                <p className="font-bold">How to enable microphone:</p>
                <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                  <li>Click the lock or settings icon in your browser's address bar.</li>
                  <li>Find <strong>Microphone</strong> and set it to <strong>Allow</strong>.</li>
                  <li>Click the <strong>Request Permission</strong> button below.</li>
                </ol>
              </div>

              {micPermissionError && (
                <p className="text-[11px] text-rose-600 font-medium">
                  {micPermissionError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowMicPermissionModal(false)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowMicPermissionModal(false);
                  await startRecording();
                }}
                className="px-4 py-1.5 rounded-lg bg-[#00A884] hover:bg-[#008f6f] text-white text-xs font-semibold flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Grant Microphone Permission</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* STORAGE OPTIMIZATION MODAL                               */}
      {/* ======================================================== */}
      {showStorageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setShowStorageModal(false)}
        >
          <div
            className="bg-[#FFFFFF] rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-[#E9EDEF]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2.5">
                <HardDrive className="w-5 h-5 text-[#00A884]" />
                <div>
                  <h4 className="font-bold text-sm text-[#111B21]">Storage Optimization & Quota Guard</h4>
                  <p className="text-[11px] text-[#54656F]">Preserving 1,000 MB quota with automatic WebP conversion</p>
                </div>
              </div>
              <button
                onClick={() => setShowStorageModal(false)}
                className="p-1 text-[#8696A0] hover:text-[#111B21] rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Storage Usage Meter */}
            {storageStats && (
              <div className="space-y-2 p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs">
                <div className="flex items-center justify-between font-semibold">
                  <span>Chat Media Usage:</span>
                  <span className="font-mono text-[#1E5C3D]">{storageStats.estimatedStorageMB} MB / 1,000 MB</span>
                </div>
                <div className="w-full bg-emerald-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#00A884] h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (storageStats.estimatedStorageMB / 1000) * 100)}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] text-[#54656F]">
                  <div className="p-2 bg-white rounded-lg border border-emerald-100">
                    <p className="font-bold text-[#111B21]">{storageStats.totalMessages}</p>
                    <p>Total Messages</p>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-emerald-100">
                    <p className="font-bold text-[#111B21]">{storageStats.mediaMessagesCount}</p>
                    <p>Media Messages</p>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-emerald-100">
                    <p className="font-bold text-[#111B21]">{storageStats.expiredMediaCount}</p>
                    <p>Archived Media</p>
                  </div>
                </div>
              </div>
            )}

            {storageCleanupMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed">
                {storageCleanupMessage}
              </div>
            )}

            <div className="space-y-2 text-xs text-[#54656F]">
              <p className="font-bold text-[#111B21]">Storage Policies:</p>
              <ul className="list-disc pl-5 space-y-1 text-[11px]">
                <li>Images are automatically compressed and converted to WebP.</li>
                <li>Cleanup frees large media files while <strong>100% of text records, timestamps, and read receipts remain intact</strong>.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowStorageModal(false)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isCleaningStorage}
                onClick={() => handleRunStorageCleanup(30)}
                className="px-4 py-1.5 rounded-lg bg-[#00A884] hover:bg-[#008f6f] disabled:opacity-50 text-white text-xs font-semibold flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isCleaningStorage ? 'Optimizing...' : 'Purge Media Older Than 30 Days'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* IMAGE LIGHTBOX MODAL                                     */}
      {/* ======================================================== */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            className="relative max-w-3xl max-h-[85vh] bg-[#FFFFFF] rounded-2xl overflow-hidden p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 z-10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImageUrl}
              alt="Full Preview"
              className="max-h-[80vh] w-auto object-contain rounded-xl"
            />
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* EDIT MESSAGE MODAL                                       */}
      {/* ======================================================== */}
      {editingMessage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setEditingMessage(null)}
        >
          <div
            className="bg-[#FFFFFF] rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-[#E9EDEF]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <Pencil className="w-5 h-5 text-[#00A884]" />
                <h4 className="font-bold text-sm text-[#111B21]">Edit Message</h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingMessage(null)}
                className="text-[#8696A0] hover:text-[#111B21] p-1 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700">Message content</label>
              <textarea
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                rows={4}
                className="w-full text-xs sm:text-sm p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#00A884] focus:outline-none"
                placeholder="Edit message..."
              />
              <p className="text-[11px] text-gray-500">
                Edited messages will be updated for all participants in real time with an (edited) label.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setEditingMessage(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditMessage}
                disabled={!editingText.trim()}
                className="px-4 py-2 text-xs font-semibold bg-[#00A884] text-white hover:bg-[#008f6f] rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* LIVE CALL MODAL (INCOMING & OUTGOING AUDIO/VIDEO)        */}
      {/* ======================================================== */}
      {activeCallSession && (
        <LiveCallModal
          callSession={activeCallSession}
          currentUserId={currentUserId}
          currentUserRole={role}
          currentUserName={effectiveDisplayName}
          onClose={() => setActiveCallSession(null)}
        />
      )}
    </div>
  );
};
