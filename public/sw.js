// public/sw.js — Tether service worker for Web Push notifications

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Origin", body: event.data.text() };
  }

  const title = payload.title || "Origin";
  const options = {
    body: payload.body || "",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: payload.tag || "origin-notification",
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Deep link for peer-to-peer protocol-sent notifications: include the
  // send_id as a query param so App.jsx can open the Library straight into
  // the review modal for that specific send.
  const data = event.notification.data || {};
  const targetPath = (data.type === "protocol_send" && data.send_id)
    ? `/?send=${encodeURIComponent(data.send_id)}`
    : "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If a tab is already open, focus it and ask the App to handle the
      // deep link via postMessage — avoids forcing a full reload of an
      // already-running session.
      for (const client of windowClients) {
        if (client.url.includes(self.registration.scope) && "focus" in client) {
          if (data.type === "protocol_send" && data.send_id) {
            client.postMessage({ type: "protocol_send_deeplink", send_id: data.send_id });
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetPath);
      }
    })
  );
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
