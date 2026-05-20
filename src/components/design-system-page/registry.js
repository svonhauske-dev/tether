// Design system component registry.
// Add new components or variants here when shipping them.
// The /design page auto-renders from this file.

import Button from '../Button';
import Input from '../Input';
import Card from '../Card';
import Badge from '../Badge';
import Label from '../Label';
import TabBar from '../TabBar';
import AdherenceRing from '../AdherenceRing';
import Sparkline from '../Sparkline';
import StatusDot from '../StatusDot';
import Hero from '../Hero';
import SlotCard from '../SlotCard';
import SlotRow from '../SlotRow';
import SupplementRow from '../SupplementRow';
import { DayCell } from '../WeekStrip';
import InsightsPanel from '../InsightsPanel';
import InlineTip from '../InlineTip';
import { ModalPreview, PopoverPreview, SidePanelPreview, LogAtSheetPreview } from './previews';

// ── Stub helpers ───────────────────────────────────────────────────────────────

const noop = () => {};
const dk  = (d) => d.toISOString().split('T')[0];
const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const TODAY  = new Date();
const YEST   = new Date(TODAY); YEST.setDate(YEST.getDate() - 1);
const TWO_AG = new Date(TODAY); TWO_AG.setDate(TWO_AG.getDate() - 2);
const TOMOR  = new Date(TODAY); TOMOR.setDate(TOMOR.getDate() + 1);

const SUPP_VITAMIN = {
  id: 'ds-vit', name: 'Vitamin D3', dose: '2000 IU', notes: '',
  slots: ['breakfast'], days: [0,1,2,3,4,5,6], category: 'Oral',
  status: 'active', treatment_mode: 'indefinite',
  starts_at: null, ends_at: null,
  cycle_on_value: null, cycle_on_unit: null,
  cycle_off_value: null, cycle_off_unit: null, paused: false,
};

const SUPP_MAG = {
  id: 'ds-mag', name: 'Magnesium Glycinate', dose: '400mg', notes: '',
  slots: ['dinner'], days: [0,1,2,3,4,5,6], category: 'Oral',
  status: 'active', treatment_mode: 'indefinite',
  starts_at: null, ends_at: null,
  cycle_on_value: null, cycle_on_unit: null,
  cycle_off_value: null, cycle_off_unit: null, paused: false,
};

const SUPP_RX = {
  id: 'ds-rx', name: 'Metformin', dose: '500mg', notes: '',
  slots: ['rx'], days: [0,1,2,3,4,5,6], category: 'Rx',
  status: 'active', treatment_mode: 'indefinite',
  starts_at: null, ends_at: null,
  cycle_on_value: null, cycle_on_unit: null,
  cycle_off_value: null, cycle_off_unit: null, paused: false,
};

const SUPP_INJECTABLE = {
  id: 'ds-inj', name: 'Tirzepatide', dose: '5mg', notes: '',
  slots: [], days: [0,1,2,3,4,5,6], category: 'Injectable',
  status: 'active', treatment_mode: 'indefinite',
  starts_at: null, ends_at: null,
  cycle_on_value: null, cycle_on_unit: null,
  cycle_off_value: null, cycle_off_unit: null, paused: false,
};

const SLOT_BREAKFAST = { id: 'breakfast', label: 'Breakfast', sublabel: 'With food', icon: '○' };
const SLOT_LUNCH     = { id: 'lunch',     label: 'Lunch',     sublabel: 'With midday meal', icon: '○' };
const SLOT_DINNER    = { id: 'dinner',    label: 'Dinner',    sublabel: 'With evening meal', icon: '○' };

const ALL_SUPPS = [SUPP_VITAMIN, SUPP_MAG, SUPP_RX, SUPP_INJECTABLE];

// Week dates: 7 days ending today
const WEEK_DATES = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - 6 + i);
  return d;
});

