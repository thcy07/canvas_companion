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

// ─── Encryption helpers (AES-256-GCM) ────────────────────────────────────────

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

// ─── AI Plan prompt builder ───────────────────────────────────────────────────

function urgencyLabel(dueAt) {
  if (!dueAt) return "no due date";
  const h = (Date.parse(dueAt) - Date.now()) / 3600000;
  if (!Number.isFinite(h)) return "no due date";
  if (h < 0) return "OVERDUE";
  if (h <= 24) return "due within 24 hours";
  if (h <= 72) return "due within 3 days";
  if (h <= 168) return "due within a week";
  return `due in ${Math.round(h / 24)} days`;
}

function buildPlanPrompt(assignments) {
  const list = assignments
    .filter(a => a.status !== "done")
    .map((a, i) => {
      const urgency = urgencyLabel(a.dueAt);
      const desc = a.description ? `\n   Description: "${String(a.description).slice(0, 300)}"` : "";
      return `${i + 1}. "${a.title}" (${a.courseName}) — ${urgency}${desc}`;
    })
    .join("\n");

  return `You are a friendly academic planner. A student has these upcoming Canvas assignments:

${list}

Your job: create a focused "Today's Plan" — a short prioritized list of work blocks the student should do TODAY.

Rules:
- Read any description text carefully — it often says how long the assignment takes or what's involved.
- Prioritize by urgency (overdue first, then due soon), but factor in estimated effort from descriptions.
- Suggest 3–5 work blocks. Each block: a task name, estimated minutes, and a 1-sentence reason.
- Be specific and encouraging. If a description says "10-minute quiz," say 10 minutes.
- Keep each block concise. Output ONLY valid JSON — no markdown, no explanation.

Format:
[
  { "title": "...", "minutes": 30, "reason": "..." }
]`;
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

// Serve VAPID public key to frontend
app.get("/api/vapid-public-key", (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
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
      return res.status(401).json({ error: "Invalid Canvas URL or API token. Please check and try again." });
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
      return res.status(401).json({ error: "User not found or Canvas credentials missing. Please sign in again." });
    }

    const canvasToken = decrypt(user.encryptedToken);
    const baseUrl = user.canvasUrl;

    const queryDays = req.query.days ? parseInt(req.query.days, 10) : NaN;
    const days = Number.isFinite(queryDays) ? queryDays : 31;

    const url = `${baseUrl}/api/v1/users/self/todo?per_page=10000`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${canvasToken}` },
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: "Canvas API request failed", details: text });
    }

    const data = await response.json();

    const parseDue = (item) => {
      if (!item) return null;
      if (item.due_at) return new Date(item.due_at);
      if (item.assignment?.due_at) return new Date(item.assignment.due_at);
      if (item.submission?.due_at) return new Date(item.submission.due_at);
      return null;
    };

    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + days);

    const filtered = Array.isArray(data)
      ? data.filter((item) => { const due = parseDue(item); return due && due >= now && due <= end; })
      : [];

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: "Server error", details: String(err) });
  }
});

// ─── AI Plan ─────────────────────────────────────────────────────────────────

app.post("/api/ai-plan", verifyToken, async (req, res) => {
  try {
    const { assignments } = req.body;

    if (!assignments || !Array.isArray(assignments)) {
      return res.status(400).json({ error: "assignments array required" });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured on server" });
    }

    const prompt = buildPlanPrompt(assignments);

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error("[ai-plan] Anthropic error:", text);
      return res.status(502).json({ error: "Anthropic API error", details: text });
    }

    const data = await aiRes.json();
    const raw = data.content?.find(b => b.type === "text")?.text || "[]";
    const clean = raw.replace(/```json|```/g, "").trim();

    let plan;
    try {
      plan = JSON.parse(clean);
    } catch {
      console.error("[ai-plan] Failed to parse JSON:", clean);
      return res.status(502).json({ error: "Failed to parse AI response" });
    }

    res.json(plan);
  } catch (err) {
    console.error("[ai-plan] Error:", err);
    res.status(500).json({ error: "AI plan failed", details: String(err) });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getDueSoonForUser(canvasUrl, canvasToken) {
  const response = await fetch(`${canvasUrl}/api/v1/users/self/todo?per_page=100`, {
    headers: { Authorization: `Bearer ${canvasToken}` },
  });
  if (!response.ok) return [];
  const data = await response.json();
  const now = Date.now();
  const in24h = now + 24 * 60 * 60 * 1000;

  return data.filter((item) => {
    const dueAt = item.assignment?.due_at || item.due_at;
    if (!dueAt) return false;
    const dueMs = new Date(dueAt).getTime();
    return dueMs > now && dueMs <= in24h;
  });
}

// ─── Cron ─────────────────────────────────────────────────────────────────────

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
      if (!dueSoon.length) continue;

      for (const item of dueSoon) {
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
            console.log("[cron] Subscription expired, clearing push subscription.");
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

// ─── Connect to MongoDB, then start cron + server ────────────────────────────

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