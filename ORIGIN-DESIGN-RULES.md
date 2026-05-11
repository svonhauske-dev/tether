# ORIGIN-DESIGN-RULES.md

> **Purpose.** This document is Origin's HIG-informed design system reference. Both Claude Code and human contributors follow these rules when building new features, fixing existing components, or making design decisions. Apple HIG is the baseline authority; Origin-specific overrides are documented with rationale.
>
> **Status.** v1 — drafted May 11, 2026. Decisions are HIG-compliant defaults with Origin-specific adjustments. Items marked **[REVISIT ON RENDER]** are locked as v1 but may be adjusted once seen in implementation.
>
> **How to use.** When designing or building any interactive element or screen in Origin, reference the relevant category. When a new pattern emerges that isn't covered here, add a section.
>
> **Conversation history.** Categories 1 (Touch Targets) and 2 (State Systems) were walked through in real conversation. Categories 3–15 were drafted with HIG-compliant defaults; expect revision during real implementation when the visuals can be evaluated on actual screens.

---

## Foundation: Origin's identity

Origin is a precision instrument for tracking supplements and medications. Voice is "considered, instrument-like, restrained." Visual identity locked as **Achromatic** (Terminal direction):

- **Type:** JetBrains Mono (body, data), Space Grotesk (headings)
- **Surfaces:** near-black base (`#0D0D0D`), elevated cards `#1A1A1A`
- **Text:** pure white `#FFFFFF` with grey hierarchy
- **Accent:** pure white (no chroma)
- **Status colors:** muted green for success (`#5FE090`), cool red for danger, amber for warning, white for "now"
- **Radius:** zero across all UI elements (`radius.full: 9999` reserved for genuinely circular shapes only)
- **Borders:** 1px sharp, no shadows
- **Depth via tonal value, not material effects.**

These foundation choices inform every rule in this document.

---

## Category 1: Touch Targets

### Apple HIG
44 × 44 pt minimum hit area for any interactive element on touch surfaces. 8pt minimum spacing between adjacent targets.

### Rule for Origin
- **Mobile:** 44 × 44pt minimum hit area, all interactive elements.
- **Desktop:** 32 × 32pt minimum hit area (cursor-based, smaller acceptable).
- **Dense list exception:** if a row is 44pt+ tall and the row itself is the tap target, individual icons within don't need their own 44pt zones.

### Implementation pattern
Hit area is the button/element's `minWidth` and `minHeight`. Visual content (icon, label) stays its natural size within. Padding inside the element creates the expansion.

```jsx
<button style={{
  minWidth: 44,
  minHeight: 44,
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}}>
  <Icon size={16} />  {/* visual stays small */}
</button>
```

### Required for new work
Every interactive element added to Origin gets 44pt minimum hit area on mobile, 32pt on desktop. No exceptions without documented reason.

---

## Category 2: State Systems

### Apple HIG
Every interactive element communicates its state. Touch requires default/pressed/selected/disabled. Cursor adds hover/focus. State changes are visually distinct, consistent across components, and animated (~150-200ms).

### Rule for Origin

**State coverage matrix:**

| Component | Default | Hover (desktop) | Focus | Pressed | Selected | Disabled |
|---|---|---|---|---|---|---|
| Button | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Input | ✓ | subtle | ✓ | — | — | ✓ |
| Checkbox | ✓ | ✓ | ✓ | ✓ | ✓ (checked) | ✓ |
| Pill / segmented | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Row (slot, supplement, nav) | ✓ | ✓ | ✓ | ✓ | where applicable | — |
| DayCell (week strip) | ✓ | ✓ | ✓ | ✓ | ✓ (selected day) | — |
| Tab | ✓ | ✓ | ✓ | ✓ | ✓ (active) | ✓ |

Every interactive component implements ALL relevant states. No partial coverage.

### State treatments under Achromatic

- **Hover:** `theme.surface.hover` background tint (`rgba(255,255,255,0.04)`). No scale, no shadow, no glow.
- **Focus:** 1px white outline + 2px offset, applied via `:focus-visible` (keyboard only). **[REVISIT ON RENDER]** — may need adjustment for elements that already have white borders.
- **Pressed:** opacity 0.75 (global `button:active` rule already applied). Instant, no transition.
- **Selected:** explicit per-component (background fill, border emphasis, or strong contrast vs unselected).
- **Disabled:** opacity 0.4, cursor `not-allowed`, `pointer-events: none`. Still focusable for screen readers.

