import { DayOfWeek } from '../types';

export interface SupportedCountry {
  code: string;
  name: string; // The official display name (e.g. "USA", "Canada (CAD)", "UK", "Australia (AUS)", "New Zealand (NZ)", "UAE", "KSA", "Pakistan (PAK)")
  shortName: string;
  defaultTimezone: string;
}

export const SUPPORTED_COUNTRIES: SupportedCountry[] = [
  { code: 'USA', name: 'USA', shortName: 'USA', defaultTimezone: 'America/New_York' },
  { code: 'CAN', name: 'Canada (CAD)', shortName: 'Canada', defaultTimezone: 'America/Toronto' },
  { code: 'GBR', name: 'UK', shortName: 'UK', defaultTimezone: 'Europe/London' },
  { code: 'AUS', name: 'Australia (AUS)', shortName: 'Australia', defaultTimezone: 'Australia/Sydney' },
  { code: 'NZL', name: 'New Zealand (NZ)', shortName: 'NZ', defaultTimezone: 'Pacific/Auckland' },
  { code: 'ARE', name: 'UAE', shortName: 'UAE', defaultTimezone: 'Asia/Dubai' },
  { code: 'SAU', name: 'KSA', shortName: 'KSA', defaultTimezone: 'Asia/Riyadh' },
  { code: 'PAK', name: 'Pakistan (PAK)', shortName: 'PAK', defaultTimezone: 'Asia/Karachi' },
];

export interface SupportedTimezone {
  value: string; // IANA ID (e.g. 'America/New_York')
  label: string; // Clean UI label with short abbreviation & region
  shortCode: string; // e.g. 'ET', 'CT', 'MT', 'PT', 'GMT', 'AET', etc.
  country: string; // Country name
}

export const COMMON_TIMEZONES: SupportedTimezone[] = [
  // USA
  { value: 'America/New_York', label: 'ET - Eastern (New York, Florida, DC)', shortCode: 'ET', country: 'USA' },
  { value: 'America/Chicago', label: 'CT - Central (Chicago, Texas, Illinois)', shortCode: 'CT', country: 'USA' },
  { value: 'America/Denver', label: 'MT - Mountain (Denver, Colorado, Utah)', shortCode: 'MT', country: 'USA' },
  { value: 'America/Phoenix', label: 'MST - Arizona (No DST)', shortCode: 'MST', country: 'USA' },
  { value: 'America/Los_Angeles', label: 'PT - Pacific (California, Washington)', shortCode: 'PT', country: 'USA' },
  { value: 'America/Anchorage', label: 'AKT - Alaska', shortCode: 'AKT', country: 'USA' },
  { value: 'Pacific/Honolulu', label: 'HST - Hawaii', shortCode: 'HST', country: 'USA' },

  // Canada (CAD)
  { value: 'America/Toronto', label: 'ET - Canada Eastern (Toronto, Montreal, ON/QC)', shortCode: 'ET', country: 'Canada (CAD)' },
  { value: 'America/Winnipeg', label: 'CT - Canada Central (Manitoba, MB)', shortCode: 'CT', country: 'Canada (CAD)' },
  { value: 'America/Edmonton', label: 'MT - Canada Mountain (Alberta, Calgary, AB)', shortCode: 'MT', country: 'Canada (CAD)' },
  { value: 'America/Vancouver', label: 'PT - Canada Pacific (Vancouver, BC)', shortCode: 'PT', country: 'Canada (CAD)' },
  { value: 'America/Halifax', label: 'AT - Canada Atlantic (Nova Scotia, NB, PEI)', shortCode: 'AT', country: 'Canada (CAD)' },
  { value: 'America/St_Johns', label: 'NT - Newfoundland', shortCode: 'NT', country: 'Canada (CAD)' },

  // UK
  { value: 'Europe/London', label: 'GMT / BST - UK (London, Manchester, Scotland)', shortCode: 'GMT', country: 'UK' },

  // Australia (AUS)
  { value: 'Australia/Sydney', label: 'AET - Sydney, Melbourne, Canberra (NSW/VIC)', shortCode: 'AET', country: 'Australia (AUS)' },
  { value: 'Australia/Brisbane', label: 'AEST - Brisbane, Queensland (No DST)', shortCode: 'AEST', country: 'Australia (AUS)' },
  { value: 'Australia/Adelaide', label: 'ACST - Adelaide, South Australia (SA)', shortCode: 'ACST', country: 'Australia (AUS)' },
  { value: 'Australia/Darwin', label: 'ACST - Darwin, Northern Territory (No DST)', shortCode: 'ACST', country: 'Australia (AUS)' },
  { value: 'Australia/Perth', label: 'AWST - Perth, Western Australia (WA)', shortCode: 'AWST', country: 'Australia (AUS)' },

  // New Zealand (NZ)
  { value: 'Pacific/Auckland', label: 'NZST - New Zealand (Auckland, Wellington)', shortCode: 'NZST', country: 'New Zealand (NZ)' },

  // UAE
  { value: 'Asia/Dubai', label: 'GST - UAE (Dubai, Abu Dhabi, UTC+4)', shortCode: 'GST', country: 'UAE' },

  // KSA
  { value: 'Asia/Riyadh', label: 'AST - KSA (Riyadh, Makkah, Jeddah, UTC+3)', shortCode: 'AST', country: 'KSA' },

  // Pakistan (PAK)
  { value: 'Asia/Karachi', label: 'PKT - Pakistan Standard Time (UTC+5)', shortCode: 'PKT', country: 'Pakistan (PAK)' },
];

