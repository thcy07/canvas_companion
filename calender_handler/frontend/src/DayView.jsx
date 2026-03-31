import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { applyMeta, buildFlagsMap, suggestTodayPlan, estimateMinutes, analyzeWeekStress } from "./AI";
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

// ── Detailed assignment card for Day View ─────────────────────────────────────

function DetailCard({ x, flags }) {
  const status = dueStatus(x.dueAt);
  const colors = cardStyleFor(status);
  const [expanded, setExpanded] = useState(false);
  const estMins = estimateMinutes(x);

  // Build a detailed outline based on assignment type
  function buildOutline(assignment) {
    const title = (assignment.title || "").toLowerCase();
    const mins = estimateMinutes(assignment);

    if (/exam|midterm|final/.test(title)) return [
      "📖 Review notes and key concepts",
      "🔁 Redo practice problems from class",
      "❓ Identify weak areas and focus there",
      "✅ Do a final review pass 30 min before",
    ];
    if (/quiz/.test(title)) return [
      "📖 Skim relevant chapter or notes",
      "✅ Take the quiz — budget ~" + mins + " min",
    ];
    if (/lab report|writeup|write.?up/.test(title)) return [
      "📝 Draft introduction and hypothesis",
      "📊 Organize data and create figures",
      "🔬 Write results and discussion sections",
      "✏️ Proofread and format citations",
    ];
    if (/lab/.test(title)) return [
      "📋 Read the lab procedure before starting",
      "🧪 Complete the experiment steps",
      "📝 Record all observations and data",
      "🧹 Clean up and submit lab report if needed",
    ];
    if (/essay|paper/.test(title)) return [
      "🗂️ Outline your main argument and structure",
      "📚 Gather sources and evidence",
      "✍️ Write a full draft",
      "✏️ Revise, proofread, and format",
    ];
    if (/project|proposal/.test(title)) return [
      "🗂️ Break the project into sections",
      "🔍 Research and gather materials",
      "🛠️ Work on the core deliverable",
      "📋 Review requirements before submitting",
    ];
    if (/homework|hw\b|problem.?set|pset/.test(title)) return [
      "📖 Re-read relevant notes or textbook sections",
      "✏️ Attempt all problems, show your work",
      "🔁 Check answers and correct mistakes",
      "📤 Submit before the deadline",
    ];
    if (/discussion|post|response/.test(title)) return [
      "📖 Read the prompt carefully",
      "💬 Write your initial post (~" + Math.round(mins * 0.6) + " min)",
      "💬 Reply to at least one classmate",
    ];
    if (/reading|read\b/.test(title)) return [
      "📖 Read actively — take brief notes",
      "🔑 Highlight key terms and arguments",
      "📝 Summarize main points after reading",
    ];
    if (/presentation|slides/.test(title)) return [
      "🗂️ Outline key talking points",
      "🖥️ Build or refine your slides",
      "🎤 Practice out loud at least once",
    ];
    if (/signup|sign.?up|select|choose/.test(title)) return [
      "🖱️ Navigate to the signup page",
      "✅ Select your preferred option",
    ];
    if (/survey|feedback|form/.test(title)) return [
      "📋 Open the form or survey link",
      "✅ Complete all required fields",
      "📤 Submit and confirm receipt",
    ];
    if (/summary/.test(title)) return [
      "📖 Review the source material",
      "✍️ Write a concise summary in your own words",
      "✏️ Proofread before submitting",
    ];

    // Generic fallback
    return [
      "📋 Read the assignment instructions carefully",
      "🛠️ Complete the main task (~" + mins + " min estimated)",
      "✅ Review your work before submitting",
    ];
  }

  const outline = buildOutline(x);

  return (
    <div className="card fade-up" style={{ ...colors, padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "1rem", fontWeight: 700, color: "#1e3a2f",
          }}>
            {x.title}
          </div>
          <div style={{ fontSize: "0.82rem", color: "#4a6b57", marginTop: 2 }}>{x.courseName}</div>
          <div style={{ fontSize: "0.8rem", color: "#4a6b57", marginTop: 4 }}>
            📅 {formatDue(x.dueAt)} · ⏱ ~{estMins} min
          </div>

          {flags && flags.length > 0 && (
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

          {/* Detailed outline */}
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              marginTop: 10, fontSize: "0.75rem", padding: "3px 12px",
              background: "transparent", borderColor: "#A9DEF9", color: "#1e3a2f",
              borderRadius: 999,
            }}
          >
            {expanded ? "▲ Hide outline" : "▼ Show outline"}
          </button>

          {expanded && (
            <div style={{
              marginTop: 10, padding: "10px 14px",
              background: "rgba(255,255,255,0.6)", borderRadius: 8,
              border: "1px solid #d4e8da",
            }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#1e3a2f", marginBottom: 6 }}>
                📋 Suggested approach:
              </div>
              {outline.map((step, i) => (
                <div key={i} style={{
                  fontSize: "0.78rem", color: "#4a6b57",
                  padding: "3px 0", borderBottom: i < outline.length - 1 ? "1px dashed #d4e8da" : "none",
                }}>
                  {step}
                </div>
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
}

// ── DayView ───────────────────────────────────────────────────────────────────

export default function DayView() {
  const { date } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [showTA, setShowTA] = useState(false);
  const [sortMode, setSortMode] = useState("due");
  // 14 or 30 day window
  const [windowDays, setWindowDays] = useState(14);

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
      const res = await fetch(`${apiBase}/api/assignments?days=90`, {
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
      description: safeText(a.description, ""),
      points: typeof a.points_possible === "number" ? a.points_possible : null,
      url: a.html_url || it.html_url || null,
      hasSubmitted: a.has_submitted_submissions === true,
    };
  }), [items]);

  const windowStart = useMemo(() => {
    const d = new Date(targetDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [targetDate]);

  const windowEnd = useMemo(() => {
    const d = new Date(windowStart);
    d.setDate(d.getDate() + windowDays);
    return d;
  }, [windowStart, windowDays]);

  const filtered = useMemo(() => {
    let result = normalized.filter(x => {
      if (!x.dueAt) return false;
      const due = new Date(x.dueAt);
      return due >= windowStart && due < windowEnd;
    });
    if (!showTA) result = result.filter(x => !(typeof x.type === "string" && x.type.toLowerCase() === "grading"));
    const q = query.trim().toLowerCase();
    if (q) result = result.filter(x =>
      x.title.toLowerCase().includes(q) ||
      x.courseName.toLowerCase().includes(q)
    );
    return [...result].sort((a, b) => {
      if (sortMode === "urgency") {
        // Urgency: overdue first, then soonest
        const ad = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
        const bd = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
        return ad - bd;
      }
      if (sortMode === "time") {
        // Sort by estimated time to complete (shortest first)
        return estimateMinutes(a) - estimateMinutes(b);
      }
      if (sortMode === "course") {
        const c = a.courseName.localeCompare(b.courseName);
        if (c !== 0) return c;
      }
      // Default: due date
      const ad = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      const bd = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
      return ad - bd;
    });
  }, [normalized, windowStart, windowEnd, showTA, query, sortMode]);

  const assignmentsWithMeta = useMemo(() => applyMeta(filtered, {}), [filtered]);
  const flagsById = useMemo(() => buildFlagsMap(assignmentsWithMeta), [assignmentsWithMeta]);

  // Stress + plan uses ALL assignments (not just window) for accurate weekly analysis
  const allWithMeta = useMemo(() => applyMeta(
    showTA ? normalized : normalized.filter(x => !(typeof x.type === "string" && x.type.toLowerCase() === "grading")),
    {}
  ), [normalized, showTA]);

  const { plan, stress } = useMemo(() => suggestTodayPlan(allWithMeta, 180), [allWithMeta]);

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

  const windowLabel = `${windowStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${new Date(windowEnd.getTime() - 1).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

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
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
          <Link to={`/day/${offsetDate(-windowDays)}`}>
            <button style={{ padding: "8px 18px" }}>← Prev</button>
          </Link>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "1.8rem" }}>📖 Upcoming View</h1>
            <p style={{ margin: "4px 0 0", color: "#4a6b57", fontStyle: "italic", fontSize: "0.9rem" }}>
              {windowLabel}
            </p>
          </div>
          <Link to={`/day/${offsetDate(windowDays)}`}>
            <button style={{ padding: "8px 18px" }}>Next →</button>
          </Link>
        </div>

        {/* Window size toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setWindowDays(d)}
              style={{
                padding: "4px 14px", fontSize: "0.8rem",
                background: windowDays === d ? "#39ABE9" : "#eaf5ee",
                borderColor: windowDays === d ? "#39ABE9" : "#b0d4be",
                color: windowDays === d ? "white" : "#1e3a2f",
              }}
            >
              {d} days
            </button>
          ))}
        </div>

        {/* Stress banner */}
        {stress && (
          <div style={{
            ...stressBannerStyle(stress.level),
            borderRadius: 12, padding: "12px 18px",
            marginBottom: 20, fontSize: "0.9rem", fontWeight: 500,
          }}>
            {stress.message}
          </div>
        )}

        {/* Filter bar */}
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
            <option value="urgency">Sort: Urgency</option>
            <option value="time">Sort: Time to complete</option>
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
                  No assignments due in this window. Enjoy the quiet!
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
                  <span style={{ fontSize: "0.72rem", color: "#7a9b84", fontWeight: 400 }}>
                    ~{grouped[dayKey].reduce((s, x) => s + estimateMinutes(x), 0)} min total
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {grouped[dayKey].map(x => (
                    <DetailCard
                      key={x.key}
                      x={x}
                      flags={flagsById[x.assignmentId] || []}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="card" style={{ background: "linear-gradient(135deg, #ddf0e2, #eaf5ee)", textAlign: "center" }}>
              <Streak />
            </div>

            {/* Plan sidebar */}
            <div className="card" style={{ background: "linear-gradient(135deg, #ddf1fd, #eaf5ee)" }}>
              <div className="section-title">✨ Today's Plan</div>
              {plan.length === 0 ? (
                <p style={{ color: "#4a6b57", fontSize: "0.9rem", fontStyle: "italic" }}>
                  Nothing urgent right now 🌿
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {plan.map((p, i) => (
                    <div key={i} style={{
                      background: "#FFFCF7", borderRadius: 10,
                      border: "1.5px solid #A9DEF9", padding: "10px 14px",
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