import {
  PermanentRoom,
  RoomOverride,
  GuestLink,
  ClassroomRecording,
  WaitingRoomParticipant
} from '../types';

// Pre-seeded 25 Tutor ID slots with clean room slugs and default 5-digit passcodes (12345)
export const INITIAL_PERMANENT_ROOMS: PermanentRoom[] = Array.from({ length: 25 }, (_, idx) => {
  const num = idx + 1;
  const tutorId = `Tutor ${num}`;
  const slug = `tutor-${num}`;

  return {
    id: `perm_room_${num}`,
    room_slug: slug,
    livekit_room_id: `room_${slug}`,
    tutor_id: tutorId,
    student_id: `STU-${num.toString().padStart(3, '0')}`,
    meeting_id: 10000100 + num,
    passcode: '12345',
    base_scheduled_time: '15:00:00',
    timezone: 'Asia/Karachi',
    createdAt: new Date().toISOString()
  };
});

class ClassroomDbService {
  private permanentRooms: PermanentRoom[] = [...INITIAL_PERMANENT_ROOMS];
  private roomOverrides: RoomOverride[] = [];
  private guestLinks: GuestLink[] = [];
  private recordings: ClassroomRecording[] = [];
  private waitingRoom: WaitingRoomParticipant[] = [];

  constructor() {
    this.loadFromLocalStorage();
  }

  private loadFromLocalStorage() {
    if (typeof window === 'undefined') return;
    try {
      const p = localStorage.getItem('edtech_permanent_rooms');
      if (p) this.permanentRooms = JSON.parse(p);

      const o = localStorage.getItem('edtech_room_overrides');
      if (o) this.roomOverrides = JSON.parse(o);

      const g = localStorage.getItem('edtech_guest_links');
      if (g) this.guestLinks = JSON.parse(g);

      const r = localStorage.getItem('edtech_recordings');
      if (r) this.recordings = JSON.parse(r);

      const w = localStorage.getItem('edtech_waiting_room');
      if (w) this.waitingRoom = JSON.parse(w);
    } catch (e) {
      console.warn('Error loading classroom DB from local storage:', e);
    }
  }

