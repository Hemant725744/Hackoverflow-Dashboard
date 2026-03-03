'use server';

import nodemailer from 'nodemailer';
import type { BackupLogEntry } from '@/actions/backup-log';

export interface BotConfigSnapshot {
  version:    number;
  updatedAt:  string | null;
  updatedBy:  string | null;
  healthy:    boolean;
  fieldCount?: number;
}

export interface BotStatusSnapshot {
  online:     boolean;
  lastSeen:   string | null;
  tag:        string | null;
  ping:       number | null;
  guildCount: number | null;
  startedAt:  string | null;
  staleMs?:   number;
}

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST  ?? 'smtp.gmail.com',
    port:   Number(process.env.EMAIL_PORT ?? 587),
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(d: Date | string): string {
  return new Date(d).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }) + ' IST';
}

function relTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5)    return 'just now';
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function pingColor(ms: number | null): string {
  if (ms === null) return '#999';
  if (ms < 100)   return '#4ade80';
  if (ms < 300)   return '#f6ad55';
  return '#f87171';
}

export async function sendHourlyBackupReport(
  logs:       BackupLogEntry[],
  recipient:  string,
  botConfig?: BotConfigSnapshot,
  botStatus?: BotStatusSnapshot,
): Promise<void> {
  const transporter = createTransport();

  const succeeded   = logs.filter(l => l.success);
  const failed      = logs.filter(l => !l.success);
  const allPassed   = failed.length === 0 && logs.length > 0;
  const allFailed   = failed.length === logs.length && logs.length > 0;
  const statusLabel = logs.length === 0 ? 'NO ACTIVITY' : allPassed ? 'ALL PASSED' : allFailed ? 'ALL FAILED' : 'PARTIAL';
  const accentRgb   = logs.length === 0 ? '246,173,85' : allPassed ? '74,222,128' : allFailed ? '248,113,113' : '246,173,85';
  const accentHex   = logs.length === 0 ? '#f6ad55'    : allPassed ? '#4ade80'    : allFailed ? '#f87171'     : '#f6ad55';

  // ── Log rows ────────────────────────────────────────────────────────────────
  const rows = logs.map((l, i) => {
    const rowBg = i % 2 === 0 ? 'rgba(255,255,255,0.018)' : 'transparent';
    const badge = l.success
      ? `<span style="display:inline-block;padding:2px 8px;background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.3);color:#4ade80;font-family:'Courier New',monospace;font-size:10px;font-weight:700;letter-spacing:0.1em;">✓ OK</span>`
      : `<span style="display:inline-block;padding:2px 8px;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);color:#f87171;font-family:'Courier New',monospace;font-size:10px;font-weight:700;letter-spacing:0.1em;">✗ FAIL</span>`;
    const driveCell = l.driveUrl
      ? `<a href="${l.driveUrl}" style="display:inline-block;padding:2px 8px;color:#60a5fa;font-family:'Courier New',monospace;font-size:10px;text-decoration:none;border:1px solid rgba(96,165,250,0.25);background:rgba(96,165,250,0.06);">↗ Open</a>`
      : `<span style="color:rgba(255,255,255,0.15);">—</span>`;
    return `
      <tr style="background:${rowBg};">
        <td style="padding:10px 16px;font-family:'Courier New',monospace;font-size:11px;color:rgba(255,255,255,0.4);white-space:nowrap;border-bottom:1px solid rgba(255,255,255,0.04);">${formatTime(l.time)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">${badge}</td>
        <td style="padding:10px 16px;font-family:'Courier New',monospace;font-size:13px;font-weight:700;color:#fff;border-bottom:1px solid rgba(255,255,255,0.04);">${l.count ?? '—'}</td>
        <td style="padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.04);">${driveCell}</td>
        <td style="padding:10px 16px;font-family:'Courier New',monospace;font-size:11px;color:rgba(255,255,255,0.3);border-bottom:1px solid rgba(255,255,255,0.04);">${formatDuration(l.duration)}</td>
        <td style="padding:10px 16px;font-family:'Courier New',monospace;font-size:11px;color:#f87171;max-width:180px;word-break:break-word;border-bottom:1px solid rgba(255,255,255,0.04);">${l.error ?? ''}</td>
      </tr>`;
  }).join('');

  // ── Stat cards ──────────────────────────────────────────────────────────────
  const statCards = [
    { label: 'TOTAL',   value: logs.length,      sub: 'backups',    color: '#fff'      },
    { label: 'PASSED',  value: succeeded.length, sub: 'successful', color: '#4ade80'   },
    { label: 'FAILED',  value: failed.length,    sub: 'errors',     color: failed.length ? '#f87171' : 'rgba(255,255,255,0.2)' },
  ].map(s => `
    <td style="padding:4px;width:33%;">
      <div style="padding:20px 16px;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.07);text-align:center;">
        <div style="font-family:'Courier New',monospace;font-size:9px;color:rgba(255,255,255,0.22);letter-spacing:0.16em;margin-bottom:8px;">${s.label}</div>
        <div style="font-family:'Courier New',monospace;font-size:30px;font-weight:900;color:${s.color};line-height:1;">${s.value}</div>
        <div style="font-family:'Courier New',monospace;font-size:9px;color:rgba(255,255,255,0.18);margin-top:5px;">${s.sub}</div>
      </div>
    </td>`).join('');

  // ── Bot Status ──────────────────────────────────────────────────────────────
  let botStatusHtml = '';
  if (botStatus) {
    const online     = botStatus.online;
    const dotColor   = online ? '#4ade80' : '#f87171';
    const statusText = online ? 'ONLINE' : 'OFFLINE';
    const border     = online ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)';

    const pills = [
      botStatus.tag        ? `<td style="padding:4px;"><div style="padding:12px 16px;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.07);text-align:center;"><div style="font-family:'Courier New',monospace;font-size:9px;color:rgba(255,255,255,0.22);letter-spacing:0.12em;margin-bottom:4px;">BOT TAG</div><div style="font-family:'Courier New',monospace;font-size:13px;font-weight:700;color:#fff;">${botStatus.tag}</div></div></td>` : '',
      botStatus.ping !== null ? `<td style="padding:4px;"><div style="padding:12px 16px;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.07);text-align:center;"><div style="font-family:'Courier New',monospace;font-size:9px;color:rgba(255,255,255,0.22);letter-spacing:0.12em;margin-bottom:4px;">PING</div><div style="font-family:'Courier New',monospace;font-size:16px;font-weight:700;color:${pingColor(botStatus.ping)};">${botStatus.ping}ms</div></div></td>` : '',
      botStatus.guildCount !== null ? `<td style="padding:4px;"><div style="padding:12px 16px;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.07);text-align:center;"><div style="font-family:'Courier New',monospace;font-size:9px;color:rgba(255,255,255,0.22);letter-spacing:0.12em;margin-bottom:4px;">SERVERS</div><div style="font-family:'Courier New',monospace;font-size:16px;font-weight:700;color:#fff;">${botStatus.guildCount}</div></div></td>` : '',
    ].filter(Boolean).join('');

    const timeNote = !online && botStatus.lastSeen
      ? `<div style="font-family:'Courier New',monospace;font-size:11px;color:rgba(248,113,113,0.65);margin-top:6px;">Last seen ${formatTime(botStatus.lastSeen)} (${relTime(botStatus.lastSeen)})</div>`
      : online && botStatus.startedAt
      ? `<div style="font-family:'Courier New',monospace;font-size:11px;color:rgba(255,255,255,0.22);margin-top:5px;">Up since ${formatTime(botStatus.startedAt)}</div>`
      : '';

    botStatusHtml = `
      <div style="border:1px solid ${border};padding:20px 24px;background:rgba(255,255,255,0.015);margin-bottom:2px;">
        <div style="font-family:'Courier New',monospace;font-size:9px;letter-spacing:0.16em;color:rgba(255,255,255,0.18);margin-bottom:12px;">BOT RUNTIME</div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${dotColor};flex-shrink:0;"></span>
          <span style="font-family:'Courier New',monospace;font-size:20px;font-weight:900;color:${dotColor};letter-spacing:0.04em;">${statusText}</span>
          ${botStatus.staleMs != null && !online
            ? `<span style="font-family:'Courier New',monospace;font-size:10px;color:rgba(255,255,255,0.2);">stale ${formatDuration(botStatus.staleMs)}</span>`
            : ''}
        </div>
        ${timeNote}
        ${pills ? `<table style="border-collapse:collapse;margin-top:12px;" cellspacing="0" cellpadding="0"><tbody><tr>${pills}</tr></tbody></table>` : ''}
      </div>`;
  }

  // ── Bot Config ──────────────────────────────────────────────────────────────
  let botConfigHtml = '';
  if (botConfig) {
    const cc  = botConfig.healthy ? '#4ade80' : '#f87171';
    const cb  = botConfig.healthy ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)';
    const by  = botConfig.updatedBy && botConfig.updatedBy !== 'unknown'
      ? ` <span style="color:rgba(255,255,255,0.2);">by ${botConfig.updatedBy}</span>`
      : '';

    botConfigHtml = `
      <div style="border:1px solid ${cb};padding:20px 24px;background:rgba(255,255,255,0.015);margin-bottom:2px;">
        <div style="font-family:'Courier New',monospace;font-size:9px;letter-spacing:0.16em;color:rgba(255,255,255,0.18);margin-bottom:12px;">BOT CONFIG</div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span style="font-family:'Courier New',monospace;font-size:22px;font-weight:900;color:#fff;">v${botConfig.version}</span>
          <span style="font-family:'Courier New',monospace;font-size:10px;color:${cc};border:1px solid ${cc};padding:3px 10px;letter-spacing:0.1em;opacity:0.9;">● ${botConfig.healthy ? 'HEALTHY' : 'UNREACHABLE'}</span>
        </div>
        ${botConfig.updatedAt
          ? `<div style="font-family:'Courier New',monospace;font-size:11px;color:rgba(255,255,255,0.22);margin-top:6px;">Saved ${formatTime(botConfig.updatedAt)}${by}</div>`
          : ''}
        ${botConfig.fieldCount != null
          ? `<div style="font-family:'Courier New',monospace;font-size:10px;color:rgba(255,255,255,0.16);margin-top:3px;">${botConfig.fieldCount} config fields</div>`
          : ''}
      </div>`;
  }

  // ── Full HTML ───────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <style>
    * { box-sizing:border-box; }
    body { margin:0; padding:0; background:#080808; color:#fff; }
    @media only screen and (max-width:600px) {
      .wrap    { padding:10px !important; }
      .hdr     { padding:20px 16px !important; }
      .statrow td { display:block !important; width:100% !important; }
      .scroll  { overflow-x:auto !important; }
      .ltable  { min-width:500px !important; }
    }
  </style>
</head>
<body>
<div class="wrap" style="max-width:680px;margin:0 auto;padding:20px 14px;font-family:'Courier New',Courier,monospace;background:#080808;">

  <!-- accent top bar -->
  <div style="height:2px;background:linear-gradient(90deg,${accentHex} 0%,rgba(${accentRgb},0.2) 50%,transparent 100%);margin-bottom:2px;"></div>

  <!-- HEADER -->
  <div class="hdr" style="padding:28px 28px 24px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.015);margin-bottom:2px;">
    <table style="width:100%;border-collapse:collapse;" cellspacing="0" cellpadding="0">
      <tbody><tr>
        <td style="vertical-align:top;">
          <div style="font-size:9px;letter-spacing:0.18em;color:rgba(255,255,255,0.2);margin-bottom:10px;text-transform:uppercase;">Hackoverflow · Hourly Report</div>
          <h1 style="margin:0 0 5px;font-size:26px;font-weight:900;letter-spacing:-0.02em;color:#fff;line-height:1.1;">Backup &amp; Bot Health</h1>
          <div style="font-size:11px;color:rgba(255,255,255,0.28);margin-top:3px;">Ends ${formatTime(new Date())}</div>
        </td>
        <td style="text-align:right;vertical-align:top;">
          <span style="display:inline-block;padding:5px 14px;border:1px solid rgba(${accentRgb},0.35);background:rgba(${accentRgb},0.08);font-size:10px;font-weight:700;letter-spacing:0.12em;color:${accentHex};">${statusLabel}</span>
        </td>
      </tr></tbody>
    </table>

    <!-- Stat cards -->
    <table class="statrow" style="width:100%;border-collapse:collapse;margin-top:20px;" cellspacing="0" cellpadding="0">
      <tbody><tr>${statCards}</tr></tbody>
    </table>
  </div>

  <!-- BOT STATUS -->
  ${botStatusHtml}

  <!-- BOT CONFIG -->
  ${botConfigHtml}

  <!-- LOG HEADER -->
  <div style="padding:12px 14px 8px;margin-top:4px;">
    <span style="font-size:9px;letter-spacing:0.18em;color:rgba(255,255,255,0.2);">DATABASE BACKUP LOG</span>
  </div>

  <!-- LOG TABLE -->
  ${logs.length === 0
    ? `<div style="border:1px solid rgba(246,173,85,0.2);background:rgba(246,173,85,0.03);padding:24px 20px;">
         <div style="font-size:12px;font-weight:700;color:#f6ad55;letter-spacing:0.08em;margin-bottom:5px;">NO BACKUPS RECORDED THIS HOUR</div>
         <div style="font-size:11px;color:rgba(255,255,255,0.22);">Check GitHub Actions and cron configuration.</div>
       </div>`
    : `<div class="scroll" style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
         <table class="ltable" style="width:100%;border-collapse:collapse;border:1px solid rgba(255,255,255,0.07);" cellspacing="0" cellpadding="0">
           <thead>
             <tr style="background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.08);">
               ${['TIME','STATUS','RECORDS','DRIVE','DURATION','ERROR'].map(h =>
                 `<th style="padding:9px 16px;text-align:left;font-size:9px;color:rgba(255,255,255,0.22);letter-spacing:0.14em;white-space:nowrap;font-weight:600;">${h}</th>`
               ).join('')}
             </tr>
           </thead>
           <tbody>${rows}</tbody>
         </table>
       </div>`
  }

  <!-- FOOTER -->
  <div style="margin-top:2px;padding:16px 18px;border:1px solid rgba(255,255,255,0.05);display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:10px;color:rgba(255,255,255,0.18);line-height:1.8;">
      Automated · Hackoverflow Dashboard<br>
      <span style="color:rgba(255,255,255,0.28);">backup_logs</span> collection · MongoDB
    </div>
    <div style="font-size:9px;color:rgba(255,255,255,0.14);letter-spacing:0.1em;text-align:right;">
      IST<br>Asia/Kolkata
    </div>
  </div>

  <!-- bottom accent -->
  <div style="height:1px;background:linear-gradient(90deg,rgba(${accentRgb},0.3) 0%,transparent 60%);margin-top:2px;"></div>

</div>
</body>
</html>`;

  const botOnline = botStatus ? (botStatus.online ? ' · Bot ✓' : ' · Bot ✗') : '';
  const cfgLabel  = botConfig ? ` · Config v${botConfig.version}` : '';
  const subject   = logs.length === 0
    ? `[Hackoverflow] No backups recorded${cfgLabel}${botOnline} — ${formatTime(new Date())}`
    : `[Hackoverflow] ${succeeded.length}/${logs.length} OK${cfgLabel}${botOnline} — ${formatTime(new Date())}`;

  await transporter.sendMail({
    from:    `"Hackoverflow Backup" <${process.env.EMAIL_USER}>`,
    to:      recipient,
    subject,
    html,
  });
}