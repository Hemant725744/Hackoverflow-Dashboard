/**
 * Shared Type Definitions
 *
 * Centralized types used across mailer, ID card generator,
 * dashboard, admin panel, and participant portal modules.
 *
 * @module types
 */

// ===================================
// MEAL TRACKING
// ===================================

/**
 * Tracks meal consumption across the 3-day hackathon.
 *
 * Schedule:
 *   Day 1 → Dinner
 *   Day 2 → Breakfast, Lunch, Dinner
 *   Day 3 → Breakfast, Lunch
 */
export interface MealStatus {
  day1_dinner: boolean;
  day2_breakfast: boolean;
  day2_lunch: boolean;
  day2_dinner: boolean;
  day3_breakfast: boolean;
  day3_lunch: boolean;
}

/** Default meal status — all false on participant creation */
export const DEFAULT_MEAL_STATUS: MealStatus = {
  day1_dinner: false,
  day2_breakfast: false,
  day2_lunch: false,
  day2_dinner: false,
  day3_breakfast: false,
  day3_lunch: false,
};

/** Human-readable labels for each meal slot */
export const MEAL_LABELS: Record<keyof MealStatus, string> = {
  day1_dinner: "Day 1 – Dinner",
  day2_breakfast: "Day 2 – Breakfast",
  day2_lunch: "Day 2 – Lunch",
  day2_dinner: "Day 2 – Dinner",
  day3_breakfast: "Day 3 – Breakfast",
  day3_lunch: "Day 3 – Lunch",
};

/** Returns how many meals a participant has collected */
export function countMealsTaken(meals: MealStatus): number {
  return Object.values(meals).filter(Boolean).length;
}

// ===================================
// MEAL TIME CONFIG (Admin-controlled)
// ===================================

/**
 * Admin sets the exact open/close time for each meal window.
 * The participant portal token button activates only within this window.
 * Stored in the `participant_portal` collection.
 */
export interface MealTimeConfig {
  /** Which meal slot this config applies to */
  mealKey: keyof MealStatus;

  /** ISO timestamp — when the meal window opens (token becomes claimable) */
  opensAt: Date;

  /** ISO timestamp — when the meal window closes (token can no longer be claimed) */
  closesAt: Date;

  /** Whether this meal window is manually enabled by admin (overrides time check) */
  isEnabled: boolean;
}

/** Full meal schedule — one entry per meal slot */
export type MealScheduleConfig = MealTimeConfig[];

// ===================================
// PARTICIPANT PORTAL — ALERTS
// ===================================

/** Severity level of a portal alert */
export type AlertSeverity = "info" | "warning" | "urgent" | "success";

/**
 * Alert created by admin, visible in the participant portal.
 * Stored in the `participant_portal` collection under `alerts`.
 */
export interface PortalAlert {
  _id?: string;
  alertId: string;

  /** Short title shown in the alert banner */
  title: string;

  /** Full alert body / message */
  message: string;

  severity: AlertSeverity;

  /** Whether the alert is currently shown to participants */
  isActive: boolean;

  /** Admin who created/last updated the alert */
  createdBy?: string;

  createdAt: Date;
  updatedAt?: Date;
}

// ===================================
// PARTICIPANT PORTAL — SCHEDULE
// ===================================

/** Category tag for a schedule event */
export type ScheduleEventCategory =
  | "opening"
  | "closing"
  | "meal"
  | "workshop"
  | "judging"
  | "submission"
  | "break"
  | "other";

/**
 * A single event in the hackathon schedule.
 * Admin can add/edit/delete; participants can only view.
 * Stored in the `participant_portal` collection under `schedule`.
 */
export interface ScheduleEvent {
  _id?: string;
  eventId: string;

  /** Display title of the event */
  title: string;

  /** Optional description or notes */
  description?: string;

  /** Day number (1, 2, or 3) */
  day: 1 | 2 | 3;

  /** Display label, e.g. "Day 1 – Friday" */
  dayLabel?: string;

  /** Start time — ISO timestamp */
  startTime: Date;

