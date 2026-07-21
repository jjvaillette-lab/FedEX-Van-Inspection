# Parali Van Check

A PAVE-style DOT pre-trip **van safety inspection** app for a FedEx-contracted
transportation company. Built as a **PWA** (Progressive Web App) so one codebase
runs on iPhone, Android, rugged CAT phones, and older devices — and installs to
the home screen like a native app.

## The driver flow

1. **Scan FedEx driver barcode** → pulls the driver name / route.
2. **Scan the van's QR code** → identifies the van.
3. **DOT safety checklist** → 19 standard pre-trip items, each marked **OK** or
   **Issue** (with an optional note).
4. **4 guided photos** → driver side → back → passenger side → front.
5. **Submit** → if any item was flagged, the driver sees a red
   **"Report Van to Management"** screen and the inspection is flagged in the
   dashboard.

Plus two support screens:

- **Van QR Generator** (`/vans`) — create & print a QR code for each van once.
- **Management Dashboard** (`/dashboard`) — review all inspections, filter to
  flagged vans, and see reported issues + photos.

## Run it locally

```bash
cd van-inspection
npm install
npm run dev
```

Open http://localhost:3000 on your computer.

## Test on your iPhone (and any phone)

The camera needs a **secure (HTTPS)** connection — it works on `localhost`, but
**not** over a plain `http://192.168.x.x` LAN address. Two easy options:

1. **Tunnel (quickest for testing):** with `npm run dev` running, in another
   terminal run `npx localtunnel --port 3000` (or `cloudflared tunnel --url
   http://localhost:3000`). It prints an `https://…` URL — open that on your
   iPhone and the camera will work. Tap **Share → Add to Home Screen** to install it.
2. **Deploy (best for real use):** push to Vercel (free). You get a permanent
   `https://…` URL that every driver can open. `npm i -g vercel && vercel`.

On phones where the live camera isn't available, every scan step has a
**manual-entry fallback**, and rugged hardware scanners that "type" a barcode
work in that same field. Photos fall back to the native camera app on old phones.

## Where the data goes

Right now inspections are saved by a small API route (`app/api/inspections`) to a
local JSON file (`/data`, git-ignored) with photos stored inline — so the whole
flow works today with zero cloud setup.

### Next step: Supabase (cloud + real dashboard)

The storage is isolated in `lib/storage.ts` behind two functions
(`saveInspection`, `listInspections`). To go to production:

1. Create a free Supabase project.
2. Add an `inspections` table and a Storage bucket for photos.
3. Swap the bodies of those two functions to insert the row and upload each photo
   (store the returned URL instead of base64). Nothing else in the app changes.
4. Add auth to `/dashboard` so only management can view it.

## The FedEx driver barcode

`lib/driver.ts` (`parseDriverBarcode`) currently uses forgiving heuristics because
the exact FedEx encoding isn't known yet. **Send a real FedEx driver barcode
sample** and we replace the heuristics with the exact field map (name, route, etc.).
The scanner already reads standard formats; the van QR codes are generated in-app.

## Project layout

```
app/
  page.tsx              Home hub
  inspection/page.tsx   The driver flow (state machine)
  vans/page.tsx         Van QR generator
  dashboard/page.tsx    Management dashboard
  api/inspections/      Save & list inspections
  components/           BarcodeScanner, PhotoCapture
lib/
  questions.ts          The 19 DOT checks + 4 photo steps
  driver.ts             FedEx barcode parsing (to finalize)
  storage.ts            Storage layer (swap to Supabase for prod)
  types.ts              Shared types
```
