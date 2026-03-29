// frontend/src/Onboarding.tsx
// Auth flow: Sign In or Sign Up, with Canvas setup built into Sign Up.

import { useState } from "react";

declare const __API_URL__: string;

interface OnboardingProps {
  onComplete: () => void;
}

type Screen = "welcome" | "signin" | "signup-account" | "signup-canvas" | "loading";

function getApiBase() {
  return typeof __API_URL__ !== "undefined" && __API_URL__ ? __API_URL__ : "";
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function subscribeToPush(apiBase: string): Promise<PushSubscription | null> {
  try {
    if (!("serviceWorker" in navigator)) return null;
    const registration = await navigator.serviceWorker.register("/sw.js");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;
    const { publicKey } = await fetch(`${apiBase}/api/vapid-public-key`).then((r) => r.json());
    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  } catch {
    return null;
  }
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "2px solid #e0e0e0",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "Georgia, serif",
  transition: "border-color 0.2s",
  color: "#111",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 700,
  fontSize: 14,
  marginBottom: 6,
  color: "#222",
};

const fieldStyle: React.CSSProperties = { marginBottom: 18 };

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0b63ff 0%, #003494 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Georgia, serif", padding: "24px",
    }}>
      <div style={{
        background: "white", borderRadius: 20, padding: "48px 40px",
        maxWidth: 480, width: "100%",
        boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎓</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#0b63ff", fontFamily: "Georgia, serif" }}>
            Canvas Companion
          </h1>
        </div>
        {children}
      </div>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div style={{
      background: "#fff0f0", border: "1px solid #ffcccc",
      borderRadius: 10, padding: "12px 14px", marginBottom: 18,
      fontSize: 13, color: "#c00",
    }}>
      {msg}
    </div>
  );
}

function PrimaryBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", padding: "14px", borderRadius: 12, border: "none",
      background: "#0b63ff", color: "white", fontSize: 16, fontWeight: 700,
      cursor: "pointer", fontFamily: "Georgia, serif", marginTop: 4,
    }}>
      {label}
    </button>
  );
}

function OutlineBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", padding: "14px", borderRadius: 12,
      border: "2px solid #0b63ff", background: "white",
      color: "#0b63ff", fontSize: 16, fontWeight: 700,
      cursor: "pointer", fontFamily: "Georgia, serif", marginTop: 12,
    }}>
      {label}
    </button>
  );
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [errorMsg, setErrorMsg] = useState("");

  // Sign in fields
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");

  // Sign up fields
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suConfirm, setSuConfirm] = useState("");
  const [suCanvasUrl, setSuCanvasUrl] = useState("");
  const [suCanvasToken, setSuCanvasToken] = useState("");

  function clearError() { setErrorMsg(""); }
  function go(s: Screen) { clearError(); setScreen(s); }

  async function handleSignIn() {
    if (!siEmail.trim() || !siPassword.trim()) {
      setErrorMsg("Please enter your email and password.");
      return;
    }
    setScreen("loading");
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: siEmail.trim(), password: siPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sign in failed.");

      localStorage.setItem("authToken", data.token);
      localStorage.setItem("canvasUrl", data.canvasUrl || "");
      localStorage.setItem("canvasToken", data.canvasToken || "");
      localStorage.setItem("setupComplete", "true");

      const pushSub = await subscribeToPush(apiBase);
      if (pushSub && data.token) {
        await fetch(`${apiBase}/api/auth/update-push`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.token}` },
          body: JSON.stringify({ pushSubscription: pushSub }),
        });
      }
      onComplete();
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong.");
      setScreen("signin");
    }
  }

  function handleSignUpNext() {
    if (!suEmail.trim() || !suPassword.trim() || !suConfirm.trim()) {
      setErrorMsg("Please fill in all fields.");
      return;
    }
    if (suPassword !== suConfirm) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    if (suPassword.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }
    go("signup-canvas");
  }

  async function handleSignUpSubmit() {
    if (!suCanvasUrl.trim() || !suCanvasToken.trim()) {
      setErrorMsg("Please fill in both Canvas fields.");
      return;
    }
    setScreen("loading");
    try {
      const apiBase = getApiBase();
      const pushSub = await subscribeToPush(apiBase);
      const res = await fetch(`${apiBase}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: suEmail.trim(),
          password: suPassword,
          canvasUrl: suCanvasUrl.trim(),
          canvasToken: suCanvasToken.trim(),
          pushSubscription: pushSub,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sign up failed.");

      localStorage.setItem("authToken", data.token);
      localStorage.setItem("canvasUrl", data.canvasUrl || "");
      localStorage.setItem("setupComplete", "true");
      onComplete();
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong.");
      setScreen("signup-canvas");
    }
  }

  if (screen === "loading") {
    return (
      <CardShell>
        <p style={{ textAlign: "center", color: "#555", fontSize: 16 }}>⏳ Please wait…</p>
      </CardShell>
    );
  }

  if (screen === "welcome") {
    return (
      <CardShell>
        <p style={{ textAlign: "center", color: "#555", fontSize: 15, marginBottom: 32 }}>
          Get notified about assignments due within 24 hours — even when the tab is closed.
        </p>
        <PrimaryBtn label="Sign In" onClick={() => go("signin")} />
        <OutlineBtn label="Create Account" onClick={() => go("signup-account")} />
      </CardShell>
    );
  }

  if (screen === "signin") {
    return (
      <CardShell>
        <h2 style={{ margin: "0 0 24px", fontSize: 22, color: "#111" }}>Sign In</h2>
        <ErrorBox msg={errorMsg} />
        <div style={fieldStyle}>
          <label style={labelStyle}>Email</label>
          <input type="email" value={siEmail} onChange={(e) => setSiEmail(e.target.value)}
            placeholder="you@university.edu" style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "#0b63ff")}
            onBlur={(e) => (e.target.style.borderColor = "#e0e0e0")} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Password</label>
          <input type="password" value={siPassword} onChange={(e) => setSiPassword(e.target.value)}
            placeholder="Your password" style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "#0b63ff")}
            onBlur={(e) => (e.target.style.borderColor = "#e0e0e0")} />
        </div>
        <PrimaryBtn label="Sign In" onClick={handleSignIn} />
        <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#555" }}>
          Don't have an account?{" "}
          <span onClick={() => go("signup-account")} style={{ color: "#0b63ff", cursor: "pointer", fontWeight: 700 }}>Sign Up</span>
        </p>
        <p style={{ textAlign: "center", marginTop: 4, fontSize: 13 }}>
          <span onClick={() => go("welcome")} style={{ color: "#999", cursor: "pointer" }}>← Back</span>
        </p>
      </CardShell>
    );
  }

  if (screen === "signup-account") {
    return (
      <CardShell>
        <h2 style={{ margin: "0 0 6px", fontSize: 22, color: "#111" }}>Create Account</h2>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: "#888" }}>Step 1 of 2 — Account details</p>
        <ErrorBox msg={errorMsg} />
        <div style={fieldStyle}>
          <label style={labelStyle}>Email</label>
          <input type="email" value={suEmail} onChange={(e) => setSuEmail(e.target.value)}
            placeholder="you@university.edu" style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "#0b63ff")}
            onBlur={(e) => (e.target.style.borderColor = "#e0e0e0")} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Password</label>
          <input type="password" value={suPassword} onChange={(e) => setSuPassword(e.target.value)}
            placeholder="At least 8 characters" style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "#0b63ff")}
            onBlur={(e) => (e.target.style.borderColor = "#e0e0e0")} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Confirm Password</label>
          <input type="password" value={suConfirm} onChange={(e) => setSuConfirm(e.target.value)}
            placeholder="Repeat your password" style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "#0b63ff")}
            onBlur={(e) => (e.target.style.borderColor = "#e0e0e0")} />
        </div>
        <PrimaryBtn label="Next →" onClick={handleSignUpNext} />
        <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#555" }}>
          Already have an account?{" "}
          <span onClick={() => go("signin")} style={{ color: "#0b63ff", cursor: "pointer", fontWeight: 700 }}>Sign In</span>
        </p>
        <p style={{ textAlign: "center", marginTop: 4, fontSize: 13 }}>
          <span onClick={() => go("welcome")} style={{ color: "#999", cursor: "pointer" }}>← Back</span>
        </p>
      </CardShell>
    );
  }

  if (screen === "signup-canvas") {
    return (
      <CardShell>
        <h2 style={{ margin: "0 0 6px", fontSize: 22, color: "#111" }}>Connect Canvas</h2>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: "#888" }}>Step 2 of 2 — Canvas credentials</p>
        <ErrorBox msg={errorMsg} />
        <div style={fieldStyle}>
          <label style={labelStyle}>Your Canvas URL</label>
          <input type="url" value={suCanvasUrl} onChange={(e) => setSuCanvasUrl(e.target.value)}
            placeholder="https://canvas.youruniversity.edu" style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "#0b63ff")}
            onBlur={(e) => (e.target.style.borderColor = "#e0e0e0")} />
          <p style={{ margin: "5px 0 0", fontSize: 12, color: "#888" }}>Example: https://canvas.byu.edu</p>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Canvas API Token</label>
          <input type="password" value={suCanvasToken} onChange={(e) => setSuCanvasToken(e.target.value)}
            placeholder="Paste your Canvas API token here" style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "#0b63ff")}
            onBlur={(e) => (e.target.style.borderColor = "#e0e0e0")} />
        </div>
        <details style={{ marginBottom: 20 }}>
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
        <div style={{
          background: "#f0f7ff", border: "1px solid #d0e8ff", borderRadius: 10,
          padding: "12px 14px", marginBottom: 20, fontSize: 13, color: "#444",
        }}>
          🔒 Your token is <b>encrypted</b> before being stored. It is never shared or sold.
        </div>
        <PrimaryBtn label="Create Account & Get Started" onClick={handleSignUpSubmit} />
        <p style={{ textAlign: "center", marginTop: 16, fontSize: 13 }}>
          <span onClick={() => go("signup-account")} style={{ color: "#999", cursor: "pointer" }}>← Back</span>
        </p>
      </CardShell>
    );
  }

  return null;
}