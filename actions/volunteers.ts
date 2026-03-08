'use server';

import { getClient } from '@/lib/mongodb';
import {
  DBVolunteer,
  VolunteerSession,
  VolunteerStats,
  CheckInLog,
  CheckActionType,
  EventStats,
  MealStatus,
} from '@/types';

const DB_NAME = 'hackoverflow';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getDb() {
  const client = await getClient();
  return client.db(DB_NAME);
}

// ── Volunteer CRUD ────────────────────────────────────────────────────────────

export async function getAllVolunteers(): Promise<DBVolunteer[]> {
  try {
    const db = await getDb();
    return db
      .collection<DBVolunteer>('volunteers')
      .find({})
      .sort({ name: 1 })
      .toArray();
  } catch (error) {
    console.error('Error fetching volunteers:', error);
    throw new Error('Failed to fetch volunteers');
  }
}

export async function createVolunteer(
  data: Omit<DBVolunteer, '_id' | 'volunteerId' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  try {
    const db = await getDb();
    const volunteer: DBVolunteer = {
      ...data,
      volunteerId: crypto.randomUUID(),
      createdAt:   new Date(),
      updatedAt:   new Date(),
    };
    await db.collection<DBVolunteer>('volunteers').insertOne(volunteer);
  } catch (error) {
    console.error('Error creating volunteer:', error);
    throw new Error('Failed to create volunteer');
  }
}

export async function toggleVolunteerActive(
  volunteerId: string,
  isActive: boolean
): Promise<void> {
  try {
    const db = await getDb();
    await db
      .collection<DBVolunteer>('volunteers')
      .updateOne(
        { volunteerId },
        { $set: { isActive, updatedAt: new Date() } }
      );
  } catch (error) {
    console.error('Error toggling volunteer active state:', error);
    throw new Error('Failed to update volunteer');
  }
}

// ── Stats aggregation ─────────────────────────────────────────────────────────

/** Builds per-volunteer stats from check-in logs and session history */
export async function getVolunteerStats(): Promise<VolunteerStats[]> {
  try {
    const db = await getDb();

    const [volunteers, logs, allSessions, activeSessions] = await Promise.all([
      db.collection<DBVolunteer>('volunteers').find({}).toArray(),
      db.collection<CheckInLog>('checkin_logs').find({}).toArray(),
      db.collection<VolunteerSession>('volunteer_sessions').find({}).toArray(),
      db.collection<VolunteerSession>('volunteer_sessions').find({ isActive: true }).toArray(),
    ]);

    return volunteers.map(v => {
      const volunteerLogs = logs.filter(l => l.processedBy?.volunteerId === v.volunteerId);

      const actionBreakdown: Partial<Record<CheckActionType, number>> = {};
      for (const log of volunteerLogs) {
        actionBreakdown[log.actionType] = (actionBreakdown[log.actionType] ?? 0) + 1;
      }

      const volunteerSessions = allSessions.filter(s => s.volunteerId === v.volunteerId);
      const totalDutyMinutes  = volunteerSessions.reduce((acc, s) => {
        const end = s.endedAt ? new Date(s.endedAt) : new Date();
        return acc + Math.floor((end.getTime() - new Date(s.startedAt).getTime()) / 60_000);
      }, 0);

      const activeSession = activeSessions.find(s => s.volunteerId === v.volunteerId);

      return {
        volunteerId:    v.volunteerId,
        volunteerName:  v.name,
        role:           v.role,
        assignedStation: v.assignedStation ?? '—',
        totalActions:   volunteerLogs.length,
        actionBreakdown,
        currentSession: activeSession
          ? { sessionId: activeSession.sessionId, station: activeSession.station, startedAt: activeSession.startedAt }
          : undefined,
        totalDutyMinutes,
      };
    });
  } catch (error) {
    console.error('Error fetching volunteer stats:', error);
    throw new Error('Failed to fetch volunteer stats');
  }
}

/** Builds the full event stats document for the admin stats dashboard */
export async function getEventStats(): Promise<EventStats> {
  try {
    const db = await getDb();

    const [participants, logs, activeSessions] = await Promise.all([
      db.collection('participants').find({}).toArray(),
      db.collection<CheckInLog>('checkin_logs').find({}).toArray(),
      db.collection<VolunteerSession>('volunteer_sessions').find({ isActive: true }).toArray(),
    ]);

    // ── Meal stats ────────────────────────────────────────────────────────────
    const mealKeys: (keyof MealStatus)[] = [
      'day1_dinner',
      'day2_breakfast',
      'day2_lunch',
      'day2_dinner',
      'day3_breakfast',
      'day3_lunch',
    ];

    const mealStats = {} as Record<keyof MealStatus, number>;
    for (const key of mealKeys) {
      mealStats[key] = participants.filter((p: any) => p.meals?.[key]).length;
    }

    // ── Hourly check-in timeline (last 24 hours) ──────────────────────────────
    const now = new Date();
    const checkinTimeline: Array<{ hour: string; count: number }> = [];
    for (let i = 23; i >= 0; i--) {
      const slotStart = new Date(now.getTime() - i * 3_600_000);
      const slotEnd   = new Date(slotStart.getTime() + 3_600_000);
      const label     = slotStart.toTimeString().slice(0, 5);
      const count     = logs.filter(l => {
        const t = new Date(l.timestamp);
        return t >= slotStart && t < slotEnd;
      }).length;
      checkinTimeline.push({ hour: label, count });
    }

    const volunteerStats = await getVolunteerStats();

    return {
      asOf: now,
      totalRegistered:       participants.length,
      totalCheckedInCollege: participants.filter((p: any) => p.collegeCheckIn?.status).length,
      totalInsideLab:        participants.filter((p: any) => p.labCheckIn?.status && !p.labCheckOut?.status && !p.tempLabCheckOut?.status).length,
      totalOnTempExit:       participants.filter((p: any) => p.tempLabCheckOut?.status).length,
      totalCheckedOut:       participants.filter((p: any) => p.collegeCheckOut?.status).length,
      mealStats,
      activeVolunteers: activeSessions.length,
      volunteerStats,
      checkinTimeline,
    };
  } catch (error) {
    console.error('Error fetching event stats:', error);
    throw new Error('Failed to fetch event stats');
  }
}