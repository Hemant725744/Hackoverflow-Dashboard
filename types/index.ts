/**
 * Shared Type Definitions
 *
 * Centralized types used across mailer, ID card generator,
 * and dashboard modules.
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