  /** End time — ISO timestamp (optional for point-in-time events) */
  endTime?: Date;

  /** Venue / room / location for this event */
  location?: string;

  category: ScheduleEventCategory;

  /** Whether this event is pinned to the top of the schedule */
  isPinned?: boolean;

  /** Admin who created this entry */
  createdBy?: string;

  createdAt: Date;
  updatedAt?: Date;
}

// ===================================
// PARTICIPANT PORTAL — TOP-LEVEL DOC
// ===================================

/**
 * The single document stored in the `participant_portal` collection.
 * Admin panel writes to it; participant portal reads from it.
 */
export interface ParticipantPortalConfig {
  _id?: string;

  /** All active and past alerts */
  alerts: PortalAlert[];

  /** Full hackathon schedule */
  schedule: ScheduleEvent[];

  /** Meal time windows configured by admin */
  mealSchedule: MealScheduleConfig;

  updatedAt?: Date;
}

// ===================================
// LAB OTP
// ===================================

/**
 * Rotating 4-digit OTP for lab check-in.
 *
 * - Generated fresh every 30 seconds by a server-side cron/job.
 * - Displayed on the Lab Monitoring page (volunteer/admin view only).
 * - Participant must enter the current OTP to check into the lab.
 * - Stored in the `lab_otp` collection (single document, overwritten each cycle).
 */
export interface LabOTP {
  _id?: string;

  /** 4-digit numeric code, stored as a zero-padded string e.g. "0472" */
  code: string;

  /** When this OTP was generated */
  generatedAt: Date;

  /** When this OTP expires — generatedAt + 30 seconds */
  expiresAt: Date;
}

/** Checks whether a given OTP is still within its validity window */
export function isOTPValid(otp: LabOTP): boolean {
  return new Date() < new Date(otp.expiresAt);
}

