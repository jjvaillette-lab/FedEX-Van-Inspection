// Shared data types for the van inspection app.

export type AnswerValue = "ok" | "issue";

export interface Driver {
  /** Raw string decoded from the FedEx driver barcode. */
  raw: string;
  /** Best-effort parsed name (refined once we have a real FedEx sample). */
  name?: string;
  /** Best-effort parsed route id. */
  route?: string;
}

export interface Van {
  /** Stable id encoded in the van QR code, e.g. "VAN-014". */
  id: string;
  /** Human label, e.g. "Van 14 – White Sprinter". */
  label: string;
}

export interface AnswerRecord {
  questionId: string;
  value: AnswerValue;
  /** Optional note the driver adds when flagging an issue. */
  note?: string;
}

export interface InspectionPhoto {
  /** Which of the 4 guided shots this is. */
  slot: PhotoSlot;
  /** Data URL (base64) in the local-storage prototype; a Supabase URL in prod. */
  url: string;
}

export type PhotoSlot = "driver_side" | "back" | "passenger_side" | "front";

export interface Inspection {
  id: string;
  createdAt: string; // ISO timestamp
  driver: Driver;
  vanId: string;
  answers: AnswerRecord[];
  photos: InspectionPhoto[];
  /** True if any answer was flagged as an issue. */
  hasIssues: boolean;
  status: "submitted" | "reported_to_management";
}
