"use client";

import { useEffect, useRef, useState } from "react";
import type { PhotoStep } from "@/lib/questions";
import type { PhotoSlot } from "@/lib/types";
import { IconCamera } from "@/app/components/icons";

interface MultiPhotoCaptureProps {
  steps: PhotoStep[];
  photos: Partial<Record<PhotoSlot, string>>;
  onCapture: (slot: PhotoSlot, dataUrl: string) => void;
}

const MAX_DIM = 1100;
const JPEG_QUALITY = 0.72;

function downscaleFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * One continuous camera session for the required photo walk-around: the driver
 * opens the camera ONCE and the prompt + silhouette guide switch to the next
 * shot after every shutter press. Full frames are captured; the guide is
 * visual only. Native-camera fallback per shot for devices without live video.
 */
export default function MultiPhotoCapture({ steps, photos, onCapture }: MultiPhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingSlotRef = useRef<PhotoSlot | null>(null);

  const [open, setOpen] = useState(false);
  const [currentSlot, setCurrentSlot] = useState<PhotoSlot | null>(null);
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);

  const missing = steps.filter((s) => !photos[s.slot]);
  const done = missing.length === 0;
  const current = steps.find((s) => s.slot === currentSlot) ?? null;
  const currentNumber = current ? steps.findIndex((s) => s.slot === current.slot) + 1 : 0;

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  const closeSession = () => {
    stopStream();
    setOpen(false);
    setCurrentSlot(null);
  };
  useEffect(() => stopStream, []);

  const openSession = async (startSlot?: PhotoSlot) => {
    const target = startSlot ?? missing[0]?.slot;
    if (!target) return;
    setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setCurrentSlot(target);
      setOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      // No live camera: fall back to the native camera app for this shot.
      pendingSlotRef.current = target;
      inputRef.current?.click();
    } finally {
      setBusy(false);
    }
  };

  const advanceFrom = (justCaptured: PhotoSlot) => {
    const remaining = steps.filter((s) => s.slot !== justCaptured && !photos[s.slot]);
    if (remaining.length === 0) {
      closeSession();
    } else {
      setCurrentSlot(remaining[0].slot);
    }
  };

  const snap = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !current) return;
    const scale = Math.min(1, MAX_DIM / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    onCapture(current.slot, canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    setFlash(true);
    setTimeout(() => setFlash(false), 220);
    advanceFrom(current.slot);
  };

  const handleFile = async (file: File | undefined) => {
    const slot = pendingSlotRef.current;
    pendingSlotRef.current = null;
    if (!file || !slot) return;
    try {
      onCapture(slot, await downscaleFile(file));
    } catch {
      const reader = new FileReader();
      reader.onload = () => onCapture(slot, reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {/* Review grid: thumbnails fill in as the session captures each shot */}
      <div className="grid grid-cols-2 gap-3">
        {steps.map((s, i) => {
          const url = photos[s.slot];
          return (
            <div key={s.slot} className="rounded-xl border border-slate-200 bg-white p-2">
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={s.title} className="h-28 w-full rounded-lg object-cover" />
              ) : (
                <div className="flex h-28 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-300">
                  <IconCamera size={26} />
                </div>
              )}
              <div className="mt-1.5 flex items-center justify-between px-1">
                <span className="text-xs font-medium text-slate-600">
                  {i + 1}. {s.title}
                </span>
                {url && (
                  <button
                    onClick={() => void openSession(s.slot)}
                    className="text-xs font-semibold text-slate-400 underline"
                  >
                    Retake
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!done && (
        <button
          onClick={() => void openSession()}
          disabled={busy}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-4 text-base font-semibold text-white disabled:opacity-50"
        >
          <IconCamera size={20} />
          {busy
            ? "Opening camera…"
            : missing.length === steps.length
              ? "Open Camera"
              : `Finish photos (${missing.length} left)`}
        </button>
      )}

      {/* Continuous viewfinder session */}
      {open && current && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="relative flex-1 overflow-hidden">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 h-full w-full object-contain"
            />
            {current.silhouette && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.silhouette}
                alt=""
                className="pointer-events-none absolute inset-0 m-auto max-h-[88%] w-[97%] object-contain opacity-90"
                style={{ filter: "invert(1) brightness(1.7) drop-shadow(0 0 3px rgba(0,0,0,.7))" }}
              />
            )}
            {flash && <div className="absolute inset-0 bg-white/80" />}
            <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
                Photo {currentNumber} of {steps.length}
              </p>
              <p className="text-xl font-bold text-white">{current.title}</p>
              <p className="mt-0.5 text-xs text-white/80">{current.instruction}</p>
            </div>
          </div>
          <div className="flex items-center justify-between bg-black px-8 pb-8 pt-4">
            <button onClick={closeSession} className="w-16 text-sm font-medium text-white/70">
              Close
            </button>
            <button
              onClick={snap}
              aria-label="Take photo"
              className="h-16 w-16 rounded-full border-4 border-white bg-white/20 active:bg-white/60"
            />
            <button
              onClick={() => {
                pendingSlotRef.current = current.slot;
                closeSession();
                inputRef.current?.click();
              }}
              className="w-16 text-xs font-medium leading-tight text-white/70"
            >
              Use phone camera
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
