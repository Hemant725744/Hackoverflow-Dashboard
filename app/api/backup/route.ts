import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';
import clientPromise from '@/lib/mongodb';
import { DBParticipant } from '@/types';
import { ObjectId } from 'mongodb';
import { logBackupResult } from '@/actions/backup-log';

const DB_NAME         = 'hackoverflow';
const COLLECTION_NAME = 'participants';
const CRON_SECRET     = process.env.CRON_SECRET;

export const runtime     = 'nodejs';
export const maxDuration = 60;

type ParticipantDocument = Omit<DBParticipant, '_id'> & { _id?: ObjectId };

const CSV_HEADERS = [
  'participantId', 'name', 'email', 'phone', 'role',
  'teamName', 'institute', 'labAllotted',
  'wifiSSID', 'wifiPassword',
  'collegeCheckIn',   'collegeCheckInTime',
  'labCheckIn',       'labCheckInTime',
  'collegeCheckOut',  'collegeCheckOutTime',
  'tempLabCheckOut',  'tempLabCheckOutTime',
  'createdAt', 'updatedAt',
];

const escapeCell = (v: unknown): string => {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
};

async function buildCSV(): Promise<{ csv: string; count: number }> {
  const client = await clientPromise;
  const participants = await client
    .db(DB_NAME)
    .collection<ParticipantDocument>(COLLECTION_NAME)
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  const rows = participants.map(p =>
    [
      p.participantId, p.name, p.email, p.phone, p.role,
      p.teamName, p.institute, p.labAllotted,
      p.wifiCredentials?.ssid, p.wifiCredentials?.password,
      p.collegeCheckIn?.status  ?? false,
      p.collegeCheckIn?.time    ? new Date(p.collegeCheckIn.time).toISOString()   : '',
      p.labCheckIn?.status      ?? false,
      p.labCheckIn?.time        ? new Date(p.labCheckIn.time).toISOString()       : '',
      p.collegeCheckOut?.status ?? false,
      p.collegeCheckOut?.time   ? new Date(p.collegeCheckOut.time).toISOString()  : '',
      p.tempLabCheckOut?.status ?? false,
      p.tempLabCheckOut?.time   ? new Date(p.tempLabCheckOut.time).toISOString()  : '',
      p.createdAt ? new Date(p.createdAt).toISOString() : '',
      p.updatedAt ? new Date(p.updatedAt).toISOString() : '',
    ]
      .map(escapeCell)
      .join(',')
  );

  return { csv: [CSV_HEADERS.join(','), ...rows].join('\n'), count: participants.length };
}

async function uploadToDrive(csv: string, filename: string): Promise<string> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  const response = await drive.files.create({
    requestBody: {
      name:    filename,
      mimeType: 'text/csv',
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!],
    },
    media: { mimeType: 'text/csv', body: Readable.from([csv]) },
    fields: 'id, webViewLink',
  });

  return response.data.webViewLink ?? `https://drive.google.com/file/d/${response.data.id}/view`;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('x-cron-secret');
  if (!CRON_SECRET || authHeader !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename  = `hackoverflow-backup-${timestamp}.csv`;

    const { csv, count } = await buildCSV();
    const fileLink        = await uploadToDrive(csv, filename);
    const duration        = Date.now() - start;

    await logBackupResult({
      success:  true,
      count,
      filename,
      driveUrl: fileLink,
      duration,
      time:     new Date(),
      source:   'cron',
    });

    console.info(`[Backup] ✓ ${count} records → ${fileLink} (${duration}ms)`);

    return NextResponse.json({
      success:  true,
      timestamp,
      records:  count,
      file:     filename,
      link:     fileLink,
      duration,
    });

  } catch (error) {
    const duration = Date.now() - start;
    const message  = error instanceof Error ? error.message : 'Backup failed';

    await logBackupResult({
      success:  false,
      error:    message,
      duration,
      time:     new Date(),
      source:   'cron',
    });

    console.error(`[Backup] ✗ ${message} (${duration}ms)`);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}