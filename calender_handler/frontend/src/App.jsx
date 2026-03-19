import { useEffect, useMemo, useState } from "react";
import { applyMeta, buildFlagsMap, suggestTodayPlan, AI } from "./AI.jsx";
import Footer from "./Footer";
import Streak from "./Streak";
import MonthlyView from "./MonthView";
import "./App.css";
import NotificationTester from "./Notification";
import Onboarding from "./Onboarding";


// Reintroduced from the merge: a small overview panel containing
// `MonthlyView`, `Streak`, and `AI`. Kept as a named component
// so the file only has one `export default`.
function Overview({ todayPlan, flagsById }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, padding: "0 16px", marginBottom: 20 }}>
      <section style={{ backgroundColor: "#0b63ff", padding: 12, borderRadius: 10 }}>
        <MonthlyView />
      </section>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <section style={{ backgroundColor: "#FB6107", padding: 12, borderRadius: 10 }}>
          <Streak />
        </section>
        <section style={{ backgroundColor: "#5C8001", padding: 12, borderRadius: 10 }}>
          <AI todayPlan={todayPlan} flagsById={flagsById} />
        </section>
        <section style={{ backgroundColor: "#f0f0f0", padding: 12, borderRadius: 10 }}>
          <NotificationTester />
        </section>
      </div>
    </div>
  );
}


function Navbar() {
  return (
    <nav className="navbar">
        <img class="logoImage" src="images/Canvas_Companion_Logo.png" alt="Canvas Companion Logo" />
      <ul className="nav-links">
        <li className="nav-link"><a class="link" href="#home">Weekly Assignments</a></li>
        <li className="nav-link"><a class="link" href="">Assignment Plan</a></li>
        <li className="nav-link"><a class="link" href="">About</a></li>
        <li className="nav-link"><a class="link" href="#log-in">Sign Out</a></li>
      </ul>
    </nav>
  );
}
    

// --- helpers ---
// These helper functions are PURE (no React state inside them).
// They exist to keep the render section cleaner.

/**
 * dueStatus(dueAt)
 * ----------------
 * Converts a due date into a simple status label used for UI coloring.
 * Returns:
 * - "nodate"  -> no due date or invalid due date
 * - "red"     -> overdue or due within 24 hours
 * - "yellow"  -> due within 1–3 days (24–72 hours)
 * - "green"   -> due more than 3 days away
 */
function dueStatus(dueAt) {
  if (!dueAt) return "nodate"; // No due date provided by Canvas

  const dueMs = new Date(dueAt).getTime(); // Convert ISO string -> milliseconds
  if (Number.isNaN(dueMs)) return "nodate"; // Guard against invalid date strings

  const now = Date.now(); // Current time in ms
  const diff = dueMs - now; // milliseconds until due

  if (diff <= 0) return "red"; // Already due (overdue)

  const hours = diff / (1000 * 60 * 60); // Convert ms -> hours

  if (hours < 24) return "red"; // Due within the next 24 hours
  if (hours < 72) return "yellow"; // Due within 1–3 days
  return "green"; // Due later than 3 days from now
}

/**
 * cardStyleFor(status)
 * --------------------
 * Maps the status label from dueStatus() to inline CSS styles.
 * This controls the "card color" for each assignment.
 */
function cardStyleFor(status) {
  // background + border per status
  switch (status) {
    case "red":
      return { background: "#ffe5e5", border: "2px solid #5C8001" };
    case "yellow":
      return { background: "#fff7d6", border: "2px solid #5C8001" };
    case "green":
      return { background: "#e9ffe9", border: "2px solid #5C8001" };
    default:
      // Includes "nodate" or any unexpected value
      return { background: "#f7f7f7", border: "1px solid #5C8001" };
  }
}

/**
 * formatDue(dueAt)
 * ----------------
 * Formats Canvas due date strings for display.
 * Handles missing and invalid dates safely.
 */
