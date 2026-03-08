"use client";

import { useState, useEffect, useCallback } from "react";
import { EventStats, VolunteerStats, CheckActionType, MealStatus } from "@/types";

const ACTION_LABELS: Record<CheckActionType, string> = {
  college_checkin:  "College In",
  college_checkout: "College Out",
  lab_checkin:      "Lab In",
  lab_checkout:     "Lab Out",
  temp_lab_checkout: "Temp Exit",
  temp_lab_checkin:  "Temp Return",
};

const MEAL_LABELS: Record<keyof MealStatus, string> = {
  day1_dinner:    "Day 1 – Dinner",
  day2_breakfast: "Day 2 – Breakfast",
  day2_lunch:     "Day 2 – Lunch",
  day2_dinner:    "Day 2 – Dinner",
  day3_breakfast: "Day 3 – Breakfast",
  day3_lunch:     "Day 3 – Lunch",
};

const MEAL_KEYS = Object.keys(MEAL_LABELS) as (keyof MealStatus)[];

function Bar({ value, total, color = "#fff" }: { value: number; total: number; color?: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div style={{ height: "2px", background: "rgba(255,255,255,0.07)", marginTop: "0.4rem" }}>
      <div style={{ height: "2px", background: color, width: `${pct}%`, transition: "width 0.4s ease" }} />
    </div>
  );
}