/** Generates a random 4-digit OTP string (zero-padded) */
export function generateOTPCode(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

// ===================================
// VOLUNTEER
// ===================================

/** Role a volunteer is assigned to during the hackathon */
export type VolunteerRole =
  | "lab_monitor"
  | "meal_counter"
  | "college_gate"
  | "registration"
  | "general";

/**
 * Volunteer profile — stored in the `volunteers` collection.
 * Volunteers log in to the admin panel with limited access.
 */
export interface DBVolunteer {
  _id?: string;
  volunteerId: string;

  name: string;
  email: string;
  phone?: string;

  /** Assigned role for this event */
  role: VolunteerRole;

  /** Which lab/station they are currently assigned to */
  assignedStation?: string;

  /** Login password (hashed) */
  loginPassword?: string;

  /** Whether this volunteer account is currently active */
  isActive: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

// ===================================
// VOLUNTEER SESSION (Active duty)
// ===================================

/**
 * Tracks a volunteer's active monitoring session.
 * Created when a volunteer opens the Lab Monitoring page and enters their name.
 * Stored in the `volunteer_sessions` collection.
 */
export interface VolunteerSession {
  _id?: string;
  sessionId: string;

  /** Reference to the volunteer's ID */
  volunteerId: string;
  volunteerName: string;

  /** Which station/lab they are currently monitoring */
  station: string;

  /** When they started this session */
  startedAt: Date;

  /** When they ended this session (null if still active) */
  endedAt?: Date;

  /** Whether this session is currently active */
  isActive: boolean;
}

// ===================================
// CHECK-IN / CHECK-OUT RECORDS
// ===================================

/** The type of check-in or check-out action */
export type CheckActionType =
  | "college_checkin"
  | "college_checkout"
  | "lab_checkin"
  | "lab_checkout"
  | "temp_lab_checkout"   // Temporary exit (triggers alert if > 10 min)
  | "temp_lab_checkin";   // Return from temporary exit

/**
 * Immutable log entry created every time a check action happens.
 * Stored in the `checkin_logs` collection.
 * Used for audit trail and volunteer stats dashboard.
 */
export interface CheckInLog {
  _id?: string;
  logId: string;

  /** The participant this action applies to */
  participantId: string;
  participantName: string;

  actionType: CheckActionType;

  /** Timestamp of this action */
  timestamp: Date;

  /** Volunteer who performed this action (if any) */
  processedBy?: {
    volunteerId: string;
    volunteerName: string;
    station: string;
  };

  /** OTP entered by participant for lab check-in (stored for audit) */
  otpUsed?: string;

  /** Whether OTP was valid at time of check-in */
  otpValid?: boolean;

  /** Any notes added by the volunteer */
  notes?: string;
}

// ===================================
// TEMP LAB EXIT ALERT
// ===================================

/**
 * Alert triggered when a participant has been on a temp lab checkout
 * for more than 10 minutes without returning.
 * Stored in the `temp_exit_alerts` collection.
 */
export interface TempExitAlert {
  _id?: string;
  alertId: string;

  participantId: string;
  participantName: string;

  /** When the temporary exit was recorded */
  exitTime: Date;

  /** Whether this alert has been acknowledged by a volunteer */
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;

  /** Whether the participant has returned (alert auto-resolved) */
  resolved: boolean;
  resolvedAt?: Date;
}

// ===================================
// LAB MONITORING — REAL-TIME VIEW
// ===================================

/**
 * Computed snapshot of a single participant's current location status.
 * Derived from DBParticipant fields — used for the Lab Monitoring page display.
 * Not stored in DB; computed on-the-fly or via aggregation.
 */
export interface ParticipantLocationSnapshot {
  participantId: string;
  name: string;
  teamName?: string;
  teamId?: string;
  labAllotted?: string;

  /** Has the participant checked into the college at all? */
  isInsideCollege: boolean;

  /** Is the participant currently inside the lab? */
  isInsideLab: boolean;

  /** Has the participant done a temporary lab exit and not yet returned? */
  isOnTempExit: boolean;

  /** Minutes since temp exit (if isOnTempExit is true) */
  tempExitMinutes?: number;

  /** Has the participant permanently checked out of the college? */
  hasCheckedOut: boolean;

  /** Timestamp of the last status change */
  lastUpdated?: Date;
}

/** Summary counts for the Lab Monitoring dashboard header */
export interface LabMonitoringSummary {
  totalParticipants: number;
  insideLab: number;
  onTempExit: number;
  outsideCollege: number;
  checkedOut: number;

  /** Participants on temp exit > 10 minutes (show alert) */
  overdueExits: number;
}

// ===================================
// VOLUNTEER STATS
// ===================================

/**
 * Aggregated stats for a single volunteer.
 * Used in the Admin Stats page to see which volunteer processed what.
 */
export interface VolunteerStats {
  volunteerId: string;
  volunteerName: string;
  role: VolunteerRole;
  assignedStation: string;

  /** Total check-in actions processed */
  totalActions: number;

  /** Breakdown by action type */
  actionBreakdown: Partial<Record<CheckActionType, number>>;

  /** Active session info (null if not currently on duty) */
  currentSession?: Pick<VolunteerSession, "sessionId" | "station" | "startedAt">;

  /** Total hours on duty across all sessions */
  totalDutyMinutes: number;
}

/**
 * Top-level stats document for the admin stats dashboard.
 * Computed from `checkin_logs` and `volunteer_sessions`.
 */
export interface EventStats {
  /** Snapshot timestamp */
  asOf: Date;

  // ── Participant Counts ─────────────────────────────────
  totalRegistered: number;
  totalCheckedInCollege: number;
  totalInsideLab: number;
  totalOnTempExit: number;
  totalCheckedOut: number;

  // ── Meal Stats ─────────────────────────────────────────
  mealStats: Record<keyof MealStatus, number>; // count of participants who collected each meal

  // ── Volunteer Stats ────────────────────────────────────
  activeVolunteers: number;
  volunteerStats: VolunteerStats[];

  // ── Check-in Timeline ─────────────────────────────────
  /** Hourly check-in counts for timeline chart */
  checkinTimeline: Array<{
    hour: string; // e.g. "09:00"
    count: number;
  }>;
}

// ===================================
// BASE PARTICIPANT (CSV import)
// ===================================

/** Base participant data from CSV import */
export interface Participant {
  readonly name: string;
  readonly email: string;
  readonly role?: string;
  readonly company?: string;
  readonly phone?: string;
}

// ===================================
// DATABASE PARTICIPANT
// ===================================

/** Database participant with all hackathon details */
export interface DBParticipant {
  _id?: string;
  participantId: string;

  // ── Basic Info ─────────────────────────────────────────
  name: string;
  email: string;
  phone?: string;
  role?: string;

  // ── Team ──────────────────────────────────────────────
  teamName?: string;
  /** Unique team identifier, e.g. "TEAM-001". Stable even if teamName changes. */
  teamId?: string;

  // ── Project ───────────────────────────────────────────
  projectName?: string;
  projectDescription?: string;

  // ── Venue ─────────────────────────────────────────────
  institute?: string;
  /** State / province the participant's institute is located in */
  state?: string;
  labAllotted?: string;

  wifiCredentials?: {
    ssid?: string;
    password?: string;
  };

  // ── Check-in / Check-out ──────────────────────────────
  collegeCheckIn?: {
    status: boolean;
    time?: Date;
  };

  labCheckIn?: {
    status: boolean;
    time?: Date;
    /** OTP that was used for this check-in */
    otpUsed?: string;
    /** Volunteer who processed this */
    processedBy?: string;
  };

  /** Permanent checkout from the college/event */
  collegeCheckOut?: {
    status: boolean;
    time?: Date;
  };

  /** Permanent lab checkout */
  labCheckOut?: {
    status: boolean;
    time?: Date;
  };

  /** Temporary exit from the lab (tracked for alerts if > 10 min) */
  tempLabCheckOut?: {
    status: boolean;
    time?: Date;
  };

  // ── Meals ─────────────────────────────────────────────
  /** Meal collection status across all 3 days */
  meals?: MealStatus;

  // ── Authentication ──────────────────────────────────
  loginPassword?: string;

  // ── Metadata ──────────────────────────────────────────
  createdAt?: Date;
  updatedAt?: Date;
}

// ===================================
// UI TYPES
// ===================================

/** Participant with selection state for UI lists */
export interface SelectableParticipant extends Participant {
  selected: boolean;
}

// ===================================
// ID CARD
// ===================================

/** ID card data with generated fields */
export interface IDCardData {
  readonly name: string;
  readonly email: string;
  readonly role: string;
  readonly company: string;
  readonly phone: string;
  readonly participantId: string;
  readonly qrCodeDataURL: string;

  /** Optional team identifier shown on the card (e.g. "TEAM-001") */
  readonly teamId?: string;
}

/** Hackathon event metadata for ID cards */
export interface HackathonInfo {
  readonly name: string;
  readonly date: string;
  readonly venue: string;
}

// ===================================
// EMAIL
// ===================================

/** Result from batch email sending */
export interface EmailResult {
  readonly success: boolean;
  readonly sent: number;
  readonly failed: number;
  readonly error?: string;
}

/** Email send request payload */
export interface SendEmailRequest {
  readonly subject: string;
  readonly htmlContent: string;
  readonly recipients: Participant[];
}

// ===================================
// SPONSOR
// ===================================

/** Database sponsor with company details */
export interface DBSponsor {
  _id?: string;
  sponsorId: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  companyName: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ===================================
// DB COLLECTION NAMES (constants)
// ===================================

/** Canonical MongoDB collection names — use these everywhere to avoid typos */
export const COLLECTIONS = {
  PARTICIPANTS: "participants",
  SPONSORS: "sponsors",
  VOLUNTEERS: "volunteers",
  VOLUNTEER_SESSIONS: "volunteer_sessions",
  CHECKIN_LOGS: "checkin_logs",
  TEMP_EXIT_ALERTS: "temp_exit_alerts",
  LAB_OTP: "lab_otp",
  PARTICIPANT_PORTAL: "participant_portal",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];