// server.js

import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import webpush from "web-push";
import cron from "node-cron";
import mongoose from "mongoose";
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ─── Encryption helpers ───────────────────────────────────────────────────────

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const key = Buffer.from(process.env.ENCRYPTION_SECRET.padEnd(32).slice(0, 32));
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(data) {
  const [ivHex, tagHex, encryptedHex] = data.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const key = Buffer.from(process.env.ENCRYPTION_SECRET.padEnd(32).slice(0, 32));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

// ─── JWT helper ───────────────────────────────────────────────────────────────

function signToken(userId) {
  return jwt.sign({ userId: String(userId) }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }
  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token expired or invalid" });
  }
}

// ─── MongoDB Schema ───────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  canvasUrl: { type: String },
  encryptedToken: { type: String },
  pushSubscription: { type: Object },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);

// ─── Configure VAPID ─────────────────────────────────────────────────────────

webpush.setVapidDetails(
  process.env.VAPID_MAILTO,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// ─── Canvas fetch helpers ─────────────────────────────────────────────────────

async function fetchAllPages(url, canvasToken) {
  const results = [];
  let nextUrl = url;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${canvasToken}` },
    });
    if (!res.ok) break;

    const data = await res.json();
    if (Array.isArray(data)) results.push(...data);

    const link = res.headers.get("link") || "";
    const match = link.match(/<([^>]+)>;\s*rel="next"/);
    nextUrl = match ? match[1] : null;
  }

  return results;
}

// Detect if a course enrollment makes this user a TA/teacher (not a student)
function isTACourse(course) {
  if (!course.enrollments) return false;
  return course.enrollments.some(e =>
    ["ta", "teacher", "designer"].includes((e.type || "").toLowerCase())
  );
}

async function fetchAssignmentsFromCourses(baseUrl, canvasToken, days) {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + days);

  // Get active courses with enrollment info
  const courses = await fetchAllPages(
    `${baseUrl}/api/v1/courses?enrollment_state=active&include[]=enrollments&per_page=100`,
    canvasToken
  );

  if (!courses.length) return [];

  const assignmentArrays = await Promise.all(
    courses.map(async (course) => {
      const isTA = isTACourse(course);
      try {
        const assignments = await fetchAllPages(
          `${baseUrl}/api/v1/courses/${course.id}/assignments?per_page=100&order_by=due_at&bucket=future`,
          canvasToken
        );
        return assignments
          .filter(a => {
            if (!a.due_at) return false;
            const due = new Date(a.due_at);
            return due >= now && due <= end;
          })
          .map(a => ({
            // Mark as "grading" if user is a TA/teacher in this course
            type: isTA ? "grading" : "submitting",
            course_id: course.id,
            context_name: course.name || course.course_code || "Unknown course",
            assignment: {
              id: a.id,
              name: a.name,
              due_at: a.due_at,
              points_possible: a.points_possible,
              html_url: a.html_url,
              description: a.description || "",
              has_submitted_submissions: a.has_submitted_submissions,
            },
          }));
      } catch {
        return [];
      }
    })
  );

  // Flatten and deduplicate by assignment id
  const seen = new Set();
  const all = [];
  for (const arr of assignmentArrays) {
    for (const item of arr) {
      const id = item.assignment?.id;
      if (id && !seen.has(id)) {
        seen.add(id);
        all.push(item);
      }
    }
  }

  all.sort((a, b) => {
    const da = new Date(a.assignment?.due_at || 0).getTime();
    const db = new Date(b.assignment?.due_at || 0).getTime();
    return da - db;
  });

  return all;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "healthy",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/vapid-public-key", (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// ─── Get Canvas Name ──────────────────────────────────────────────────────────
app.get("/api/canvas-name", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !user.encryptedToken || !user.canvasUrl) {
      return res.status(401).json({ error: "Credentials missing" });
    }

    const canvasToken = decrypt(user.encryptedToken);
    const baseUrl = user.canvasUrl;

    const response = await fetch(`${baseUrl}/api/v1/users/self`, {
      headers: { Authorization: `Bearer ${canvasToken}` },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: "Canvas API error" });
    }

    const data = await response.json();
    
    res.json({ canvasName: data.short_name || data.name });
    
  } catch (err) {
    console.error("Canvas Name Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Auth: Sign Up ────────────────────────────────────────────────────────────

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password, canvasUrl, canvasToken, pushSubscription } = req.body;

    if (!email || !password || !canvasUrl || !canvasToken) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const normalizedUrl = canvasUrl.replace(/\/$/, "");

    const testRes = await fetch(`${normalizedUrl}/api/v1/users/self`, {
      headers: { Authorization: `Bearer ${canvasToken}` },
    });
    if (!testRes.ok) {
      return res.status(401).json({ error: "Invalid Canvas URL or API token. Please check and try again." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const encryptedToken = encrypt(canvasToken);

    const user = await User.create({
      email: email.toLowerCase().trim(),
      passwordHash,
      canvasUrl: normalizedUrl,
      encryptedToken,
      pushSubscription: pushSubscription || null,
    });

    const token = signToken(user._id);
    res.json({ ok: true, token, canvasUrl: normalizedUrl });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Server error", details: String(err) });
  }
});

// ─── Auth: Sign In ────────────────────────────────────────────────────────────

app.post("/api/auth/signin", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken(user._id);
    const canvasToken = user.encryptedToken ? decrypt(user.encryptedToken) : null;

    res.json({ ok: true, token, canvasUrl: user.canvasUrl, canvasToken });
  } catch (err) {
    console.error("Signin error:", err);
    res.status(500).json({ error: "Server error", details: String(err) });
  }
});

// ─── Auth: Update push subscription ──────────────────────────────────────────

app.post("/api/auth/update-push", verifyToken, async (req, res) => {
  try {
    const { pushSubscription } = req.body;
    await User.findByIdAndUpdate(req.user.userId, { pushSubscription, updatedAt: new Date() });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Server error", details: String(err) });
  }
});

// ─── Legacy register route ────────────────────────────────────────────────────

app.post("/api/register", async (req, res) => {
  try {
    const { canvasUrl, canvasToken, pushSubscription } = req.body;

    if (!canvasUrl || !canvasToken || !pushSubscription) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const normalizedUrl = canvasUrl.replace(/\/$/, "");

    const testRes = await fetch(`${normalizedUrl}/api/v1/users/self`, {
      headers: { Authorization: `Bearer ${canvasToken}` },
    });

    if (!testRes.ok) {
      return res.status(401).json({ error: "Invalid Canvas URL or API token." });
    }

    const encryptedToken = encrypt(canvasToken);

    await User.findOneAndUpdate(
      { "pushSubscription.endpoint": pushSubscription.endpoint },
      { canvasUrl: normalizedUrl, encryptedToken, pushSubscription, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error", details: String(err) });
  }
});

// ─── Assignments ──────────────────────────────────────────────────────────────

app.get("/api/assignments", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !user.encryptedToken || !user.canvasUrl) {
      return res.status(401).json({ error: "User not found or Canvas credentials missing." });
    }

    const canvasToken = decrypt(user.encryptedToken);
    const baseUrl = user.canvasUrl;

    const queryDays = req.query.days ? parseInt(req.query.days, 10) : NaN;
    const days = Number.isFinite(queryDays) ? queryDays : 90;

    const assignments = await fetchAssignmentsFromCourses(baseUrl, canvasToken, days);
    res.json(assignments);
  } catch (err) {
    console.error("Assignments error:", err);
    res.status(500).json({ error: "Server error", details: String(err) });
  }
});

// ─── Cron ─────────────────────────────────────────────────────────────────────

async function getDueSoonForUser(canvasUrl, canvasToken) {
  try {
    return await fetchAssignmentsFromCourses(canvasUrl, canvasToken, 1);
  } catch {
    return [];
  }
}

async function runCron() {
  console.log("[cron] Checking due-soon assignments for all users...");

  let users;
  try {
    users = await User.find({ encryptedToken: { $exists: true }, pushSubscription: { $exists: true } });
  } catch (err) {
    console.error("[cron] Failed to fetch users from DB:", err.message);
    return;
  }

  if (!users.length) { console.log("[cron] No users registered yet."); return; }
  console.log(`[cron] Processing ${users.length} user(s)...`);

  for (const user of users) {
    try {
      if (!user.encryptedToken || !user.pushSubscription) continue;
      const canvasToken = decrypt(user.encryptedToken);
      const dueSoon = await getDueSoonForUser(user.canvasUrl, canvasToken);
      // Only notify for student assignments, not TA grading tasks
      const studentOnly = dueSoon.filter(i => i.type !== "grading" && !i.assignment?.has_submitted_submissions);
      if (!studentOnly.length) continue;

      for (const item of studentOnly) {
        const title = item.assignment?.name || "Assignment due soon";
        const dueAt = new Date(item.assignment?.due_at || item.due_at);
        const hoursLeft = ((dueAt - Date.now()) / 3600000).toFixed(1);

        try {
          await webpush.sendNotification(
            user.pushSubscription,
            JSON.stringify({
              title: `⏰ Due in ${hoursLeft}h: ${title}`,
              body: `Course: ${item.context_name || "Unknown"}`,
              url: item.assignment?.html_url || "/",
            })
          );
          console.log(`[cron] Notified user ${user._id} about: ${title}`);
        } catch (err) {
          if (err.statusCode === 410) {
            console.log("[cron] Subscription expired, clearing.");
            await User.findByIdAndUpdate(user._id, { pushSubscription: null });
          } else {
            console.error("[cron] Push failed:", err.message);
          }
        }
      }
    } catch (err) {
      console.error(`[cron] Error processing user ${user._id}:`, err.message);
    }
  }
}

// ─── Connect to MongoDB ───────────────────────────────────────────────────────

mongoose.connect(process.env.MONGODB_URI, {
  tls: true,
  tlsAllowInvalidCertificates: false,
})
  .then(() => {
    console.log("Connected to MongoDB Atlas");
    cron.schedule("*/15 * * * *", runCron);
    console.log("[cron] Scheduler started (every 15 min)");
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });