# Origin — Project Handoff Document

*Last updated: May 11, 2026 (late evening — desktop responsive Home shipped through Phase 4, Achromatic locked as production identity, HIG audit document drafted, Treatment field documented, comprehensive diagnostic completed, handoff doc committed to repo, queue cleaned up for next session)*
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

**7 primitives:**
- `Button` — variants: primary, secondary, tertiary, destructive, icon, pill, startDay (+ size: default/compact)
- `Input`
- `Card`
- `Badge`
- `Label`
- `Modal` — bottom sheet on mobile (drag-to-dismiss), centered modal on desktop
- `Toast` — supports optional `action` prop for Undo affordances, top-anchored

**Notable patterns:**
- Pill width-locked via CSS `::before` pseudo-element so bold-active state doesn't cause layout shift
- Border hierarchy inverted: inactive pills use `borderSubtle`, active pills use `accent` border
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

**5 schedule modes** (default for new users = No Schedule):
- No Schedule — pure checklist, no times, no notifications
- Medication Anchor — cascades from when you take your medication
- Wake Up Anchor — cascades from when you wake up
- Intermittent Fasting — built around eating window
- Fixed Times — same schedule every day

**Categories:** Oral, Rx, Injectable, Topical (with category-aware form behavior)

**Slot vocabulary:**
- Anchor (Medication Anchor mode only)
- Pre-Breakfast, Breakfast
- Pre-Lunch, Lunch
- Pre-Dinner, Dinner
- Evening (time-of-day bucket — Fixed time OR Before sleep)
- Anytime (explicit pill, stored as `slots: []`)

**Recoverable late state** — slots that pass without check-ins get a small muted ochre "late" badge. Slot card stays standard. Frame is "you can still take this," not "you failed."

**Manage Protocol** (3-tab screen, promoted from nested under Settings):
- **Active tab** — current supplements (status = 'active'), Pause/Resume per supplement
- **Stopped tab** — archive of stopped supplements (status = 'stopped'). Currently view-only; restart from UI not implemented. Delete available.
- **Schedule tab** — schedule editor with silent auto-save, replacing old ScheduleModal

**Settings panel** (slide-in screen):
- Account section (Manage Account dissolved inline — display name, email, password change)
- Notifications toggle
- Sign-out
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
- Mobile: 60% opacity, all interactions disabled, Hero eyebrow reads "VIEWING [date]"
- Desktop: PAST DAY label in Today panel header, slot rows still expandable for review
- Edit button on Hero card (mobile) / Today panel header (desktop) unlocks editing for session
- Edit mode allows ONLY checkbox toggling and pill_time editing
- Add/edit/delete supplements and schedule editing remain hidden in both states

**Length of treatment (per-supplement, via `treatment_mode` column):**

Three modes, default `indefinite`:
- **Indefinite** — no date bounds, always active. `isSupplementActiveOn()` returns true unconditionally.
- **Scheduled** — uses `starts_at` and/or `ends_at` date fields. Adherence and notifications filtered by date bounds. Edge function auto-stops supplements when `ends_at ≤ today` (sets `status = 'stopped'`, `stopped_at = today`).
- **Cycled** — uses `cycle_on_value` + `cycle_on_unit` + `cycle_off_value` + `cycle_off_unit`. Modulo math in `isSupplementActiveOn()`: `daysSinceStart = (date - starts_at) in days`, `cycleDays = onDays + offDays`, `active = (daysSinceStart % cycleDays) < onDays`. Days-of-week picker hidden for cycled mode (all days implied). Which-days adherence check skipped for cycled supps. Cycle units: `days`, `weeks`, `months`.

Treatment pill picker appears in EditForm between Category and "When to take it" sections (reordered Treatment-first in commit 28b3e3b).

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
4. **Category** — pill picker: Oral / Rx / Injectable / Topical
5. **Treatment** — pill picker: Indefinite / Scheduled / Cycled
   - If Scheduled: Starts (date) + Ends (date, optional)
   - If Cycled: On (value + unit) + Off (value + unit) + Starts (date)
