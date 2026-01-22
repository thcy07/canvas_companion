# Backend Server Setup – Process Notes

This document records the exact steps I followed to set up a basic backend server using **Node.js** and **Express**, along with environment variable handling and a test route.  
The goal was to get a **running backend server** and confirm it works.

---

## 1. Project Folder Setup

### 1.1 What I did — Project Folder Setup

- Created a new project folder to hold the backend server files.
- The folder can live anywhere convenient (e.g., Desktop, Documents, or Dropbox).
- The folder does **not** need to be in the C:\ root directory.

### 1.2 Why — Project Folder Setup

This keeps backend files organized and separate from other projects.

### 1.3 Result — Project Folder Setup

- A dedicated folder exists for the backend project.

---

## 2. Initialize a Node.js Project

### 2.1 What I did — Initialize a Node.js Project

```bash
npm init -y
```

### 2.2 Why — Initialize a Node.js Project

This creates a `package.json` file that tracks project metadata, dependencies, and scripts.

### 2.3 Result — Initialize a Node.js Project

A `package.json` file was generated automatically.

---

## 3. Install Required Dependencies

### 3.1 What I did — Install Required Dependencies

Installed Express and dotenv:

```bash
npm install express dotenv
```

### 3.2 Why — Install Required Dependencies

- `express` — web server framework  
- `dotenv` — loads environment variables from a `.env` file

### 3.3 Result — Install Required Dependencies

- `node_modules/` was created  
- `express` and `dotenv` were added to `package.json`

---

## 4. Create the Server File

### 4.1 What I did — Create the Server File

Created `server.js` with the following contents:

```js
// server.js
import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/health", (req, res) => {
    res.json({ ok: true });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
```

### 4.2 Why — Create the Server File

- Sets up an Express server  
- Loads environment variables via `dotenv`  
- Adds a `/health` route to verify the server

---

## 5. Configure ES Modules

### 5.1 What I did — Configure ES Modules

Edited `package.json` and added:

```json
{
    "type": "module"
}
```

### 5.2 Why — Configure ES Modules

Allows `import`/`export` (ES module) syntax instead of CommonJS `require`.

### 5.3 Result — Configure ES Modules

Node.js recognizes ES module syntax.

---

## 6. Create the .env File

### 6.1 What I did — Create the .env File

Created a file named `.env` with:

```env
PORT=3000
```

### 6.2 Why — Create the .env File

Keeps configuration out of source and lets you change ports or secrets per environment.

### 6.3 Important

- `.env` is a file (no filename, just the `.env` extension)  
- Do not commit `.env` to version control (add to `.gitignore`)

---

## 7. Start the Server

### 7.1 What I did — Start the Server

Ran:

```bash
node server.js
```

### 7.2 Result (terminal)

```
Server running on port 3000
```

---

## 8. Test the Server

### 8.1 What I did — Test the Server

Visited: http://localhost:3000/health

### 8.2 Result (response)

```json
{
    "ok": true
}
```

Meaning: server running, `/health` route works, Express routing functions correctly.

---

## 9. Current Project State

```
project-folder/
├── node_modules/
├── .env
├── package.json
├── package-lock.json
└── server.js
```

Status:
- ✅ Backend server is running
- ✅ Environment variables work  
- ✅ Health route confirmed

---

## 10. Summary

Node.js and Express are set up, environment variables are configured, and a basic `/health` endpoint confirms the backend foundation is ready for expansion.
