import { useEffect, useMemo, useState } from "react";
import { applyMeta, buildFlagsMap, suggestTodayPlan, AI } from "./AI";
import { Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import APIKeyWalkthroughView from "./Walkthrough";
import DayView from "./DayView";
import Footer from "./Footer";
import Streak from "./Streak";
import MonthlyView from "./MonthView";
import "./index.css";
import Onboarding from "./Onboarding";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Navbar ────────────────────────────────────────────────────────────────────

function Navbar({ showTA, setShowTA }) {
  const location = useLocation();
  const navigate = useNavigate();

  function handleSignOut() {
    localStorage.clear();
    window.location.reload();
  }

  return (
    <nav className="navbar">
      <Link to="/" className="nav-logo">Canvas Companion</Link>
      <ul className="nav-links">
        <li className={`nav-link ${location.pathname === "/" ? "active" : ""}`}>
          <Link to="/">Home</Link>
        </li>
        <li className={`nav-link ${location.pathname.startsWith("/day") ? "active" : ""}`}>
          <Link to={`/day/${new Date().toISOString().slice(0, 10)}`}>Day View</Link>
        </li>
        {setShowTA && (
          <li>
            <button
              onClick={() => setShowTA(s => !s)}
              className={`toggle-btn ${showTA ? "active" : ""}`}
              title="Toggle TA/grading assignments"
            >
              {showTA ? "🎓 TA On" : "🎓 TA Off"}
            </button>
          </li>
        )}
        <li className="status">Welcome back 🌿</li>
        <li>
          <button onClick={handleSignOut} style={{
            background: "#f7e4df", borderColor: "#eab5a8", color: "#6b4c3b",
            fontSize: "0.85rem", padding: "5px 14px",
          }}>
            Sign Out
          </button>
        </li>
      </ul>
    </nav>
  );
}

// ── Assignment Card ───────────────────────────────────────────────────────────

function AssignmentCard({ x, flags }) {
  const status = dueStatus(x.dueAt);
  const colors = cardStyleFor(status);

  return (
    <div className="card fade-up" style={{ ...colors, padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "1rem", fontWeight: 700, color: "#3d2b1f",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {x.title}
          </div>
          <div style={{ fontSize: "0.8rem", color: "#7a5c4a", marginTop: 2 }}>
            {x.courseName}
          </div>
          <div style={{ fontSize: "0.8rem", color: "#7a5c4a", marginTop: 4 }}>
            📅 {formatDue(x.dueAt)}
          </div>
          {flags && flags.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
              {flags.map((f, i) => {
                const bg = f.severity === 3 ? "#f7e4df"
                  : f.severity === 2 ? "#fdf5d0"
                  : f.severity === 1 ? "#e8f5e5"
                  : "#ede8f5";
                return (
                  <span key={i} style={{
                    padding: "1px 8px", borderRadius: 999, fontSize: "0.7rem",
                    background: bg, color: "#3d2b1f", border: "1px solid rgba(0,0,0,0.07)",
                  }}>
                    {f.type.replace(/_/g, " ")}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", fontSize: "0.8rem", color: "#7a5c4a", flexShrink: 0 }}>
          {x.points !== null && <div style={{ fontWeight: 600 }}>{x.points} pts</div>}
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
}

// ── Home View ─────────────────────────────────────────────────────────────────

function HomeView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState("due");
  const [showTA, setShowTA] = useState(false);

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
      if (!Array.isArray(data)) throw new Error("Expected an array from /api/assignments");
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
      needsGradingCount: typeof it.needs_grading_count === "number" ? it.needs_grading_count : null,
      hasSubmitted: a.has_submitted_submissions === true,
    };
  }), [items]);

  const assignmentsWithMeta = useMemo(() => applyMeta(normalized, {}), [normalized]);
  const flagsById = useMemo(() => buildFlagsMap(assignmentsWithMeta), [assignmentsWithMeta]);
  const todayPlan = useMemo(() => {
    const pool = showTA ? assignmentsWithMeta
      : assignmentsWithMeta.filter(x => !(typeof x.type === "string" && x.type.toLowerCase() === "grading"));
    return suggestTodayPlan(pool, 120);
  }, [assignmentsWithMeta, showTA]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = normalized;
    if (!showTA) filtered = filtered.filter(x => !(typeof x.type === "string" && x.type.toLowerCase() === "grading"));
    if (q) filtered = filtered.filter(x =>
      x.title.toLowerCase().includes(q) ||
      x.courseName.toLowerCase().includes(q) ||
      x.type.toLowerCase().includes(q)
    );
    return [...filtered].sort((a, b) => {
      if (sortMode === "course") {
        const c = a.courseName.localeCompare(b.courseName);
        if (c !== 0) return c;
      }
      const ad = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      const bd = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
      return ad - bd;
    });
  }, [normalized, query, sortMode, showTA]);

  return (
    <div style={{ minHeight: "100vh" }}>
      <Navbar showTA={showTA} setShowTA={setShowTA} />

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px" }}>
        {/* Page title */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: "2rem", margin: 0 }}>Your Assignments 🌸</h1>
          <p style={{ color: "#7a5c4a", marginTop: 6, fontStyle: "italic" }}>
            Here's what's coming up this month
          </p>
        </div>

        {/* Main layout: calendar left, sidebar right */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, marginBottom: 32 }}>
          {/* Calendar */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1.5px solid #d4b896" }}>
              <span className="section-title" style={{ marginBottom: 0 }}>📅 Monthly Calendar</span>
            </div>
            <MonthlyView />
          </div>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Streak */}
            <div className="card" style={{ background: "linear-gradient(135deg, #e8f5e5, #fdf6ec)", textAlign: "center" }}>
              <Streak />
            </div>

            {/* AI Suggestions */}
            <div className="card" style={{ background: "linear-gradient(135deg, #f7e4df, #fdf5d0)" }}>
              <div className="section-title">✨ Today's Plan</div>
              {todayPlan.length === 0 ? (
                <p style={{ color: "#7a5c4a", fontSize: "0.9rem", fontStyle: "italic" }}>
                  No suggestions right now — you're on top of it! 🌿
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

        {/* Search + Sort bar */}
        <div style={{
          display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
          marginBottom: 20, padding: "14px 20px",
          background: "white", borderRadius: 14, border: "1.5px solid #d4b896",
        }}>
          <button onClick={load} disabled={loading} style={{
            background: loading ? "#d4b896" : "#a8c5a0",
            borderColor: loading ? "#d4b896" : "#7d9b76",
            color: "white", fontWeight: 600,
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
          <span style={{ fontSize: "0.85rem", color: "#7a5c4a", fontStyle: "italic" }}>
            {visible.length} item{visible.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: 14, borderRadius: 12, background: "#f7e4df",
            border: "1.5px solid #eab5a8", color: "#6b4c3b", marginBottom: 20,
          }}>
            <b>Error:</b> {error}
          </div>
        )}

        {/* Assignment grid */}
        {!loading && !error && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 14,
          }}>
            {visible.map(x => (
              <AssignmentCard key={x.key} x={x} flags={flagsById[x.assignmentId] || []} />
            ))}
            {visible.length === 0 && (
              <div style={{
                gridColumn: "1 / -1", textAlign: "center",
                padding: "60px 20px", color: "#7a5c4a", fontStyle: "italic",
              }}>
                🌿 No assignments found. Enjoy the peace!
              </div>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [setupComplete, setSetupComplete] = useState(
    () => localStorage.getItem("setupComplete") === "true"
  );

  if (!setupComplete) {
    return <Onboarding onComplete={() => setSetupComplete(true)} />;
  }

  return (
    <Routes>
      <Route path="/" element={<HomeView />} />
      <Route path="/day/:date" element={<DayView />} />
      <Route path="/walkthrough" element={<APIKeyWalkthroughView />} />
    </Routes>
  );
}