6. **When to take it** — pill picker: rx (shown if mode = medication OR already tagged), pre_breakfast, breakfast, pre_lunch, lunch, pre_dinner, dinner, after_dinner, Anytime
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
- **Radius leak round 1 under Terminal themes** — UI pills + chevron buttons + settings gear used `radius.full` (9999) directly. Fixed by referencing `radius.button` token instead, leaving `radius.full` for genuinely circular shapes.
- **Radius leak round 2** — Round 1 fix didn't catch pill variants and day-of-week picker. Category pills, Treatment pills, When-to-take pills, Which-days circles all still rendered circular under Achromatic. Fixed in commit a14f8e3.
- **Selected day visual hierarchy inverted** — slate blue tint was too subtle against white-elevated cells, making selected cell look recessed. Fixed by strengthening opacity values.
- **Past day expansion locked in read-only mode** — chevron click toggle was gated on `!isReadOnly`. Fixed by removing that gate (only checkbox/edit are gated, expansion is always available).
- **Week strip adherence ring stale after past-day edit** — week strip read from snapshot `weekLogs` not updated by checkbox toggle. Fixed by updating `weekLogs` state alongside `loggedSupps` on toggle.

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
UI pill elements (theme picker pills in Settings, chevron navigation buttons, Settings gear button) referenced `radius.full` (9999) directly, so they stayed circular under Achromatic's zero-radius treatment. Fixed by introducing `radius.button` token that maps to theme's UI radius (0 under Achromatic). Account avatar kept at `radius.full` (legitimate circular shape). Adherence rings unchanged.

**Document — HIG-informed design rules drafted**
Apple HIG audit document drafted covering 15 categories: Touch targets, State systems, Modals & sheets, Navigation, Accessibility, Typography, Spacing, Color & contrast, Animation & motion, Forms & inputs, Feedback patterns, Buttons, Lists & rows, Empty states, Onboarding. v1 baseline with HIG-compliant defaults. Pending: save to repo as `/ORIGIN-DESIGN-RULES.md`, then bulk fix pass to apply to existing components.

**Pass — Radius leak fix round 2 (May 11 late evening)**
Round 1 didn't catch pill variants and day-of-week picker. Category pills, Treatment pills, When-to-take pills, and day-of-week circles in EditForm were still rendering rounded under Achromatic. Fixed in commit a14f8e3.

**Document update — Comprehensive diagnostic (May 11 late evening)**
Ran full state diagnostic via Claude Code: schema verification, component inventory, API helper inventory, recent commits, production user count. Surfaced: Treatment mode column structure (treatment_mode + cycle_on/off_value/unit), status column replacing legacy `paused` boolean, 4th user account (dra.orozcobp, abandoned onboarding), Loader minimum 3000ms behavior, 22 API helpers, multiple legacy/stale items worth tracking. Handoff document updated to match actual production state.

---

## Codebase Health

**App.jsx is ~554 lines** (down from 1,295 after previous refactoring). Pure orchestration — state, effects, handlers, home screen layout container. Every major rendering concern is in its own focused file.

**Module structure:**
- `src/lib/api.js` — Supabase data layer + auth (22 exported functions, see API Helpers reference below)
- `src/lib/time.js` — time/date utilities
- `src/lib/notifications.js` — scheduleNotifications, SLOTS
- `src/lib/adherence.js` — adherence calculations (per-date + week + streak)
- `src/lib/navigation.jsx` — NavigationProvider, screenStack, pushScreen/popScreen
- `src/config.js` — DEFAULT_CONFIG, FIXED_SLOTS, ANCHOR_NOTES, MODES, deriveOffsets
- `src/design-system.js` — single source of truth for tokens (Achromatic + dev themes)
- `src/data/supplements-database.js` — autocomplete static list (~300 entries)
- `src/components/`:
  - Primitives: Button, Card, Input, Label, Badge, Modal, Toast, Loader, InlineLoader
  - Auth & onboarding: Auth, PromptName, Onboarding
  - Home (mobile): Hero, SlotCard, WeekStrip (mobile date picker)
  - Home (desktop): Sidebar, WeekStrip, DayCell, AdherenceRing, TodayPanel, SlotRow, SupplementRow, InsightsPanel
  - Modals & screens: EditForm, ScheduleTab, SettingsScreen, ManageProtocolScreen, ManageAccount
  - Shared: HelperText, SupplementNameAutocomplete, DevThemePicker, ToastContext

