/**
 * Classroom Chat Safety & Contact-Sharing Protection Filter
 * Lightweight, rule-based detector for phone numbers, emails, social handles, external links,
 * contact-sharing instructions, and obfuscated numbers.
 *
 * Designed to preserve academic Quranic/Islamic lesson references (Ayah, Surah, Juz, Page numbers, Dates, Times).
 */

export type ChatSafetyErrorCode =
  | 'CHAT-01' // Phone number detected
  | 'CHAT-02' // Email address detected
  | 'CHAT-03' // External/contact link detected
  | 'CHAT-04' // Social/contact handle detected
  | 'CHAT-05' // Contact-sharing instruction detected
  | 'CHAT-06' // Obfuscated contact information detected
  | 'CHAT-07' // Spam/rate-limit violation
  | 'CHAT-08'; // Repeated privacy violations / temporary chat restriction

export interface ChatSafetySettings {
  enabled: boolean;
  detectPhone: boolean;
  detectEmail: boolean;
  detectLinks: boolean;
  detectHandles: boolean;
  detectObfuscation: boolean;
  detectSpamRateLimit: boolean;
  logBlockedAttempts: boolean;
  temporaryRestriction: boolean;
  adminAlertsEnabled: boolean;
  showPrivacyBadge: boolean;
  badgeText: string;
  badgeTooltip: string;
}

export const DEFAULT_CHAT_SAFETY_SETTINGS: ChatSafetySettings = {
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

export interface ChatSafetyCheckResult {
  isAllowed: boolean;
  blockedCode?: ChatSafetyErrorCode;
  reason?: string;
  userFacingError?: string;
  matchedPattern?: string;
  isRestrictedUser?: boolean;
}

export interface BlockedAttemptLog {
  id: string;
  timestamp: string;
  code: ChatSafetyErrorCode;
  codeTitle: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  roomSlug: string;
  rawTextSnippet: string; // Redacted or preview
  actionTaken: string;
}

// In-memory rate limiting and violation counters
const userRateTracker: Record<string, { timestamps: number[]; lastMessage: string }> = {};
const userViolationTracker: Record<string, { count: number; restrictedUntil: number }> = {};

/**
 * Normalizes text for detection while preserving original string
 */
function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width spaces
    .replace(/\[at\]|\(at\)|@/gi, ' @ ')
    .replace(/\[dot\]|\(dot\)/gi, ' . ');
}

/**
 * Checks if a text string is legitimate Quranic / Lesson academic citation
 */
function isLegitimateAcademicCitation(text: string): boolean {
  const norm = text.toLowerCase();
  
  // Patterns like "Surah 2 Ayah 255", "Surah Al-Baqarah 2:255", "Page 15 Juz 30", "Lesson 4 page 12", "At 5:30 PM", "10/12/2026"
  const quranPattern = /(surah|sura|ayah|aya|ayat|juz|para|page|pg|lesson|sabaq|verse|line|hizb)\s*#?\s*\d+/i;
  const citationPattern = /\b\d{1,3}\s*:\s*\d{1,3}\b/; // e.g. 2:255 or 36:12
  const timePattern = /\b(0?[1-9]|1[0-2])\s*:\s*[0-5]\d\s*(am|pm)?\b/i; // e.g. 5:30 pm
  const datePattern = /\b\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}\b/; // e.g. 10/12/2026

  // If text is short and contains clear academic keywords or Quran citations
  if (quranPattern.test(norm) || citationPattern.test(norm) || timePattern.test(norm) || datePattern.test(norm)) {
    // Make sure it doesn't also contain explicit contact words like "whatsapp" or "call me"
    const contactKeywords = /(whatsapp|call me|phone|email|gmail|telegram|skype|discord|instagram|t\.me|wa\.me)/i;
    if (!contactKeywords.test(norm)) {
      return true;
    }
  }

  return false;
}

/**
 * Detects Phone Numbers (CHAT-01)
 */
