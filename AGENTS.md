# Instructions for Codex (and other review agents)

This repo is a personal Hebrew-learning app (Next.js). Your job here is a **Hebrew correctness
review**. You are a second checker next to the app's own verification pipeline. Do not change
app code or content files. Write findings to one file (below) and nothing else.

## What to review

Review whatever of these exists. Content is added unit by unit, so some folders may still be empty.

1. `content/roots/*.json` — root entries: forms per binyan with niqqud, meanings, example
   sentences, frequency bands (`speech` / `written` / `rare`), warnings, traps, word families.
2. `content/lessons/*.json` — lessons: explanations, reading texts (tokens + English),
   pattern panels, game items, end-check questions.
3. `docs/mockups/grammar-mockup.html` — the design mockup. Its Hebrew is in the `<script>`
   block: objects `V`, `S`, `H`, `M`, `TRACK`, `BIN`. Review it now; this data becomes the first
   real content.

Background: `docs/superpowers/specs/2026-11-26-grammar-lessons-offline-design.md` (what the app
teaches and the verification rules), `scripts/verify/CHECKER.md` (the in-house checker's rules,
once it exists).

## What counts as an error

- Wrong niqqud: vowels, dagesh, shin/sin dot, patach gnuvah.
- Wrong root, or wrong binyan/tense/person/gender label.
- A form listed for a root and binyan where Hebrew doesn't use it, or a "—" (not used) where a
  common form does exist.
- A wrong or misleading English translation, or a meaning that's right in general but wrong in
  that sentence.
- Unnatural or ungrammatical Hebrew in example sentences and reading texts: gender agreement,
  prepositions (e.g. `שמר על`), word order, register.
- A wrong frequency band (an everyday spoken word marked `rare`, a formal or news word marked `speech`).
- A warning, trap or "sound-alike" note that is false, or a missing warning where a learner
  would very likely be misled.
- Level problems: text far above bet level (intermediate beginner).

## Sources

Back every finding with a source you actually opened, preferably:
- en.wiktionary.org / he.wiktionary.org (entries and conjugation tables)
- hebrew-academy.org.il (Academy of the Hebrew Language: rules, decisions, tables)
- pealim.com (conjugation tables): fine to consult for checking; don't copy its text
- reputable grammar references; open-licensed PDFs are fine to cite

Facts only. Don't paste copyrighted lesson text into findings. If you are sure but can't find a
source, say so with `"verdict": "unsure"`. Your opinion is a lead for the in-house checker to
re-check. It never counts as a source by itself.

## Output

Write **`docs/review/codex-findings.jsonl`**, one JSON object per line, no other text:

```json
{"file": "content/roots/spr.json", "where": "binyanim.piel[0].he", "hebrew": "סִפֵּר", "issue": "short description", "severity": "error", "fix": "suggested correct Hebrew or text", "verdict": "error", "sources": [{"name": "Wiktionary: ספר", "url": "https://en.wiktionary.org/wiki/..."}]}
```

- `where`: a JSON path inside the file, or for the mockup the object and key (e.g. `M.ספר.forms[2]`).
- `severity`: `error` (wrong Hebrew/meaning), `warning` (misleading or unnatural), `note` (improvement).
- `verdict`: `error` = confirmed by the sources listed; `unsure` = suspected, no confirming source.
- Also confirmations are useful: for items you checked and found correct **with a source**, add
  a line with `"severity": "note"`, `"verdict": "confirmed"` and the source. The pipeline may use
  that source to mark the item verified after re-checking it.

Then write a short human summary in **`docs/review/codex-summary.md`**: how many items you checked,
counts per severity, and the 5 most important problems.

If you can commit, commit only those two files with the message
`review: Hebrew correctness findings (Codex)`.