### Animation
- **State transitions:** 150ms ease-out.
- **Pressed feedback:** instant (no transition).
- **`prefers-reduced-motion`:** honored globally via CSS media query. Transitions effectively disabled for users with that preference.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

### Required for new work
Every new interactive element implements full state coverage per the matrix. Focus state is non-negotiable. Disabled state must look dimmed but legible.

---

## Category 3: Modals & Sheets

### Apple HIG
iOS specifies distinct presentation styles:
- **Page sheet** — top-anchored card, dismissable via swipe-down or tap-outside, content beneath partially visible
- **Form sheet** — centered card on iPad, full-screen on iPhone
- **Full-screen modal** — covers entire screen, used for primary task takeovers
- **Popover** — small, anchored to source, dismissable by tap-outside
- **Alert** — short, blocking, requires user response

Each has specific rules for dismissal, animation, backdrop, and content behavior.

### Origin's history (real context)
Origin wrestled with modal patterns extensively. Real progression:
1. Started with bottom sheets (slide up from bottom, iOS-native feel)
2. Hit iOS PWA edge cases (chin gap, scroll conflicts, keyboard behavior)
3. Switched to centered modals
4. Switched back to bottom sheets with drag-to-dismiss
5. Wrestled with nested scroll contexts inside bottom sheets (autocomplete dropdown)

Real conclusion: bottom sheets feel right on mobile but have real implementation costs. Centered modals are simpler but feel less native on mobile.

### Rule for Origin

**Mobile (≤1023px):**
- **Bottom sheet** for editing/creating content (EditForm, schedule editor) and primary interactions
- **Centered modal** for confirmations (Stop, Delete) and short prompts (PromptName)
- **Drag-to-dismiss** on bottom sheets, gesture constrained to drag handle area
- **Backdrop** dims 0.55, with backdrop-blur for iOS-style frosted effect
- **Dismiss methods:** drag handle, X button, backdrop tap, hardware/system back