function formatDue(dueAt) {
  if (!dueAt) return "No due date"; // Canvas sometimes omits due dates
  const d = new Date(dueAt); // Parse date
  if (Number.isNaN(d.getTime())) return "Invalid date"; // Guard for bad strings
  return d.toLocaleString(); // Localized human-readable date/time
}

/**
 * safeText(s, fallback)
 * ---------------------
 * Ensures UI fields are always a string (prevents rendering undefined/null).
 */
function safeText(s, fallback = "") {
  return typeof s === "string" ? s : fallback;
}

/**
 * App Component
 * -------------
 * Responsibilities:
 * - Fetch Canvas data from backend endpoint (/api/assignments)
 * - Normalize raw Canvas objects into a clean UI-friendly shape
 * - Provide search + sorting controls
 * - Render assignment "cards" with due-date coloring
 */
export default function App() {
  // Raw items returned from backend (Canvas API results)
  const [items, setItems] = useState([]);

  // Loading and error handling for fetch lifecycle
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // UI controls
  const [query, setQuery] = useState(""); // search text
  const [sortMode, setSortMode] = useState("due"); // "due" | "course"
  const [showTA, setShowTA] = useState(false); // toggle to show/hide grading items
  
  async function load() {
    try {
      setLoading(true); // show loading state in UI
      setError(""); // clear old error

      // This hits Vite (5173) -> proxy -> backend (3000)
      const res = await fetch(`${__API_URL__}/api/assignments?days=30`);

      // If backend returns non-200, show useful debugging info
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Backend error ${res.status}: ${text}`);
      }

      // Parse JSON response
      const data = await res.json();

      // Defensive check: the UI expects an array
      if (!Array.isArray(data)) {
        throw new Error("Expected an array from /api/assignments");
      }
      
      setItems(data);
    } catch (e) {
      // Store error message for UI display
      setError(e.message || String(e));
    } finally {
      // Always end loading state whether success or failure
      setLoading(false);
    }
  }

  // Run load() once when the component first mounts
  useEffect(() => {
    load();
  }, []);

  const [setupComplete, setSetupComplete] = useState(
  () => localStorage.getItem("setupComplete") === "true"
);

if (!setupComplete) {
  return <Onboarding onComplete={() => setSetupComplete(true)} />;
}

  /**
   * normalized
   * ----------
   * Convert raw Canvas objects into a clean, consistent shape for UI rendering.
   * Why useMemo?
   * - Avoid recomputing on every render
   * - Only recompute when `items` changes
   */
  const normalized = useMemo(() => {
    return items.map((it) => {
      const a = it.assignment || {}; // Canvas sometimes nests assignment details under it.assignment
      const dueAt = a.due_at || it.due_at || (it.submission && it.submission.due_at) || null;

      return {
        // Unique key for React list rendering.
        // NOTE: Math.random() can cause unstable keys across renders (can remount components unexpectedly),
        // but leaving unchanged as requested.
        key: `${it.type || "item"}-${it.course_id || "x"}-${a.id || it.id || Math.random()}`,

        // Course info
        courseId: it.course_id,
        courseName: safeText(it.context_name, "Unknown course"),

        // Stable identifier expected by `ai.js`
        assignmentId: a.id ?? it.id ?? null,

        // High-level item type (e.g. submitting, grading, etc.)
        type: safeText(it.type, "unknown"),

        // Assignment info
        title: safeText(a.name, "Untitled"),
        dueAt: dueAt,
        points: typeof a.points_possible === "number" ? a.points_possible : null,

        // Link to the assignment in Canvas
        url: a.html_url || it.html_url || null,

        // Additional fields if present
        needsGradingCount:
          typeof it.needs_grading_count === "number" ? it.needs_grading_count : null,

        // Canvas hint that there is already a submission on record
        hasSubmitted: a.has_submitted_submissions === true,
      };
    });
  }, [items]);

  // (Later) replace {} with meta pulled from your DB/localStorage
const assignmentsWithMeta = useMemo(() => applyMeta(normalized, {}), [normalized]);

const flagsById = useMemo(() => buildFlagsMap(assignmentsWithMeta), [assignmentsWithMeta]);

const todayPlan = useMemo(() => {
  // Exclude TA/grading items from today's plan unless `showTA` is enabled
  const pool = showTA
    ? assignmentsWithMeta
    : assignmentsWithMeta.filter((x) => !(typeof x.type === "string" && x.type.toLowerCase() === "grading"));
  return suggestTodayPlan(pool, 120);
}, [assignmentsWithMeta, showTA]);

  useEffect(() => {
  console.log("AI input (assignmentsWithMeta):", assignmentsWithMeta);
  console.log("AI flagsById:", flagsById);
  console.log("AI todayPlan:", todayPlan);
}, [assignmentsWithMeta, flagsById, todayPlan]);


  /**
   * visible
   * -------
   * Applies:
   * 1) Search filter (query)
   * 2) Sorting (sortMode)
   *
   * Also memoized so it only recomputes when normalized/query/sortMode change.
   */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase(); // normalized search query

    // Start with full list
    let filtered = normalized;

    // If TA assignments are hidden, remove items with type === 'grading'
    if (!showTA) {
      filtered = filtered.filter((x) => {
        return !(typeof x.type === "string" && x.type.toLowerCase() === "grading");
      });
    }

    // If query is not empty, filter by assignment title, course name, or item type
    if (q) {
      filtered = normalized.filter((x) => {
        return (
          x.title.toLowerCase().includes(q) ||
          x.courseName.toLowerCase().includes(q) ||
          x.type.toLowerCase().includes(q)
        );
      });
    }

    // Create a sorted copy (don’t mutate filtered array)
    const sorted = [...filtered].sort((a, b) => {
      if (sortMode === "course") {
        // Sort by course name first
        const c = a.courseName.localeCompare(b.courseName);
        if (c !== 0) return c;
        // If same course, fall through to due date sorting
      }

      // Sort by due date (null due dates go last)
      const ad = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
      const bd = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
      return ad - bd; // earlier due date first
    });

    return sorted;
  }, [normalized, query, sortMode, showTA]);

  return (
    <div style={{ width: "100%", padding: "32px 16px", fontFamily: "system-ui" }}>
      <header style={{ width: "100%" }}>
        <Navbar />
      </header>

      <div style={{ padding: "12px 0", width: "100%" }}>
        <h1 className="h1-weekly">Here are Your Prioritized Assignments</h1>
        <h2 style={{ marginTop: 8, color: "black" }}>
          You have about x hours and x minutes of work left this week.
        </h2>
      </div>

      {/* Overview panel (calendar, streak, AI) */}
      <Overview todayPlan={todayPlan} flagsById={flagsById} />

      <section style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "18px 0" }}>
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,  
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by assignment, course, or type…"
          style={{
            flex: "1 1 220px",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ccc",
          }}
        />

        {/* Sort dropdown controls sort mode */}
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ccc"
          }}
        >
          <option value="due">Sort: Due date</option>
          <option value="course">Sort: Course then due</option>
        </select>
        <button
          onClick={() => setShowTA((s) => !s)}
          title="Toggle display of grading (TA) items"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ccc",
            background: showTA ? "#e6f7ff" : "white",
            cursor: "pointer",
          }}
        >
          TA Assingments
        </button>
      </section>

      {/* Error display */}
      {error && (
        <div style={{ padding: 12, border: "1px solid #f99", background: "#fee", borderRadius: 10 }}>
          <b>Error:</b> {error}
        </div>
      )}

      {/* Loading display (only if no error) */}
      {!error && loading && <p>Loading…</p>}

      {/* Summary text after loading finishes */}
      {!loading && !error && (
        <p style={{ color: "#555" }}>
          Showing <b>{visible.length}</b> item(s).
        </p>
      )}

      {/* Today's plan from the AI (suggested time blocks) */}
      {todayPlan && todayPlan.length > 0 && (
        <section style={{ margin: "12px 0", padding: 12, borderRadius: 10, background: "#f0f7ff", border: "1px solid #d8e9ff" }}>
          <h3 style={{ margin: "0 0 8px" }}>Today's plan</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {todayPlan.map((p) => (
              <div key={`${p.assignmentId}-${p.title}`} style={{ padding: "8px 10px", background: "white", color: "#000", borderRadius: 8, border: "1px solid #eee", minWidth: 180 }}>
                <div style={{ fontWeight: 700 }}>{p.title}</div>
                <div style={{ fontSize: 13, color: "#555" }}>{p.minutes} min — {p.reason}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Responsive grid of assignment cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
        {visible.map((x) => {
          // Determine due-date status for card coloring
          const status = dueStatus(x.dueAt);

          // Map status -> inline CSS styles
          const colors = cardStyleFor(status);
          const flags = flagsById[x.assignmentId] || [];
                
          return (
            <div
              key={x.key}
              style={{
                ...colors,
                borderRadius: 14
              }}
            >
              {/* Top row: title/course on left, type/points on right */}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <p>Assignment:{x.title}</p>
                  <p>Course: {x.courseName}</p>
                  <p><b>Due:</b> {formatDue(x.dueAt)}</p>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#000" }}>{x.title}</div>
                  <div style={{ color: "#555", marginTop: 4 }}>{x.courseName}</div>

                  {flags.length > 0 && (
                    <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {flags.map((f, i) => {
                        const bg = f.severity === 3 ? "#ffd6d6" : f.severity === 2 ? "#ffeccf" : f.severity === 1 ? "#fff8d6" : "#eef6ff";
                        const color = "#000";
                        return (
                          <span key={i} style={{ padding: "2px 8px", borderRadius: 999, fontSize: 12, background: bg, color, border: "1px solid rgba(0,0,0,0.06)" }}>
                            {f.type.replace(/_/g, " ")}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              
                <div className="corner" style={{ textAlign: "right", color: "#555", fontSize: 13 }}>
                  {/*<div><b>{x.type}</b></div>*/}
                  {x.points !== null && <div>{x.points} XP | {" "}&nbsp;{" "}</div>}
                  {/* This is where the Minutes Estimate Per Assignment will Go Below*/}
                  <div> X Min</div> 

                </div>
              </div>
              
              <div style={{ marginTop: 10, color: "#333" }}>

                {/* Canvas "needs grading" field if present */}
                {x.needsGradingCount !== null && (
                  <div style={{ marginTop: 4 }}>
                    <b>Needs grading:</b> {x.needsGradingCount}
                  </div>
                )}

                {/* Canvas submission indicator */}
                {x.hasSubmitted && (
                  <div style={{ marginTop: 4, color: "#555" }}>
                    {/* Submission exists: yes */}
                  </div>
                )}
              </div>

              {/* Link section */}
              <div style={{ marginTop: 12 }}>
                {x.url ? (
                  <a className="canvas-link" href={x.url} target="_blank" rel="noreferrer">
                    Open in Canvas
                  </a>
                ) : (
                  // Sometimes Canvas does not provide a link
                  <span style={{ color: "#777777" }}>No link available</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <footer>
        <p> 2026 Canvas Companion. All rights reserved.</p>
        <ul className="footer-links">
        <li className="footer-link"><a class ="footer-a" href="#home">Canvas Companion</a></li>
        <li className="footer-link"><a class ="footer-a" href="">About</a></li>
        <li className="footer-link"><a class ="footer-a" href="#log-in">Sign Out</a></li>
      </ul>
      </footer>
    </div>
    
  );
}
