'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import { DBParticipant } from '@/types';
import {
  getParticipants,
  createParticipants,
  updateParticipant,
  deleteParticipant,
} from '@/actions/participants';

// ─── Bulk-edit field options ──────────────────────────────────────────────────
const BULK_EDIT_FIELDS = [
  { key: 'labAllotted',        label: 'Lab Allotted' },
  { key: 'teamName',           label: 'Team Name' },
  { key: 'teamId',             label: 'Team ID' },
  { key: 'role',               label: 'Role' },
  { key: 'institute',          label: 'Institute' },
  { key: 'state',              label: 'State' },
  { key: 'projectName',        label: 'Project Name' },
  { key: 'projectDescription', label: 'Project Description' },
  { key: 'wifiSsid',           label: 'WiFi SSID' },
  { key: 'wifiPassword',       label: 'WiFi Password' },
] as const;
type BulkField = typeof BULK_EDIT_FIELDS[number]['key'];

// ─── Shared style tokens ──────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  backgroundColor: 'transparent',
  border: '1px solid rgba(255,255,255,0.2)',
  color: '#fff', fontFamily: 'monospace', fontSize: '0.875rem',
  padding: '0.6rem 0.75rem', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontFamily: 'monospace',
  color: 'rgba(255,255,255,0.5)', marginBottom: '0.5rem', letterSpacing: '0.05em',
};
const btnBase: React.CSSProperties = {
  padding: '0.5rem 1rem', backgroundColor: 'transparent',
  border: '1px solid rgba(255,255,255,0.2)', color: '#fff',
  fontFamily: 'monospace', fontSize: '0.75rem', cursor: 'pointer',
  transition: 'all 0.3s', display: 'flex', alignItems: 'center',
  gap: '0.5rem', letterSpacing: '0.05em',
};