**API Helpers Reference (`src/lib/api.js`, 22 functions):**

*Auth:*
- `refreshSession()` — refresh JWT via stored refresh token
- `supa(method, path, body, token)` — base fetch wrapper, auto-retries on 401
- `getSession()` — validate stored JWT or attempt refresh
- `signUp(email, password)`, `signInPassword(email, password)`, `signOut()`
- `updateEmail(newEmail, token)`, `updatePassword(newPassword, token)`

*Supplements:*
- `dbGetSupps(t)` — GET all supplements ordered by created_at
- `dbAddSupp(s, t)`, `dbUpdateSupp(s, t)`, `dbDeleteSupp(id, t)`
- `dbGetAdherenceCounts(suppIds, token)` — count check marks per supplement across all logs

*Daily logs:*
- `dbGetLog(date, t)` — GET single daily_log by date
- `dbUpsertLog(log, t)` — POST daily_log with on_conflict upsert
- `dbGetDailyLogsRange(start, end, t)` — GET logs in date range (used for week strip)

*Schedule:*
- `dbGetSchedule(t)`, `dbSaveSchedule(data, t)`, `dbUpdateScheduleField(field, value, userId, token)`

*Profile:*
- `dbGetProfile(userId, t)`, `dbCreateProfile(data, t)`, `dbUpdateProfile(userId, data, t)`
- `getThemePreference(userId, token)` ⚠️ stale: validates only light/dark/system
- `setThemePreference(pref, userId, token)`

*Supplement history (autocomplete):*
- `dbGetSupplementHistory(t)`, `dbAddSupplementHistory(name, t)`

*Notifications:*
- `recomputeNotifications(token)` — POST to edge function with timezone

**Design system: clean.** Achromatic locked as production. All non-Achromatic themes accessible only via dev theme switcher. CSS variable font system handles typography per theme. Radius system clarified (`radius.md` for UI shapes, `radius.full` for genuinely circular).

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
- `supplements.timePreference` (text, default `'Anytime'`) — was the original "when to take it" pre-slot system. Not used in current UI; replaced by `slots` array. Could be dropped in a migration pass.
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

---

## Pending Queue for Next Session

### Highest priority

**1. Save handoff + design rules documents to repo.**
This file (`origin-handoff.md`) and the drafted HIG rules document (`ORIGIN-DESIGN-RULES.md`) need to be committed to the repo root. Future sessions reference both.

**2. Apple HIG bulk fix pass.**
The HIG document is drafted but no fixes have shipped. Real engineering work to apply rules to existing components:
- Touch target audit: scan all interactive elements for sub-44pt mobile hit areas
- State coverage: verify all components implement required states (focus states most critical)
- `prefers-reduced-motion`: add global CSS rule honoring user preference
- Modal patterns: verify scroll-to-top, sticky header/footer, dismiss methods
- Color contrast: verify all text/background pairs meet WCAG AA, adjust `text.muted` if needed
- Form patterns: verify real `<form>` elements, `autoComplete`, in-flight protection
- Empty states: add treatments where currently blank
Estimated: 2-3 sessions of focused engineering.

### Medium priority

**3. Protocol library / sharing feature (Phase 1 of clinician roadmap).**
Locked use cases from earlier conversations:
- Save current setup as a template, restart later
- Share protocol with friend / clinician
- Layer additional protocols on top of foundation

