import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3001", // local dev
    },
  },
  define: {
    __API_URL__: JSON.stringify(
      process.env.NODE_ENV === "production"
        ? "https://canvascompanion-production.up.railway.app"
        : ""
    ),
  },
});