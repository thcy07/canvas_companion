// frontend/src/Onboarding.tsx
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
  border: "2px solid #A9DEF9",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "Georgia, serif",
  transition: "border-color 0.2s",
  color: "#1e3a2f",
  background: "#FFFCF7",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 700,
  fontSize: 14,
  marginBottom: 6,
  color: "#1e3a2f",
  fontFamily: "Georgia, serif",
};

const fieldStyle: React.CSSProperties = { marginBottom: 18 };

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#6A9915",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Georgia, serif", padding: "24px",
    }}>
      <div style={{
        background: "#D8D2A3",
        borderRadius: 20,
        padding: "48px 40px",
        maxWidth: 480,
        width: "100%",
        boxShadow: "0 24px 80px rgba(30,58,47,0.15)",
        border: "1.5px solid #A9DEF9",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}></div>
          <img className = "turtle" src="/images/Canvas_Companion_Logo.png" alt="Canvas Companion Logo"></img>
          <h1 style={{
            margin: 0, fontSize: 28, fontWeight: 800,
            color: "#2d6a4f", fontFamily: "Georgia, serif",
          }}>
          </h1>
          <p style={{ margin: "8px 0 0", color: "#4a6b57", fontSize: 17, fontStyle: "italic" }}>
            Stay on top of your assignments
          </p>
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
      background: "#fde8e4", border: "1px solid #f5b8ae",
      borderRadius: 10, padding: "12px 14px", marginBottom: 18,
      fontSize: 13, color: "#6b1e1e", fontFamily: "Georgia, serif",
    }}>
      {msg}
    </div>
  );
}

function PrimaryBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", padding: "14px", borderRadius: 12, border: "none",
      background: "#2d6a4f", color: "#FFFCF7", fontSize: 16, fontWeight: 700,
      cursor: "pointer", fontFamily: "Georgia, serif", marginTop: 4,
      transition: "background 0.2s",
    }}
      onMouseOver={e => (e.currentTarget.style.background = "#1e3a2f")}
      onMouseOut={e => (e.currentTarget.style.background = "#2d6a4f")}
    >
      {label}
    </button>
  );
}

function OutlineBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", padding: "14px", borderRadius: 12,
      border: "2px solid #A9DEF9", background: "#FFFCF7",
      color: "#2d6a4f", fontSize: 16, fontWeight: 700,
      cursor: "pointer", fontFamily: "Georgia, serif", marginTop: 12,
    }}>
      {label}
    </button>
  );
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [errorMsg, setErrorMsg] = useState("");

  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");

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

  const linkStyle: React.CSSProperties = {
    color: "#2d6a4f", cursor: "pointer", fontWeight: 700, textDecoration: "underline",
  };
  const backStyle: React.CSSProperties = {
    color: "#7a9b84", cursor: "pointer",
  };

  if (screen === "loading") {
    return (
      <CardShell>
        <p style={{ textAlign: "center", color: "#4a6b57", fontSize: 16 }}>⏳ Please wait…</p>
      </CardShell>
    );
  }

  if (screen === "welcome") {
    return (
      <CardShell>
        <p style={{ textAlign: "center", color: "#4a6b57", fontSize: 15, marginBottom: 32 }}>
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
        <h2 style={{ margin: "0 0 24px", fontSize: 22, color: "#1e3a2f", fontFamily: "Georgia, serif" }}>Sign In</h2>
        <ErrorBox msg={errorMsg} />
        <div style={fieldStyle}>
          <label style={labelStyle}>Email</label>
          <input type="email" value={siEmail} onChange={(e) => setSiEmail(e.target.value)}
            placeholder="you@university.edu" style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "#2d6a4f")}
            onBlur={(e) => (e.target.style.borderColor = "#A9DEF9")} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Password</label>
          <input type="password" value={siPassword} onChange={(e) => setSiPassword(e.target.value)}
            placeholder="Your password" style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "#2d6a4f")}
            onBlur={(e) => (e.target.style.borderColor = "#A9DEF9")} />
        </div>
        <PrimaryBtn label="Sign In" onClick={handleSignIn} />
        <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#4a6b57" }}>
          Don't have an account?{" "}
          <span onClick={() => go("signup-account")} style={linkStyle}>Sign Up</span>
        </p>
        <p style={{ textAlign: "center", marginTop: 4, fontSize: 13 }}>
          <span onClick={() => go("welcome")} style={backStyle}>← Back</span>
        </p>
      </CardShell>
    );
  }

  if (screen === "signup-account") {
    return (
      <CardShell>
        <h2 style={{ margin: "0 0 6px", fontSize: 22, color: "#1e3a2f", fontFamily: "Georgia, serif" }}>Create Account</h2>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: "#4a6b57" }}>Step 1 of 2 — Account details</p>
        <ErrorBox msg={errorMsg} />
        <div style={fieldStyle}>
          <label style={labelStyle}>Email</label>
          <input type="email" value={suEmail} onChange={(e) => setSuEmail(e.target.value)}
            placeholder="you@university.edu" style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "#2d6a4f")}
            onBlur={(e) => (e.target.style.borderColor = "#A9DEF9")} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Password</label>
          <input type="password" value={suPassword} onChange={(e) => setSuPassword(e.target.value)}
            placeholder="At least 8 characters" style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "#2d6a4f")}
            onBlur={(e) => (e.target.style.borderColor = "#A9DEF9")} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Confirm Password</label>
          <input type="password" value={suConfirm} onChange={(e) => setSuConfirm(e.target.value)}
            placeholder="Repeat your password" style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "#2d6a4f")}
            onBlur={(e) => (e.target.style.borderColor = "#A9DEF9")} />
        </div>
        <PrimaryBtn label="Next →" onClick={handleSignUpNext} />
        <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#4a6b57" }}>
          Already have an account?{" "}
          <span onClick={() => go("signin")} style={linkStyle}>Sign In</span>
        </p>
        <p style={{ textAlign: "center", marginTop: 4, fontSize: 13 }}>
          <span onClick={() => go("welcome")} style={backStyle}>← Back</span>
        </p>
      </CardShell>
    );
  }

  if (screen === "signup-canvas") {
    return (
      <CardShell>
        <h2 style={{ margin: "0 0 6px", fontSize: 22, color: "#1e3a2f", fontFamily: "Georgia, serif" }}>Connect Canvas</h2>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: "#4a6b57" }}>Step 2 of 2 — Canvas credentials</p>
        <ErrorBox msg={errorMsg} />
        <div style={fieldStyle}>
          <label style={labelStyle}>Your Canvas URL</label>
          <input type="url" value={suCanvasUrl} onChange={(e) => setSuCanvasUrl(e.target.value)}
            placeholder="https://canvas.youruniversity.edu" style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "#2d6a4f")}
            onBlur={(e) => (e.target.style.borderColor = "#A9DEF9")} />
          <p style={{ margin: "5px 0 0", fontSize: 12, color: "#4a6b57" }}>Example: https://canvas.byu.edu</p>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Canvas API Token</label>
          <input type="password" value={suCanvasToken} onChange={(e) => setSuCanvasToken(e.target.value)}
            placeholder="Paste your Canvas API token here" style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "#2d6a4f")}
            onBlur={(e) => (e.target.style.borderColor = "#A9DEF9")} />
        </div>
        <details style={{ marginBottom: 20 }}>
          <summary style={{ fontSize: 13, color: "#2d6a4f", cursor: "pointer", userSelect: "none" }}>
            How do I get my Canvas API token?
          </summary>
          <ol style={{ fontSize: 16, color: "#4a6b57", paddingLeft: 20, marginTop: 8, lineHeight: 1.7 }}>
            <li>Log in to Canvas</li>
            <li>Go to <b>Account → Settings</b></li>
            <li>Scroll to <b>Approved Integrations</b></li>
            <li>Click <b>+ New Access Token</b></li>
            <li>Enter a name (e.g. "Canvas Companion") and click <b>Generate Token</b></li>
            <li>Copy and paste the token above</li>
          </ol>
        </details>
        <div style={{
          background: "#ddf1fd", border: "1px solid #A9DEF9",
          borderRadius: 10, padding: "12px 14px", marginBottom: 20,
          fontSize: 13, color: "#1e3a2f",
        }}>
          🔒 Your token is <b>encrypted</b> before being stored. It is never shared or sold.
        </div>
        <PrimaryBtn label="Create Account & Get Started" onClick={handleSignUpSubmit} />
        <p style={{ textAlign: "center", marginTop: 16, fontSize: 13 }}>
          <span onClick={() => go("signup-account")} style={backStyle}>← Back</span>
        </p>
      </CardShell>
    );
  }

  return null;
}