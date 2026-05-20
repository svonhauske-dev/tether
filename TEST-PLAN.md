# Origin — Full-Flow Test Plan

Generated May 20, 2026 after the peer-to-peer share + Library polish + Saved rename. Walks every user-facing flow on mobile-only main. Estimated ~25 minutes if everything works; flag anything that doesn't behave as described.

---

## Setup

You need **at least two Origin accounts** to test peer-to-peer:
- **Sender:** `sofiavonhauske@gmail.com` (Sofia, your main).
- **Recipient:** any test account you can sign into (e.g. `bego_bayon@hotmail.com` for the push test, or the test account you created today).

**Optional seed data** — if you want a quick set of protocols on a fresh test account to skip setup time, run the SQL at the bottom of this file in the Supabase SQL Editor (replace `TARGET_EMAIL` with your test account's email).

---

## 1. Sign-in / Sign-up (~2 min)

- [ ] **Sign-up** — open `origin-protocol.vercel.app` in an incognito window. Fill the sign-up form with a fresh email + password.
- [ ] **Email validation** — submit with an obviously invalid email (e.g. `foo`). Expect inline error, no network request.
- [ ] **Sign-in (existing)** — sign out, sign back in with the same credentials. Lands on cockpit.
- [ ] **Auth screen renders inside phone-frame on desktop** — at viewport ≥1024px, the Auth card sits inside a 440px column with subtle achromatic borders on the sides.

---

## 2. Onboarding (~2 min, fresh account only)

- [ ] **Step 1 — Anchor selection.** Three cards (Medication / Wakeup / None) plus a 2-meal/3-meal option. Picking each updates the live preview.
- [ ] **Step 2 — Schedule.** Inputs for cascade times. The "Your day will look like" preview updates live as you adjust.
- [ ] **Complete** — Finish button writes a `user_schedule` row + creates an initial protocol, lands on the cockpit.

---

## 3. Empty cockpit (~1 min, fresh account)

- [ ] **Day-1 InlineTip** — schedule-mode-specific tip appears once. Dismiss it → never returns on this device.
- [ ] **◯ glyph + "No items yet"** — visible center of cockpit.
- [ ] **"Add to protocol"** primary CTA — tap → opens supplement add form (SidePanel-as-Modal bottom sheet on mobile, bottom sheet within phone-frame on desktop).

---

## 4. Add first supplement (~1 min)

- [ ] **Name autocomplete** — focus the Name field with no input → list of common supps appears. Pick one or type your own.
- [ ] **All fields** — fill Dose, Notes, Category (Oral/Rx/Injectable/Topical), Treatment mode (Indefinite/Scheduled/Cycled), When to take it (slot grid), Which days (S M T W T F S).
- [ ] **Add to protocol** → form closes, supp appears in cockpit under the right slot.

---

## 5. Daily logging (~3 min)

- [ ] **Single supp check** — tap the checkbox next to a supp → checks. Tap again → unchecks.
- [ ] **Take-all on slot icon** — tap the slot's left-edge icon (◎/●) → marks all supps in that slot as taken.
- [ ] **Log-at pill** — when a slot's time has passed and supps are unchecked, the "Log at" pill should appear. Tap → LogAtSheet bottom sheet → pick a different time → saves with that timestamp.
- [ ] **Hero card percentage** — adherence ring updates immediately after each toggle.

---

## 6. Past day editing (~2 min)

- [ ] **Navigate to a past day** via WeekStrip arrow or tap a past day.
- [ ] **Read-only badge** in Hero: "Viewing {day} · read-only".
- [ ] **Tap "Edit" in the header** → Done button replaces Edit, slots become tappable.
- [ ] **Toggle a supp on a past day** → percentage updates, persisted on refresh.
- [ ] **Tap "Done"** → returns to read-only.

---

## 7. Future day (~30 sec)

- [ ] Navigate to tomorrow via WeekStrip. Slots are dimmed/not interactive. No "Edit" button.

---

## 8. ProtocolLibrary — empty state (~30 sec)

If you don't have an active protocol, the Library opens to:

- [ ] **Active tab** — ◯ glyph + "Build your first protocol" + subtext + "New protocol" primary CTA.
- [ ] **Saved tab** — ◯ glyph + "Nothing saved yet" + subtext, no CTA.

---

## 9. ProtocolLibrary — flows (~3 min)

- [ ] **Create new protocol** — tap +, fill Name, Treatment mode, optional dates. Submit.
- [ ] **Open protocol** → ProtocolDetailScreen slides in from the right.
- [ ] **Inline rename** — tap the protocol name → input appears → edit → blur saves.
- [ ] **Add supplement to protocol** — Plus button in header → opens add form. Add.
- [ ] **Edit supplement** — tap a supp row → opens edit form. Change something. Save.
- [ ] **Pause supplement** — pause icon → moves to Paused tab. Resume → moves back to Active.
- [ ] **Delete supplement** — trash icon in Paused tab → confirm modal → delete.

---

## 10. Saved (formerly "Archived") (~2 min)

- [ ] **Save a protocol** — ProtocolDetailScreen ⋯ → "Save protocol" → confirm modal → save. Toast: `{name} saved`. Protocol disappears from Active, appears in Saved tab.
- [ ] **Open from Saved** — tap protocol in Saved tab → ProtocolDetailScreen.
- [ ] **Activate from Saved** — ⋯ → "Activate protocol" → modal asks **Stack on current** or **Replace current**.
  - **Stack** → moves to Active, existing actives untouched.
  - **Replace** → archives existing actives, this one becomes sole active. Toast: `{name} activated · {old names} saved`.
- [ ] **Delete from Saved** — ⋯ → "Delete protocol" → confirm → delete. Should NOT error with FK constraint anymore (May 20 evening fix). Toast: `{name} deleted`. Returns to Library.

---

## 11. Peer-to-peer send (~3 min)

**Sender side (one account):**
- [ ] Open an **active** protocol → ⋯ → "Send to someone" → modal with email input.
- [ ] **Type recipient email** → tap Send → toast `Sent to {name}`.
- [ ] **Edge case: own email** → toast/error `That's your own email`. Modal stays open.
- [ ] **Edge case: nonexistent email** → toast/error `No Origin user with that email`.
- [ ] **From Saved protocol** — open a saved protocol → ⋯ → "Send to someone" → same flow. Should work.

**Recipient side (other account):**
- [ ] **Library badge** — green square badge appears on Library icon in mobile top bar, showing count.
- [ ] **Open Library** → Received section above Active tab → each protocol is its own card (border + gap between).
- [ ] **First-received InlineTip** — appears once above the Received cards on first encounter. Dismiss → never returns.
- [ ] **Tap a card** → review modal opens with supplement list + Stack / Replace / Save for later / Decline / Cancel.
- [ ] **Stack on current** → toast `{name} activated`. Active protocols include this one alongside any existing.
- [ ] **Replace current** → toast `{name} activated · {old names} saved`. Previous actives now in Saved tab.
- [ ] **Save for later** → toast `{name} saved`. Appears in Saved tab, not Active.
- [ ] **Decline** → toast `{name} declined`. Row disappears, badge decrements.
- [ ] **Cancel** → modal closes, row stays pending, badge unchanged.

---

## 12. Push notifications (~3 min)

Requires the recipient device to have notifications enabled in Settings + browser permission granted. **iOS** requires the app to be installed via "Add to Home Screen" first.

- [ ] **Enable notifications** on recipient device — Settings (avatar) → Notifications → toggle on → grant permission.
- [ ] **Send a protocol** to that recipient from a different account.
- [ ] **Push arrives** within a few seconds — title: `{sender} sent you a protocol`, body: `{protocol name} · N supplements`.
- [ ] **Tap the push** → Origin opens directly into the review modal for that specific send (zero extra taps).

---

## 13. Settings (~2 min)

- [ ] Tap avatar (top-left) → Settings slides in from the right.
- [ ] **Display name** — edit, save, name updates in greeting + AccountAvatar initials.
- [ ] **Anchor + schedule** — change schedule, save, cockpit reflects.
- [ ] **Notifications toggle** — enable/disable. If enabling for the first time, browser permission prompt.
- [ ] **Sign out** — confirm modal → signs out → lands on Auth screen.

---

## 14. /design-system page (~1 min)

- [ ] Visit `origin-protocol.vercel.app/design-system` in a **separate browser tab** (not signed in).
- [ ] Renders. Lists primitives + composed components. No personal data leaks. Achromatic theme only.

---

## 15. Phone-frame on desktop (~1 min, desktop only)

- [ ] Resize browser window above and below 1024px wide. At ≥1024px, app constrains to a centered 440px column with subtle achromatic side borders. Below 1024px, full-width mobile UI.
- [ ] **Modals stay inside the phone-frame** — Modal bottom sheets, Popovers, Toast all anchor inside the 440px column.

---

## Known parked / out of scope

- Templates surface (clinician feature, parked on `wip/clinician-product` branch).
- Patient roster, send-to-patient, analytics (parked with the clinician dashboard).
- Desktop-specific UI (sidebar, top bar) — preserved as dead code, never renders.

---

## Optional: seed an existing test account with sample data

Run in **Supabase SQL Editor** after replacing `TARGET_EMAIL`. Creates one active protocol with 3 supps and one saved protocol — gives a fresh test account immediate content to play with.

```sql
DO $$
DECLARE
  uid uuid;
  p1_id uuid;
  p2_id uuid;
BEGIN
  -- Resolve email → user id
  SELECT id INTO uid FROM auth.users WHERE LOWER(email) = LOWER('TARGET_EMAIL') LIMIT 1;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No user with email TARGET_EMAIL';
  END IF;

  -- Active protocol
  INSERT INTO protocols (user_id, name, status, treatment_mode, source)
  VALUES (uid, 'Morning stack', 'active', 'indefinite', 'user')
  RETURNING id INTO p1_id;

  INSERT INTO supplements (user_id, protocol_id, name, dose, slots, days, category, status, paused, treatment_mode)
  VALUES
    (uid, p1_id, 'Vitamin D3',           '5000 IU',    ARRAY['with_breakfast'], ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite'),
    (uid, p1_id, 'Magnesium Glycinate',  '400 mg',     ARRAY['evening'],         ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite'),
    (uid, p1_id, 'Omega-3',              '1 g',        ARRAY['with_breakfast'], ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite');

  -- Saved (archived) protocol
  INSERT INTO protocols (user_id, name, status, treatment_mode, source)
  VALUES (uid, 'Workout stack', 'archived', 'indefinite', 'user')
  RETURNING id INTO p2_id;

  INSERT INTO supplements (user_id, protocol_id, name, dose, slots, days, category, status, paused, treatment_mode)
  VALUES
    (uid, p2_id, 'Creatine',  '5 g',  ARRAY['anytime'], ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite'),
    (uid, p2_id, 'Beta-Alanine', '3 g', ARRAY['anytime'], ARRAY[0,1,2,3,4,5,6], 'Oral', 'active', false, 'indefinite');

  RAISE NOTICE 'Seeded user % with 2 protocols + 5 supplements.', uid;
END $$;
```

To **clear** the seed and start over: `DELETE FROM supplements WHERE user_id = (SELECT id FROM auth.users WHERE LOWER(email) = LOWER('TARGET_EMAIL'));` then `DELETE FROM protocols WHERE user_id = (...)`.
