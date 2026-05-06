// src/lib/notifications.js — Web Push notifications client API

import { supa, getSession } from "./api";
import { colors } from "../design-system";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// ── Slot definitions — used by SlotCard / App.jsx for slot rendering ──────────

export const SLOTS = [
  { id: "rx",            label: "Anchor Medication", sublabel: "Empty stomach · first thing", icon: "★", color: colors.slotAnchor },
  { id: "pre_breakfast", label: "Before Breakfast",  sublabel: "30 min before eating",        icon: "◎", color: colors.slotPreBreakfast },
  { id: "breakfast",     label: "With Breakfast",    sublabel: "With food",                   icon: "●", color: colors.slotBreakfast },
  { id: "pre_lunch",     label: "Before Lunch",      sublabel: "30 min before eating",        icon: "◎", color: colors.slotPreLunch },
  { id: "lunch",         label: "With Lunch",        sublabel: "With food",                   icon: "●", color: colors.slotLunch },
  { id: "pre_dinner",    label: "Before Dinner",     sublabel: "30 min before eating",        icon: "◎", color: colors.slotPreDinner },
  { id: "dinner",        label: "With Dinner",       sublabel: "With food",                   icon: "●", color: colors.slotDinner },
  { id: "after_dinner",  label: "Evening",           sublabel: "Before bed",                  icon: "◑", color: colors.slotEvening },
  { id: "injectable",    label: "Injectables",       sublabel: "Subcutaneous",                icon: "⊕", color: colors.slotInjectable },
  { id: "topical",       label: "Topicals",          sublabel: "Skin & external",             icon: "◐", color: colors.slotTopical },
];

// ── Service worker registration ───────────────────────────────────────────────

let swRegistrationPromise = null;

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers not supported in this browser");
  }
  if (!swRegistrationPromise) {
    swRegistrationPromise = navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }
  return swRegistrationPromise;
}

// ── Browser support detection ─────────────────────────────────────────────────

export function isPushSupported() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isIOSPWA() {
  return isIOS() && window.navigator.standalone === true;
}

export function needsHomeScreenInstall() {
  return isIOS() && !isIOSPWA();
}

// ── Permission ────────────────────────────────────────────────────────────────

export function getNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

// ── Subscribe / unsubscribe ───────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0));
}

export async function subscribeToPush() {
  if (!isPushSupported()) {
    throw new Error("Push notifications not supported in this browser");
  }
  if (needsHomeScreenInstall()) {
    throw new Error("PWA install required on iOS — please add Origin to your home screen first");
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error("VAPID public key missing — check VITE_VAPID_PUBLIC_KEY env var");
  }

  const reg = await registerServiceWorker();
  await navigator.serviceWorker.ready;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission denied");
  }

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const user = await getSession();
  if (!user) throw new Error("Not signed in");
  const tok = localStorage.getItem("sb_token") || "";

  const subJSON = subscription.toJSON();
  await supa("POST", "/rest/v1/push_subscriptions", {
    user_id: user.id,
    endpoint: subJSON.endpoint,
    p256dh: subJSON.keys.p256dh,
    auth: subJSON.keys.auth,
    user_agent: navigator.userAgent,
  }, tok);

  return subscription;
}

export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;

  const reg = await registerServiceWorker();
  const subscription = await reg.pushManager.getSubscription();

  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    const tok = localStorage.getItem("sb_token") || "";
    await supa(
      "DELETE",
      `/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
      null,
      tok
    );
  }
}

// ── Status check ──────────────────────────────────────────────────────────────

export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;
  try {
    const reg = await registerServiceWorker();
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}
