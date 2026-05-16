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
import Hero from '../Hero';
import SlotCard from '../SlotCard';
import SlotRow from '../SlotRow';
import SupplementRow from '../SupplementRow';
import { DayCell } from '../WeekStrip';
import InsightsPanel from '../InsightsPanel';

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
      description: 'SVG circular progress ring. 100% flips stroke to status.success (muted green).',
      variants: [
        { name: '0%',    props: { percentage: 0,   size: 56 } },
        { name: '35%',   props: { percentage: 35,  size: 56 } },
        { name: '75%',   props: { percentage: 75,  size: 56 } },
        { name: '100%',  props: { percentage: 100, size: 56 } },
        { name: 'lg 80', props: { percentage: 60,  size: 80 } },
        { name: 'xl 120',props: { percentage: 60,  size: 120 } },
      ],
    },

  },

  composed: {

    Hero: {
      component: Hero,
      description: 'Top card on mobile Home. Progress ring, anchor time, Start my day CTA, past-day read-only state.',
      examples: [
        {
          name: 'Day not started — medication anchor',
          props: { ...heroBase, scheduleMode: 'medication', isToday: true, viewDate: TODAY, shortDate: fmt(TODAY), pct: 0,   coreTotal: 4, coreDone: 0, pillTime: null,   isFuture: false, isPast: false, isReadOnly: false, viewDay: TODAY.getDay() },
        },
        {
          name: 'In progress (35%) — anchor set',
          props: { ...heroBase, scheduleMode: 'medication', isToday: true, viewDate: TODAY, shortDate: fmt(TODAY), pct: 35,  coreTotal: 4, coreDone: 1, pillTime: '08:30', isFuture: false, isPast: false, isReadOnly: false, viewDay: TODAY.getDay() },
        },
        {
          name: '100% complete',
          props: { ...heroBase, scheduleMode: 'medication', isToday: true, viewDate: TODAY, shortDate: fmt(TODAY), pct: 100, coreTotal: 4, coreDone: 4, pillTime: '08:30', isFuture: false, isPast: false, isReadOnly: false, viewDay: TODAY.getDay() },
        },
        {
          name: 'Past day — read-only',
          props: { ...heroBase, scheduleMode: 'medication', isToday: false, viewDate: YEST,  shortDate: fmt(YEST), pct: 75,  coreTotal: 4, coreDone: 3, pillTime: '08:15', isFuture: false, isPast: true,  isReadOnly: true,  viewDay: YEST.getDay() },
        },
        {
          name: 'No schedule mode',
          props: { ...heroBase, scheduleMode: 'none',       isToday: true, viewDate: TODAY, shortDate: fmt(TODAY), pct: 50,  coreTotal: 2, coreDone: 1, pillTime: null,   isFuture: false, isPast: false, isReadOnly: false, viewDay: TODAY.getDay() },
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

  },
};
