import { useState } from "react";

export default function Streak() {
  const [streakCount] = useState(5);

  return (
    <div style={{ padding: "8px 4px" }}>
      <div style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: "1.5rem", fontWeight: 800, color: "#fff",
        marginBottom: 8, display: "flex", alignItems: "center", gap: 6,
        justifyContent: "center", textShadow: "2px 2px 5px rgba(0, 0, 0, 0.5)",
      }}>
        🔥 Streak
      </div>
      <div style={{
        fontSize: "3rem", fontWeight: 800,
        fontFamily: "'Playfair Display', Georgia, serif",
        color: "yellow", lineHeight: 1, textShadow: "2px 2px 5px rgba(0, 0, 0, 0.5)"
      }}>
        {streakCount}
      </div>
      <div style={{ fontSize: "1 rem", color: "#fff", marginTop: 6, fontStyle: "italic" , textShadow: "2px 2px 5px rgba(0, 0, 0, 0.5)"}}>
        days with a completed task
      </div>
    </div>
  );
}