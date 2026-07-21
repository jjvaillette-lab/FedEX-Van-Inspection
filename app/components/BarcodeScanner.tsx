"use client";

import { useEffect, useRef, useState } from "react";

interface BarcodeScannerProps {
  onScan: (value: string) => void;
  /** Short prompt above the camera, e.g. "Scan the FedEx driver barcode". */
  prompt: string;
  /** Placeholder for the manual-entry field. */
  manualPlaceholder?: string;
}

const READER_ID = "barcode-reader";

// Html5QrcodeScannerState: 2 = SCANNING, 3 = PAUSED. stop() throws
// synchronously in any other state, so guard before calling it.
async function safeStop(scanner: {
  stop: () => Promise<void>;
  clear: () => void;
  getState: () => number;
}) {
  try {
    const state = scanner.getState?.();
    if (state === 2 || state === 3) {
      await scanner.stop();
    }
  } catch {
    /* already stopped */
  }
  try {
    scanner.clear();
  } catch {
    /* ignore */
  }
}

/**
 * Camera barcode/QR scanner with two fallbacks so it works on every phone:
 *  1. Live camera scan (html5-qrcode, uses the device camera).
 *  2. Manual entry — also captures hardware "keyboard-wedge" scanners
 *     (rugged CAT-style units that type the code + Enter).
 */
export default function BarcodeScanner({ onScan, prompt, manualPlaceholder }: BarcodeScannerProps) {
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState("");
  // Holds the Html5Qrcode instance so we can stop it on cleanup.
  const scannerRef = useRef<{
    stop: () => Promise<void>;
    clear: () => void;
    getState: () => number;
  } | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (mode !== "camera") return;
    let cancelled = false;
    handledRef.current = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(READER_ID, { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 180 }, aspectRatio: 1.4 },
          (decodedText: string) => {
            if (handledRef.current) return;
            handledRef.current = true;
            // Stop the camera, then hand the value up.
            safeStop(scanner).finally(() => onScan(decodedText.trim()));
          },
          () => {
            // Per-frame decode failures are normal; ignore.
          }
        );
      } catch (err) {
        if (!cancelled) {
          setCameraError(
            "Camera unavailable. Make sure you're on HTTPS and allowed camera access, or enter the code below."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        void safeStop(s);
        scannerRef.current = null;
      }
    };
  }, [mode, onScan]);

  const submitManual = () => {
    const v = manualValue.trim();
    if (v) onScan(v);
  };

  return (
    <div className="w-full">
      <p className="mb-3 text-center text-lg font-semibold text-slate-800">{prompt}</p>

      {mode === "camera" && (
        <div className="overflow-hidden rounded-2xl bg-black">
          <div id={READER_ID} className="mx-auto w-full" />
        </div>
      )}

      {cameraError && mode === "camera" && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{cameraError}</p>
      )}

      {mode === "manual" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <label className="mb-2 block text-sm font-medium text-slate-600">
            Enter or scan the code
          </label>
          <input
            autoFocus
            inputMode="text"
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitManual();
            }}
            placeholder={manualPlaceholder ?? "Barcode value"}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-lg outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          />
          <button
            onClick={submitManual}
            disabled={!manualValue.trim()}
            className="mt-3 w-full rounded-lg bg-sky-600 py-3 font-semibold text-white disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      )}

      <button
        onClick={() => {
          setCameraError(null);
          setMode((m) => (m === "camera" ? "manual" : "camera"));
        }}
        className="mt-4 w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-600"
      >
        {mode === "camera" ? "Can't scan? Enter code manually" : "Use camera instead"}
      </button>
    </div>
  );
}