**Desktop (≥1024px):**
- **Centered modal** for ALL modal contexts (no bottom sheets on desktop — bottom-anchored UI doesn't match cursor interaction)
- Maximum width: 480px for forms, 360px for confirmations
- **Backdrop** dims 0.55, no blur on desktop (blur is iOS-aesthetic)
- **Dismiss methods:** X button, backdrop tap, Escape key

**Both:**
- **Sticky header** (title + close button) — always visible
- **Scrollable body** — content can overflow, body scrolls independently
- **Sticky footer** (primary action button) — always reachable
- **Modal opens at top of scroll position** — never preserves previous scroll
- **Single modal at a time** — no stacking (current pattern)
- **Animation:** 200ms ease-out for open, 150ms ease-in for close

### Nested scroll contexts (autocomplete dropdowns inside modals)
Real lesson from autocomplete work: nested scroll inside iOS bottom sheets fights iOS gesture handling. Real rule going forward:

**Avoid nested scroll inside bottom sheets on mobile.** If a dropdown or list inside a modal would need to scroll, cap the visible items so scroll isn't needed (autocomplete capped at 5 results uses this pattern). If truly necessary, use a portal or full-screen takeover, not a nested scroll context.

### Required for new work
- New mobile modal: bottom sheet unless it's a confirmation/alert (centered)
- New desktop modal: centered modal
- All modals: sticky header + scrollable body + sticky footer
- All modals: open at scroll-top, never preserve position
- Never nest a scrolling element inside a modal body on mobile

---

## Category 4: Navigation

### Apple HIG
- **iOS:** tab bar at bottom for top-level navigation (≤5 destinations). Push navigation within a tab (chevron back). Modal presentation for orthogonal flows.
- **macOS:** sidebar for navigation, NSToolbar for actions. Content area to the right.
- **Both:** back button is non-destructive (always returns to previous state without losing data).

### Rule for Origin

**Mobile:**
- **No bottom tab bar** — Origin currently uses inline buttons (+ Add item, Manage) and gear icon. This is acceptable for current scope (Home is the only top-level destination).
- **Push navigation** for nested screens (Settings, Manage Protocol, EditForm) — slide-in from right, back chevron top-left to return
- **Modal presentation** for orthogonal flows (Add item, confirmations)
- **Back chevron** always returns to previous state, never destroys data

**Desktop (≥1024px):**
- **Persistent left sidebar** with brand wordmark, nav items, settings at bottom
- **Sidebar width:** 240px fixed
- **Nav items:** Home, Protocol, (future: Patients for clinicians)
- **Settings:** bottom of sidebar
- **Account avatar:** top-right of content area (not in sidebar)
- **Content area:** fills remaining width

**Both:**
- **Navigation stack pattern** — screens push/pop via `navigation.jsx` provider
- **Browser back button** works as expected on each surface
- **No hamburger menus** — sidebar (desktop) or inline (mobile) instead

### Required for new work
- New top-level destination: add to sidebar nav items on desktop, evaluate mobile pattern per case
- New nested screen: push onto navigation stack, slide-in animation, back chevron to return
- New orthogonal flow (e.g., compose a new protocol): modal presentation, not navigation push

---

## Category 5: Accessibility

### Apple HIG
Apple HIG mandates:
- VoiceOver support via semantic HTML and aria-labels
- Keyboard navigation (web specifically)
- `prefers-reduced-motion` honored
- Dynamic type / text scaling support
- Color contrast WCAG AA minimum (4.5:1 body, 3:1 large)
- Focus indicators always visible

### Origin's commitments

**Required for v1:**
- All interactive elements have semantic HTML (`<button>` for buttons, never `<div onclick>`)
- All icon-only buttons have `aria-label`
- All form inputs have associated `<label>` (visible or `aria-label`)
- All modals trap focus when open (Tab cycles within modal)
- All modals return focus to trigger element on close
- All color combinations meet WCAG AA contrast (verify with diagnostic data)
- `prefers-reduced-motion` honored (per state systems section)
- Focus indicators visible (per state systems section)
- Keyboard navigation works for all interactive elements

**Required for v1.5:**
- Live regions (`aria-live`) for dynamic content updates (toast notifications, async data loads)
- Skip links for keyboard users (skip to main content on each screen)

**Future:**
- Dynamic type support (currently fixed type scale; HIG mandates user text-size preference support — real future work)
- Screen reader testing (VoiceOver on iOS, NVDA on Windows, JAWS) — needs real-user testing

### Required for new work
- Every new component: semantic HTML, focus-visible support, keyboard operability
- Every new color combination: verify contrast (use Stark, Contrast, or manual ratio calculation)
- Every new modal: focus trap, return focus on close
- Every new async update: consider whether `aria-live` announcement is appropriate

---

## Category 6: Typography

### Apple HIG
- iOS uses SF Pro (system font), with Dynamic Type sizing
- macOS uses SF Pro with multiple size presets
- Both: clear hierarchy via size + weight, not decoration

### Rule for Origin

**Typeface assignments (Achromatic):**
- `fontBody` — JetBrains Mono — body text, button labels, supplement names
- `fontHeading` — Space Grotesk — section labels, greetings, large displays
- `fontData` — JetBrains Mono — numbers, times, percentages, technical content

**Type scale (existing tokens — preserve):**
- `display` 32 — Hero progress %, large numerals
- `heading` 22 — page-level headings ("Hello, Sofia")
- `title` 18 — section headings
- `body` 16 — primary text
- `caption` 14 — secondary text, metadata
- `label` 12 — section labels (uppercase), button labels (compact)
- `caption2` 10 — micro labels (rarely used)

**Weight system:**
- 400 — body default
- 500 — medium emphasis (slot names, supplement names, button labels)
- 600 — semibold (section labels, today emphasis)
- 700 — bold (large numerals only, sparingly)

**Line height:**
- Body and caption: 1.5
- Headings: 1.25
- Labels: 1.0 (uppercase tracking)

**Letter spacing:**
- Body: 0 (natural)
- Labels: 0.05em (slight tracking for uppercase legibility)
- Headings: -0.01em (tight tracking for large sizes)

### Dynamic type
**Not supported in v1.** Origin uses fixed type scale. Real future work to support OS-level text scaling preferences.

### Required for new work
- Body text uses `typography.body`
- Numbers, times, percentages use `typography.fontData`
- Section labels use `typography.label` with uppercase
- New typography needs added to design-system.js, not raw values

---

## Category 7: Spacing

### Apple HIG
- iOS uses 8pt baseline grid
- macOS uses 8pt with denser layouts (4pt subdivisions acceptable)
- Layout margins: 16pt minimum on iPhone, 20pt on iPad, generous on macOS

### Rule for Origin

**Base unit: 4px** (matches existing tokens). All spacing is multiples of 4.

**Spacing scale (existing tokens — preserve):**
- `xxxs` 2 — optical nudges only (not for layout)
- `xxs` 4 — tight inline spacing (label-to-input)
- `xs` 8 — compact spacing (between adjacent elements)
- `sm` 12 — default inline spacing
- `md` 16 — section padding, card padding
- `lg` 24 — between sections, generous padding
- `xl` 32 — between major sections, screen padding
- `xxl` 40 — large screen margins
- `xxxl` 48 — display contexts only

**Layout margins:**
- **Mobile screen edges:** `spacing.md` (16px) minimum
- **Desktop content area:** `spacing.xl` (32px) padding from sidebar, `spacing.xxl` (40px) optionally
- **Card internal padding:** `spacing.md` (16px) default, `spacing.lg` (24px) for spacious cards
- **Between adjacent rows:** `spacing.sm` (12px) or `spacing.md` (16px)
- **Safe area:** all bottom-anchored UI honors `safe-area-inset-bottom` for iOS PWA chrome

### No raw pixel values
Components reference `spacing.*` tokens, not raw numbers. Real exception: optical adjustments and tightly coupled layout math may use raw values with comment explaining why.

### Required for new work
- All spacing references tokens
- Bottom-anchored UI honors `safe-area-inset-bottom`
- Screen edge padding minimum `spacing.md` on mobile, `spacing.xl` on desktop

---

## Category 8: Color & Contrast

### Apple HIG
WCAG AA minimum: 4.5:1 for body text, 3:1 for large text (18pt+/14pt bold+). WCAG AAA where possible: 7:1 body, 4.5:1 large.

### Rule for Origin

**Achromatic palette (already locked):**
- `surface.base` `#0D0D0D`
- `surface.elevated` `#1A1A1A`
- `text.primary` `#FFFFFF`
- `text.secondary` `#A0A0A0`
- `text.muted` `#666666`
- `border.subtle` `#2A2A2A`
- `border.strong` `#404040`
- `accent.default` `#FFFFFF`
- `status.success` `#5FE090`
- `status.danger` `#FF6060`
- `status.warning` `#FFC040`

**Contrast targets:**
- `text.primary` on `surface.base`: must be AAA (white on near-black = ~20:1, comfortably exceeds)
- `text.secondary` on `surface.base`: must be AA (verify ratio, likely ~8:1)
- `text.muted` on `surface.base`: must be AA for large text only (likely ~4:1, ok for captions only)
- All status colors on `surface.base`: must be AA for body text usage

**[REVISIT ON RENDER]:** verify all contrast ratios with diagnostic data. Adjust `text.muted` if it falls below AA for any usage where it's used at body size.

### No color-coded slot system
Origin does not color-code slots or supplements by category. All categorization is via icons or text. Color is reserved for state (selected, error, success), not classification.

### Required for new work
- New text on new background: verify contrast ratio before shipping
- New color combinations require entry in design-system.js, not raw values
- Status colors (success/danger/warning) used only for their semantic role, never decoratively

---

## Category 9: Animation & Motion

### Apple HIG
- iOS uses spring physics for natural feel
- macOS uses curve-based animations (cubic-bezier) more often
- Both: animations are purposeful, not decorative
- `prefers-reduced-motion` must be honored

### Rule for Origin

**Timing:**
- **State transitions:** 150ms ease-out (hover, focus, pressed)
- **Modal open:** 200ms ease-out
- **Modal close:** 150ms ease-in
- **Page transitions (slide-in screens):** 250ms ease-out
- **Chevron rotation (expand/collapse):** 150ms ease-out
- **Loader rings:** 3000ms total cycle, 600ms stagger between rings
- **Toast appearance:** 200ms ease-out

**Easing:**
- Default: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out, snappy at end)
- No spring physics in v1 (real future work to introduce where appropriate)

