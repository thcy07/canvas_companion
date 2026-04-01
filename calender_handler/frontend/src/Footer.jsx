import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer>
      
      <ul className="footer-links">
        <li className="footer-link" style={{ color: "#1A4367" }}><Link to="/">Canvas Companion</Link></li>
        <li className="footer-link" style={{ color: "#1A4367" }}>·</li>
        <li className="footer-link">
          <span
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ cursor: "pointer", color: "#1A4367" }}
          >
            Sign Out
          </span>
        </li>
      </ul>
      <p style={{ margin: "12px 0 0", fontSize: "0.75rem", color: "#1A4367" }}>
        © 2026 Canvas Companion
      </p>
    </footer>
  );
}