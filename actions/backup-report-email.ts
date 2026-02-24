'use server';

import nodemailer from 'nodemailer';
import type { BackupLogEntry } from '@/actions/backup-log';

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST  ?? 'smtp.gmail.com',
    port:   Number(process.env.EMAIL_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(d: Date): string {
  return new Date(d).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }) + ' IST';
}

export async function sendHourlyBackupReport(
  logs:      BackupLogEntry[],
  recipient: string,
): Promise<void> {
  const transporter = createTransport();

  const succeeded = logs.filter(l => l.success);
  const failed    = logs.filter(l => !l.success);
  const statusEmoji = failed.length === 0 ? '✅' : failed.length === logs.length ? '❌' : '⚠️';

  const rows = logs.map(l => {
    const bg    = l.success ? '#0d1f0d' : '#1f0d0d';
    const badge = l.success
      ? '<span style="color:#4ade80;font-weight:700">✓ SUCCESS</span>'
      : '<span style="color:#f87171;font-weight:700">✗ FAILED</span>';
    const driveCell = l.driveUrl
      ? `<a href="${l.driveUrl}" style="color:#60a5fa;font-family:monospace;font-size:12px">Open ↗</a>`
      : '—';
    return `
      <tr style="background:${bg};border-bottom:1px solid #1a1a1a;">
        <td style="padding:10px 14px;font-family:monospace;font-size:12px;color:#aaa;white-space:nowrap">${formatTime(l.time)}</td>
        <td style="padding:10px 14px">${badge}</td>
        <td style="padding:10px 14px;font-family:monospace;font-size:12px;color:#ccc">${l.count ?? '—'}</td>
        <td style="padding:10px 14px">${driveCell}</td>
        <td style="padding:10px 14px;font-family:monospace;font-size:12px;color:#666">${formatDuration(l.duration)}</td>
        <td style="padding:10px 14px;font-family:monospace;font-size:12px;color:#f87171;max-width:260px;word-break:break-word">${l.error ?? ''}</td>
      </tr>`;
  }).join('');

  const statCards = [
    { label: 'TOTAL BACKUPS', value: logs.length,       color: '#fff'    },
    { label: 'SUCCEEDED',     value: succeeded.length,  color: '#4ade80' },
    { label: 'FAILED',        value: failed.length,     color: failed.length ? '#f87171' : '#666' },
  ].map(s => `
    <div style="border:1px solid rgba(255,255,255,0.08);padding:16px 20px;flex:1;min-width:120px">
      <div style="font-family:monospace;font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:0.12em;margin-bottom:6px">${s.label}</div>
      <div style="font-family:monospace;font-size:26px;font-weight:900;color:${s.color}">${s.value}</div>
    </div>`).join('');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;color:#fff;font-family:system-ui,sans-serif;">
  <div style="max-width:760px;margin:32px auto;padding:0 16px;">
    <div style="border:1px solid rgba(255,255,255,0.09);padding:32px;">
      <div style="font-family:monospace;font-size:10px;letter-spacing:0.14em;color:rgba(255,255,255,0.3);margin-bottom:8px">HACKOVERFLOW // DATABASE BACKUP REPORT</div>
      <h1 style="margin:0 0 4px;font-size:28px;font-weight:900;letter-spacing:-0.04em">${statusEmoji} Hourly Backup Summary</h1>
      <p style="margin:0;font-family:monospace;font-size:13px;color:rgba(255,255,255,0.4)">Period ending ${formatTime(new Date())}</p>
      <div style="display:flex;gap:12px;margin-top:28px;flex-wrap:wrap;">${statCards}</div>
    </div>

    ${logs.length === 0
      ? `<div style="border:1px solid rgba(250,204,21,0.3);background:rgba(250,204,21,0.05);padding:24px;margin-top:16px;font-family:monospace;font-size:13px;color:#facc15;">
           ⚠ NO BACKUPS WERE RECORDED IN THIS HOUR — check GitHub Actions and cron configuration.
         </div>`
      : `<div style="margin-top:16px;overflow-x:auto;">
           <table style="width:100%;border-collapse:collapse;font-size:13px;">
             <thead>
               <tr style="border-bottom:1px solid rgba(255,255,255,0.1)">
                 ${['TIME','STATUS','RECORDS','DRIVE','DURATION','ERROR']
                   .map(h => `<th style="padding:10px 14px;text-align:left;font-family:monospace;font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:0.1em;white-space:nowrap">${h}</th>`)
                   .join('')}
               </tr>
             </thead>
             <tbody>${rows}</tbody>
           </table>
         </div>`}

    <div style="margin-top:16px;border:1px solid rgba(255,255,255,0.06);padding:20px;font-family:monospace;font-size:11px;color:rgba(255,255,255,0.25);line-height:1.8">
      Automated report · Hackoverflow Dashboard · Logs stored in MongoDB backup_logs collection<br/>
      Times shown in IST (Asia/Kolkata)
    </div>
  </div>
</body>
</html>`;

  const subject = logs.length === 0
    ? `[Hackoverflow] ⚠ No backups recorded in the last hour`
    : `[Hackoverflow] ${statusEmoji} ${succeeded.length}/${logs.length} backups succeeded — ${formatTime(new Date())}`;

  await transporter.sendMail({
    from:    `"Hackoverflow Backup" <${process.env.EMAIL_USER}>`,
    to:      recipient,
    subject,
    html,
  });
}