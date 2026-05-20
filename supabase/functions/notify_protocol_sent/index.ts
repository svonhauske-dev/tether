// supabase/functions/notify_protocol_sent/index.ts
// Called from the sender's client immediately after a successful peer-to-peer
// dbSendProtocol. Looks up the recipient's push_subscriptions and sends a
// one-shot Web Push notification: "{sender} sent you a protocol".
//
// Auth: requires a valid user JWT. The caller MUST be the sender of the
// protocol_send row (clinician_id == auth.uid). This prevents random clients
// from triggering notifications for sends they didn't make.
//
// Best-effort: failures (no VAPID keys, no subscriptions, transient push
// errors) are logged but don't return non-200 — the send itself already
// succeeded and a missed notification isn't worth surfacing to the sender.

// deno-lint-ignore-file no-explicit-any
import webpush from "npm:web-push@3";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VAPID_PUBLIC_KEY  = Deno.env.get("VAPID_PUBLIC_KEY")  ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT     = Deno.env.get("VAPID_SUBJECT")     ?? "mailto:support@origin-protocol.vercel.app";
const VAPID_READY = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (VAPID_READY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  // Authenticate the caller. Supabase verify_jwt=true (default) means the
  // gateway has already validated the JWT before this function runs; we
  // still need to read it to identify the user.
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Missing Authorization" }, 401);

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Invalid JWT" }, 401);
  const callerId = userData.user.id;

  // Parse body
  let body: { protocol_send_id?: string; sender_name?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const sendId = body?.protocol_send_id;
  const senderName = (body?.sender_name ?? "Someone").toString().slice(0, 60);
  if (!sendId) return json({ error: "protocol_send_id required" }, 400);

  // Fetch the send row + verify caller is the sender.
  const { data: sendRow, error: sendErr } = await admin
    .from("protocol_sends")
    .select("id, clinician_id, patient_id, name, supplements_snapshot")
    .eq("id", sendId)
    .maybeSingle();
  if (sendErr || !sendRow) return json({ error: "Send not found" }, 404);
  if (sendRow.clinician_id !== callerId) return json({ error: "Not your send" }, 403);

  if (!VAPID_READY) {
    console.warn("VAPID keys not configured — skipping push.");
    return json({ ok: true, sent: 0, reason: "vapid-not-configured" });
  }

  // Fetch recipient's push subscriptions
  const { data: subs, error: subErr } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", sendRow.patient_id);
  if (subErr) {
    console.error("Failed to fetch subscriptions:", subErr);
    return json({ ok: true, sent: 0, reason: "subscriptions-fetch-failed" });
  }
  if (!subs || subs.length === 0) {
    return json({ ok: true, sent: 0, reason: "no-subscriptions" });
  }

  const suppCount = Array.isArray(sendRow.supplements_snapshot) ? sendRow.supplements_snapshot.length : 0;
  const payload = JSON.stringify({
    title: `${senderName} sent you a protocol`,
    body:  `${sendRow.name}${suppCount ? ` · ${suppCount} supplement${suppCount === 1 ? "" : "s"}` : ""}`,
    tag:   `protocol-send-${sendRow.id}`,
    data:  { type: "protocol_send", send_id: sendRow.id },
  });

  let sent = 0;
  for (const sub of subs) {
    try {
      await (webpush as any).sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 86400, urgency: "high" },
      );
      sent++;
    } catch (err: any) {
      const status: number = err?.statusCode ?? err?.status ?? 0;
      if (status === 404 || status === 410) {
        // Dead subscription — clean up (same pattern as process_notifications_queue)
        await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      } else {
        console.error(`Push failed (${status}) for recipient ${sendRow.patient_id}: ${err?.message ?? err}`);
      }
    }
  }

  return json({ ok: true, sent });
});