// Fake logs with partial adherence for the past days
const WEEK_LOGS = [
  { log_date: dk(WEEK_DATES[0]), pill_time: '08:15', checked: { [`${dk(WEEK_DATES[0])}_breakfast_ds-vit`]: true, [`${dk(WEEK_DATES[0])}_dinner_ds-mag`]: true } },
  { log_date: dk(WEEK_DATES[1]), pill_time: '08:30', checked: { [`${dk(WEEK_DATES[1])}_breakfast_ds-vit`]: true } },
  { log_date: dk(WEEK_DATES[2]), pill_time: '08:00', checked: { [`${dk(WEEK_DATES[2])}_breakfast_ds-vit`]: true, [`${dk(WEEK_DATES[2])}_dinner_ds-mag`]: true, [`${dk(WEEK_DATES[2])}_rx_ds-rx`]: true } },
  { log_date: dk(WEEK_DATES[3]), pill_time: '07:45', checked: { [`${dk(WEEK_DATES[3])}_breakfast_ds-vit`]: true, [`${dk(WEEK_DATES[3])}_dinner_ds-mag`]: true } },
  { log_date: dk(WEEK_DATES[4]), pill_time: '08:10', checked: { [`${dk(WEEK_DATES[4])}_breakfast_ds-vit`]: true, [`${dk(WEEK_DATES[4])}_dinner_ds-mag`]: true, [`${dk(WEEK_DATES[4])}_rx_ds-rx`]: true } },
  { log_date: dk(WEEK_DATES[5]), pill_time: '08:20', checked: { [`${dk(WEEK_DATES[5])}_breakfast_ds-vit`]: true } },
  { log_date: dk(WEEK_DATES[6]), pill_time: '08:30', checked: { [`${dk(WEEK_DATES[6])}_breakfast_ds-vit`]: true, [`${dk(WEEK_DATES[6])}_dinner_ds-mag`]: true } },
];

const LOG_YESTERDAY_FULL = {
  log_date: dk(YEST),
  pill_time: '08:30',
  checked: {
    [`${dk(YEST)}_breakfast_ds-vit`]: true,
    [`${dk(YEST)}_dinner_ds-mag`]: true,
    [`${dk(YEST)}_rx_ds-rx`]: true,
  },
};

const LOG_YESTERDAY_PARTIAL = {
  log_date: dk(YEST),
  pill_time: '08:30',
  checked: { [`${dk(YEST)}_breakfast_ds-vit`]: true },
};

// Hero base props shared across examples
const heroBase = {
  anchorBehavior: 'flexible', consistentTime: '08:00',
  editPillTime: false, setEditPillTime: noop,
  tmpTime: '', setTmpTime: noop, setPillForDay: noop,
  flashGreen: false, startDay: noop,
  pastDayEditing: false, setPastDayEditing: noop,
  nextFixedSlot: null,
};

// ── Registry ───────────────────────────────────────────────────────────────────

export const componentRegistry = {
  primitives: {

    Button: {
      component: Button,
      description: 'Primary action element. Seven variants + two sizes. Only one should be primary per context.',
      variants: [
        { name: 'primary',            props: { variant: 'primary',     children: 'Add to protocol' } },
        { name: 'secondary',          props: { variant: 'secondary',   children: 'Manage' } },
        { name: 'tertiary',           props: { variant: 'tertiary',    children: 'Cancel' } },
        { name: 'destructive',        props: { variant: 'destructive', children: 'Stop supplement' } },
        { name: 'icon',               props: { variant: 'icon', 'aria-label': 'Settings', children: '⚙' } },
        { name: 'selector (inactive)',     props: { variant: 'selector', active: false, children: 'Oral' } },
        { name: 'selector (active)',       props: { variant: 'selector', active: true,  children: 'Oral' } },
        { name: 'selector (solid active)', props: { variant: 'selector', active: true, solidActive: true, children: 'Oral' } },
        { name: 'selector (binary — On)',  props: { variant: 'selector', active: true,  children: 'On' } },
        { name: 'selector (binary — Off)', props: { variant: 'selector', active: false, children: 'Off' } },
        { name: 'selector (disabled)',     props: { variant: 'selector', active: false, children: 'On', disabled: true } },
        { name: 'circle',              props: { variant: 'circle', children: 'M', active: false } },
        { name: 'circle (active)',     props: { variant: 'circle', children: 'M', active: true } },
        { name: 'startDay',            props: { variant: 'startDay', children: 'Start my day', isFuture: false } },
        { name: 'startDay (future)',   props: { variant: 'startDay', children: 'Start my day', isFuture: true } },
        { name: 'primary compact',     props: { variant: 'primary',   size: 'compact', children: 'Save' } },
        { name: 'primary disabled',    props: { variant: 'primary',   children: 'Saving…', disabled: true } },
      ],
    },

    Input: {
      component: Input,
      description: 'Text input. Three variants: text (default), time, number. Focus state drives accent border.',
      variants: [
        { name: 'text (empty)',      props: { placeholder: 'Supplement name' } },
        { name: 'text (with value)', props: { defaultValue: 'Vitamin D3' } },
        { name: 'time',              props: { variant: 'time', defaultValue: '08:30' } },
        { name: 'number',            props: { variant: 'number', defaultValue: '400', width: 80 } },
        { name: 'disabled',          props: { disabled: true, placeholder: 'Not editable' } },
      ],
    },

    Card: {
      component: Card,
      description: 'Surface container. Four variants for emphasis levels. Optional onClick makes it interactive.',
      variants: [
        { name: 'default',  props: { variant: 'default',  style: { minHeight: 60 }, children: 'Default card' } },
        { name: 'selected', props: { variant: 'selected', style: { minHeight: 60 }, children: 'Selected card' } },
        { name: 'accent',   props: { variant: 'accent',   style: { minHeight: 60 }, children: 'Accent card' } },
        { name: 'subtle',   props: { variant: 'subtle',   style: { minHeight: 60 }, children: 'Subtle card' } },
      ],
    },

    Badge: {
      component: Badge,
      description: 'Inline status indicator. Four semantic variants — now, missed, category, neutral.',
      variants: [
        { name: 'now',      props: { variant: 'now',      children: 'now' } },
        { name: 'missed',   props: { variant: 'missed',   children: 'late' } },
        { name: 'category', props: { variant: 'category', children: 'Oral' } },
        { name: 'neutral',  props: { variant: 'neutral',  children: 'paused' } },
      ],
    },

    Label: {
      component: Label,
      description: 'Uppercase section label for form fields and settings rows.',
      variants: [
        { name: 'default',  props: { children: 'When to take it' } },
        { name: 'compact',  props: { style: { marginBottom: 0 }, children: 'Category' } },
      ],
    },

    TabBar: {
      component: TabBar,
      description: 'Horizontal tab strip. Active tab gets accent underline. Drives tabbed content switching in protocol and manage screens.',
      variants: [
        { name: 'two tabs — first active',  props: { tabs: [{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }], active: 'active',   onChange: noop } },
        { name: 'two tabs — second active', props: { tabs: [{ value: 'active', label: 'Active' }, { value: 'stopped',  label: 'Stopped'  }], active: 'stopped',  onChange: noop } },
        { name: 'three tabs',               props: { tabs: [{ value: 'active', label: 'Active' }, { value: 'stopped',  label: 'Stopped'  }, { value: 'schedule', label: 'Schedule' }], active: 'stopped', onChange: noop } },
      ],
    },

    AdherenceRing: {
      component: AdherenceRing,
      description: 'SVG circular progress ring. 100% flips stroke to status.success (muted green). Pass showText={false} to render as a clean arc (used by mobile WeekStrip compact mode).',
      variants: [
        { name: '0%',    props: { percentage: 0,   size: 56 } },
        { name: '35%',   props: { percentage: 35,  size: 56 } },
        { name: '75%',   props: { percentage: 75,  size: 56 } },
        { name: '100%',  props: { percentage: 100, size: 56 } },
        { name: 'lg 80', props: { percentage: 60,  size: 80 } },
        { name: 'xl 120',props: { percentage: 60,  size: 120 } },
        { name: 'compact 28 (mobile week strip)',           props: { percentage: 60,  size: 28, showText: false } },
        { name: 'compact 28 — 100% (success)',              props: { percentage: 100, size: 28, showText: false } },
      ],
    },

    InlineTip: {
      component: InlineTip,
      description: 'Dismissible inline tip — left accent border + uppercase label + body + top-right X. Dismissal persisted in localStorage under `origin.tip.<id>`. Powers the Day-1 anchor-explainer on the empty home and the take-all first-run hint above the slot list. Once dismissed for a given id it never re-appears for that user.',
      variants: [
        { name: 'Day-1 — medication anchor',
          props: { id: 'demo-day1-medication', label: 'how anchors work', children: 'Each morning, tap "I took my meds" to set today\'s anchor. Origin cascades pre-meal, meal, and evening items from there.' } },
        { name: 'Take-all hint',
          props: { id: 'demo-take-all', label: 'Tip', children: 'Tap the icon at the left of a slot to log every item in it at once.' } },
        { name: 'No label (body only)',
          props: { id: 'demo-no-label', children: 'A short single-line tip without a heading.' } },
      ],
    },

    Sparkline: {
      component: Sparkline,
      description: 'Single-color trend line for dense list rows. Renders a 0-100 value array. Default 60×12, optional endpoint dot, optional baseline hairline.',
      variants: [
        { name: 'flat 0',        props: { values: [0,0,0,0,0,0,0,0,0,0] } },
        { name: 'climbing',      props: { values: [10,20,25,35,40,55,60,70,80,90] } },
        { name: 'declining',     props: { values: [95,90,80,70,60,55,45,30,20,10] } },
        { name: 'volatile',      props: { values: [60,80,40,90,20,70,50,80,30,100] } },
        { name: '30-day window', props: { values: Array.from({length: 30}, (_,i) => Math.round(40 + 50 * Math.sin(i/4) + (Math.random()-0.5)*15)), width: 80 } },
        { name: 'gaps',          props: { values: [60,80,null,null,50,70,90,null,80,100] } },
        { name: 'with baseline', props: { values: [50,60,70,55,65,80,75,90,85,100], baseline: true } },
        { name: 'no endpoint',   props: { values: [50,60,70,55,65,80,75,90,85,100], endpoint: false } },
      ],
    },

    StatusDot: {
      component: StatusDot,
      description: 'Colored dot for at-a-glance status. Pair with a text.primary label so color carries severity without dominating the surface.',
      variants: [
        { name: 'success', props: { status: 'success' } },
        { name: 'warning', props: { status: 'warning' } },
        { name: 'danger',  props: { status: 'danger' } },
        { name: 'neutral', props: { status: null } },
        { name: 'lg 10',   props: { status: 'success', size: 10 } },
      ],
    },

    Modal: {
      component: ModalPreview,
      description: 'Full-screen backdrop dialog. Bottom sheet on mobile (drag-to-dismiss, 90dvh max), centered card on desktop (480px default / 360px compact, 80dvh max). Sticky header + scrollable body + sticky footer. Escape + Tab focus trap + auto-focus on open. Use `size="compact"` for confirms and short prompts; default for forms and longer content. Each variant below renders a trigger button; click to open.',
      variants: [
        { name: 'default (480) — with footer', props: { size: 'default', withFooter: true,  title: 'Edit supplement' } },
        { name: 'default (480) — no footer',   props: { size: 'default', withFooter: false, title: 'Details' } },
        { name: 'compact (360) — confirm',     props: { size: 'compact', withFooter: true,  title: 'Stop supplement?' } },
      ],
    },

    Popover: {
      component: PopoverPreview,
      description: 'Floating menu panel anchored to a trigger. Lighter than Modal — no backdrop, no focus trap, preserves surrounding context. Use for short menus, overflow actions, and pickers. Dismisses on outside-click or Escape. Caller owns the trigger and provides an `anchorRef`. Children are typically `PopoverItem` (menu rows, optional `destructive`/`disabled`/`icon`) and `PopoverSection` (uppercase divider label for grouping).',
      variants: [
        { name: 'basic menu',         props: { withSection: false, destructive: false } },
        { name: 'with destructive',   props: { withSection: false, destructive: true  } },
        { name: 'with section label', props: { withSection: true,  destructive: false } },
      ],
    },

    SidePanel: {
      component: SidePanelPreview,
      description: 'Right-side editing panel for focused work that should preserve surrounding context (Linear / Notion / Stripe Dashboard pattern). 480px wide on desktop, anchored to the right edge with no backdrop — the surface beneath stays visible. On mobile delegates to Modal (bottom sheet) via `useIsDesktop` since side panels don\'t fit a phone viewport. API matches Modal so migration from `<Modal>` to `<SidePanel>` is a tag swap.',
      variants: [
        { name: 'open with footer', props: { withFooter: true  } },
        { name: 'open no footer',   props: { withFooter: false } },
      ],
    },

  },

  composed: {

    Hero: {
      component: Hero,
      description: 'Top card on mobile Home. Single state-driven shape across all modes + past/today/future. Eyebrow always carries the date (with read-only/editing suffix on past). Status row holds the primary state ("Started at HH:MM" mid-day, "Done for today" green when all-done, "Not started yet" when no anchor). Submeta carries the secondary line (completion count, anchor info, or schedule context). Locked min-height; success-green only ever on the status row.',
      examples: [
        {
          name: 'Today · anchor mode · no anchor set (Set anchor pill)',
          props: { ...heroBase, scheduleMode: 'medication', isToday: true, viewDate: TODAY, shortDate: fmt(TODAY), pct: 0,   coreTotal: 4, coreDone: 0, pillTime: null,   isFuture: false, isPast: false, isReadOnly: false, viewDay: TODAY.getDay() },
        },
        {
          name: 'Today · anchor set · in progress (35%)',
          props: { ...heroBase, scheduleMode: 'medication', isToday: true, viewDate: TODAY, shortDate: fmt(TODAY), pct: 35,  coreTotal: 4, coreDone: 1, pillTime: '08:30', isFuture: false, isPast: false, isReadOnly: false, viewDay: TODAY.getDay() },
        },
        {
          name: 'Today · anchor set · all done (green status)',
          props: { ...heroBase, scheduleMode: 'medication', isToday: true, viewDate: TODAY, shortDate: fmt(TODAY), pct: 100, coreTotal: 4, coreDone: 4, pillTime: '08:30', isFuture: false, isPast: false, isReadOnly: false, viewDay: TODAY.getDay() },
        },
        {
          name: 'Past · anchor mode · read-only (partial)',
          props: { ...heroBase, scheduleMode: 'medication', isToday: false, viewDate: YEST,  shortDate: fmt(YEST), pct: 75,  coreTotal: 4, coreDone: 3, pillTime: '08:15', isFuture: false, isPast: true,  isReadOnly: true,  viewDay: YEST.getDay() },
        },
        {
          name: 'Past · anchor mode · all done · Completed (green primary)',
          props: { ...heroBase, scheduleMode: 'medication', isToday: false, viewDate: YEST,  shortDate: fmt(YEST), pct: 100, coreTotal: 4, coreDone: 4, pillTime: '08:15', isFuture: false, isPast: true,  isReadOnly: true,  viewDay: YEST.getDay() },
        },
        {
          name: 'Past · editing mode (anchor suffix accent)',
          props: { ...heroBase, scheduleMode: 'medication', isToday: false, viewDate: YEST,  shortDate: fmt(YEST), pct: 75,  coreTotal: 4, coreDone: 3, pillTime: '08:15', isFuture: false, isPast: true,  isReadOnly: false, viewDay: YEST.getDay() },
        },
        {
          name: 'Today · none mode',
          props: { ...heroBase, scheduleMode: 'none',       isToday: true, viewDate: TODAY, shortDate: fmt(TODAY), pct: 50,  coreTotal: 2, coreDone: 1, pillTime: null,   isFuture: false, isPast: false, isReadOnly: false, viewDay: TODAY.getDay() },
        },
        {
          name: 'Future day',
          props: { ...heroBase, scheduleMode: 'medication', isToday: false, viewDate: TOMOR, shortDate: fmt(TOMOR), pct: 0,   coreTotal: 4, coreDone: 0, pillTime: null,   isFuture: true,  isPast: false, isReadOnly: false, viewDay: TOMOR.getDay() },
        },
      ],
    },

    SlotCard: {
      component: SlotCard,
      description: 'Mobile slot container. Expand/collapse supplements per slot. Status drives border + badge.',
      examples: [
        {
          name: 'Now — current slot',
          props: { slot: SLOT_BREAKFAST, slotSupps: [SUPP_VITAMIN, SUPP_RX], status: 'now',    timeLabel: '08:30', hasOffset: true,  pillTime: '08:00', isFuture: false, isChecked: () => false, toggleCheck: noop, openEdit: noop, noSchedule: false, isReadOnly: false, isPast: false },
        },
        {
          name: 'Done — all checked',
          props: { slot: SLOT_BREAKFAST, slotSupps: [SUPP_VITAMIN],           status: 'done',   timeLabel: '08:30', hasOffset: true,  pillTime: '08:00', isFuture: false, isChecked: () => true,  toggleCheck: noop, openEdit: noop, noSchedule: false, isReadOnly: false, isPast: false },
        },
        {
          name: 'Late / missed',
          props: { slot: SLOT_LUNCH,     slotSupps: [SUPP_VITAMIN, SUPP_MAG], status: 'missed', timeLabel: '12:30', hasOffset: true,  pillTime: '08:00', isFuture: false, isChecked: () => false, toggleCheck: noop, openEdit: noop, noSchedule: false, isReadOnly: false, isPast: false },
        },
        {
          name: 'Future — no anchor yet',
          props: { slot: SLOT_DINNER,    slotSupps: [SUPP_MAG],               status: 'future', timeLabel: '--:--', hasOffset: false, pillTime: null,    isFuture: false, isChecked: () => false, toggleCheck: noop, openEdit: noop, noSchedule: false, isReadOnly: false, isPast: false },
        },
        {
          name: 'No schedule mode',
          props: { slot: SLOT_BREAKFAST, slotSupps: [SUPP_VITAMIN],           status: 'future', timeLabel: '',      hasOffset: false, pillTime: null,    isFuture: false, isChecked: () => false, toggleCheck: noop, openEdit: noop, noSchedule: true,  isReadOnly: false, isPast: false },
        },
      ],
    },

    SlotRow: {
      component: SlotRow,
      description: 'Desktop today panel row. One-line compressed slot with expand for supplement detail.',
      examples: [
        {
          name: 'Collapsed — 2/3 done',
          props: { slotName: 'Breakfast', slotTime: '08:30', supplements: [SUPP_VITAMIN, SUPP_MAG, SUPP_RX], loggedSupps: { 'ds-vit': true, 'ds-mag': true }, isExpanded: false, onToggleExpand: noop, isReadOnly: false, onToggleSupplement: noop, onEditSupplement: noop },
        },
        {
          name: 'Expanded — 1/2 done',
          props: { slotName: 'Lunch',     slotTime: '12:30', supplements: [SUPP_VITAMIN, SUPP_MAG],          loggedSupps: { 'ds-vit': true },                    isExpanded: true,  onToggleExpand: noop, isReadOnly: false, onToggleSupplement: noop, onEditSupplement: noop },
        },
        {
          name: 'Expanded — all done',
          props: { slotName: 'Dinner',    slotTime: '18:00', supplements: [SUPP_MAG],                        loggedSupps: { 'ds-mag': true },                    isExpanded: true,  onToggleExpand: noop, isReadOnly: false, onToggleSupplement: noop, onEditSupplement: noop },
        },
        {
          name: 'Expanded — read-only (past day)',
          props: { slotName: 'Breakfast', slotTime: '08:15', supplements: [SUPP_VITAMIN, SUPP_RX],            loggedSupps: { 'ds-vit': true },                    isExpanded: true,  onToggleExpand: noop, isReadOnly: true,  onToggleSupplement: noop, onEditSupplement: noop },
        },
      ],
    },

    SupplementRow: {
      component: SupplementRow,
      description: 'Single supplement inside an expanded SlotRow. Checkbox + name + dose + hover-reveal edit.',
      examples: [
        {
          name: 'Unchecked — interactive',
          props: { supplement: SUPP_VITAMIN,    checked: false, isReadOnly: false, onToggle: noop, onEdit: noop },
        },
        {
          name: 'Checked',
          props: { supplement: SUPP_MAG,        checked: true,  isReadOnly: false, onToggle: noop, onEdit: noop },
        },
        {
          name: 'Rx category (icon)',
          props: { supplement: SUPP_RX,         checked: false, isReadOnly: false, onToggle: noop, onEdit: noop },
        },
        {
          name: 'Injectable category (icon)',
          props: { supplement: SUPP_INJECTABLE, checked: false, isReadOnly: false, onToggle: noop, onEdit: noop },
        },
        {
          name: 'Read-only (past day)',
          props: { supplement: SUPP_VITAMIN,    checked: true,  isReadOnly: true,  onToggle: noop, onEdit: noop },
        },
      ],
    },

    DayCell: {
      component: DayCell,
      description: 'Cell in the desktop week strip. Adherence ring + day label. TODAY badge and selected/today visual states are independent.',
      examples: [
        {
          name: 'Today — selected (default state)',
          props: { date: TODAY, log: WEEK_LOGS[6], supplements: ALL_SUPPS, isSelected: true,  isFuture: false, isToday: true,  onClick: noop },
        },
        {
          name: 'Today — not selected',
          props: { date: TODAY, log: WEEK_LOGS[6], supplements: ALL_SUPPS, isSelected: false, isFuture: false, isToday: true,  onClick: noop },
        },
        {
          name: 'Past day — partial adherence',
          props: { date: YEST,  log: LOG_YESTERDAY_PARTIAL, supplements: ALL_SUPPS, isSelected: false, isFuture: false, isToday: false, onClick: noop },
        },
        {
          name: 'Past day — 100% adherence',
          props: { date: YEST,  log: LOG_YESTERDAY_FULL,    supplements: [SUPP_VITAMIN, SUPP_MAG, SUPP_RX], isSelected: false, isFuture: false, isToday: false, onClick: noop },
        },
        {
          name: 'Future day',
          props: { date: TOMOR, log: null,                  supplements: ALL_SUPPS, isSelected: false, isFuture: true,  isToday: false, onClick: noop },
        },
      ],
    },

    InsightsPanel: {
      component: InsightsPanel,
      description: 'Desktop right panel. Weekly adherence %, sparkline, streak, schedule summary, upcoming course endings.',
      examples: [
        {
          name: 'Active user with streak',
          props: { supplements: [SUPP_VITAMIN, SUPP_MAG], weekDates: WEEK_DATES, weekLogs: WEEK_LOGS, streak: 3, scheduleMode: 'medication', anchorBehavior: 'flexible',   consistentTime: '08:00', onConfigureSchedule: noop, onManageProtocol: noop },
        },
        {
          name: 'Consistent schedule + no streak',
          props: { supplements: [SUPP_VITAMIN],            weekDates: WEEK_DATES, weekLogs: WEEK_LOGS, streak: 0, scheduleMode: 'wakeup',     anchorBehavior: 'consistent', consistentTime: '07:30', onConfigureSchedule: noop, onManageProtocol: noop },
        },
      ],
    },

    LogAtSheet: {
      component: LogAtSheetPreview,
      description: 'Bottom-sheet (mobile) / centered modal (desktop) time picker for logging a missed supplement at the actual time it was taken. Captures real-world adherence data without forcing the user into past-day edit mode. Opened from the "log at…" pill on missed SlotCard rows. Writes `{ checked: true, at: "HH:MM" }` to daily_logs.checked. Each variant below renders a trigger button; click to open.',
      examples: [
        {
          name: 'Magnesium, due at 11:50, Lunch slot',
          props: {
            target: { sid: 'lunch', suppId: 'ds-mag', name: 'Magnesium Glycinate', dueTime: '11:50', slotLabel: 'Lunch' },
          },
        },
        {
          name: 'Vitamin D3, anytime slot (no due time)',
          props: {
            target: { sid: 'anytime', suppId: 'ds-vit', name: 'Vitamin D3', dueTime: null, slotLabel: null },
          },
        },
      ],
    },

  },
};
