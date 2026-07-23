"use client";

import { useEffect, useRef, useState } from "react";

interface SignaturePadProps {
  /** Called with a PNG data URL after each stroke; null when cleared. */
  onChange: (dataUrl: string | null) => void;
}

/**
 * Finger/stylus signature capture for the DVIR sign-off. Draws on a canvas
 * sized to its container; the captured PNG is stored with the inspection as
 * the driver's electronic signature.
 */
export default function SignaturePad({ onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const width = canvas.offsetWidth || canvas.getBoundingClientRect().width;
    if (!width) return false; // not laid out yet — retry on first touch
    const dpr = window.devicePixelRatio || 1;
    const height = 160;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.25;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return true;
  };

  useEffect(() => {
    initCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    // If the pad mounted while hidden/rotating it may have zero size — size it now.
    if (canvasRef.current && canvasRef.current.width === 0) initCanvas();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    try {
      canvasRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* some browsers reject capture for certain pointer types — drawing still works */
    }
    drawing.current = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1); // dot for taps
    ctx.stroke();
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const url = canvasRef.current?.toDataURL("image/png");
    // Guard against degenerate captures (zero-size canvas yields "data:,").
    if (url && url.length > 200) {
      setHasInk(true);
      onChange(url);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.offsetWidth, 160);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-slate-300 bg-white">
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-300">
            Sign here with your finger
          </span>
        )}
        <canvas
          ref={canvasRef}
          className="block h-40 w-full touch-none"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">Signature is saved with this report</span>
        <button onClick={clear} type="button" className="text-xs font-semibold text-slate-400 underline">
          Clear
        </button>
      </div>
    </div>
  );
}