**`prefers-reduced-motion` (from state systems section):**
Honored globally. All transitions and animations reduced to 0.01ms for users with that preference.

### Animation principles for Origin
- **Purposeful, not decorative.** Animation communicates state change, not personality.
- **Restrained.** Achromatic identity is precise/instrument. No bouncy springs, no playful curves.
- **Short.** 150-250ms range. Anything longer feels sluggish.
- **Consistent.** Same action type uses same timing across the app.

### Required for new work
- New transitions reference design system tokens for duration and easing (add tokens if needed)
- No animations longer than 300ms without documented reason
- Test under `prefers-reduced-motion` — UI must function with animations effectively disabled

---

## Category 10: Forms & Inputs

### Apple HIG
- Inputs have clear labels (visible or aria-label)
- Validation timing: on submit (not real-time) for most cases, real-time for password complexity only
- Errors inline with the field, not modal
- Required fields clearly marked
- Keyboard handling: Enter submits, Escape dismisses

### Rule for Origin

**Input states (from state systems section):**
- Default, hover (subtle), focus (1.5px accent border), error, disabled
- Error state: `theme.status.danger` border + inline error text below input

**Validation timing:**
- **On blur** for individual field validation (email format, etc.)
- **On submit** for cross-field validation and final check
- **Real-time** only for password complexity meter (per existing Auth flow)
- **Persistent inline error** after save failure (from earlier mobile audit) — doesn't auto-dismiss