// ─── Small reusable field ─────────────────────────────────────────────────────
function EF({ label, value, onChange, textarea }: {
  label: string; value: string; onChange: (v: string) => void; textarea?: boolean;
}) {
  const sh = { ...inputStyle };
  const handlers = {
    onFocus: (e: any) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'),
    onBlur:  (e: any) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'),
  };
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {textarea
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} style={{ ...sh, resize: 'vertical' }} {...handlers} />
        : <input type="text" value={value} onChange={e => onChange(e.target.value)} style={sh} {...handlers} />
      }
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ParticipantsPage() {
  const [participants,          setParticipants]          = useState<DBParticipant[]>([]);
  const [filteredParticipants,  setFilteredParticipants]  = useState<DBParticipant[]>([]);
  const [searchQuery,           setSearchQuery]           = useState('');
  const [labFilter,             setLabFilter]             = useState<string>('ALL');
  const [fileName,              setFileName]              = useState('');
  const [status,                setStatus]                = useState('');
  const [loading,               setLoading]               = useState(true);
  const [lastRefreshed,         setLastRefreshed]         = useState<Date | null>(null);
  const [autoRefresh,           setAutoRefresh]           = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editForm,    setEditForm]    = useState<any | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkField,    setBulkField]    = useState<BulkField>('labAllotted');
  const [bulkValue,    setBulkValue]    = useState('');
  const [bulkSaving,   setBulkSaving]   = useState(false);

  // ── Derived lab list ──────────────────────────────────────────────────────
  const labOptions = ['ALL', ...Array.from(
    new Set(participants.map(p => p.labAllotted).filter(Boolean))
  ).sort()];

  // ── Filter ────────────────────────────────────────────────────────────────
  const applyFilters = useCallback((all: DBParticipant[], q: string, lab: string) => {
    let r = all;
    if (lab !== 'ALL') r = r.filter(p => p.labAllotted === lab);
    if (q.trim()) {
      const lq = q.toLowerCase();
      r = r.filter(p => [
        p.name, p.email, p.phone, p.participantId, p.teamName,
        (p as any).teamId, p.role, p.institute, p.state, p.labAllotted,
        (p as any).projectName, (p as any).projectDescription,
        p.wifiCredentials?.ssid, p.wifiCredentials?.password,
      ].some(v => v?.toLowerCase().includes(lq)));
    }
    return r;
  }, []);

  useEffect(() => {
    setFilteredParticipants(applyFilters(participants, searchQuery, labFilter));
  }, [searchQuery, labFilter, participants, applyFilters]);

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadParticipants = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await getParticipants();
      setParticipants(data);
      setLastRefreshed(new Date());
    } catch (err) { setStatus('Error loading participants'); console.error(err); }
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { loadParticipants(); }, []);

  useEffect(() => {
    if (autoRefresh) timerRef.current = setInterval(() => loadParticipants(true), 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh, loadParticipants]);

  // ── CSV Upload ────────────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setFileName(file.name); setStatus('Processing CSV…');
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = (results.data as any[]).map(row => {
            const wc = row.wifi_credentials || row.wifiCredentials || row['WiFi Credentials'] || '';
            return {
              participantId: row.participant_id || row.participantId || row['Participant ID'] || '',
              name:          row.name      || row.Name      || '',
              email:         row.email     || row.Email     || '',
              phone:         row.phone     || row.Phone     || row['phone number'] || '',
              role:          row.role      || row.Role      || '',
              teamName:      row.team      || row.Team      || row.teamName || row['Team Name'] || '',
              teamId:        row.team_id   || row.teamId    || row['Team ID'] || '',
              institute:     row.institute || row.Institute || row.college   || row.College || '',
              state:         row.state     || row.State     || '',
              // ── NEW: loginPassword ────────────────────────────────────
              loginPassword: row.loginpassword || row.loginPassword || row['Login Password'] || '',
              // ─────────────────────────────────────────────────────────
              labAllotted:   row.lab_alloted || row.labAllotted || row['Lab Allotted'] || row.lab || '',
              projectName:   row.project_name || row.projectName || row['Project Name'] || '',
              projectDescription: row.project_description || row.projectDescription || row['Project Description'] || '',
              wifiCredentials: { ssid: wc ? 'Hackoverflow_Guest' : '', password: wc },
              collegeCheckIn: { status: false },
              labCheckIn:     { status: false },
            };
          }).filter(p => p.email && p.participantId);

          if (!rows.length) { setStatus('No valid rows found. Each row needs participant_id + email.'); return; }
          setStatus('Saving…');
          const result = await createParticipants(rows);
          if (result.success) { setStatus(`Added ${result.count} participants`); await loadParticipants(); }
          else setStatus(`Error: ${result.error}`);
        } catch (err) { setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown'}`); }
      },
      error: (err) => setStatus(`CSV parse error: ${err.message}`),
    });
  };

  // ── Selection ─────────────────────────────────────────────────────────────
  const handleSelectAll    = () => setSelectedIds(new Set(filteredParticipants.map(p => p._id!).filter(Boolean)));
  const handleDeselectAll  = () => setSelectedIds(new Set());
  const handleToggleSelect = (id: string) => {
    const n = new Set(selectedIds);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelectedIds(n);
  };

  // ── Single edit ───────────────────────────────────────────────────────────
  const handleEdit       = (p: any)  => { setEditingId(p._id || null); setEditForm({ ...p }); };
  const handleCancelEdit = ()        => { setEditingId(null); setEditForm(null); };
  const handleSaveEdit   = async ()  => {
    if (!editForm || !editingId) return;
    try {
      setStatus('Updating…');
      const result = await updateParticipant(editingId, {
        name: editForm.name, email: editForm.email, phone: editForm.phone,
        role: editForm.role, teamName: editForm.teamName, teamId: editForm.teamId,
        institute: editForm.institute,
        state: editForm.state,
        loginPassword: editForm.loginPassword, // ── NEW ──
        labAllotted: editForm.labAllotted,
        projectName: editForm.projectName, projectDescription: editForm.projectDescription,
        wifiCredentials: editForm.wifiCredentials,
      });
      if (result.success) { setStatus('Updated'); await loadParticipants(); setEditingId(null); setEditForm(null); }
      else setStatus(`Error: ${result.error}`);
    } catch (err) { setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown'}`); }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this participant?')) return;
    const result = await deleteParticipant(id);
    if (result.success) { setStatus('Deleted'); await loadParticipants(); }
    else setStatus(`Error: ${result.error}`);
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size || !confirm(`Delete ${selectedIds.size} participant(s)?`)) return;
    setStatus(`Deleting ${selectedIds.size}…`);
    const results = await Promise.all(Array.from(selectedIds).map(id => deleteParticipant(id)));
    setStatus(`Deleted ${results.filter(r => r.success).length}/${results.length}`);
    setSelectedIds(new Set()); await loadParticipants();
  };

  // ── Bulk Edit ─────────────────────────────────────────────────────────────
  const handleBulkEdit = async () => {
    if (!selectedIds.size || !bulkValue.trim()) return;
    setBulkSaving(true); setStatus(`Updating ${selectedIds.size}…`);
    try {
      const results = await Promise.all(Array.from(selectedIds).map(id => {
        const p = participants.find(x => x._id === id) as any;
        if (!p) return Promise.resolve({ success: false });
        let patch: any = {};
        if      (bulkField === 'wifiSsid')    patch = { wifiCredentials: { ...p.wifiCredentials, ssid:     bulkValue } };
        else if (bulkField === 'wifiPassword') patch = { wifiCredentials: { ...p.wifiCredentials, password: bulkValue } };
        else                                   patch = { [bulkField]: bulkValue };
        return updateParticipant(id, patch);
      }));
      setStatus(`Updated ${results.filter(r => r.success).length}/${results.length}`);
      setBulkEditOpen(false); setSelectedIds(new Set()); await loadParticipants();
    } catch (err) { setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown'}`); }
    finally { setBulkSaving(false); }
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const csv = Papa.unparse((filteredParticipants.length < participants.length ? filteredParticipants : participants).map((p: any) => ({
      participant_id: p.participantId, name: p.name, email: p.email,
      phone: p.phone || '', role: p.role || '', team: p.teamName || '',
      team_id: p.teamId || '', institute: p.institute || '',
      state: p.state || '',
      login_password: p.loginPassword || '', // ── NEW ──
      lab_alloted: p.labAllotted || '',
      project_name: p.projectName || '', project_description: p.projectDescription || '',
      wifi_ssid: p.wifiCredentials?.ssid || '', wifi_password: p.wifiCredentials?.password || '',
      college_checkin: p.collegeCheckIn?.status ? 'Yes' : 'No',
      college_checkin_time: p.collegeCheckIn?.time ? new Date(p.collegeCheckIn.time).toISOString() : '',
      lab_checkin: p.labCheckIn?.status ? 'Yes' : 'No',
      lab_checkin_time: p.labCheckIn?.time ? new Date(p.labCheckIn.time).toISOString() : '',
    })));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `participants-${labFilter !== 'ALL' ? labFilter + '-' : ''}${Date.now()}.csv`;
    a.click(); setStatus('Exported');
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: '3rem', textAlign: 'center', fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)' }}>
      Loading participants…
    </div>
  );

  const fieldLabel = BULK_EDIT_FIELDS.find(f => f.key === bulkField)?.label ?? bulkField;

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        .pp-page  { padding: 3rem; }
        .pp-top   { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }
        .pp-egrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
        .pp-igrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.4rem 1.5rem; }
        .pp-vrow  { display: flex; justify-content: space-between; align-items: start; gap: 1rem; }
        .pp-acts  { display: flex; gap: 0.5rem; flex-shrink: 0; }
        .pp-bbar  { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
        .pp-bbtns { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        .pp-hov:hover { background-color: rgba(255,255,255,0.09) !important; border-color: rgba(255,255,255,0.3) !important; }
        .pp-card { border: 1px solid rgba(255,255,255,0.1); padding: 1.5rem; transition: border-color 0.25s; }
        .pp-card:hover { border-color: rgba(255,255,255,0.2); }
        .pp-lbl { font-size: 0.875rem; font-family: monospace; color: rgba(255,255,255,0.55); margin-bottom: 0.75rem; letter-spacing: 0.06em; }
        .pp-sel { width:100%; background:transparent; border:1px solid rgba(255,255,255,0.2); color:#fff; font-family:monospace; font-size:0.875rem; padding:0.6rem 2.2rem 0.6rem 0.75rem; appearance:none; cursor:pointer; outline:none; transition:border-color 0.2s; }
        .pp-sel:focus,.pp-sel:hover { border-color:rgba(255,255,255,0.45); }
        .pp-sel option { background:#111; }
        .pp-overlay { position:fixed; inset:0; z-index:50; background:rgba(0,0,0,0.82); display:flex; align-items:center; justify-content:center; padding:1.5rem; }
        .pp-modal { background:#0d0d0d; border:1px solid rgba(255,255,255,0.15); width:100%; max-width:500px; padding:2rem; display:flex; flex-direction:column; gap:1.5rem; max-height:90vh; overflow-y:auto; }
        .pp-badge { display:inline-flex; align-items:center; gap:0.25rem; padding:0.15rem 0.55rem; font-size:0.68rem; font-family:monospace; letter-spacing:0.04em; border-radius:2px; }
        .pp-ok  { color:#4ade80; border:1px solid rgba(74,222,128,0.3);  background:rgba(74,222,128,0.07); }
        .pp-err { color:#f87171; border:1px solid rgba(248,113,113,0.3); background:rgba(248,113,113,0.07); }
        .pp-rbar { display:flex; align-items:center; gap:1rem; flex-wrap:wrap; font-family:monospace; font-size:0.75rem; color:rgba(255,255,255,0.42); }
        @media (max-width:640px) {
          .pp-page  { padding:1.25rem; padding-top:calc(60px + 1.25rem); }
          .pp-top   { grid-template-columns:1fr; }
          .pp-egrid { grid-template-columns:1fr; }
          .pp-igrid { grid-template-columns:1fr; }
          .pp-vrow  { flex-wrap:wrap; }
          .pp-acts  { width:100%; justify-content:flex-end; margin-top:0.5rem; }
          .pp-bbtns button { flex:1; justify-content:center; }
        }
      `}</style>

      {/* ── Bulk-Edit Modal ───────────────────────────────────────────────── */}
      {bulkEditOpen && (
        <div className="pp-overlay" onClick={() => setBulkEditOpen(false)}>
          <div className="pp-modal" onClick={e => e.stopPropagation()}>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '0.25rem' }}>BULK EDIT</div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)' }}>
                Applying to <strong style={{ color: '#fff' }}>{selectedIds.size}</strong> participant{selectedIds.size !== 1 ? 's' : ''}
                {labFilter !== 'ALL' && <span style={{ marginLeft: '0.6rem', padding: '0.15rem 0.6rem', border: '1px solid rgba(255,255,255,0.12)', fontFamily: 'monospace', fontSize: '0.7rem' }}>Lab: {labFilter}</span>}
              </div>
            </div>

            <div>
              <label style={labelStyle}>FIELD TO UPDATE</label>
              <div style={{ position: 'relative' }}>
                <select className="pp-sel" value={bulkField} onChange={e => setBulkField(e.target.value as BulkField)}>
                  {BULK_EDIT_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.4 }}>
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>

            <div>
              <label style={labelStyle}>NEW VALUE — {fieldLabel.toUpperCase()}</label>
              {bulkField === 'projectDescription'
                ? <textarea value={bulkValue} onChange={e => setBulkValue(e.target.value)} rows={4}
                    placeholder={`Enter ${fieldLabel}…`} autoFocus
                    style={{ ...inputStyle, resize: 'vertical' }}
                    onFocus={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'}
                    onBlur={e  => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'} />
                : <input type="text" value={bulkValue} onChange={e => setBulkValue(e.target.value)}
                    placeholder={`Enter ${fieldLabel}…`} autoFocus style={inputStyle}
                    onFocus={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'}
                    onBlur={e  => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'} />
              }
            </div>

            {bulkValue.trim() && (
              <div style={{ border: '1px solid rgba(255,255,255,0.08)', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', fontFamily: 'monospace', fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)' }}>
                Set <span style={{ color: '#fff' }}>{fieldLabel}</span> → <span style={{ color: '#4ade80' }}>"{bulkValue}"</span> for <span style={{ color: '#fff' }}>{selectedIds.size}</span> participants
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setBulkEditOpen(false)} style={btnBase} className="pp-hov">CANCEL</button>
              <button onClick={handleBulkEdit} disabled={bulkSaving || !bulkValue.trim()}
                style={{ padding: '0.5rem 1.5rem', background: bulkValue.trim() ? '#fff' : 'rgba(255,255,255,0.1)', border: 'none', color: '#000', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 'bold', cursor: bulkValue.trim() ? 'pointer' : 'not-allowed', letterSpacing: '0.05em', opacity: bulkValue.trim() ? 1 : 0.5 }}>
                {bulkSaving ? 'SAVING…' : `APPLY TO ${selectedIds.size}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page body ─────────────────────────────────────────────────────── */}
      <div className="pp-page">
        {/* Header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <h1 style={{ fontSize: 'clamp(2.5rem,6vw,4rem)', fontWeight: 900, letterSpacing: '-0.05em', marginBottom: '0.25rem' }}>PARTICIPANTS</h1>
          <p style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>Manage your event attendees</p>
          <div className="pp-rbar">
            <button onClick={() => loadParticipants(true)} style={{ ...btnBase, padding: '0.4rem 0.9rem' }} className="pp-hov">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              REFRESH NOW
            </button>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} style={{ accentColor: '#fff', cursor: 'pointer' }} />
              Auto-refresh every 30s
            </label>
            {lastRefreshed && <span>Last updated: {lastRefreshed.toLocaleTimeString()}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* ── Top cards ── */}
          <div className="pp-top">
            {/* Upload */}
            <div className="pp-card">
              <div className="pp-lbl">UPLOAD CSV FILE</div>
              <div style={{ position: 'relative' }}>
                <input type="file" accept=".csv" onChange={handleFileUpload} id="csv-upload"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                <label htmlFor="csv-upload"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.2)', padding: '1.75rem 1rem', cursor: 'pointer', transition: 'all 0.3s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.background = 'transparent'; }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: '0.6rem', opacity: 0.45 }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
                    {fileName || 'Click to upload CSV'}
                  </div>
                  {fileName && <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.35rem' }}>{participants.length} participants</div>}
                </label>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.75rem', fontFamily: 'monospace', lineHeight: 1.6 }}>
                Required: participant_id, name, email<br />
                Optional: team_id, state, loginpassword, project_name, project_description, lab_alloted, wifi_credentials
              </div>
            </div>

            {/* Search + Lab filter */}
            <div className="pp-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Search */}
              <div>
                <div className="pp-lbl">SEARCH</div>
                <div style={{ position: 'relative' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.35 }}>
                    <circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path>
                  </svg>
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Name, email, ID, team, state, lab, project, WiFi…"
                    style={{ ...inputStyle, paddingLeft: '2.4rem', paddingRight: searchQuery ? '2rem' : '0.75rem' }}
                    onFocus={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'}
                    onBlur={e  => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'} />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')}
                      style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '1rem', padding: '0.2rem' }}>✕</button>
                  )}
                </div>
              </div>

              {/* Lab dropdown */}
              <div>
                <div className="pp-lbl">FILTER BY LAB</div>
                <div style={{ position: 'relative' }}>
                  <select className="pp-sel" value={labFilter} onChange={e => setLabFilter(e.target.value)}>
                    {labOptions.map(lab => (
                      <option key={lab} value={lab}>
                        {lab === 'ALL'
                          ? `All Labs  (${participants.length} participants)`
                          : `${lab}  —  ${participants.filter(p => p.labAllotted === lab).length} participants`}
                      </option>
                    ))}
                  </select>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.4 }}>
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>

            {/* Stats + export */}
            <div className="pp-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <div className="pp-lbl">{labFilter === 'ALL' ? 'TOTAL PARTICIPANTS' : `LAB: ${labFilter}`}</div>
                <div style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1, marginBottom: '0.25rem' }}>{filteredParticipants.length}</div>
                {(searchQuery || labFilter !== 'ALL') && (
                  <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                    of {participants.length} total
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {labFilter !== 'ALL' && (
                  <button onClick={() => setLabFilter('ALL')} style={{ ...btnBase, justifyContent: 'center', fontSize: '0.7rem' }} className="pp-hov">CLEAR LAB FILTER</button>
                )}
                {participants.length > 0 && (
                  <button onClick={handleExport} style={{ ...btnBase, justifyContent: 'center', background: 'rgba(255,255,255,0.07)' }} className="pp-hov">
                    EXPORT {labFilter !== 'ALL' ? `(${labFilter})` : ''} CSV
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Status bar */}
          {status && (
            <div style={{ border: '1px solid rgba(255,255,255,0.12)', padding: '0.875rem 1rem', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', flex: 1 }}>{status}</span>
              <button onClick={() => setStatus('')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
            </div>
          )}

          {/* ── Bulk action bar ── */}
          {filteredParticipants.length > 0 && (
            <div className="pp-bbar" style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '1rem 1.5rem' }}>
              <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)' }}>
                {selectedIds.size > 0
                  ? <span style={{ color: '#fff' }}>{selectedIds.size} selected</span>
                  : 'No participants selected'}
                {labFilter !== 'ALL' && (
                  <span style={{ marginLeft: '0.75rem', padding: '0.15rem 0.55rem', border: '1px solid rgba(255,255,255,0.12)', fontFamily: 'monospace', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                    Lab: {labFilter}
                  </span>
                )}
              </div>
              <div className="pp-bbtns">
                <button onClick={handleSelectAll}   disabled={selectedIds.size === filteredParticipants.length} style={{ ...btnBase, opacity: selectedIds.size === filteredParticipants.length ? 0.4 : 1 }} className="pp-hov">SELECT ALL</button>
                <button onClick={handleDeselectAll} disabled={!selectedIds.size} style={{ ...btnBase, opacity: !selectedIds.size ? 0.4 : 1 }} className="pp-hov">DESELECT ALL</button>
                <button
                  onClick={() => { setBulkField('labAllotted'); setBulkValue(''); setBulkEditOpen(true); }}
                  disabled={!selectedIds.size}
                  style={{ ...btnBase, background: selectedIds.size ? 'rgba(96,165,250,0.13)' : 'transparent', borderColor: selectedIds.size ? 'rgba(96,165,250,0.45)' : 'rgba(255,255,255,0.2)', color: selectedIds.size ? '#60a5fa' : 'rgba(255,255,255,0.3)', opacity: !selectedIds.size ? 0.45 : 1, cursor: !selectedIds.size ? 'not-allowed' : 'pointer' }}
                  onMouseEnter={e => { if (selectedIds.size) e.currentTarget.style.background = 'rgba(96,165,250,0.22)'; }}
                  onMouseLeave={e => { if (selectedIds.size) e.currentTarget.style.background = 'rgba(96,165,250,0.13)'; }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  BULK EDIT ({selectedIds.size})
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={!selectedIds.size}
                  style={{ ...btnBase, background: selectedIds.size ? 'rgba(248,113,113,0.13)' : 'transparent', borderColor: 'rgba(248,113,113,0.4)', color: selectedIds.size ? '#f87171' : 'rgba(248,113,113,0.3)', opacity: !selectedIds.size ? 0.45 : 1, cursor: !selectedIds.size ? 'not-allowed' : 'pointer' }}
                  onMouseEnter={e => { if (selectedIds.size) e.currentTarget.style.background = 'rgba(248,113,113,0.22)'; }}
                  onMouseLeave={e => { if (selectedIds.size) e.currentTarget.style.background = 'rgba(248,113,113,0.13)'; }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  DELETE ({selectedIds.size})
                </button>
              </div>
            </div>
          )}

          {/* ── Participants list ── */}
          <div style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '1.5rem' }}>
            <div style={{ fontSize: '0.875rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', marginBottom: '1.5rem', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              PARTICIPANTS LIST
              {(searchQuery || labFilter !== 'ALL') && (
                <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>
                  — {filteredParticipants.length} of {participants.length}
                </span>
              )}
            </div>

            {filteredParticipants.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 0', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.22 }}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                {participants.length === 0 ? <>No participants loaded<br />Upload a CSV to begin</> : 'No participants match your filters'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredParticipants.map((participant: any) => (
                  <div key={participant._id || participant.participantId}
                    style={{ border: `1px solid ${selectedIds.has(participant._id) ? 'rgba(96,165,250,0.28)' : 'rgba(255,255,255,0.1)'}`, padding: '1.25rem', transition: 'all 0.22s', background: editingId === participant._id ? 'rgba(255,255,255,0.04)' : selectedIds.has(participant._id) ? 'rgba(96,165,250,0.04)' : 'transparent' }}
                    onMouseEnter={e => { if (editingId !== participant._id) e.currentTarget.style.borderColor = selectedIds.has(participant._id) ? 'rgba(96,165,250,0.45)' : 'rgba(255,255,255,0.22)'; }}
                    onMouseLeave={e => { if (editingId !== participant._id) e.currentTarget.style.borderColor = selectedIds.has(participant._id) ? 'rgba(96,165,250,0.28)' : 'rgba(255,255,255,0.1)'; }}
                  >
                    {editingId === participant._id && editForm ? (
                      // ── Edit mode ────────────────────────────────────────
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'rgba(255,255,255,0.38)', letterSpacing: '0.05em' }}>
                          EDITING: {participant.name} · {participant.participantId}
                        </div>
                        <div className="pp-egrid">
                          <EF label="NAME"           value={editForm.name        || ''} onChange={v => setEditForm({ ...editForm, name: v })} />
                          <EF label="EMAIL"          value={editForm.email       || ''} onChange={v => setEditForm({ ...editForm, email: v })} />
                          <EF label="PHONE"          value={editForm.phone       || ''} onChange={v => setEditForm({ ...editForm, phone: v })} />
                          <EF label="TEAM NAME"      value={editForm.teamName    || ''} onChange={v => setEditForm({ ...editForm, teamName: v })} />
                          <EF label="TEAM ID"        value={editForm.teamId      || ''} onChange={v => setEditForm({ ...editForm, teamId: v })} />
                          <EF label="ROLE"           value={editForm.role        || ''} onChange={v => setEditForm({ ...editForm, role: v })} />
                          <EF label="INSTITUTE"      value={editForm.institute   || ''} onChange={v => setEditForm({ ...editForm, institute: v })} />
                          <EF label="STATE"          value={editForm.state       || ''} onChange={v => setEditForm({ ...editForm, state: v })} />
                          <EF label="LOGIN PASSWORD" value={editForm.loginPassword || ''} onChange={v => setEditForm({ ...editForm, loginPassword: v })} />
                          <EF label="LAB ALLOTTED"   value={editForm.labAllotted || ''} onChange={v => setEditForm({ ...editForm, labAllotted: v })} />
                          <EF label="WiFi SSID"      value={editForm.wifiCredentials?.ssid     || ''} onChange={v => setEditForm({ ...editForm, wifiCredentials: { ...editForm.wifiCredentials, ssid: v } })} />
                          <EF label="WiFi PASSWORD"  value={editForm.wifiCredentials?.password || ''} onChange={v => setEditForm({ ...editForm, wifiCredentials: { ...editForm.wifiCredentials, password: v } })} />
                        </div>
                        <div style={{ display: 'grid', gap: '1rem' }}>
                          <EF label="PROJECT NAME"        value={editForm.projectName || ''} onChange={v => setEditForm({ ...editForm, projectName: v })} />
                          <EF label="PROJECT DESCRIPTION" value={editForm.projectDescription || ''} onChange={v => setEditForm({ ...editForm, projectDescription: v })} textarea />
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                          <button onClick={handleCancelEdit} style={btnBase} className="pp-hov">CANCEL</button>
                          <button onClick={handleSaveEdit} style={{ padding: '0.5rem 1.5rem', background: '#fff', border: 'none', color: '#000', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', letterSpacing: '0.05em' }}>SAVE</button>
                        </div>
                      </div>
                    ) : (
                      // ── View mode ────────────────────────────────────────
                      <div className="pp-vrow">
                        <div style={{ paddingTop: '0.25rem', flexShrink: 0 }}>
                          <input type="checkbox" checked={selectedIds.has(participant._id)} onChange={() => handleToggleSelect(participant._id)}
                            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#60a5fa' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Name + check-in badges */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 'bold' }}>{participant.name}</span>
                            <span className={`pp-badge ${participant.collegeCheckIn?.status ? 'pp-ok' : 'pp-err'}`}>
                              {participant.collegeCheckIn?.status ? '✓' : '✗'} College
                            </span>
                            <span className={`pp-badge ${participant.labCheckIn?.status ? 'pp-ok' : 'pp-err'}`}>
                              {participant.labCheckIn?.status ? '✓' : '✗'} Lab
                            </span>
                          </div>
                          {/* ID + team ID */}
                          <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.38)', marginBottom: '0.75rem' }}>
                            ID: {participant.participantId}
                            {participant.teamId && <> &nbsp;·&nbsp; Team ID: {participant.teamId}</>}
                          </div>

                          <div className="pp-igrid" style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.65)' }}>
                            <div><span style={{ color: 'rgba(255,255,255,0.36)' }}>Email:</span> {participant.email}</div>
                            {participant.phone      && <div><span style={{ color: 'rgba(255,255,255,0.36)' }}>Phone:</span> {participant.phone}</div>}
                            {participant.teamName   && <div><span style={{ color: 'rgba(255,255,255,0.36)' }}>Team:</span> {participant.teamName}</div>}
                            {participant.role       && <div><span style={{ color: 'rgba(255,255,255,0.36)' }}>Role:</span> {participant.role}</div>}
                            {participant.institute  && <div><span style={{ color: 'rgba(255,255,255,0.36)' }}>Institute:</span> {participant.institute}</div>}
                            {participant.state      && <div><span style={{ color: 'rgba(255,255,255,0.36)' }}>State:</span> {participant.state}</div>}
                            {/* ── NEW: loginPassword ── */}
                            {participant.loginPassword && <div><span style={{ color: 'rgba(255,255,255,0.36)' }}>Login Pass:</span> <span style={{ color: '#fbbf24' }}>{participant.loginPassword}</span></div>}
                            {participant.labAllotted && <div><span style={{ color: 'rgba(255,255,255,0.36)' }}>Lab:</span> {participant.labAllotted}</div>}
                            {participant.wifiCredentials?.ssid && (
                              <div><span style={{ color: 'rgba(255,255,255,0.36)' }}>WiFi:</span> {participant.wifiCredentials.ssid} / <span style={{ color: 'rgba(255,255,255,0.45)' }}>{participant.wifiCredentials.password || '—'}</span></div>
                            )}
                            {participant.projectName && (
                              <div style={{ gridColumn: '1 / -1' }}>
                                <span style={{ color: 'rgba(255,255,255,0.36)' }}>Project:</span> {participant.projectName}
                              </div>
                            )}
                            {participant.projectDescription && (
                              <div style={{ gridColumn: '1 / -1', color: 'rgba(255,255,255,0.42)', fontSize: '0.78rem', lineHeight: 1.55, marginTop: '0.1rem' }}>
                                {participant.projectDescription}
                              </div>
                            )}
                            {participant.collegeCheckIn?.time && (
                              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>
                                College in: {new Date(participant.collegeCheckIn.time).toLocaleString()}
                              </div>
                            )}
                            {participant.labCheckIn?.time && (
                              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>
                                Lab in: {new Date(participant.labCheckIn.time).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pp-acts">
                          <button onClick={() => handleEdit(participant)} style={btnBase} className="pp-hov">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            EDIT
                          </button>
                          <button onClick={() => handleDelete(participant._id)}
                            style={{ ...btnBase, borderColor: 'rgba(248,113,113,0.3)', color: 'rgba(248,113,113,0.65)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.1)'; e.currentTarget.style.color = '#f87171'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(248,113,113,0.65)'; }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            DELETE
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}