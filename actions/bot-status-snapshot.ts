'use server';

import clientPromise from '@/lib/mongodb';
import type { BotStatusSnapshot } from '@/actions/email-report';

const DB_NAME     = process.env.MONGODB_DB || 'hackoverflow';
const STATUS_COLL = 'bot_status';
const STALE_MS    = 2 * 60 * 1000; // 2 minutes

export async function getBotStatusSnapshot(): Promise<BotStatusSnapshot> {
  const empty: BotStatusSnapshot = {
    online: false, lastSeen: null, tag: null,
    ping: null, guildCount: null, startedAt: null,
  };

  try {
    const client = await clientPromise;
    const coll   = client.db(DB_NAME).collection(STATUS_COLL);

    // Strategy 1: look for the specific 'heartbeat' doc
    let doc = await coll.findOne({ _id: 'heartbeat' as never });

    // Strategy 2: look for any status doc with common field names
    if (!doc) {
      doc = await coll.findOne(
        { $or: [{ tag: { $exists: true } }, { online: { $exists: true } }, { lastSeen: { $exists: true } }] },
        { sort: { _id: -1 } }
      );
    }

    // Strategy 3: just grab the most recent document in the collection
    if (!doc) {
      doc = await coll.findOne({}, { sort: { _id: -1 } });
    }

    if (!doc) return empty;

    // Resolve lastSeen from common field names the bot might write
    const rawSeen =
      doc.lastSeen   ??
      doc.updatedAt  ??
      doc.timestamp  ??
      doc.heartbeat  ??
      doc.checkedAt  ??
      null;

    const lastSeen: string | null =
      rawSeen instanceof Date     ? rawSeen.toISOString() :
      typeof rawSeen === 'string' ? rawSeen : null;

    const staleMs  = lastSeen ? Date.now() - new Date(lastSeen).getTime() : undefined;

    // Respect an explicit `online` boolean if the bot writes one,
    // otherwise derive it from the heartbeat freshness.
    const isOnline =
      typeof doc.online === 'boolean'
        ? doc.online && typeof staleMs === 'number' && staleMs < STALE_MS
        : typeof staleMs === 'number' && staleMs < STALE_MS;

    const rawStarted = doc.startedAt ?? doc.startTime ?? null;
    const startedAt: string | null =
      rawStarted instanceof Date     ? rawStarted.toISOString() :
      typeof rawStarted === 'string' ? rawStarted : null;

    return {
      online:     isOnline,
      lastSeen,
      tag:        typeof doc.tag        === 'string' ? doc.tag        : null,
      ping:       typeof doc.ping       === 'number' ? doc.ping       : null,
      guildCount: typeof doc.guildCount === 'number' ? doc.guildCount : null,
      startedAt,
      staleMs,
    };
  } catch (err) {
    console.error('[getBotStatusSnapshot] failed:', err);
    return empty;
  }
}