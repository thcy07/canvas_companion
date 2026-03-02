// src/ai.js
// ============================================================
// Rule-based "AI" for Canvas assignments
// ------------------------------------------------------------
// Goals (v1):
// 1) Generate FLAGS (overdue, due soon, etc.)
// 2) Generate a simple TODAY PLAN (time blocks to work on)
// 3) Keep everything deterministic + explainable (rule-based)
// ============================================================

/**
 * Small utility: safe parse of due date string -> ms timestamp
 * Returns null if no due date or invalid date.
 */
export function parseDueMs(dueAt) {
  if (!dueAt) return null;
  const ms = Date.parse(dueAt);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Compute hours until due from a dueAt string.
 * Returns null if due date missing/invalid.
 */
export function hoursUntilDue(dueAt, nowMs = Date.now()) {
  const dueMs = parseDueMs(dueAt);
  if (dueMs === null) return null;
  return (dueMs - nowMs) / (1000 * 60 * 60);
}

/**
 * Apply / merge local meta (your app-owned fields) onto normalized items.
 * If you don't have meta storage yet, you can pass an empty object {}.
 *
 * metaById example:
 * {
 *   16075151: { status:"in_progress", estimatedMinutes:90, priorityHint:"high", pinned:true }
 * }
 */
export function applyMeta(assignments, metaById = {}) {
  return assignments.map((a) => {
    const id = a.assignmentId;
    const meta = (id != null && metaById[id]) ? metaById[id] : {};

    return {
      ...a,

      // app-owned fields with defaults
      status: meta.status ?? "not_started",               // not_started | in_progress | done
      estimatedMinutes: meta.estimatedMinutes ?? null,    // number or null
      priorityHint: meta.priorityHint ?? "normal",        // low | normal | high
      pinned: meta.pinned ?? false,                       // boolean
    };
  });
}

/**
 * Convert priorityHint into a numeric weight for sorting/planning.
 */
export function priorityWeight(priorityHint) {
  switch (priorityHint) {
    case "high":
      return 3;
    case "low":
      return 1;
    default:
      return 2; // normal
  }
}

/**
 * Compute a "risk score" used to sort what's most urgent.
 * Higher score = more urgent / should be suggested earlier.
 *
 * Pinned items always float to the top.
 */
export function riskScore(a, nowMs = Date.now()) {
  if (a.pinned) return 10000;

  // Completed items should drop to the bottom
  if (a.status === "done") return -10000;

  const h = hoursUntilDue(a.dueAt, nowMs);

  // No due date: low urgency, but not zero
  if (h === null) return 50 + priorityWeight(a.priorityHint) * 10;

  // Overdue: extremely high urgency
  if (h < 0) return 9000 + priorityWeight(a.priorityHint) * 50;

  // Due windows
  if (h <= 24) return 8000 + priorityWeight(a.priorityHint) * 50;
  if (h <= 72) return 5000 + priorityWeight(a.priorityHint) * 30;
  if (h <= 168) return 2000 + priorityWeight(a.priorityHint) * 20; // 7 days

  // Far away: mostly controlled by priority
  return 500 + priorityWeight(a.priorityHint) * 15;
}

/**
 * FLAGS
 * ------------------------------------------------------------
 * Returns an array of flag objects:
 * [{ assignmentId, type, severity, message }]
 *
 * severity: 0 (info) | 1 (low) | 2 (medium) | 3 (high)
 */
export function getFlags(a, nowMs = Date.now()) {
  const flags = [];

  // If complete, we usually don't flag (except optional info)
  if (a.status === "done") return flags;

  const h = hoursUntilDue(a.dueAt, nowMs);

  if (h === null) {
    flags.push({
      assignmentId: a.assignmentId,
      type: "NO_DUE_DATE",
      severity: 1,
      message: "No due date found (consider adding one manually).",
    });
    return flags;
  }

  if (h < 0) {
    flags.push({
      assignmentId: a.assignmentId,
      type: "OVERDUE",
      severity: 3,
      message: `Overdue by ${Math.ceil(Math.abs(h))} hour(s).`,
    });
  } else if (h <= 24) {
    flags.push({
      assignmentId: a.assignmentId,
      type: "DUE_SOON",
      severity: 2,
      message: "Due within 24 hours.",
    });
  } else if (h <= 72) {
    flags.push({
      assignmentId: a.assignmentId,
      type: "DUE_IN_3_DAYS",
      severity: 1,
      message: "Due within 3 days.",
    });
  }

  // If Canvas says submission exists, show info
  if (a.hasSubmitted) {
    flags.push({
      assignmentId: a.assignmentId,
      type: "SUBMISSION_EXISTS",
      severity: 0,
      message: "Canvas shows a submission exists.",
    });
  }

  // Optional: if it's pinned, show info flag
  if (a.pinned) {
    flags.push({
      assignmentId: a.assignmentId,
      type: "PINNED",
      severity: 0,
      message: "Pinned by you.",
    });
  }

  return flags;
}

/**
 * Build a map: assignmentId -> flags[]
 * This is convenient for UI rendering.
 */
export function buildFlagsMap(assignments, nowMs = Date.now()) {
  const map = {};
  for (const a of assignments) {
    const id = a.assignmentId;
    if (id == null) continue;
    map[id] = getFlags(a, nowMs);
  }
  return map;
}

/**
 * TODAY PLAN (simple v1)
 * ------------------------------------------------------------
 * Returns a list of plan blocks for today:
 * [{ assignmentId, title, minutes, reason }]
 *
 * How it works:
 * - Filter out done items
 * - Sort by riskScore (pinned/overdue/due soon)
 * - Allocate chunks until minutesAvailable is used
 */
export function suggestTodayPlan(assignments, minutesAvailable = 120, nowMs = Date.now()) {
  const candidates = assignments
    .filter((a) => a.status !== "done")
    .slice()
    .sort((a, b) => riskScore(b, nowMs) - riskScore(a, nowMs));

  const plan = [];
  let remaining = minutesAvailable;

  for (const a of candidates) {
    if (remaining <= 0) break;
    if (a.assignmentId == null) continue;

    // Use estimate if available, else default
    const est = typeof a.estimatedMinutes === "number" ? a.estimatedMinutes : 60;

    // Chunk sizing (simple and realistic)
    // - aim for 25–60 min blocks
    // - if estimate is huge, still only suggest a chunk
    const chunk = Math.min(60, Math.max(25, Math.floor(est / 2)), remaining);

    const h = hoursUntilDue(a.dueAt, nowMs);
    let reason = "Next most urgent";
    if (a.pinned) reason = "Pinned by you";
    else if (h !== null && h < 0) reason = "Overdue";
    else if (h !== null && h <= 24) reason = "Due within 24 hours";
    else if (h !== null && h <= 72) reason = "Due within 3 days";

    plan.push({
      assignmentId: a.assignmentId,
      title: a.title,
      minutes: chunk,
      reason,
    });

    remaining -= chunk;
  }

  return plan;
}