**Form submission patterns:**
- Use real `<form>` element with `onSubmit` handler (auth form pattern from earlier work)
- Submit button typed `type="submit"`, non-submitting buttons `type="button"`
- Enter key submits via native form behavior (not manual `onKeyDown`)

**Autocomplete attributes:**
- Email fields: `autoComplete="email"` `inputMode="email"` `autoCapitalize="off"` `autoCorrect="off"` `spellCheck={false}`
- Password fields: `autoComplete="current-password"` or `"new-password"`
- Name fields: `autoComplete="name"`
- Number inputs: `inputMode="numeric"` `pattern="[0-9]*"` for integers

**Keyboard handling:**
- Enter submits form
- Escape dismisses modal (if applicable)
- Tab moves between fields in logical order

### In-flight protection
- Disable submit button while form is being processed (prevents double-submit, already implemented for new supplement creation)
- Show loading indicator on button during async operation

### Required for new work
- Real `<form>` wrapping for any user input
- Proper `autoComplete` attributes per field type
- Disabled submit during in-flight requests
- Error display inline with field, not as toast

---

## Category 11: Feedback Patterns

### Apple HIG
- Provide feedback for user actions (haptic on iOS, visual on web)
- Loading states for any operation taking >100ms
- Success confirmation can be subtle (state change) or explicit (toast)
- Error messaging clear and actionable
- Progress indicators for long operations

### Rule for Origin

**Loading states:**
- **Initial app load:** Loader animation (wave rings, frozen theme, min 3000ms — existing pattern)
- **Async data fetches:** skeleton screens preferred over spinners (future work — currently inline loader in some places)
- **Form submission:** button shows loading state, disabled while in-flight
- **Background sync:** silent (no UI), unless error

**Toast notifications:**
- **Position:** top of screen (mobile + desktop)
- **Auto-dismiss:** 3 seconds default, 5 seconds for actionable toasts with Undo
- **Variants:** success (Check icon), neutral (Info icon), error (X icon), warning (AlertTriangle icon)
- **Color:** all variants use ink text; icon differentiates type (no colored toasts)
- **Action prop:** optional Undo button for reversible actions

**Inline messaging:**
- **Success:** subtle state change (checkbox checks, supplement marked done) — usually no toast
- **Error:** inline error text near the failing action, persistent until resolved

