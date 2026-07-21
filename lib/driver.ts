import type { Driver } from "./types";

/**
 * Parse the scanned FedEx driver barcode into a Driver.
 *
 * NOTE: The exact FedEx encoding is not yet known — the user will provide a
 * real barcode sample. Until then this is intentionally forgiving:
 *  - It keeps the full raw string.
 *  - It tries a few common delimiters to pull out a name and route.
 *  - It never throws; worst case the raw string is shown to the driver.
 *
 * Once we have a sample, replace the heuristics below with the real field map.
 */
export function parseDriverBarcode(raw: string): Driver {
  const clean = raw.trim();
  const driver: Driver = { raw: clean };

  // Try structured formats like "NAME|ROUTE|..." or "NAME^ROUTE" or CSV.
  const parts = clean.split(/[|^;,\t]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    driver.name = parts[0];
    // Look for something that looks like a route code among the parts.
    const routeLike = parts.find((p) => /route|rt[-\s]?\d|\b[A-Z]?\d{2,}\b/i.test(p));
    driver.route = routeLike ?? parts[1];
  }

  return driver;
}
