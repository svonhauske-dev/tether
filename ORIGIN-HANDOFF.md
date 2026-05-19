# Origin — Project Handoff Document

*Last updated: May 19, 2026 (~1am Mountain) — **Notifications fully fixed. Three stacked bugs, all resolved.** (1) `dbSaveSchedule` was silently flipping `notifications_enabled` to false on every save because the DELETE-then-INSERT pattern lost the column — fixed in `2e34371` by reading the existing value pre-DELETE and merging it back into the INSERT. Sofia's saves had been disabling her own (and patient) notifications without anyone noticing. (2) The deployed edge function was 13 days stale (last deployed May 5, before the May 17 IF v2 work) so Bego's `_if_v2_migrated: true` config hit a legacy code path that needed a daily `pill_time` anchor — but the IF v2 frontend doesn't ask for one. Bego got zero notifications May 17 → May 18 because of this gap. Fixed by deploying via Supabase CLI tonight (installed locally, used a personal access token because OAuth login was erroring with "Unable to create CLI sign-in"). Deploy command: `supabase functions deploy recompute_notifications --project-ref yahimlivfieuknagusxp`. (3) There was no daily cron to refill the queue for users who don't open the app — fixed by the cron-mode branch in the function + pg_cron job calling it every 4 hours with `X-Cron-Secret: 7c8d3f91...` (env var in Supabase Edge Functions Secrets). Plus latent drift fixes: auto-pause now writes `status='paused'` instead of orphan `status='stopped'`; `dbGetSupps` and the function's SELECT filter `deleted_at IS NULL`; `_shared/helpers.ts isSupplementActiveOn` mirrors frontend with `created_at` floor + `deleted_at` ceiling. New `timezone TEXT` column on user_schedule (frontend writes `Intl.DateTimeFormat().resolvedOptions().timeZone` on every save; cron reads it). After deploy + manual cron trigger, Bego's queue went from 0 → 8 rows (next fire: tonight 20:00 Mexico_City, her evening slot). Auto-deploy from GitHub to Supabase Edge Functions remains NOT wired up — future function changes still require manual `supabase functions deploy`. Next time this needs to happen, the SUPABASE_ACCESS_TOKEN can be set as an env var to skip the broken OAuth flow.*

*Earlier May 18 night — **CRITICAL FINDING: Supabase edge function auto-deploy is NOT wired up to this GitHub repo.** Confirmed via Dashboard → Edge Functions → recompute_notifications which shows "Last deployed: May 5" — 13 days old. None of tonight's commits (9b461d4, bb3392a, d78dd29, e4864de) actually reached the deployed function. The production function is still running pre-lifecycle code with no cron-mode branch, no `verify_jwt = false`, no timezone reading, none of the May 18 audit fixes. **This is the root cause of every 401 we chased tonight** — the new auth path simply doesn't exist on the deployed function. The tonight-unblock (Sofia + Bego each open the app once → triggers JWT-mode recompute on the May-5 function code → queue refills for 48h) still works because the May-5 JWT path is intact. **Next-session priority is wiring up a deploy path before any further function changes.** Two options: (1) **Set up Supabase GitHub integration** via Dashboard → Project Settings → Integrations → GitHub. One-time config. Future pushes to main auto-deploy edge functions. (2) **Install Supabase CLI** (`brew install supabase/tap/supabase`) + `supabase login` + `supabase functions deploy recompute_notifications --project-ref yahimlivfieuknagusxp`. One install, manual deploys when needed — closer to standard Supabase workflow. Once a deploy path exists, run a deploy to ship 9b461d4-e4864de, then resume cron verification (CRON_SECRET is already set in Supabase env to `7c8d3f91a4e25b86c0d72f1a5e94b380fcd6a7e2185b4f93c08d6e7a1f2c5b94`, pg_cron job already registered, `timezone` column already added to user_schedule). Alternative simpler cron architectures worth considering before deploying the current design: **Vercel Cron Job** (no Supabase secret management, calls function with anon key) OR **piggyback on `process_notifications_queue`** (the every-minute drain that already works cleanly — extend it to opportunistically call `recomputeForUser` for users with low queue depth). Both sidestep the Supabase gateway auth + pg_cron + CRON_SECRET stack entirely.*

*Earlier May 18, late evening — **Web Push refill bug found + cron-based fix shipped (code only).** Sofia reported notifications stopped firing for her and Bego after the day's lifecycle merge; diagnostic SQL showed `scheduled_future = 0` in `notifications_queue` with `fired_last_24h = 8`. Root cause was a pre-existing design gap: `recompute_notifications` (the function that fills the queue) only ran on user actions from the frontend. With no user activity in 24h, the queue drained and never refilled. The merge timing was coincidental, not causal. Fix: (1) extracted the 450-line per-user recompute body into a new `supabase/functions/_shared/recompute_user_logic.ts` helper; (2) rewrote `recompute_notifications/index.ts` (now 130 lines, was 516) with two modes — JWT path (existing frontend flow) and cron path (loop over all users with `notifications_enabled=true`, refill each using their stored timezone); (3) cron path is authenticated by a new `X-Cron-Secret` header matched against the `CRON_SECRET` env var; (4) added a `timezone TEXT` column to `user_schedule` so cron knows what TZ to use per user (frontend writes `Intl.DateTimeFormat().resolvedOptions().timeZone` on every `dbSaveSchedule`, and the function persists the request's tz to this column on every JWT-path call so it stays fresh); (5) pg_cron job calls the function every 4 hours via `net.http_post`. Three drift bugs fixed in passing (none were the immediate cause but all real): line-78 auto-stop write changed from `status: 'stopped'` (orphan after W1) to `status: 'paused', paused: true`, supps SELECT gained `.is('deleted_at', null)` filter, and `_shared/helpers.ts` `isSupplementActiveOn` now mirrors the frontend with `created_at` floor + `deleted_at` ceiling. Sofia ran `ALTER TABLE user_schedule ADD COLUMN timezone TEXT;` plus the pg_cron registration SQL in the Dashboard. Deploy via Supabase's GitHub integration (auto-deploys edge functions on push to main).*

*Earlier May 18 evening — Handoff cleanup + pre-lifecycle code/file/design-system audit + HIGH cleanup pass. Audit ran as 3 parallel sweeps (code/dead-code, design system, file hygiene). HIGH findings cleared in this session: (1) deleted `src/components/PatientsPanel.jsx` (150 lines, zero callsites — superseded by PatientRoster + PatientDetailPanel); (2) deleted `src/components/ManageProtocolScreen.jsx` (315 lines, zero callsites — superseded by ProtocolLibrary + ProtocolDetailScreen); (3) stripped stale `timePreference` field from `dbUpdateSupp` PATCH body in `src/lib/api.js:199` (column still exists in DB but UI hasn't written to it since the slot system shipped). Sidebar.jsx comment that referenced PatientsPanel adherence thresholds simplified. Handoff doc earlier in evening: removed orphan `---` separators, fixed "Read-only past days" description for post-audit pattern, expanded primitives list (Popover/SidePanel/Sparkline/StatusDot/InlineTip), added clinician surfaces to module structure, re-counted API helpers (22 → 43), corrected App.jsx line count (~554 → ~2040 post-merge), restructured backlog as locked active queue (6 items) + 4 explicitly-discarded items, added "Next session — Lifecycle consolidation + soft delete" section with 3 workstreams + ordered migrations. Three DB migrations run earlier in session: `ALTER TABLE supplements ADD COLUMN deleted_at timestamptz;` (column added; 0 rows touched), `UPDATE supplements SET status = 'paused' WHERE status = 'stopped';` (0 rows), `UPDATE protocols SET status = 'archived' WHERE status = 'paused';` (0 rows — DB was already clean of the soon-to-be-dropped statuses). MED design-system items also cleared in this session: registered `Modal`, `Popover`, `SidePanel` in `src/components/design-system-page/registry.js` via small trigger-button preview wrappers in a new `src/components/design-system-page/previews.jsx` (portal-based components can't render statically in the variant grid — wrappers expose them via click-to-open). Updated `ORIGIN-DESIGN-RULES.md` Category 3: documented Modal `size` prop (default 480 / compact 360), SidePanel context-preserving editing pattern with mobile→Modal delegation via `useIsDesktop`, Popover anchored menu/picker pattern with `PopoverItem` + `PopoverSection` sub-components, and rewrote the "Required for new work" decision tree so future contributors pick the right primitive (Modal vs Modal compact vs SidePanel vs Popover) without needing to read the source.

**Lifecycle consolidation + soft delete shipped — all 3 workstreams in one session.**

**W3 (Soft delete + active-on-date adherence) — fixes the 35-of-36 bug.**
`dbGetSupps` now filters `&deleted_at=is.null` so soft-deleted rows never reach the cockpit. `dbDeleteSupp` is now a PATCH that writes `deleted_at = now()` (was a hard DELETE). New `dbHardDeleteSupp` preserves a real DELETE path for the two cascade/rollback callsites in App.jsx (orphans on protocol delete, rollback on failed `activateReceived` bulk insert) — those write paths intentionally hard-delete since the rows were never user-acknowledged. `isSupplementActiveOn(supp, date)` in `lib/time.js` gained a `deleted_at` ceiling check as defense in depth. Past-day adherence math iterates over the filtered set, so deleting a supp cleanly drops its expected slots from both numerator and denominator (no retroactive % shift).