**Optimistic UI:**
- **Checkbox toggles:** update UI immediately, sync to server in background
- **Failures:** revert UI state, show error toast
- **Real example:** checkbox auto-save debounce 200ms (closes silent-loss window)

### No haptic feedback in v1
Web doesn't reliably support haptic feedback. Real future work for native wrapping if pursued.

### Required for new work
- Any operation >100ms: visible loading state
- Any reversible destructive action: toast with Undo
- Any error: inline message with clear cause and (if applicable) recovery action
- Optimistic UI patterns for high-frequency interactions (checkboxes, toggles)

---

## Category 12: Buttons

### Apple HIG
- Primary action visually distinct (filled, prominent)
- Secondary actions less prominent (outlined or tinted)
- Tertiary actions minimal (text only)
- Destructive actions colored (red on iOS)
- Touch targets per Category 1

### Rule for Origin

**Variants (existing Button primitive):**
- `primary` — filled, white background, near-black text (under Achromatic)
- `secondary` — outlined, transparent background, white border + text
- `tertiary` — text only, no background or border
- `destructive` — uses `status.danger` color
- `icon` — square button with icon only, no label
- `pill` — for selectable pill contexts (slot picker, etc.)
- `startDay` — special variant for "Start my day" CTA (existing pattern)

**Sizing:**
- **Default:** 44pt height (mobile-compliant), `spacing.md` (16px) horizontal padding
- **Compact:** 36pt height (still tap-safe on mobile via hit area expansion), `spacing.sm` (12px) horizontal padding
- **Icon variant:** 44 × 44pt hit area, icon centered, no label

**States (from Category 2):**
All variants implement default, hover (desktop), focus, pressed, disabled.

**Spacing between buttons:**
- Adjacent buttons: `spacing.sm` (12px) gap minimum
- Button group on mobile: prefer vertical stack over horizontal row if more than 2 buttons

### Required for new work
- All buttons use Button primitive (no raw `<button>` with custom styles)
- Variant chosen based on action type
- Loading state implemented for async actions
- Disabled state for unavailable actions

---

## Category 13: Lists & Rows

### Apple HIG
- Rows have consistent height within a list
- Disclosure indicators (chevrons) at trailing edge for navigable rows
- Separators (hairline) between rows or sections
- Selected row state visually distinct

### Rule for Origin

**Row patterns:**
- **SlotRow** — compressed slot info on desktop today panel, expandable
- **SupplementRow** — inside expanded slot, checkbox + name + dose + edit affordance
- **Sidebar nav item** — desktop sidebar navigation

**Row height:**
- **Slot rows (desktop today panel):** ~52pt
- **Supplement rows (inside expanded slot):** ~44pt minimum (per touch targets — single line) or ~52pt (multi-line with dose)
- **Mobile slot card supplement rows:** existing pattern, verify 44pt+ compliance
- **Sidebar nav items:** 44pt minimum

**Disclosure indicators:**
- Chevron right (`>`) — row pushes to detail screen
- Chevron down (`v`) — row expands inline
- Direction rotates 90° on expand: `transform: rotate(180deg)` for expanded state, 150ms transition

**Separators:**
- Hairline (`1px solid theme.border.subtle`) between rows in a list
- More prominent separator (`1px solid theme.border.strong` or visual section break) between sections

**Hover (desktop):**
- Row background tint on hover (`theme.surface.hover`)
- Hover reveals action affordances (edit pencil, etc.)

**Selected state:**
- Background tint stronger than hover
- Optional left-border accent (current pattern on selected DayCell)

### Required for new work
- New row uses existing SlotRow / SupplementRow / nav item patterns
- Chevron direction matches navigation behavior (right for push, down for expand)
- Hover state reveals actions on desktop (not visible by default)
- Row height meets touch target rules

---

## Category 14: Empty States

### Apple HIG
- Empty states are NOT errors — they're opportunities to guide user action
- Clear explanation of why the state is empty
- Primary action prominent (the CTA to fill the state)
- Tone matches product voice (Origin: calm, considered, not chirpy)

### Rule for Origin

