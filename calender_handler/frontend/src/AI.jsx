// AI.jsx
// ============================================================
// Smart rule-based planner for Canvas assignments
// ============================================================

export function parseDueMs(dueAt) {
  if (!dueAt) return null;
  const ms = Date.parse(dueAt);
  return Number.isFinite(ms) ? ms : null;
}

export function hoursUntilDue(dueAt, nowMs = Date.now()) {
  const dueMs = parseDueMs(dueAt);
  if (dueMs === null) return null;
  return (dueMs - nowMs) / (1000 * 60 * 60);
}

// ── Realistic time estimation ─────────────────────────────────────────────────
// Uses assignment title keywords, points, and type to guess effort in minutes.

export function estimateMinutes(assignment) {
  const title = (assignment.title || "").toLowerCase();
  const points = typeof assignment.points === "number" ? assignment.points : 0;
  const type = (assignment.type || "").toLowerCase();

  // TA grading tasks — usually quick per-student
  if (type === "grading") return 20;

  // Keyword-based estimates (order matters — more specific first)
  if (/quiz|quizz/.test(title)) return 20;
  if (/exam|midterm|final/.test(title)) return 120;
  if (/lab report|write.?up|writeup/.test(title)) return 90;
  if (/lab/.test(title)) return 60;
  if (/homework|hw\b/.test(title)) {
    // Scale by points: low points = short, high points = long
    if (points >= 50) return 90;
    if (points >= 20) return 60;
    return 45;
  }
  if (/project|proposal/.test(title)) return 120;
  if (/essay|paper|report/.test(title)) return 90;
  if (/reading|read\b/.test(title)) return 30;
  if (/discussion|post|response/.test(title)) return 25;
  if (/reflection/.test(title)) return 20;
  if (/presentation|slides/.test(title)) return 60;
  if (/signup|sign.?up|select|choose|pick/.test(title)) return 10;
  if (/survey|feedback|form/.test(title)) return 10;
  if (/watch|video/.test(title)) return 30;
  if (/summary/.test(title)) return 30;
  if (/worksheet/.test(title)) return 40;
  if (/problem.?set|pset/.test(title)) return 75;
  if (/calculation|calc/.test(title)) return 60;
  if (/information|info\b|syllabus/.test(title)) return 15;

  // Fall back to points-based estimate
  if (points >= 100) return 120;
  if (points >= 50)  return 75;
  if (points >= 20)  return 50;
  if (points >= 10)  return 35;
  if (points > 0)    return 25;

  // No clues — default to 40 min
  return 40;
}

// ── Week stress analysis ──────────────────────────────────────────────────────

export function analyzeWeekStress(assignments, nowMs = Date.now()) {
  const weekEnd = nowMs + 7 * 24 * 3600000;

  const thisWeek = assignments.filter(a => {
    const due = parseDueMs(a.dueAt);
    return due && due >= nowMs && due <= weekEnd && a.status !== "done";
  });

  const totalMinutes = thisWeek.reduce((sum, a) => sum + estimateMinutes(a), 0);
  const count = thisWeek.length;

  // Count high-stakes items
  const highStake = thisWeek.filter(a => {
    const title = (a.title || "").toLowerCase();
    return /exam|midterm|final|project|paper|essay/.test(title) ||
      (typeof a.points === "number" && a.points >= 50);
  }).length;

  let level, message;

  if (count === 0) {
    level = "calm";
    message = "Clear week ahead — great time to get ahead on future work 🌿";
  } else if (totalMinutes <= 120 && highStake === 0) {
    level = "light";
    message = `Light week — about ${Math.round(totalMinutes / 60 * 10) / 10}h of work across ${count} assignment${count !== 1 ? "s" : ""} 🌱`;
  } else if (totalMinutes <= 300 && highStake <= 1) {
    level = "moderate";
    message = `Moderate week — ~${Math.round(totalMinutes / 60 * 10) / 10}h of work, stay consistent 📚`;
  } else if (totalMinutes <= 600 || highStake <= 2) {
    level = "busy";
    message = `Busy week — ~${Math.round(totalMinutes / 60 * 10) / 10}h of work${highStake > 0 ? `, including ${highStake} high-stakes item${highStake !== 1 ? "s" : ""}` : ""} ⚡`;
  } else {
    level = "intense";
    message = `Intense week — ~${Math.round(totalMinutes / 60 * 10) / 10}h of work with ${highStake} major item${highStake !== 1 ? "s" : ""}. Prioritize carefully 🔥`;
  }

  return { level, message, totalMinutes, count, highStake, thisWeek };
}

// ── Meta ──────────────────────────────────────────────────────────────────────

export function applyMeta(assignments, metaById = {}) {
  return assignments.map((a) => {
    const id = a.assignmentId;
    const meta = (id != null && metaById[id]) ? metaById[id] : {};
    return {
      ...a,
      status: meta.status ?? "not_started",
      estimatedMinutes: meta.estimatedMinutes ?? estimateMinutes(a),
      priorityHint: meta.priorityHint ?? "normal",
      pinned: meta.pinned ?? false,
    };
  });
}

export function priorityWeight(priorityHint) {
  switch (priorityHint) {
    case "high": return 3;
    case "low":  return 1;
    default:     return 2;
  }
}

// ── Risk score ────────────────────────────────────────────────────────────────

