'use server';

import { getClient } from '@/lib/mongodb';
import {
  ParticipantPortalConfig,
  PortalAlert,
  ScheduleEvent,
  MealTimeConfig,
} from '@/types';

const DB_NAME = 'hackoverflow';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getDb() {
  const client = await getClient();
  return client.db(DB_NAME);
}

/**
 * Ensures the single participant_portal config document exists.
 * Uses upsert so it's safe to call on every read.
 */
async function ensurePortalDoc(): Promise<void> {
  const db = await getDb();
  await db
    .collection<ParticipantPortalConfig>('participant_portal')
    .updateOne(
      {},
      {
        $setOnInsert: {
          alerts:       [],
          schedule:     [],
          mealSchedule: [],
          updatedAt:    new Date(),
        },
      },
      { upsert: true }
    );
}

// ── Read ──────────────────────────────────────────────────────────────────────

/** Returns the full portal config document (alerts + schedule + meal windows) */
export async function getPortalConfig(): Promise<ParticipantPortalConfig> {
  try {
    await ensurePortalDoc();
    const db  = await getDb();
    const doc = await db
      .collection<ParticipantPortalConfig>('participant_portal')
      .findOne({});
    return doc!;
  } catch (error) {
    console.error('Error fetching portal config:', error);
    throw new Error('Failed to fetch portal config');
  }
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export async function createAlert(
  data: Omit<PortalAlert, 'alertId' | 'createdAt'>
): Promise<void> {
  try {
    await ensurePortalDoc();
    const db = await getDb();

    const alert: PortalAlert = {
      ...data,
      alertId:   crypto.randomUUID(),
      createdAt: new Date(),
    };

    await db
      .collection<ParticipantPortalConfig>('participant_portal')
      .updateOne(
        {},
        {
          $push: { alerts: alert } as any,
          $set:  { updatedAt: new Date() },
        }
      );
  } catch (error) {
    console.error('Error creating alert:', error);
    throw new Error('Failed to create alert');
  }
}

export async function updateAlert(
  alertId: string,
  data: Partial<Omit<PortalAlert, 'alertId' | 'createdAt'>>
): Promise<void> {
  try {
    const db = await getDb();

    const setFields: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(data)) {
      setFields[`alerts.$.${key}`] = value;
    }
    setFields['alerts.$.updatedAt'] = new Date();

    await db
      .collection<ParticipantPortalConfig>('participant_portal')
      .updateOne({ 'alerts.alertId': alertId }, { $set: setFields });
  } catch (error) {
    console.error('Error updating alert:', error);
    throw new Error('Failed to update alert');
  }
}

export async function toggleAlert(alertId: string, isActive: boolean): Promise<void> {
  try {
    const db = await getDb();
    await db
      .collection<ParticipantPortalConfig>('participant_portal')
      .updateOne(
        { 'alerts.alertId': alertId },
        {
          $set: {
            'alerts.$.isActive':  isActive,
            'alerts.$.updatedAt': new Date(),
            updatedAt:            new Date(),
          },
        }
      );
  } catch (error) {
    console.error('Error toggling alert:', error);
    throw new Error('Failed to toggle alert');
  }
}

export async function deleteAlert(alertId: string): Promise<void> {
  try {
    const db = await getDb();
    await db
      .collection<ParticipantPortalConfig>('participant_portal')
      .updateOne(
        {},
        {
          $pull: { alerts: { alertId } } as any,
          $set:  { updatedAt: new Date() },
        }
      );
  } catch (error) {
    console.error('Error deleting alert:', error);
    throw new Error('Failed to delete alert');
  }
}

// ── Schedule ──────────────────────────────────────────────────────────────────

export async function createScheduleEvent(
  data: Omit<ScheduleEvent, 'eventId' | 'createdAt'>
): Promise<void> {
  try {
    await ensurePortalDoc();
    const db = await getDb();

    const event: ScheduleEvent = {
      ...data,
      eventId:   crypto.randomUUID(),
      createdAt: new Date(),
    };

    await db
      .collection<ParticipantPortalConfig>('participant_portal')
      .updateOne(
        {},
        {
          $push: { schedule: event } as any,
          $set:  { updatedAt: new Date() },
        }
      );
  } catch (error) {
    console.error('Error creating schedule event:', error);
    throw new Error('Failed to create schedule event');
  }
}

export async function updateScheduleEvent(
  eventId: string,
  data: Partial<Omit<ScheduleEvent, 'eventId' | 'createdAt'>>
): Promise<void> {
  try {
    const db = await getDb();

    const setFields: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(data)) {
      setFields[`schedule.$.${key}`] = value;
    }
    setFields['schedule.$.updatedAt'] = new Date();

    await db
      .collection<ParticipantPortalConfig>('participant_portal')
      .updateOne({ 'schedule.eventId': eventId }, { $set: setFields });
  } catch (error) {
    console.error('Error updating schedule event:', error);
    throw new Error('Failed to update schedule event');
  }
}

export async function deleteScheduleEvent(eventId: string): Promise<void> {
  try {
    const db = await getDb();
    await db
      .collection<ParticipantPortalConfig>('participant_portal')
      .updateOne(
        {},
        {
          $pull: { schedule: { eventId } } as any,
          $set:  { updatedAt: new Date() },
        }
      );
  } catch (error) {
    console.error('Error deleting schedule event:', error);
    throw new Error('Failed to delete schedule event');
  }
}

// ── Meal schedule ─────────────────────────────────────────────────────────────

/**
 * Replaces the entire meal schedule config.
 * Admin sets all 6 meal windows in a single save operation.
 */
export async function updateMealSchedule(mealSchedule: MealTimeConfig[]): Promise<void> {
  try {
    await ensurePortalDoc();
    const db = await getDb();
    await db
      .collection<ParticipantPortalConfig>('participant_portal')
      .updateOne(
        {},
        { $set: { mealSchedule, updatedAt: new Date() } },
        { upsert: true }
      );
  } catch (error) {
    console.error('Error updating meal schedule:', error);
    throw new Error('Failed to update meal schedule');
  }
}