Multi-session work. Fresh design conversation needed at start. Real architectural question: unified system or three separate features. Real data model decisions ahead (protocols table, sharing table, layering semantics).

**4. Web Push notifications — SHIPPED** (moved from pending — confirmed via DB diagnostic May 11)
Service Worker, VAPID subscription flow, `recompute_notifications` + `process_notifications_queue` edge functions all live. `push_subscriptions` table exists, 2 users have `notifications_enabled = true`, 68 notifications currently queued. Commits: `1983728` (sub flow Pass 2), `a0ff155` (edge function + frontend), `4a25934` (process queue). Remaining work: verify notification delivery reliability for real users (OVH and Bego), any UX gaps discovered from real use.

**5. Configurable meal count.**
Parked. Unified `meals` array decision (or keep IF's `meals_per_day` separate from cascade modes' configurable count). Needs fresh design thinking.

### Lower priority (parked from various sessions)

- **Injectables-as-event-log** — instead of daily checkboxes, log doses with timestamps + units. Useful for Tirzepatide titration.
- **Symptom logging** — free-text journal vs structured ratings. Open design questions.
- **Motion graphics pass** — skeleton screens, checkbox tick animation, hero progress ring fill animation, page transitions. Real polish moment.
- **Accessibility hardening** — `aria-live` regions, keyboard skip links, focus management refinement.
- **Mobile design refresh under Achromatic** — desktop got the new identity, mobile may need explicit alignment. Verify Hero card, slot cards, slot picker, all primary surfaces under Achromatic. Likely already works (token-based theme) but visual check needed.
- **Name field required on sign-up** — currently shipped optional, spec was required.
- **Rename "Name" / "display_name" to "Full name"** — clearer ask.
- **`icon-bare` Button variant** — encapsulate inline border:none overrides on icon buttons.

### Parked from past sessions (lower urgency)

- **MOB-026 — accessibility role/aria markup** on supplement row checkboxes and slot card expand headers.
- **MOB-009 — slot card chevron discoverability** on mobile (no visual cue that headers are tappable).
- **MOB-019 — skeleton screens during initial app load.**
- **B3 persona finding** — left chevron one-handed reach issue, swipe gesture on date row could help right-handed one-handed use.

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
- `src/App.jsx` (~554 lines, viewport detection for desktop branch)
- `src/design-system.js` (Achromatic + dev variants, CSS variable font system)
- `src/config.js`:
  - `DEFAULT_CONFIG` — `{ pre_meal_window: 30, breakfast: 60, lunch: 300, dinner: 540, after_dinner: 660, window_start: 0, window_length: 480, meals_per_day: 2, fixed_times: {...} }`
  - `FIXED_SLOTS` (9): pre_breakfast, breakfast, pre_lunch, lunch, pre_dinner, dinner, after_dinner, injectable, topical (legacy keep)
  - `MODES` (5): none, medication, wakeup, fasting, fixed
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
- `checked` (jsonb, default `'{}'`) — keys: `${date}_${slotId}_${suppId}` or `${date}_anytime_${suppId}`

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

Read this document plus `/ORIGIN-DESIGN-RULES.md` (once committed). Then real first action depends on Sofia's priorities:

1. **If continuing identity/design work:** spend a week using Origin in Achromatic. Surface friction signals from real daily use. Likely candidates: mobile screens may need explicit alignment to Achromatic (verify Hero card, slot cards, etc. all render well under the new identity), specific HIG audit items.

2. **If shipping new features:** Web Push notifications (highest user value), then Protocol Library Phase 1 (foundation for clinician work).

3. **If focused engineering:** HIG bulk fix pass (real backlog of audit findings to apply).

4. **If everything feels solid:** start clinician feature roadmap conversation, beginning with Protocol Library Phase 1 design.

---

*End of handoff document.*
