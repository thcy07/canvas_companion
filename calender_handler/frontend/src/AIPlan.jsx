// AIPlan.jsx
import { useEffect, useRef, useState } from "react";

// ── Call our own backend (which calls Anthropic securely) ─────────────────────

async function fetchAIPlan(assignments) {
  const apiBase = typeof __API_URL__ !== "undefined" && __API_URL__ ? __API_URL__ : "";
  const token = localStorage.getItem("authToken");

  const response = await fetch(`${apiBase}/api/ai-plan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ assignments }),
  });

  if (!response.ok) throw new Error(`API error ${response.status}`);
  return await response.json();
}

// ── AIPlan component ──────────────────────────────────────────────────────────

export default function AIPlan({ assignments = [] }) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const lastKey = useRef("");

  const cacheKey = assignments
    .filter(a => a.status !== "done")
    .map(a => `${a.assignmentId}:${a.dueAt}`)
    .join("|");

  async function generate() {
    if (!assignments.length) return;
    setLoading(true);
    setError("");
    try {
      const result = await fetchAIPlan(assignments);
      setPlan(result);
      lastKey.current = cacheKey;
    } catch (e) {
      setError("Couldn't generate plan right now.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (cacheKey && cacheKey !== lastKey.current) {
      generate();
    }
  }, [cacheKey]);

  return (
    <div className="card" style={{ background: "linear-gradient(135deg, #ddf1fd, #eaf5ee)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div className="section-title" style={{ margin: 0 }}>✨ Today's Plan</div>
        <button
          onClick={generate}
          disabled={loading}
          title="Regenerate plan"
          style={{
            fontSize: "0.75rem", padding: "3px 12px",
            background: loading ? "#b0d4be" : "#A9DEF9",
            borderColor: loading ? "#b0d4be" : "#A9DEF9",
            color: "#1e3a2f",
          }}
        >
          {loading ? "⏳" : "↺ Refresh"}
        </button>
      </div>

      {loading && !plan && (
        <div style={{ color: "#4a6b57", fontSize: "0.9rem", fontStyle: "italic" }}>
          🌿 Building your plan…
        </div>
      )}

      {error && !plan && (
        <div style={{ color: "#6b1e1e", fontSize: "0.85rem" }}>{error}</div>
      )}

      {!loading && !error && !plan && assignments.length === 0 && (
        <p style={{ color: "#4a6b57", fontSize: "0.9rem", fontStyle: "italic", margin: 0 }}>
          No assignments found 🌿
        </p>
      )}

      {plan && plan.length === 0 && (
        <p style={{ color: "#4a6b57", fontSize: "0.9rem", fontStyle: "italic", margin: 0 }}>
          You're all caught up! 🌸
        </p>
      )}

      {plan && plan.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {plan.map((p, i) => (
            <div key={i} style={{
              background: "#FFFCF7", borderRadius: 10,
              border: "1.5px solid #A9DEF9", padding: "10px 14px",
              animation: "fadeUp 0.3s ease forwards",
              animationDelay: `${i * 60}ms`, opacity: 0,
            }}>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1e3a2f" }}>{p.title}</div>
              <div style={{ fontSize: "0.8rem", color: "#4a6b57", marginTop: 2 }}>⏱ {p.minutes} min</div>
              <div style={{ fontSize: "0.78rem", color: "#7a9b84", marginTop: 3, fontStyle: "italic" }}>{p.reason}</div>
            </div>
          ))}
          {loading && (
            <div style={{ fontSize: "0.75rem", color: "#7a9b84", textAlign: "center", fontStyle: "italic" }}>
              Refreshing…
            </div>
          )}
        </div>
      )}
    </div>
  );
}