**Existing empty states (per diagnostic):**
- New user with no supplements
- Past day with no logs
- No upcoming items in Insights panel (currently hidden entirely — keep)
- Autocomplete with no matches
- Manage Protocol Stopped tab with no archived supplements

**Treatment pattern:**
- **Centered content** in the area that would otherwise show data
- **Short message** (one line preferred, two lines max)
- **Optional CTA button** if the empty state has a clear action
- **No illustrations** (Achromatic identity — no decorative graphics)
- **Tone:** considered, not chirpy. "No supplements yet" not "Nothing here yet, woohoo!"

**Voice examples:**
- New user: "No supplements yet. Add your first to get started."
- Past day no logs: "No supplements logged this day."
- Autocomplete no matches: (hide dropdown entirely, no message)
- Stopped tab empty: "Nothing here yet."

**When to hide entirely vs show empty state:**
- **Hide** when the empty state would be visual noise (autocomplete, Insights "upcoming")
- **Show** when the user might wonder where data is (Stopped tab, past day)

### Required for new work
- Every new section/screen that can be empty: design the empty state
- Empty state copy matches Origin's restrained voice
- No decorative illustrations
- Primary CTA if there's a clear next action

---

## Category 15: Onboarding

### Apple HIG
- First-run experience should be brief and skippable when possible
- Real onboarding is implicit — users learn through using
- Onboarding screens should not require accounts unnecessarily
- Permission requests should explain why before asking

### Rule for Origin

**Existing onboarding (per diagnostic):**
- Triggers when no `user_schedule` row exists for the user
- Two-step flow: schedule type selection → optional configuration (skipped for No Schedule)
- Full-screen (not modal)
- Returns success/failure to gate dismissal

**PromptName flow:**
- One-time prompt for existing users without `display_name`
- Single screen, fills in profile on completion

### Rule for Origin's onboarding

**Real principles:**
- **Minimal friction:** schedule selection is real choice; everything else can be added later
- **No skip-able screens:** if a screen exists in onboarding, it's required
- **Skip patterns:** "No Schedule" mode is the "skip everything" choice — users who don't want a schedule yet pick this
- **Returning users:** never re-trigger onboarding once completed

**Future onboarding considerations:**
- **Clinician role detection:** if a user signs up via a shared protocol link, onboarding flow differs (skip personal protocol creation, prefill from shared)
- **Tutorial moments:** consider inline hints (not modal walkthroughs) for advanced features as users encounter them

### Required for new work
- New onboarding step: only if absolutely required for app function
- Existing onboarding completed flag never re-triggered
- New features for advanced users: introduce via inline affordances, not modal walkthroughs

---

## Implementation guidance

### Bulk HIG fix pass
After this document is locked, real engineering work:

1. **Touch target audit:** scan all interactive elements for sub-44pt mobile hit areas, expand via `minWidth`/`minHeight` + padding pattern
2. **State coverage:** verify all components implement required states per matrix. Add missing focus states first (most critical for accessibility).
3. **`prefers-reduced-motion`:** add global CSS rule honoring user preference
4. **Modal patterns:** verify all modals open at scroll-top, sticky header/footer correct, dismiss methods work
5. **Color contrast:** verify all text/background pairs meet WCAG AA, adjust `text.muted` if needed for body usage
6. **Form patterns:** verify all forms use real `<form>` elements, proper `autoComplete`, in-flight protection
7. **Empty states:** add empty state treatments for any sections currently showing blank when data missing

Estimated work: 2-3 sessions of focused engineering. Each section above is a real chunk.

### Going forward
When building new features or fixing existing components:

1. **Check this document first** for the relevant category's rules
2. **Apply rules consistently** — no per-component variation without documented reason
3. **Add new patterns to this document** as they emerge
4. **Revisit [REVISIT ON RENDER] items** as they're implemented — adjust this document if real visual reveals better answers

### Document maintenance
- This document lives at `/ORIGIN-DESIGN-RULES.md` in the repo
- Version controlled with code
- Updated when patterns evolve
- Referenced explicitly in prompts to Claude Code when designing new features

---

*End of document. v1 — drafted May 11, 2026. Locked decisions implemented in subsequent engineering work.*
