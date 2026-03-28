// frontend/src/Onboarding.tsx
// Clean setup page shown to new users to enter their Canvas URL and API token.

import { useState } from "react";

declare const __API_URL__: string;
const apiBase = typeof __API_URL__ !== "undefined" && __API_URL__ ? __API_URL__ : "";

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [canvasUrl, setCanvasUrl] = useState("");
  const [canvasToken, setCanvasToken] = useState("");
  const [step, setStep] = useState<"form" | "loading" | "error">("form");
  const [errorMsg, setErrorMsg] = useState("");

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  }

  async function handleSubmit() {
    if (!canvasUrl.trim() || !canvasToken.trim()) {
      setErrorMsg("Please fill in both fields.");
      return;
    }

    setStep("loading");
    setErrorMsg("");

    try {
      // 1. Register service worker
      if (!("serviceWorker" in navigator)) throw new Error("Service workers not supported.");
      const registration = await navigator.serviceWorker.register("/sw.js");

      // 2. Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission denied. Please allow notifications to continue.");

      // 3. Fetch VAPID public key from backend
      const { publicKey } = await fetch(`${apiBase}/api/vapid-public-key`).then((r) => r.json());

      // 4. Subscribe to push
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // 5. Register user with backend (token gets encrypted server-side)
      const res = await fetch(`${apiBase}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasUrl: canvasUrl.trim(),
          canvasToken: canvasToken.trim(),
          pushSubscription,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed.");

      // 6. Mark setup complete in localStorage so we don't show onboarding again
      localStorage.setItem("setupComplete", "true");
      onComplete();
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong. Please try again.");
      setStep("error");
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0b63ff 0%, #003494 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Georgia', serif",
      padding: "24px",
    }}>
      <div style={{
        background: "white",
        borderRadius: 20,
        padding: "48px 40px",
        maxWidth: 480,
        width: "100%",
        boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
      }}>
        {/* Logo / Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎓</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#0b63ff" }}>
            Canvas Companion
          </h1>
          <p style={{ margin: "8px 0 0", color: "#555", fontSize: 15 }}>
            Get notified about assignments due within 24 hours — even when the tab is closed.
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0b63ff" }} />
          <div style={{ fontSize: 13, color: "#0b63ff", fontWeight: 600 }}>One-time setup</div>
        </div>

        {/* Canvas URL */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontWeight: 700, fontSize: 14, marginBottom: 6, color: "#222" }}>
            Your Canvas URL
          </label>
          <input
            type="url"
            value={canvasUrl}
            onChange={(e) => setCanvasUrl(e.target.value)}
            placeholder="https://canvas.youruniversity.edu"
            disabled={step === "loading"}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "2px solid #e0e0e0",
              fontSize: 15,
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#0b63ff")}
            onBlur={(e) => (e.target.style.borderColor = "#e0e0e0")}
          />
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#888" }}>
            Example: https://canvas.byu.edu
          </p>
        </div>

        {/* Canvas API Token */}
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: "block", fontWeight: 700, fontSize: 14, marginBottom: 6, color: "#222" }}>
            Canvas API Token
          </label>
          <input
            type="password"
            value={canvasToken}
            onChange={(e) => setCanvasToken(e.target.value)}
            placeholder="Paste your Canvas API token here"
            disabled={step === "loading"}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "2px solid #e0e0e0",
              fontSize: 15,
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#0b63ff")}
            onBlur={(e) => (e.target.style.borderColor = "#e0e0e0")}
          />
        </div>

        {/* How to get token instructions */}
        <details style={{ marginBottom: 24 }}>
          <summary style={{ fontSize: 13, color: "#0b63ff", cursor: "pointer", userSelect: "none" }}>
            How do I get my Canvas API token?
          </summary>
          <ol style={{ fontSize: 13, color: "#555", paddingLeft: 20, marginTop: 8, lineHeight: 1.7 }}>
            <li>Log in to Canvas</li>
            <li>Go to <b>Account → Settings</b></li>
            <li>Scroll to <b>Approved Integrations</b></li>
            <li>Click <b>+ New Access Token</b></li>
            <li>Enter a name (e.g. "Canvas Companion") and click <b>Generate Token</b></li>
            <li>Copy and paste the token above</li>
          </ol>
        </details>

        {/* Security note */}
        <div style={{
          background: "#f0f7ff",
          border: "1px solid #d0e8ff",
          borderRadius: 10,
          padding: "12px 14px",
          marginBottom: 24,
          fontSize: 13,
          color: "#444",
        }}>
          🔒 Your token is <b>encrypted</b> before being stored. It is never shared or sold.
        </div>

        {/* Error message */}
        {(step === "error" || errorMsg) && (
          <div style={{
            background: "#fff0f0",
            border: "1px solid #ffcccc",
            borderRadius: 10,
            padding: "12px 14px",
            marginBottom: 20,
            fontSize: 13,
            color: "#c00",
          }}>
            {errorMsg}
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={step === "loading"}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            border: "none",
            background: step === "loading" ? "#aaa" : "#0b63ff",
            color: "white",
            fontSize: 16,
            fontWeight: 700,
            cursor: step === "loading" ? "not-allowed" : "pointer",
            transition: "background 0.2s",
          }}
        >
          {step === "loading" ? "Setting up…" : "Enable Notifications & Get Started"}
        </button>
      </div>
    </div>
  );
}