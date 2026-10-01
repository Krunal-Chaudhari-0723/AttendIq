"use client";

/** Last-resort boundary for errors in the root layout (must render its own html/body). */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <title>AttendIQ — Error</title>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 32, maxWidth: 420, textAlign: "center" }}>
          <h2 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>AttendIQ could not load</h2>
          <p style={{ fontSize: 13, color: "#64748b" }}>An unexpected error occurred. Please try again.</p>
          {error.digest && <p style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>Reference: {error.digest}</p>}
          <button onClick={() => retry()} style={{ background: "#4f46e5", color: "#fff", border: 0, borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
