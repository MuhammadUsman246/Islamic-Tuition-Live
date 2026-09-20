/**
 * Utilities for handling Zoom classroom URLs for tutors and attendees.
 */

export interface ParsedZoomInfo {
  meetingId: string;
  pwd: string;
  desktopStartUrl: string;
  webStartUrl: string;
  webJoinUrl: string;
}

/**
 * Parses a standard Zoom web URL into native desktop client protocol URLs
 * and web fallback URLs.
 */
export function parseZoomUrl(rawUrl?: string): ParsedZoomInfo {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return {
      meetingId: '',
      pwd: '',
      desktopStartUrl: '',
      webStartUrl: '',
      webJoinUrl: ''
    };
  }

  const trimmed = rawUrl.trim();

  try {
    const parsed = new URL(trimmed);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    // Usually /j/2533071345 or /s/2533071345
    const meetingId = pathParts[pathParts.length - 1] || '';
    const pwd = parsed.searchParams.get('pwd') || '';

    // zoommtg://zoom.us/start directly instructs the desktop client to START the meeting as host
    const desktopStartUrl = meetingId
      ? `zoommtg://zoom.us/start?confno=${meetingId}${pwd ? `&pwd=${encodeURIComponent(pwd)}` : ''}`
      : trimmed;

    // Zoom uses /s/ instead of /j/ for the host start page which automatically invokes desktop client
    const webStartUrl = trimmed.includes('/j/')
      ? trimmed.replace('/j/', '/s/')
      : trimmed;

    return {
      meetingId,
      pwd,
      desktopStartUrl,
      webStartUrl,
      webJoinUrl: trimmed
    };
  } catch {
    // Regex fallback if URL parsing encounters non-standard strings
    const idMatch = trimmed.match(/\/(?:j|s)\/([0-9]+)/);
    const pwdMatch = trimmed.match(/pwd=([a-zA-Z0-9._-]+)/);
    const meetingId = idMatch ? idMatch[1] : '';
    const pwd = pwdMatch ? pwdMatch[1] : '';

    const desktopStartUrl = meetingId
      ? `zoommtg://zoom.us/start?confno=${meetingId}${pwd ? `&pwd=${encodeURIComponent(pwd)}` : ''}`
      : trimmed;

    const webStartUrl = trimmed.includes('/j/')
      ? trimmed.replace('/j/', '/s/')
      : trimmed;

    return {
      meetingId,
      pwd,
      desktopStartUrl,
      webStartUrl,
      webJoinUrl: trimmed
    };
  }
}

/**
 * Launches the Zoom meeting in the desktop app for a tutor (host).
 * Automatically triggers both the zoommtg:// protocol handler and web start tab.
 */
export function launchTutorZoomDesktop(rawUrl?: string): boolean {
  if (!rawUrl) return false;

  const { desktopStartUrl, webStartUrl } = parseZoomUrl(rawUrl);

  // 1. Attempt native desktop application launch via hidden iframe
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = desktopStartUrl;
    document.body.appendChild(iframe);
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 3000);
  } catch (e) {
    console.warn('Could not launch zoommtg iframe directly:', e);
  }

  // 2. Also open the official host start URL in a new browser window/tab
  // This prompts "Open Zoom Meetings?" in browsers and starts the meeting in their logged-in Zoom desktop client
  window.open(webStartUrl, '_blank', 'noopener,noreferrer');
  return true;
}
