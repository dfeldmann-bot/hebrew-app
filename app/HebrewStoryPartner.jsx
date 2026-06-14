"use client";

import React, { useState, useRef, useEffect } from "react";

// ── Hebrew Story Partner ──────────────────────────────────────────────
// A live, AI-powered conversation + interactive-story companion for a
// bet-level Hebrew learner reactivating listening comprehension.
// - Talks in Hebrew, adapts the story to your choices
// - Toggle how much English support you see
// - Tap any Hebrew word (or ask) for an explanation
// - Feed it your own vocabulary so stories reinforce what you're learning
// ──────────────────────────────────────────────────────────────────────

const PALETTE = {
  ink: "#1a1614",
  paper: "#f4ece0",
  paperDeep: "#e9ddc9",
  sand: "#d8c5a6",
  clay: "#b9603a",
  clayDeep: "#8f4427",
  olive: "#6b6233",
  sea: "#206b6b",
  seaDeep: "#13494a",
  gold: "#c8922a",
  faint: "rgba(26,22,20,0.55)",
};

const SUPPORT_LEVELS = [
  { id: "heavy", he: "הרבה עזרה", en: "Hebrew + full English", desc: "Every line translated" },
  { id: "light", he: "מעט עזרה", en: "Hebrew + light hints", desc: "Key words glossed" },
  { id: "none", he: "רק עברית", en: "Hebrew only", desc: "Sink-or-swim" },
];

const STARTERS = [
  { he: "ספר לי סיפור על בית קפה בתל אביב", en: "A café in Tel Aviv" },
  { he: "ספר לי סיפור מסתורי קצר", en: "A short mystery" },
  { he: "ספר לי סיפור על יום רגיל", en: "An ordinary day" },
  { he: "הפתע אותי", en: "Surprise me" },
];

const MODEL_LABELS = { gemini: "Gemini", groq: "Groq", openrouter: "OpenRouter" };

