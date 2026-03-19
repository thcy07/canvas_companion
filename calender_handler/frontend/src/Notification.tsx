// frontend/src/NotificationTester.tsx
// Minimal component — just silently re-subscribes in background if already set up.
// The full setup flow is handled by Onboarding.tsx.

import { useEffect, useState } from "react";
declare const __API_URL__: string;

export default function NotificationTester() {
  const [status, setStatus] = useState<"active" | "inactive">("inactive");

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  }

  useEffect(() => {
    async function resubscribeIfNeeded() {
      const setupComplete = localStorage.getItem("setupComplete");
      if (!setupComplete) return;
      if (!("serviceWorker" in navigator)) return;
      if (Notification.permission !== "granted") return;

      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const { publicKey } = await fetch(`${__API_URL__}/api/vapid-public-key`).then((r) => r.json());

        const pushSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        // Re-send subscription to backend (upsert keeps it fresh)
        await fetch(`${__API_URL__}/api/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pushSubscription),
        });

        setStatus("active");
      } catch {
        setStatus("inactive");
      }
    }

    resubscribeIfNeeded();
  }, []);

  if (status === "active") {
    return (
      <div style={{ fontSize: 13, color: "#000000" }}>
        🔔 Notifications active
      </div>
    );
  }

  return null;
}