/**
 * Returns a short, user-friendly timezone code (e.g. "ET", "PKT", "GMT") for any IANA string.
 */
export function getTimezoneShortCode(tzIana?: string): string {
  if (!tzIana) return 'PKT';
  const match = COMMON_TIMEZONES.find(t => t.value === tzIana);
  if (match) return match.shortCode;

  // Derive if not in standard list
  if (tzIana.includes('New_York') || tzIana.includes('Toronto')) return 'ET';
  if (tzIana.includes('Chicago') || tzIana.includes('Winnipeg')) return 'CT';
  if (tzIana.includes('Denver') || tzIana.includes('Edmonton')) return 'MT';
  if (tzIana.includes('Los_Angeles') || tzIana.includes('Vancouver')) return 'PT';
  if (tzIana.includes('London')) return 'GMT';
  if (tzIana.includes('Karachi')) return 'PKT';
  if (tzIana.includes('Dubai')) return 'GST';
  if (tzIana.includes('Riyadh')) return 'AST';
  if (tzIana.includes('Sydney') || tzIana.includes('Melbourne')) return 'AET';
  if (tzIana.includes('Auckland')) return 'NZST';
  if (tzIana.includes('Perth')) return 'AWST';

  return tzIana.split('/').pop()?.replace('_', ' ') || tzIana;
}

/**
 * Auto-detects the client's current browser timezone and preselects the corresponding country and IANA ID.
 */
export function detectUserLocation(): { country: string; timezone: string } {
  try {
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!userTz) {
      return { country: 'USA', timezone: 'America/New_York' };
    }

    // Direct match
    const exact = COMMON_TIMEZONES.find(t => t.value === userTz);
    if (exact) {
      return { country: exact.country, timezone: exact.value };
    }

    // Heuristics for Canadian vs US Americas
    if (userTz.startsWith('America/')) {
      if (
        userTz.includes('Toronto') ||
        userTz.includes('Vancouver') ||
        userTz.includes('Edmonton') ||
        userTz.includes('Winnipeg') ||
        userTz.includes('Halifax') ||
        userTz.includes('St_Johns') ||
        userTz.includes('Montreal') ||
        userTz.includes('Regina')
      ) {
        return { country: 'Canada (CAD)', timezone: userTz };
      }
      if (userTz.includes('Detroit') || userTz.includes('Indiana') || userTz.includes('Kentucky')) {
        return { country: 'USA', timezone: 'America/New_York' };
      }
      if (userTz.includes('Boise')) {
        return { country: 'USA', timezone: 'America/Denver' };
      }
      return { country: 'USA', timezone: 'America/New_York' };
    }

    if (userTz.startsWith('Europe/London') || userTz === 'GB' || userTz === 'Europe/Belfast') {
      return { country: 'UK', timezone: 'Europe/London' };
    }
    if (userTz.startsWith('Australia/')) {
      return { country: 'Australia (AUS)', timezone: userTz };
    }
    if (userTz.startsWith('Pacific/Auckland') || userTz.startsWith('Pacific/Chatham')) {
      return { country: 'New Zealand (NZ)', timezone: 'Pacific/Auckland' };
    }
    if (userTz.includes('Dubai') || userTz.includes('Muscat')) {
      return { country: 'UAE', timezone: 'Asia/Dubai' };
    }
    if (userTz.includes('Riyadh') || userTz.includes('Jeddah') || userTz.includes('Kuwait') || userTz.includes('Qatar') || userTz.includes('Bahrain')) {
      return { country: 'KSA', timezone: 'Asia/Riyadh' };
    }
    if (userTz.includes('Karachi') || userTz.includes('Islamabad') || userTz.includes('Lahore')) {
      return { country: 'Pakistan (PAK)', timezone: 'Asia/Karachi' };
    }

    return { country: 'USA', timezone: 'America/New_York' };
  } catch (error) {
    return { country: 'USA', timezone: 'America/New_York' };
  }
}

