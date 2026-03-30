import { useState } from "react";

export default function Streak() {
  const [streakCount] = useState(5);

  return (
    <div style={{ padding: "8px 4px" }}>
      <div style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: "1.1rem", fontWeight: 700, color: "#4e6b4a",
        marginBottom: 8, display: "flex", alignItems: "center", gap: 6,
        justifyContent: "center",
      }}>
        🔥 Streak
      </div>
      <div style={{
        fontSize: "3rem", fontWeight: 800,
        fontFamily: "'Playfair Display', Georgia, serif",
        color: "#7d9b76", lineHeight: 1,
      }}>
        {streakCount}
      </div>
      <div style={{ fontSize: "0.8rem", color: "#7a5c4a", marginTop: 6, fontStyle: "italic" }}>
        days with a completed task
      </div>
    </div>
  );
}