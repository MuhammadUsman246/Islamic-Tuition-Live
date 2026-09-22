/**
 * Utilities for handling Zoom classroom URLs for tutors and attendees.
 */

export interface ParsedZoomInfo {
  meetingId: string;
  pwd: string;
  zoomusStartUrl: string;
  zoommtgStartUrl: string;
  zoomusJoinUrl: string;
  zoommtgJoinUrl: string;
  webStartUrl: string;
  webJoinUrl: string;
}

/**
 * Parses a standard Zoom web URL into native desktop client protocol URLs
 * and web fallback URLs. Includes explicit action=start and action=join
 * query parameters required by the desktop Zoom application process when running
 * in the background system tray on Windows and macOS.
 */
export function parseZoomUrl(rawUrl?: string): ParsedZoomInfo {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return {
      meetingId: '',
      pwd: '',
      zoomusStartUrl: '',
      zoommtgStartUrl: '',
      zoomusJoinUrl: '',
      zoommtgJoinUrl: '',
      webStartUrl: '',
      webJoinUrl: ''
    };
  }

  const trimmed = rawUrl.trim();

  try {
    const parsed = new URL(trimmed);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const meetingId = pathParts[pathParts.length - 1] || '';
    const pwd = parsed.searchParams.get('pwd') || '';

    // Zoom desktop URI protocol syntax requires action=start or action=join to wake up background taskbar processes
    const pwdParam = pwd ? `&pwd=${encodeURIComponent(pwd)}` : '';
    const zoomusStartUrl = meetingId
      ? `zoomus://zoom.us/start?action=start&confno=${meetingId}${pwdParam}`
      : trimmed;

    const zoommtgStartUrl = meetingId
      ? `zoommtg://zoom.us/start?action=start&confno=${meetingId}${pwdParam}`
      : trimmed;

    const zoomusJoinUrl = meetingId
      ? `zoomus://zoom.us/join?action=join&confno=${meetingId}${pwdParam}`
      : trimmed;

    const zoommtgJoinUrl = meetingId
      ? `zoommtg://zoom.us/join?action=join&confno=${meetingId}${pwdParam}`
      : trimmed;

    const webStartUrl = trimmed.includes('/j/')
      ? trimmed.replace('/j/', '/s/')
      : trimmed;

    return {
      meetingId,
      pwd,
      zoomusStartUrl,
      zoommtgStartUrl,
      zoomusJoinUrl,
      zoommtgJoinUrl,
      webStartUrl,
      webJoinUrl: trimmed
    };
  } catch {
    const idMatch = trimmed.match(/\/(?:j|s)\/([0-9]+)/);
    const pwdMatch = trimmed.match(/pwd=([a-zA-Z0-9._-]+)/);
    const meetingId = idMatch ? idMatch[1] : '';
    const pwd = pwdMatch ? pwdMatch[1] : '';
    const pwdParam = pwd ? `&pwd=${encodeURIComponent(pwd)}` : '';

    const zoomusStartUrl = meetingId
      ? `zoomus://zoom.us/start?action=start&confno=${meetingId}${pwdParam}`
      : trimmed;

    const zoommtgStartUrl = meetingId
      ? `zoommtg://zoom.us/start?action=start&confno=${meetingId}${pwdParam}`
      : trimmed;

    const zoomusJoinUrl = meetingId
      ? `zoomus://zoom.us/join?action=join&confno=${meetingId}${pwdParam}`
      : trimmed;

    const zoommtgJoinUrl = meetingId
      ? `zoommtg://zoom.us/join?action=join&confno=${meetingId}${pwdParam}`
      : trimmed;

    const webStartUrl = trimmed.includes('/j/')
      ? trimmed.replace('/j/', '/s/')
      : trimmed;

    return {
      meetingId,
      pwd,
      zoomusStartUrl,
      zoommtgStartUrl,
      zoomusJoinUrl,
      zoommtgJoinUrl,
      webStartUrl,
      webJoinUrl: trimmed
    };
  }
}

/**
 * Launches the Zoom meeting in the desktop app for a tutor (host).
 * Directly invokes native OS protocol handlers (zoomus:// and zoommtg:// with action=start)
 * via temporary DOM triggers. This forces the desktop Zoom application to wake up and start
 * the meeting even when idling in the background taskbar/system tray, without opening
 * any extra browser tabs.
 */
export function launchTutorZoomDesktop(rawUrl?: string): boolean {
  // 1. Direct OS invocation to launch/focus the Zoom Workplace desktop application directly
  try {
    const appLink = document.createElement('a');
    appLink.href = 'zoomus://';
    appLink.style.display = 'none';
    document.body.appendChild(appLink);
    appLink.click();
    setTimeout(() => {
      if (document.body.contains(appLink)) {
        document.body.removeChild(appLink);
      }
    }, 1000);
  } catch (e) {
    console.warn('zoomus app launch error:', e);
  }

  // 2. Secondary direct protocol trigger for desktop Zoom Workplace
  setTimeout(() => {
    try {
      const appLink2 = document.createElement('a');
      appLink2.href = 'zoomus://zoom.us/';
      appLink2.style.display = 'none';
      document.body.appendChild(appLink2);
      appLink2.click();
      setTimeout(() => {
        if (document.body.contains(appLink2)) {
          document.body.removeChild(appLink2);
        }
      }, 1000);
    } catch (e) {
      console.warn('zoomus://zoom.us/ launch error:', e);
    }
  }, 50);

  // 3. If a specific meeting ID / link is provided, trigger the host meeting start protocol
  if (rawUrl && rawUrl.trim()) {
    const { zoomusStartUrl, zoommtgStartUrl } = parseZoomUrl(rawUrl);

    setTimeout(() => {
      try {
        const link = document.createElement('a');
        link.href = zoomusStartUrl;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
        }, 1000);
      } catch (e) {
        console.warn('zoomus start launch error:', e);
      }
    }, 120);

    setTimeout(() => {
      try {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = zoommtgStartUrl;
        document.body.appendChild(iframe);
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 2000);
      } catch (e) {
        console.warn('zoommtg start launch error:', e);
      }
    }, 220);
  }

  return true;
}
