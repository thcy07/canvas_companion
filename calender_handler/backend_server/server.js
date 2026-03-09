// server.js

import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(express.json());

// Health route
app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    status: "healthy",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Example: prove .env is working (don't return secrets in real APIs)
app.get("/debug/env", (req, res) => {
  res.json({
    hasApiToken: Boolean(process.env.API_TOKEN),
    nodeEnv: process.env.NODE_ENV || "development",
  });
});

/**
 * ✅ GET /api/assignments
 * Fetch assignments from Canvas and return JSON to React.
 */
app.get("/api/assignments", async (req, res) => {
  try {
    const baseUrl = process.env.BASE_URL;
    const token = process.env.API_TOKEN;

    if (!baseUrl || !token) {
      return res.status(500).json({
        error: "Missing BASE_URL or API_TOKEN in .env",
      });
    }

    // This endpoint returns assignments across courses that the user can access.
    // Default to a 30-day window (configurable via `?days=` query or ASSIGNMENT_DAYS env var).
    const queryDays = req.query.days ? parseInt(req.query.days, 10) : NaN;
    const envDays = process.env.ASSIGNMENT_DAYS ? parseInt(process.env.ASSIGNMENT_DAYS, 10) : NaN;
    const days = Number.isFinite(queryDays)
      ? queryDays
      : Number.isFinite(envDays)
      ? envDays
      : 30;

    // Request a larger page size to ensure we retrieve enough items to filter.
    const url = `${baseUrl}/api/v1/users/self/todo?per_page=100`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
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

    // Helper to extract a due date from several possible Canvas shapes.
    const parseDue = (item) => {
      if (!item) return null;
      if (item.due_at) return new Date(item.due_at);
      if (item.assignment && item.assignment.due_at)
        return new Date(item.assignment.due_at);
      if (item.submission && item.submission.due_at)
        return new Date(item.submission.due_at);
      return null;
    };

    // Filter items to the requested date window if possible.
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + (Number.isFinite(days) ? days : 30));

    let filtered = data;
    if (Array.isArray(data)) {
      filtered = data.filter((item) => {
        const due = parseDue(item);
        return due && due >= now && due <= end;
      });
    } else if (data && Array.isArray(data.items)) {
      filtered = data.items.filter((item) => {
        const due = parseDue(item);
        return due && due >= now && due <= end;
      });
    }

    res.json(filtered);
  } catch (err) {
    res.status(500).json({
      error: "Server error",
      details: String(err),
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
