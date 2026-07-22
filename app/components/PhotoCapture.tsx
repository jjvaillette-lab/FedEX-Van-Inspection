"use client";

import { useEffect, useRef, useState } from "react";
import type { PhotoStep } from "@/lib/questions";
import { IconCamera } from "@/app/components/icons";

interface PhotoCaptureProps {
  step: PhotoStep;
  index: number;
  total: number;
  existing?: string;
  onCapture: (dataUrl: string) => void;
  /** Optional-report photos also collect a description. */
  description?: string;
  onDescription?: (text: string) => void;
}

const MAX_DIM = 1100;
const JPEG_QUALITY = 0.72;

/** Downscale a captured file to keep uploads small (native-camera fallback path). */
function downscale(file: File): Promise<string> {
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
 * Photo capture with an in-app live viewfinder: the van silhouette guide is
 * overlaid ON the camera view so the driver knows distance and framing. The
 * FULL frame is captured — the dotted outline is a visual guide only. Devices
 * without live-camera support fall back to the native camera app.
 */
export default function PhotoCapture({
  step,
  index,
  total,
  existing,
  onCapture,
  description,
  onDescription,
}: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | undefined>(existing);
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  const closeCamera = () => {
    stopStream();
    setCameraOpen(false);
  };

  // Never leave the camera running if the step unmounts.
  useEffect(() => stopStream, []);

  const openCamera = async () => {
    setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      // No permission / unsupported (older phones): use the native camera app.
      inputRef.current?.click();
    } finally {
      setBusy(false);
    }
  };

  const snap = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const scale = Math.min(1, MAX_DIM / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    closeCamera();
    setPreview(dataUrl);
    onCapture(dataUrl);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await downscale(file);
      setPreview(dataUrl);
      onCapture(dataUrl);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        setPreview(url);
        onCapture(url);
      };
      reader.readAsDataURL(file);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Photo {index + 1} of {total}
      </p>
      <h2 className="mt-1 text-xl font-bold text-slate-900">{step.title}</h2>
      <p className="mt-1 max-w-xs text-sm text-slate-500">{step.instruction}</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {preview ? (
        <div className="mt-4 w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={step.title}
            className="mx-auto max-h-72 w-full rounded-xl object-cover shadow"
          />
          {onDescription && (
            <input
              value={description ?? ""}
              onChange={(e) => onDescription(e.target.value)}
              placeholder="Describe what this photo shows (optional)"
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
            />
          )}
          <button
            onClick={() => void openCamera()}
            className="mt-3 w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-600"
          >
            Retake photo
          </button>
        </div>
      ) : (
        <button
          onClick={() => void openCamera()}
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-4 text-base font-semibold text-white disabled:opacity-50"
        >
          <IconCamera size={20} />
          {busy ? "Opening camera…" : "Open Camera"}
        </button>
      )}

      {/* In-app viewfinder with the framing guide over the live camera */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="relative flex-1 overflow-hidden">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 h-full w-full object-contain"
            />
            {step.silhouette && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={step.silhouette}
                alt=""
                className="pointer-events-none absolute inset-0 m-auto max-h-[88%] w-[97%] object-contain opacity-90"
                style={{ filter: "invert(1) brightness(1.7) drop-shadow(0 0 3px rgba(0,0,0,.7))" }}
              />
            )}
            <p className="absolute inset-x-4 top-4 text-center text-sm font-medium text-white drop-shadow-[0_1px_3px_rgba(0,0,0,.9)]">
              {step.silhouette
                ? "Line the van up inside the dotted guide — the full photo is saved."
                : step.instruction}
            </p>
          </div>
          <div className="flex items-center justify-between bg-black px-8 pb-8 pt-4">
            <button onClick={closeCamera} className="w-16 text-sm font-medium text-white/70">
              Cancel
            </button>
            <button
              onClick={snap}
              aria-label="Take photo"
              className="h-16 w-16 rounded-full border-4 border-white bg-white/20 active:bg-white/60"
            />
            <button
              onClick={() => {
                closeCamera();
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