const DAYS_OF_WEEK: DayOfWeek[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

/**
 * Converts a class time in Asia/Karachi (PKT) to the student's local timezone.
 * Returns the student's authoritative local day of the week, local time string (e.g. "08:00 PM"), and short TZ label.
 */
export function convertPKTToStudentTime(
  dayOfWeekPKT: DayOfWeek,
  startTimePKT: string,
  studentTimezone: string
): { localDay: DayOfWeek; localTime: string; localTime24: string; formatted: string; shortTz: string } {
  const shortTz = getTimezoneShortCode(studentTimezone);
  try {
    const [hoursStr, minutesStr] = startTimePKT.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    // Reference Monday: 2026-09-14 is a Monday
    const dayIndexMap: Record<DayOfWeek, number> = {
      Monday: 14,
      Tuesday: 15,
      Wednesday: 16,
      Thursday: 17,
      Friday: 18,
      Saturday: 19,
      Sunday: 20
    };

    const dayOfMonth = dayIndexMap[dayOfWeekPKT] || 14;
    // PKT is fixed UTC+05:00
    const isoString = `2026-09-${dayOfMonth.toString().padStart(2, '0')}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00+05:00`;
    const dateObj = new Date(isoString);

    // Format into the target student timezone using IANA ID for accurate DST calculation
    const dayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: studentTimezone || 'Asia/Karachi',
      weekday: 'long'
    });

    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: studentTimezone || 'Asia/Karachi',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const time24Formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: studentTimezone || 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const localDay = dayFormatter.format(dateObj) as DayOfWeek;
    const localTime = timeFormatter.format(dateObj);
    const localTime24 = time24Formatter.format(dateObj);

    return {
      localDay: DAYS_OF_WEEK.includes(localDay) ? localDay : dayOfWeekPKT,
      localTime,
      localTime24,
      formatted: `${localDay} ${localTime} (${shortTz})`,
      shortTz
    };
  } catch (error) {
    console.error("Timezone conversion error:", error);
    return {
      localDay: dayOfWeekPKT,
      localTime: startTimePKT,
      localTime24: startTimePKT,
      formatted: `${dayOfWeekPKT} ${startTimePKT} (${shortTz})`,
      shortTz
    };
  }
}

/**
 * Format 24h PKT time into a friendly 12h display (e.g. "05:00" -> "5:00 AM PKT")
 */
export function formatPKTTime(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${m.toString().padStart(2, '0')} ${period} PKT`;
}

/**
 * Returns the active teaching day of the week, correctly adjusted for midnight offset.
 * e.g., if it is Tuesday 1:00 AM to 11:59 AM in Pakistan, it represents Monday's teaching session for the students.
 */
export function getCurrentTeachingDay(): DayOfWeek {
  const now = new Date();
  const pktString = now.toLocaleString('en-US', { timeZone: 'Asia/Karachi' });
  const pktDate = new Date(pktString);
  const pktDayNum = pktDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const pktHour = pktDate.getHours();
  const DAYS: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const pktDayName = DAYS[pktDayNum];
  
  if (pktHour < 12) {
    const adjustedDayNum = (pktDayNum + 6) % 7;
    return DAYS[adjustedDayNum];
  }
  return pktDayName;
}

