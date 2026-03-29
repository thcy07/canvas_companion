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
    case "red":    return { background: "#fde8e4", border: "1.5px solid #f5b8ae" };
    case "yellow": return { background: "#fdf5d0", border: "1.5px solid #f0d98c" };
    case "green":  return { background: "#ddf0e2", border: "1.5px solid #8bbfa0" };
    default:       return { background: "#eaf5ee", border: "1.5px solid #b0d4be" };
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
  const [query, setQuery] = useState("");
  const [showTA, setShowTA] = useState(false);
  const [sortMode, setSortMode] = useState("due");

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
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${apiBase}/api/assignments?days=31`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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

  const filtered = useMemo(() => {
    let result = normalized.filter(x => {
      if (!x.dueAt) return false;
      const due = new Date(x.dueAt);
      return due >= weekStart && due < weekEnd;
    });
    if (!showTA) result = result.filter(x => !(typeof x.type === "string" && x.type.toLowerCase() === "grading"));
    const q = query.trim().toLowerCase();
    if (q) result = result.filter(x =>
      x.title.toLowerCase().includes(q) ||
      x.courseName.toLowerCase().includes(q)
    );
    return [...result].sort((a, b) => {
      if (sortMode === "course") {
        const c = a.courseName.localeCompare(b.courseName);
        if (c !== 0) return c;
      }
      const ad = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      const bd = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
      return ad - bd;
    });
  }, [normalized, weekStart, weekEnd, showTA, query, sortMode]);

  const assignmentsWithMeta = useMemo(() => applyMeta(filtered, {}), [filtered]);
  const flagsById = useMemo(() => buildFlagsMap(assignmentsWithMeta), [assignmentsWithMeta]);
  const todayPlan = useMemo(() => suggestTodayPlan(assignmentsWithMeta, 120), [assignmentsWithMeta]);

  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach(x => {
      if (!x.dueAt) return;
      const d = new Date(x.dueAt);
      const key = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
      if (!g[key]) g[key] = [];
      g[key].push(x);
    });
    return g;
  }, [filtered]);

  const dayKeys = Object.keys(grouped);

  function offsetDate(days) {
    const d = new Date(targetDate);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function handleSignOut() {
    localStorage.clear();
    window.location.href = "/";
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <nav className="navbar">
        <Link to="/" className="nav-logo">Canvas Companion</Link>
        <ul className="nav-links">
          <li className="nav-link"><Link to="/">Home</Link></li>
          <li className="nav-link active"><a>Day View</a></li>
          <li>
            <button onClick={() => setShowTA(s => !s)} className={`toggle-btn ${showTA ? "active" : ""}`}>
              {showTA ? "🎓 TA On" : "🎓 TA Off"}
            </button>
          </li>
          <li className="status">Welcome back 🌿</li>
          <li>
            <button onClick={handleSignOut} style={{
              background: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.2)",
              color: "rgba(232,245,238,0.8)", fontSize: "0.85rem", padding: "5px 14px",
            }}>
              Sign Out
            </button>
          </li>
        </ul>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        {/* Date nav header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          <Link to={`/day/${offsetDate(-7)}`}>
            <button style={{ padding: "8px 18px" }}>← Prev week</button>
          </Link>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "1.8rem" }}>📖 Week View</h1>
            <p style={{ margin: "4px 0 0", color: "#4a6b57", fontStyle: "italic", fontSize: "0.9rem" }}>
              {dateLabel} — {new Date(weekEnd.getTime() - 1).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
          </div>
          <Link to={`/day/${offsetDate(7)}`}>
            <button style={{ padding: "8px 18px" }}>Next week →</button>
          </Link>
        </div>

        {/* Search bar */}
        <div className="filter-bar">
          <button onClick={load} disabled={loading} style={{
            background: loading ? "#b0d4be" : "#bde0fe",
            borderColor: loading ? "#b0d4be" : "#bde0fe",
            color: "#1e3a2f", fontWeight: 600,
          }}>
            {loading ? "Loading…" : "🔄 Refresh"}
          </button>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="🔍 Search assignments, courses…"
            style={{ flex: "1 1 200px", minWidth: 180 }}
          />
          <select value={sortMode} onChange={e => setSortMode(e.target.value)}
            style={{ borderRadius: 999, padding: "0.5em 1em" }}>
            <option value="due">Sort: Due date</option>
            <option value="course">Sort: Course</option>
          </select>
          <span style={{ fontSize: "0.85rem", color: "#4a6b57", fontStyle: "italic", whiteSpace: "nowrap" }}>
            {filtered.length} item{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
          {/* Main content */}
          <div>
            {error && (
              <div style={{
                padding: 14, borderRadius: 12, background: "#fde8e4",
                border: "1.5px solid #f5b8ae", color: "#6b1e1e", marginBottom: 20,
              }}>
                <b>Error:</b> {error}
              </div>
            )}
            {loading && (
              <div style={{ textAlign: "center", padding: 40, color: "#4a6b57", fontStyle: "italic" }}>
                🌿 Loading assignments…
              </div>
            )}
            {!loading && !error && dayKeys.length === 0 && (
              <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🌸</div>
                <p style={{ color: "#4a6b57", fontStyle: "italic", margin: 0 }}>
                  No assignments due this week. Enjoy the quiet!
                </p>
              </div>
            )}
            {!loading && !error && dayKeys.map(dayKey => (
              <div key={dayKey} style={{ marginBottom: 28 }}>
                <div style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: "1.05rem", fontWeight: 700, color: "#1e3a2f",
                  marginBottom: 12, paddingBottom: 8,
                  borderBottom: "2px solid #A9DEF9",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  🗓 {dayKey}
                  <span style={{
                    fontSize: "0.75rem", fontFamily: "'Lora', Georgia, serif",
                    fontWeight: 400, background: "#A9DEF9",
                    borderRadius: 999, padding: "1px 10px", color: "#1e3a2f",
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
                      <div key={x.key} className="card fade-up" style={{ ...colors, padding: "14px 18px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontFamily: "'Playfair Display', Georgia, serif",
                              fontSize: "1rem", fontWeight: 700, color: "#1e3a2f",
                            }}>
                              {x.title}
                            </div>
                            <div style={{ fontSize: "0.82rem", color: "#4a6b57", marginTop: 2 }}>{x.courseName}</div>
                            <div style={{ fontSize: "0.8rem", color: "#4a6b57", marginTop: 4 }}>📅 {formatDue(x.dueAt)}</div>
                            {flags.length > 0 && (
                              <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
                                {flags.map((f, i) => (
                                  <span key={i} style={{
                                    padding: "1px 8px", borderRadius: 999, fontSize: "0.7rem",
                                    background: "#A9DEF9", color: "#1e3a2f", border: "1px solid #bde0fe",
                                  }}>
                                    {f.type.replace(/_/g, " ")}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            {x.points !== null && (
                              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#4a6b57" }}>{x.points} pts</div>
                            )}
                            {x.url ? (
                              <a className="canvas-link" href={x.url} target="_blank" rel="noreferrer"
                                style={{ display: "inline-block", marginTop: 8 }}>Open ↗</a>
                            ) : (
                              <span style={{ fontSize: "0.75rem", color: "#7a9b84" }}>No link</span>
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
            <div className="card" style={{ background: "linear-gradient(135deg, #ddf0e2, #eaf5ee)", textAlign: "center" }}>
              <Streak />
            </div>
            <div className="card" style={{ background: "linear-gradient(135deg, #ddf1fd, #eaf5ee)" }}>
              <div className="section-title">✨ This Week's Plan</div>
              {todayPlan.length === 0 ? (
                <p style={{ color: "#4a6b57", fontSize: "0.9rem", fontStyle: "italic" }}>Nothing urgent this week 🌿</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {todayPlan.map(p => (
                    <div key={`${p.assignmentId}-${p.title}`} style={{
                      background: "#FFFCF7", borderRadius: 10,
                      border: "1.5px solid #A9DEF9", padding: "10px 14px",
                    }}>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1e3a2f" }}>{p.title}</div>
                      <div style={{ fontSize: "0.8rem", color: "#4a6b57", marginTop: 2 }}>⏱ {p.minutes} min · {p.reason}</div>
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