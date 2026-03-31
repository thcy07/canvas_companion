import { useEffect, useMemo, useState } from "react";

function dueStatus(dueAt) {
  if (!dueAt) return "nodate";
  const dueMs = new Date(dueAt).getTime();
  if (Number.isNaN(dueMs)) return "nodate";
  const now = Date.now();
  const diff = dueMs - now;
  if (diff <= 0) return "red";
  const hours = diff / (1000 * 60 * 60);
  if (hours < 24) return "red";
  if (hours < 72) return "yellow";
  return "green";
}

function cardStyleFor(status) {
  switch (status) {
    case "red":    return { background: "#fde8e4", border: "1px solid #f5b8ae" };
    case "yellow": return { background: "#fdf5d0", border: "1px solid #f0d98c" };
    case "green":  return { background: "#ddf0e2", border: "1px solid #8bbfa0" };
    default:       return { background: "#eaf5ee", border: "1px solid #b0d4be" };
  }
}

function safeText(s, fallback = "") {
  return typeof s === "string" ? s : fallback;
}

// showTA: if false, filter out items where type === "grading"
export default function MonthlyView({ showTA = true }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());

  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

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

  const normalized = useMemo(() => {
    return items.map((it) => {
      const a = it.assignment || {};
      const dueAt = a.due_at || it.due_at || (it.submission && it.submission.due_at) || null;
      return {
        key: `${it.type || "item"}-${it.course_id || "x"}-${a.id || it.id || Math.random()}`,
        courseId: it.course_id,
        courseName: safeText(it.context_name, "Unknown course"),
        type: safeText(it.type, "unknown"),
        title: safeText(a.name, "Untitled"),
        dueAt,
        points: typeof a.points_possible === "number" ? a.points_possible : null,
        url: a.html_url || it.html_url || null,
        needsGradingCount: typeof it.needs_grading_count === "number" ? it.needs_grading_count : null,
        hasSubmitted: a.has_submitted_submissions === true,
      };
    });
  }, [items]);

  // Apply TA filter: when showTA is false, hide grading items
  const filteredNormalized = useMemo(() => {
    if (showTA) return normalized;
    return normalized.filter(x => !(typeof x.type === "string" && x.type.toLowerCase() === "grading"));
  }, [normalized, showTA]);

  const assignmentsByDate = useMemo(() => {
    const grouped = {};
    filteredNormalized.forEach((item) => {
      if (item.dueAt) {
        const dueDate = new Date(item.dueAt);
        const dateKey = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(item);
      }
    });
    return grouped;
  }, [filteredNormalized]);

  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const daysInMonth = monthEnd.getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const firstDayOfWeek = monthStart.getDay();
  const emptyDays = Array.from({ length: firstDayOfWeek }, () => null);
  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div style={{ padding: 16, fontFamily: "'Lora', Georgia, serif" }}>
      {/* Month nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button
          onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
          style={{ padding: "6px 14px", borderRadius: 999, border: "1.5px solid #b0d4be", background: "#eaf5ee", cursor: "pointer", fontFamily: "inherit" }}
        >
          ← Prev
        </button>
        <h2 style={{ margin: 0, fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.1rem", color: "#1e3a2f" }}>
          {monthName}
        </h2>
        <button
          onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
          style={{ padding: "6px 14px", borderRadius: 999, border: "1.5px solid #b0d4be", background: "#eaf5ee", cursor: "pointer", fontFamily: "inherit" }}
        >
          Next →
        </button>
      </div>

      {error && (
        <div style={{ padding: 10, border: "1px solid #f5b8ae", background: "#fde8e4", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          <b>Error:</b> {error}
        </div>
      )}

      {loading && <p style={{ color: "#4a6b57", fontStyle: "italic" }}>Loading…</p>}

      {!loading && !error && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {/* Day headers */}
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} style={{
              textAlign: "center", fontWeight: 700, padding: "6px 0",
              fontSize: "0.75rem", color: "#4a6b57",
              fontFamily: "'Lora', Georgia, serif",
            }}>
              {day}
            </div>
          ))}

          {/* Empty leading cells */}
          {emptyDays.map((_, i) => (
            <div key={`empty-${i}`} style={{ minHeight: 90, borderRadius: 8, background: "transparent" }} />
          ))}

          {/* Day cells */}
          {days.map((day) => {
            const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
            const dayAssignments = assignmentsByDate[dateStr] || [];

            const isToday =
              day === todayDay &&
              currentDate.getMonth() === todayMonth &&
              currentDate.getFullYear() === todayYear;

            return (
              <div key={day} style={{
                minHeight: 90,
                borderRadius: 8,
                padding: 6,
                overflow: "auto",
                background: "#FFFCF7",
                border: isToday ? "2.5px solid #81c3d7" : "1px solid #d4e8da",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
              }}>
                <div style={{
                  fontWeight: isToday ? 800 : 600,
                  marginBottom: 4,
                  color: isToday ? "#81c3d7" : "#1e3a2f",
                  textAlign: "left",
                  fontSize: "0.8rem",
                  fontFamily: "'Playfair Display', Georgia, serif",
                }}>
                  {day}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {dayAssignments.map((x) => {
                    const status = dueStatus(x.dueAt);
                    const colors = cardStyleFor(status);
                    return (
                      <a
                        key={x.key}
                        href={x.url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        style={{ textDecoration: "none" }}
                      >
                        <div style={{
                          ...colors,
                          borderRadius: 4,
                          padding: "3px 6px",
                          fontSize: 10,
                          cursor: "pointer",
                          width: "100%",
                          boxSizing: "border-box",
                        }} title={x.title}>
                          <div style={{
                            fontWeight: 600, overflow: "hidden",
                            textOverflow: "ellipsis", whiteSpace: "nowrap",
                            color: "#1e3a2f",
                          }}>
                            {x.title}
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}