import { NextRequest, NextResponse } from 'next/server';
import { getRecentBackupLogs } from '@/actions/backup-log';
import { sendHourlyBackupReport } from '@/actions/backup-report-email';

export const runtime     = 'nodejs';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const recipient = process.env.EMAIL_REPORT_TO ?? process.env.EMAIL_USER;
  if (!recipient) {
    return NextResponse.json(
      { error: 'EMAIL_REPORT_TO or EMAIL_USER env var not set' },
      { status: 500 },
    );
  }

  try {
    const logs = await getRecentBackupLogs(1);
    await sendHourlyBackupReport(logs, recipient);

    console.log(`[backup-report] Sent report for ${logs.length} entries to ${recipient}`);

    return NextResponse.json({ success: true, sent_to: recipient, entries: logs.length });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[backup-report] Failed:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}