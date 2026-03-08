'use server';

import { getClient } from '@/lib/mongodb';
import {
  LabOTP,
  generateOTPCode,
  isOTPValid,
  ParticipantLocationSnapshot,
  LabMonitoringSummary,
  DBParticipant,
  CheckInLog,
  VolunteerSession,
} from '@/types';

const DB_NAME = 'hackoverflow';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getDb() {
  const client = await getClient();
  return client.db(DB_NAME);
}

// ── OTP ───────────────────────────────────────────────────────────────────────

/**
 * Returns the current valid OTP, or rotates to a fresh one if expired.
 * No external cron needed — self-rotating on each call.
 * Stores a single document in the `lab_otp` collection (overwritten each cycle).
 */
export async function getOrRotateOTP(): Promise<LabOTP> {
  try {
    const db = await getDb();
    const col = db.collection<LabOTP>('lab_otp');

    const existing = await col.findOne({});
    const now = new Date();

    if (existing && isOTPValid(existing)) {
      return {
        code:         existing.code,
        generatedAt:  existing.generatedAt,
        expiresAt:    existing.expiresAt,
      };
    }

    const newOTP: LabOTP = {
      code:        generateOTPCode(),
      generatedAt: now,
      expiresAt:   new Date(now.getTime() + 30_000),
    };

    await col.deleteMany({});
    await col.insertOne(newOTP);

    return newOTP;
  } catch (error) {
    console.error('Error rotating OTP:', error);
    throw new Error('Failed to get or rotate OTP');
  }
}

// ── Participant locations ─────────────────────────────────────────────────────

/**
 * Returns a real-time snapshot of every participant's location status,
 * plus summary counts. Optionally filtered by labAllotted.
 */
export async function getParticipantLocations(labFilter?: string): Promise<{
  snapshots: ParticipantLocationSnapshot[];
  summary:   LabMonitoringSummary;
}> {
  try {
    const db = await getDb();
    const query = labFilter ? { labAllotted: labFilter } : {};

    const participants = await db
      .collection<DBParticipant>('participants')
      .find(query)
      .toArray();

    const now = new Date();

    const snapshots: ParticipantLocationSnapshot[] = participants.map(p => {
      const isInsideCollege = !!p.collegeCheckIn?.status && !p.collegeCheckOut?.status;
      const isInsideLab     = !!p.labCheckIn?.status && !p.labCheckOut?.status && !p.tempLabCheckOut?.status;
      const isOnTempExit    = !!p.tempLabCheckOut?.status;
      const hasCheckedOut   = !!p.collegeCheckOut?.status;

      let tempExitMinutes: number | undefined;
      if (isOnTempExit && p.tempLabCheckOut?.time) {
        tempExitMinutes = Math.floor(
          (now.getTime() - new Date(p.tempLabCheckOut.time).getTime()) / 60_000
        );
      }

      return {
        participantId: p.participantId,
        name:          p.name,
        teamName:      p.teamName,
        teamId:        p.teamId,
        labAllotted:   p.labAllotted,
        isInsideCollege,
        isInsideLab,
        isOnTempExit,
        tempExitMinutes,
        hasCheckedOut,
        lastUpdated: p.updatedAt,
      };
    });

    const summary: LabMonitoringSummary = {
      totalParticipants: snapshots.length,
      insideLab:         snapshots.filter(s => s.isInsideLab).length,
      onTempExit:        snapshots.filter(s => s.isOnTempExit).length,
      outsideCollege:    snapshots.filter(s => !s.isInsideCollege && !s.hasCheckedOut).length,
      checkedOut:        snapshots.filter(s => s.hasCheckedOut).length,
      overdueExits:      snapshots.filter(s => s.isOnTempExit && (s.tempExitMinutes ?? 0) > 10).length,
    };

    return { snapshots, summary };
  } catch (error) {
    console.error('Error fetching participant locations:', error);
    throw new Error('Failed to fetch participant locations');
  }
}

/** Returns the distinct list of lab names assigned to participants */
export async function getLabList(): Promise<string[]> {
  try {
    const db = await getDb();
    const labs = await db
      .collection<DBParticipant>('participants')
      .distinct('labAllotted');
    return (labs.filter(Boolean) as string[]).sort();
  } catch (error) {
    console.error('Error fetching lab list:', error);
    throw new Error('Failed to fetch lab list');
  }
}

// ── Volunteer sessions ────────────────────────────────────────────────────────

/**
 * Creates a new active volunteer session when a volunteer opens the
 * Lab Monitoring page and submits their name + station.
 * Returns the generated sessionId.
 */
export async function startVolunteerSession(
  volunteerName: string,
  station: string
): Promise<string> {
  try {
    const db = await getDb();
    const sessionId = crypto.randomUUID();

    const session: VolunteerSession = {
      sessionId,
      volunteerId:   'manual',
      volunteerName,
      station,
      startedAt: new Date(),
      isActive:  true,
    };

    await db.collection<VolunteerSession>('volunteer_sessions').insertOne(session);
    return sessionId;
  } catch (error) {
    console.error('Error starting volunteer session:', error);
    throw new Error('Failed to start volunteer session');
  }
}

/** Marks a volunteer session as ended */
export async function endVolunteerSession(sessionId: string): Promise<void> {
  try {
    const db = await getDb();
    await db
      .collection<VolunteerSession>('volunteer_sessions')
      .updateOne(
        { sessionId },
        { $set: { isActive: false, endedAt: new Date() } }
      );
  } catch (error) {
    console.error('Error ending volunteer session:', error);
    throw new Error('Failed to end volunteer session');
  }
}

/** Returns all currently active volunteer sessions */
export async function getActiveVolunteerSessions(): Promise<VolunteerSession[]> {
  try {
    const db = await getDb();
    return db
      .collection<VolunteerSession>('volunteer_sessions')
      .find({ isActive: true })
      .toArray();
  } catch (error) {
    console.error('Error fetching active sessions:', error);
    throw new Error('Failed to fetch active volunteer sessions');
  }
}

// ── Recent check-in activity feed ─────────────────────────────────────────────

/** Returns the most recent check-in/checkout log entries, newest first */
export async function getRecentCheckInLogs(limit = 50): Promise<CheckInLog[]> {
  try {
    const db = await getDb();
    return db
      .collection<CheckInLog>('checkin_logs')
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  } catch (error) {
    console.error('Error fetching check-in logs:', error);
    throw new Error('Failed to fetch check-in logs');
  }
}