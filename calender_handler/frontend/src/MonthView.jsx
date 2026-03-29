import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

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

export default function MonthlyView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());

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
    const apiItems = items.map((it) => {
      const a = it.assignment || {};
      const dueAt = a.due_at || it.due_at || (it.submission && it.submission.due_at) || null;
      return {
        key: `${it.type || "item"}-${it.course_id || "x"}-${a.id || it.id || Math.random()}`,
        courseId: it.course_id,
        courseName: safeText(it.context_name, "Unknown course"),
        type: safeText(it.type, "unknown"),
        title: safeText(a.name, "Untitled"),
        dueAt: dueAt,
        points: typeof a.points_possible === "number" ? a.points_possible : null,
        url: a.html_url || it.html_url || null,
        needsGradingCount:
          typeof it.needs_grading_count === "number" ? it.needs_grading_count : null,
        hasSubmitted: a.has_submitted_submissions === true,
      };
    });

    // Only use API items (no placeholders)
    return apiItems;
  }, [items, currentDate]);

  // Group assignments by date
  const assignmentsByDate = useMemo(() => {
    const grouped = {};
    normalized.forEach((item) => {
      if (item.dueAt) {
        const dueDate = new Date(item.dueAt);
        // Use local date components (YYYY-MM-DD) to avoid UTC shifts
        const dateKey = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(
          dueDate.getDate()
        ).padStart(2, '0')}`;
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(item);
      }
    });
    return grouped;
  }, [normalized]);

  // Get the first and last day of the current month
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const daysInMonth = monthEnd.getDate();

  // Create array of day numbers
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const firstDayOfWeek = monthStart.getDay();
  const emptyDays = Array.from({ length: firstDayOfWeek }, () => null);

  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div style={{ padding: 20, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button
          onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", background: "white", cursor: "pointer" }}
        >
          ← Previous
        </button>
        <h2 style={{ margin: 0 }}>{monthName}</h2>
        <button
          onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", background: "white", cursor: "pointer" }}
        >
          Next →
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, border: "1px solid #f99", background: "#fee", borderRadius: 10, marginBottom: 20 }}>
          <b>Error:</b> {error}
        </div>
      )}

      {loading && <p>Loading…</p>}

      {!loading && !error && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} style={{ textAlign: "center", fontWeight: "bold", padding: 8 }}>
              {day}
            </div>
          ))}
          {emptyDays.map((_, i) => (
            <div
              key={`empty-${i}`}
              style={{
                minHeight: 120,
                border: "1px solid #eee",
                borderRadius: 8,
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                padding: 8,
                boxSizing: "border-box",
              }}
            ></div>
          ))}
          {days.map((day) => {
            // Format as YYYY-MM-DD to match the grouping key
            const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(
              dateObj.getDate()
            ).padStart(2, '0')}`;
            const dayAssignments = assignmentsByDate[dateStr] || [];
            return (
              <div
                key={day}
                style={{
                  minHeight: 120,
                  border: "1px solid #eee",
                  borderRadius: 8,
                  padding: 8,
                  overflow: "auto",
                  backgroundColor:
                    day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth()
                      ? "#f0f0f0"
                      : "white",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ fontWeight: "bold", marginBottom: 8, color: "#333", textAlign: "left" }}>{day}</div>
                <Link to={`/day/${dateStr}`}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }}>
                    {dayAssignments.map((x) => {
                      const status = dueStatus(x.dueAt);
                      const colors = cardStyleFor(status);
                      return (
                        <div
                          key={x.key}
                          style={{
                            ...colors,
                            borderRadius: 6,
                            padding: 6,
                            fontSize: 12,
                            cursor: "pointer",
                            width: "100%",
                            boxSizing: "border-box",
                          }}
                          title={x.title}
                        >
                          <div style={{ fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {x.title}
                          </div>
                          <div style={{ fontSize: 10, color: "#666" }}>{x.courseName}</div>
                          {x.url && (
                            <a href={x.url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#0066cc" }}>
                              Open
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
