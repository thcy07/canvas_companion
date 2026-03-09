// frontend/src/Footer.jsx

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
        <a href="https://example.com/help" target="_blank" rel="noreferrer">
          help guide
        </a>
        .
      </h5>
    </footer>
  );
}