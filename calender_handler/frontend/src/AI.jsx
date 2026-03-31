// AIPlan.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Replaces the static rule-based "Today's Plan" sidebar with a Claude-powered
// plan that reads assignment descriptions to estimate real effort.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";

// ── Helpers (kept from original AI.jsx for urgency context) ───────────────────

function hoursUntil(dueAt) {
  if (!dueAt) return null;
  const ms = Date.parse(dueAt);
  return Number.isFinite(ms) ? (ms - Date.now()) / 3600000 : null;
}

function urgencyLabel(dueAt) {
  const h = hoursUntil(dueAt);
  if (h === null) return "no due date";
  if (h < 0) return "OVERDUE";
  if (h <= 24) return "due within 24 hours";
  if (h <= 72) return "due within 3 days";
  if (h <= 168) return "due within a week";
  return `due in ${Math.round(h / 24)} days`;
}

// ── Build prompt from assignments ─────────────────────────────────────────────

function buildPrompt(assignments) {
  const list = assignments
    .filter(a => a.status !== "done")
    .map((a, i) => {
      const urgency = urgencyLabel(a.dueAt);
      const desc = a.description ? `\n   Description: "${a.description.slice(0, 300)}"` : "";
      return `${i + 1}. "${a.title}" (${a.courseName}) — ${urgency}${desc}`;
    })
    .join("\n");

  return `You are a friendly academic planner. A student has these upcoming Canvas assignments:

${list}

Your job: create a focused "Today's Plan" — a short prioritized list of work blocks the student should do TODAY.

Rules:
- Read any description text carefully — it often says how long the assignment takes or what's involved.
- Prioritize by urgency (overdue first, then due soon), but factor in estimated effort from descriptions.
- Suggest 3–5 work blocks. Each block: a task name, estimated minutes, and a 1-sentence reason.
- Be specific and encouraging. If a description says "10-minute quiz," say 10 minutes.
- Keep each block concise. Output ONLY valid JSON — no markdown, no explanation.

Format:
[
  { "title": "...", "minutes": 30, "reason": "..." },
  ...
]`;
}

// ── Claude API call ───────────────────────────────────────────────────────────

async function fetchAIPlan(assignments) {
  const prompt = buildPrompt(assignments);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  const data = await response.json();
  const raw = data.content?.find(b => b.type === "text")?.text || "[]";

  // Strip any accidental markdown fences
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ── AIPlan component ──────────────────────────────────────────────────────────

export default function AIPlan({ assignments = [] }) {
  const [plan, setPlan] = useState(null);       // null = not loaded yet
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const lastKey = useRef("");                    // avoid re-fetching if nothing changed

  // Derive a stable cache key from assignment ids + due dates
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

  // Auto-fetch once on mount (or when assignments change significantly)
  useEffect(() => {
    if (cacheKey && cacheKey !== lastKey.current) {
      generate();
    }
  }, [cacheKey]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="card" style={{ background: "linear-gradient(135deg, #ddf1fd, #eaf5ee)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div className="section-title" style={{ margin: 0 }}>✨ Today's Plan</div>
        <button
          onClick={generate}
          disabled={loading}
          title="Regenerate plan"
          style={{
            fontSize: "0.75rem",
            padding: "3px 12px",
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
              background: "#FFFCF7",
              borderRadius: 10,
              border: "1.5px solid #A9DEF9",
              padding: "10px 14px",
              animation: "fadeUp 0.3s ease forwards",
              animationDelay: `${i * 60}ms`,
              opacity: 0,
            }}>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1e3a2f" }}>
                {p.title}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#4a6b57", marginTop: 2 }}>
                ⏱ {p.minutes} min
              </div>
              <div style={{ fontSize: "0.78rem", color: "#7a9b84", marginTop: 3, fontStyle: "italic" }}>
                {p.reason}
              </div>
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