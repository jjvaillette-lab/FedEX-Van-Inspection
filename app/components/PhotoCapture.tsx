"use client";

import { useRef, useState } from "react";
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

/** Downscale a captured photo to keep uploads small (important on old phones). */
function downscale(file: File, maxDim = 1100, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

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
  const [preview, setPreview] = useState<string | undefined>(existing);
  const [busy, setBusy] = useState(false);

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

      {/* Framing guide — line the van up with the outline, full photo is stored. */}
      {step.silhouette && !preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={step.silhouette} alt="" className="mt-4 w-full max-w-sm" />
      )}

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
            onClick={() => inputRef.current?.click()}
            className="mt-3 w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-600"
          >
            Retake photo
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-4 text-base font-semibold text-white disabled:opacity-50"
        >
          <IconCamera size={20} />
          {busy ? "Processing…" : "Open Camera"}
        </button>
      )}
    </div>
  );
}
