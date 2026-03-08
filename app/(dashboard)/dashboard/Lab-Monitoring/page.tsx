"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ParticipantLocationSnapshot, LabMonitoringSummary, VolunteerSession, CheckInLog } from "@/types";
import { startVolunteerSession, endVolunteerSession } from "@/actions/lab-monitoring";

interface OTPData { code: string; generatedAt: string; expiresAt: string; }
interface MonitorData {
  snapshots: ParticipantLocationSnapshot[];
  summary: LabMonitoringSummary;
  labs: string[];
  activeSessions: VolunteerSession[];
  recentLogs: CheckInLog[];
}
type StatusFilter = "all" | "in_lab" | "temp_exit" | "overdue" | "outside" | "checked_out";

function getStatus(s: ParticipantLocationSnapshot) {
  if (s.isOnTempExit && (s.tempExitMinutes ?? 0) > 10)
    return { label: "OVERDUE EXIT", color: "#f87171", dotColor: "#f87171", pulse: true, priority: 0 };
  if (s.isOnTempExit)
    return { label: `TEMP EXIT ${s.tempExitMinutes ?? 0}m`, color: "#facc15", dotColor: "#facc15", pulse: false, priority: 1 };
  if (s.isInsideLab)
    return { label: "IN LAB", color: "#4ade80", dotColor: "#4ade80", pulse: false, priority: 2 };
  if (s.hasCheckedOut)
    return { label: "CHECKED OUT", color: "rgba(255,255,255,0.25)", dotColor: "rgba(255,255,255,0.12)", pulse: false, priority: 4 };
  if (s.isInsideCollege)
    return { label: "IN COLLEGE", color: "#60a5fa", dotColor: "#60a5fa", pulse: false, priority: 3 };
  return { label: "NOT ARRIVED", color: "rgba(255,255,255,0.2)", dotColor: "rgba(255,255,255,0.08)", pulse: false, priority: 5 };
}

function matchesFilter(s: ParticipantLocationSnapshot, f: StatusFilter): boolean {
  if (f === "all") return true;
  if (f === "in_lab") return s.isInsideLab;
  if (f === "temp_exit") return s.isOnTempExit && (s.tempExitMinutes ?? 0) <= 10;
  if (f === "overdue") return s.isOnTempExit && (s.tempExitMinutes ?? 0) > 10;
  if (f === "outside") return !s.isInsideCollege && !s.hasCheckedOut;
  if (f === "checked_out") return s.hasCheckedOut;
  return true;
}

function OTPDisplay() {
  const [otp, setOtp] = useState<OTPData | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(30);

  const fetchOTP = useCallback(async () => {
    const res = await fetch("/api/lab-otp");
    if (res.ok) {
      const data: OTPData = await res.json();
      setOtp(data);
      setSecondsLeft(Math.max(0, Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000)));
    }
  }, []);

  useEffect(() => {
    fetchOTP();
    const tick = setInterval(() => {
      setSecondsLeft(prev => { if (prev <= 1) { fetchOTP(); return 30; } return prev - 1; });
    }, 1000);
    return () => clearInterval(tick);
  }, [fetchOTP]);

  const pct = (secondsLeft / 30) * 100;
  const digits = otp?.code.split("") ?? ["—", "—", "—", "—"];
  const isUrgent = secondsLeft <= 5;

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.1)", padding: "1.5rem", display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
      <div>
        <div style={{ fontFamily: "monospace", fontSize: "0.63rem", letterSpacing: "0.14em", color: "rgba(255,255,255,0.3)", marginBottom: "1rem" }}>LAB ENTRY OTP</div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {digits.map((d, i) => (
            <div key={i} style={{ width: "3rem", height: "3.5rem", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontSize: "1.75rem", fontWeight: 900, color: isUrgent ? "#f87171" : "#4ade80", background: "rgba(255,255,255,0.02)", transition: "color 0.2s" }}>{d}</div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
        <svg width="56" height="56" viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="2.5" />
          <circle cx="18" cy="18" r="15.9" fill="none" stroke={isUrgent ? "#f87171" : "#4ade80"} strokeWidth="2.5" strokeDasharray={`${pct} 100`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.5s ease, stroke 0.3s" }} />
        </svg>
        <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: isUrgent ? "#f87171" : "rgba(255,255,255,0.4)", fontWeight: 700 }}>{secondsLeft}s</span>
      </div>
      <div>
        <div style={{ fontFamily: "monospace", fontSize: "0.63rem", letterSpacing: "0.14em", color: "rgba(255,255,255,0.3)", marginBottom: "0.4rem" }}>ROTATES EVERY 30s</div>
        <div style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.7 }}>Participant must enter this code<br />to check into the lab.</div>
      </div>
    </div>
  );
}

