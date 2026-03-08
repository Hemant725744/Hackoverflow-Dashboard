"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ParticipantPortalConfig, PortalAlert, AlertSeverity,
  ScheduleEvent, ScheduleEventCategory, MealTimeConfig, MealStatus,
} from "@/types";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const MEAL_KEYS: (keyof MealStatus)[] = ["day1_dinner","day2_breakfast","day2_lunch","day2_dinner","day3_breakfast","day3_lunch"];
const MEAL_LABELS: Record<keyof MealStatus, string> = {
  day1_dinner: "Day 1 – Dinner", day2_breakfast: "Day 2 – Breakfast", day2_lunch: "Day 2 – Lunch",
  day2_dinner: "Day 2 – Dinner", day3_breakfast: "Day 3 – Breakfast", day3_lunch: "Day 3 – Lunch",
};

const SEVERITY_CONFIG: Record<AlertSeverity, { color: string; border: string; bg: string }> = {
  info:    { color: "#60a5fa", border: "rgba(96,165,250,0.35)",  bg: "rgba(96,165,250,0.06)" },
  warning: { color: "#facc15", border: "rgba(250,204,21,0.35)",  bg: "rgba(250,204,21,0.06)" },
  urgent:  { color: "#f87171", border: "rgba(248,113,113,0.35)", bg: "rgba(248,113,113,0.06)" },
  success: { color: "#4ade80", border: "rgba(74,222,128,0.35)",  bg: "rgba(74,222,128,0.06)" },
};

const CATEGORY_ICONS: Record<ScheduleEventCategory, string> = {
  opening: "🚀", closing: "🏁", meal: "🍽️", workshop: "🛠️",
  judging: "⚖️", submission: "📤", break: "☕", other: "📌",
};

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.2)",
  color: "#fff", fontFamily: "monospace", fontSize: "0.875rem",
  padding: "0.6rem 0.75rem", outline: "none",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontFamily: "monospace", fontSize: "0.63rem",
  letterSpacing: "0.14em", color: "rgba(255,255,255,0.3)", marginBottom: "0.5rem",
};
const btnBase: React.CSSProperties = {
  fontFamily: "monospace", fontSize: "0.75rem", letterSpacing: "0.06em",
  padding: "0.55rem 1rem", cursor: "pointer", border: "1px solid rgba(255,255,255,0.2)",
  background: "transparent", color: "rgba(255,255,255,0.6)", display: "inline-flex",
  alignItems: "center", gap: "0.5rem", transition: "all 0.15s",
};
const btnPrimary: React.CSSProperties = {
  fontFamily: "monospace", fontSize: "0.75rem", letterSpacing: "0.06em",
  padding: "0.55rem 1.25rem", cursor: "pointer", border: "none",
  background: "#fff", color: "#000", fontWeight: 700, display: "inline-flex",
  alignItems: "center", gap: "0.5rem", transition: "opacity 0.15s",
};

