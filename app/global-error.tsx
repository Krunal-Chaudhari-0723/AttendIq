"use client";

/** Last-resort boundary for errors in the root layout (must render its own html/body). */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 16, boxSizing: "border-box", fontFamily: "Poppins, system-ui, sans-serif", background: "#f4f7fa", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <title>AttendIQ — Error</title>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderTop: "3px solid #fd6c40", borderRadius: 12, padding: 32, maxWidth: 420, width: "100%", boxSizing: "border-box", textAlign: "center", boxShadow: "0 4px 12px -2px rgba(1, 24, 43, 0.08)" }}>
          <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#003b65" }}>Bhagwan Mahavir University</p>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#01182b" }}>AttendIQ could not load</h2>
          <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>An unexpected error occurred. Please try again.</p>
          {error.digest && <p style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>Reference: {error.digest}</p>}
          <button onClick={() => retry()} style={{ background: "#003b65", color: "#fff", border: 0, borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
