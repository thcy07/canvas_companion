import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { applyMeta, buildFlagsMap, suggestTodayPlan } from "./AI";
import Streak from "./Streak";
import Footer from "./Footer";

function dueStatus(dueAt) {
  if (!dueAt) return "nodate";
  const dueMs = new Date(dueAt).getTime();
  if (Number.isNaN(dueMs)) return "nodate";
  const diff = dueMs - Date.now();
  if (diff <= 0) return "red";
  const hours = diff / 3600000;
  if (hours < 24) return "red";
  if (hours < 72) return "yellow";
  return "green";
}

function cardStyleFor(status) {
  switch (status) {
    case "red":    return { background: "#f7e4df", border: "1.5px solid #eab5a8" };
    case "yellow": return { background: "#fdf5d0", border: "1.5px solid #f0d98c" };
    case "green":  return { background: "#e8f5e5", border: "1.5px solid #a8c5a0" };
    default:       return { background: "#fdf6ec", border: "1.5px solid #d4b896" };
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

export default function DayView() {
  const { date } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Parse date from URL param, fallback to today
  const targetDate = useMemo(() => {
    if (date) {
      const d = new Date(date + "T00:00:00");
      if (!Number.isNaN(d.getTime())) return d;
    }
    return new Date();
  }, [date]);

  const dateLabel = targetDate.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  async function load() {
    try {
      setLoading(true);
      setError("");
      const apiBase = typeof __API_URL__ !== "undefined" && __API_URL__ ? __API_URL__ : "";
      const res = await fetch(`${apiBase}/api/assignments?days=30`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Backend error ${res.status}: ${text}`);
      }
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Expected an array");
      setItems(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const normalized = useMemo(() => items.map((it) => {
    const a = it.assignment || {};
    const dueAt = a.due_at || it.due_at || (it.submission && it.submission.due_at) || null;
    return {
      key: `${it.type || "item"}-${it.course_id || "x"}-${a.id || it.id || Math.random()}`,
      courseId: it.course_id,
      courseName: safeText(it.context_name, "Unknown course"),
      assignmentId: a.id ?? it.id ?? null,
      type: safeText(it.type, "unknown"),
      title: safeText(a.name, "Untitled"),
      dueAt,
      points: typeof a.points_possible === "number" ? a.points_possible : null,
      url: a.html_url || it.html_url || null,
      hasSubmitted: a.has_submitted_submissions === true,
    };
  }), [items]);

  // Filter to assignments due THIS week (7 days from targetDate)
  const weekStart = useMemo(() => {
    const d = new Date(targetDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [targetDate]);

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    return d;
  }, [weekStart]);

  const weekItems = useMemo(() => normalized.filter(x => {
    if (!x.dueAt) return false;
    const due = new Date(x.dueAt);
    return due >= weekStart && due < weekEnd;
  }), [normalized, weekStart, weekEnd]);

  const assignmentsWithMeta = useMemo(() => applyMeta(weekItems, {}), [weekItems]);
  const flagsById = useMemo(() => buildFlagsMap(assignmentsWithMeta), [assignmentsWithMeta]);
  const todayPlan = useMemo(() => suggestTodayPlan(assignmentsWithMeta, 120), [assignmentsWithMeta]);

  // Group by date
  const grouped = useMemo(() => {
    const g = {};
    weekItems.forEach(x => {
      if (!x.dueAt) return;
      const d = new Date(x.dueAt);
      const key = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
      if (!g[key]) g[key] = [];
      g[key].push(x);
    });
    return g;
  }, [weekItems]);

  const dayKeys = Object.keys(grouped);

  // Nav: prev/next day
  function offsetDate(days) {
    const d = new Date(targetDate);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Navbar */}
      <nav className="navbar">
        <Link to="/" className="nav-logo">Canvas Companion</Link>
        <ul className="nav-links">
          <li className="nav-link"><Link to="/">Home</Link></li>
          <li className="nav-link active"><Link to={`/day/${date}`}>Day View</Link></li>
          <li className="status">Welcome back 🌿</li>
          <li>
            <button onClick={() => { localStorage.clear(); window.location.reload(); }}
              style={{ background: "#f7e4df", borderColor: "#eab5a8", color: "#6b4c3b", fontSize: "0.85rem", padding: "5px 14px" }}>
              Sign Out
            </button>
          </li>
        </ul>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        {/* Date nav header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
          <Link to={`/day/${offsetDate(-1)}`}>
            <button style={{ padding: "8px 16px" }}>← Prev</button>
          </Link>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.8rem" }}>📖 Week View</h1>
            <p style={{ margin: "4px 0 0", color: "#7a5c4a", fontStyle: "italic", fontSize: "0.9rem" }}>
              Starting {dateLabel}
            </p>
          </div>
          <Link to={`/day/${offsetDate(1)}`}>
            <button style={{ padding: "8px 16px" }}>Next →</button>
          </Link>
          <Link to="/">
            <button style={{ padding: "8px 16px", marginLeft: "auto" }}>← Back to Calendar</button>
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
          {/* Main: assignments grouped by day */}
          <div>
            {error && (
              <div style={{ padding: 14, borderRadius: 12, background: "#f7e4df", border: "1.5px solid #eab5a8", color: "#6b4c3b", marginBottom: 20 }}>
                <b>Error:</b> {error}
              </div>
            )}
            {loading && (
              <div style={{ textAlign: "center", padding: 40, color: "#7a5c4a", fontStyle: "italic" }}>
                🌿 Loading assignments…
              </div>
            )}
            {!loading && !error && dayKeys.length === 0 && (
              <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🌸</div>
                <p style={{ color: "#7a5c4a", fontStyle: "italic", margin: 0 }}>
                  No assignments due this week. Enjoy the quiet!
                </p>
              </div>
            )}
            {!loading && !error && dayKeys.map(dayKey => (
              <div key={dayKey} style={{ marginBottom: 28 }}>
                <div style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: "1.1rem", fontWeight: 700, color: "#4e6b4a",
                  marginBottom: 12, paddingBottom: 8,
                  borderBottom: "1.5px solid #d4b896",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  🗓 {dayKey}
                  <span style={{
                    fontSize: "0.75rem", fontFamily: "'Lora', Georgia, serif",
                    fontWeight: 400, background: "#e8f5e5", border: "1px solid #a8c5a0",
                    borderRadius: 999, padding: "1px 10px", color: "#4e6b4a",
                  }}>
                    {grouped[dayKey].length} due
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {grouped[dayKey].map(x => {
                    const status = dueStatus(x.dueAt);
                    const colors = cardStyleFor(status);
                    const flags = flagsById[x.assignmentId] || [];
                    return (
                      <div key={x.key} className="card" style={{ ...colors, padding: "14px 18px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontFamily: "'Playfair Display', Georgia, serif",
                              fontSize: "1rem", fontWeight: 700, color: "#3d2b1f",
                            }}>
                              {x.title}
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "#7a5c4a", marginTop: 2 }}>
                              {x.courseName}
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "#7a5c4a", marginTop: 4 }}>
                              📅 {formatDue(x.dueAt)}
                            </div>
                            {flags.length > 0 && (
                              <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
                                {flags.map((f, i) => (
                                  <span key={i} style={{
                                    padding: "1px 8px", borderRadius: 999, fontSize: "0.7rem",
                                    background: "white", color: "#3d2b1f",
                                    border: "1px solid rgba(0,0,0,0.08)",
                                  }}>
                                    {f.type.replace(/_/g, " ")}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            {x.points !== null && (
                              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#7a5c4a" }}>
                                {x.points} pts
                              </div>
                            )}
                            {x.url ? (
                              <a className="canvas-link" href={x.url} target="_blank" rel="noreferrer"
                                style={{ display: "inline-block", marginTop: 8 }}>
                                Open ↗
                              </a>
                            ) : (
                              <span style={{ fontSize: "0.75rem", color: "#b0956f" }}>No link</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="card" style={{ background: "linear-gradient(135deg, #e8f5e5, #fdf6ec)", textAlign: "center" }}>
              <Streak />
            </div>
            <div className="card" style={{ background: "linear-gradient(135deg, #f7e4df, #fdf5d0)" }}>
              <div className="section-title">✨ Today's Plan</div>
              {todayPlan.length === 0 ? (
                <p style={{ color: "#7a5c4a", fontSize: "0.9rem", fontStyle: "italic" }}>
                  Nothing urgent this week 🌿
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {todayPlan.map(p => (
                    <div key={`${p.assignmentId}-${p.title}`} style={{
                      background: "white", borderRadius: 10,
                      border: "1.5px solid #d4b896", padding: "10px 14px",
                    }}>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#3d2b1f" }}>{p.title}</div>
                      <div style={{ fontSize: "0.8rem", color: "#7a5c4a", marginTop: 2 }}>
                        ⏱ {p.minutes} min · {p.reason}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}