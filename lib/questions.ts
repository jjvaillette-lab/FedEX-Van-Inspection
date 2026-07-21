import type { PhotoSlot } from "./types";

export interface SafetyQuestion {
  id: string;
  /** The check the driver confirms. */
  label: string;
  category: string;
  /** Short helper text shown under the question. */
  hint?: string;
}

/**
 * Standard DOT pre-trip / DVIR van safety checks.
 * Each item is answered OK (pass) or Needs Attention (issue).
 * Any "issue" flags the van for management review.
 */
export const SAFETY_QUESTIONS: SafetyQuestion[] = [
  { id: "tires", category: "Tires & Wheels", label: "Tires have good tread and proper inflation (no cuts, bulges, or flats)", hint: "Check all tires including inner duals" },
  { id: "wheels", category: "Tires & Wheels", label: "Wheels and rims are undamaged; lug nuts tight", hint: "Look for missing lugs or rust streaks" },
  { id: "brakes", category: "Brakes", label: "Service brakes and parking brake work properly", hint: "No pulling, grinding, or soft pedal" },
  { id: "lights_head", category: "Lights", label: "Headlights and high beams work", hint: "" },
  { id: "lights_signals", category: "Lights", label: "Turn signals, brake lights, tail lights and hazards work", hint: "Walk around and confirm each" },
  { id: "reflectors", category: "Lights", label: "Reflectors and marker lights are present and clean", hint: "" },
  { id: "mirrors", category: "Visibility", label: "Mirrors are clean, adjusted, and undamaged", hint: "" },
  { id: "windshield", category: "Visibility", label: "Windshield is clear (no cracks obstructing view); wipers and washer work", hint: "" },
  { id: "horn", category: "Controls", label: "Horn works", hint: "" },
  { id: "steering", category: "Controls", label: "Steering is responsive with no excessive play", hint: "" },
  { id: "gauges", category: "Engine & Dash", label: "No warning/engine lights on the dashboard", hint: "Check engine, ABS, airbag, oil, temp, battery" },
  { id: "leaks", category: "Engine & Dash", label: "No fluid leaks under the van (oil, coolant, fuel)", hint: "Look at the ground under the engine" },
  { id: "fluids", category: "Engine & Dash", label: "Fluid levels OK (oil, coolant, washer)", hint: "" },
  { id: "seatbelts", category: "Cab & Restraints", label: "Seatbelts function and are not frayed", hint: "" },
  { id: "doors", category: "Cab & Restraints", label: "All doors (cab and cargo) open, close, and latch securely", hint: "" },
  { id: "emergency_equipment", category: "Safety Equipment", label: "Fire extinguisher, reflective triangles, and first-aid kit present and in date", hint: "Required DOT emergency equipment" },
  { id: "cargo_secure", category: "Cargo", label: "Cargo area floor is clear and load is secured", hint: "" },
  { id: "documents", category: "Documents", label: "Registration and insurance/permit documents are in the van", hint: "" },
  { id: "body_damage", category: "Body", label: "No new body damage that affects safe operation", hint: "Note anything you'll photograph next" },
];

export interface PhotoStep {
  slot: PhotoSlot;
  title: string;
  instruction: string;
  /** Emoji shown as a simple visual guide (kept lightweight for old phones). */
  icon: string;
}

/** The 4 guided vehicle photos, in the order the driver walks the van. */
export const PHOTO_STEPS: PhotoStep[] = [
  { slot: "driver_side", title: "Driver Side", instruction: "Stand back and capture the FULL driver side of the van.", icon: "🚐" },
  { slot: "back", title: "Back of Van", instruction: "Capture the rear doors and license plate.", icon: "🔙" },
  { slot: "passenger_side", title: "Passenger Side", instruction: "Stand back and capture the FULL passenger side of the van.", icon: "🚐" },
  { slot: "front", title: "Front of Van", instruction: "Capture the front bumper, grille, and windshield.", icon: "🔜" },
];