function SessionModal({ onStart }: { onStart: (name: string, station: string, sessionId: string) => void }) {
  const [name, setName] = useState("");
  const [station, setStation] = useState("");
  const [loading, setLoading] = useState(false);
  const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontFamily: "monospace", fontSize: "0.875rem", padding: "0.6rem 0.75rem", outline: "none" };
  const lbl: React.CSSProperties = { display: "block", fontFamily: "monospace", fontSize: "0.63rem", letterSpacing: "0.14em", color: "rgba(255,255,255,0.3)", marginBottom: "0.5rem" };

  const handleSubmit = async () => {
    if (!name.trim() || !station.trim()) return;
    setLoading(true);
    const sessionId = await startVolunteerSession(name.trim(), station.trim());
    onStart(name.trim(), station.trim(), sessionId);
    setLoading(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: "1rem" }}>
      <div style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.12)", padding: "2.5rem", width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <div style={{ fontFamily: "monospace", fontSize: "0.63rem", letterSpacing: "0.14em", color: "rgba(255,255,255,0.3)", marginBottom: "0.5rem" }}>LAB MONITORING</div>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 900, letterSpacing: "-0.04em", marginBottom: "0.35rem" }}>START SESSION</h2>
          <p style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "rgba(255,255,255,0.35)", margin: 0, lineHeight: 1.6 }}>Enter your details to begin. This session is logged for volunteer stats.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={lbl}>YOUR NAME</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Arjun Mehta" style={inp}
              onFocus={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.45)"}
              onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"} />
          </div>
          <div>
            <label style={lbl}>STATION / LAB</label>
            <input type="text" value={station} onChange={e => setStation(e.target.value)} placeholder="e.g. Lab A – Ground Floor" style={inp}
              onFocus={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.45)"}
              onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"}
              onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
          <button onClick={handleSubmit} disabled={loading || !name.trim() || !station.trim()}
            style={{ fontFamily: "monospace", fontSize: "0.8rem", letterSpacing: "0.06em", padding: "0.875rem 1.1rem", cursor: "pointer", border: "none", background: (loading || !name.trim() || !station.trim()) ? "rgba(255,255,255,0.1)" : "#fff", color: (loading || !name.trim() || !station.trim()) ? "rgba(255,255,255,0.3)" : "#000", fontWeight: 700, transition: "all 0.2s" }}>
            {loading ? "STARTING…" : "→ START MONITORING"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LabMonitoringPage() {
  const [session, setSession] = useState<{ name: string; station: string; sessionId: string } | null>(null);
  const [data, setData] = useState<MonitorData | null>(null);
  const [labFilter, setLabFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async (lab?: string) => {
    const params = lab && lab !== "all" ? `?lab=${encodeURIComponent(lab)}` : "";
    const res = await fetch(`/api/lab-monitoring${params}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchData(labFilter);
    intervalRef.current = setInterval(() => fetchData(labFilter), 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [session, labFilter, fetchData]);

  const filtered = (data?.snapshots ?? [])
    .filter(s => {
      const q = search.toLowerCase();
      return matchesFilter(s, statusFilter) && (s.name.toLowerCase().includes(q) || (s.teamId ?? "").toLowerCase().includes(q) || (s.teamName ?? "").toLowerCase().includes(q));
    })
    .sort((a, b) => getStatus(a).priority - getStatus(b).priority);

  const { summary } = data ?? {};

  return (
    <>
      <style>{`
        .lm-page { padding: 3rem; }
        @media (max-width: 900px) { .lm-page { padding: 1.25rem; padding-top: calc(60px + 1.25rem); } }
        .lm-stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
        @media (max-width: 700px) { .lm-stat-grid { grid-template-columns: repeat(2, 1fr); } }
        .lm-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        @media (max-width: 800px) { .lm-2col { grid-template-columns: 1fr; } }
        .lm-filter-btn { font-family: monospace; font-size: 0.72rem; letter-spacing: 0.06em; padding: 0.4rem 0.85rem; cursor: pointer; border: 1px solid rgba(255,255,255,0.14); background: transparent; color: rgba(255,255,255,0.45); transition: all 0.15s; }
        .lm-filter-btn:hover { border-color: rgba(255,255,255,0.3); color: rgba(255,255,255,0.8); }
        .lm-filter-btn.active { border-color: rgba(255,255,255,0.38); color: #fff; background: rgba(255,255,255,0.06); }
        .lm-select { background: #0a0a0a; border: 1px solid rgba(255,255,255,0.14); color: #fff; font-family: monospace; font-size: 0.8rem; padding: 0.4rem 1rem; outline: none; cursor: pointer; transition: border-color .2s; }
        .lm-select:focus { border-color: rgba(255,255,255,0.35); }
        .lm-search { background: transparent; border: 1px solid rgba(255,255,255,0.14); color: #fff; font-family: monospace; font-size: 0.8rem; padding: 0.4rem 0.75rem 0.4rem 2rem; outline: none; transition: border-color .2s; min-width: 200px; }
        .lm-search:focus { border-color: rgba(255,255,255,0.38); }
        .lm-search::placeholder { color: rgba(255,255,255,0.18); }
        .lm-table { width: 100%; border-collapse: collapse; font-family: monospace; font-size: 0.78rem; }
        .lm-table th { text-align: left; padding: 0.5rem 1rem; font-size: 0.62rem; color: rgba(255,255,255,0.3); letter-spacing: 0.12em; border-bottom: 1px solid rgba(255,255,255,0.07); white-space: nowrap; position: sticky; top: 0; background: #0a0a0a; z-index: 1; }
        .lm-table td { padding: 0.625rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: rgba(255,255,255,0.65); white-space: nowrap; }
        .lm-table tr:last-child td { border-bottom: none; }
        .lm-table tr:hover td { background: rgba(255,255,255,0.025); }
        @keyframes lm-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .lm-pulse { animation: lm-pulse 1.2s ease infinite; }
        .lm-end-btn { font-family: monospace; font-size: 0.72rem; letter-spacing: 0.06em; padding: 0.4rem 0.9rem; cursor: pointer; border: 1px solid rgba(248,113,113,0.3); background: rgba(248,113,113,0.07); color: rgba(248,113,113,0.65); transition: all 0.15s; }
        .lm-end-btn:hover { background: rgba(248,113,113,0.15); color: #f87171; border-color: rgba(248,113,113,0.5); }
      `}</style>

      {!session && <SessionModal onStart={(name, station, sessionId) => setSession({ name, station, sessionId })} />}

      <div className="lm-page">
        {/* Header */}
        <div style={{ marginBottom: "3rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 900, letterSpacing: "-0.05em", marginBottom: "0.3rem" }}>LAB MONITORING</h1>
            <p style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "rgba(255,255,255,0.35)" }}>
              {session ? `${session.name} · ${session.station}` : "Volunteer monitoring session"}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "monospace", fontSize: "0.65rem", letterSpacing: "0.1em", padding: "0.2rem 0.65rem", border: "1px solid rgba(74,222,128,0.4)", color: "#4ade80", background: "rgba(74,222,128,0.07)" }}>
              <span className="lm-pulse" style={{ display: "inline-block", marginRight: "0.4rem" }}>●</span>LIVE — 5s REFRESH
            </span>
            {session && <button className="lm-end-btn" onClick={async () => { await endVolunteerSession(session.sessionId); setSession(null); }}>END SESSION</button>}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          <OTPDisplay />

          {/* Stats */}
          <div className="lm-stat-grid">
            {[
              { label: "IN LAB",       value: summary?.insideLab ?? 0,         color: "#4ade80",  urgent: false },
              { label: "TEMP EXIT",    value: summary?.onTempExit ?? 0,        color: "#facc15",  urgent: false },
              { label: "OVERDUE >10m", value: summary?.overdueExits ?? 0,      color: summary?.overdueExits ? "#f87171" : "rgba(255,255,255,0.4)", urgent: !!(summary?.overdueExits) },
              { label: "TOTAL",        value: summary?.totalParticipants ?? 0, color: "#fff",     urgent: false },
            ].map(stat => (
              <div key={stat.label} style={{ border: `1px solid ${stat.urgent ? "rgba(248,113,113,0.25)" : "rgba(255,255,255,0.08)"}`, padding: "1.1rem 1.25rem", background: stat.urgent ? "rgba(248,113,113,0.04)" : "transparent" }}>
                <div style={{ fontFamily: "monospace", fontSize: "0.62rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", marginBottom: "0.4rem" }}>{stat.label}</div>
                <div style={{ fontFamily: "monospace", fontSize: "1.75rem", fontWeight: 900, letterSpacing: "-0.03em", color: stat.color }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Overdue banner */}
          {(summary?.overdueExits ?? 0) > 0 && (
            <div style={{ border: "1px solid rgba(248,113,113,0.35)", background: "rgba(248,113,113,0.07)", padding: "0.875rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" style={{ flexShrink: 0 }}>
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#f87171" }}>
                <strong>{summary!.overdueExits}</strong> participant{summary!.overdueExits > 1 ? "s" : ""} on temp exit for more than 10 minutes — check immediately.
              </span>
            </div>
          )}

          {/* Filters */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
            <select className="lm-select" value={labFilter} onChange={e => setLabFilter(e.target.value)}>
              <option value="all">All Labs</option>
              {(data?.labs ?? []).map(lab => <option key={lab} value={lab}>{lab}</option>)}
            </select>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {(["all","in_lab","temp_exit","overdue","outside","checked_out"] as StatusFilter[]).map(v => (
                <button key={v} className={`lm-filter-btn ${statusFilter === v ? "active" : ""}`} onClick={() => setStatusFilter(v)}>
                  {v.replace(/_/g," ").toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ position: "relative", marginLeft: "auto" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" style={{ position: "absolute", left: "0.6rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or team…" className="lm-search" />
            </div>
          </div>

          {/* Table */}
          <div style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ overflowX: "auto", maxHeight: "520px", overflowY: "auto" }}>
              <table className="lm-table">
                <thead>
                  <tr>
                    <th>STATUS</th><th>NAME</th><th>TEAM ID</th><th>LAB</th><th>DURATION</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} style={{ padding: "3rem", textAlign: "center", color: "rgba(255,255,255,0.25)" }}>Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: "3rem", textAlign: "center", color: "rgba(255,255,255,0.25)" }}>No participants match the current filter.</td></tr>
                  ) : filtered.map(p => {
                    const st = getStatus(p);
                    return (
                      <tr key={p.participantId}>
                        <td>
                          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span className={st.pulse ? "lm-pulse" : ""} style={{ width: 7, height: 7, borderRadius: "50%", background: st.dotColor, flexShrink: 0, display: "inline-block" }} />
                            <span style={{ fontFamily: "monospace", fontSize: "0.68rem", letterSpacing: "0.08em", color: st.color, fontWeight: 700 }}>{st.label}</span>
                          </span>
                        </td>
                        <td style={{ color: "#fff", fontWeight: 700 }}>{p.name}</td>
                        <td style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem" }}>{p.teamId ?? "—"}</td>
                        <td style={{ color: "rgba(255,255,255,0.4)" }}>{p.labAllotted ?? "—"}</td>
                        <td style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem" }}>{p.isOnTempExit ? `${p.tempExitMinutes ?? 0} min` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "0.5rem 1rem", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "monospace", fontSize: "0.68rem", color: "rgba(255,255,255,0.25)" }}>{filtered.length} of {data?.snapshots.length ?? 0} participants</span>
              <span style={{ fontFamily: "monospace", fontSize: "0.68rem", color: "rgba(255,255,255,0.2)" }}>Auto-refresh every 5s</span>
            </div>
          </div>

          {/* Active sessions + recent activity */}
          <div className="lm-2col">
            <div style={{ border: "1px solid rgba(255,255,255,0.1)", padding: "1.5rem" }}>
              <div style={{ fontFamily: "monospace", fontSize: "0.63rem", letterSpacing: "0.14em", color: "rgba(255,255,255,0.3)", marginBottom: "1.25rem" }}>ACTIVE VOLUNTEER SESSIONS</div>
              {(data?.activeSessions ?? []).length === 0 ? (
                <div style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "rgba(255,255,255,0.25)" }}>No active sessions</div>
              ) : (data?.activeSessions ?? []).map(s => (
                <div key={s.sessionId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div>
                    <div style={{ fontFamily: "monospace", fontSize: "0.875rem", fontWeight: 700 }}>{s.volunteerName}</div>
                    <div style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", marginTop: "0.15rem" }}>{s.station}</div>
                  </div>
                  <span style={{ fontFamily: "monospace", fontSize: "0.65rem", letterSpacing: "0.09em", padding: "0.18rem 0.55rem", border: "1px solid rgba(74,222,128,0.4)", color: "#4ade80", background: "rgba(74,222,128,0.07)" }}>● ON DUTY</span>
                </div>
              ))}
            </div>

            <div style={{ border: "1px solid rgba(255,255,255,0.1)", padding: "1.5rem" }}>
              <div style={{ fontFamily: "monospace", fontSize: "0.63rem", letterSpacing: "0.14em", color: "rgba(255,255,255,0.3)", marginBottom: "1.25rem" }}>RECENT ACTIVITY</div>
              <div style={{ display: "flex", flexDirection: "column", maxHeight: "260px", overflowY: "auto" }}>
                {(data?.recentLogs ?? []).length === 0 ? (
                  <div style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "rgba(255,255,255,0.25)" }}>No recent activity</div>
                ) : (data?.recentLogs ?? []).map(log => (
                  <div key={log.logId} style={{ display: "flex", gap: "0.75rem", padding: "0.55rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ fontFamily: "monospace", fontSize: "0.68rem", color: "rgba(255,255,255,0.25)", flexShrink: 0, marginTop: 1 }}>
                      {new Date(log.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <div>
                      <span style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "rgba(255,255,255,0.7)" }}>{log.participantName}</span>
                      <span style={{ fontFamily: "monospace", fontSize: "0.68rem", color: "rgba(255,255,255,0.3)", marginLeft: "0.5rem" }}>{log.actionType.replace(/_/g, " ")}</span>
                      {log.processedBy && <span style={{ fontFamily: "monospace", fontSize: "0.65rem", color: "rgba(255,255,255,0.2)", marginLeft: "0.4rem" }}>via {log.processedBy.volunteerName}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}