  private saveToLocalStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('edtech_permanent_rooms', JSON.stringify(this.permanentRooms));
      localStorage.setItem('edtech_room_overrides', JSON.stringify(this.roomOverrides));
      localStorage.setItem('edtech_guest_links', JSON.stringify(this.guestLinks));
      localStorage.setItem('edtech_recordings', JSON.stringify(this.recordings));
      localStorage.setItem('edtech_waiting_room', JSON.stringify(this.waitingRoom));
    } catch (e) {
      console.warn('Error saving classroom DB to local storage:', e);
    }
  }

  // --- Permanent Rooms ---
  public getPermanentRooms(): PermanentRoom[] {
    return [...this.permanentRooms];
  }

  public getPermanentRoomBySlug(slug: string): PermanentRoom | undefined {
    return this.permanentRooms.find(r => r.room_slug.toLowerCase() === slug.toLowerCase());
  }

  public getPermanentRoomByUsers(tutorId: string, studentId?: string): PermanentRoom {
    const existing = this.permanentRooms.find(
      r => r.tutor_id.toLowerCase() === tutorId.toLowerCase()
    );
    if (existing) return existing;

    // Auto-provision new permanent slot for newly added tutor
    const match = tutorId.match(/\d+/);
    const num = match ? parseInt(match[0], 10) : (this.permanentRooms.length + 1);
    const slug = `tutor-${num}`;
    const meetingId = 10000100 + num;

    const newRoom: PermanentRoom = {
      id: `perm_room_${num}`,
      room_slug: slug,
      livekit_room_id: `room_${slug}`,
      tutor_id: tutorId,
      student_id: studentId || `STU-${num.toString().padStart(3, '0')}`,
      meeting_id: meetingId,
      passcode: '12345',
      base_scheduled_time: '15:00:00',
      timezone: 'Asia/Karachi',
      createdAt: new Date().toISOString()
    };

    this.permanentRooms.push(newRoom);
    this.saveToLocalStorage();
    return newRoom;
  }

  public createPermanentRoom(room: Omit<PermanentRoom, 'id'>): PermanentRoom {
    const newRoom: PermanentRoom = {
      ...room,
      id: `perm_room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    };
    this.permanentRooms.push(newRoom);
    this.saveToLocalStorage();
    return newRoom;
  }

  // --- Room Overrides ---
  public getRoomOverrides(): RoomOverride[] {
    return [...this.roomOverrides];
  }

  public getActiveOverrideForToday(permanentRoomId: string, currentDateStr: string): RoomOverride | undefined {
    return this.roomOverrides.find(
      o => o.permanent_room_id === permanentRoomId && o.override_date === currentDateStr && o.status === 'APPROVED'
    );
  }

  public createOverride(override: Omit<RoomOverride, 'id' | 'status'>): RoomOverride {
    const newOverride: RoomOverride = {
      ...override,
      id: `override_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };
    this.roomOverrides.push(newOverride);
    this.saveToLocalStorage();
    return newOverride;
  }

  public updateOverrideStatus(id: string, status: 'APPROVED' | 'REJECTED' | 'EXPIRED'): RoomOverride | undefined {
    const target = this.roomOverrides.find(o => o.id === id);
    if (target) {
      target.status = status;
      this.saveToLocalStorage();
    }
    return target;
  }

  public cleanupExpiredOverrides(currentDateStr: string): void {
    let changed = false;
    this.roomOverrides.forEach(o => {
      if (o.override_date < currentDateStr && (o.status === 'PENDING' || o.status === 'APPROVED')) {
        o.status = 'EXPIRED';
        changed = true;
      }
    });
    if (changed) this.saveToLocalStorage();
  }

  // --- Guest Links ---
  public getGuestLinks(): GuestLink[] {
    return [...this.guestLinks];
  }

  public getGuestLinkByToken(tokenParam: string): GuestLink | undefined {
    return this.guestLinks.find(g => g.token_param === tokenParam);
  }

  public createGuestLink(tutorId: string, expiresInHours = 24): GuestLink {
    const tokenParam = `gt_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
    const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString();
    const newLink: GuestLink = {
      id: `gl_${Date.now()}`,
      token_param: tokenParam,
      tutor_id: tutorId,
      expires_at: expiresAt,
      is_used: false,
      createdAt: new Date().toISOString()
    };
    this.guestLinks.push(newLink);
    this.saveToLocalStorage();
    return newLink;
  }

  public markGuestLinkUsed(tokenParam: string): boolean {
    const link = this.guestLinks.find(g => g.token_param === tokenParam);
    if (link && !link.is_used) {
      link.is_used = true;
      this.saveToLocalStorage();
      return true;
    }
    return false;
  }

  // --- Recordings (28-day purging lifecycle) ---
  public getRecordings(): ClassroomRecording[] {
    return [...this.recordings];
  }

  public addRecording(recording: Omit<ClassroomRecording, 'id' | 'deleted_at'>): ClassroomRecording {
    const recordDate = new Date(recording.date_recorded || Date.now());
    const purgeDate = new Date(recordDate.getTime() + 28 * 24 * 3600 * 1000);

    const newRec: ClassroomRecording = {
      ...recording,
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      deleted_at: purgeDate.toISOString()
    };
    this.recordings.push(newRec);
    this.saveToLocalStorage();
    return newRec;
  }

  public purgeExpiredRecordings(): number {
    const nowISO = new Date().toISOString();
    const initialLen = this.recordings.length;
    this.recordings = this.recordings.filter(r => r.deleted_at > nowISO);
    if (this.recordings.length !== initialLen) {
      this.saveToLocalStorage();
    }
    return initialLen - this.recordings.length;
  }

  // --- Waiting Room Queue ---
  public getWaitingParticipants(roomSlug: string): WaitingRoomParticipant[] {
    return this.waitingRoom.filter(w => w.room_slug.toLowerCase() === roomSlug.toLowerCase() && w.status === 'WAITING');
  }

  public addWaitingParticipant(roomSlug: string, guestName: string): WaitingRoomParticipant {
    const participant: WaitingRoomParticipant = {
      id: `wp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      room_slug: roomSlug,
      guest_name: guestName,
      joined_at: new Date().toISOString(),
      status: 'WAITING'
    };
    this.waitingRoom.push(participant);
    this.saveToLocalStorage();
    return participant;
  }

  public updateWaitingParticipantStatus(id: string, status: 'ADMITTED' | 'REJECTED'): WaitingRoomParticipant | undefined {
    const target = this.waitingRoom.find(w => w.id === id);
    if (target) {
      target.status = status;
      this.saveToLocalStorage();
    }
    return target;
  }
}

export const classroomDb = new ClassroomDbService();
