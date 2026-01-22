import { useEffect, useMemo, useState } from "react";

// --- helpers ---
function dueStatus(dueAt) {
  if (!dueAt) return "nodate";

  const dueMs = new Date(dueAt).getTime();
  if (Number.isNaN(dueMs)) return "nodate";

  const now = Date.now();
  const diff = dueMs - now; // milliseconds until due

  if (diff <= 0) return "red"; // overdue
  const hours = diff / (1000 * 60 * 60);

  if (hours < 24) return "red";
  if (hours < 72) return "yellow"; // 1–3 days
  return "green";
}

function cardStyleFor(status) {
  // background + border per status
  switch (status) {
    case "red":
      return { background: "#ffe5e5", border: "1px solid #ff9a9a" };
    case "yellow":
      return { background: "#fff7d6", border: "1px solid #ffd36b" };
    case "green":
      return { background: "#e9ffe9", border: "1px solid #8fe08f" };
    default:
      return { background: "#f7f7f7", border: "1px solid #ddd" };
  }
}

function formatDue(dueAt) {
  if (!dueAt) return "No due date";
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return "Invalid date";
  return d.toLocaleString();
}

function safeText(s, fallback = "") {
  return typeof s === "string" ? s : fallback;
}

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // UI controls
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState("due"); // "due" | "course"

  async function load() {
    try {
      setLoading(true);
      setError("");

      // This hits Vite (5173) -> proxy -> backend (3000)
      const res = await fetch("/api/assignments");
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Backend error ${res.status}: ${text}`);
      }

      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error("Expected an array from /api/assignments");
      }

      setItems(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Convert the raw Canvas objects into a clean shape for UI
  const normalized = useMemo(() => {
    return items.map((it) => {
      const a = it.assignment || {};
      return {
        key: `${it.type || "item"}-${it.course_id || "x"}-${a.id || it.id || Math.random()}`,
        courseId: it.course_id,
        courseName: safeText(it.context_name, "Unknown course"),
        type: safeText(it.type, "unknown"),
        title: safeText(a.name, "Untitled"),
        dueAt: a.due_at || null,
        points: typeof a.points_possible === "number" ? a.points_possible : null,
        url: a.html_url || it.html_url || null,
        needsGradingCount:
          typeof it.needs_grading_count === "number" ? it.needs_grading_count : null,
        hasSubmitted: a.has_submitted_submissions === true,
      };
    });
  }, [items]);

  // Filter + sort
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    let filtered = normalized;
    if (q) {
      filtered = normalized.filter((x) => {
        return (
          x.title.toLowerCase().includes(q) ||
          x.courseName.toLowerCase().includes(q) ||
          x.type.toLowerCase().includes(q)
        );
      });
    }

    const sorted = [...filtered].sort((a, b) => {
      if (sortMode === "course") {
        // course name then due date
        const c = a.courseName.localeCompare(b.courseName);
        if (c !== 0) return c;
      }

      // due date: nulls last
      const ad = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
      const bd = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
      return ad - bd;
    });

    return sorted;
  }, [normalized, query, sortMode]);

  return (
    <div style={{ maxWidth: 980, margin: "32px auto", padding: "0 16px", fontFamily: "system-ui" }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Canvas To-Do (Clean View)</h1>
          <p style={{ marginTop: 8, color: "#555" }}>
            Data comes from <code>/api/assignments</code> (your backend on port 3000)
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ccc",
            background: loading ? "#f3f3f3" : "white",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <section style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "18px 0" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by assignment, course, or type…"
          style={{
            flex: "1 1 320px",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ccc",
          }}
        />

        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ccc",
            background: "white",
          }}
        >
          <option value="due">Sort: Due date</option>
          <option value="course">Sort: Course then due</option>
        </select>
      </section>

      {error && (
        <div style={{ padding: 12, border: "1px solid #f99", background: "#fee", borderRadius: 10 }}>
          <b>Error:</b> {error}
        </div>
      )}

      {!error && loading && <p>Loading…</p>}

      {!loading && !error && (
        <p style={{ color: "#555" }}>
          Showing <b>{visible.length}</b> item(s).
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
        {visible.map((x) => {
          const status = dueStatus(x.dueAt);
          const colors = cardStyleFor(status);
                
          return (
            <div
              key={x.key}
              style={{
                ...colors,
                borderRadius: 14,
                padding: 14,
              }}
            >

              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{x.title}</div>
                  <div style={{ color: "#555", marginTop: 4 }}>{x.courseName}</div>
                </div>

                <div style={{ textAlign: "right", color: "#555", fontSize: 13 }}>
                  <div><b>{x.type}</b></div>
                  {x.points !== null && <div>{x.points} pts</div>}
                </div>
              </div>

              <div style={{ marginTop: 10, color: "#333" }}>
                <div><b>Due:</b> {formatDue(x.dueAt)}</div>

                {x.needsGradingCount !== null && (
                  <div style={{ marginTop: 4 }}>
                    <b>Needs grading:</b> {x.needsGradingCount}
                  </div>
                )}

                {x.hasSubmitted && (
                  <div style={{ marginTop: 4, color: "#555" }}>
                    Submission exists: yes
                  </div>
                )}
              </div>

              <div style={{ marginTop: 12 }}>
                {x.url ? (
                  <a href={x.url} target="_blank" rel="noreferrer">
                    Open in Canvas
                  </a>
                ) : (
                  <span style={{ color: "#777777" }}>No link available</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