**W1 (Supp Stop → Pause consolidation).**
Dropped the `stopped` state entirely. EditForm: removed the archive view (`form.status === 'stopped'` branch), the Stop button, the Stop confirm Modal, and the `onStop` / `onResume` / `showStopConfirm` plumbing. App.jsx: deleted `stopSupp`, `resumeSuppFromForm`, and the dead `handleEditFormTogglePause` handler; `resumeSupp` now writes `{ status: 'active', paused: false }` (no more `stopped_at`). `isStoppedSupp` removed from `lib/time.js`. ProtocolDetailScreen tabs flipped from `[Active, Stopped]` → `[Active, Paused]`; Active tab now shows strictly `status='active'` (paused supps no longer mixed in at the bottom). New Paused tab body: `[name + (paused) Badge] ———— [trash icon] [play icon]`. Trash routes through `onDeleteSupp` → soft-delete via `dbDeleteSupp`; Play routes through `onResumeSupp` → status='active'. Active-tab pause icon button is now Pause-only (no toggle-to-resume since paused supps aren't here). EditForm "Edit item" footer ternary that gated on `form.status !== 'stopped'` simplified — that branch is unreachable now. `adherence.js` `getUpcomingEndings` filter swapped `s.paused || s.status === 'stopped'` → `!isActiveSupp(s)`; stopped-supp activity-log branch removed.

**W2 (Protocol Pause → Archive consolidation).**
Dropped the `paused` state for protocols entirely. `dbPauseProtocol` removed from `lib/api.js`; `pauseProtocol` handler removed from App.jsx along with the two `onPauseProtocol={pauseProtocol}` prop callsites. ProtocolDetailScreen: removed `isPaused` and `onPauseProtocol` props; `isArchived` simplified to `!isActive` (any non-active protocol is archived); overflow menu collapsed — Active state offers only Archive (+ Send to patient for clinicians), Archived state offers Activate + Delete. ProtocolLibrary: removed dead `" · Paused"` row badge (the "archived" tab already swallows both states via `status !== 'active'`). `adherence.js` activity-log: removed dead `'paused_protocol'` branch.

**Net surface change:** UI now has exactly two lifecycle states per entity. Supplements: Active / Paused (with soft-delete via trash icon on paused rows). Protocols: Active / Archived. Stop button gone from EditForm; Pause-protocol menu item gone from ProtocolDetailScreen overflow. All Vite-transformed files parse 200 on the dev server.*

*Earlier on May 18 (afternoon) — Phase 3 of the clinician-surfaces audit shipped: **Patient Roster as the default clinician landing** (`483eec0`). New `PatientRoster.jsx` — heading + 3 KPI cards (Total / Need review / Quiet 7d) + filter chips + sortable table (Patient · 7d · 30d · Trend sparkline · Protocols · Last log · Status). Default sort: alphabetical by name (Sofia: "alphabetical always"); columns are click-to-sort, numeric columns default to descending for worst-first triage. Whole-row click opens patient detail. `patientStats` enrichment expanded to capture `lastLogDate` (drives the Last log column + Quiet 7d KPI). Right aside collapses on roster view — there's no patient-scoped content to host; aside reappears when a patient is selected or on My Origin. New `activeNavItem` value `'roster'` (default for clinicians); `'home'` is reserved for My Origin. New **Overview** sidebar entry at top with LayoutDashboard icon — explicit nav back to roster from anywhere, addressing the gap where the only way back was clicking the same patient twice. Earlier in the session: §748 modal-lane completion. `bf41bd3` shipped two new primitives — `Popover.jsx` (anchored floating panel + `PopoverItem` + `PopoverSection`) and `SidePanel.jsx` (right-side 480px panel on desktop, delegates to Modal bottom sheet on mobile) — and migrated 3 misused modals: Patient actions overflow → Popover, Send-to-patient picker → Popover, EditForm → SidePanel. SupplementRow pencil layout shift fixed (always rendered, opacity-faded on hover) so the column doesn't bounce when the cursor passes over rows. `8f1e752` added `size` prop to Modal (compact 360 / default 480), applied `size="compact"` to 6 confirm modals (Archive patient, Stop supp, Orphan supps, Activate received protocol, Archive/Delete protocol, Delete supplement), and flipped flowing-prose body copy from JetBrains Mono → Space Grotesk in confirm bodies + HelperText globally + empty-state subtitles. Principle: monospace for UI labels, identifying names, button text, and data; sans-serif (Space Grotesk) for any flowing-sentence prose. `6073549` converted ProtocolDetailScreen overflow ⋯ menu + Send-to-patient picker to Popovers anchored to the same ⋯ trigger. Then **merged with mobile UX audit from origin/main** (commit `1c6eaec`) — one conflict in App.jsx resolved by keeping both upstream's `logAtTarget` state and the new `'roster'` activeNavItem default. All my changes (PatientRoster wiring, Overview entry, aside collapse, lastLogDate enrichment) preserved through the merge. Next: build the Protocol Templates surface (per design conversation — `is_template` flag on protocols, new sidebar entry below My Origin, "+ New template" + per-row Send-to-patient popover + "Use for myself" clone action).*

*Earlier on May 18 — full mobile patient UX/UI audit shipped end-to-end across 6 sessions on branch `worktree-session-2-autocomplete-expand` and merged into main. All 12 audit recommendations + 4 audit-discovered bugs + the design decision ladder (D1–D5) implemented. Highlights: mobile week strip (extracted DayCell with compact mode), Hero rewritten around a single state-helper (anchor-aware copy ladder, Start-day decoupled per D1, anchor-info as primary status line, success-green unified to status row, inline-edit preserves prefix), past-day pattern (eyebrow inside Hero card with read-only/editing suffix, Edit in header), Day-1 inline tip + reusable `InlineTip` primitive, log-at pill + `LogAtSheet` time-picker with per-supplement timestamp persistence in `daily_logs.checked` (new `{ checked: true, at: "HH:MM" }` shape coexists with legacy `true` via backwards-compat reads — no DB migration needed), take-all on slot icon with first-run InlineTip hint, Onboarding Step 2 live "Your day will look like" preview. Slide-in screen header icons normalized to 18px. Production bundle ~387 KB pre-merge.*

*Earlier May 18 — Three bundled clinician commits landed and pushed: `961d2d6` clinician backend (DB migrations: `clinician-link-migration.sql` adds `shares_adherence_with_clinician` consent toggle + patient↔clinician RLS, `clinician-notes-migration.sql` adds `clinician_patient_notes` table; analytics math in `lib/adherence.js`: `calculateProtocolAdherence` + per-supp + per-slot + `getUpcomingEndings` + `buildActivityLog`; notes API in `lib/api.js`: `dbGetClinicianNote` / `dbUpsertClinicianNote` / `dbGetClinicianNotes`; demo-seed stamps demo patients with `shares_adherence_with_clinician=true`). `738956c` clinician surfaces (PatientAnalyticsPanel new; ProtocolLibrary gains adherence-per-row + send-to-patient; ProtocolDetailScreen send-to-patient flow in overflow menu; SettingsScreen `desktop` prop swaps container shape; Modal primitive `useIsDesktop` → centered 480px / 80dvh card on desktop instead of bottom sheet; WeekStrip `activeSlotIds` plumbed through DayCell so IF v2 ring math doesn't inflate; index.html hides native scrollbars globally). `2ce9af7` chore (gitignore `supabase/.temp/`, untrack `cli-latest` tool artifact). Plus prior `c94792d` clinician desktop — primitives + sidebar revival + top bar restructure. Open §748 decisions still on the table: (1) modal sizing variants (compact/default/wide), (2) Onboarding + IFMigrationScreen desktop treatment, (3) Settings/Library/Detail host when aside collapses on roster view, (4) EditForm duplication across desktop/mobile branches. Next implementation: Phase 3 (Patient Roster as default landing).*

*Previous milestone (May 17): IF v2 shipped + follow-up bugs fixed + full frontend/backend audit done across three rounds. Critical: schedule-not-saving bug traced to `dbGetSchedule` returning every user's rows because RLS wasn't on; client-side `user_id=eq.` filter added to dbGetSchedule + dbGetAdherenceCounts + dbGetSupplementHistory + dbGetReceivedProtocols; RLS enabled at the DB perimeter via Supabase Dashboard; UNIQUE constraints added on `user_schedule(user_id)`, `daily_logs(user_id, log_date)`, `user_supplement_history(user_id, name)`. Design system tightened: dead Light/Dark/Terminal-* themes deleted (production bundle −10.5KB), single makeSegBtnStyle helper replaces three local copies, shadows.elevated added, touch.row applied to multi-line rows. Backend hardened: cascade-delete on protocol delete, transactional rollback on activateReceived, refreshSession memoized, recomputeNotifications surfaces failures via toast.*
*Owner: Sofia von Hauske (sofiavonhauske@gmail.com)*
*Purpose: Hand this document to a fresh AI chat to pick up Origin work without losing context.*

---

## Maintenance Protocol (NEW)

**This document is the source of truth for Origin's state.** At the end of every working session:

1. Update the "Last updated" line at the top with date and one-line session summary
2. Add new shipped features to "Features Shipped" section
3. Add new bug fixes to "Bug History"
4. Update "Today's Major Work" with the session's actual passes
5. Update "Pending Queue" — remove completed items, add new ones surfaced
6. Update "Known Stale / Legacy Items" if any new debt is created or cleared
7. Update Supabase schema reference if columns/tables changed
8. Update component inventory if new components shipped or any renamed/removed

**Sofia's workflow:** download updated doc → save to repo → next session reads it fresh.

Both Claude (chat) and Claude Code (in Cursor) reference this document for continuity. Keep it accurate; future sessions depend on it.

---

## What Origin Is

Origin (formerly Tether) is a personal supplement and medication tracker built around anchor-based scheduling. The core insight: most supplements need to be timed relative to *when you take your medication* (or *when you wake up*, or *when you eat*) — not at fixed clock times. Origin makes those cascading schedules legible and trackable.

**Live:** [origin-protocol.vercel.app](https://origin-protocol.vercel.app)
**Repo:** [github.com/svonhauske-dev/origin](https://github.com/svonhauske-dev/origin)
**Stack:** React + Vite, Supabase (project `yahimlivfieuknagusxp`), Vercel
**Built via:** Claude Code in Cursor with AI orchestration

**Users (production, 4 registered accounts):**
- Sofia (sofiavonhauske@gmail.com) — `68848e43-3c43-4259-b4ff-bc4f8e3a37ab` — active
- OVH (ovh@contranyc.com) — `dce9c618-7475-4f39-a492-8b6b43c6a339` — display name "Tulum", active
- Bego (bego_bayon@hotmail.com) — `db10e317-0089-4dad-8368-5b69f26ccc11` — display name "Bego Bayón", active (IF mode)
- dra.orozcobp@gmail.com — signed up May 3, signed in once May 4, no schedule row, abandoned onboarding

**Activity totals (as of May 11):** 49 supplements across all users, 30 daily logs, 68 notifications queued, 3 users with schedule rows, 2 users with `notifications_enabled = true`.

---

## Visual Identity (NEW — locked May 11)

**Direction:** Terminal Achromatic — precision-instrument aesthetic inspired by Marathon (Bungie) and Raw Materials editorial design.

After exploring four directional themes (Clinical Instrument, Editorial Material, Soft Futurism, Terminal Precision) and five Terminal color variants (Amber, Cyan, Phosphor, Achromatic, Magenta), **Terminal Achromatic** was selected as Origin's production identity. The other directions and variants remain accessible via the dev theme switcher for future reference.

**Palette (Achromatic):**
- Surface base: near-black `#0D0D0D`
- Surface elevated: `#1A1A1A`
- Text primary: pure white `#FFFFFF`
- Text secondary: `#A0A0A0`
- Text muted: `#666666`
- Accent: pure white `#FFFFFF` (no chroma)
- Borders: subtle `#2A2A2A`, strong `#404040`
- Status success: muted green `#5FE090`
- Status danger: cool red `#FF6060`
- Status warning: amber `#FFC040`
- "Now" state: pure white tint

**Typography:**
- `fontBody` — JetBrains Mono (body text, button labels, supplement names)
- `fontHeading` — Space Grotesk (section labels, greetings, large displays)
- `fontData` — JetBrains Mono (numbers, times, percentages, technical content)

**Radius:**
- Zero across all UI elements (`radius.xs/sm/md/lg/xl` all = 0)
- `radius.full` (9999) reserved for genuinely circular shapes only (adherence rings, avatars, status dots)

**Borders:**
- 1px sharp, no shadows
- Depth via tonal value, not material effects

**Production theme system:**
- Achromatic is the ONLY production theme
- `VALID_PREFS = ["achromatic"]` — no other production preferences
- Light, Dark, and System preferences silently migrate to Achromatic on next load
- Settings theme picker removed entirely (no choice in production)
- Dev theme switcher retained for variant exploration (Light, Dark, Terminal Amber, Cyan, Phosphor, Achromatic, Magenta)

**Reference voices:** Marathon (Bungie), Raw Materials editorial design, NASA mission control, lab terminals. NOT: wellness apps, lifestyle apps, generic productivity SaaS.

---

## Design System State

The design system uses a token-based theme architecture. All components consume `theme.*` tokens via `useTheme()`. Single token change propagates to every relevant element.

**CSS variable font system:** `typography.fontBody/fontHeading/fontData` resolve to `var(--font-body/heading/data)`. ThemeProvider sets those CSS vars on every theme change. All existing components automatically get the right font for whichever theme is active.

**Primitives:**
- `Button` — variants: primary, secondary, tertiary, destructive, icon, selector, startDay (+ size: default/compact)
- `Input` — text / time / number variants. `colorScheme: dark` so native UI renders correctly. Time picker indicator hidden globally in index.html.
- `Card`
- `Badge` — variants: now / missed / category / neutral
- `Label`
- `Modal` — bottom sheet on mobile (drag-to-dismiss), centered modal on desktop (`useIsDesktop` hook, 480px max / 80dvh max). `size` prop: `compact` (360px) / `default` (480px).
- `Toast` — supports optional `action` prop for Undo affordances, top-anchored
- `TabBar` — keyboard-accessible tab buttons (`minHeight: touch.min`)
- `InlineTip` (NEW May 18) — dismissible inline tip, `localStorage`-backed under `origin.tip.<id>`; powers Day-1 explainer + take-all hint
- `Popover` (NEW May 18) — anchored to a trigger; replaces misused modals for overflow menus + send-to-patient picker
- `SidePanel` (NEW May 18) — slide-from-right panel; hosts EditForm on mobile and desktop
- `Sparkline` — single-color SVG trend line for dense list rows (clinician roster)
- `StatusDot` — colored 4–6px dot keyed by status token

**Notable patterns:**
- Pill width-locked via CSS `::before` pseudo-element so bold-active state doesn't cause layout shift
- Border hierarchy inverted: inactive selectors use `borderSubtle`, active selectors use `accent` border
- `schedSaveRef` ref pattern bridges ScheduleModal's internal save handler to footer button
- Three-tier helper text convention (T1 section explanation, T2 item description, T3 inline unit hint)
- Copy voice convention — "considered, precise instrument":
  - Architectural restraint as baseline
  - Sentence case throughout (not title case)
  - No exclamation marks, no marketing energy
  - All inline errors and toasts: period-free
  - Generic noun is "item" not "supplement" (Origin tracks Oral/Rx/Injectable/Topical)
  - "Your" not "the" (your protocol, your schedule, your anchor)
  - Reference voices: Bear, Things 3, Apple Health for mobile; Marathon, Raw Materials, lab terminals for visual identity

---

## Features Shipped

**4 schedule modes UI, 5 underlying values** (default for new users = No Schedule):
- No Schedule — pure checklist, no times, no notifications
- Anchor (groups Medication + Wake Up) — onboarding and Manage Protocol show 4 cards in a 2×2 grid; tapping Anchor reveals a sub-selector below the grid (Medication / Wake Up); DB stores `medication` or `wakeup` directly (never `anchor`; no migration needed)
- Intermittent Fasting — built around a fixed eating window (IF v2, shipped May 17): user sets a daily window start time + duration (4/6/8/10/12 hr) + meal count (2 or 3) + optional Evening slot. Slot times are absolute (like Fixed mode), not relative to a daily anchor. Existing v1 users (anchor-relative window) are upgraded through IFMigrationScreen on next load. New fasting users skip the migration screen.
- Fixed Times — same schedule every day

**Categories:** Oral, Rx, Injectable, Topical (with category-aware form behavior)

**Slot vocabulary (non-IF modes — Medication, Wakeup, Fixed):**
- Anchor (Medication Anchor mode only)
- Pre-Breakfast, Breakfast
- Pre-Lunch, Lunch
- Pre-Dinner, Dinner
- Evening (time-of-day bucket — Fixed time OR Before sleep)
- Anytime (explicit pill, stored as `slots: []`)

**Slot vocabulary (Intermittent Fasting v2):** entirely separate IDs — never appear outside fasting mode.
- Fasted (pre-window — 30 min before eating window opens)
- Meal 1 (window opens — fires unconditionally as the "your eating window is open" notification)
- Pre-Meal 2, Meal 2 (visible when meal_count ≥ 2)
- Pre-Meal 3, Meal 3 (visible when meal_count ≥ 3)
- Evening (only when evening_mode is set — Fixed time OR Before sleep)
- Anytime (explicit pill, `slots: []`)
- Window closes — unconditional 30-min warning, suppressed when a meal slot with supplements fires at the same minute (so default pre_meal_window=30 doesn't stack a meal notification on top of the closing warning).

**Recoverable late state** — slots that pass without check-ins get a small muted ochre "late" badge. Slot card stays standard. Frame is "you can still take this," not "you failed."

**Protocol Library** (replaces ManageProtocolScreen, May 16):
- Slide-in screen at zIndex 101 with Protocols nav button at top-right of home screen
- Two tabs: Active / Archived, both always visible with empty states
- Active tab lists protocols with supplement count and end date (if scheduled)
- Archived tab lists all non-active protocols alphabetically
- "+" button opens two-step new protocol modal:
  - Step 1: Name + Duration (Indefinite / Scheduled with dates / For a set time: N weeks or months)
  - Step 2 (skipped if no active protocols): Intent — Replace current / Stack on top / Save for later
  - Intent "replace": archives all active protocols + resets their supplements, creates new as 'active', shows toast "[Name] created · [Old] archived"
  - Intent "stack": creates new as 'active', existing protocols unchanged
  - Intent "save_later": creates new as 'archived' (library entry, not active)
- Tapping a protocol row pushes ProtocolDetailScreen

**ProtocolDetailScreen** (new, May 16, zIndex 102):
- Inline name editing in header (tap → input → blur saves)
- Two lifecycle action buttons at top of content, above tabs: varies by protocol status
  - Active: Pause + Archive (side by side)
  - Paused: Activate + Archive (side by side)
  - Archived: Activate + Delete (side by side)
- Confirmation modals for each destructive action
- Two tabs: Active supplements / Stopped supplements (both always visible with empty states)
- "+" FAB-style button to add supplement directly into this protocol
- Supplement rows show name + dose, tap to edit

**Protocol lifecycle semantics:**
- Active: shows on home screen. Pausing/archiving resets all supplements in that protocol to `status: 'active', paused: false` (template reset, not a user-state change)
- Multiple active protocols stack: home screen shows supplements from all active protocols simultaneously
- `homeSupps` filter: `(!s.protocol_id || activeProtocolIds.has(s.protocol_id))` — supplements without protocol always appear

**Settings panel** (slide-in screen, view-based sub-navigation, May 16):
- Main view: Schedule → "Edit schedule" row / Account → "Edit account" row / Notifications / Sign out
- Schedule view: ScheduleTab inline (same component used in old ManageProtocol)
- Account view: display name, email, password change
- Back button returns to main view or exits Settings
- (Theme picker removed in production — Achromatic is the only theme)

**Onboarding flow** for new users:
- Triggered when no `user_schedule` row exists
- Two-step: schedule type selection → optional configuration (skipped for No Schedule)
- Full-screen, not a modal
- Returns success/failure to gate dismissal

**Auth:** Supabase with refresh tokens (stores access + refresh, `supa()` helper retries on 401)

**Manage Account** (now dissolved into Settings as inline sections):
- Display name (editable, used for personalized greeting)
- Email (with confirmation flow via Supabase)
- Password change (with complexity validation)

**`user_profiles` Supabase table** — separate from auth.users, holds display_name and any future user metadata. RLS-protected per-user.

**Full auth screen validation:**
- Email regex check, password complexity rules (8+ chars, uppercase, number, special character)
- Live PasswordRule checklist with check icons
- Submit button disabled until valid
- Three error cases handled inline (wrong credentials, email taken with "Sign in instead?" link, generic)
- Mode-distinct copy: "Welcome back" / "Pick up where you left off" for sign-in, "Hello" / "Let's set up your protocol" for sign-up

**Read-only past days** (mobile + desktop):
- Past days default to read-only mode
- Mobile (post-May 18 audit): no opacity dim. Hero card carries an eyebrow `Viewing [date] · read-only` (suffix `text.muted`) or `Viewing [date] · editing` (suffix accent white) when editing. Edit/Done lives in the top-right of the App header (replaces the `+` icon on past days, alongside the Library icon). Late-slot badge uses `variant="neutral"` (achromatic) in read-only mode, `variant="missed"` (warning ochre) when editing.
- Desktop: PAST DAY label in Today panel header, slot rows still expandable for review. Edit button in panel header.
- Edit mode allows ONLY checkbox toggling, pill_time editing, and (post-Session 5) log-at retroactive timestamps.
- Add/edit/delete supplements and schedule editing remain hidden in both states

**Length of treatment (per-supplement, via `treatment_mode` column):**

Three modes, default `indefinite`:
- **Indefinite** — no date bounds, always active. `isSupplementActiveOn()` returns true unconditionally.
- **Scheduled** — uses `starts_at` and/or `ends_at` date fields. Adherence and notifications filtered by date bounds. Edge function auto-stops supplements when `ends_at ≤ today` (sets `status = 'stopped'`, `stopped_at = today`).
- **Cycled** — uses `cycle_on_value` + `cycle_on_unit` + `cycle_off_value` + `cycle_off_unit`. Modulo math in `isSupplementActiveOn()`: `daysSinceStart = (date - starts_at) in days`, `cycleDays = onDays + offDays`, `active = (daysSinceStart % cycleDays) < onDays`. Days-of-week picker hidden for cycled mode (all days implied). Which-days adherence check skipped for cycled supps. Cycle units: `days`, `weeks`, `months`.

Treatment selector appears in EditForm between Category and "When to take it" sections (reordered Treatment-first in commit 28b3e3b).

Insights panel (desktop) shows "Upcoming" section with supplements ending in next 14 days. Format: "Berberine course ends Fri" (up to 3 visible, "+N more" overflow).

**Stop a supplement (via `status` column):**
- `status` column on supplements: values `active`, `paused`, `stopped`. Replaces legacy `paused` boolean (which still exists but unused).
- Stop button in EditForm (existing supplements only) → confirmation modal → sets `status = 'stopped'`, `stopped_at = today`
- Confirmation modal: "Stop this supplement? This moves it to your archive. You can restart anytime."
- Archive (Stopped tab in Manage Protocol) shows: name + dose + stopped date + adherence count
- **Note:** Stopped supplements cannot currently be restarted from UI (despite the confirmation copy suggesting "you can restart anytime"). Real product gap to address.
- Delete moved from EditForm to Stopped tab only (gated behind Stop placement)
- Friction hierarchy: Pause = toast undo, Stop = confirmation modal, Delete = modal (gated behind Stop)

**Supplement name autocomplete:**
- Static curated list (~300 entries) in `src/data/supplements-database.js`
- Per-user personal history table `user_supplement_history` (RLS-protected)
- 3+ character trigger with 200ms debounce
- Dropdown below input, max 5 results (capped to fit without scroll)
- Personal additions automatic on new supplement creation (not on edits)
- Free-text always allowed (never blocks input)
- Names only — no dose pre-fill (deliberate scope to avoid recommending)

**Cascading meal times (Phase 1):**
- Replaces per-meal manual offsets with global cascade rules
- `first_meal_offset_hours` — hours after anchor before first meal
- `meal_interval_hours` — hours between subsequent meals (uniform spacing)
- `evening_mode` — Off / Fixed time / Before sleep
- Auto-infer migration silent for uniform legacy schedules

**Fixed Times pre-meal window (Phase 2 Prompt B):**
- Single global `pre_meal_window` field for Fixed Times mode
- Replaces individual pre-meal time pickers
- 4 meal time pickers (Breakfast/Lunch/Dinner/Evening) + global pre-meal offset
- Pre-meal slot times derived from meal_time minus pre_meal_window

**Injectable/Topical inline (Phase 2 Prompt C):**
- Unified slot picker for all four categories
- Icons render to right of name (variable position based on name length)
- Lucide icons: Pill (Rx), Syringe (Injectable), Droplet (Topical), no icon for Oral
- Migration moved existing Injectable/Topical to slots: [] (Anytime)

**IF window closing notification + cleanup:**
- "Your eating window opens" fires unconditionally at anchor time (independent of supplements)
- "Your eating window closes in 30 minutes" notification 30min before window end
- New slot IDs: `window_open` and `window_closing` (distinct from `rx` for semantic clarity)
- rx slot hidden from IF mode in EditForm
- Migration removed rx tag from any IF user supplements
- **Note — client SLOTS vs. edge function slot IDs:** `src/lib/notifications.js` exports a client-side `SLOTS` object with 8 entries (`rx`, `pre_breakfast`, `breakfast`, `pre_lunch`, `lunch`, `pre_dinner`, `dinner`, `after_dinner`) used for UI display. `window_open`, `window_closing`, and `course_end` exist only inside the `recompute_notifications` edge function and `notifications_queue` table — they are not in client SLOTS and never will be.

**OVH timezone fix:**
- visibilitychange listener compares `Intl.DateTimeFormat().resolvedOptions().timeZone` to last known
- If different on app foreground, immediately calls `recomputeNotifications(token)` with new timezone
- Wipes and rebuilds 48-hour window at correct local times
- Self-corrects automatically next time user opens the app

**Web Push notifications (fully shipped):**
- Service Worker registered at `/sw.js`
- VAPID subscription flow: `subscribeToPush()` / `unsubscribeFromPush()` / `getCurrentSubscription()` in `src/lib/notifications.js`
- Notifications toggle in Settings (with iOS PWA install gate + permission-denied copy)
- `recompute_notifications` edge function: generates today + tomorrow (48hr window), auto-stops supplements past `ends_at`, fires for all slot types + IF window events + course_end
- `process_notifications_queue` edge function: pg_cron every minute, sends Web Push via `web-push@3`, auto-deletes dead subscriptions (404/410)
- Slot IDs in queue: `rx`, `pre_breakfast`, `breakfast`, `pre_lunch`, `lunch`, `pre_dinner`, `dinner`, `after_dinner`, `window_open`, `window_closing`, `course_end`
- Travel timezone auto-fix: `visibilitychange` listener triggers recompute when timezone changes
- 2 of 4 users currently subscribed, 68 notifications in queue as of May 11

**Notification opt-in prompt (NotificationPrompt.jsx):**
Full-screen prompt shown to new users immediately after first sign-in when they have no existing push subscription. "Want reminders?" heading with body copy ("Origin can ping you when it's time to take your medication and supplements. You can change this any time in Settings."), a primary "Enable reminders" button, and a tertiary "Maybe later" button. Triggered in App.jsx via `needsNotificationPrompt` state (set when subscription check returns null on first load). Entirely skippable — both paths dismiss the prompt. Settings toggle remains the persistent control.

**Notifications toggle refactored to On/Off selector:**
- Settings (SettingsScreen.jsx) and dead-code SettingsModal.jsx — replaced iOS-style circular switch with two `Button variant="selector"` buttons (On / Off), consistent with Treatment, Category, and Anchor sub-mode selectors. Disabled state on On when permission = denied; helper text covers all permission states. Design system registry updated with three binary selector examples. Commit `f897a42`.

**HIG foundational accessibility (shipped May 12):**
- **Touch targets:** SlotCard expand header converted from `<div>` to `<button aria-expanded>`. SlotCard checkbox converted from `<div>` to `<button aria-label aria-pressed>` with 44pt tap area (padding: 10 / margin: -10, visual 24px preserved). WeekStrip nav arrows: `minWidth: 32, minHeight: 32`. SupplementRow pencil: `minWidth: 32, minHeight: 32`. Hero "edit" button: `minHeight: touch.min` with inline-flex centering.
- **`prefers-reduced-motion`:** Global CSS rule kills all transitions and animations. Four HIG-compliant exceptions re-enabled via CSS class overrides: Loader rings/dot, Toast slide-in, SupplementRow checkbox transition, and row hover (SupplementRow, SidebarNavItem, DayCell). CSS classes: `.toast-item`, `.supp-checkbox`, `.supp-row`, `.sidebar-nav-item`, `.day-cell`. Loader exception in its inline `<style>` block. All others in `index.html`. Rationale comments at each override site. Category 9 of ORIGIN-DESIGN-RULES.md and CLAUDE.md updated with exception list and future-contribution guidance.
- **`:focus-visible`:** `outline: 1px solid #FFFFFF; outline-offset: 2px` in `index.html` — keyboard navigation only, no mouse focus rings.
- **Modal keyboard:** Escape key closes any open modal. Tab key trapped within sheet (cycles first→last focusable element). First focusable element auto-focused 50ms after open (allows enter animation).
- Commits: `f2b3da4` (touch targets + reduced-motion + focus states), `c6ff004` (reduced-motion exceptions).

**Design system reference page (`/design-system` — public, portfolio-linked):**
- Publicly accessible at `origin-protocol.vercel.app/design-system`
- Foundation sections auto-rendered from `design-system.js`: Palette (all 7 themes), Typography scale, Spacing scale, Radius tokens, Shadow tokens
- Component registry in `src/components/design-system-page/registry.js`: all primitives (Button 14 variants, Input 5, Card 4, Badge 4, Label 2, AdherenceRing 6) and all composed components (Hero 5, SlotCard 5, SlotRow 4, SupplementRow 5, DayCell 5, InsightsPanel 2)
- Playgrounds for interactive primitives: Button, Input, AdherenceRing — live theme-aware rendering
- DevThemePicker always shown on this route (even in production) for portfolio theme exploration
- Full-width IntroHeader band: "Origin Design System" heading + description + "← Back to Origin" link
- Mobile: sidebar collapses to sticky horizontal scroll nav strip (1024px breakpoint, same as app)
- `noindex` meta tag (not search-indexed but portfolio-visible)
- `/design` redirects to `/design-system` (legacy URL)
- Stub data: all generic (Vitamin D3, Magnesium Glycinate, Metformin, Tirzepatide) — no personal data

**Loader animation:**
- Full-screen wave-ring loader for auth and protocol load states
- Minimum 3000ms display time (commit 3c38e6a) prevents jarring flashes on fast loads
- Frozen theme colors during animation prevent reset on theme switch
- Single continuous instance across auth and protocol loading (commit dab4f54)
- Inline loader variant for in-button / toggle loading states

---

## EditForm — Current Field Order

(Verified May 11 via diagnostic. Order matters — Treatment was reordered first within its grouping in commit 28b3e3b.)

1. **Name** — text input with autocomplete (history + static DB, max 5 results, no scroll)
2. **Dose** — text input
3. **Notes** — text input
4. **Category** — selector: Oral / Rx / Injectable / Topical
5. **Treatment** — selector: Indefinite / Scheduled / Cycled
   - If Scheduled: Starts (date) + Ends (date, optional)
   - If Cycled: On (value + unit) + Off (value + unit) + Starts (date)
6. **When to take it** — selector: rx (shown if mode = medication OR already tagged), pre_breakfast, breakfast, pre_lunch, lunch, pre_dinner, dinner, after_dinner, Anytime
7. **Which days** — circle day-of-week buttons (hidden when treatment_mode = cycled)
8. **Stop button** — edit mode only, at bottom, destructive style

---

## Desktop Responsive Home (NEW — shipped May 11)

Locked direction: responsive (same content, broader layout on desktop). Hard breakpoint at 1024px. Below: mobile rendering exactly as today. Above: new two-region cockpit layout with persistent left sidebar.

**Phase 1 — Sidebar + layout shell:**
- 240px persistent left sidebar
- Brand wordmark at top ("Origin")
- Nav items: Home (active), Protocol
- Settings at bottom of sidebar (bottom-left)
- Account avatar top-right of content area
- Greeting "Hello, [name]" top-left of content area
- Sidebar slightly elevated/darker than content (subtle frame effect)

**Phase 2 — Week strip:**
- 7 day cells in horizontal grid, full content width
- Each cell: day abbreviation + date number + 56px adherence ring with % inside
- Today's cell: "TODAY" badge using `nowBadgeBg/nowBadgeText` tokens (separate from selected treatment)
- Selected day: slate-blue-equivalent border + tint (now using Achromatic's white accent)
- Today and Selected are SEPARATE visual signals — both stack when today is selected
- Past navigation arrows above strip (◀ ▶), forward disabled at current week
- Rolling 7-day window, today on the right
- 100% adherence rings use `status.success` (muted green) color
- Click any past day → loads that day in Today panel below
- AdherenceRing component shared between Hero (mobile) and DayCell (desktop)

**Phase 3 — Today panel:**
- Compressed slot rows (one line per slot) with click-to-expand for supplement detail
- Slot row shows: name, time, completion status (e.g., "3/4"), chevron
- Current slot auto-expanded by default (based on time-of-day)
- Past days: all slots collapsed by default (user clicks to expand for review)
- Expand-on-click works in read-only mode (not gated on edit mode)
- Edit pencil on supplement rows revealed on hover
- Past day Edit/Done button in panel header
- Hero info distributed (no separate Hero card on desktop) — anchor time + Start my day CTA in panel header
- Hover states throughout via `theme.surface.hover` token

**Phase 4 — Insights panel:**
- "This week" section: big % number + 7-bar sparkline (today's bar in accent color)
- "Current streak" section: visible only if streak ≥ 2 consecutive 100% days
- "Your schedule" section: single line summary (e.g., "Medication Anchor · 06:39 consistent")
- "Upcoming" section: supplements with length-of-treatment ending in next 14 days (hidden if empty)
- Quick actions: "Configure schedule" + "Manage protocol" buttons
- Sections separated by hairlines (no nested cards)

**Engineering notes:**
- App.jsx detects `window.innerWidth >= 1024` on mount + resize
- Desktop branch renders new layout; mobile branch unchanged
- Below 1024px: pixel-for-pixel identical to mobile experience
- Above 1024px: full desktop cockpit

---

## Bug History (for context)

- **Schedule save 403** — was an RLS policy issue. Fixed by full SELECT/INSERT/UPDATE/DELETE policy reset on `user_schedule` table.
- **Auth refresh tokens** — implemented after users were getting signed out hourly. Stores access + refresh, `supa()` retries on 401.
- **Onboarding routing for new users** — initially didn't fire. Bug was deployment-side (stale code), not code-side.
- **Centered Modal** — replaced bottom sheets after iOS safe-area struggles; then switched back to bottom sheets with drag-to-dismiss; then bottom sheets on mobile + centered modals on desktop.
- **Day-of-week default** — empty by default, silently fills to all 7 if user saves without picking.
- **Consistent-time bug** — when switching from consistent → flexible, today's pre-populated `pill_time` clears (so "Start my day" CTA reappears) — but only if the user hasn't checked anything off yet today.
- **OVH timezone bug** — OVH traveled Mexico→Austria, notifications fired on Mexico time because `user_profiles` had no timezone column and queue only refreshed on user actions. Fixed via visibilitychange listener.
- **Autocomplete dropdown scroll on iOS** — multiple fix attempts failed (CSS overflow, portal, body scroll lock), final solution was capping results to 5 (no scroll needed).
- **Manage Protocol scroll-to-top** — mount-only useEffect fired once at app boot when screen was hidden, never refired. Fixed by watching `isOpen` prop.
- **Modal scroll-to-top on every open** — same pattern, fixed via Modal primitive's bodyRef + isOpen useEffect.
- **Radius leak round 1 under Terminal themes** — UI selectors + chevron buttons + settings gear used `radius.full` (9999) directly. Fixed by referencing `radius.button` token instead, leaving `radius.full` for genuinely circular shapes.
- **Radius leak round 2** — Round 1 fix didn't catch selector variants and day-of-week picker. Category, Treatment, When-to-take selectors and Which-days circles all still rendered circular under Achromatic. Fixed in commit a14f8e3.
- **Pause/resume broken (May 16 morning)** — `togglePause` only flipped the `paused` boolean but `isPausedSupp` checks `status === 'paused'`. Since `status` was always `'active'`, pausing had no visible effect — toast fired but nothing changed. Fixed by having `togglePause` set `status: 'paused'` when pausing and `status: 'active'` when resuming, keeping both fields in sync. Also fixed `resumeSupp` (stop→resume flow) which was incorrectly calling `openEdit` after resume, causing unexpected edit form to open; and added null guards to `openEdit` for `slots`/`days` fields.
- **WCAG contrast audit (May 12)** — full inventory of `text.muted` (#666666, ~3.5:1 contrast) usages across all components. Audit-only doc committed as `1fcff08`. Migration pass (→ `text.secondary`, #A0A0A0, ~7.7:1) shipped May 15 across 7 files (Onboarding, ScheduleTab, ManageProtocolScreen, ManageSupplementsSheet, SlotCard, SlotRow, TodayPanelHeader). Two intentional `text.muted` exceptions retained: ANYTIME_SLOT decorative bullet (App.jsx) and disabled nav arrow in WeekStrip (WCAG exempts inactive controls).
- **Selected day visual hierarchy inverted** — slate blue tint was too subtle against white-elevated cells, making selected cell look recessed. Fixed by strengthening opacity values.
- **Past day expansion locked in read-only mode** — chevron click toggle was gated on `!isReadOnly`. Fixed by removing that gate (only checkbox/edit are gated, expansion is always available).
- **Week strip adherence ring stale after past-day edit** — week strip read from snapshot `weekLogs` not updated by checkbox toggle. Fixed by updating `weekLogs` state alongside `loggedSupps` on toggle.
- **`/design-system` 404 in production** — Vite SPA outputs static files; Vercel returned 404 for any path without a matching file. `/design-system` is the only URL-based route in the app (all other screens use in-app state, no URL changes). Fixed by adding `vercel.json` with `/(.*) → /index.html` rewrite rule. Commit `361007c`.
- **Modal residue in full-page screenshots** — Modal.jsx always portaled to `document.body` regardless of `open` state. When closed, the sheet sat at `transform: translateY(100%)` — off-screen but still in the DOM. Arc's full-page screenshot tool (and similar) captured it at the bottom of the document. Fixed: added `mounted` state with 300ms delayed unmount after `open → false`, matching the CSS exit animation duration. Portal is removed from DOM after animation completes. Commit `5d177fc`.
- **Onboarding card grid layout** — Onboarding Step 1 card container was a vertical flex list after the 4-card condensation landed. ScheduleTab used a 2-column CSS grid. Fixed by wrapping the DISPLAY_MODES map in a grid container (`gridTemplateColumns: 1fr 1fr`), `none` card spanning both columns, `minHeight: layout.modeButtonHeight` for equal-height cells. Commit `fb5a9ce`.
- **Onboarding cascade parity** — Onboarding Step 2 wrote per-meal absolute offsets (`breakfast: 60`, `lunch: 300`, etc.) but not cascade fields (`first_meal_offset_hours`, `meal_interval_hours`, `evening_mode`). New users hit `migrateConfig` on every Schedule tab mount — the function inferred cascade fields from absolute offsets and re-saved to DB each time. Fixed: Onboarding Step 2 now uses the same cascade rule editor as ScheduleTab (First meal offset + Meal interval + Evening mode picker). Initial config has cascade defaults (`first_meal_offset_hours: 1`, `meal_interval_hours: 4`). MEAL_ROWS constant removed. Commit `71b62d0`.
- **migrateConfig firing on every Schedule tab mount for new users** — side effect of the cascade parity bug above. Now that Onboarding writes cascade fields on first save, `migrateConfig` sees `first_meal_offset_hours !== undefined` and skips. No extra DB write on mount for any user. Resolved by `71b62d0`.
- **Anchor helper text rendering before selection** — `ANCHOR_NOTES` HelperText in ScheduleTab rendered immediately above the card grid for any user already on `medication` or `wakeup` mode, before any interaction. Moved to inside the Anchor sub-selector block, below the two buttons, conditional on `localMode` having a value. Commit `71b62d0`.
- **Grid layout remaining span** — after the first grid fix (`fb5a9ce`), `gridColumn: "1 / -1"` spread was still left in both Onboarding and ScheduleTab card style objects. Full-width span caused No Schedule to occupy its own row, Fixed Times to be stranded. Removed spread entirely. Commit `42b3eaa`.
- **Sign-in nav stack stale** — `NavigationProvider` is mounted above both `Auth` and `ProtocolApp` and survives sign-out. When user signed in after signing out, `ProtocolApp` remounted and read the stale `screenStack` (e.g. `[home, settings]`), rendering Settings open. Navigation state is not persisted to localStorage — purely in-memory. Fixed by adding `resetStack()` to `NavigationProvider` and calling it in `ProtocolApp`'s mount effect (fires on every sign-in, harmless on refresh since stack already starts at home). Commit `f7b8bb8`.
- **New supplements appearing on past days as unchecked (May 18 audit)** — `isSupplementActiveOn` returned `true` for any indefinite-mode supp regardless of date, ignoring `created_at`. Net effect: a supp added today appeared on every past day too, marked as unchecked, dragging past-day adherence rings down. Fix in `src/lib/time.js`: added `created_at` floor at the top of `isSupplementActiveOn` (applies across all treatment modes — indefinite, scheduled, cycled).
- **Protocol detail title not centered on screen (May 18 audit)** — `ProtocolDetailScreen` header used `flex justify-content: space-between` with the title at `flex: 1, text-align: center`. Because the right-side group had 1–2 icons while the left had 1, the title centered to the *available flex space*, not the screen. Fix: CSS grid `gridTemplateColumns: minmax(60px, 1fr) minmax(0, auto) minmax(60px, 1fr)` — outer columns equal-flex, title in auto-sized center column always screen-centered. Added overflow ellipsis for long names. `ProtocolLibrary` header unaffected (its title is a plain span and the side buttons are balanced).
- **Late badge stayed bright under read-only past-day dim (May 18 audit)** — the `theme.status.warningSubtle` / `theme.status.warning` ochre on the "late" badge didn't dim uniformly with the 0.6 opacity parent wrapper, so late slots looked highlighted in read-only mode. Fix in `SlotCard.jsx`: when `isReadOnly`, switch Badge from `variant="missed"` to `variant="neutral"` (achromatic). Edit mode + today retain the warning ochre. (The deeper fix — replacing the opacity dim with an in-Hero eyebrow — followed in Session 3 of the mobile audit.)
- **Week strip cells too tight at 320px viewport (May 18 audit)** — at iPhone SE 1st gen width, each cell rendered ~38px wide; with the 28px compact ring + `xs` (8) horizontal padding, the ring overflowed the cell content area. Fix in `WeekStrip.jsx`: compact mode now uses `xxs` (4) horizontal padding while keeping `xs` (8) vertical. Ring fits with 4+px breathing room at 320px, 9+px at 375px, 11+px at 390px.
- **TODAY badge straddled the cell border / staggered cell heights (May 18 mobile audit)** — initial absolute-positioning approach put the badge half above / half overlapping the cell's top border, and in-flow rendering pre-fix added 2–3px of extra height to the today cell. Final fix: reserved-height top slot inside every cell (compact: 14px + `xxs` marginBottom) — today renders the badge inside that slot, non-today cells get an empty slot of identical height. Badge sized down to 8px font + tight padding to fit cell width.
- **Hero card "looked empty" on today vs past (May 18 mobile audit)** — content was anchored to the top of a `minHeight: 132` card with extra space below. Fix: Card itself is now `display: flex, flexDirection: column, justifyContent: center` so content always vertically centers regardless of how many lines (no submeta vs with submeta) — past and today render at the same visual shape.
- **"Started at" text jumped when entering anchor edit (May 18 mobile audit)** — display-mode status div had `lineHeight: 1.2`; edit-mode prefix span inherited a different line-height. Parent flex also switched from `alignItems: baseline` to `alignItems: center`. Fix: extracted a single `statusTextStyle` object used by both display and edit-mode prefix; unified parent alignment to `alignItems: center`. Edit input slimmed with `padding: xxs xs` so its natural height matches the title-text row.

---

## Today's Major Work (Sequential Sessions)

### Session of May 11 (this session)

**Pass — Phase 1 desktop responsive Home (sidebar + layout shell)**
Persistent 240px sidebar with brand wordmark, nav items, Settings + account at bottom. Content area with greeting top-left, avatar top-right, placeholder sections for week strip + today panel + insights panel. Mobile rendering below 1024px unchanged. Initial sidebar Sofia row was visually awkward and removed; account identity consolidated to top-right of content.

**Pass — Phase 2 (week strip with adherence)**
7 day cells in horizontal grid with adherence visualization. AdherenceRing extracted from Hero, made reusable with size prop. New `dbGetDailyLogsRange` API helper. Week navigation state in App.jsx, prev/next handlers with forward arrow disabled at current week.

**Pass — Phase 2 polish**
Ring size 40 → 56px with % text inside. Today cell stronger treatment ("TODAY" + "Mon" stacked, accent border, surface tint). Each cell as distinct card with hairline border. Vertical spacing inside cells comfortable. Outer container border removed entirely.

**Pass — Selected/Today separation + 100% success color rings**
Real product instinct: separate visual signals for "today" (the actual date) vs "selected" (which day's content is loaded). Today gets small TODAY badge using `nowBadgeBg/nowBadgeText`. Selected gets stronger slate-blue treatment (`nowBorder + nowBg`). Both stack when today is selected. AdherenceRing uses `status.success` (sage green) color at 100% adherence, ink color below. Cross-app consistency — Hero ring on mobile also gets success color at 100%.

**Pass — Phase 3 (Today panel with compressed slot rows + hover states)**
Compressed slot rows (one line each) with click-to-expand. Current slot auto-expanded on initial render. Hover states throughout (`theme.surface.hover` token added). Supplement rows reveal edit pencil on hover. Past day handling: Today panel loads selected date, read-only by default, Edit button unlocks. Past day initial state was all-expanded (changed in Phase 4).

**Pass — Phase 3 bug fixes (3 fixes)**
1. Selected day visual hierarchy — strengthened slate blue values so selected cell pops forward instead of receding.
2. Past day expansion locked when not in edit mode — removed read-only gate on chevron toggle (only checkbox/edit gated).
3. Week strip adherence ring stale after past-day edit — `weekLogs` state updated alongside `loggedSupps` on toggle (no page refresh needed).

**Pass — Phase 4 (Insights panel + past day collapsed)**
INSIGHTS placeholder filled with: weekly adherence (big % + sparkline), current streak (consecutive 100% days, hidden if <2), schedule summary (mode · anchor time), upcoming endings (length-of-treatment ending next 14 days, hidden if empty), quick actions (Configure schedule, Manage protocol). Sections separated by hairlines. Past day initial state changed from all-expanded to all-collapsed (cleaner scannability).

**Pass — 4 directional themes for visual identity exploration (dev-only)**
Replaced Brutal Light + Brutal Dark with 4 new directional themes: Clinical Instrument (cool steel, IBM Plex Sans), Editorial Material (warm paper, Crimson Pro serif), Soft Futurism (deep blue-black, luminous cyan), Terminal Precision (true black, amber signal, JetBrains Mono). Each with full token coverage and real fonts loaded. CSS variable font system added (`--font-body/heading/data` set on theme change). Dev theme switcher updated to show all 6 themes.

**Pass — 5 Terminal color variants**
Locked Terminal as the direction. Removed Clinical/Editorial/Soft Futurism themes. Renamed Terminal Precision to Terminal Amber. Added 4 new Terminal variants: Cyan (aerospace), Phosphor (CRT green), Achromatic (pure white, no chroma), Magenta (punk-tech). All share base architecture (mono type, zero radius, hard borders, black surfaces), differ in accent color and text tint.

**Pass — Achromatic as production identity (LOCKED)**
Renamed `terminalAchromatic` to `achromatic`. `VALID_PREFS = ["achromatic"]` — only achromatic is a valid production preference. All themes.light fallback references → themes.achromatic. SettingsScreen theme picker removed entirely (single production theme, nothing to pick). Silent migration of existing users with light/dark/system preference. Dev theme switcher retains all variants for future reference.

**Pass — Radius leak fix (Achromatic production)**
UI selector elements (chevron navigation buttons, Settings gear button, theme picker) referenced `radius.full` (9999) directly, so they stayed circular under Achromatic's zero-radius treatment. Fixed by introducing `radius.button` token that maps to theme's UI radius (0 under Achromatic). Account avatar kept at `radius.full` (legitimate circular shape). Adherence rings unchanged.

**Document — HIG-informed design rules drafted**
Apple HIG audit document drafted covering 15 categories: Touch targets, State systems, Modals & sheets, Navigation, Accessibility, Typography, Spacing, Color & contrast, Animation & motion, Forms & inputs, Feedback patterns, Buttons, Lists & rows, Empty states, Onboarding. v1 baseline with HIG-compliant defaults. Pending: save to repo as `/ORIGIN-DESIGN-RULES.md`, then bulk fix pass to apply to existing components.

**Pass — Radius leak fix round 2 (May 11 late evening)**
Round 1 didn't catch selector variants and day-of-week picker. Category, Treatment, and When-to-take selectors and day-of-week circles in EditForm were still rendering rounded under Achromatic. Fixed in commit a14f8e3.

**Document update — Comprehensive diagnostic (May 11 late evening)**
Ran full state diagnostic via Claude Code: schema verification, component inventory, API helper inventory, recent commits, production user count. Surfaced: Treatment mode column structure (treatment_mode + cycle_on/off_value/unit), status column replacing legacy `paused` boolean, 4th user account (dra.orozcobp, abandoned onboarding), Loader minimum 3000ms behavior, 22 API helpers, multiple legacy/stale items worth tracking. Handoff document updated to match actual production state.

**Pass — Design system reference page (May 11 evening, second block)**
Built `src/components/design-system-page/DesignSystemPage.jsx` and `registry.js`. Foundation sections auto-render from design-system.js tokens. Component registry catalogs all primitives and composed components with generic stub data. Playgrounds for Button, Input, AdherenceRing. Route: `/design-system` (public, portfolio-linked). `/design` redirects. IntroHeader with "← Back to Origin" link. Sidebar → horizontal scroll nav strip below 1024px. DevThemePicker always shown. `noindex` meta via useEffect. `DayCell` named export added to WeekStrip for registry import. CLAUDE.md updated with public-page maintenance rules. Commits: `70a8de3` (initial dev route), `7731a6c` (public release).

**Fix — Vercel SPA fallback (May 11 evening)**
`/design-system` returned Vercel 404 in production because no `vercel.json` existed. All other app screens use in-app state (no URL changes) — this was the first real URL-based route. Added `vercel.json` with `/(.*) → /index.html` catch-all rewrite. Commit `361007c`.

**Fix — Modal unmount after exit animation (May 11 evening)**
Modal.jsx kept its portal mounted at `translateY(100%)` when closed, making it visible in full-page screenshot tools. Added `mounted` state with 300ms delayed unmount (matching `transform 0.3s ease-out`). Entry animation unaffected; exit animation plays in full before DOM removal. Audit confirmed all other overlays (Toast, SupplementNameAutocomplete) already unmount cleanly. Commit `5d177fc`.

### Session of May 15

**Pass — WCAG text.muted → text.secondary migration (completed)**
All functional `text.muted` (#666666, ~3.5:1 contrast) usages migrated to `text.secondary` (#A0A0A0, ~7.7:1 contrast) across: Onboarding, ScheduleTab, ManageProtocolScreen, ManageSupplementsSheet, SlotCard, SlotRow, TodayPanelHeader. Two intentional `text.muted` exceptions retained: ANYTIME_SLOT decorative `◦` bullet (App.jsx) and disabled nav arrow state in WeekStrip (WCAG exempts disabled controls). Color contrast gap in Pending Queue marked complete.

---

### Session of May 12

**Pass — Schedule modes condensed to 4 (Anchor sub-selector)**
Onboarding and Manage Protocol → Schedule tab now show 4 mode cards (No Schedule, Anchor, Intermittent Fasting, Fixed Times) instead of 5. Tapping Anchor reveals a sub-selector below the grid (Button variant="selector", two options: Medication / Wake Up). DB values unchanged — `schedule_type` still stores `medication` or `wakeup` directly. New config.js exports: `DISPLAY_MODES` (4-item UI array) and `ANCHOR_SUB_MODES`. `MODES` kept intact for all internal lookups. Onboarding: Continue disabled until sub-mode explicitly selected when Anchor card is active. ScheduleTab: Anchor card shows as selected when `localMode` is medication or wakeup; sub-selector pre-selects current value on load.

**Refactor — Button variant "pill" renamed to "selector"**
`variant="pill"` → `variant="selector"` across the codebase. CSS class `.pill-label` → `.selector-label` (definition in index.html inline style, usage in Button.jsx). Internal variable `pillBase` → `selectorBase`. All 7 usages in EditForm.jsx updated. Design system page registry Button entries updated. `theme.radius.pill` token kept as-is — it names a visual shape (fully rounded, 999px) used for drag handles, progress dots, status indicators, not the UI component. ORIGIN-DESIGN-RULES.md and ORIGIN-HANDOFF.md updated.

**Fix — Onboarding cascade parity + grid layout + helper text (4 bugs, May 12 morning)**
Follow-up bug fixes after the schedule mode condensation work:
1. Grid layout: Onboarding Step 1 card container changed to 2×2 grid to match ScheduleTab. Commit `fb5a9ce`.
2. Cascade parity: Onboarding Step 2 replaced per-meal absolute-offset inputs (MEAL_ROWS) with the same First meal / Meal interval / Evening mode editor used by ScheduleTab. Initial config now writes `first_meal_offset_hours: 1`, `meal_interval_hours: 4`. Commit `71b62d0`.
3. migrateConfig side effect resolved: new users no longer trigger a DB re-save on every Schedule tab mount. Commit `71b62d0`.
4. Anchor helper text moved: `ANCHOR_NOTES` HelperText in ScheduleTab relocated from above the card grid to below the sub-selector buttons. Commit `71b62d0`.

**Fix — Grid layout remaining span (May 12)**
Second grid fix: `gridColumn: "1 / -1"` spread was still present in both Onboarding and ScheduleTab after the first fix, stranding No Schedule and Fixed Times in their own rows. Removed entirely. Commit `42b3eaa`.

**Refactor — Notifications toggle to selector pattern (May 12)**
Replaced iOS-style circular switch in SettingsScreen.jsx (and dead-code SettingsModal.jsx) with two-option `Button variant="selector"` (On / Off). Consistent with rest of app's binary selector pattern. Design system registry updated with three binary selector examples. Commit `f897a42`.

**Pass — HIG foundational accessibility (May 12)**
Touch targets, prefers-reduced-motion, focus states, keyboard accessibility — all in one pass:
- SlotCard expand header `<div>` → `<button aria-expanded>` (keyboard accessible, accessible name from children)
- SlotCard checkbox `<div>` → `<button aria-label aria-pressed>` with 44pt tap area (padding+margin negative offset, visual preserved)
- WeekStrip nav arrows: `minWidth/minHeight: 32`
- SupplementRow pencil: `minWidth/minHeight: 32`
- Hero "edit" button: `minHeight: touch.min`, inline-flex centering
- Global `@media (prefers-reduced-motion: reduce)` kills all transitions/animations
- `:focus-visible { outline: 1px solid #FFFFFF; outline-offset: 2px }` for keyboard nav
- Modal: Escape closes, Tab cycles within sheet, first focusable element auto-focused on open
- Commit `f2b3da4`

**Pass — prefers-reduced-motion exceptions (May 12)**
Four HIG-compliant animations re-enabled under reduced-motion as functional feedback exceptions: Loader rings/dot, SupplementRow checkbox state transition, Toast slide-in, row hover (SupplementRow, SidebarNavItem, DayCell). Pattern: CSS class on each element, override in index.html's reduced-motion block. Loader extends its own inline `<style>`. Rationale comments at each override site. ORIGIN-DESIGN-RULES.md Category 9 and CLAUDE.md updated. Commit `c6ff004`.

**Fix — Navigation stack stale on sign-in (May 12)**
`NavigationProvider` survives sign-out (mounted above `ProtocolApp`), so stale screen stack caused Settings to reopen after sign-out/sign-in. Fixed: `resetStack()` added to `NavigationProvider`, called in `ProtocolApp` mount effect. Commit `f7b8bb8`.

**Pass — HIG-compliant form patterns (May 12, commit `3bdedb3`)**
SettingsScreen: email section wrapped in `<form onSubmit>` with `autoComplete="email"`, `inputMode="email"`, `autoCapitalize/autoCorrect/spellCheck` off, submit button changed to `type="submit"`. Password section wrapped in `<form onSubmit>` with `autoComplete="new-password"` on both password inputs, submit button `type="submit"`. Display name input gained `autoComplete="name"`. EditForm: `autoComplete="off"` on Dose and Notes; `inputMode="numeric"` + `pattern="[0-9]*"` on cycle on/off value fields. Auth already had a real `<form>` element prior to this commit — not touched.

---

### Session of May 16 (morning)

**Fix — pause/resume bugs**
`togglePause` only flipped the `paused` boolean but `isPausedSupp` checks `status === 'paused'` — so pausing never visually worked. Fixed by syncing both `status` and `paused` fields. `resumeSupp` incorrectly called `openEdit()` after resuming, opening the edit form unexpectedly; removed that call. Added null guards to `openEdit` for `slots`/`days` fields to prevent crashes on malformed supplement records.

### Session of May 16 (afternoon)

**Feature — Protocol Library Phase 1-3 (complete)**
Full multi-protocol system shipped across three phases:

*Phase 1 — Data model + API:*
Protocols table in Supabase (id, user_id, name, status, treatment_mode, starts_at, ends_at). API helpers: `dbGetProtocols`, `dbAddProtocol`, `dbUpdateProtocol`, `dbDeleteProtocol`, `dbPauseProtocol`, `dbArchiveProtocol`, `dbActivateProtocol`. `dbResetProtocolSupps` bulk-patches all supplements in a protocol back to `{status: 'active', paused: false}` when protocol is paused or archived (template reset). `dbUpdateSupp` updated to send `protocol_id`. `homeSupps` computed from `activeProtocolIds` Set — supplements with no protocol always show, supplements with a protocol show only if their protocol is active.

*Phase 2 — ProtocolLibrary + ProtocolDetailScreen + SettingsScreen refactor:*
`ProtocolLibrary.jsx`: slide-in full screen at zIndex 101. Active/Archived tabs via TabBar. New protocol two-step modal (form → intent). `ProtocolDetailScreen.jsx`: zIndex 102, inline header name editing, lifecycle buttons (Pause/Archive, Activate/Archive, Activate/Delete) at top above tabs, Active/Stopped supplement tabs. `SettingsScreen.jsx`: refactored from single long scroll to view-based sub-navigation (main → schedule / account / install). Schedule and Account each get their own slide-in view; main view shows label + action row pattern matching rest of app. `ManageProtocolScreen` removed. `TabBar.jsx` extracted as design system primitive, registered in `registry.js`.

*Phase 3 — Protocol picker in EditForm:*
When 2+ active protocols exist, EditForm shows a Protocol section above Name. Selector buttons for each active protocol + "None". Protocol assignment stored in `form.protocol_id`. `blankForm(protocol_id)` helper in App.jsx pre-selects single active protocol when opening add form. `openAddToProtocol(protocol)` opens add form pre-assigned to a specific protocol.

*Intent handling in `addProtocol`:*
Three intents: `replace` (archives all active protocols + client-side resets their supplements, creates new as 'active', shows archived names in toast), `stack` (creates new as 'active', existing unchanged), `save_later` (creates new as 'archived'). Intent step skipped entirely when no active protocols exist.

### Session of May 17

**Feature — IF v2: anchor-relative → absolute-time eating window**

Existing IF (intermittent fasting) was anchor-relative: a single "pill time" anchor drove a derived eating window via `window_start` / `window_length` / `meals_per_day` offsets. Resuming supplements was broken for fasting users because the home surface and Start-Day CTA assumed every non-Fixed mode needed a daily anchor. Rebuilt fasting as a fixed-schedule model — same shape as Fixed mode, with its own dedicated slot vocabulary.

*Core (`src/config.js`, `src/lib/notifications.js`):*
New config fields `eating_window_start` (HH:MM), `eating_window_duration_hours` (4/6/8/10/12), `meal_count` (2/3), reusing existing `pre_meal_window`, `evening_mode`, `evening_time`, `sleep_time`. `computeIFSlotTimes(cfg)` derives absolute HH:MM times for each slot. New `IF_SLOTS` array with IF-only slot IDs — `fasted`, `meal_1`, `pre_meal_2`, `meal_2`, `pre_meal_3`, `meal_3`, `evening`. v1 config fields kept in `DEFAULT_CONFIG` so unmigrated reads don't error.

*Schedule editor (`ScheduleTab.jsx`):*
New fasting block — window start input (required), duration segmented control, meals 2/3, pre-meal-window number, evening sub-mode (Off / Fixed time / Before sleep). Live preview renders all active slot times computed from current state. Flexible/Consistent toggle hidden for fasting (always fixed-schedule). Orphan-supplement modal warns when dropping meal_count would strand supplements assigned to disappearing slots.

*Slot picker (`EditForm.jsx`):*
Mode-aware. In fasting mode, picker uses `IF_SLOTS` filtered by `meal_count` (hides meal_2/3 + pre slots when not used) and `evening_mode` (hides evening when off). All other modes use the original `SLOTS` list.

*Onboarding (`Onboarding.jsx`):*
Fasting block now collects the v2 fields directly. Get Started disabled until eating window start is provided. New fasting users are stamped `_if_v2_migrated: true` at save time so they skip the migration screen on next load.

*Today surface (`Hero.jsx`, `TodayPanel.jsx`, `TodayPanelHeader.jsx`, `App.jsx`):*
Fasting users see "Eating window: HH:MM" in the hero/header instead of the anchor Start-Day CTA. `activeSlotList` and `coreSlotIds` become mode-aware so the home renders only IF slots active for current `meal_count` / `evening_mode`, and adherence math counts the correct slot set. `getSlotTime()` handles fasting by reading from `computeIFSlotTimes` (plus evening sub-mode logic). `saveSchedule` strips anchor metadata for fasting. The legacy `fasted → pre_breakfast` slot rename is guarded by `_if_v2_migrated` so it stops firing for v2 users (in v2, `fasted` is a real slot).

*Migration screen (`IFMigrationScreen.jsx`, new):*
Full-screen confirm flow for existing IF users. Infers v2 fields from the user's old config (`_consistent_time` → window start, `window_length / 60` → duration hours, `meals_per_day` → meal_count, `pre_meal_window` carried), shows them with editable controls, requires the user to confirm. On confirm: persists v2 config with `_if_v2_migrated: true`, remaps every supplement's slot IDs from v1 → v2 (`pre_breakfast → fasted`, `breakfast → meal_1`, `pre_lunch → pre_meal_2`, `lunch → meal_2`, `pre_dinner → pre_meal_3`, `dinner → meal_3`, `after_dinner → evening`), writes each updated supplement to Supabase, and triggers a notification recompute. Trigger in App.jsx: `sched.schedule_type === "fasting" && !sched.offsets._if_v2_migrated`.

*Backend (`supabase/functions/_shared/helpers.ts`, `supabase/functions/recompute_notifications/index.ts`):*
Server-side `computeIFSlotTimesHHMM` mirrors the client. New IF v2 branch in `recompute_notifications` (gated on `_if_v2_migrated`):
- Unconditional notifications: `fasted` (30-min warning before window opens), `meal_1` ("Your eating window is open"), `window_closing` (30-min warning before window closes).
- `window_closing` is suppressed when its fire time coincides with a meal slot that has supplements (default `pre_meal_window=30` puts the last meal at exactly window_close − 30 → would otherwise stack two notifications at the same minute).
- Conditional notifications (only fire if supplements assigned): `pre_meal_2`, `meal_2`, `pre_meal_3`, `meal_3`, `evening`.
- v1 IF users (no migration flag) fall through to the legacy anchor-relative offset branch — no behavior change for them until they confirm migration.

*Data migration (`supabase/if-logs-migration.sql`, not yet run):*
One-shot SQL that renames slot keys inside `daily_logs.checked` JSONB for users with `_if_v2_migrated = true`. CASE branches ordered longer-prefix-first to avoid double-substitution (e.g. `pre_breakfast` matched before `breakfast`). Intended to be run manually via Supabase Dashboard once all real IF users (currently just Bego) have completed the in-app migration. Without this, past daily logs would show as un-checked under v2 slot IDs even though they were completed under v1 slot IDs — adherence history would visually regress.

*Commits (May 17 — IF v2 base):* `80a386d` core, `d091e5b` UI, `ee5d94c` home surface + migration screen, `25e0a36` notification scheduling, `82d2ef8` daily_logs migration SQL.

**Follow-up — bug fixes from real use (May 17, same session):**
- `5aa7ce9` — ScheduleTab seeds cascade/fasting/fixed defaults when switching modes, so the editor no longer renders empty inputs when you flip from one mode to another.
- `7770c27` — Protocol creation now auto-pushes to the detail screen and opens the add-supp modal. Archived protocols get a `+` button, lose the Active/Stopped tabs, and gain inline delete per row. Stopped tab on Active/Paused protocols also got an inline delete. New `deleteSuppById` helper for delete-without-edit-form. Mobile ProtocolLibrary call site got the missing `token` / `onActivateReceived` props (clinician-sent protocols were invisible on mobile).
- `3d049f4` — Schedule editor blocks gate on `selectedCard` not `localMode` (clicking Anchor while previously on fasting kept rendering the fasting form). Trash icons in ProtocolDetailScreen use `theme.status.danger` red.

**Follow-up — post-IF-v2 audit (May 17, same session):**
- `1a0f5fb` — `calculateAdherenceForDate` and the inline App.jsx streak loop now iterate per-supplement instead of per-CORE_SLOT. IF v2 users were seeing 0% adherence rings and inflated 30-day streaks because IF slot IDs aren't in CORE_SLOTS. Also fixes the pre-existing miss where anytime supps weren't gating the streak.
- `716b51d` — IFMigrationScreen now exposes an Evening picker (Off / Fixed time / Before sleep). Pre-selects "Before sleep" with default 22:00 + 1hr offset when the user has any legacy `after_dinner` supps — those supps were getting orphaned post-migration because they'd remap to "evening" slot while `evening_mode` stayed null.
- `f5af642` — Onboarding fasting block gains the same Evening picker (cascade modes already had it).
- `2c07e5e` — Cleanup: removed unreachable `START_LABELS.fasting` / `START_SUBTITLES.fasting` in Hero, removed the unreachable `rx + fasting → "Anchor"` branch in `getSlotLabelForMode` / `getModeSlotLabel`, fixed stale loop comment in `recompute_notifications`, and `seedConfigForMode` now defaults `eating_window_start` to "12:00" (DEFAULT_CONFIG value) instead of null when switching INTO fasting, so the resulting schedule is immediately notifiable.

**Critical fix — schedule "not saving" was actually a read bug (May 17):**
- `cf618b6` — `dbGetSchedule` did `SELECT *` from `user_schedule` with no `user_id` filter. RLS wasn't enforced at the DB level, so PostgREST returned rows for every user; the app's `[0]` picked some other user's stale 'none' row instead of the current user's saved schedule. Every save fired correctly — the read was looking at the wrong row.
- Same shape fixed in three other queries: `dbGetAdherenceCounts(userId, ...)`, `dbGetSupplementHistory(userId, t)`, `dbGetReceivedProtocols(patientId, t)`. dbAddSupplementHistory also got user_id in the body (was relying on NULL-from-JWT injection, which caused NULL-keyed duplicate rows).
- `dbSaveSchedule` now does DELETE-then-INSERT scoped to user_id so duplicate rows can't leak.
- `2730252` — Anchor card click now auto-picks Medication and fires the save immediately. Was deferring to sub-mode click, which meant force-closing the PWA before the sub-mode pick lost the selection. User reproduced the bug in production; this was the user-facing symptom of the deeper RLS issue.

**Audit + 3-round cleanup pass (May 17, same session):**
Full frontend/backend audit (acting as HoD/FED + backend reviewer) produced a punch-list of ~15 items split into Round A (safety/source-of-truth), Round B (touch/rollback/polish), Round C (dead-code/observability). All shipped.

- `e8eab9f` Round A — `makeSegBtnStyle(theme)` exported from design-system, three local copies removed across ScheduleTab / Onboarding / IFMigrationScreen. Raw `gap: "6px"` → `spacing.xs2` across SlotCard / ProtocolDetailScreen / ManageProtocolScreen (6 sites). Sidebar `gap: 2` → `spacing.xxxs`. Plus **Supabase Dashboard work**: RLS enabled on all 9 tables (user_schedule, daily_logs, user_supplement_history, supplements, protocols, user_profiles, protocol_sends, push_subscriptions, notifications_queue), 22 policies live; UNIQUE constraints added on user_schedule(user_id), daily_logs(user_id, log_date), user_supplement_history(user_id, name).
- `5e1514b` Round B — SlotCard checkbox tap-area: `padding: 10, margin: -10` → `(touch.min - 24) / 2` (intent-expressing formula). WeekStrip selected-day shadow → new `shadows.elevated` token. ProtocolDetailScreen inline name-edit input baseline / border tokenized. TabBar buttons gain `minHeight: touch.min`. ProtocolDetailScreen Stopped-tab rows use `touch.row` (52pt, multi-line name+dose per Cat 13). ProtocolLibrary IntentOption is now a real `<button>` (was a div with onClick). Backend: `activateReceived` rolls back the partial protocol on partial-supp-insert failure; `recompute_notifications` auto-stop changed from `lte("ends_at", today)` to `lt(...)` so today's last-day notifications fire; `dbUpdateProtocol` PATCH adds defensive `user_id=eq.` filter alongside RLS.
- `ab249c3` Round C — Deleted non-Achromatic themes (Light, Dark, Terminal Amber/Cyan/Phosphor/Magenta) and SLOTS_LIGHT/DARK consts from design-system.js. Removed dead top-level `colors` and `gradients` exports. design-system.js dropped from 688 → 259 lines; **production bundle from 383.57 KB → 373.03 KB (−10.5 KB)**. PatientsPanel raw fontFamily → `typography.fontHeading`. lib/theme.jsx 'system' branch (was referencing undefined `getSystemTheme()`) removed. Backend: `refreshSession` memoized via in-flight promise so parallel 401s share one /token call. IF window_closing dedupe threshold widened 60s → 5min. `recomputeNotifications` returns boolean; `recomputeWithToast` helper in App surfaces failures as toasts on user-action call sites. `dbGetAdherenceCounts` gained `daysBack=365` parameter to cap scan size.

**Empty states + visual identity pass (May 17, earlier in the day):**
- `565eaea` — Replaced 💊 emoji empty-state visual with `◯` glyph (matches existing slot iconography `◎`/`●`/`◑`). Auth screen pill emoji replaced with "Origin" wordmark. Empty-state copy unified ("Nothing X yet" for secondary list empties, "No X yet. [CTA]" for actionable empties).
- `a64a267` — Deleted orphan spike files (SettingsModal.jsx, ManageSupplementsSheet.jsx) and May-6 scratch notes. Added `.claude/` to .gitignore.

**Mobile chrome unification (May 17, evening pass):**

*Mobile home header refactor (commit `c7cbf3f`):*
Settings moved off the sidebar nav into the top-right `AccountAvatar` (the avatar now accepts an `onClick` prop and a `size="touch"` variant for the 44pt mobile target). The body CTA row (Add + Library buttons) was removed; both actions migrated up into the header. AccountAvatar acts as the Settings entry point on both mobile and desktop.

*Protocol Detail header cleanup + overflow menu (commit `730a3e4`):*
The body action stack on the protocol detail screen (Send to patient + lifecycle CTA + delete CTA) was collapsed into a `⋯` overflow menu in the sticky header. Menu items are status-aware (Pause/Archive/Activate/Delete) and clinician-aware (`Send to patient` only when `isClinician=true`). Mobile call site explicitly passes `isClinician={false}` so the action is hidden on the phone surface. Header now reads `[<] Protocol name [⋯] [+]`.

*Modal slide animation fix (same commit `730a3e4`):*
Modals were popping into final position instead of sliding up from the bottom. Root cause: `transform: open ? translateY(0) : translateY(100%)` evaluated on the same render where `mounted` flipped true, so the browser never saw the `translateY(100%)` starting state. Split into two states — `mounted` (controls DOM presence, stays true through the 300ms exit) and `shown` (controls visible position). After mounting, a double `requestAnimationFrame` flips `shown` to true so the CSS transition has a starting frame to animate from. Affects every modal in the app (New item, Edit item, all overflow + confirm modals).

*Slide-in screen icon parity + header order + Active row dose/notes (uncommitted, this turn):*
Three small follow-ups after the chrome refactor.
1. Slide-in screen headers (`SettingsScreen`, `ProtocolLibrary`, `ProtocolDetailScreen`) were using raw `<button>` chrome with no border — visually drifted from the home header chevrons + `+`/Library icons which use `Button variant="icon"` (44pt, 1px subtle border). Unified all of them to `Button variant="icon"` so every header chrome icon across the app now reads the same. Includes the new `⋯` overflow trigger.
2. Home header icon order swapped from `[+] [Library]` → `[Library] [+]` so the most-used action (Add) sits closest to the right edge for thumb reach.
3. Protocol Detail Active tab rows previously showed only `name + category icon + Pause/Play`. Updated to mirror the home `SlotCard` supplement row: `name + category icon + Paused badge` on line one, `dose · notes` on line two. Row min-height bumped from `touch.min` (44pt) to `touch.row` (52pt) per Cat 13.

**Clinician desktop audit + Phases 0–2 (May 17, evening — uncommitted):**

*Audit:*
Mobbin-informed UX/UI audit of the desktop clinician dashboard. Reference scans: Linear (sidebar density, kbd patterns), Deel/Fresha (provider patient lists with stat headers), Sentry/Writer (sparkline trend columns, observability KPI cards), Fitbit (in-range stats by category), Runna/Fitplan (structured-program patterns), Bear (calm typography). Produced a 4-part deliverable: (1) audit of current desktop regions, (2) discovery scan organized by pattern, (3) ranked prioritized recommendations, (4) anti-patterns to avoid (streak guilt, color-coded categorization, chat-shape provider comms, etc.). Single largest leverage finding: the PatientsPanel component (rich row: avatar + name + N protocols + adherence % + status pill) was unused in the live layout; the actual rendered patient list in the sidebar was name-only. That row pattern was the foundation for Phase 1.

*Phase 0 — primitives:*
- New `Sparkline.jsx` — single-color SVG trend line for dense list rows. Default 60×12, accepts a 0–100 values array, optional endpoint dot + baseline hairline, breaks line across null values. Registered in design-system page with 8 variants.
- New `StatusDot.jsx` — colored 4–6px dot keyed by status token (`success` / `warning` / `danger` / null). Designed to pair with `text.primary` label so color carries severity without dominating the surface. Registered in design-system page.

*Phase 1 — sidebar revival:*
- Patient enrichment lifted from PatientsPanel (orphan component) into App.jsx. New `patientStats` state map keyed by patient id. After patients resolve, fetches protocols + supps + schedule + 30d logs per patient in parallel and computes per-patient `activeCount` + `adherence7` + `adherence30` + 30-element `sparkline` array using `calculateAdherenceForDate`. Imports added: `calculateAdherenceForDate` to App.jsx.
- Sidebar rewritten: brand wordmark removed (hoisted to top bar — see Phase 2.1), "Patients" collapsible toggle removed (flat list), patient rows redesigned left-aligned: avatar + name → `● 7d% · N protocols` → 30-day sparkline (80×10) stacked vertically. Search input added at top with in-place filter. "N need review" caption (warning color) appears when ≥1 patient is below 80%. Archived patients render as a static section (label + rows) when present. My Origin moved to a footer below a divider.

*Phase 2 — patient detail polish:*
- New `PatientIdentityBlock` inline in App.jsx — avatar + name (heading) + meta line (`joined Mar 12 · 3 protocols · logged today`). Replaces the bare-name header when a patient is selected. Meta builds from `selectedPatient.created_at`, `patientStats[id]?.activeCount`, and the most-recent log_date in `patientTrendLogs`. Patient actions overflow `⋯` stays trailing.
- `PatientAnalyticsPanel` moved out of the right aside into the main column under `PatientDetailPanel`. Right aside stays focused on the patient's protocols. Removes the architectural awkwardness of the diagnostic surface (by-supplement / by-time-of-day / activity / notes) being stacked under a nav-shaped component (ProtocolLibrary).
- `InsightsPanel` lost its bottom "Configure schedule / Manage protocol" buttons + the `onConfigureSchedule` / `onManageProtocol` props. The matching `openManageSchedule` / `openManageProtocol` helpers were dead-coded out of App.jsx (only used by those buttons). Settings is reachable via the avatar; Manage Protocol via the right-column ProtocolLibrary.
- `TodayPanelHeader` gained a "VIEW ONLY" chip in `isReadOnly` mode (replaces the day-label CTA slot when the clinician is viewing a patient). Plus `whiteSpace: nowrap` + `textOverflow: ellipsis` on the day label so the header reads cleanly even in narrower columns.
- Considered 60/40 Today/Insights ratio in patient view per audit recommendation; reverted to 50/50 after real-screen evaluation — at typical desktop widths the 40% TodayPanel column crowded the header and truncated supplement names. Analytics weight comes from PatientAnalyticsPanel stacked below.
- Skipped applying StatusDot to legacy `PatientsPanel.jsx` rows (Phase 2f in the plan). That component isn't mounted in the live layout and will be rewritten in Phase 3 (Patient Roster as default landing). Updating dead code now is throwaway work.

*Phase 2.1 — top bar restructure (Sofia's design call mid-session):*
- New full-width top bar in App.jsx desktop layout (above the three panels): brand wordmark + greeting + clinician avatar. Sofia then refined: drop the greeting from chrome entirely and surface "Hello, Sofia" only inside the personal cockpit content as a heading. Result: top bar is just `Origin` (left) + clinician avatar (right). When viewing a patient, the in-context PatientIdentityBlock owns the main-column header; "Hello, Sofia" doesn't render. Personal warmth lives in personal mode; clinical chrome stays restrained.
- Outer desktop container changed from horizontal flex → vertical flex (header above panel row).
- Patients dropdown toggle removed from the sidebar per Sofia's call ("no chevron, flat list"), patient rows fully left-aligned.

*Files changed:*
- `src/App.jsx` — top bar, `PatientIdentityBlock` component, patient enrichment effect, analytics panel moved, greeting heading inside personal home, prop cleanup.
- `src/components/Sidebar.jsx` — rewrite (brand removed, no dropdown, rich rows, search, count, my origin footer).
- `src/components/InsightsPanel.jsx` — dropped Button import + two quick-action buttons + two props.
- `src/components/PatientDetailPanel.jsx` — comment for 50/50 decision.
- `src/components/TodayPanelHeader.jsx` — View only chip in read-only, nowrap on day label.
- `src/components/Sparkline.jsx` — NEW.
- `src/components/StatusDot.jsx` — NEW.
- `src/components/design-system-page/registry.js` — Sparkline + StatusDot variants.

*Commit:* `c94792d` — pushed to main on May 18.

### Session of May 18

**Working-tree cleanup — three bundled commits + push.**
The working tree had a backlog of pending clinician work that hadn't been committed yet. Sorted into three logical commits and pushed all of them.

*Commit `961d2d6` — clinician backend.*
- `supabase/clinician-link-migration.sql` (NEW) — adds `shares_adherence_with_clinician` opt-in toggle on `user_profiles`. Adds patient↔clinician RLS so a clinician can read a patient's supplements, protocols, daily_logs, and schedule only when (1) `user_profiles.clinician_user_id = auth.uid()` AND (2) `shares_adherence_with_clinician = true`. Patient-side writes remain owner-only.
- `supabase/clinician-notes-migration.sql` (NEW) — new `clinician_patient_notes` table (one row per (clinician, patient) pair, holding `notes` text + nullable `archived_at`). RLS restricts read+write to the owning clinician. Unique index on `(clinician_id, patient_id)` so PostgREST upserts work via `on_conflict`.
- `supabase/demo-seed.sql` — stamps the four demo patients with `shares_adherence_with_clinician = true` so the clinician demo surface shows full data without each demo patient flipping the toggle.
- `src/lib/api.js` — `dbGetClinicianNote(clinicianId, patientId, t)`, `dbUpsertClinicianNote(row, t)`, `dbGetClinicianNotes(clinicianId, t)`.
- `src/lib/adherence.js` — gained `calculateProtocolAdherence` (per-protocol avg over a window that starts at the protocol's start_date, capped at `daysWindow` days), `calculateSupplementAdherence` (per-supp avg + expected/taken counts), `calculateSlotAdherence` (per-slot aggregated across all supps in that slot), `getUpcomingEndings` (supps with `ends_at` in the next N days for the Insights panel), `buildActivityLog` (recent pause/stop/resume/add/archive events). Also: `countExpectedChecks` + `calculateAdherenceForDate` now accept an optional `activeSlotIds` Set to filter the denominator — fixes the IF v2 case where stale legacy slot ids in a supp's `slots` array inflated expected counts.

*Commit `738956c` — clinician surfaces.*
- `src/components/PatientAnalyticsPanel.jsx` (NEW) — three stacked cards inside the patient detail surface: By supplement (30-day adherence, worst-first, colored pct), By time of day (mode-aware slot set, worst-first), Recent activity (last 10 events from `buildActivityLog`). Plus a private notes textarea (save-on-blur, re-syncs on patient change).
- `src/components/ProtocolLibrary.jsx` — adherence-per-row when an `adherenceMap` prop is provided (clinician patient view). Send-to-patient affordances when a patient is selected. `ProtocolRow` respects an optional disabled state for read-only contexts.
- `src/components/ProtocolDetailScreen.jsx` — send-to-patient flow in the header overflow menu (clinician-only, hidden on mobile and patient-view drill-ins). Patient picker modal lists the clinician's active patients.
- `src/components/SettingsScreen.jsx` — `desktop` prop swaps the container shape from a fixed slide-from-right takeover (mobile) to a flow-positioned panel that fills its host (the right aside in App.jsx). Back-button uses shared `Button variant="icon"` chrome for parity with other slide-ins.
- `src/components/Modal.jsx` — `useIsDesktop` hook. On desktop (≥1024), the modal renders as a centered card (480px max, 80dvh max) with scale-in animation instead of the mobile bottom-sheet slide. Backdrop blur disabled on desktop. Drag-to-dismiss handlers are mobile-only.
- `src/components/WeekStrip.jsx` — `activeSlotIds` prop plumbed through WeekStrip → DayCell → `calculateAdherenceForDate`. Without this, IF v2 patients' ring math inflates expected counts because their supps carry both legacy and v2 slot ids from migration.
- `index.html` — hides native scrollbars globally (Firefox + WebKit). Content still scrolls; the visible track is suppressed so multiple scrollable panels rendering side-by-side on desktop don't draw a forest of scrollbars.

*Commit `2ce9af7` — chore: gitignore `supabase/.temp/` and untrack the `cli-latest` tool artifact that was getting bumped on every CLI command.*

All three commits pushed to `origin/main` (range `730a3e4..2ce9af7`).

---

### Session of May 18 — Mobile patient UX/UI audit shipped end-to-end

**Context.** Full mobile patient experience audit performed against best-in-class daily-ritual apps (Streaks, Habitify, Apple Reminders, Apple Health Meds, Things 3, MyFitnessPal, Epsy, GoodRx, Hims, etc., via Mobbin discovery). 5-part audit produced 12 recommendations + 5 design decisions (D1–D5). All ranked by leverage; locked decisions before implementation. Sessions run sequentially in one branch (`worktree-session-2-autocomplete-expand`, off main).

**Locked design decisions (binding):**
- **D1** — Cascade math with no anchor set: slot times read `--:--`; notifications dormant; user can still log without anchor. Logging fully decoupled from anchor.
- **D2** — Hero copy ladder voice: anchor-aware, contextual ("Started at 05:50" / "Not started yet" / "Done for today").
- **D3** — Take-all on slot icon: ship it with a first-run InlineTip hint.
- **D4** — Day-1 teaching tip: yes, schedule-mode-specific copy, dismissible via InlineTip primitive.
- **D5** — Log-at schema: per-supplement timestamp persistence in `daily_logs.checked` jsonb. New shape `{ checked: true, at: "HH:MM" }` coexists with legacy `true` — backwards-compat read in `isChecked`; no DB migration needed.

**Pass — Session 1 (week strip + sign-out confirm + eyebrow cleanup).**
- Mobile branch in App.jsx replaced single-day chevron date row with `<WeekStrip compact>`. `dbGetDailyLogsRange` fetch + `weekLogs` sync effects' `isDesktop` gates removed so mobile fetches the rolling 7-day window.
- `WeekStrip.jsx` got a `compact` prop. `DayCell` now accepts `compact`, switches between 56px (desktop) and 28px (mobile) ring sizes, tighter cell padding, smaller TODAY badge styling. Compact horizontal cell padding is `xxs` (4) so the ring fits comfortably at 320px viewport (iPhone SE 1st gen). TODAY badge sits in a reserved-height top slot to keep all cells the same height.
- `AdherenceRing` gained `showText` prop (default true preserves desktop) — passed `showText={!compact}` on mobile so the ring renders as a clean arc (no `%` text inside the 28px ring).
- "MY PROTOCOL" eyebrow + `dayLabel` + `goDay` chevron handlers removed; `ChevronLeft/ChevronRight` imports cleaned from App.jsx (now used only inside WeekStrip).
- `SettingsScreen.jsx` sign-out wired through a confirmation `Modal`: "Sign out of Origin? · You'll need to sign in again to access your protocol. Your data stays safe." Cancel + Sign out buttons.

**Pass — Session 2 (recents on autocomplete + remove forced auto-expand).**
- `SupplementNameAutocomplete.jsx` now tracks a `focused` state. When the field is focused-and-empty AND `history.length > 0`, renders top-4 recents below the input as Button `variant="selector"` chips. Empty-state chips dismiss when user types ≥1 char; existing 3+ char matching dropdown unchanged.
- `SlotCard.jsx` initial expanded state changed from `useState(!allDone)` + `useEffect` forced re-sync to `useState(status === 'now' || status === 'missed')`. Only actionable slots auto-expand on mount; user toggles freely after — no forced re-expansion when a check flips.

**Pass — Audit-discovered bug fixes (4).**
- **Bug 1** — `isSupplementActiveOn` returned `true` for all indefinite supps regardless of date. Result: any new supp appeared on every past day as unchecked. Fix: added `created_at` floor filter at the top of `isSupplementActiveOn` — applies to all treatment modes. New supps only render on days ≥ their creation date.
- **Bug 2** — `ProtocolDetailScreen.jsx` header used `flex justify-content: space-between` with a `flex: 1` title between back chevron (1 button) and right group (1–2 buttons). Title was centered to the *available flex space*, not the screen. Fix: converted to CSS grid `gridTemplateColumns: minmax(60px, 1fr) minmax(0, auto) minmax(60px, 1fr)`. Outer columns equal-flex; title in auto-sized center column stays screen-centered regardless of right-side button count. Added `overflow: hidden; text-overflow: ellipsis` for long names.
- **Bug 3** — "late" badge on past-day read-only slots used warning ochre that didn't dim uniformly with the parent `opacity: 0.6` wrapper. Fix in `SlotCard.jsx`: when `isReadOnly`, switch the badge from `variant="missed"` (warning) to `variant="neutral"` (achromatic). In edit mode (and on today), warning ochre returns.
- **Bug 4 / Audit polish** — `WeekStrip` compact cell padding (vertical `xs`/horizontal `xxs`) and 28px ring sized to fit cleanly at 320px viewport with breathing room.

**Pass — Session 3 (past-day Edit-in-header + Day-1 tip + InlineTip primitive).**
- New `src/components/InlineTip.jsx` primitive: dismissible inline tip with left accent border, uppercase label, body, top-right X. Dismissal persisted in `localStorage` under `origin.tip.<id>`. Reusable: powers both the Day-1 tip and the take-all first-run hint.
- App.jsx mobile header right-side actions now conditional on past/today. Past: Edit/Done icon (Pencil → "Done" with accent treatment). Today/future: [+] icon. Library icon stays in both cases.
- 0.6 opacity dim on past-day content wrapper REMOVED. Replaced by an eyebrow inside the Hero card showing "Viewing [date] · read-only" (suffix `text.muted`) or "Viewing [date] · editing" (suffix accent white).
- `Hero.jsx` `pastDayEditing`/`setPastDayEditing` props removed (Edit lives in App header now).
- `isDay1` derived from `profile.created_at === today`. New `DAY1_TIP` constant in App.jsx keyed by schedule mode (medication / wakeup / fasting / fixed — no tip for "none"). Tip renders below the empty-state CTA when `!isPast && isDay1 && DAY1_TIP[scheduleMode]`. Schedule-mode-aware copy explaining how anchors / windows / fixed times work.

**Pass — Session 4 (anchor-aware Hero copy ladder + Start-day decoupling + size consistency).**
- `Hero.jsx` fully rewritten around a single `getHeroState({...})` helper that returns `{ eyebrow, status, submeta, statusKind, statusIsDone, showSetAnchor, editAnchorOn, anchorPrefix, anchorTime }`. Six prior nested-ternary mode branches collapsed into one state object consumed by a single render template.
- **D1 implementation** — gating "Start my day" CTA removed. Replaced by an inline `+ Set anchor` pill (calls existing `startDay()` action). Logging fully decoupled from anchor: slot times read `--:--` in anchor mode without `pillTime`; checkbox + toggleCheck + log-at all work without the anchor being set.
- **D2 implementation** — anchor-aware copy ladder:
  - Today, anchor mode, no anchor: `Viewing Today, [date]` / `Not started yet` / "Set your meds time…" + `+ Set anchor` pill
  - Today, anchor mode, anchor set, partial: `Viewing Today, [date]` / `Started at 05:50` + inline `edit` / `X of Y done`
  - Today, anchor mode, all done: `Viewing Today, [date]` / `Done for today` (green) / `Started at 05:50` + edit
  - Today, fixed: `Viewing Today, [date]` / next slot time (big) / `Next · [slot label]`
  - Today, fasting: `Viewing Today, [date]` / eating window time (big) / `Eating window opens`
  - Today, none: `Viewing Today, [date]` / day name / completion
  - Past: `Viewing [date] · read-only` / completion (green if done) / anchor info
  - Future: `Viewing [date]` / day name
- **Hero size consistency** — Card has `display: flex, flexDirection: column, justifyContent: center, minHeight: 132`. Content centers vertically within the card; shorter states (e.g. fasting with just a time) read as the same shape as busier states (anchor + completion + edit).
- **Success-green unified** — green now always lives on the status row (primary celebration position). Submeta is always neutral grey.
- **Eyebrow consistency** — past + today both render eyebrow inside the Hero card via the same slot (`{ text, suffix?, suffixTone? }` shape). Identical visual line on every state.
- **Anchor edit affordance** — anchor info (`Started at 05:50`) is now a `{ prefix, time }` structure. In-line edit replaces only the time portion with a slim Input + Save button; the `Started at` prefix stays in place. `statusTextStyle` is extracted as a single style object used by both the display div and the edit prefix span so typography is identical between states — eliminates the previous "Started at jumps" issue. Single parent flex with `alignItems: "center"` everywhere — no baseline/center alignment switching.
- **Input clock icon hidden globally** — `input[type="time"]::-webkit-calendar-picker-indicator { display: none }` rule added in `index.html`. Applies to all time/date inputs (Hero, schedule editor, EditForm cycle dates, etc.).
- `Input` primitive now sets `colorScheme: dark` so any native UI that does render (e.g. accessible time picker fallbacks) uses dark-theme styling.
- Hero `minHeight: 96` on the inner flex container reserved for the ring + status; `STATUS_ROW_MIN_HEIGHT: 44` reserves the status row height so the slim time input doesn't reflow the card.

**Pass — Session 5 (log-at pill + LogAtSheet + per-supp timestamp schema).**
- New `src/components/LogAtSheet.jsx` — `Modal`-based bottom sheet (mobile) / centered modal (desktop) for logging a missed supplement at a specific time. Shows the supplement name in the title, the original slot due time + slot label as reference text, a time input defaulted to current time, and a primary `Log at HH:MM` button with live label updates.
- App.jsx schema-compat reads:
  - `checkValue(sid, suppId)` raw read
  - `isChecked(sid, suppId)` truthy for both `true` (legacy) and `{ checked: true, at: "HH:MM" }` (new)
  - `checkedAtTime(sid, suppId)` returns the `at` string when present, else null
  - `toggleCheck` writes `true` for normal toggle, deletes the key on uncheck, preserves prior `at` on re-check
  - `logCheckAt(sid, suppId, atTime)` writes the new structured shape
- `SlotCard.jsx` "log at…" pill renders on rows where status is `missed`, supp isn't checked, not read-only, not future. Warning-ochre border + Clock icon. Tapping calls `openLogAt(slot.id, supp, slot.label)` which sets `logAtTarget` and opens the `LogAtSheet`. Supp rows that were checked via log-at display "at HH:MM" with a small Clock icon next to the dose line.
- `App.jsx` `submitLogAt(time)` calls `logCheckAt(target.sid, target.suppId, time)`.
- **Schema:** `daily_logs.checked` jsonb column now stores either `true` (legacy / normal-toggle) or `{ checked: true, at: "HH:MM" }` (log-at). Adherence math (`countExpectedChecks` in `src/lib/adherence.js`) uses truthy checks which work for both shapes — no migration required.

**Pass — Session 6 (take-all on slot icon + first-run hint + Onboarding Step 2 live preview).**
- App.jsx `takeAllInSlot(sid, supps)` — bulk-complete all incomplete supps in a slot. Preserves prior `at` timestamps. Skips already-checked supps. No-op on read-only days.
- `SlotCard.jsx` header split into TWO side-by-side `<button>` elements: slot icon button (left, take-all) + expand button (rest of header). Both have proper aria-labels. Icon button is `disabled` (visually + non-clickable) when read-only, future, or already all-done. Nested-button HTML invalidity avoided.
- First-run hint: `InlineTip id="take-all-hint"` rendered at the top of the slot list when `hasMultiSuppSlot && !isReadOnly && !isPast && !isFuture`. Copy: "Tip · Tap the icon at the left of a slot to log every item in it at once." Dismissed via the X — never returns once dismissed.
- `Onboarding.jsx` Step 2 live preview — new `buildPreviewRows(mode, cfg)` helper computes a row list `{ icon, label, value }` based on selected schedule mode:
  - Anchor (medication / wakeup): rows show offsets from anchor (e.g. `+0:30`, `+1:00`, `+5:00`) with `Pre-Breakfast`/`Breakfast`/etc. labels
  - Fasting: rows show absolute times from `computeIFSlotTimes(cfg)` — fasted, meal_1, optional pre_meal_2/meal_2/pre_meal_3/meal_3, evening (Fixed / Before sleep)
  - Fixed: rows from `FIXED_SLOTS` with their `fixed_times` values
- Preview card sits below the configuration inputs, above the footer. Updates live as the user adjusts inputs. No preview for "none" mode (no schedule to preview).
- **InlineTip primitive reused for both Day-1 tip (Session 3) and take-all hint (Session 6)** — single dismissal mechanism, single storage key pattern (`origin.tip.<id>`).

**Production bundle.** 384.16 KB (102.43 KB gzipped) — up from May 17's 373 KB. +~11 KB for all of: WeekStrip compact mode + Hero state helper + InlineTip + LogAtSheet + take-all logic + Onboarding live preview. No regressions in build or tests.

**Branch:** `worktree-session-2-autocomplete-expand` (uncommitted as of session end — pending PR).

---

## Codebase Health

**App.jsx is ~2040 lines** (May 18 measurement, post-clinician-merge + mobile audit). Still pure orchestration — state, effects, handlers, home screen layout container. Every major rendering concern is in its own focused file. Growth from prior ~1340 came from clinician roster wiring (`activeNavItem`, `selectedPatientId`, patient data fetching/enrichment), send-to-patient flow, mobile audit (`logAtTarget` state, `logCheckAt`, `takeAllInSlot`, `isDay1`, anchor edit state), and desktop right-aside coordination.

**design-system.js is 191 lines** (was 688 before the May 17 cleanup). Only the Achromatic theme ships; the dead Light/Dark/Terminal-* themes were removed, along with the old top-level `colors`/`gradients` exports that no component imported. Production bundle 373 KB / 102 KB gzipped.

**Module structure:**
- `src/lib/api.js` — Supabase data layer + auth (43 exported functions, see API Helpers reference below)
- `src/lib/time.js` — time/date utilities
- `src/lib/notifications.js` — scheduleNotifications, SLOTS, IF_SLOTS (IF v2)
- `src/lib/adherence.js` — adherence calculations (per-date + week + streak)
- `src/lib/navigation.jsx` — NavigationProvider, screenStack, pushScreen/popScreen/resetStack
- `src/config.js` — DEFAULT_CONFIG, FIXED_SLOTS, ANCHOR_NOTES, MODES, deriveOffsets, IF_SLOT_IDS, CORE_SLOTS, computeIFSlotTimes (IF v2)
- `src/design-system.js` — single source of truth for tokens. Exports: `spacing`, `radius`, `typography`, `touch`, `layout`, `shadows`, `zIndex`, `effects`, `breakpoints`, `themes` (Achromatic only), and the reusable `makeSegBtnStyle(theme)` curry that emits `(on) => style` for segmented buttons. The dead Light/Dark/Terminal themes were deleted May 17.
- `src/data/supplements-database.js` — autocomplete static list (~300 entries)
- `src/components/`:
  - Primitives: Button, Card, Input, Label, Badge, Modal, Toast, Loader, InlineLoader, TabBar, InlineTip, Popover, SidePanel, Sparkline, StatusDot
  - Auth & onboarding: Auth, PromptName, Onboarding, NotificationPrompt, IFMigrationScreen
  - Home (mobile): Hero, SlotCard, WeekStrip (compact-mode on mobile, full-size on desktop — both call sites share the same component)
  - Home (desktop): Sidebar, WeekStrip, AdherenceRing, TodayPanel (+ TodayPanelHeader sub-component), SlotRow, SupplementRow, InsightsPanel; DayCell is a named export from WeekStrip.jsx (no standalone file)
  - Modals & screens: EditForm, ScheduleTab, SettingsScreen, ProtocolLibrary, ProtocolDetailScreen, LogAtSheet
  - Clinician surfaces (desktop): PatientRoster (default landing for clinicians), PatientDetailPanel, PatientAnalyticsPanel
  - Shared: HelperText, SupplementNameAutocomplete, DevThemePicker, ToastContext
  - Design system page (dev + portfolio): `design-system-page/DesignSystemPage.jsx`, `design-system-page/registry.js`

**API Helpers Reference (`src/lib/api.js`, 43 functions):**

*Auth:*
- `refreshSession()` — refresh JWT via stored refresh token
- `supa(method, path, body, token)` — base fetch wrapper, auto-retries on 401
- `getSession()` — validate stored JWT or attempt refresh
- `signUp(email, password)`, `signInPassword(email, password)`, `signOut()`
- `updateEmail(newEmail, token)`, `updatePassword(newPassword, token)`

*Supplements:*
- `dbGetSupps(userId, t)` — GET all supplements for user, ordered by created_at
- `dbAddSupp(s, t)`, `dbUpdateSupp(s, t)`, `dbDeleteSupp(id, t)`
- `dbGetAdherenceCounts(userId, suppIds, token, daysBack=365)` — count check marks per supplement over the last N days (default 365)

*Protocols:*
- `dbGetProtocols(userId, t)` — GET all protocols ordered by created_at asc
- `dbAddProtocol(p, t)`, `dbUpdateProtocol(p, t)`, `dbDeleteProtocol(id, t)`
- `dbPauseProtocol(protocolId, t)` — set status='paused' + bulk-reset all member supps via `dbResetProtocolSupps` (internal helper, not exported)
- `dbArchiveProtocol(protocolId, t)` — set status='archived' + bulk-reset all member supps
- `dbActivateProtocol(protocolId, t)` — set status='active'

*Daily logs:*
- `dbGetLog(userId, date, t)` — GET single daily_log by date
- `dbUpsertLog(log, t)` — POST daily_log with on_conflict upsert
- `dbGetDailyLogsRange(userId, start, end, t)` — GET logs in date range (used for week strip)

*Schedule:*
- `dbGetSchedule(userId, t)` — filter by user_id, order by updated_at desc, return latest
- `dbSaveSchedule(data, t)` — DELETE-then-INSERT scoped to user_id (workaround for missing unique constraint, kept as belt-and-suspenders even now that constraint exists)
- `dbUpdateScheduleField(field, value, userId, token)`

*Profile:*
- `dbGetProfile(userId, t)`, `dbCreateProfile(data, t)`, `dbUpdateProfile(userId, data, t)`
- `getThemePreference(userId, token)` ⚠️ stale: validates only light/dark/system
- `setThemePreference(pref, userId, token)`

*Supplement history (autocomplete):*
- `dbGetSupplementHistory(userId, t)`, `dbAddSupplementHistory(userId, name, t)`

*Clinician (May 18 backend):*
- `dbGetMyPatients(clinicianId, t)` — GET all user_profiles where `clinician_user_id` matches
- `dbGetPatientLog(patientId, date, t)`, `dbGetPatientLogs(patientId, start, end, t)` — per-patient adherence reads (RLS-gated via patient consent)
- `dbSendProtocol(send, t)` — POST protocol_sends row (clinician → patient)
- `dbGetReceivedProtocols(patientId, t)` — patient inbox of pending protocol sends
- `dbUpdateProtocolSend(id, data, t)` — patient accepts/dismisses a sent protocol
- `dbGetClinicianNote(clinicianId, patientId, t)` — fetch single note
- `dbUpsertClinicianNote(row, t)` — write/update note on patient
- `dbGetClinicianNotes(clinicianId, t)` — fetch all notes by this clinician

*Notifications:*
- `recomputeNotifications(token)` — POST to edge function with timezone

**Design system: clean.** Achromatic locked as production. All non-Achromatic themes accessible only via dev theme switcher. CSS variable font system handles typography per theme. Radius system clarified (`radius.md` for UI shapes, `radius.full` for genuinely circular).

**Onboarding and ScheduleTab share cascade logic.** Both use the same `applyCascade()` function (defined locally in each file — not a shared import, intentional — same logic, separate contexts). MEAL_ROWS constant removed from Onboarding. Both write `first_meal_offset_hours`, `meal_interval_hours`, `evening_mode` to `offsets` JSONB. `migrateConfig` in ScheduleTab exists only for legacy users who saved before the cascade system; new users never hit it.

**Accessibility state (as of May 12):**
- Touch targets: all interactive elements ≥ 44pt mobile / 32pt desktop. SlotCard expand and checkbox converted to semantic `<button>`. Aria attributes: `aria-expanded` on expand header, `aria-label` + `aria-pressed` on checkboxes.
- `prefers-reduced-motion`: global kill rule in index.html. Four exceptions re-enabled via CSS classes (`.toast-item`, `.supp-checkbox`, `.supp-row`, `.sidebar-nav-item`, `.day-cell`). Loader in its own `<style>` block.
- `:focus-visible`: white 1px outline, 2px offset, global in index.html.
- Modal keyboard: Escape closes, Tab focus trap, auto-focus on open.
- Remaining gaps: `aria-live` regions for toast/loading states, keyboard skip links.

**Known cleanup candidates (low priority):**
- Hero component has 19 props — works, but smell. Future pass could group related state into objects.
- `handleEditFormTogglePause` is dead code (no UI calls it from the Edit form anymore — Pause/Delete moved to Manage)
- Dev theme switcher widget shows 7 themes (Light, Dark, 5 Terminal variants) — could be tucked away further

---

## Known Stale / Legacy Items (Discovered May 11 Diagnostic)

Real debt that exists in the codebase and DB. Not blocking, but worth tracking so future sessions don't get confused or duplicate effort.

**Database stale defaults:**
- `user_schedule.schedule_type` DB default is `'medication_anchored'` — but app writes `medication` / `wakeup` / `fasting` / `fixed` / `none`. Stale DB default never gets used since app always provides a value.
- `user_profiles.theme_preference` DB default is `'system'` — but production is now Achromatic-only. Stale.

**API layer mismatch:**
- `api.js:getThemePreference()` validates only `light` / `dark` / `system` — doesn't recognize `achromatic`. Low severity since app always falls back to achromatic regardless. Real fix worth shipping during HIG pass.

**Legacy schema columns still present:**
- `supplements.timePreference` (text, default `'Anytime'`) — was the original "when to take it" pre-slot system. Not used in current UI; replaced by `slots` array. **May 18:** stripped from `dbUpdateSupp` PATCH body so we no longer write to it; column still exists in DB and can be dropped in a future migration pass when convenient.
- `supplements.paused` (boolean) — superseded by `status` column. Currently both exist. Could be dropped.

**Config legacy:**
- `config.js FIXED_SLOTS` includes `injectable` and `topical` — kept for config compatibility even though removed from notification SLOTS. Real cleanup candidate.
- `DEFAULT_CONFIG.offsets` includes legacy `fasted` key — pre-IF-mode rename.

**Real cleanup approach when bandwidth allows:**
1. Drop `timePreference` and `paused` columns via Supabase Dashboard migration
2. Update `getThemePreference()` to validate `achromatic` only (mirroring `VALID_PREFS`)
3. Update DB defaults to match production reality (or leave as harmless drift)
4. Remove `injectable`/`topical` from FIXED_SLOTS if confirmed unused

None of these are blocking. All are real debt.

---

## Pending Queue for Next Session

### Immediate

**0. Protocol Templates surface — design locked, implementation NEXT (~4-5h).**
Sofia's call after walking through the design conversation:
- **Data model:** add `is_template BOOLEAN NOT NULL DEFAULT FALSE` column to `protocols`. Personal cockpit's `ProtocolLibrary` filters to non-template; new Templates surface filters to template. No row migration needed (existing rows default false).
- **Naming:** sidebar nav entry `"Templates"`; surface heading `"Protocol Templates"`.
- **Placement:** sidebar footer, below `My Origin`. Same compact row treatment as Overview / My Origin.
- **Surface layout:** heading + `"+ New template"` button (top right) + list of template rows (name + supplement count + N-patients-sent stat). Each row clickable → opens ProtocolDetailScreen for editing. Per-row actions: **Send to patient** (Popover with patient picker, reuses existing `dbSendProtocol`) and **Use for myself** (clones the template into a new protocol owned by the clinician with `is_template=false` — taking your own template into rotation).
- **Aside on Templates surface:** collapses like roster (no patient context).
- **Architecture:** Protocol Library and Templates are sibling surfaces — distinct verbs (run vs share). Both surface protocols owned by the clinician; the `is_template` flag distinguishes them.

**0a. §748 modal lane — DONE (May 18 afternoon).**
Modal sizing: shipped (`size="compact"` 360px / `default` 480px). Applied to 6 confirms. Misused modals migrated: Patient actions → Popover, Send-to-patient → Popover, EditForm → SidePanel, ProtocolDetailScreen overflow + Send-to-patient → Popovers. Open items deferred: Onboarding + IFMigrationScreen full-screen treatment (kept as full-screen for now — Sofia: "let's revisit later"); EditForm duplication across desktop/mobile branches (kept duplicated — touchpoint is small and they'd drift if combined poorly).

**0b. Phase 3 Patient Roster — DONE (May 18 afternoon, commit `483eec0`).**
Default clinician landing. Alphabetical sort default + column-click sort. Filter chips (All / Needs review / Quiet 7d). KPI cards. Aside collapses on roster view. Overview entry in sidebar provides explicit nav back.

**0c. Remaining recommendation phases:**
- **Phase 4 — Power user** (~10h). `⌘K` command palette (patients + protocols + actions). `[7D] [30D] [90D]` zoom toggle on WeekStrip in patient view.
- **Phase 5 — Clinical narration** (~5h, design-heavy). Anomaly callouts (banner when 7d adherence drops >25 pts below 30d) — copy and threshold rules need Sofia. `<MetricLabel>` primitive with inline `?` definitions to anchor what "adherence" means without crossing into medical advice.

**0d. Portfolio link update at vonhauske.design/origin-app.**
Update the portfolio entry to reflect the current `/design-system` URL and any copy changes needed after this morning's work. Low effort, high visibility.

### Highest priority

**1. Apple HIG remaining gaps (foundational pass shipped May 12, color contrast shipped May 15, empty states shipped May 17).**
The foundational pass shipped touch targets, reduced-motion, focus states, and Modal keyboard. Color contrast (text.muted → text.secondary) shipped May 15. Empty states tokenized + decorative-emoji replaced with `◯` glyph May 17 (commit `565eaea`). Remaining:
- **`aria-live` regions:** Toast announcements and loading state changes not announced to screen readers.
- **Keyboard skip links:** no skip-to-content link for keyboard-only desktop navigation.
- **Form patterns:** Auth ✓, SettingsScreen ✓ (commit `3bdedb3`). EditForm — closed, intentionally not a form: no credentials so no autofill payoff, validation is already in JS, Enter inside Notes should produce a newline not a submit, and save is a deliberate footer-button action.
Estimated: 1 session for aria-live + skip links.

**1a. DB perimeter — DONE May 17 (Supabase Dashboard work, no git commit).**
RLS enabled on all 9 tables in public schema (user_schedule, daily_logs, user_supplement_history, supplements, protocols, user_profiles, protocol_sends, push_subscriptions, notifications_queue). 22 policies live — original owner-only + clinician_reads_patient_* policies preserved; my proposed duplicates dropped during cleanup. UNIQUE constraints added on `user_schedule(user_id)`, `daily_logs(user_id, log_date)`, `user_supp_history_user_name_unique` on `user_supplement_history(user_id, name)`. The DELETE-then-INSERT in dbSaveSchedule is now belt-and-suspenders; the constraint enforces uniqueness at the DB.

### Medium priority

**2. Protocol Library — Phase 1-3 SHIPPED (May 16).** See Features Shipped. Phase 2 (export/import via link) and Phase 3 (adherence sharing) are next clinician roadmap milestones — unstarted.

**3. Web Push notifications — SHIPPED** (moved from pending — confirmed via DB diagnostic May 11)
Service Worker, VAPID subscription flow, `recompute_notifications` + `process_notifications_queue` edge functions all live. `push_subscriptions` table exists, 2 users have `notifications_enabled = true`, 68 notifications currently queued. Commits: `1983728` (sub flow Pass 2), `a0ff155` (edge function + frontend), `4a25934` (process queue). Remaining work: verify notification delivery reliability for real users (OVH and Bego), any UX gaps discovered from real use.

**4. Configurable meal count — IF side addressed (May 17).**
IF v2 makes meal_count a first-class user-facing setting (2 or 3 meals, with the slot picker filtering accordingly). Cascade-mode meal count (Medication / Wakeup) is still hard-coded to 3 — separate decision if/when that becomes friction.

### Mobile audit (May 18) — DONE + MERGED
**Full audit shipped end-to-end across 6 sessions on `worktree-session-2-autocomplete-expand`, merged to main in commit `1c6eaec`.** See "Session of May 18" in Today's Major Work for the detailed implementation log. Items shipped:

| Rec | What | Where to see it |
|---|---|---|
| 1 | Week strip on mobile (compact mode) | Mobile home above Hero |
| 2 | Decouple Start-day from logging (D1) | Hero "+ Set anchor" pill in no-anchor state |
| 3 | Log-at pill + time picker sheet (D5) | Missed slot rows → `LogAtSheet` |
| 4 | Recents on empty autocomplete | EditForm Name field, focused + empty |
| 5 | Remove forced auto-expand on SlotCard | Slot cards on home |
| 6 | Past-day Edit in header (replaces opacity dim) | Mobile header right-side on past days |
| 7 | Take-all on slot icon (D3) | Slot icon left of header on mobile |
| 8 | Sign-out confirmation modal | Settings → Sign out |
| 9 | Onboarding Step 2 live preview | New-user onboarding step 2 |
| 10 | Hero composition cleanup | Single `getHeroState` helper + render template |
| 11 | Anchor-aware Hero copy ladder (D2) | All Hero states |
| Polish | Day-1 inline tip (D4) + InlineTip primitive | Home empty state for new users |
| Polish | "MY PROTOCOL" eyebrow + chevron date row gone | Mobile header |

### Next session — Lifecycle consolidation + soft delete (locked May 18, ~4–6h, bundled)

Three workstreams that sit in the same conceptual neighborhood and touch overlapping files (`App.jsx`, `ProtocolLibrary.jsx`, `EditForm.jsx`, manage flows). Bundle into one session.

**Workstream 1 — Supplement lifecycle: drop Stop entirely (keep Pause only).**
Current shipped state has both `paused` (legacy boolean) and `status` (`active`/`paused`/`stopped`). Sofia's call: the active vs not-active distinction is the only thing that earns its keep — `stopped` is just `paused` with extra ceremony. Plan:
- Remove all "Stop" CTAs from EditForm + manage screens.
- Remove the "Stopped" tab; rename what was "Paused" tab → just **Paused** and surface all not-active supps there.
- Row in the Paused tab: supplement name + small `(paused)` tag + two icon affordances on the right — **play** (resume → status='active') and **trash** (soft-delete; see Workstream 3).
- DB migration (Supabase Dashboard): `UPDATE supplements SET status = 'paused' WHERE status = 'stopped';` Optional follow-up: enum constraint to forbid `'stopped'` going forward.
- Code: `handleEditFormTogglePause` (currently dead per Codebase Health note) can be deleted entirely. Any branch that special-cased `status === 'stopped'` collapses into `status === 'paused'`.

**Workstream 2 — Protocol lifecycle: drop Pause entirely (keep Active + Archived).**
Mirror of Workstream 1 on the protocol side. For protocols, archive is the verb that makes sense — you don't pause a protocol, you put it on the shelf. Plan:
- Remove "Pause" CTA from ProtocolLibrary row actions + ProtocolDetailScreen overflow.
- Status set becomes `active` | `archived`. The "Paused" tab/segment in ProtocolLibrary collapses into Archived.
- DB migration: `UPDATE protocols SET status = 'archived' WHERE status = 'paused';`
- `dbPauseProtocol` can be deleted; `dbArchiveProtocol` remains. Both currently bulk-reset member supps via `dbResetProtocolSupps` — keep that behavior on archive.

**Workstream 3 — Soft delete + active-on-date past adherence (fixes the 35-of-36 bug).**
The bug: Sofia deleted a supplement, and yesterday's adherence dropped from 100% → 97%. Root cause: `countExpectedChecks` uses the *current* `isActiveSupp()` filter to decide which supps were expected on a past date — so any current-state change (delete, pause, stop) retroactively rewrites the past. Fix:
- DB migration: `ALTER TABLE supplements ADD COLUMN deleted_at timestamptz;` (nullable; null = not deleted).
- Trash icon in Paused tab and any "delete" CTA writes `deleted_at = now()` instead of hard `DELETE`. `dbDeleteSupp` becomes a soft-delete (rename to `dbSoftDeleteSupp` or leave name, document behavior). A hard-delete path can stay for admin/test cleanup but is not user-reachable.
- All read queries (`dbGetSupps`) gain `&deleted_at=is.null` filter so the cockpit never sees deleted rows.
- Adherence math: introduce `isSupplementActiveOn(supp, date)` predicate that considers `created_at` (already shipped May 18 in `lib/time.js`), `deleted_at`, AND a paused-on-date check via `status_changes` (deferred — for now treat `paused` as "not expected today onward" only; past days continue to expect based on `created_at` floor + `deleted_at` ceiling). `countExpectedChecks` swaps from current-`isActiveSupp` to per-date `isSupplementActiveOn`.
- Verify: delete a supp today, yesterday's % stays at whatever it was. Pause a supp today, yesterday's % stays put (paused is forward-looking; retro paused-day tracking deferred until we add `status_changes` history).

**Order of operations within the session:**
1. Run all three migrations in Supabase Dashboard first (additive — won't break the running app).
2. Workstream 3 first (soft delete plumbing + active-on-date) because both other workstreams depend on the trash icon going through the soft path.
3. Workstream 1 (supp Stop → Pause).
4. Workstream 2 (protocol Pause → Archive).
5. Update Codebase Health + remove the "supplements.paused legacy column" / "handleEditFormTogglePause dead code" notes once cleaned up.

### Active backlog (locked from May 18 backlog review)

Sofia did a multi-select keep/discard pass across the parked queue on May 18 (post-audit-merge). Items below are confirmed in-scope and ranked roughly by readiness; items moved to "Considered + discarded" are explicitly out of scope until a new signal surfaces them.

| # | Item | Notes |
|---|------|-------|
| 1 | **Symptom logging** | Free-text journal vs structured ratings still open. Schedule a design conversation before any build. |
| 2 | **Motion / skeleton screens pass** | Initial-load skeletons (MOB-019), checkbox tick animation, hero ring fill, page transitions. Polish moment, not blocking. |
| 3 | **`aria-live` regions + skip links** | Toast/loading announcements + keyboard skip links. Builds on May 12 HIG pass. |
| 4 | **Name required on sign-up** | Currently optional; spec was required. One-line schema/UI change. |
| 5 | **Rename "Name" / `display_name` → "Full name"** | Clearer label; same column, no migration. |
| 6 | **`icon-bare` Button variant** | Encapsulate inline `border:none` overrides on icon-only buttons (e.g., overflow menus). |

### Parked but worth keeping in view

- **MOB-009 — slot card chevron discoverability** — partially addressed by the split header take-all (May 18); revisit only if real-use shows friction.
- **B3 persona finding (one-handed reach on left chevron)** — chevron date row was removed May 18 in favor of week strip. Original finding obsolete under the new pattern — re-evaluate only if a new one-handed friction signal appears.

### Considered + discarded (May 18 backlog review)

These were on the parked list but Sofia chose not to invest in them. Recorded so future sessions don't re-surface them unnecessarily.

- **Injectables-as-event-log** — log-at flow (May 18 mobile audit) now captures actual log time per supplement. Sofia judged the partial overlap good enough for now; no dedicated dose-log UX is planned.
- **Portfolio link from `/design-system`** — page is publicly accessible and portfolio-visible already; an explicit "back to portfolio" link adds clutter and isn't needed.
- **Web Push reliability re-audit** — `process_notifications_queue` dead-subscription cleanup (404/410 auto-delete) is shipped; no new reliability complaints. Revisit only if real users report missed notifications.
- **Configurable meals-per-day count** — current 2-meal default works; making it user-configurable adds onboarding surface area without a real signal asking for it.

---

## NEW: Clinician Direction (Phased Roadmap)

**Framing:** Origin is always a personal app. The clinician feature is **protocol-sharing + adherence-sharing**, layered on top. Same Origin app, same login — clinician role is metadata, not a separate platform.

**Why this framing:** keeps Origin outside HIPAA territory. Origin is not a "covered entity" or "business associate" — it's a personal wellness tracking tool that happens to support sharing with healthcare providers as a user-controlled feature.

**Privacy posture:**
- "Origin is a personal wellness tracking app, not a medical device."
- "Your data belongs to you. You can share it with anyone you choose."
- "Origin is not HIPAA-covered and is not intended for use as a substitute for medical advice."

### Phase 1 — Protocol Layers (Foundation)

Modular and combinable protocols, not just switchable. User has a baseline protocol (daily foundation). Additional protocols can be layered on top with stack modes:
- **Replace** — new protocol fully replaces current
- **Add on top** — new protocol stacks alongside current
- **Pause others** — new protocol runs while others temporarily pause

Time-bounded protocols (with start/end dates) make the system self-cleaning. Estimated 10-15 hours including data migration and stack-mode UI.

### Phase 2 — Protocol Export/Import via Link

Generate shareable link → "Share this protocol" button → preview screen → "Import to my Origin" button. Imported protocols include attribution ("From [Creator Name]"). Estimated 6-8 hours.

### Phase 3 — Adherence Sharing

Optional consent toggle at import time. Per-user drill-down for creators with 7-day and 30-day adherence percentage. Audit log of access events. Estimated 8-12 hours.

---

## Sofia's Working Style (Notes for the New Chat)

- **Push back honestly.** Sofia values direct critique over agreement. If a design direction is wrong, say so with reasoning.
- **No flattery.** Skip "great question" preambles. Get to the answer.
- **Bias toward action, but verify before stacking.** When something works, ship it. When it doesn't, diagnose carefully — don't keep patching.
- **Stop when tired.** Sofia ships in long sessions; help her recognize good stopping points. Stacked refactors at 2am go badly.
- **Sofia is a designer, not a developer.** She uses Claude Code in Cursor as the build mechanism. Prompts should be detailed, scoped, and include verify steps.
- **Real-use feedback beats inspection.** When in doubt, recommend "use the app for a week, come back with friction signals."
- **Watch for decision-fatigue patterns.** When Sofia answers "I agree" to multiple multi-part judgment questions in a row, flag honestly and offer a real stopping point.
- **Visual decisions benefit from real screens, not descriptions.** Ship and iterate beats designing in conversation alone.

---

## Quick Reference

**Current accent color:** `#FFFFFF` (pure white under Achromatic)
**Current surface base:** `#0D0D0D` (near-black)
**Typography:** JetBrains Mono body/data + Space Grotesk heading
**Modal pattern:** Bottom sheet on mobile (drag-to-dismiss), centered modal on desktop
**Breakpoint:** 1024px hard switch between mobile and desktop layouts
**Radius:** 0 for all UI elements (`radius.full` 9999 reserved for circular shapes)

**Critical files:**
- `src/App.jsx` (~2040 lines post-May 18 — orchestration for both mobile + desktop branches, clinician roster wiring, mobile audit state for log-at + take-all + anchor edit)
- `src/design-system.js` (Achromatic + dev variants, CSS variable font system)
- `src/config.js`:
  - `DEFAULT_CONFIG` — `{ pre_meal_window: 30, breakfast: 60, lunch: 300, dinner: 540, after_dinner: 660, window_start: 0, window_length: 480, meals_per_day: 2, fixed_times: {...} }`
  - `FIXED_SLOTS` (9): pre_breakfast, breakfast, pre_lunch, lunch, pre_dinner, dinner, after_dinner, injectable, topical (legacy keep)
  - `MODES` (5): none, medication, wakeup, fasting, fixed — used for internal lookups
  - `DISPLAY_MODES` (4): none, anchor, fasting, fixed — UI-only grouping; never stored in DB
  - `ANCHOR_SUB_MODES` (2): medication, wakeup — sub-selector within Anchor card
  - `ANCHOR_NOTES`, `getSlotLabelForMode()`, `deriveOffsets()`
- `src/data/supplements-database.js` (autocomplete static list ~300 entries)
- `src/components/` (33 files, primitives + composed)

**Supabase tables (verified May 11 via schema diagnostic):**

**`supplements`** (21 columns, RLS enabled):
- `id` (uuid, default `gen_random_uuid()`)
- `user_id` (uuid, NOT NULL)
- `name`, `dose`, `notes` (text)
- `slots` (array), `days` (array)
- `category` (text — Oral / Rx / Injectable / Topical)
- `treatment_mode` (text, default `'indefinite'` — values: indefinite / scheduled / cycled)
- `starts_at`, `ends_at` (date)
- `cycle_on_value`, `cycle_off_value` (integer)
- `cycle_on_unit`, `cycle_off_unit` (text — days / weeks / months)
- `status` (text, default `'active'` — values: active / paused / stopped)
- `stopped_at` (date)
- `created_at`, `updated_at` (timestamptz, default `now()`)
- **Legacy columns still present:**
  - `timePreference` (text, default `'Anytime'`) — no longer used in current UI
  - `paused` (boolean) — superseded by `status`

**`user_schedule`** (RLS enabled):
- `user_id`, `schedule_type` (text, DB default `'medication_anchored'` is stale — app writes `medication` / `wakeup` / `fasting` / `fixed` / `none`)
- `offsets` (jsonb, 8-key default — includes legacy `fasted` key)
- `meal_times` (jsonb, currently null for all live rows)
- `notifications_enabled` (boolean, default false)
- `created_at`, `updated_at`

**`daily_logs`:**
- `id`, `user_id`, `log_date`
- `pill_time` (time — anchor time for flexible mode, set when user taps Start Day)
- `checked` (jsonb, default `'{}'`) — keys: `${date}_${slotId}_${suppId}` or `${date}_anytime_${suppId}`.
  - **Values (post-May 18 mobile audit):**
    - `true` — legacy on-time check (pre-Session 5)
    - `{ checked: true, at: "HH:MM" }` — new shape written by `logCheckAt` when user taps the "log at…" pill on a missed slot row
    - missing key — unchecked (uncheck via `toggleCheck` removes the entry rather than writing `false`)
  - Both shapes coexist in the same column. `isChecked` in App.jsx returns truthy for either. Adherence math (`countExpectedChecks`) does a truthy test → both work. No `ALTER`/`UPDATE` migration was required.

**`user_profiles`:**
- `id` (FK to auth.users)
- `display_name` (text)
- `theme_preference` (text, DB default `'system'` is stale — production is achromatic-only)
- `created_at`, `updated_at`
- RLS per-user

**`user_supplement_history`:**
- `user_id`, `name`, `created_at`
- RLS per-user, upserted on supplement add with `on_conflict do nothing`

**`notifications_queue`:**
- `id`, `user_id`, `fire_at`, `title`, `body`
- `slot_id` (text — values: rx, pre_breakfast, breakfast, pre_lunch, lunch, pre_dinner, dinner, after_dinner, window_open, window_closing, course_end)
- `scheduled_for_date`, `fired` (boolean), `fired_at`
- `tag` — used for dedup on upsert (replaces existing unfired rows)
- `created_at`

**`push_subscriptions`:**
- `id`, `user_id`, `endpoint`, `p256dh`, `auth`, `user_agent`, `created_at`
- VAPID subscription storage. Dead subscriptions (404/410 from push service) auto-deleted by `process_notifications_queue` edge function.

**Migrations:** No `supabase/migrations/` directory exists. Schema is managed via Supabase Dashboard directly. Application-level migrations run inline via edge functions (e.g., `recompute_notifications` auto-stops supplements past their `ends_at`).

---

## Suggested First Action for the New Chat

Read this document plus `/ORIGIN-DESIGN-RULES.md`. State of the world:

- Mobile UX audit (all 12 recommendations) shipped + merged to main (`1c6eaec`).
- Clinician Phase 3 (Patient Roster as default landing) shipped + merged (`483eec0`).
- §748 modal lane closed (Popover/SidePanel primitives + 6 confirm modals sized compact).
- Backlog reviewed; 6 items locked on active queue, 4 explicitly discarded.

Two pieces of in-flight work are queued as the next sessions, in this order:

1. **Protocol Templates surface** (~4–5h) — see Pending Queue item 0. Design is locked: `is_template` column on `protocols`, sidebar entry below My Origin, list of template rows with per-row Send-to-patient + Use-for-myself. Architecture distinction (run vs share) drives the separation from ProtocolLibrary. Start with the DB migration, then the new `Templates.jsx` component, then sidebar wiring, then ProtocolLibrary filter update.

2. **Lifecycle consolidation + soft delete** (~4–6h, bundled session) — see "Next session — Lifecycle consolidation + soft delete" above. Drop Stop entirely (supplements → Active/Paused only), drop Pause entirely (protocols → Active/Archived only), add `supplements.deleted_at` + active-on-date filtering so historical adherence is never rewritten by current state changes. Order: migrations first, then soft-delete plumbing (Workstream 3), then supp lifecycle (Workstream 1), then protocol lifecycle (Workstream 2). This fixes the 35-of-36 bug Sofia reported on May 18.

If Sofia hasn't picked between them, default to Templates first — it's smaller, lighter on schema risk, and unblocks the clinician roadmap. Lifecycle work is a refactor that can wait a session without anyone noticing the drift.

Anything outside these two is on the active backlog (Symptom logging design conversation, motion/skeleton pass, aria-live + skip links, Name required, Full name rename, icon-bare Button variant) — touch only if explicitly asked.

---

*End of handoff document.*
