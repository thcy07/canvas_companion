// frontend/src/Footer.jsx

import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer
      style={{
        padding: "1rem",
        textAlign: "center",
        backgroundColor: "#f0f0f0",
        borderTop: "1px solid #ccc",
        marginTop: "40px",
        color: "#111",
      }}
    >
      <h5 style={{ margin: 0 }}>
        Need help getting your calendar set up? Check out the{" "}
        <Link to="/walkthrough" style={{ color: "#007bff", textDecoration: "none" }}>
          help guide
        </Link>
        .
      </h5>
    </footer>
  );
}