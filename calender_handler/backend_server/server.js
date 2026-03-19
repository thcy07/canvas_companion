// server.js

import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import webpush from "web-push";
import cron from "node-cron";
import mongoose from "mongoose";
import crypto from "crypto";

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

// ─── MongoDB Schema ───────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
  canvasUrl: { type: String, required: true },
  encryptedToken: { type: String, required: true },
  pushSubscription: { type: Object, required: true },
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

// Register a user: save encrypted Canvas token + push subscription
app.post("/api/register", async (req, res) => {
  try {
    const { canvasUrl, canvasToken, pushSubscription } = req.body;

    if (!canvasUrl || !canvasToken || !pushSubscription) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const normalizedUrl = canvasUrl.replace(/\/$/, "");

    // Verify the token works before saving
    const testRes = await fetch(`${normalizedUrl}/api/v1/users/self`, {
      headers: { Authorization: `Bearer ${canvasToken}` },
    });

    if (!testRes.ok) {
      return res.status(401).json({ error: "Invalid Canvas URL or API token. Please check and try again." });
    }

    const encryptedToken = encrypt(canvasToken);

    await User.findOneAndUpdate(
      { "pushSubscription.endpoint": pushSubscription.endpoint },
      {
        canvasUrl: normalizedUrl,
        encryptedToken,
        pushSubscription,
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error", details: String(err) });
  }
});

// Fetch assignments from Canvas
app.get("/api/assignments", async (req, res) => {
  try {
    const baseUrl = process.env.BASE_URL;
    const token = process.env.API_TOKEN;

    if (!baseUrl || !token) {
      return res.status(500).json({ error: "Missing BASE_URL or API_TOKEN in .env" });
    }

    const queryDays = req.query.days ? parseInt(req.query.days, 10) : NaN;
    const envDays = process.env.ASSIGNMENT_DAYS ? parseInt(process.env.ASSIGNMENT_DAYS, 10) : NaN;
    const days = Number.isFinite(queryDays) ? queryDays : Number.isFinite(envDays) ? envDays : 30;

    const url = `${baseUrl}/api/v1/users/self/todo?per_page=100`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
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

// ─── Cron helper ─────────────────────────────────────────────────────────────

async function runCron() {
  console.log("[cron] Checking due-soon assignments for all users...");

  let users;
  try {
    users = await User.find({});
  } catch (err) {
    console.error("[cron] Failed to fetch users from DB:", err.message);
    return;
  }

  if (!users.length) {
    console.log("[cron] No users registered yet.");
    return;
  }

  console.log(`[cron] Processing ${users.length} user(s)...`);

  for (const user of users) {
    try {
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
            console.log("[cron] Subscription expired, removing user.");
            await User.deleteOne({ _id: user._id });
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

    // Start cron ONLY after DB is ready
    cron.schedule("*/15 * * * *", runCron);
    console.log("[cron] Scheduler started (every 1 min for testing)");

    // Start server ONLY after DB is ready
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`Backend running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });