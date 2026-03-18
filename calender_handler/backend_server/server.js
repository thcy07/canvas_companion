// server.js

import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import webpush from "web-push";
import cron from "node-cron";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Configure VAPID
webpush.setVapidDetails(
  process.env.VAPID_MAILTO,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// In-memory subscription store (swap for a DB in production)
const subscriptions = new Set();

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    status: "healthy",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get("/debug/env", (req, res) => {
  res.json({
    hasApiToken: Boolean(process.env.API_TOKEN),
    nodeEnv: process.env.NODE_ENV || "development",
  });
});

// Serve VAPID public key to frontend
app.get("/api/vapid-public-key", (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Save push subscription from frontend
app.post("/api/subscribe", (req, res) => {
  const sub = req.body;
  subscriptions.add(JSON.stringify(sub));
  console.log("New subscription saved. Total:", subscriptions.size);
  res.json({ ok: true });
});

// Manual test reminder
app.get("/api/test-reminder", (req, res) => {
  res.json({
    title: "Assignment Due Soon",
    body: "Your Math assignment is due in 1 hour.",
    url: "/",
  });
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
      return res.status(response.status).json({
        error: "Canvas API request failed",
        status: response.status,
        details: text,
      });
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

    let filtered = Array.isArray(data)
      ? data.filter((item) => { const due = parseDue(item); return due && due >= now && due <= end; })
      : Array.isArray(data.items)
      ? data.items.filter((item) => { const due = parseDue(item); return due && due >= now && due <= end; })
      : [];

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: "Server error", details: String(err) });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getDueSoonAssignments() {
  const baseUrl = process.env.BASE_URL;
  const token = process.env.API_TOKEN;
  const response = await fetch(`${baseUrl}/api/v1/users/self/todo?per_page=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
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

// ─── Cron: every 15 minutes ───────────────────────────────────────────────────

cron.schedule("*/15 * * * *", async () => {
  console.log("[cron] Checking for due-soon assignments...");

  if (subscriptions.size === 0) {
    console.log("[cron] No subscribers, skipping.");
    return;
  }

  let dueSoon;
  try {
    dueSoon = await getDueSoonAssignments();
  } catch (err) {
    console.error("[cron] Failed to fetch assignments:", err.message);
    return;
  }

  if (!dueSoon.length) {
    console.log("[cron] No assignments due within 24h.");
    return;
  }

  console.log(`[cron] Found ${dueSoon.length} due-soon assignment(s). Notifying ${subscriptions.size} subscriber(s).`);

  for (const subStr of subscriptions) {
    const sub = JSON.parse(subStr);
    for (const item of dueSoon) {
      const title = item.assignment?.name || "Assignment due soon";
      const dueAt = new Date(item.assignment?.due_at || item.due_at);
      const hoursLeft = ((dueAt - Date.now()) / 3600000).toFixed(1);

      try {
        await webpush.sendNotification(
          sub,
          JSON.stringify({
            title: `⏰ Due in ${hoursLeft}h: ${title}`,
            body: `Course: ${item.context_name || "Unknown"}`,
            url: item.assignment?.html_url || "/",
          })
        );
      } catch (err) {
        if (err.statusCode === 410) {
          console.log("[cron] Removing expired subscription.");
          subscriptions.delete(subStr);
        } else {
          console.error("[cron] Push failed:", err.message);
        }
      }
    }
  }
});

// ─── Start server (ONE listen call) ──────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});