export default function HebrewStoryPartner() {
  const [support, setSupport] = useState("light");
  const [messages, setMessages] = useState([]); // {role, content}
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [vocab, setVocab] = useState(["רגע", "כבר", "משהו", "בית קפה"]);
  const [newWord, setNewWord] = useState("");
  const [started, setStarted] = useState(false);
  const [showVocab, setShowVocab] = useState(false);
  const [model, setModel] = useState("gemini");
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    try {
      const storedVocab = localStorage.getItem("hsp_vocab");
      const storedMessages = localStorage.getItem("hsp_messages");
      if (storedVocab) setVocab(JSON.parse(storedVocab));
      if (storedMessages) {
        const parsed = JSON.parse(storedMessages);
        setMessages(parsed);
        if (parsed.length > 0) setStarted(true);
      }
    } catch (_) {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem("hsp_vocab", JSON.stringify(vocab));
  }, [vocab, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem("hsp_messages", JSON.stringify(messages));
  }, [messages, hydrated]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  async function send(userText) {
    const text = (userText ?? input).trim();
    if (!text || loading) return;
    setInput("");
    setStarted(true);

    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const pass = localStorage.getItem("hsp_pass") || "";
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-passphrase": pass },
        body: JSON.stringify({
          support,
          vocab,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (res.status === 401) {
        localStorage.setItem("hsp_auth_error", "1");
        localStorage.removeItem("hsp_pass");
        location.reload();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const reply = (data.text || "").trim() || "…";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      if (data.model) setModel(data.model);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "אופס — משהו השתבש בחיבור. (Oops — connection issue. Check your signal and try again.)",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function explainWord(word) {
    send(`Explain the word "${word}" — meaning, root if useful, and a simple example. Then we can continue the story.`);
  }

  function addWord() {
    const w = newWord.trim();
    if (!w) return;
    setVocab((v) => [...new Set([...v, w])]);
    setNewWord("");
  }

  // Render a story segment: make Hebrew words tappable
  function renderSegment(content) {
    const lines = content.split("\n");
    return lines.map((line, li) => {
      const isGloss = line.trim().startsWith("↳");
      const tokens = line.split(/(\s+)/);
      return (
        <p
          key={li}
          dir={/[֐-׿]/.test(line) ? "rtl" : "ltr"}
          style={{
            margin: "0 0 0.5rem",
            fontSize: isGloss ? 14 : 17,
            lineHeight: 1.75,
            color: isGloss ? PALETTE.faint : PALETTE.ink,
            fontStyle: isGloss ? "italic" : "normal",
            fontFamily: /[֐-׿]/.test(line)
              ? "'Frank Ruhl Libre', 'David Libre', Georgia, serif"
              : "'Iowan Old Style', Georgia, serif",
          }}
        >
          {tokens.map((tok, ti) => {
            const isHebrewWord = /[֐-׿]/.test(tok) && !isGloss;
            if (isHebrewWord) {
              return (
                <span
                  key={ti}
                  onClick={() => explainWord(tok.replace(/[^֐-׿']/g, ""))}
                  style={{ cursor: "pointer", borderBottom: "1px dotted rgba(185,96,58,0.4)" }}
                  title="Tap to explain"
                >
                  {tok}
                </span>
              );
            }
            return <span key={ti}>{tok}</span>;
          })}
        </p>
      );
    });
  }

  return (
    <div
      style={{
        maxWidth: 640,
        margin: "0 auto",
        background: PALETTE.paper,
        borderRadius: 18,
        overflow: "hidden",
        fontFamily: "'Iowan Old Style', Georgia, serif",
        border: `1px solid ${PALETTE.sand}`,
        boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700&family=Amatic+SC:wght@700&display=swap"
        rel="stylesheet"
      />

      {/* Header */}
      <div
        style={{
          padding: "1.1rem 1.25rem 1rem",
          background: PALETTE.seaDeep,
          color: PALETTE.paper,
          position: "relative",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <div
              style={{
                fontFamily: "'Amatic SC', cursive",
                fontSize: 34,
                lineHeight: 1,
                letterSpacing: 0.5,
              }}
            >
              סיפור · story partner
            </div>
            <div style={{ fontSize: 12.5, opacity: 0.8, marginTop: 4, fontFamily: "Georgia, serif" }}>
              Your live Hebrew conversation companion
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, fontFamily: "Georgia, serif", fontSize: 11, opacity: 0.7 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: PALETTE.gold, display: "inline-block", flexShrink: 0 }} />
              {MODEL_LABELS[model] || model}
            </div>
          </div>
          <button
            onClick={() => setShowVocab((s) => !s)}
            style={{
              background: "transparent",
              border: `1px solid rgba(244,236,224,0.4)`,
              color: PALETTE.paper,
              borderRadius: 8,
              padding: "5px 11px",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "Georgia, serif",
            }}
          >
            {showVocab ? "✕ words" : `★ words (${vocab.length})`}
          </button>
        </div>

        {/* Support toggle */}
        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          {SUPPORT_LEVELS.map((lvl) => {
            const active = support === lvl.id;
            return (
              <button
                key={lvl.id}
                onClick={() => setSupport(lvl.id)}
                title={lvl.desc}
                style={{
                  flex: 1,
                  background: active ? PALETTE.gold : "rgba(244,236,224,0.1)",
                  color: active ? PALETTE.ink : PALETTE.paper,
                  border: "none",
                  borderRadius: 8,
                  padding: "7px 4px",
                  cursor: "pointer",
                  fontFamily: "Georgia, serif",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600 }} dir="rtl">
                  {lvl.he}
                </div>
                <div style={{ fontSize: 10.5, opacity: 0.85 }}>{lvl.en}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Vocab drawer */}
      {showVocab && (
        <div style={{ padding: "0.9rem 1.25rem", background: PALETTE.paperDeep, borderBottom: `1px solid ${PALETTE.sand}` }}>
          <div style={{ fontSize: 13, color: PALETTE.faint, marginBottom: 8, fontFamily: "Georgia, serif" }}>
            Words you're studying — the story will weave these in:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {vocab.map((w) => (
              <span
                key={w}
                style={{
                  background: PALETTE.sand,
                  color: PALETTE.ink,
                  borderRadius: 20,
                  padding: "4px 12px",
                  fontSize: 15,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                }}
                dir="rtl"
              >
                {w}
                <span
                  onClick={() => setVocab((v) => v.filter((x) => x !== w))}
                  style={{ cursor: "pointer", opacity: 0.5, fontSize: 13 }}
                >
                  ✕
                </span>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addWord()}
              placeholder="הוסף מילה / add a word"
              dir="rtl"
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                border: `1px solid ${PALETTE.sand}`,
                background: PALETTE.paper,
                fontSize: 15,
                fontFamily: "'Frank Ruhl Libre', serif",
                outline: "none",
              }}
            />
            <button
              onClick={addWord}
              style={{
                background: PALETTE.clay,
                color: PALETTE.paper,
                border: "none",
                borderRadius: 8,
                padding: "0 16px",
                cursor: "pointer",
                fontFamily: "Georgia, serif",
                fontSize: 14,
              }}
            >
              add
            </button>
          </div>
        </div>
      )}

      {/* Story area */}
      <div
        ref={scrollRef}
        style={{
          height: 420,
          overflowY: "auto",
          padding: "1.25rem",
          background: PALETTE.paper,
        }}
      >
        {!started && (
          <div style={{ textAlign: "center", paddingTop: 8 }}>
            <div
              style={{
                fontFamily: "'Amatic SC', cursive",
                fontSize: 28,
                color: PALETTE.clayDeep,
                marginBottom: 4,
              }}
            >
              ?על מה נדבר היום
            </div>
            <div style={{ fontSize: 13.5, color: PALETTE.faint, marginBottom: 18, fontFamily: "Georgia, serif" }}>
              Pick a thread — or type your own opening in Hebrew or English.
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {STARTERS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s.he)}
                  style={{
                    background: PALETTE.paperDeep,
                    border: `1px solid ${PALETTE.sand}`,
                    borderRadius: 12,
                    padding: "12px 16px",
                    cursor: "pointer",
                    textAlign: "right",
                    transition: "transform 0.1s",
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
                  onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  <div dir="rtl" style={{ fontSize: 18, color: PALETTE.ink, fontFamily: "'Frank Ruhl Libre', serif" }}>
                    {s.he}
                  </div>
                  <div style={{ fontSize: 12, color: PALETTE.faint, fontFamily: "Georgia, serif" }}>{s.en}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "assistant" ? (
            <div key={i} style={{ marginBottom: "1.4rem" }}>
              {renderSegment(m.content)}
            </div>
          ) : (
            <div key={i} style={{ marginBottom: "1.4rem", textAlign: "right" }}>
              <span
                dir={/[֐-׿]/.test(m.content) ? "rtl" : "ltr"}
                style={{
                  display: "inline-block",
                  background: PALETTE.sea,
                  color: PALETTE.paper,
                  borderRadius: "14px 14px 4px 14px",
                  padding: "9px 14px",
                  fontSize: 16,
                  maxWidth: "85%",
                  fontFamily: "'Frank Ruhl Libre', serif",
                }}
              >
                {m.content}
              </span>
            </div>
          )
        )}

        {loading && (
          <div style={{ display: "flex", gap: 5, padding: "4px 2px" }}>
            {[0, 1, 2].map((d) => (
              <span
                key={d}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: PALETTE.clay,
                  animation: `hb 1s ${d * 0.15}s infinite ease-in-out`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "0.85rem 1.1rem", background: PALETTE.paperDeep, borderTop: `1px solid ${PALETTE.sand}`, display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="כתוב בעברית או באנגלית… / type in Hebrew or English"
          style={{
            flex: 1,
            padding: "11px 15px",
            borderRadius: 22,
            border: `1px solid ${PALETTE.sand}`,
            background: PALETTE.paper,
            fontSize: 16,
            fontFamily: "'Frank Ruhl Libre', serif",
            outline: "none",
          }}
        />
        <button
          onClick={() => send()}
          disabled={loading}
          style={{
            background: loading ? PALETTE.sand : PALETTE.clay,
            color: PALETTE.paper,
            border: "none",
            borderRadius: 22,
            width: 50,
            cursor: loading ? "default" : "pointer",
            fontSize: 20,
          }}
        >
          ↑
        </button>
      </div>

      <div style={{ padding: "7px 12px", background: PALETTE.paperDeep, textAlign: "center", fontSize: 11.5, color: PALETTE.faint, fontFamily: "Georgia, serif" }}>
        Tap any Hebrew word to get an explanation · type "explain" anytime
      </div>

      <style>{`
        @keyframes hb { 0%, 100% { opacity: 0.3; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-3px); } }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-thumb { background: ${PALETTE.sand}; border-radius: 4px; }
      `}</style>
    </div>
  );
}