async function apiPost(action: string, payload: unknown) {
  const res = await fetch("/api/portal-config", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  if (!res.ok) throw new Error(await res.text());
}

// ─────────────────────────────────────────────
// Alert Modal
// ─────────────────────────────────────────────
function AlertModal({ existing, onClose, onSaved }: { existing?: PortalAlert; onClose: () => void; onSaved: () => void; }) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [message, setMessage] = useState(existing?.message ?? "");
  const [severity, setSeverity] = useState<AlertSeverity>(existing?.severity ?? "info");
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !message.trim()) return;
    setSaving(true);
    try {
      if (existing) await apiPost("update_alert", { alertId: existing.alertId, data: { title, message, severity, isActive } });
      else await apiPost("create_alert", { title, message, severity, isActive });
      onSaved(); onClose();
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: "1rem" }}>
      <div style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.12)", padding: "2rem", width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{ fontFamily: "monospace", fontSize: "0.63rem", letterSpacing: "0.14em", color: "rgba(255,255,255,0.3)" }}>{existing ? "EDIT ALERT" : "NEW ALERT"}</div>

        <div>
          <label style={labelStyle}>TITLE</label>
          <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="Alert title…"
            onFocus={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.45)"}
            onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"} />
        </div>
        <div>
          <label style={labelStyle}>MESSAGE</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} placeholder="Full message…"
            onFocus={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.45)"}
            onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={labelStyle}>SEVERITY</label>
            <div style={{ position: "relative" }}>
              <select value={severity} onChange={e => setSeverity(e.target.value as AlertSeverity)}
                style={{ ...inputStyle, background: "#0a0a0a", cursor: "pointer", paddingRight: "2rem", appearance: "none" }}>
                {(["info","warning","urgent","success"] as AlertSeverity[]).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </select>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" style={{ position: "absolute", right: "0.7rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
          <div>
            <label style={labelStyle}>VISIBILITY</label>
            <button onClick={() => setIsActive(!isActive)} style={{ ...btnBase, width: "100%", justifyContent: "center", ...(isActive ? { borderColor: "rgba(74,222,128,0.4)", color: "#4ade80", background: "rgba(74,222,128,0.07)" } : {}) }}>
              {isActive ? "● ACTIVE" : "○ HIDDEN"}
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnBase} onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"; e.currentTarget.style.color = "#fff"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}>CANCEL</button>
          <button onClick={handleSave} disabled={saving || !title.trim() || !message.trim()}
            style={{ ...btnPrimary, opacity: (saving || !title.trim() || !message.trim()) ? 0.4 : 1, cursor: (saving || !title.trim() || !message.trim()) ? "not-allowed" : "pointer" }}>
            {saving ? "SAVING…" : existing ? "UPDATE ALERT" : "CREATE ALERT"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Event Modal
// ─────────────────────────────────────────────
function EventModal({ existing, onClose, onSaved }: { existing?: ScheduleEvent; onClose: () => void; onSaved: () => void; }) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [day, setDay] = useState<1|2|3>(existing?.day ?? 1);
  const [startTime, setStartTime] = useState(existing?.startTime ? new Date(existing.startTime).toISOString().slice(0,16) : "");
  const [endTime, setEndTime] = useState(existing?.endTime ? new Date(existing.endTime).toISOString().slice(0,16) : "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [category, setCategory] = useState<ScheduleEventCategory>(existing?.category ?? "other");
  const [isPinned, setIsPinned] = useState(existing?.isPinned ?? false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !startTime) return;
    setSaving(true);
    try {
      const data = { title, description: description || undefined, day, startTime: new Date(startTime), endTime: endTime ? new Date(endTime) : undefined, location: location || undefined, category, isPinned };
      if (existing) await apiPost("update_event", { eventId: existing.eventId, data });
      else await apiPost("create_event", data);
      onSaved(); onClose();
    } finally { setSaving(false); }
  };

  const dtStyle: React.CSSProperties = { ...inputStyle, background: "#0a0a0a", fontSize: "0.8rem" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: "1rem" }}>
      <div style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.12)", padding: "2rem", width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: "1.25rem", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontFamily: "monospace", fontSize: "0.63rem", letterSpacing: "0.14em", color: "rgba(255,255,255,0.3)" }}>{existing ? "EDIT EVENT" : "NEW SCHEDULE EVENT"}</div>
        <div>
          <label style={labelStyle}>TITLE</label>
          <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="Event title…"
            onFocus={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.45)"}
            onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"} />
        </div>
        <div>
          <label style={labelStyle}>DESCRIPTION (OPTIONAL)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }}
            onFocus={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.45)"}
            onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={labelStyle}>DAY</label>
            <div style={{ position: "relative" }}>
              <select value={day} onChange={e => setDay(Number(e.target.value) as 1|2|3)} style={{ ...inputStyle, background: "#0a0a0a", cursor: "pointer", paddingRight: "2rem", appearance: "none" }}>
                <option value={1}>Day 1</option><option value={2}>Day 2</option><option value={3}>Day 3</option>
              </select>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" style={{ position: "absolute", right: "0.7rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
          <div>
            <label style={labelStyle}>START TIME</label>
            <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} style={dtStyle}
              onFocus={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.45)"}
              onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"} />
          </div>
          <div>
            <label style={labelStyle}>END TIME</label>
            <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} style={dtStyle}
              onFocus={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.45)"}
              onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={labelStyle}>LOCATION</label>
            <input value={location} onChange={e => setLocation(e.target.value)} style={inputStyle} placeholder="Room / venue…"
              onFocus={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.45)"}
              onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"} />
          </div>
          <div>
            <label style={labelStyle}>CATEGORY</label>
            <div style={{ position: "relative" }}>
              <select value={category} onChange={e => setCategory(e.target.value as ScheduleEventCategory)} style={{ ...inputStyle, background: "#0a0a0a", cursor: "pointer", paddingRight: "2rem", appearance: "none" }}>
                {Object.entries(CATEGORY_ICONS).map(([cat, icon]) => <option key={cat} value={cat}>{icon} {cat.charAt(0).toUpperCase()+cat.slice(1)}</option>)}
              </select>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" style={{ position: "absolute", right: "0.7rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", fontFamily: "monospace", fontSize: "0.78rem", color: "rgba(255,255,255,0.55)" }}>
          <input type="checkbox" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#fff" }} />
          Pin to top of schedule
        </label>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnBase} onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"; e.currentTarget.style.color = "#fff"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}>CANCEL</button>
          <button onClick={handleSave} disabled={saving || !title.trim() || !startTime}
            style={{ ...btnPrimary, opacity: (saving || !title.trim() || !startTime) ? 0.4 : 1, cursor: (saving || !title.trim() || !startTime) ? "not-allowed" : "pointer" }}>
            {saving ? "SAVING…" : existing ? "UPDATE EVENT" : "CREATE EVENT"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab: Alerts
// ─────────────────────────────────────────────
function AlertsTab({ config, onRefresh }: { config: ParticipantPortalConfig; onRefresh: () => void }) {
  const [modal, setModal] = useState<{ open: boolean; existing?: PortalAlert }>({ open: false });

  const handleDelete = async (alertId: string) => {
    if (!confirm("Delete this alert?")) return;
    await apiPost("delete_alert", { alertId }); onRefresh();
  };
  const handleToggle = async (alertId: string, isActive: boolean) => {
    await apiPost("toggle_alert", { alertId, isActive: !isActive }); onRefresh();
  };

  return (
    <div>
      {modal.open && <AlertModal existing={modal.existing} onClose={() => setModal({ open: false })} onSaved={onRefresh} />}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <p style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "rgba(255,255,255,0.38)", margin: 0 }}>
          Alerts shown to participants in the portal. Active alerts appear immediately.
        </p>
        <button onClick={() => setModal({ open: true })} style={{ ...btnPrimary }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
          + NEW ALERT
        </button>
      </div>

      {config.alerts.length === 0 ? (
        <div style={{ padding: "4rem", textAlign: "center", fontFamily: "monospace", fontSize: "0.875rem", color: "rgba(255,255,255,0.2)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📢</div>
          No alerts yet. Create one to notify participants.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[...config.alerts].reverse().map(alert => {
            const sc = SEVERITY_CONFIG[alert.severity];
            return (
              <div key={alert.alertId} style={{ border: `1px solid ${sc.border}`, background: sc.bg, padding: "1.25rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.35rem" }}>
                      <span style={{ fontFamily: "monospace", fontSize: "0.65rem", letterSpacing: "0.12em", fontWeight: 700, color: sc.color }}>
                        {alert.severity.toUpperCase()}
                      </span>
                      {!alert.isActive && (
                        <span style={{ fontFamily: "monospace", fontSize: "0.62rem", padding: "0.1rem 0.5rem", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em" }}>HIDDEN</span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.35rem" }}>{alert.title}</div>
                    <div style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.55 }}>{alert.message}</div>
                    <div style={{ fontFamily: "monospace", fontSize: "0.65rem", color: "rgba(255,255,255,0.22)", marginTop: "0.5rem" }}>
                      {new Date(alert.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                    <button onClick={() => handleToggle(alert.alertId, alert.isActive)} style={{ ...btnBase, padding: "0.4rem 0.75rem", ...(alert.isActive ? { borderColor: "rgba(74,222,128,0.4)", color: "#4ade80" } : {}) }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"; e.currentTarget.style.color = "#fff"; }}
                      onMouseLeave={e => { if (!alert.isActive) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; } else { e.currentTarget.style.borderColor = "rgba(74,222,128,0.4)"; e.currentTarget.style.color = "#4ade80"; } }}>
                      {alert.isActive ? "HIDE" : "SHOW"}
                    </button>
                    <button onClick={() => setModal({ open: true, existing: alert })} style={{ ...btnBase, padding: "0.4rem 0.75rem" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"; e.currentTarget.style.color = "#fff"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}>
                      EDIT
                    </button>
                    <button onClick={() => handleDelete(alert.alertId)} style={{ ...btnBase, padding: "0.4rem 0.6rem", borderColor: "rgba(248,113,113,0.25)", color: "rgba(248,113,113,0.55)" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(248,113,113,0.1)"; e.currentTarget.style.color = "#f87171"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(248,113,113,0.55)"; }}>
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab: Schedule
// ─────────────────────────────────────────────
function ScheduleTab({ config, onRefresh }: { config: ParticipantPortalConfig; onRefresh: () => void }) {
  const [modal, setModal] = useState<{ open: boolean; existing?: ScheduleEvent }>({ open: false });

  const handleDelete = async (eventId: string) => {
    if (!confirm("Delete this event?")) return;
    await apiPost("delete_event", { eventId }); onRefresh();
  };

  const byDay = [1, 2, 3].map(d => ({
    day: d,
    events: config.schedule.filter(e => e.day === d).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
  }));

  return (
    <div>
      {modal.open && <EventModal existing={modal.existing} onClose={() => setModal({ open: false })} onSaved={onRefresh} />}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <p style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "rgba(255,255,255,0.38)", margin: 0 }}>
          Build the 3-day schedule. Events are shown to participants sorted by time.
        </p>
        <button onClick={() => setModal({ open: true })} style={{ ...btnPrimary }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
          + NEW EVENT
        </button>
      </div>

      {config.schedule.length === 0 ? (
        <div style={{ padding: "4rem", textAlign: "center", fontFamily: "monospace", fontSize: "0.875rem", color: "rgba(255,255,255,0.2)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📅</div>
          No events scheduled yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {byDay.map(({ day, events }) => (
            <div key={day}>
              <div style={{ fontFamily: "monospace", fontSize: "0.63rem", letterSpacing: "0.14em", color: "rgba(255,255,255,0.3)", marginBottom: "0.75rem" }}>
                DAY {day} <span style={{ color: "rgba(255,255,255,0.2)" }}>({events.length} events)</span>
              </div>
              {events.length === 0 ? (
                <div style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "rgba(255,255,255,0.2)", padding: "0.5rem 0" }}>No events on this day.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {events.map(event => (
                    <div key={event.eventId} style={{ border: "1px solid rgba(255,255,255,0.1)", padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", transition: "border-color 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}>
                      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{CATEGORY_ICONS[event.category]}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                            <span style={{ fontFamily: "monospace", fontSize: "0.875rem", fontWeight: 700 }}>{event.title}</span>
                            {event.isPinned && <span style={{ fontFamily: "monospace", fontSize: "0.62rem", color: "#facc15" }}>📌 PINNED</span>}
                          </div>
                          <div style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", marginTop: "0.2rem" }}>
                            {new Date(event.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            {event.endTime && ` → ${new Date(event.endTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
                            {event.location && ` · ${event.location}`}
                          </div>
                          {event.description && <div style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "rgba(255,255,255,0.28)", marginTop: "0.15rem" }}>{event.description}</div>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                        <button onClick={() => setModal({ open: true, existing: event })} style={{ ...btnBase, padding: "0.35rem 0.75rem" }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"; e.currentTarget.style.color = "#fff"; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}>
                          EDIT
                        </button>
                        <button onClick={() => handleDelete(event.eventId)} style={{ ...btnBase, padding: "0.35rem 0.6rem", borderColor: "rgba(248,113,113,0.25)", color: "rgba(248,113,113,0.55)" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(248,113,113,0.1)"; e.currentTarget.style.color = "#f87171"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(248,113,113,0.55)"; }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab: Meal Windows
// ─────────────────────────────────────────────
function MealTab({ config, onRefresh }: { config: ParticipantPortalConfig; onRefresh: () => void }) {
  const [windows, setWindows] = useState<Record<keyof MealStatus, { opensAt: string; closesAt: string; isEnabled: boolean }>>(() => {
    const r = {} as Record<keyof MealStatus, { opensAt: string; closesAt: string; isEnabled: boolean }>;
    for (const key of MEAL_KEYS) {
      const ex = config.mealSchedule.find(m => m.mealKey === key);
      r[key] = {
        opensAt:   ex?.opensAt  ? new Date(ex.opensAt).toISOString().slice(0,16)  : "",
        closesAt:  ex?.closesAt ? new Date(ex.closesAt).toISOString().slice(0,16) : "",
        isEnabled: ex?.isEnabled ?? false,
      };
    }
    return r;
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const mealSchedule: MealTimeConfig[] = MEAL_KEYS.map(key => ({
        mealKey: key,
        opensAt:  windows[key].opensAt  ? new Date(windows[key].opensAt)  : new Date(),
        closesAt: windows[key].closesAt ? new Date(windows[key].closesAt) : new Date(),
        isEnabled: windows[key].isEnabled,
      }));
      await apiPost("update_meal_schedule", { mealSchedule });
      setSaved(true); onRefresh();
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const update = (key: keyof MealStatus, field: "opensAt" | "closesAt" | "isEnabled", value: string | boolean) => {
    setWindows(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const now = new Date();
  const dtStyle: React.CSSProperties = { ...inputStyle, background: "#0a0a0a", fontSize: "0.8rem" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <p style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "rgba(255,255,255,0.38)", margin: 0 }}>
          Set when each meal token becomes claimable in the participant portal.
        </p>
        <button onClick={handleSave} disabled={saving}
          style={{ ...btnPrimary, background: saved ? "rgba(74,222,128,0.15)" : "#fff", color: saved ? "#4ade80" : "#000", border: saved ? "1px solid rgba(74,222,128,0.4)" : "none", opacity: saving ? 0.5 : 1 }}
          onMouseEnter={e => { if (!saved) e.currentTarget.style.opacity = "0.85"; }}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
          {saved ? "✓ SAVED" : saving ? "SAVING…" : "SAVE ALL WINDOWS"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {MEAL_KEYS.map(key => {
          const w = windows[key];
          const isOpen = w.isEnabled && w.opensAt && w.closesAt && now >= new Date(w.opensAt) && now <= new Date(w.closesAt);
          return (
            <div key={key} style={{ border: `1px solid ${w.isEnabled ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)"}`, padding: "1.25rem", opacity: w.isEnabled ? 1 : 0.55, transition: "all 0.2s" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ fontFamily: "monospace", fontSize: "0.875rem", fontWeight: 700 }}>{MEAL_LABELS[key].toUpperCase()}</span>
                  {isOpen && <span style={{ fontFamily: "monospace", fontSize: "0.62rem", padding: "0.15rem 0.55rem", border: "1px solid rgba(74,222,128,0.4)", color: "#4ade80", background: "rgba(74,222,128,0.07)", letterSpacing: "0.09em" }}>● OPEN NOW</span>}
                </div>
                {/* Toggle */}
                <div onClick={() => update(key, "isEnabled", !w.isEnabled)} style={{ width: 44, height: 24, borderRadius: 12, position: "relative", cursor: "pointer", background: w.isEnabled ? "rgba(74,222,128,0.9)" : "rgba(255,255,255,0.15)", transition: "background 0.2s", flexShrink: 0 }}>
                  <div style={{ width: 18, height: 18, background: "#fff", borderRadius: "50%", position: "absolute", top: 3, left: w.isEnabled ? 23 : 3, transition: "left 0.2s" }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={labelStyle}>OPENS AT</label>
                  <input type="datetime-local" value={w.opensAt} onChange={e => update(key, "opensAt", e.target.value)} disabled={!w.isEnabled} style={{ ...dtStyle, opacity: w.isEnabled ? 1 : 0.4 }}
                    onFocus={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.45)"}
                    onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"} />
                </div>
                <div>
                  <label style={labelStyle}>CLOSES AT</label>
                  <input type="datetime-local" value={w.closesAt} onChange={e => update(key, "closesAt", e.target.value)} disabled={!w.isEnabled} style={{ ...dtStyle, opacity: w.isEnabled ? 1 : 0.4 }}
                    onFocus={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.45)"}
                    onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
type Tab = "alerts" | "schedule" | "meals";

export default function PortalConfigPage() {
  const [config, setConfig] = useState<ParticipantPortalConfig | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("alerts");
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    const res = await fetch("/api/portal-config");
    if (res.ok) setConfig(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "alerts",   label: "ALERTS",       count: config?.alerts.length },
    { id: "schedule", label: "SCHEDULE",      count: config?.schedule.length },
    { id: "meals",    label: "MEAL WINDOWS" },
  ];

  return (
    <>
      <style>{`
        .pc-page { padding: 3rem; }
        @media (max-width: 900px) { .pc-page { padding: 1.25rem; padding-top: calc(60px + 1.25rem); } }
        .pc-tab-btn { font-family: monospace; font-size: 0.75rem; letter-spacing: 0.1em; padding: 0.75rem 1.25rem; cursor: pointer; border: none; border-bottom: 2px solid transparent; background: transparent; color: rgba(255,255,255,0.38); transition: all 0.15s; }
        .pc-tab-btn:hover { color: rgba(255,255,255,0.7); }
        .pc-tab-btn.active { color: #fff; border-bottom-color: #fff; }
        .pc-count { font-family: monospace; font-size: 0.6rem; padding: 0.1rem 0.45rem; margin-left: 0.5rem; border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.35); }
        .pc-count.active { border-color: rgba(255,255,255,0.3); color: rgba(255,255,255,0.7); }
      `}</style>

      <div className="pc-page">
        {/* Header */}
        <div style={{ marginBottom: "3rem" }}>
          <h1 style={{ fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 900, letterSpacing: "-0.05em", marginBottom: "0.3rem" }}>
            PORTAL CONFIG
          </h1>
          <p style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "rgba(255,255,255,0.35)" }}>
            Everything here is visible to participants in the portal in real-time.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: "2rem", display: "flex" }}>
          {TABS.map(tab => (
            <button key={tab.id} className={`pc-tab-btn ${activeTab === tab.id ? "active" : ""}`} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
              {tab.count !== undefined && (
                <span className={`pc-count ${activeTab === tab.id ? "active" : ""}`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading || !config ? (
          <div style={{ padding: "4rem", textAlign: "center", fontFamily: "monospace", color: "rgba(255,255,255,0.3)" }}>Loading config…</div>
        ) : (
          <>
            {activeTab === "alerts"   && <AlertsTab   config={config} onRefresh={fetchConfig} />}
            {activeTab === "schedule" && <ScheduleTab config={config} onRefresh={fetchConfig} />}
            {activeTab === "meals"    && <MealTab     config={config} onRefresh={fetchConfig} />}
          </>
        )}
      </div>
    </>
  );
}