"use client";

import { useState, useEffect } from "react";

export default function Gate({ children }) {
  const [pass, setPass] = useState(null);
  const [input, setInput] = useState("");
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    setPass(localStorage.getItem("hsp_pass") || "");
    if (localStorage.getItem("hsp_auth_error")) {
      setAuthError(true);
      localStorage.removeItem("hsp_auth_error");
    }
  }, []);

  if (pass === null) return null;

  if (pass === "") {
    function handleSubmit(e) {
      e.preventDefault();
      const v = input.trim();
      if (!v) return;
      setAuthError(false);
      localStorage.setItem("hsp_pass", v);
      setPass(v);
    }

    return (
      <div style={{ minHeight: "100vh", background: "#e9ddc9", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          background: "#f4ece0",
          borderRadius: 16,
          padding: "2rem 2.25rem",
          boxShadow: "0 2px 12px rgba(26,22,20,0.12)",
          maxWidth: 340,
          width: "100%",
          fontFamily: "'Iowan Old Style', Georgia, serif",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: "#13494a", marginBottom: 6 }}>
            Hebrew Story Partner
          </div>
          <div style={{ fontSize: 13, color: "rgba(26,22,20,0.55)", marginBottom: 20 }}>
            Enter your passphrase to continue.
          </div>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="password"
              value={input}
              onChange={(e) => { setInput(e.target.value); setAuthError(false); }}
              placeholder="passphrase"
              autoFocus
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #d8c5a6",
                background: "#fff",
                fontSize: 15,
                outline: "none",
                fontFamily: "Georgia, serif",
                textAlign: "center",
              }}
            />
            {authError && (
              <div style={{ fontSize: 13, color: "#8f4427", fontFamily: "Georgia, serif" }}>
                Passphrase rejected — try again.
              </div>
            )}
            <button
              type="submit"
              style={{
                background: "#b9603a",
                color: "#f4ece0",
                border: "none",
                borderRadius: 10,
                padding: "10px",
                fontSize: 15,
                cursor: "pointer",
                fontFamily: "Georgia, serif",
              }}
            >
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  return children;
}
