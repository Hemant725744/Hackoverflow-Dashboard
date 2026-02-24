'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  verifyDbPassword,
  exportDatabaseAsCSV,
  upsertParticipantsFromCSV,
  getDbStats,
  type DbStats,
  type ImportResult,
} from '@/actions/database';
import { backupToDrive, type BackupResult } from '@/actions/backup';

// ─────────────────────────────────────────────────────────────────────────────
// Types/Users/observer/Desktop/Projects/Hackoverflow-Dashboard/app/(dashboard)/dashboard/database/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
type View  = 'lock' | 'dashboard';
type Toast = { id: number; msg: string; type: 'ok' | 'err' | 'info' };

type BackupEntry = {
  time:     string;
  count:    number;
  driveUrl?: string;
  source:   'manual' | 'auto';
};

const BACKUP_LOG_KEY  = 'ho_db_backup_log';
const BACKUP_FREQ_KEY = 'ho_db_backup_freq';

const FREQ_OPTIONS = [
  { value: '5min',   label: 'Every 5 min'  },
  { value: '10min',  label: 'Every 10 min' },
  { value: '20min',  label: 'Every 20 min' },
  { value: 'manual', label: 'Manual only'  },
] as const;

type FreqValue = typeof FREQ_OPTIONS[number]['value'];

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
function downloadBlob(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function tsFilename() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/** Minimal CSV parser that handles double-quote escaping */
function parseCSV(text: string): string[][] {
  return text.trim().split('\n').map(line => {
    const cells: string[] = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        cells.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────
export default function DatabasePage() {
  const [view,   setView]   = useState<View>('lock');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const addToast = useCallback((msg: string, type: Toast['type'] = 'info') => {
    const id = ++idRef.current;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
  }, []);

  return (
    <>
      <style>{`
        .db-page { padding: 3rem; }
        @media (max-width: 900px) {
          .db-page { padding: 1.25rem; padding-top: calc(60px + 1.25rem); }
        }
        .db-card { border: 1px solid rgba(255,255,255,0.09); padding: 1.5rem; }
        .db-card-label {
          font-family: monospace; font-size: 0.63rem; letter-spacing: 0.14em;
          color: rgba(255,255,255,0.3); margin-bottom: 1.25rem;
        }
        .db-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        .db-grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 1rem; }
        @media (max-width: 900px) {
          .db-grid-2 { grid-template-columns: 1fr; }
          .db-grid-4 { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 500px) { .db-grid-4 { grid-template-columns: 1fr; } }
        .db-stat { border: 1px solid rgba(255,255,255,0.08); padding: 1.1rem 1.25rem; }
        .db-stat-label { font-family: monospace; font-size: 0.62rem; color: rgba(255,255,255,0.3); letter-spacing: 0.12em; margin-bottom: 0.4rem; }
        .db-stat-value { font-family: monospace; font-size: 1.5rem; font-weight: 900; letter-spacing: -0.03em; }
        .db-btn {
          font-family: monospace; font-size: 0.8rem; letter-spacing: 0.06em;
          padding: 0.8rem 1.1rem; cursor: pointer; border: none;
          display: inline-flex; align-items: center; gap: 0.5rem;
          transition: opacity .15s, background .15s; white-space: nowrap;
        }
        .db-btn:disabled { opacity: 0.38; cursor: not-allowed; }
        .db-btn-white  { background: #fff; color: #000; font-weight: 700; }
        .db-btn-white:not(:disabled):hover { opacity: 0.85; }
        .db-btn-ghost  { background: transparent; border: 1px solid rgba(255,255,255,0.18); color: #fff; }
        .db-btn-ghost:not(:disabled):hover { background: rgba(255,255,255,0.06); }
        .db-btn-danger { background: rgba(248,113,113,.13); border: 1px solid rgba(248,113,113,.4); color: #f87171; }
        .db-btn-danger:not(:disabled):hover { background: rgba(248,113,113,.22); }
        .db-btn-green  { background: rgba(74,222,128,.1); border: 1px solid rgba(74,222,128,.4); color: #4ade80; }
        .db-btn-green:not(:disabled):hover  { background: rgba(74,222,128,.2); }
        .db-btn-blue   { background: rgba(96,165,250,.1); border: 1px solid rgba(96,165,250,.4); color: #60a5fa; }
        .db-btn-blue:not(:disabled):hover   { background: rgba(96,165,250,.2); }
        .db-input {
          background: transparent; border: 1px solid rgba(255,255,255,0.14);
          color: #fff; font-family: monospace; font-size: 0.875rem;
          padding: 0.7rem 1rem; width: 100%; outline: none; transition: border-color .2s;
        }
        .db-input:focus { border-color: rgba(255,255,255,0.38); }
        .db-input::placeholder { color: rgba(255,255,255,0.18); }
        .db-select {
          background: #0a0a0a; border: 1px solid rgba(255,255,255,0.14);
          color: #fff; font-family: monospace; font-size: 0.8rem;
          padding: 0.7rem 1rem; outline: none; cursor: pointer; width: 100%;
          transition: border-color .2s;
        }
        .db-select:focus { border-color: rgba(255,255,255,0.38); }
        .db-drop {
          border: 2px dashed rgba(255,255,255,0.12); padding: 2.5rem 1rem;
          display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
          text-align: center; cursor: pointer; transition: border-color .2s, background .2s;
          min-height: 170px; justify-content: center;
        }
        .db-drop:hover, .db-drop.over { border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.02); }
        .db-drop.loaded { border-color: rgba(74,222,128,.45); background: rgba(74,222,128,.03); }
        .db-table-wrap { overflow-x: auto; max-height: 220px; overflow-y: auto; }
        .db-table { width: 100%; border-collapse: collapse; font-family: monospace; font-size: 0.72rem; }
        .db-table th {
          color: rgba(255,255,255,0.3); text-align: left; padding: 0.35rem 0.7rem;
          border-bottom: 1px solid rgba(255,255,255,0.07); white-space: nowrap; letter-spacing: 0.09em;
        }
        .db-table td {
          padding: 0.35rem 0.7rem; border-bottom: 1px solid rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.68); white-space: nowrap;
        }
        .db-table tr:last-child td { border-bottom: none; }
        .db-bar-track { background: rgba(255,255,255,0.07); height: 2px; }
        .db-bar-fill  { height: 2px; background: #fff; transition: width .25s; }
        .db-hr { border: none; border-top: 1px solid rgba(255,255,255,0.07); }
        .db-badge {
          font-family: monospace; font-size: 0.62rem; padding: 0.18rem 0.55rem;
          border: 1px solid; letter-spacing: 0.09em; white-space: nowrap;
        }
        .db-badge-green  { border-color: rgba(74,222,128,.4); color: #4ade80; background: rgba(74,222,128,.07); }
        .db-badge-yellow { border-color: rgba(250,204,21,.4); color: #facc15; background: rgba(250,204,21,.07); }
        .db-badge-red    { border-color: rgba(248,113,113,.4); color: #f87171; background: rgba(248,113,113,.07); }
        .db-badge-blue   { border-color: rgba(96,165,250,.4); color: #60a5fa; background: rgba(96,165,250,.07); }
        .db-toasts {
          position: fixed; bottom: 1.5rem; right: 1.5rem;
          display: flex; flex-direction: column; gap: 0.5rem; z-index: 9999;
        }
        .db-toast {
          font-family: monospace; font-size: 0.78rem; padding: 0.7rem 1rem;
          border: 1px solid; max-width: 340px; animation: db-in .18s ease;
        }
        @keyframes db-in { from { transform: translateX(16px); opacity: 0; } to { transform: none; opacity: 1; } }
        .db-toast-ok   { border-color: rgba(74,222,128,.4); background: rgba(74,222,128,.1);  color: #4ade80; }
        .db-toast-err  { border-color: rgba(248,113,113,.4); background: rgba(248,113,113,.1); color: #f87171; }
        .db-toast-info { border-color: rgba(255,255,255,.12); background: rgba(255,255,255,.04); color: rgba(255,255,255,.6); }
        .db-lock-center { min-height: 80vh; display: flex; align-items: center; justify-content: center; }
        @keyframes db-shake {
          0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)}
          60%{transform:translateX(8px)}   80%{transform:translateX(-4px)}
        }
        .db-shake { animation: db-shake .4s ease; }
        .drive-link {
          color: #60a5fa; font-family: monospace; font-size: 0.7rem;
          text-decoration: none; display: inline-flex; align-items: center; gap: 0.3rem;
        }
        .drive-link:hover { text-decoration: underline; }
        @keyframes db-spin { to { transform: rotate(360deg); } }
        .db-spin { animation: db-spin 1s linear infinite; display: inline-block; }
      `}</style>

      <div className="db-page">
        {view === 'lock'
          ? <LockScreen onUnlock={() => setView('dashboard')} addToast={addToast} />
          : <Dashboard addToast={addToast} onLock={() => setView('lock')} />}
      </div>

      <div className="db-toasts">
        {toasts.map(t => (
          <div key={t.id} className={`db-toast db-toast-${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lock screen
// ─────────────────────────────────────────────────────────────────────────────
function LockScreen({
  onUnlock,
  addToast,
}: {
  onUnlock: () => void;
  addToast: (m: string, t: Toast['type']) => void;
}) {
  const [pw,       setPw]       = useState('');
  const [loading,  setLoading]  = useState(false);
  const [shake,    setShake]    = useState(false);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!pw.trim() || loading) return;
    setLoading(true);
    const ok = await verifyDbPassword(pw);
    setLoading(false);
    if (ok) {
      addToast('Access granted', 'ok');
      onUnlock();
    } else {
      setAttempts(a => a + 1);
      setShake(true);
      setTimeout(() => setShake(false), 450);
      setPw('');
      addToast('Incorrect password', 'err');
      inputRef.current?.focus();
    }
  };

  return (
    <div className="db-lock-center">
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
            stroke="rgba(255,255,255,0.22)" strokeWidth="1.2"
            style={{ display: 'block', margin: '0 auto 1rem' }}>
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.04em', marginBottom: '0.35rem' }}>
            DATABASE ACCESS
          </h1>
          <p style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'rgba(255,255,255,0.32)' }}>
            This area is restricted. Enter the database password.
          </p>
        </div>

        <div className={`db-card ${shake ? 'db-shake' : ''}`}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <div className="db-card-label">PASSWORD</div>
            <input
              ref={inputRef} type="password" className="db-input"
              placeholder="Enter password" value={pw}
              onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              autoFocus
            />
          </div>
          {attempts > 0 && (
            <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#f87171' }}>
              ✗ {attempts} failed attempt{attempts > 1 ? 's' : ''}
            </div>
          )}
          <button className="db-btn db-btn-white" onClick={submit}
            disabled={!pw.trim() || loading}
            style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? '↻ VERIFYING…' : '→ UNLOCK DATABASE'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main dashboard
// ─────────────────────────────────────────────────────────────────────────────
function Dashboard({
  addToast,
  onLock,
}: {
  addToast: (m: string, t: Toast['type']) => void;
  onLock: () => void;
}) {
  const [stats,          setStats]          = useState<DbStats | null>(null);
  const [loadingExport,  setLoadingExport]  = useState(false);
  const [importFile,     setImportFile]     = useState<File | null>(null);
  const [importPreview,  setImportPreview]  = useState<string[][]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult,   setImportResult]   = useState<ImportResult | null>(null);
  const [loadingImport,  setLoadingImport]  = useState(false);
  const [dragOver,       setDragOver]       = useState(false);
  const [backupFreq,     setBackupFreq]     = useState<FreqValue>('10min');
  const [backupLog,      setBackupLog]      = useState<BackupEntry[]>([]);
  const [savingFreq,     setSavingFreq]     = useState(false);
  const [backingUp,      setBackingUp]      = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getDbStats().then(setStats).catch(() => {});
    try {
      const log  = localStorage.getItem(BACKUP_LOG_KEY);
      const freq = localStorage.getItem(BACKUP_FREQ_KEY);
      if (log)  setBackupLog(JSON.parse(log));
      if (freq) setBackupFreq(freq as FreqValue);
    } catch {}
  }, []);

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setLoadingExport(true);
    try {
      const { csv, count } = await exportDatabaseAsCSV();
      downloadBlob(csv, `hackoverflow-export-${tsFilename()}.csv`);
      addToast(`Exported ${count} participants`, 'ok');
    } catch (e: any) {
      addToast(`Export failed: ${e.message}`, 'err');
    } finally {
      setLoadingExport(false);
    }
  };

  // ── File load ───────────────────────────────────────────────────────────────
  const loadFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      addToast('Please select a .csv file', 'err'); return;
    }
    setImportFile(file);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = e => {
      const rows = parseCSV(e.target?.result as string);
      setImportPreview(rows.slice(0, 6));
    };
    reader.readAsText(file);
  };

  // ── Import ──────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!importFile) return;
    setLoadingImport(true);
    setImportProgress(5);
    setImportResult(null);
    try {
      const text = await importFile.text();
      const [headerRow, ...dataRows] = parseCSV(text);
      let pct = 5;
      const ticker = setInterval(() => {
        pct = Math.min(pct + 4, 88);
        setImportProgress(pct);
      }, 120);
      const result = await upsertParticipantsFromCSV(headerRow, dataRows);
      clearInterval(ticker);
      setImportProgress(100);
      setImportResult(result);
      const msg = `↑ ${result.upserted} inserted · ✎ ${result.modified} updated` +
        (result.errors.length ? ` · ⚠ ${result.errors.length} skipped` : '');
      addToast(msg, result.errors.length > 0 ? 'info' : 'ok');
      getDbStats().then(setStats).catch(() => {});
      setTimeout(() => setImportProgress(0), 1500);
    } catch (e: any) {
      addToast(`Import failed: ${e.message}`, 'err');
      setImportProgress(0);
    } finally {
      setLoadingImport(false);
    }
  };

  // ── Backup to Drive ──────────────────────────────────────────────────────────
  const handleBackupNow = async () => {
    setBackingUp(true);
    addToast('Uploading backup to Google Drive…', 'info');
    try {
      const result: BackupResult = await backupToDrive();

      // Also download locally as a safety copy
      const { csv } = await exportDatabaseAsCSV();
      downloadBlob(csv, result.filename);

      const entry: BackupEntry = {
        time:     result.time,
        count:    result.count,
        driveUrl: result.driveUrl,
        source:   'manual',
      };
      const updated = [entry, ...backupLog].slice(0, 12);
      setBackupLog(updated);
      localStorage.setItem(BACKUP_LOG_KEY, JSON.stringify(updated));

      addToast(`✓ Backed up ${result.count} records to Drive`, 'ok');
    } catch (e: any) {
      addToast(`Backup failed: ${e.message}`, 'err');
    } finally {
      setBackingUp(false);
    }
  };

  // ── Save frequency preference ────────────────────────────────────────────────
  const saveFreq = () => {
    setSavingFreq(true);
    localStorage.setItem(BACKUP_FREQ_KEY, backupFreq);
    setTimeout(() => setSavingFreq(false), 600);
    const label = FREQ_OPTIONS.find(o => o.value === backupFreq)?.label ?? backupFreq;
    addToast(`Backup frequency set to: ${label}`, 'ok');
  };

  // ── Clear import ─────────────────────────────────────────────────────────────
  const clearImport = () => {
    setImportFile(null);
    setImportPreview([]);
    setImportProgress(0);
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const lastBackup = backupLog[0] ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(2rem,5vw,3.5rem)', fontWeight: 900, letterSpacing: '-0.05em', marginBottom: '0.3rem' }}>
            DATABASE
          </h1>
          <p style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)' }}>
            Export · Import · Backup — MongoDB participants collection
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="db-badge db-badge-green">● MONGODB CONNECTED</span>
          <span className="db-badge db-badge-blue">⬡ DRIVE BACKUP ACTIVE</span>
          <button className="db-btn db-btn-ghost" onClick={onLock}
            style={{ padding: '0.5rem 0.9rem', fontSize: '0.75rem' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            LOCK
          </button>
        </div>
      </div>

      {/* ── Live stats ── */}
      <div className="db-grid-4">
        {[
          { label: 'TOTAL PARTICIPANTS', value: stats?.total,            color: '#fff' },
          { label: 'COLLEGE CHECK-IN',   value: stats?.collegeCheckedIn, color: '#4ade80' },
          { label: 'LAB CHECK-IN',       value: stats?.labCheckedIn,     color: '#4ade80' },
          { label: 'CHECKED OUT',        value: stats?.checkedOut,       color: '#facc15' },
        ].map(s => (
          <div key={s.label} className="db-stat">
            <div className="db-stat-label">{s.label}</div>
            <div className="db-stat-value" style={{ color: s.color }}>
              {s.value != null ? s.value : '—'}
            </div>
          </div>
        ))}
      </div>

      <div className="db-grid-2">

        {/* ── Export card ── */}
        <div className="db-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="db-card-label">EXPORT DATABASE</div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" style={{ flexShrink: 0, marginTop: 2 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <p style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'rgba(255,255,255,0.42)', lineHeight: 1.65, margin: 0 }}>
              Downloads the full <code style={{ color: '#fff' }}>participants</code> collection as a <code style={{ color: '#fff' }}>.csv</code>.
              All fields — check-in, lab, WiFi, checkout — are included and can be re-imported.
            </p>
          </div>
          <hr className="db-hr" />
          <button className="db-btn db-btn-white" onClick={handleExport} disabled={loadingExport}>
            {loadingExport ? '↻ EXPORTING…' : '↓ EXPORT AS CSV'}
            {stats?.total != null && !loadingExport &&
              <span style={{ fontWeight: 400, opacity: 0.5, marginLeft: 4 }}>({stats.total} rows)</span>}
          </button>
        </div>

        {/* ── Backup card ── */}
        <div className="db-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="db-card-label">GOOGLE DRIVE BACKUP</div>

          {/* Frequency selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div className="db-card-label" style={{ marginBottom: 0 }}>AUTO BACKUP FREQUENCY</div>
            <select className="db-select" value={backupFreq}
              onChange={e => setBackupFreq(e.target.value as FreqValue)}>
              {FREQ_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'rgba(255,255,255,0.22)', margin: 0, lineHeight: 1.5 }}>
              Minimum GitHub Actions cron interval is 5 min. Update <code style={{ color: 'rgba(255,255,255,0.5)' }}>backup.yml</code> after saving.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="db-btn db-btn-blue" onClick={handleBackupNow} disabled={backingUp}>
              {backingUp
                ? <><span className="db-spin">↻</span> BACKING UP…</>
                : '⬡ BACKUP NOW → DRIVE'}
            </button>
            <button className="db-btn db-btn-ghost" onClick={saveFreq} disabled={savingFreq}>
              {savingFreq ? '✓ SAVED' : '✓ SAVE FREQUENCY'}
            </button>
          </div>

          {/* Recent backups log */}
          {backupLog.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '0.9rem' }}>
              <div className="db-card-label" style={{ marginBottom: '0.6rem' }}>RECENT BACKUPS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {backupLog.slice(0, 5).map((b, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontFamily: 'monospace', fontSize: '0.72rem',
                    padding: '0.4rem 0.7rem',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    gap: '0.5rem', flexWrap: 'wrap',
                  }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {new Date(b.time).toLocaleString()}
                    </span>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <span style={{ color: '#4ade80' }}>{b.count} rec</span>
                      {b.driveUrl && (
                        <a href={b.driveUrl} target="_blank" rel="noopener noreferrer" className="drive-link">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                          DRIVE
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lastBackup && (
            <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'rgba(255,255,255,0.28)' }}>
              Last backup: {new Date(lastBackup.time).toLocaleString()}
              {lastBackup.driveUrl && (
                <> · <a href={lastBackup.driveUrl} target="_blank" rel="noopener noreferrer" className="drive-link">open in Drive ↗</a></>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Import card ── */}
      <div className="db-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div className="db-card-label" style={{ marginBottom: 0 }}>IMPORT / RESTORE DATABASE</div>
          <span className="db-badge db-badge-yellow">⚠ UPSERTS BY participantId</span>
        </div>

        {/* Drop zone */}
        <div
          className={`db-drop ${dragOver ? 'over' : ''} ${importFile ? 'loaded' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) loadFile(f); }}
        >
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />
          {importFile ? (
            <>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#4ade80', fontWeight: 700 }}>
                {importFile.name}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>
                {(importFile.size / 1024).toFixed(1)} KB · Click to change
              </div>
            </>
          ) : (
            <>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <div style={{ fontFamily: 'monospace', fontSize: '0.84rem', color: 'rgba(255,255,255,0.3)' }}>
                Drop a .csv file here or click to browse
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'rgba(255,255,255,0.18)' }}>
                Must use the same column headers as the export format
              </div>
            </>
          )}
        </div>

        {importPreview.length > 0 && (
          <div>
            <div className="db-card-label">PREVIEW — first {importPreview.length - 1} rows</div>
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>{importPreview[0].map((h, i) => <th key={i}>{h || '—'}</th>)}</tr>
                </thead>
                <tbody>
                  {importPreview.slice(1).map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td key={ci}>{cell || <span style={{ opacity: 0.3 }}>—</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {importProgress > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginBottom: '0.4rem' }}>
              <span>{importProgress < 100 ? 'UPSERTING TO MONGODB…' : 'COMPLETE'}</span>
              <span>{importProgress}%</span>
            </div>
            <div className="db-bar-track">
              <div className="db-bar-fill" style={{ width: `${importProgress}%`,
                background: importProgress === 100 ? '#4ade80' : '#fff' }} />
            </div>
          </div>
        )}

        {importResult && (
          <div style={{
            border: `1px solid ${importResult.errors.length ? 'rgba(250,204,21,.3)' : 'rgba(74,222,128,.3)'}`,
            background: importResult.errors.length ? 'rgba(250,204,21,.05)' : 'rgba(74,222,128,.05)',
            padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem',
          }}>
            <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700,
              color: importResult.errors.length ? '#facc15' : '#4ade80' }}>
              IMPORT COMPLETE
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              {[
                { label: 'INSERTED', value: importResult.upserted,      color: '#4ade80' },
                { label: 'UPDATED',  value: importResult.modified,       color: '#fff' },
                { label: 'SKIPPED',  value: importResult.errors.length,  color: '#f87171' },
              ].map(s => (
                <div key={s.label}>
                  <div className="db-card-label" style={{ marginBottom: '0.2rem' }}>{s.label}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 900, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            {importResult.errors.length > 0 && (
              <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#f87171', opacity: 0.75 }}>
                {importResult.errors.slice(0, 3).join(' · ')}
                {importResult.errors.length > 3 && ` · +${importResult.errors.length - 3} more`}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="db-btn db-btn-danger" onClick={handleImport}
            disabled={!importFile || loadingImport}>
            {loadingImport ? '↻ IMPORTING…' : '↑ IMPORT & UPSERT INTO MONGODB'}
          </button>
          {importFile && (
            <button className="db-btn db-btn-ghost" onClick={clearImport}>✕ CLEAR</button>
          )}
        </div>
      </div>

      {/* ── Notes ── */}
      <div className="db-card" style={{ borderColor: 'rgba(248,113,113,0.15)' }}>
        <div className="db-card-label" style={{ color: 'rgba(248,113,113,0.45)' }}>NOTES</div>
        <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'rgba(255,255,255,0.32)', lineHeight: 1.8 }}>
          • Backup Now uploads to Google Drive AND downloads a local copy as a safety net.<br />
          • Auto backup via GitHub Actions cron — update <code style={{ color: 'rgba(255,255,255,0.6)' }}>backup.yml</code> to match chosen frequency.<br />
          • Import uses <code style={{ color: 'rgba(255,255,255,0.6)' }}>bulkWrite</code> with <code style={{ color: 'rgba(255,255,255,0.6)' }}>upsert: true</code> — existing records are updated, nothing is deleted.<br />
          • <code style={{ color: 'rgba(255,255,255,0.6)' }}>createdAt</code> is never overwritten on existing documents (<code style={{ color: 'rgba(255,255,255,0.6)' }}>$setOnInsert</code>).<br />
          • Backup log is stored in <code style={{ color: 'rgba(255,255,255,0.6)' }}>localStorage</code> — device-specific.
        </div>
      </div>

    </div>
  );
}