function checkPhoneNumber(text: string): boolean {
  // If explicitly academic citation (e.g. "Surah 2 Ayah 255"), ignore
  if (isLegitimateAcademicCitation(text)) return false;

  // 1. Standard Phone regex (Intl, Local, bracketed, dashed, space-separated digits)
  // E.g. +1 (234) 567-8901, 0300-1234567, 00923001234567, +92 300 1234567
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?(\(?\d{3,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}\b/;
  
  // 2. Continuous 7-15 digits
  const digitSequenceRegex = /\b\d{7,15}\b/;

  // 3. Digit sequence separated by spaces e.g. "0 3 0 0 1 2 3 4 5 6 7"
  const spacedDigitsRegex = /(?:\b\d[\s.-]{1,2}){7,}\d\b/;

  const norm = text.replace(/[\(\)\-]/g, ' ');
  if (phoneRegex.test(text) || digitSequenceRegex.test(text) || spacedDigitsRegex.test(norm)) {
    // Verify it's not a short 3-digit Quran page or Ayah reference
    const numbersOnly = text.replace(/\D/g, '');
    if (numbersOnly.length >= 7) {
      return true;
    }
  }

  return false;
}

/**
 * Detects Email Addresses (CHAT-02)
 */
function checkEmailAddress(text: string): boolean {
  const norm = normalizeText(text);

  // 1. Standard Email
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

  // 2. Obfuscated Email e.g. name @ gmail . com or name [at] yahoo [dot] com
  const obfuscatedEmailRegex = /[a-zA-Z0-9._%+-]+\s*(@|\[at\]|\(at\))\s*[a-zA-Z0-9.-]+\s*(\.|\[dot\]|\(dot\))\s*(com|org|net|edu|gov|io|co|us|uk|pk|sa|ca|me)\b/i;

  return emailRegex.test(text) || obfuscatedEmailRegex.test(norm);
}

/**
 * Detects External / Contact Links (CHAT-03)
 */
function checkExternalLinks(text: string): boolean {
  const norm = text.toLowerCase();

  // Allowed domain: internal academy app
  if (norm.includes('islamictuition.us') || norm.includes('localhost') || norm.includes('run.app')) {
    return false;
  }

  const linkRegex = /(https?:\/\/|www\.|t\.me\/|wa\.me\/|chat\.whatsapp\.com\/|discord\.gg\/|zoom\.us\/|meet\.google\.com\/)[^\s]+/i;
  const generalDomainRegex = /\b[a-zA-Z0-9-]+\.(com|net|org|me|io|co|xyz|app|link|site|info|tk|ml)\b/i;

  return linkRegex.test(text) || generalDomainRegex.test(text);
}

/**
 * Detects Social / Contact Handles (CHAT-04)
 */
function checkSocialHandles(text: string): boolean {
  const norm = text.toLowerCase();

  const handleKeywords = [
    'whatsapp', 'telegram', 'signal', 'skype', 'discord', 'instagram', 'insta',
    'snapchat', 'snap', 'facebook', 'tiktok', 'wechat', 'imo', 'botim', 'viber', 'linkedin'
  ];

  for (const kw of handleKeywords) {
    if (norm.includes(kw)) {
      // Check if followed or preceded by numbers, username, or contact invitation
      const handleRegex = new RegExp(`\\b${kw}\\b[\\s:=#@_]*[a-zA-Z0-9._+-]{3,}`, 'i');
      const kwWithContactContext = new RegExp(`(my|me|add|contact|text|inbox|dm|join|group)\\s*.*\\b${kw}\\b`, 'i');
      
      if (handleRegex.test(norm) || kwWithContactContext.test(norm)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Detects Contact-Sharing Instructions (CHAT-05)
 */
function checkContactSharingInstruction(text: string): boolean {
  const norm = text.toLowerCase();

  const instructionPatterns = [
    /\b(call|text|message|contact|reach|inbox|dm|email|mail|whatsapp)\s+me\b/i,
    /\b(my|personal)\s+(number|phone|cell|mobile|whatsapp|email|gmail|contact|handle)\s+(is|:)/i,
    /\b(contact|message|talk|communicate)\s+(outside|off|privately|directly)\b/i,
    /\bsend\s+me\s+a?\s*(message|text|email|mail|whatsapp)\b/i,
    /\b(add|follow)\s+me\s+on\b/i
  ];

  return instructionPatterns.some(pattern => pattern.test(norm));
}

/**
 * Detects Obfuscated Contact Info (CHAT-06)
 */
function checkObfuscatedContact(text: string): boolean {
  if (isLegitimateAcademicCitation(text)) return false;

  const norm = text.toLowerCase();

  // Words for numbers e.g. "zero three hundred one two three four five six seven"
  const numberWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'hundred'];
  let wordDigitCount = 0;
  
  const words = norm.split(/\s+/);
  for (const w of words) {
    if (numberWords.includes(w)) {
      wordDigitCount++;
    }
  }

  if (wordDigitCount >= 7) {
    return true;
  }

  // Spelled out email domain e.g. "gmail dot com", "yahoo dot com"
  if (/\b(gmail|yahoo|hotmail|outlook|icloud)\s+dot\s+com\b/i.test(norm)) {
    return true;
  }

  return false;
}

/**
 * Master Chat Safety Inspector
 */
export function checkMessageSafety(
  text: string,
  senderId: string,
  settings: ChatSafetySettings = DEFAULT_CHAT_SAFETY_SETTINGS
): ChatSafetyCheckResult {
  if (!settings.enabled) {
    return { isAllowed: true };
  }

  const now = Date.now();

  // 1. Check if user is currently restricted (CHAT-08)
  if (settings.temporaryRestriction) {
    const userRestriction = userViolationTracker[senderId];
    if (userRestriction && userRestriction.restrictedUntil > now) {
      const remainingMins = Math.ceil((userRestriction.restrictedUntil - now) / 60000);
      return {
        isAllowed: false,
        blockedCode: 'CHAT-08',
        reason: 'Temporary chat restriction active due to repeated violations',
        userFacingError: `Your classroom chat is temporarily restricted for ${remainingMins} minute(s) due to repeated privacy policy violations. Please keep all communication within the academy platform.`,
        isRestrictedUser: true
      };
    }
  }

  // 2. Spam & Rate Limiting Check (CHAT-07)
  if (settings.detectSpamRateLimit) {
    if (!userRateTracker[senderId]) {
      userRateTracker[senderId] = { timestamps: [], lastMessage: '' };
    }
    const tracker = userRateTracker[senderId];
    tracker.timestamps = tracker.timestamps.filter(ts => now - ts < 10000); // 10s window

    // Duplicate message spam check
    if (tracker.lastMessage === text.trim() && tracker.timestamps.length > 0 && (now - tracker.timestamps[tracker.timestamps.length - 1]) < 2000) {
      return {
        isAllowed: false,
        blockedCode: 'CHAT-07',
        reason: 'Duplicate rapid message spam',
        userFacingError: "You are sending duplicate messages too quickly. Please slow down and keep communication focused on your lesson."
      };
    }

    // Rate limit: Max 5 messages in 10 seconds
    if (tracker.timestamps.length >= 5) {
      return {
        isAllowed: false,
        blockedCode: 'CHAT-07',
        reason: 'Rate limit exceeded (5+ msgs / 10s)',
        userFacingError: "You are sending messages too quickly. Please slow down and keep communication focused on your lesson."
      };
    }

    // Length check
    if (text.length > 1000) {
      return {
        isAllowed: false,
        blockedCode: 'CHAT-07',
        reason: 'Excessive message length (>1000 chars)',
        userFacingError: "Your message is too long. Please keep classroom messages concise."
      };
    }

    tracker.timestamps.push(now);
    tracker.lastMessage = text.trim();
  }

  const standardUserError = "For everyone's privacy and safety, personal contact information can't be shared in classroom chat. Please keep communication within the academy platform.";

  // 3. Phone Number Detection (CHAT-01)
  if (settings.detectPhone && checkPhoneNumber(text)) {
    registerViolation(senderId, settings);
    return {
      isAllowed: false,
      blockedCode: 'CHAT-01',
      reason: 'Phone number detected',
      userFacingError: standardUserError,
      matchedPattern: 'phone_number'
    };
  }

  // 4. Email Address Detection (CHAT-02)
  if (settings.detectEmail && checkEmailAddress(text)) {
    registerViolation(senderId, settings);
    return {
      isAllowed: false,
      blockedCode: 'CHAT-02',
      reason: 'Email address detected',
      userFacingError: standardUserError,
      matchedPattern: 'email_address'
    };
  }

  // 5. External Links / Invite URLs (CHAT-03)
  if (settings.detectLinks && checkExternalLinks(text)) {
    registerViolation(senderId, settings);
    return {
      isAllowed: false,
      blockedCode: 'CHAT-03',
      reason: 'External or contact link detected',
      userFacingError: standardUserError,
      matchedPattern: 'external_link'
    };
  }

  // 6. Social Handles / App Mention (CHAT-04)
  if (settings.detectHandles && checkSocialHandles(text)) {
    registerViolation(senderId, settings);
    return {
      isAllowed: false,
      blockedCode: 'CHAT-04',
      reason: 'Social handle or contact app detected',
      userFacingError: standardUserError,
      matchedPattern: 'social_handle'
    };
  }

  // 7. Contact-Sharing Instruction (CHAT-05)
  if (checkContactSharingInstruction(text)) {
    registerViolation(senderId, settings);
    return {
      isAllowed: false,
      blockedCode: 'CHAT-05',
      reason: 'Contact-sharing instruction detected',
      userFacingError: standardUserError,
      matchedPattern: 'contact_instruction'
    };
  }

  // 8. Obfuscated Contact Info (CHAT-06)
  if (settings.detectObfuscation && checkObfuscatedContact(text)) {
    registerViolation(senderId, settings);
    return {
      isAllowed: false,
      blockedCode: 'CHAT-06',
      reason: 'Obfuscated contact info detected',
      userFacingError: standardUserError,
      matchedPattern: 'obfuscated_contact'
    };
  }

  return { isAllowed: true };
}

/**
 * Tracks violation count for temporary chat restrictions (CHAT-08)
 */
function registerViolation(senderId: string, settings: ChatSafetySettings): void {
  if (!settings.temporaryRestriction) return;

  const now = Date.now();
  if (!userViolationTracker[senderId]) {
    userViolationTracker[senderId] = { count: 0, restrictedUntil: 0 };
  }

  const tracker = userViolationTracker[senderId];
  tracker.count++;

  // 3 violations -> restrict for 5 minutes
  if (tracker.count >= 3) {
    tracker.restrictedUntil = now + 5 * 60 * 1000; // 5 mins
    tracker.count = 0; // Reset counter after restriction triggered
  }
}

/**
 * Returns human-readable code description for Admin logs
 */
export function getCodeTitle(code: ChatSafetyErrorCode): string {
  switch (code) {
    case 'CHAT-01': return 'Phone Number Detected';
    case 'CHAT-02': return 'Email Address Detected';
    case 'CHAT-03': return 'External/Contact Link Detected';
    case 'CHAT-04': return 'Social/Contact Handle Detected';
    case 'CHAT-05': return 'Contact-Sharing Instruction Detected';
    case 'CHAT-06': return 'Obfuscated Contact Info Detected';
    case 'CHAT-07': return 'Spam / Rate-Limit Violation';
    case 'CHAT-08': return 'Repeated Violations / User Restricted';
    default: return 'Safety Violation';
  }
}
