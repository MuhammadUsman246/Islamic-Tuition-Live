import { Tutor, UserRole } from '../types';

/**
 * Strictly resolves any tutor identifier, object, or string into its canonical
 * privacy-safe Tutor ID (e.g. "Tutor 1", "Tutor 2") without ever exposing a tutor's real name.
 */
export function getTutorDisplayId(tutorInput: any, tutors?: Tutor[]): string {
  if (!tutorInput) return 'Tutor 1';

  // If a Tutor object is passed directly
  if (typeof tutorInput === 'object') {
    const rawId = String(tutorInput.tutorId || tutorInput.id || '').trim();
    const idMatch = rawId.match(/(\d+)/);
    if (idMatch) {
      return `Tutor ${parseInt(idMatch[1], 10)}`;
    }
    if (Array.isArray(tutors) && tutors.length > 0) {
      const realLower = String(tutorInput.realName || tutorInput.displayName || '').trim().toLowerCase();
      if (realLower) {
        const found = tutors.find(
          t =>
            (t.realName && t.realName.trim().toLowerCase() === realLower) ||
            (t.displayName && t.displayName.trim().toLowerCase() === realLower)
        );
        const foundMatch = found?.tutorId?.match(/(\d+)/);
        if (foundMatch) {
          return `Tutor ${parseInt(foundMatch[1], 10)}`;
        }
      }
    }
    return 'Tutor 1';
  }

  const rawStr = String(tutorInput).trim();
  if (!rawStr || rawStr.toLowerCase() === 'unassigned') {
    return 'Unassigned';
  }

  // 1. Extract numeric ID if present (handles "Tutor 2", "Tutor 2 (Rahib)", "TUT-002", "tutor_2", etc.)
  const numMatch = rawStr.match(/(\d+)/);
  if (numMatch) {
    return `Tutor ${parseInt(numMatch[1], 10)}`;
  }

  // 2. If a real name was stored in a legacy field (e.g. "Rahib"), look up the Tutor ID from the tutors list
  if (Array.isArray(tutors) && tutors.length > 0) {
    const cleanLower = rawStr.replace(/^ustadh\s+/i, '').trim().toLowerCase();
    const matchedTutor = tutors.find(t => {
      const rName = (t.realName || '').trim().toLowerCase();
      const dName = (t.displayName || '').trim().toLowerCase();
      return (
        rName === cleanLower ||
        dName === cleanLower ||
        (rName && rName.split(' ')[0] === cleanLower) ||
        ( cleanLower && rName.includes(cleanLower))
      );
    });
    if (matchedTutor?.tutorId) {
      const m = matchedTutor.tutorId.match(/(\d+)/);
      if (m) return `Tutor ${parseInt(m[1], 10)}`;
    }
  }

  // 3. Never return an unverified string that could be a tutor's real name
  return 'Tutor 1';
}

/**
 * Role-aware tutor name formatter:
 * - For in-house academy roles ('admin', 'supervisor', 'tutor'): shows Assigned ID + Real Name (e.g., "Tutor 2 (Rahib)")
 * - For external roles ('student', 'parent', 'guest'): strictly shows ONLY the Assigned Tutor ID (e.g., "Tutor 2")
 */
export function getTutorDisplayName(
  tutorInput: any,
  tutors?: Tutor[],
  viewerRole?: UserRole | string
): string {
  const safeId = getTutorDisplayId(tutorInput, tutors);
  const isInHouse =
    viewerRole === 'admin' || viewerRole === 'supervisor' || viewerRole === 'tutor';

  if (!isInHouse) {
    return safeId;
  }

  // Resolve real name for in-house staff
  if (typeof tutorInput === 'object' && tutorInput?.realName) {
    const rName = String(tutorInput.realName).trim();
    if (rName && rName.toLowerCase() !== safeId.toLowerCase()) {
      return `${safeId} (${rName})`;
    }
    return safeId;
  }

  if (Array.isArray(tutors) && tutors.length > 0) {
    const found = tutors.find(t => getTutorDisplayId(t.tutorId) === safeId);
    if (found?.realName && found.realName.trim().toLowerCase() !== safeId.toLowerCase()) {
      return `${safeId} (${found.realName.trim()})`;
    }
  }

  return safeId;
}