export function riskScore(a, nowMs = Date.now()) {
  if (a.pinned) return 10000;
  if (a.status === "done") return -10000;

  const h = hoursUntilDue(a.dueAt, nowMs);
  const pw = priorityWeight(a.priorityHint);

  // Boost high-stakes assignments
  const title = (a.title || "").toLowerCase();
  const isHighStake = /exam|midterm|final|project|paper|essay/.test(title) ||
    (typeof a.points === "number" && a.points >= 50);
  const stakeBonus = isHighStake ? 200 : 0;

  if (h === null) return 50 + pw * 10;
  if (h < 0)     return 9000 + pw * 50 + stakeBonus;
  if (h <= 24)   return 8000 + pw * 50 + stakeBonus;
  if (h <= 72)   return 5000 + pw * 30 + stakeBonus;
  if (h <= 168)  return 2000 + pw * 20 + stakeBonus;
  return 500 + pw * 15 + stakeBonus;
}

// ── Flags ─────────────────────────────────────────────────────────────────────

export function getFlags(a, nowMs = Date.now()) {
  const flags = [];
  if (a.status === "done") return flags;

  const h = hoursUntilDue(a.dueAt, nowMs);

  if (h === null) {
    flags.push({ assignmentId: a.assignmentId, type: "NO_DUE_DATE", severity: 1, message: "No due date found." });
    return flags;
  }

  if (h < 0) {
    flags.push({ assignmentId: a.assignmentId, type: "OVERDUE", severity: 3, message: `Overdue by ${Math.ceil(Math.abs(h))} hour(s).` });
  } else if (h <= 24) {
    flags.push({ assignmentId: a.assignmentId, type: "DUE_SOON", severity: 2, message: "Due within 24 hours." });
  } else if (h <= 72) {
    flags.push({ assignmentId: a.assignmentId, type: "DUE_IN_3_DAYS", severity: 1, message: "Due within 3 days." });
  }

  if (a.hasSubmitted) {
    flags.push({ assignmentId: a.assignmentId, type: "SUBMISSION_EXISTS", severity: 0, message: "Canvas shows a submission exists." });
  }

  if (a.pinned) {
    flags.push({ assignmentId: a.assignmentId, type: "PINNED", severity: 0, message: "Pinned by you." });
  }

  return flags;
}

export function buildFlagsMap(assignments, nowMs = Date.now()) {
  const map = {};
  for (const a of assignments) {
    const id = a.assignmentId;
    if (id == null) continue;
    map[id] = getFlags(a, nowMs);
  }
  return map;
}

// ── Today's Plan ──────────────────────────────────────────────────────────────
// Smarter planning: uses realistic estimates, respects stress level,
// splits large tasks into chunks, and explains why each task is suggested.

export function suggestTodayPlan(assignments, minutesAvailable = 180, nowMs = Date.now()) {
  const stress = analyzeWeekStress(assignments, nowMs);

  // Adjust available time based on stress — on intense weeks, plan more
  const adjustedMinutes = stress.level === "intense" ? Math.max(minutesAvailable, 240)
    : stress.level === "busy" ? Math.max(minutesAvailable, 180)
    : minutesAvailable;

  const candidates = assignments
    .filter(a => a.status !== "done")
    .slice()
    .sort((a, b) => riskScore(b, nowMs) - riskScore(a, nowMs));

  const plan = [];
  let remaining = adjustedMinutes;

  for (const a of candidates) {
    if (remaining <= 0) break;
    if (a.assignmentId == null) continue;

    const est = a.estimatedMinutes ?? estimateMinutes(a);
    const h = hoursUntilDue(a.dueAt, nowMs);

    // For large tasks (>60 min), suggest a focused chunk rather than the whole thing
    let chunk;
    if (est <= 30) {
      chunk = est; // do it fully
    } else if (est <= 60) {
      chunk = Math.min(est, remaining);
    } else {
      // Big task — suggest a meaningful chunk (45–90 min)
      chunk = Math.min(90, Math.max(45, Math.floor(est * 0.4)), remaining);
    }

    chunk = Math.min(chunk, remaining);
    if (chunk < 10) break;

    // Build a specific, helpful reason
    let reason;
    const title = (a.title || "").toLowerCase();
    const isExam = /exam|midterm|final/.test(title);
    const isProject = /project|paper|essay/.test(title);

    if (a.pinned) {
      reason = "You pinned this as a priority.";
    } else if (h !== null && h < 0) {
      reason = `This is overdue by ${Math.ceil(Math.abs(h))}h — submit something now.`;
    } else if (h !== null && h <= 6) {
      reason = `Due in ${Math.ceil(h)}h — finish this first!`;
    } else if (h !== null && h <= 24) {
      reason = `Due tomorrow — don't leave it for tonight.`;
    } else if (h !== null && h <= 48) {
      reason = `Due in ~${Math.round(h)}h — get a head start today.`;
    } else if (isExam) {
      reason = `Exam coming up — even ${chunk} min of review helps retention.`;
    } else if (isProject) {
      reason = `Large project — break ground early to avoid last-minute stress.`;
    } else if (est > 60) {
      reason = `This is a bigger task (~${est} min total) — start with a focused block.`;
    } else {
      reason = `Scheduled this week — knock it out while you have momentum.`;
    }

    plan.push({
      assignmentId: a.assignmentId,
      title: a.title,
      minutes: chunk,
      totalEstimate: est,
      reason,
      isPartial: chunk < est,
    });

    remaining -= chunk;
  }

  return { plan, stress };
}