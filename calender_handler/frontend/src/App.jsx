import { useEffect, useMemo, useState } from "react";
import { applyMeta, buildFlagsMap, suggestTodayPlan } from "./AI";
import { Routes, Route, Link, useLocation } from "react-router-dom";
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

// ── Navbar ────────────────────────────────────────────────────────────────────

function Navbar({ showTA, setShowTA }) {
  const location = useLocation();

  function handleSignOut() {
    localStorage.clear();
    window.location.href = "/";
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <nav className="navbar">
      <Link to="/" className="nav-logo">Canvas Companion</Link>
      <ul className="nav-links">
        <li className={`nav-link ${location.pathname === "/" ? "active" : ""}`}>
          <Link to="/">Home</Link>
        </li>
        <li className={`nav-link ${location.pathname.startsWith("/day") ? "active" : ""}`}>
          <Link to={`/day/${todayStr}`}>Day View</Link>
        </li>
        {setShowTA && (
          <li>
            <button
              onClick={() => setShowTA(s => !s)}
              className={`toggle-btn ${showTA ? "active" : ""}`}
            >
              {showTA ? "🎓 TA On" : "🎓 TA Off"}
            </button>
          </li>
        )}
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
            fontSize: "1rem", fontWeight: 700, color: "#1e3a2f",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {x.title}
          </div>
          <div style={{ fontSize: "0.82rem", color: "#4a6b57", marginTop: 2 }}>
            {x.courseName}
          </div>
          <div style={{ fontSize: "0.8rem", color: "#4a6b57", marginTop: 4 }}>
            📅 {formatDue(x.dueAt)}
          </div>
          {flags && flags.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
              {flags.map((f, i) => (
                <span key={i} style={{
                  padding: "1px 8px", borderRadius: 999, fontSize: "0.7rem",
                  background: "#A9DEF9", color: "#1e3a2f", border: "1px solid #39ABE9",
                }}>
                  {f.type.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", fontSize: "0.8rem", color: "#4a6b57", flexShrink: 0 }}>
          {x.points !== null && (
            <div style={{ fontWeight: 600 }}>{x.points} pts</div>
          )}
          {x.url ? (
            <a className="canvas-link" href={x.url} target="_blank" rel="noreferrer"
              style={{ display: "inline-block", marginTop: 8 }}>
              Open ↗
            </a>
          ) : (
            <span style={{ fontSize: "0.75rem", color: "#7a9b84" }}>No link</span>
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
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${apiBase}/api/assignments?days=31`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: "2rem", margin: 0 }}>Your Assignments 🌸</h1>
          <p style={{ color: "#4a6b57", marginTop: 6, fontStyle: "italic", margin: "6px 0 0" }}>
            Here's what's coming up this month
          </p>
        </div>

        {/* Main layout: calendar left, sidebar right */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, marginBottom: 28 }}>
          {/* Calendar */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{
              padding: "14px 20px",
              borderBottom: "1.5px solid #b0d4be",
              background: "linear-gradient(90deg, #ddf1fd, #eaf5ee)",
            }}>
              <span className="section-title" style={{ marginBottom: 0 }}>📅 Monthly Calendar</span>
            </div>
            <MonthlyView />
          </div>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Streak */}
            <div className="card" style={{
              background: "linear-gradient(135deg, #ddf0e2, #eaf5ee)",
              textAlign: "center",
            }}>
              <Streak />
            </div>

            {/* AI Suggestions */}
            <div className="card" style={{
              background: "linear-gradient(135deg, #ddf1fd, #eaf5ee)",
            }}>
              <div className="section-title">✨ Today's Plan</div>
              {todayPlan.length === 0 ? (
                <p style={{ color: "#4a6b57", fontSize: "0.9rem", fontStyle: "italic", margin: 0 }}>
                  No suggestions right now — you're on top of it! 🌿
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {todayPlan.map(p => (
                    <div key={`${p.assignmentId}-${p.title}`} style={{
                      background: "#FFFCF7", borderRadius: 10,
                      border: "1.5px solid #A9DEF9", padding: "10px 14px",
                    }}>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1e3a2f" }}>{p.title}</div>
                      <div style={{ fontSize: "0.8rem", color: "#4a6b57", marginTop: 2 }}>
                        ⏱ {p.minutes} min · {p.reason}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: 14, borderRadius: 12, background: "#fde8e4",
            border: "1.5px solid #f5b8ae", color: "#6b1e1e", marginBottom: 20,
          }}>
            <b>Error:</b> {error}
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