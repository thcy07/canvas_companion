import { useState } from "react";
import Footer from "./Footer";
import Streak from "./Streak";
import MonthlyView from "./MonthView";
import AI from "./AI";

export default function App() {
  return (
    <div style={{ display: "flex", flexDirection: "column", margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "20px 16px" }}>
        <div>
          <h1 style={{ margin: 0 }}>Canvas Assignment Tracker</h1>
          <p style={{ marginTop: 8, color: "#555" }}>
            Track all your assignments in one place
          </p>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, padding: "0 16px", marginBottom: 20 }}>
        <section style={{ backgroundColor: "blue", padding: 12, borderRadius: 10 }}>
          <MonthlyView />
        </section>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <section style={{ backgroundColor: "red", padding: 12, borderRadius: 10 }}>
            <Streak />
          </section>
          <section style={{ backgroundColor: "yellow", padding: 12, borderRadius: 10 }}>
            <AI />
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
}
