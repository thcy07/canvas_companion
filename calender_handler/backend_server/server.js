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
    // You can tweak query params later.
    const url =
      `${baseUrl}/api/v1/users/self/todo` +
      `?per_page=50`;

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
    res.json(data);
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
