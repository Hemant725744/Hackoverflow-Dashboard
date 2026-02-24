'use server';

import clientPromise from '@/lib/mongodb';

const DB_NAME         = 'hackoverflow';
const COLLECTION_NAME = 'backup_logs';

export interface BackupLogEntry {
  _id?:      unknown;
  success:   boolean;
  count?:    number;
  filename?: string;
  driveUrl?: string;
  error?:    string;
  duration:  number; // ms
  time:      Date;
  source:    'cron' | 'manual';
}

async function getCollection() {
  const client = await clientPromise;
  return client.db(DB_NAME).collection<BackupLogEntry>(COLLECTION_NAME);
}

export async function logBackupResult(entry: Omit<BackupLogEntry, '_id'>): Promise<void> {
  try {
    const col = await getCollection();
    await col.insertOne(entry);
    // Keep only last 500 logs to avoid unbounded growth
    const count = await col.countDocuments();
    if (count > 500) {
      const oldest = await col.find().sort({ time: 1 }).limit(count - 500).toArray();
      const ids = oldest.map(d => d._id);
      await col.deleteMany({ _id: { $in: ids } });
    }
  } catch (err) {
    // Never let logging errors crash the backup
    console.error('[backup-log] Failed to log:', err);
  }
}

/**
 * Returns all backup log entries within the last `hours` hours.
 */
export async function getRecentBackupLogs(hours = 1): Promise<BackupLogEntry[]> {
  const col  = await getCollection();
  const from = new Date(Date.now() - hours * 60 * 60 * 1000);
  return col
    .find({ time: { $gte: from } })
    .sort({ time: -1 })
    .toArray();
}