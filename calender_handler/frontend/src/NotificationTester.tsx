import { useState } from "react";

export default function NotificationTester() {
  const [permission, setPermission] = useState(Notification.permission);
  const [status, setStatus] = useState("Idle");

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      setStatus("Service workers are not supported in this browser.");
      return null;
    }
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      setStatus("Service worker registered.");
      return registration;
    } catch (error) {
      console.error(error);
      setStatus("Failed to register service worker.");
      return null;
    }
  }

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  }

  // ← NEW enableNotifications replaces the old one
  async function enableNotifications() {
    if (!("Notification" in window)) {
      setStatus("Notifications are not supported in this browser.");
      return;
    }

    const registration = await registerServiceWorker();
    if (!registration) return;

    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") return;

    // Fetch public key from backend
    const { publicKey } = await fetch("/api/vapid-public-key").then(r => r.json());

    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub),
    });

    setStatus("Push notifications enabled!");
  }

  async function sendTestNotification() {
    if (Notification.permission !== "granted") {
      setStatus("Please enable notifications first.");
      return;
    }
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration || !navigator.serviceWorker.controller) {
      setStatus("No active service worker controller found. Refresh the page once.");
      return;
    }
    navigator.serviceWorker.controller.postMessage({
      type: "SHOW_NOTIFICATION",
      title: "Canvas Companion Reminder",
      body: "Test: Assignment is due soon!",
      url: "/",
    });
    setStatus("Test notification sent.");
  }

  async function sendBackendTriggeredReminder() {
    if (Notification.permission !== "granted") {
      setStatus("Please enable notifications first.");
      return;
    }
    const response = await fetch("/api/test-reminder");
    const data = await response.json();
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration || !navigator.serviceWorker.controller) {
      setStatus("No active service worker controller found. Refresh the page once.");
      return;
    }
    navigator.serviceWorker.controller.postMessage({
      type: "SHOW_NOTIFICATION",
      title: data.title,
      body: data.body,
      url: data.url,
    });
    setStatus("Backend reminder sent to service worker.");
  }

  return (
    <div style={{ padding: "1rem", border: "1px solid #ccc", borderRadius: "8px", marginTop: "1rem" }}>
      <h2>Notification Tester</h2>
      <p><strong>Permission:</strong> {permission}</p>
      <p><strong>Status:</strong> {status}</p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button onClick={enableNotifications}>Enable Notifications</button>
        <button onClick={sendTestNotification}>Send Test Reminder</button>
        <button onClick={sendBackendTriggeredReminder}>Send Backend Reminder</button>
      </div>
    </div>
  );
}