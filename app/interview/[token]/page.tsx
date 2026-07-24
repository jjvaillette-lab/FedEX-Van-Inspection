"use client";

import { use, useEffect, useRef, useState } from "react";

/**
 * Candidate interview — a phone-friendly chat with the AI interviewer.
 * Public page reached only via the unguessable invite link.
 */

interface Turn {
  role: "interviewer" | "candidate";
  text: string;
  at: string;
}

export default function InterviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [company, setCompany] = useState<{ name: string; themeColor: string } | null>(null);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "active" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/interview/${token}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Interview not found.");
        setCompany(d.company);
        setTranscript(d.transcript ?? []);
        if (d.status === "completed") setStatus("done");
        else if ((d.transcript ?? []).length > 0) setStatus("active");
        else setStatus("ready");
      })
      .catch((e) => {
        setErrorMsg(e instanceof Error ? e.message : "Interview not found.");
        setStatus("error");
      });
  }, [token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, status]);

  const begin = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/interview/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Couldn't start.");
      setTranscript(d.transcript ?? []);
      setStatus("active");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Couldn't start.");
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    setDraft("");
    // Show the candidate's message immediately.
    setTranscript((t) => [...t, { role: "candidate", text: message, at: new Date().toISOString() }]);
    try {
      const res = await fetch(`/api/interview/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "message", message }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Send failed.");
      setTranscript(d.transcript ?? []);
      if (d.done) setStatus("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Send failed — try again.");
    } finally {
      setSending(false);
    }
  };

  const brand = company?.themeColor ?? "#0E7C5A";

  if (status === "error") {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-100 px-6">
        <p className="max-w-sm text-center text-slate-500">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
        <p className="text-[15px] font-bold text-slate-900">{company?.name ?? "…"}</p>
        <p className="text-xs text-slate-500">First-round interview · automated &amp; recorded</p>
      </header>

      <main className="flex-1 space-y-3 px-4 py-5">
        {status === "loading" && <p className="py-16 text-center text-sm text-slate-400">Loading…</p>}

        {status === "ready" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <h1 className="text-lg font-bold text-slate-900">Welcome!</h1>
            <p className="mt-2 text-sm text-slate-600">
              This is a short chat interview — about 10 minutes, in your own words, whenever
              you&apos;re ready. Your answers are recorded and reviewed by the hiring team.
            </p>
            <button
              onClick={begin}
              disabled={sending}
              className="mt-5 w-full rounded-xl py-3.5 font-semibold text-white disabled:opacity-40"
              style={{ background: brand }}
            >
              {sending ? "Starting…" : "Start my interview"}
            </button>
          </div>
        )}

        {transcript.map((t, i) => (
          <div key={i} className={`flex ${t.role === "candidate" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-snug ${
                t.role === "candidate"
                  ? "rounded-br-md text-white"
                  : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
              }`}
              style={t.role === "candidate" ? { background: brand } : undefined}
            >
              {t.text}
            </div>
          </div>
        ))}

        {sending && status === "active" && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-400">
              …
            </div>
          </div>
        )}

        {status === "done" && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <p className="font-semibold text-emerald-800">Interview complete — thank you! 🎉</p>
            <p className="mt-1 text-sm text-emerald-700">
              The {company?.name} hiring team will review your answers and reach out about next
              steps. You can close this page.
            </p>
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      {status === "active" && (
        <footer className="sticky bottom-0 border-t border-slate-200 bg-white p-3">
          <div className="flex gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder="Type your answer…"
              className="flex-1 resize-none rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] outline-none focus:border-slate-500"
            />
            <button
              onClick={send}
              disabled={sending || !draft.trim()}
              className="shrink-0 self-end rounded-xl px-5 py-2.5 font-semibold text-white disabled:opacity-40"
              style={{ background: brand }}
            >
              Send
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
