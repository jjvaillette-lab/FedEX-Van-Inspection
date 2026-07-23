// Shared data types for the van inspection module.

export type TripType = "pre" | "post";

/** How a question is answered in the driver app. */
export type QuestionInput = "check" | "yesno" | "number" | "text";

/** An owner-configurable inspection question. */
export interface QuestionDef {
  id: string;
  label: string;
  category: string;
  hint?: string;
  /** Which trip the question appears on. */
  trip: TripType | "both";
  input: QuestionInput;
  /** DOT-specific questions are hidden by default when a company runs Non-DOT mode. */
  dotSpecific: boolean;
  /** Owner "hide question" toggle — disabled questions never reach drivers. */
  enabled: boolean;
  sortOrder: number;
}

export interface InspectionSettings {
  /** DOT mode on = DOT-specific questions included for drivers. */
  dotMode: boolean;
  /** Adds the 3 interior photos to post-trips (off by default). */
  interiorPhotos: boolean;
  /**
   * Daily post-trip cutoff ("HH:MM", 24h). A pre-trip whose day passes this
   * time with no post-trip is reported as "Post trip not done". Always set;
   * defaults to 23:59.
   */
  postCutoff: string;
}

export interface Driver {
  /** Raw string decoded from the FedEx driver barcode. */
  raw: string;
  name?: string;
  route?: string;
}

export interface AnswerRecord {
  questionId: string;
  /** "ok" | "issue" | "yes" | "no" | free text | number-as-string. */
  value: string;
  /** Optional detail the driver adds when flagging an issue. */
  note?: string;
}

export type PhotoSlot =
  | "driver_side"
  | "back"
  | "passenger_side"
  | "front"
  | "interior_cabin"
  | "interior_cargo"
  | "fuel_gauge"
  | "optional_1"
  | "optional_2"
  | "optional_3"
  | "optional_4"
  /** Driver's electronic signature on the DVIR (PNG from the signature pad). */
  | "signature";

export interface InspectionPhoto {
  slot: PhotoSlot;
  /** Data URL in local fallback; Supabase Storage URL in production. */
  url: string;
  /** Driver's description — used for the optional report photos. */
  description?: string;
}

export type InspectionStatus =
  | "passed"
  | "flagged" // issues reported → van reported to management
  | "failed_inspection"; // incomplete (missing photos/answers) or explicitly ended

/** Manager/owner resolution of a flagged or failed inspection. */
export interface Resolution {
  note: string;
  resolvedBy: string;
  resolvedAt: string; // ISO
  receiptUrl?: string;
}

/**
 * Office comments on an inspection. Driver-submitted content is immutable;
 * these are appended alongside it. `disagreement` marks that the office
 * disputes the driver's report — both records remain visible and searchable.
 */
export interface InspectionComment {
  text: string;
  by: string;
  role: "owner" | "manager";
  at: string; // ISO
  disagreement?: boolean;
}

export interface Inspection {
  id: string;
  createdAt: string; // ISO
  driver: Driver;
  vanId: string;
  tripType: TripType;
  /** 1 = first pre/post cycle of the day; 2+ = re-inspection the same day. */
  cycle: number;
  answers: AnswerRecord[];
  photos: InspectionPhoto[];
  hasIssues: boolean;
  status: InspectionStatus;
  resolution?: Resolution | null;
  comments: InspectionComment[];
}
