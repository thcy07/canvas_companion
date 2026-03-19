// frontend/public/sw.js

self.addEventListener("install", (event) => {
  console.log("Service Worker installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activated");
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    self.registration.showNotification(event.data.title || "Canvas Companion", {
      body: event.data.body || "You have an assignment due soon.",
      icon: "/icon-192.png", // optional
      badge: "/icon-192.png", // optional
      tag: "assignment-reminder",
      renotify: true,
      data: {
        url: event.data.url || "/",
      },
    });
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Add this to your existing sw.js
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Canvas Companion", {
      body: data.body || "Assignment due soon!",
      icon: "/icon-192.png",
      tag: data.url, // prevents duplicate notifications per assignment
      renotify: true,
      data: { url: data.url || "/" },
    })
  );
});