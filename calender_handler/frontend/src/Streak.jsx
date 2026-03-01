import { useState } from "react";

export default function Streak() {
  const [streakCount, setStreakCount] = useState(5); // Example streak count, replace with actual logic to calculate streak

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 20, fontFamily: "system-ui" }}>
      <h1 style={{ margin: 0 }}>Streak</h1>
      <p style={{ fontSize: 18, color: "#555" }}>Your current streak of days with at least one completed task.</p>
      <div style={{ fontSize: 48, fontWeight: "bold", color: "#4caf50" }}>{streakCount}</div>
    </div>
  );
}