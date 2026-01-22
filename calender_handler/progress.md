# 📌 Project Integration Summary

Canvas API → Node/Express Backend → React (Vite) Frontend

---

## Architecture (High Level)

Separation of responsibilities:

- Backend (Node + Express)
  - Stores Canvas API token securely in `.env`
  - Calls Canvas API
  - Exposes clean endpoints (e.g. `/api/assignments`)
- Frontend (React + Vite)
  - UI only
  - Fetches data from the backend (never talks to Canvas directly)

Data flow:

```text
React (localhost:5173)
  ↓ fetch("/api/assignments")
Express backend (localhost:3000)
  ↓ Canvas API (with token)
Canvas
```

This is the correct and secure full-stack pattern.

---

## Tools, Software, and Dependencies Installed

This project required installing several tools and libraries across the backend and frontend. Each one served a specific purpose in the overall system.

### Core Development Tools

- Node.js  
  - What it is: JavaScript runtime used to run the backend server  
  - Why it was needed: Run Express, make HTTP requests to Canvas, manage dependencies with npm  
  - How it was used: Running the backend server and development scripts (e.g., `npm run dev`)

- npm (Node Package Manager)  
  - What it is: Package manager that comes with Node.js  
  - Why it was needed: Install backend and frontend dependencies, run scripts for development servers  
  - Examples used: `npm install`, `npm run dev`, `npm create vite@latest`

### Backend Dependencies (installed in `backend_server/`)

- Express  
  - What it is: Web server framework for Node.js  
  - Why it was needed: Create API routes like `/health` and `/api/assignments`; act as a secure middleman between React and Canvas  
  - Key responsibility: Serve JSON data to the frontend

- node-fetch  
  - What it is: HTTP client for Node.js  
  - Why it was needed: Node does not always include `fetch` by default; used to call the Canvas REST API from the backend  
  - Installed with: `npm install node-fetch`

- dotenv  
  - What it is: Environment variable loader  
  - Why it was needed: Keep the Canvas API token private and prevent committing secrets to GitHub  
  - Used for: `CANVAS_TOKEN`, `CANVAS_BASE_URL`, `PORT`

- nodemon  
  - What it is: Development tool that auto-restarts the server on file changes  
  - Why it was needed: Faster development without manual restarts  
  - Used via: `npm run dev`

### Frontend Tools (installed in `frontend/`)

- Vite  
  - What it is: Modern frontend build tool and dev server  
  - Why it was chosen: Faster than older tools (e.g., Create React App), simple configuration, industry-standard for modern React projects  
  - How it was installed: `npm create vite@latest frontend -- --template react`

- React  
  - What it is: JavaScript library for building user interfaces  
  - Why it was needed: Render assignment data and manage UI state (loading, errors, filtering, sorting)  
  - Key features used: `useState`, `useEffect`, component-based UI

- Vite Dev Server  
  - What it does: Runs the frontend on `localhost:5173` with hot reloads  
  - Why it mattered: Fast feedback loop and seamless proxying to backend

### Dev-Time Networking Configuration

- Vite Proxy  
  - Why required: Backend runs on port `3000` while frontend runs on port `5173` and browsers block cross-origin requests by default  
  - Solution implemented: Configure a proxy in `vite.config.js` so `fetch("/api/assignments")` works without CORS errors

### Files Created or Modified (Important)

- Backend
  - `server.js` – Express server + Canvas API logic
  - `.env` – API tokens and configuration
  - `package.json` – Added `"type": "module"` to enable ES modules

- Frontend
  - `vite.config.js` – Proxy configuration
  - `src/App.jsx` – Main React UI
  - `package.json` – Frontend dependencies and scripts

### Installation & Run Order (What to Do From Scratch)

- Backend
```bash
cd backend_server
npm install
npm run dev
```

- Frontend
```bash
cd frontend
npm install
npm run dev
```

Then open:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000/api/assignments`

### Why This Setup Matters (Reflection)

- Using separate frontend and backend folders mirrors real industry projects.  
- Keeping API tokens in `.env` follows security best practices.  
- Using Vite + React aligns with modern frontend workflows.  
- Understanding installation steps and dependencies simplifies debugging and maintenance.

---

## Key Technical Steps

### Backend setup
- Created Express server with a `/health` route.
- Added `/api/assignments` that calls Canvas: `GET /api/v1/users/self/todo`.
- Used `.env` for:
  - `CANVAS_TOKEN`
  - `CANVAS_BASE_URL`
  - `PORT`

### ES modules fix
- Problem: "SyntaxError: Cannot use import statement outside a module"
- Cause: Node defaulted to CommonJS while code used ES module syntax.
- Fix: add `"type": "module"` to `backend/package.json`.

### Frontend (React + Vite)
- Why Vite: fast, simple, modern standard.
- Folder structure:
  - `calender_handler/`
    - `backend_server/`
    - `frontend/`
- Vite dev proxy (important to avoid CORS). Example (`frontend/vite.config.js`):

```js
// vite.config.js (excerpt)
export default {
  server: {
    proxy: {
      "/api": "http://localhost:3000"
    }
  }
};
```

This allows `fetch("/api/assignments")` to work during development.

---

## Common Errors & Fixes

- "localhost refused to connect"
  - Cause: backend not running or wrong port
  - Fix: verify backend terminal and use correct URL `http://localhost:3000/api/assignments`

- Still seeing default Vite page
  - Cause: `frontend/src/App.jsx` not updated
  - Fix: edit `App.jsx`, Vite hot-reloads automatically

- Confusion about frontend folder
  - Clarification: run `npm create vite@latest frontend` from project root; run `npm run dev` inside frontend

---

## React Data Handling

- Fetch once via `useEffect`, store with `useState` (data, loading, error).
- Normalize Canvas responses to only use:
  - `assignment.name`
  - `context_name` (course)
  - `due_at`
  - `points_possible`
  - `html_url`
  - `needs_grading_count`

This keeps the UI lean and manageable.

---

## UI Enhancements

- Assignment cards show:
  - Name, course, due date, points, needs-grading count, link to Canvas
- Color coding by due date:
  - 🔴 Red: overdue or < 24 hours
  - 🟡 Yellow: 1–3 days
  - 🟢 Green: > 3 days
  - ⚪ Gray: no due date

Date logic computed client-side using `Date.now()`.

---

## How Many Assignments Are Pulled?

- Backend controls this with Canvas query params:
  - `/api/v1/users/self/todo?per_page=50` (increase to 100 if needed)
- Full pagination requires following Canvas "next page" headers (future improvement).

---

## Important Questions & Decisions

- Use React (not C++) for UI — correct architectural choice.
- Avoid experimental Vite features for stability.
- Debugging: read errors closely; small incremental tests (health route, JSON dump) are valuable.

---

## Core Takeaways

- Keep backend and frontend responsibilities separate.
- Never store API tokens in the frontend.
- Use a dev proxy for seamless local fetches.
- Normalize Canvas API responses before rendering.
- Incremental testing saves time and avoids cascading issues.
