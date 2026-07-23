# Parali Operations Portal — Requirements & Decisions Log

**Fleet Inspection module + portal foundation**
Last updated: 2026-07-21 · Owner: Jason Vaillette

> Running record of every decision so we can build against it. Add to the bottom
> revision log as things change. Live prototype: https://fed-ex-van-inspection.vercel.app

---

## 0. Status snapshot (updated 2026-07-22)
**BUILT & DEPLOYED (v2):**
- Professional business UI (icon design system, no emoji) across portal, landing, driver app
- Pre/post-trip auto-detection (1st scan = pre, 2nd = post), daily cycles, "already inspected today — start new?" prompt, multiple-inspections-per-day kept & denoted
- Failed Inspection recording — partial data always saved; "End early" flow; failed trips don't complete a cycle (re-scan repeats the same trip type)
- Questions: beginning/ending mileage, fuel-on-return (yes/no), post-trip open notes
- **Owner Checklist Editor** (Fleet › Checklist): hide toggle per question, inline edit, reorder, add custom questions, DOT/Non-DOT company mode, interior-photos toggle (off by default) — DB-backed, seeds defaults
- Photos: van silhouette framing guides (4 exterior, full photo stored); up to 4 optional report photos w/ description fields; 3 post-trip interior photos behind owner toggle
- **Inspection Review Center** (Fleet › Inspections): history by All/Date/Van/Driver, search + status filters, stat tiles, missing-post-trip & post-trip-pending detection, PRE/POST badges, resolve workflow (mandatory note + name + optional receipt upload → van folder), immutable driver records + office comments w/ disagreement flag (both logged & searchable), side-by-side photo compare, CSV export (permission-gated)
- Driver name/route attached to every record

**⚠️ Pending user action:** run `supabase/migration-v2.sql` in Supabase SQL editor — until then the app runs on graceful fallbacks (trip types read as "pre", checklist edits & resolve/comments blocked with a clear message).

**Also built (2026-07-23):** Van Maintenance & Costs module (log by van w/ mileage/cost/receipts, Cost-by-Van rollup, CSV) — needs migration-v4.sql; Instant alert system (owner-managed email/SMS recipients in Settings, fires on flagged/incomplete submissions; email live once Resend key added, SMS once Twilio added); post-trip cutoff + "Post trip not done" status; Incomplete rename; review center tiles-as-tabs w/ Today default + Yesterday's DVIRs; calendar & driver/van dropdown filters; export options modal; per-driver missed-trip stats; printable DVIR per inspection w/ signature; DVIR legal sign-off + signature capture; DOT-mandated question guard; dark mode; driver device links + Van Check PWA.

**Still planned:** daily email digest (cron), stoplight trends, reporting tab, direct PDF generation, real per-user auth (Supabase Auth + RLS), Stripe billing, audit log, multi-location, AI pre/post photo damage comparison.

---

## 1. Portal architecture — multi-tenant SaaS (to discuss/confirm)
Goal: sell to **multiple customers, each with completely separate logins**, from **one central backend we update once** for everyone.

Recommended approach:
- **One app + one database, multi-tenant.** Every company's data is tagged to their account and walled off (row-level security). On login, an owner sees only their own company's data.
- **Central deploy (Vercel).** We improve the backend once; every customer gets it on next login — no per-customer installs.
- **Login landing page** at our domain → they log in → their company dashboard loads (Supabase Auth handles logins/resets).
- **Domain:** one branded domain for the whole platform (e.g. `paraliops.com`); every customer logs into the same site under their own account. Optional later: per-customer subdomains (`acme.paraliops.com`).
- **Billing:** Stripe subscriptions. If a payment fails → that company's logins are **suspended until paid** (Stripe handles retries; our app gates access on payment status).
- **Optional paid modules:** modules are **visible but locked** until paid. Selecting a locked module shows a **description / slideshow** of what it does, then an **Install / Add to plan** button that triggers the upgrade. Access flips on when paid.
- **Stack (extends what we already run — nothing wasted):** Next.js on Vercel + Supabase (auth, database, storage) + Stripe (billing). Current app becomes the **Fleet › Inspection** module inside this shell.

Portal sections (placeholders): **Operations · Fleet · Human Resources.** Inspection lives under Fleet.

**Open items for Jason:** pick/buy a domain; create a Stripe account (when we reach billing); pricing model (per company? per van? per module?).

---

## 2. Access & permissions (granular)
- **Owner = full access always** and configures everyone else.
- **Per-manager, per-capability toggles** on an admin screen — owner can switch ON/OFF *any individual option throughout the whole program* for a given manager.
  - e.g. a **Fleet manager** may be granted "edit inspection questions"; an **HR manager** may not. Later, an **HR manager** may get "payroll"; a Fleet manager may not.
- **Default deny:** any sensitive or back-end setting is **OFF by default** for managers — owner opts each one in.

---

## 3. Inspection flow — pre & post trip
- **Scan order decides the type:** 1st scan of the day = **Pre-Trip**; 2nd scan = **Post-Trip**.
- **A van needs both pre & post each calendar day**, or it's flagged **Failed Inspection** for that day.
- **Multiple inspections allowed (no daily lock):** if a van already has activity today, prompt:
  > "This van has already been inspected today — would you like to start a new inspection?"
  - **No** → exit.
  - **Yes** → start a new inspection; a **post-trip is also expected** for this new cycle.
  - **Keep ALL inspections**; clearly **denote that the van had multiple inspections** that day.
- **Driver name attached to every record** (from the scanned FedEx barcode — driver/route info visible during the check).
- **DOT vs Non-DOT toggle:** owner sets mode per account. Non-DOT hides DOT-specific questions **by default**, but the **owner always sees ALL questions** and may enable any of them.
- **Failed inspections are still recorded** with any/all information that was captured (partial data is saved, not discarded).

---

## 4. Questions (owner-controlled, toggleable)
- Owner controls the checklist and can **toggle each question ON/OFF**. Intent: load **more questions than needed** and disable as desired.
- **Pre-trip adds:** "Enter beginning mileage."
- **Post-trip adds:** "Did you fuel the van before returning?" · "Enter ending mileage" · (plus existing open notes field: "Are there any van-related notes you need to report?").
- **Post-trip default** = photos + notes + the fuel/mileage questions above.
- Each question tagged if **DOT-specific** so Non-DOT mode can hide it by default.

---

## 5. Photos
- **Required exterior (4), guided:** Driver Side · Back · Passenger Side · Front.
  - Add a **van silhouette overlay** for each side so drivers frame at roughly the same distance/angle. **Still store the full photo** (overlay is a framing guide only, no cropping).
- **Optional photos (up to 4):** driver-initiated, "capture anything you need to report."
  - When an optional photo is taken, an **optional text field opens** to describe it.
  - Available on **both pre and post trip**; **skipping them never fails** the inspection (e.g. 2 optional pre-trip pics + 0 optional post-trip pics = still a pass).
- **Post-trip interior photos (3) — OFF by default, owner toggle:**
  1. Interior Cabin
  2. Interior Cargo Area
  3. Fuel Gauge level

---

## 6. Alerts & notifications
- **Instant fail alert:** automatic **email**, toggle on/off, **multiple recipients** at owner discretion.
- **Texting (SMS) option** for all important items too — always with the ability to add **multiple** recipients.
- **Trends alerts:** via email/text **and** a subtle desktop stoplight highlight — **green = good throughout, yellow = coach & react, red = problem.** Applies to issues **and** to vans.

---

## 7. Portal capabilities / tabs
- **History by Date**, **by Van**, and **by Driver** (pick a driver → every van's checks and photos).
- **Side-by-side photo comparison** (two inspections of a van, angle by angle — for damage disputes).
- **Resolve / acknowledge flags:** **mandatory** resolution notes + resolver **name + date**; **optional file upload** (receipt).
  - Uploaded receipts are saved into that specific **van's folder**.
- **Manual owner/manager entries:** owner/manager can add comments/items manually (e.g. "driver damaged the side," or "driver said refueled but didn't").
  - The **original driver comment is NEVER editable.** An owner/manager addition **flags a disagreement** with the driver; **both are logged and searchable.**
- **Reporting tab:** same dropdowns as the other tabs; detailed reporting across everything we build.
- **PDF / CSV export.**
- **Driver accountability** view.
- **Audit log.**
- **Multi-location** support.

---

## 8. Van folder + maintenance (roadmap side-avenue)
Each van has a **folder** holding its inspections, photos, and resolved-issue receipts. Additionally:
- **Van Maintenance tracking:** an owner tab to log any maintenance — by **van, mileage, date, what was fixed, cost**, prior-maintenance notes, and **receipt upload**.
- **Van Cost Analysis:** roll the above up so owners see **what each van costs over the year.**

---

## 9. Billing & modules (portal)
- Subscription billing (Stripe). **Failed payment → suspend that company's logins** until brought current.
- **Optional/paid modules:** visible but locked until paid; selecting shows a **description or slideshow**, then an **Install** option (future build).
- **Comp / trial accounts:** ability to grant a company **full access, free, for a set period** (e.g. a **1-year free** account). First user of this = the beta tester (see below).

### Beta rollout
- **First customer = a friend / beta tester**, given a **1-year free, full-access** account to shake the platform out. Bill-later or comped; no payment required during beta.
- **Company brand is NOT "Parali."** New platform name TBD (see §11). Should evoke *simplifying operations in the transportation / last-mile delivery world* (FedEx-adjacent) **without using the FedEx name or marks** (no permission).

---

## 11. Platform name & branding
- **Platform: Last Mile Assist** — domain **lastmileassist.com** (purchased 2026-07-21). Hard-coded as the platform brand.
- Future emails: info@ · contact@ · help@ (and more) @lastmileassist.com.
- **White-label per customer:** each customer company uploads its own **name + logo** at signup; that branding + theme **follows every page and report** in their portal. (Platform public site = Last Mile Assist brand; logged-in portal = the customer's brand.)
- **Test customer: "Stratford Delivery Corp"** with a placeholder logo, used to build/demo the white-label flow.
- Name still open for partner input on the *product* line inside (loved "Dispatchly"); platform/domain is Last Mile Assist.

## 10. What we need from Jason (open items)
- [ ] **FedEx driver barcode sample** (from client meeting) — to finalize barcode parsing.
- [ ] **Domain** decision/purchase for the platform (~$12/yr) — can help pick.
- [ ] **Stripe account** (free) — when we reach billing.
- [ ] **Pricing model** thoughts — per company / per van / per module.
- [ ] Main-portal tech direction — being discussed 2026-07-21.

---

## Revision log
- **2026-07-21** — Initial requirements captured: portal multi-tenant vision, granular permissions, pre/post flow + multiple-inspection prompt, DOT/Non-DOT toggle, optional photos + silhouette overlay, interior post-trip photos (default off), mileage/fuel questions, driver attribution, alerts (email/SMS/stoplight), history-by-driver, resolve-with-receipt, manual owner entries with immutable driver comment, van maintenance + cost analysis, reporting tab, billing/paid modules.
