import type { PhotoSlot, QuestionDef } from "./types";

/**
 * Default question set. Owners edit/hide/add questions in the portal
 * (Fleet › Checklist); those live in the `questions` table and override these.
 * These defaults are used to seed the table and as a fallback when the
 * database isn't migrated yet — the driver app always has a working checklist.
 */
export const DEFAULT_QUESTIONS: QuestionDef[] = [
  // ---- Pre-trip safety checklist ----
  { id: "mileage_begin", label: "Enter beginning mileage", category: "Mileage", trip: "pre", input: "number", dotSpecific: false, enabled: true, sortOrder: 5 },
  { id: "tires", label: "Tires have good tread and proper inflation (no cuts, bulges, or flats)", hint: "Check all tires including inner duals", category: "Tires & Wheels", trip: "pre", input: "check", dotSpecific: false, enabled: true, sortOrder: 10 },
  { id: "wheels", label: "Wheels and rims are undamaged; lug nuts tight", hint: "Look for missing lugs or rust streaks", category: "Tires & Wheels", trip: "pre", input: "check", dotSpecific: false, enabled: true, sortOrder: 20 },
  { id: "brakes", label: "Service brakes and parking brake work properly", hint: "No pulling, grinding, or soft pedal", category: "Brakes", trip: "pre", input: "check", dotSpecific: false, enabled: true, sortOrder: 30 },
  { id: "lights_head", label: "Headlights and high beams work", category: "Lights", trip: "pre", input: "check", dotSpecific: false, enabled: true, sortOrder: 40 },
  { id: "lights_signals", label: "Turn signals, brake lights, tail lights and hazards work", hint: "Walk around and confirm each", category: "Lights", trip: "pre", input: "check", dotSpecific: false, enabled: true, sortOrder: 50 },
  { id: "reflectors", label: "Reflectors and marker lights are present and clean", category: "Lights", trip: "pre", input: "check", dotSpecific: true, enabled: true, sortOrder: 60 },
  { id: "mirrors", label: "Mirrors are clean, adjusted, and undamaged", category: "Visibility", trip: "pre", input: "check", dotSpecific: false, enabled: true, sortOrder: 70 },
  { id: "windshield", label: "Windshield is clear (no cracks obstructing view); wipers and washer work", category: "Visibility", trip: "pre", input: "check", dotSpecific: false, enabled: true, sortOrder: 80 },
  { id: "horn", label: "Horn works", category: "Controls", trip: "pre", input: "check", dotSpecific: false, enabled: true, sortOrder: 90 },
  { id: "steering", label: "Steering is responsive with no excessive play", category: "Controls", trip: "pre", input: "check", dotSpecific: false, enabled: true, sortOrder: 100 },
  { id: "gauges", label: "No warning/engine lights on the dashboard", hint: "Check engine, ABS, airbag, oil, temp, battery", category: "Engine & Dash", trip: "pre", input: "check", dotSpecific: false, enabled: true, sortOrder: 110 },
  { id: "leaks", label: "No fluid leaks under the van (oil, coolant, fuel)", hint: "Look at the ground under the engine", category: "Engine & Dash", trip: "pre", input: "check", dotSpecific: false, enabled: true, sortOrder: 120 },
  { id: "fluids", label: "Fluid levels OK (oil, coolant, washer)", category: "Engine & Dash", trip: "pre", input: "check", dotSpecific: false, enabled: true, sortOrder: 130 },
  { id: "seatbelts", label: "Seatbelts function and are not frayed", category: "Cab & Restraints", trip: "pre", input: "check", dotSpecific: false, enabled: true, sortOrder: 140 },
  { id: "doors", label: "All doors (cab and cargo) open, close, and latch securely", category: "Cab & Restraints", trip: "pre", input: "check", dotSpecific: false, enabled: true, sortOrder: 150 },
  { id: "emergency_equipment", label: "Fire extinguisher, reflective triangles, and first-aid kit present and in date", hint: "Required DOT emergency equipment", category: "Safety Equipment", trip: "pre", input: "check", dotSpecific: true, enabled: true, sortOrder: 160 },
  { id: "cargo_secure", label: "Cargo area floor is clear and load is secured", category: "Cargo", trip: "pre", input: "check", dotSpecific: false, enabled: true, sortOrder: 170 },
  { id: "documents", label: "Registration and insurance/permit documents are in the van", category: "Documents", trip: "pre", input: "check", dotSpecific: true, enabled: true, sortOrder: 180 },
  { id: "body_damage", label: "No new body damage that affects safe operation", hint: "Note anything you'll photograph next", category: "Body", trip: "pre", input: "check", dotSpecific: false, enabled: true, sortOrder: 190 },

  // ---- Post-trip (default: photos + these) ----
  { id: "fuel_return", label: "Did you fuel the van before returning?", category: "Return", trip: "post", input: "yesno", dotSpecific: false, enabled: true, sortOrder: 10 },
  { id: "mileage_end", label: "Enter ending mileage", category: "Mileage", trip: "post", input: "number", dotSpecific: false, enabled: true, sortOrder: 20 },
  { id: "post_notes", label: "Are there any van-related notes you need to report?", hint: "Optional — anything management should know", category: "Notes", trip: "post", input: "text", dotSpecific: false, enabled: true, sortOrder: 30 },
];

export interface PhotoStep {
  slot: PhotoSlot;
  title: string;
  instruction: string;
  /** Framing-guide silhouette shown above the shutter button. */
  silhouette?: string;
}

/** The 4 required exterior photos (pre AND post trip), in walk-around order. */
export const PHOTO_STEPS: PhotoStep[] = [
  { slot: "driver_side", title: "Driver Side", instruction: "Stand back and line the van up with the outline — capture the FULL driver side.", silhouette: "/silhouettes/van-driver-side.svg" },
  { slot: "back", title: "Back of Van", instruction: "Capture the rear doors and license plate.", silhouette: "/silhouettes/van-back.svg" },
  { slot: "passenger_side", title: "Passenger Side", instruction: "Stand back and line the van up with the outline — capture the FULL passenger side.", silhouette: "/silhouettes/van-passenger-side.svg" },
  { slot: "front", title: "Front of Van", instruction: "Capture the front bumper, grille, and windshield.", silhouette: "/silhouettes/van-front.svg" },
];

/** Post-trip interior photos — added only when the owner enables them. */
export const INTERIOR_STEPS: PhotoStep[] = [
  { slot: "interior_cabin", title: "Interior Cabin", instruction: "Capture the driver cabin area (seats, dash, floor)." },
  { slot: "interior_cargo", title: "Interior Cargo Area", instruction: "Capture the cargo area from the rear doors." },
  { slot: "fuel_gauge", title: "Fuel Gauge Level", instruction: "Turn the key on and capture the fuel gauge clearly." },
];

export const OPTIONAL_SLOTS: PhotoSlot[] = ["optional_1", "optional_2", "optional_3", "optional_4"];

export const DEFAULT_SETTINGS = { dotMode: true, interiorPhotos: false };