export default function VolunteerStatsPage() {
  const [stats, setStats] = useState<EventStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/volunteer-stats");
    if (res.ok) { setStats(await res.json()); setLastRefreshed(new Date()); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) return (
    <div style={{ padding: "3rem", textAlign: "center", fontFamily: "monospace", color: "rgba(255,255,255,0.4)" }}>
      Loading stats…
    </div>
  );

  if (!stats) return null;

  const maxActions = Math.max(...stats.volunteerStats.map(v => v.totalActions), 1);
  const recent12 = stats.checkinTimeline.slice(-12);
  const maxBar = Math.max(...recent12.map(d => d.count), 1);

  return (
    <>
      <style>{`
        .vs-page { padding: 3rem; }
        @media (max-width: 900px) { .vs-page { padding: 1.25rem; padding-top: calc(60px + 1.25rem); } }
        .vs-stat-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; }
        @media (max-width: 900px) { .vs-stat-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 500px) { .vs-stat-grid { grid-template-columns: repeat(2, 1fr); } }
        .vs-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        @media (max-width: 800px) { .vs-2col { grid-template-columns: 1fr; } }
        .vs-refresh-btn { font-family: monospace; font-size: 0.75rem; letter-spacing: 0.06em; padding: 0.5rem 1rem; cursor: pointer; border: 1px solid rgba(255,255,255,0.2); background: transparent; color: rgba(255,255,255,0.6); display: inline-flex; align-items: center; gap: 0.5rem; transition: all 0.2s; }
        .vs-refresh-btn:hover { border-color: rgba(255,255,255,0.4); color: #fff; background: rgba(255,255,255,0.04); }
        .vs-table { width: 100%; border-collapse: collapse; font-family: monospace; font-size: 0.75rem; }
        .vs-table th { text-align: left; padding: 0.5rem 1rem; font-size: 0.62rem; color: rgba(255,255,255,0.3); letter-spacing: 0.12em; border-bottom: 1px solid rgba(255,255,255,0.07); white-space: nowrap; position: sticky; top: 0; background: #0a0a0a; z-index: 1; }
        .vs-table td { padding: 0.75rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: rgba(255,255,255,0.65); vertical-align: top; }
        .vs-table tr:last-child td { border-bottom: none; }
        .vs-table tr:hover td { background: rgba(255,255,255,0.02); }
        .vs-badge { font-family: monospace; font-size: 0.62rem; padding: 0.15rem 0.5rem; border: 1px solid; letter-spacing: 0.08em; white-space: nowrap; }
        .vs-badge-green { border-color: rgba(74,222,128,0.4); color: #4ade80; background: rgba(74,222,128,0.07); }
        .vs-badge-dim   { border-color: rgba(255,255,255,0.1); color: rgba(255,255,255,0.3); background: transparent; }
        .vs-badge-blue  { border-color: rgba(96,165,250,0.35); color: #60a5fa; background: rgba(96,165,250,0.07); }
      `}</style>

      <div className="vs-page">
        {/* Header */}
        <div style={{ marginBottom: "3rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 900, letterSpacing: "-0.05em", marginBottom: "0.3rem" }}>EVENT STATS</h1>
            <p style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "rgba(255,255,255,0.35)" }}>
              Volunteer activity · Check-in metrics · Meal tracking
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {lastRefreshed && <span style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.05em" }}>LAST SYNC {lastRefreshed.toLocaleTimeString()}</span>}
            <button className="vs-refresh-btn" onClick={fetchStats}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              REFRESH
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* Top stats */}
          <div className="vs-stat-grid">
            {[
              { label: "REGISTERED",      value: stats.totalRegistered,       color: "#fff" },
              { label: "AT COLLEGE",       value: stats.totalCheckedInCollege, color: "#60a5fa" },
              { label: "IN LAB",           value: stats.totalInsideLab,        color: "#4ade80" },
              { label: "TEMP EXIT",        value: stats.totalOnTempExit,       color: "#facc15" },
              { label: "ACTIVE VOL.",      value: stats.activeVolunteers,      color: "#a78bfa" },
            ].map(s => (
              <div key={s.label} style={{ border: "1px solid rgba(255,255,255,0.08)", padding: "1.1rem 1.25rem" }}>
                <div style={{ fontFamily: "monospace", fontSize: "0.62rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", marginBottom: "0.4rem" }}>{s.label}</div>
                <div style={{ fontFamily: "monospace", fontSize: "1.5rem", fontWeight: 900, letterSpacing: "-0.03em", color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Timeline + Meal stats */}
          <div className="vs-2col">
            {/* Timeline */}
            <div style={{ border: "1px solid rgba(255,255,255,0.1)", padding: "1.5rem" }}>
              <div style={{ fontFamily: "monospace", fontSize: "0.63rem", letterSpacing: "0.14em", color: "rgba(255,255,255,0.3)", marginBottom: "1.5rem" }}>
                CHECK-IN ACTIVITY (LAST 12h)
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "0.25rem", height: "80px" }}>
                {recent12.map((d, i) => {
                  const h = Math.max(2, Math.round((d.count / maxBar) * 80));
                  return (
                    <div key={i} title={`${d.hour}: ${d.count}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", cursor: "default" }}>
                      <div style={{ width: "100%", background: d.count > 0 ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.08)", height: `${h}px`, transition: "height 0.3s ease", minWidth: "8px" }}
                        onMouseEnter={e => { if (d.count > 0) e.currentTarget.style.background = "#fff"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = d.count > 0 ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.08)"; }}
                      />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem" }}>
                <span style={{ fontFamily: "monospace", fontSize: "0.65rem", color: "rgba(255,255,255,0.25)" }}>{recent12[0]?.hour}</span>
                <span style={{ fontFamily: "monospace", fontSize: "0.65rem", color: "rgba(255,255,255,0.25)" }}>{recent12[recent12.length - 1]?.hour}</span>
              </div>
            </div>

            {/* Meal stats */}
            <div style={{ border: "1px solid rgba(255,255,255,0.1)", padding: "1.5rem" }}>
              <div style={{ fontFamily: "monospace", fontSize: "0.63rem", letterSpacing: "0.14em", color: "rgba(255,255,255,0.3)", marginBottom: "1.25rem" }}>MEAL COLLECTION</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                {MEAL_KEYS.map(key => {
                  const count = stats.mealStats[key] ?? 0;
                  const pct = stats.totalRegistered > 0 ? Math.round((count / stats.totalRegistered) * 100) : 0;
                  return (
                    <div key={key}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "rgba(255,255,255,0.5)" }}>{MEAL_LABELS[key].toUpperCase()}</span>
                        <span style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "rgba(255,255,255,0.65)" }}>
                          {count} <span style={{ color: "rgba(255,255,255,0.25)" }}>/ {stats.totalRegistered}</span>
                          <span style={{ color: "rgba(255,255,255,0.3)", marginLeft: "0.4rem" }}>({pct}%)</span>
                        </span>
                      </div>
                      <Bar value={count} total={stats.totalRegistered} color="#a78bfa" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Volunteer table */}
          <div style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ fontFamily: "monospace", fontSize: "0.63rem", letterSpacing: "0.14em", color: "rgba(255,255,255,0.3)" }}>VOLUNTEER BREAKDOWN</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="vs-table">
                <thead>
                  <tr>
                    <th>VOLUNTEER</th><th>ROLE</th><th>STATION</th><th>STATUS</th><th>ACTIONS</th><th>ACTIVITY</th><th>DUTY TIME</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.volunteerStats.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: "3rem", textAlign: "center", color: "rgba(255,255,255,0.25)" }}>No volunteers registered yet.</td></tr>
                  ) : stats.volunteerStats.map((v: VolunteerStats) => {
                    const isOnDuty = !!v.currentSession;
                    const hours = Math.floor(v.totalDutyMinutes / 60);
                    const mins = v.totalDutyMinutes % 60;
                    return (
                      <tr key={v.volunteerId}>
                        <td style={{ color: "#fff", fontWeight: 700 }}>{v.volunteerName}</td>
                        <td style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.7rem" }}>{v.role.replace(/_/g, " ")}</td>
                        <td style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.75rem" }}>{v.currentSession?.station ?? v.assignedStation}</td>
                        <td>
                          <span className={`vs-badge ${isOnDuty ? "vs-badge-green" : "vs-badge-dim"}`}>
                            {isOnDuty ? "● ON DUTY" : "○ OFF"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: "0.875rem", color: "#fff" }}>{v.totalActions}</span>
                            <div style={{ width: "60px" }}>
                              <Bar value={v.totalActions} total={maxActions} color="#60a5fa" />
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                            {(Object.entries(v.actionBreakdown) as [CheckActionType, number][]).map(([action, count]) => (
                              <span key={action} className="vs-badge vs-badge-blue" style={{ fontSize: "0.6rem" }}>
                                {ACTION_LABELS[action]}: {count}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem" }}>
                          {hours > 0 ? `${hours}h ` : ""}{mins}m
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}