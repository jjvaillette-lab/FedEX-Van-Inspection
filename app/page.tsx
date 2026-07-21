import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col px-5 pb-10">
      <header className="pt-12 pb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-3xl">
          🚐
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">Parali Van Check</h1>
        <p className="mt-1 text-slate-500">DOT pre-trip safety inspection</p>
      </header>

      <Link
        href="/inspection"
        className="flex flex-col items-center rounded-2xl bg-sky-600 px-6 py-8 text-center text-white shadow-lg shadow-sky-600/20 active:scale-[0.99]"
      >
        <span className="text-lg font-bold">Start Van Check</span>
        <span className="mt-1 text-sm text-sky-100">
          Scan driver → scan van → checklist → photos
        </span>
      </Link>

      <div className="mt-6 grid gap-3">
        <Link
          href="/vans"
          className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4"
        >
          <span className="text-2xl">🔳</span>
          <span>
            <span className="block font-semibold text-slate-800">Van QR Generator</span>
            <span className="block text-sm text-slate-500">Create &amp; print a QR code for each van</span>
          </span>
        </Link>
        <Link
          href="/dashboard"
          className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4"
        >
          <span className="text-2xl">📋</span>
          <span>
            <span className="block font-semibold text-slate-800">Management Dashboard</span>
            <span className="block text-sm text-slate-500">Review inspections &amp; flagged vans</span>
          </span>
        </Link>
      </div>

      <p className="mt-auto pt-10 text-center text-xs text-slate-400">
        Parali Consulting · Fleet Safety
      </p>
    </main>
  );
}
