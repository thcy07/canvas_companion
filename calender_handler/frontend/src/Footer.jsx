import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer>
      <div style={{ fontSize: "1.2rem", marginBottom: 6 }}>🌿</div>
      <p style={{ margin: 0, color: "#7a5c4a" }}>
        Need help? Check out the{" "}
        <Link to="/help" style={{ color: "#4e6b4a", textDecoration: "underline" }}>
          help guide
        </Link>.
      </p>
      <ul className="footer-links">
        <li className="footer-link"><Link to="/">Canvas Companion</Link></li>
        <li className="footer-link" style={{ color: "#d4b896" }}>·</li>
        <li className="footer-link">
          <span
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ cursor: "pointer", color: "#7a5c4a" }}
          >
            Sign Out
          </span>
        </li>
      </ul>
      <p style={{ margin: "12px 0 0", fontSize: "0.75rem", color: "#b0956f" }}>
        © 2026 Canvas Companion · Made with 🌸
      </p>
    </footer>
  );
}