"use client";

import { useState } from "react";

/**
 * Password field with a Show/Hide toggle so people can check what they
 * typed before signing in. Used on every password entry in the app.
 */
export default function PasswordInput({
  value,
  onChange,
  placeholder = "••••••••",
  className = "w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200",
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`${className} pr-14`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 px-3 text-xs font-bold uppercase tracking-wide text-slate-400 hover:text-slate-700"
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}
