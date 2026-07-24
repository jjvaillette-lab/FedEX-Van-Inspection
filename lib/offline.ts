/**
 * Driver-app offline support (browser-only).
 *
 * Inspections submitted without signal are stored in IndexedDB on the phone
 * and auto-sent when the connection returns (reconnect event, or the next
 * time the app opens). Local trip history lets pre/post detection work
 * offline too. Photos ride along as data URLs — IndexedDB handles the size.
 */

const DB_NAME = "lma-driver";
const STORE = "queue";
const TRIPS_KEY = "lma.localTrips";

export interface QueuedInspection {
  id: string;
  queuedAt: string;
  payload: Record<string, unknown>;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

/** Save an inspection on the phone to send later. */
export async function queueInspection(payload: Record<string, unknown>): Promise<void> {
  const item: QueuedInspection = {
    id: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
    payload,
  };
  await tx("readwrite", (s) => s.put(item));
}

export async function pendingInspections(): Promise<QueuedInspection[]> {
  try {
    return (await tx("readonly", (s) => s.getAll())) as QueuedInspection[];
  } catch {
    return [];
  }
}

let flushing = false;

/**
 * Try to send everything waiting on this phone. A delivered OR definitively
 * rejected (4xx) item leaves the queue; network failures and server errors
 * keep it for the next try.
 */
export async function flushQueue(): Promise<{ sent: number; remaining: number }> {
  if (flushing) return { sent: 0, remaining: (await pendingInspections()).length };
  flushing = true;
  let sent = 0;
  try {
    const items = await pendingInspections();
    for (const item of items) {
      try {
        const res = await fetch("/api/inspections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload),
        });
        if (res.ok || (res.status >= 400 && res.status < 500)) {
          await tx("readwrite", (s) => s.delete(item.id));
          if (res.ok) sent++;
        } else {
          break; // server trouble — try again later, keep order
        }
      } catch {
        break; // still offline
      }
    }
    return { sent, remaining: (await pendingInspections()).length };
  } finally {
    flushing = false;
  }
}

/* ---- device-local trip history (offline pre/post detection) ---- */

interface LocalTrips {
  date: string;
  byVan: Record<string, { pres: number; posts: number }>;
}

const todayKey = () => new Date().toLocaleDateString("en-US");

function readTrips(): LocalTrips {
  try {
    const raw = localStorage.getItem(TRIPS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalTrips;
      if (parsed.date === todayKey()) return parsed;
    }
  } catch {
    /* corrupt storage */
  }
  return { date: todayKey(), byVan: {} };
}

/** Remember a completed (or queued) trip on this device. */
export function recordLocalTrip(vanId: string, trip: "pre" | "post"): void {
  try {
    const trips = readTrips();
    const v = trips.byVan[vanId] ?? { pres: 0, posts: 0 };
    if (trip === "pre") v.pres++;
    else v.posts++;
    trips.byVan[vanId] = v;
    localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
  } catch {
    /* non-fatal */
  }
}

export function localTripCounts(vanId: string): { pres: number; posts: number } {
  return readTrips().byVan[vanId] ?? { pres: 0, posts: 0 };
}

/* ---- service worker ---- */

/** Register the offline shell (safe to call repeatedly; no-op unsupported). */
export function registerDriverSW(): void {
  try {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  } catch {
    /* unsupported browser */
  }
}
