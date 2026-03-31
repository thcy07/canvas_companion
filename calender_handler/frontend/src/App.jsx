import { useEffect, useMemo, useState } from "react";
import { applyMeta, buildFlagsMap, suggestTodayPlan, hoursUntilDue } from "./AI";
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

function safeText(s, fallback = "") {
  return typeof s === "string" ? s : fallback;
}

function stressBannerStyle(level) {
  switch (level) {
    case "calm":     return { background: "#ddf0e2", border: "1.5px solid #8bbfa0", color: "#1e3a2f" };
    case "light":    return { background: "#eaf5ee", border: "1.5px solid #b0d4be", color: "#1e3a2f" };
    case "moderate": return { background: "#fdf5d0", border: "1.5px solid #f0d98c", color: "#5a4000" };
    case "busy":     return { background: "#fde8e4", border: "1.5px solid #f5b8ae", color: "#6b1e1e" };
    case "intense":  return { background: "#fde8e4", border: "2px solid #e07070",   color: "#6b0000" };
    default:         return { background: "#eaf5ee", border: "1.5px solid #b0d4be", color: "#1e3a2f" };
  }
}

// ── Plan sort ─────────────────────────────────────────────────────────────────

function sortPlan(plan, mode) {
  const copy = [...plan];
  switch (mode) {
    case "urgency":
      // Already sorted by urgency from suggestTodayPlan — keep as-is
      return copy;
    case "due":
      return copy.sort((a, b) => {
        const ah = hoursUntilDue(a.dueAt) ?? Infinity;
        const bh = hoursUntilDue(b.dueAt) ?? Infinity;
        return ah - bh;
      });
    case "time":
      return copy.sort((a, b) => (a.minutes ?? 0) - (b.minutes ?? 0));
    default:
      return copy;
  }
}

// ── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({ p }) {
  return (
    <div style={{
      background: "#FFFCF7", borderRadius: 10,
      border: "1.5px solid #A9DEF9", padding: "10px 14px",
      animation: "fadeUp 0.3s ease forwards", opacity: 0,
    }}>
      <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1e3a2f" }}>{p.title}</div>
      <div style={{ fontSize: "0.8rem", color: "#4a6b57", marginTop: 2 }}>
        ⏱ {p.minutes} min
        {p.isPartial && p.totalEstimate && (
          <span style={{ color: "#7a9b84" }}> (of ~{p.totalEstimate} min total)</span>
        )}
      </div>
      <div style={{ fontSize: "0.78rem", color: "#7a9b84", marginTop: 3, fontStyle: "italic" }}>
        {p.reason}
      </div>
    </div>
  );
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
            <button onClick={() => setShowTA(s => !s)} className={`toggle-btn ${showTA ? "active" : ""}`}>
              {showTA ? "🎓 TA On" : "🎓 TA Off"}
            </button>
          </li>
        )}
        <li className="status">Welcome back 🌿</li>
        <li>
          <button onClick={handleSignOut} style={{
            background: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.2)",
            color: "rgba(232,245,238,0.8)", fontSize: "0.85rem", padding: "5px 14px",
          }}>Sign Out</button>
        </li>
      </ul>
    </nav>
  );
}

// ── Home View ─────────────────────────────────────────────────────────────────

function HomeView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showTA, setShowTA] = useState(false);
  const [planSort, setPlanSort] = useState("urgency");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const apiBase = typeof __API_URL__ !== "undefined" && __API_URL__ ? __API_URL__ : "";
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${apiBase}/api/assignments?days=90`, {
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
      description: safeText(a.description, ""),
      points: typeof a.points_possible === "number" ? a.points_possible : null,
      url: a.html_url || it.html_url || null,
      hasSubmitted: a.has_submitted_submissions === true,
    };
  }), [items]);

  const assignmentsWithMeta = useMemo(() => applyMeta(normalized, {}), [normalized]);
  const flagsById = useMemo(() => buildFlagsMap(assignmentsWithMeta), [assignmentsWithMeta]);

  const planAssignments = useMemo(() => {
    if (showTA) return assignmentsWithMeta;
    return assignmentsWithMeta.filter(x => x.type?.toLowerCase() !== "grading");
  }, [assignmentsWithMeta, showTA]);

  const { plan: rawPlan, stress } = useMemo(
    () => suggestTodayPlan(planAssignments, 180),
    [planAssignments]
  );

  const plan = useMemo(() => sortPlan(rawPlan, planSort), [rawPlan, planSort]);

  return (
    <div style={{ minHeight: "100vh" }}>
      <Navbar showTA={showTA} setShowTA={setShowTA} />

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: "2rem", margin: 0 }}>Your Assignments 🌸</h1>
          <p style={{ color: "#4a6b57", fontStyle: "italic", margin: "6px 0 0" }}>
            Here's what's coming up in the next 3 months
          </p>
        </div>

        {/* Stress banner */}
        {stress && (
          <div style={{
            ...stressBannerStyle(stress.level),
            borderRadius: 12, padding: "12px 18px",
            marginBottom: 24, fontSize: "0.9rem", fontWeight: 500,
          }}>
            {stress.message}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, marginBottom: 28 }}>
          {/* Calendar */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{
              padding: "14px 20px", borderBottom: "1.5px solid #b0d4be",
              background: "linear-gradient(90deg, #ddf1fd, #eaf5ee)",
            }}>
              <span className="section-title" style={{ marginBottom: 0 }}>📅 Monthly Calendar</span>
            </div>
            <MonthlyView showTA={showTA} />
          </div>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="card" style={{ background: "linear-gradient(135deg, #ddf0e2, #eaf5ee)", textAlign: "center" }}>
              <Streak />
            </div>

            {/* Today's Plan */}
            <div className="card" style={{ background: "linear-gradient(135deg, #ddf1fd, #eaf5ee)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div className="section-title" style={{ margin: 0 }}>✨ Today's Plan</div>
              </div>

              {/* Sort controls */}
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {[["urgency", "🔥 Urgency"], ["due", "📅 Due date"], ["time", "⏱ Time"]].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setPlanSort(val)}
                    style={{
                      fontSize: "0.7rem", padding: "3px 8px", borderRadius: 999,
                      background: planSort === val ? "#39ABE9" : "#eaf5ee",
                      borderColor: planSort === val ? "#39ABE9" : "#b0d4be",
                      color: planSort === val ? "white" : "#4a6b57",
                      fontWeight: planSort === val ? 700 : 400,
                    }}
                  >{label}</button>
                ))}
              </div>

              {plan.length === 0 ? (
                <p style={{ color: "#4a6b57", fontSize: "0.9rem", fontStyle: "italic", margin: 0 }}>
                  You're all caught up! 🌸
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {plan.map((p, i) => <PlanCard key={i} p={p} />)}
                </div>
              )}
            </div>
          </div>
        </div>

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