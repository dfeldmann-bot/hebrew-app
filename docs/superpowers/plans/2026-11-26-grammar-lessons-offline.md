# Grammar Lessons Offline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Lessons area (course map, lessons with tappable pattern words, games, Pattern Machine) that works fully offline on `localhost`, driven by verified JSON content for Foundations + pa'al, nif'al, pi'el.

**Architecture:** Content is JSON in `content/`, read at build time by server components and rendered as statically prerendered pages; interactive parts are client components receiving data as props. Pure logic (Hebrew text utils, schema validation, progress, games, verification) lives in `app/lib/**` with Vitest tests. A hand-written service worker precaches every page plus its static assets so the production build served on localhost works in airplane mode. A Node verification CLI checks content against a cached Wiktionary (kaikki.org) extract and frequency lists, and writes `verify` blocks.

**Tech Stack:** Next.js 16 App Router, React 19, Vitest 4, Node 22 (`--experimental-strip-types` for scripts), `@fontsource/frank-ruhl-libre` + `@fontsource/amatic-sc` (5.3.0), Playwright (preinstalled) for the offline check.

**Spec:** `docs/superpowers/specs/2026-11-26-grammar-lessons-offline-design.md` (read it; mockup at https://claude.ai/artifact/VRyiDcLpDPo8C5NsrUXqCM, source copy in `docs/mockups/grammar-mockup.html`).

## Global Constraints

- House rules from `HANDOFF.md`: YAGNI, no dependency for a few lines of code, mark deliberate simplifications with `ponytail:`; never move provider keys client-side.
- Palette and fonts from the existing app (`PALETTE` in `app/HebrewStoryPartner.jsx`; Frank Ruhl Libre for Hebrew, Amatic SC display). Move `PALETTE` to `app/lib/palette.ts` and import it in both places.
- Fonts self-hosted via `@fontsource/*` imports; no runtime request to fonts.googleapis.com (remove the `<link>` in `HebrewStoryPartner.jsx`).
- Lessons pages are **not** behind the passphrase `Gate`; only the story page is.
- Progress `localStorage` keys are prefixed `hsp_`; every read/write in try/catch; corrupt or missing data = fresh progress.
- Verification statuses exactly: `verified` | `ai-checked` | `unverified`. Conflicts never ship.
- Release bar: core items (form, root assignment, binyan label) must be `verified`; meanings, family words, frequency bands, sentences, explanations may be `ai-checked`/`unverified`.
- Frequency bands exactly: `speech` | `written` | `rare`.
- Unlock rule: end check score ≥ 4/5 completes a lesson and unlocks the next; any locked lesson's end check can be taken directly (test-out). Stars: 5/5 → 3, 4/5 → 2, completed earlier but retaken lower keeps best.
- Scoring: 10 points per correct game answer, ×2 while the in-game streak is ≥ 3. Daily streak = consecutive local calendar days with ≥ 1 completed game round.
- No copyrighted text copied into content. Reading texts are original.
- Commit trailers on every commit:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01TJBdn7SubuLA94LNPcGgef`

## Review Focus

- A Hebrew word containing shin/sin dots, dagesh and vowels in non-canonical mark order must still compare equal to the same word from Wiktionary (normalize before comparing) — Task 1 + Task 2 tests.
- Final letters (ך ם ן ף ץ) inside a word must match their root letter (כ מ נ פ צ) in Root Hunt and root colouring — Task 1 test.
- `localStorage` throwing (private mode) or holding garbage must not crash the course map; progress just starts fresh — Task 3 test.
- A lesson/Pattern-Machine link to a unit with no content yet must render as locked, not 404 — Task 4/6 test.
- Opening a lesson page that was never visited while offline must work (precache covers every lesson, not only visited ones) — Task 7 Playwright check.

---

### Task 1: Hebrew text utils + content schema and validator

**Files:**
- Create: `app/lib/hebrew.ts`, `app/lib/hebrew.test.ts`
- Create: `app/lib/content/types.ts`, `app/lib/content/validate.ts`, `app/lib/content/validate.test.ts`
- Create: `content/course.json` (lesson ids: `f-1`…`f-5`, `paal-1`…`paal-5`, `nifal-1`…`nifal-4`, `piel-1`…`piel-4`; structure only: units Foundations, Pa'al, Nif'al, Pi'el with lesson ids; Pu'al…Hitpa'el, Mixed review and the three side tracks with `"available": false`)
- Create: `content/content.test.ts` (runs the validator over every file in `content/`)

**Interfaces — Produces:**
- `stripNiqqud(s: string): string` (removes U+0591–U+05C7 incl. shin/sin dots)
- `normalizeHebrew(s: string): string` (NFC + canonical mark order; used for every equality check)
- `normalizeFinal(ch: string): string` (ך→כ ם→מ ן→נ ף→פ ץ→צ)
- `graphemes(word: string): string[]` (base letter + following marks)
- `rootSegments(word: string, root: string): { text: string; rootIndex: 0|1|2|3 }[]` (greedy left-to-right, as in the mockup's `colorRoot`; 0 = not a root letter)
- Types in `types.ts`: `Verify = { status: 'verified'|'ai-checked'|'unverified'; sources: {name:string;url:string}[]; note: string }`; `Binyan = 'paal'|'nifal'|'piel'|'pual'|'hifil'|'hufal'|'hitpael'`; `FormKind = 'past3ms'|'present_ms'|'future3ms'|'infinitive'`; `RootForm = { kind: FormKind; he: string; meaning: string; freq: 'speech'|'written'|'rare'; example: {he:string;en:string;verify:Verify}; warning?: string; verify: {form:Verify; meaning:Verify; freq:Verify} }`; `RootEntry = { id: string /* ascii translit, e.g. "spr" */; letters: [string,string,string]; binyanim: Record<Binyan, RootForm[] | null>; traps: {text:string;verify:Verify}[]; family: {he:string;meaning:string;pattern?:string;verify:Verify}[] }`; `Token = { he: string; rootId?: string; binyan?: Binyan; formLabel?: string; meaning?: string; verify?: {form:Verify;root:Verify;binyan:Verify} }`; `Lesson = { id: string; unit: string; order: number; title: string; explanation: {text:string;template:string;verify:Verify}; sentences: {tokens: Token[]; en: string; verify: Verify}[]; patternPanel: {spot:string; contrast:string}; games: {rootHunt: {he:string;gloss:string;rootId:string;pattern:string}[]; buildWord: {rootId:string;meaning:string;answer:{binyan:Binyan;kind:FormKind}}[]; spotBinyan: {he:string;sentence?:string;binyan:Binyan}[]}; endCheck: Question[]; topic?: {note:string;url?:string} }`; `Question = { prompt: string; he?: string; choices: string[]; answer: number }`; `Course = { units: {id:string;title:string;heTitle:string;available:boolean;lessons:string[]}[] }`.
- `validateRoot(r: unknown): string[]`, `validateLesson(l: unknown, roots: Map<string,RootEntry>): string[]`, `validateCourse(c: unknown, lessonIds: Set<string>): string[]`, `releaseBarErrors(l: Lesson, roots: Map<string,RootEntry>): string[]` — each returns human-readable error strings, `[]` = valid.

- [ ] **Step 1: Write failing tests** in `hebrew.test.ts`: `normalizeHebrew('שָׁלוֹם') === normalizeHebrew('שָׁלוֹם' written with shin-dot after qamats)`; `stripNiqqud('הִתְלַבֵּשׁ') === 'התלבש'`; `rootSegments('תַּשְׁלוּם','שלמ')` marks ש,ל,ם as 1,2,3; `rootSegments('הִסְתַּפֵּר','ספר')` marks ס,פ,ר and not ת; `graphemes('שָׁ').length === 1`. In `validate.test.ts`: a valid minimal root/lesson pass; missing `verify` → error naming the path; token `rootId` not in roots → error; `releaseBarErrors` flags a token whose `verify.form.status === 'unverified'` and passes one where only `meaning`-level items are unverified.
- [ ] **Step 2: Run** `npx vitest run app/lib` — Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the functions above. Validation is hand-written (no schema library).
- [ ] **Step 4: Run** `npx vitest run` — Expected: PASS, including `content/content.test.ts` over `course.json` (lessons it lists may not exist yet: `content.test.ts` checks only lesson files that exist, and that every existing lesson is listed in the course).
- [ ] **Step 5: Commit** `feat: Hebrew text utils and content schema validation`.

### Task 2: Verification CLI (sources, auto-check, frequency, report)

**Files:**
- Create: `scripts/verify/sources.ts` (download + cache), `scripts/verify/kaikki.ts` (index), `scripts/verify/check.ts` (apply checks), `scripts/verify/frequency.ts`, `scripts/verify/cli.ts`, `scripts/verify/CHECKER.md` (the Hebrew checker agent's instructions)
- Test: `scripts/verify/check.test.ts`, `scripts/verify/frequency.test.ts` (fixtures in `scripts/verify/fixtures/`, a few hand-made kaikki JSONL lines)
- Modify: `package.json` scripts `"verify:content": "node --experimental-strip-types scripts/verify/cli.ts"`; `.gitignore` adds `.cache/`

**Interfaces — Consumes:** Task 1 types and `normalizeHebrew`, `stripNiqqud`.
**Produces:**
- `loadKaikki(path: string): KaikkiIndex`; `KaikkiIndex.lookup(unvowelled: string): KaikkiEntry[]`
- `checkForm(idx, he: string, expect: {rootLetters?: string[]; binyan?: Binyan}): { form: Verify; root?: Verify; binyan?: Verify }` — `verified` when an entry or inflection table contains the normalized form exactly (source = the en.wiktionary page URL of that entry); root/binyan `verified` when the entry's root/binyan data matches; otherwise `unverified` with a note saying what was missing. A form found with a **different** root or binyan returns status `unverified` and note prefixed `CONFLICT:`.
- `frequencyBand(word: string, speech: Map<string,number>, written: Map<string,number>): { band: 'speech'|'written'|'rare'; verify: Verify }` — rank thresholds: speech band if rank ≤ 5000 in the subtitle list; else written if rank ≤ 10000 in the written list; else rare. Note says counts are unvowelled.
- CLI: `npm run verify:content [-- --lesson <id>]` fills/updates `verify` blocks for core items and freq bands **without downgrading** anything a checker agent already set to `verified` with sources, writes `content/reports/<lesson-id>.md` (counts per status, list of CONFLICT and unverified core items) and exits non-zero if any CONFLICT remains.
- Sources: kaikki Hebrew JSONL (confirm current URL on kaikki.org at task time); speech list `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/he/he_50k.txt`; written list — find a GitHub-hosted Hebrew Wikipedia/news frequency list and record its URL and license in `scripts/verify/SOURCES.md`. Cache under `.cache/`.

- [ ] **Step 1: Write failing tests**: `checkForm` verifies `לִמֵּד` with root ל־מ־ד/piel from the fixture; returns `CONFLICT:` when fixture says the form belongs to a different binyan; returns `unverified` for a form not in the fixture; mark-order variants compare equal. `frequencyBand` returns `speech` for rank 10, `written` for a word missing from speech but rank 900 in written, `rare` otherwise.
- [ ] **Step 2: Run** `npx vitest run scripts` — Expected: FAIL.
- [ ] **Step 3: Implement** the modules and CLI. Write `CHECKER.md`: the checker agent's only job is Hebrew errors; for each item the CLI left `unverified` and for every sentence/explanation it checks niqqud, grammar, natural usage and translation; looks items up on en/he.wiktionary.org and hebrew-academy.org.il; may cite open-licensed grammar pages; sets `verified` only with a source URL it actually opened that confirms the exact item; sets `ai-checked` for sentences/explanations whose word forms are all verified and that it found error-free; reports conflicts; treats any `docs/review/codex-findings.jsonl` lines as leads to re-check, never as sources.
- [ ] **Step 4: Run** `npx vitest run` — Expected: PASS. Then with network: `npm run verify:content` on the fixture-free tree — Expected: downloads into `.cache/`, prints "0 lessons" and exits 0.
- [ ] **Step 5: Commit** `feat: content verification CLI with Wiktionary and frequency sources`.

### Task 3: Progress and scoring logic

**Files:** Create `app/lib/progress.ts`, `app/lib/progress.test.ts`

**Interfaces — Consumes:** `Course` type. **Produces:**
- `type Progress = { lessons: Record<string,{done:boolean;stars:0|1|2|3;best:number}>; points: number; daily: {lastDay: string|null; streak: number} }`
- `emptyProgress(): Progress`; `loadProgress(storage?: Storage): Progress` (key `hsp_progress`); `saveProgress(p: Progress, storage?: Storage): void`
- `lessonState(course: Course, p: Progress, lessonId: string): 'done'|'current'|'locked'|'unavailable'`
- `recordEndCheck(p, lessonId, score: number /*0..5*/): Progress` (≥4 completes; stars per Global Constraints; keeps best)
- `awardPoints(p, correct: boolean, gameStreak: number): { progress: Progress; gameStreak: number; gained: number }`
- `touchDaily(p, today: string /*YYYY-MM-DD local*/): Progress`

- [ ] **Step 1: Write failing tests**: first lesson of Foundations is `current` on empty progress, the second `locked`; after `recordEndCheck(…,4)` first is `done` (2 stars) and second `current`; retake with 3 keeps done + 2 stars; score 5 → 3 stars; lessons of a unit with `available:false` → `unavailable`; `awardPoints` gives 10, then 20 on third consecutive correct, resets streak on wrong; `touchDaily` increments on consecutive day, keeps on same day, resets to 1 after a gap; `loadProgress` with a storage whose `getItem` throws, and with `"not json"`, both return `emptyProgress()`.
- [ ] **Step 2: Run** `npx vitest run app/lib/progress.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** Test-out needs no special state: `recordEndCheck` on a locked lesson completes it.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: lesson progress, unlocks, stars, points and daily streak`.

### Task 4: Lessons UI — nav, course map, lesson page, verification marks, fonts

**Files:**
- Create: `app/lib/palette.ts`; `app/components/NavTabs.jsx` (Story `/` · Lessons `/lessons` · Patterns `/patterns`); `app/components/VerifyMark.jsx`; `app/lib/content/load.ts` (server-only fs readers: `getCourse(): Course`, `getLesson(id): Lesson|null`, `getRoots(): Map<string,RootEntry>`, `getLessonIds(): string[]`); `app/lessons/page.tsx` + `app/lessons/CourseMap.jsx`; `app/lessons/[id]/page.tsx` (+ `generateStaticParams` from `getLessonIds()`, `dynamicParams = false`) + `app/lessons/[id]/LessonView.jsx` + `WordCard.jsx`; `app/lessons/about/page.tsx` (explains the three statuses); pages must build with zero lesson files (empty course map states).
- Modify: `app/layout.tsx` (fontsource imports, NavTabs, `lang="he"`-aware body untouched for RTL per component), `app/HebrewStoryPartner.jsx` (import PALETTE, drop Google Fonts `<link>`), `package.json` (+ the two `@fontsource` deps).
- Test: `app/lessons/lessonView.test.ts` for any extracted pure helpers (e.g. `tokenRenderModel(token, showNiqqud)`).

**Interfaces — Consumes:** Tasks 1, 3. **Produces:** `VerifyMark` props `{ verify: Verify | Verify[] }` (renders nothing when all `verified`; light dot for `ai-checked`; clear marker for `unverified`; tap opens a small panel listing notes + sources). `WordCard` props `{ token: Token; root?: RootEntry }`.

Behaviour (match mockup tabs 1–2): course map with binyan-pair compass, unit path showing done/current/locked/unavailable from `lessonState`, side tracks locked "coming later"; lesson page sections in order: explanation + template, reading text (vowels-on-pattern-words toggle, English-line toggle, tappable pattern tokens → `WordCard` with colour-coded root via `rootSegments`, binyan, form, meaning, family, traps, VerifyMark), pattern panel, games area (Task 5), end check (Task 5).

- [ ] **Step 1: Write failing tests** for extracted helpers: `tokenRenderModel` strips niqqud when toggle off and keeps it on pattern tokens when on; root segments in the card match `rootSegments`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** pages and components.
- [ ] **Step 4: Run** `npx vitest run && npm run lint && npm run build` — Expected: all pass; build lists `/lessons`, `/lessons/about` as static. `grep -r fonts.googleapis .next/static app` — Expected: no matches.
- [ ] **Step 5: Commit** `feat: lessons area with course map, lesson view and verification marks`.

### Task 5: Games and end check

**Files:**
- Create: `app/lib/games.ts`, `app/lib/games.test.ts`; `app/lessons/[id]/games/RootHunt.jsx`, `BuildWord.jsx`, `SpotBinyan.jsx`, `EndCheck.jsx`, `GameShell.jsx` (HUD: score, streak, progress bar; uses `awardPoints`, `touchDaily`, `saveProgress`)
- Modify: `app/lessons/[id]/LessonView.jsx` (practice section + end check)

**Interfaces — Consumes:** Tasks 1, 3. **Produces:**
- `huntTiles(he: string): string[]` (unvowelled letters); `checkRootGuess(tiles: string[], picked: number[], root: [string,string,string]): boolean` (compares `normalizeFinal` letters); `huntHint(he: string): string` (rules and copy as in the mockup's `hint()`)
- `buildWordOptions(item, root: RootEntry): {binyan:Binyan;kind:FormKind;he:string}[]` (correct + up to 3 distractors from the same root's non-null forms); `spotBinyanOptions(answer: Binyan): Binyan[]` (answer + 3 others, deterministic given a seed param)
- `scoreEndCheck(questions: Question[], answers: number[]): number`

Root Hunt after a correct answer shows the pattern name, three family words and links "See ‹root› in all binyanim" (`/patterns?root=<id>`) and the lesson where the root is taught (locked if not available). End check result calls `recordEndCheck` and shows stars + next-lesson link.

- [ ] **Step 1: Write failing tests**: `checkRootGuess` accepts תשלום with picked indices of ש,ל,ם for root ש־ל־מ; rejects wrong order; `huntTiles('מְדַבֶּרֶת')` → `['מ','ד','ב','ר','ת']`; `buildWordOptions` never includes `null` binyanim and always contains the answer; `scoreEndCheck` counts matches.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run && npm run build` — PASS.
- [ ] **Step 5: Commit** `feat: Root Hunt, Build the word, Spot the binyan and end check`.

### Task 6: Pattern Machine page

**Files:** Create `app/patterns/page.tsx`, `app/patterns/PatternMachine.jsx`; Test `app/lib/patterns.test.ts` for `patternRows(root: RootEntry): {binyan:Binyan; template:string; form: RootForm|null}[]` in `app/lib/patterns.ts`.

Behaviour = mockup tab 4: root picker over all roots (initial root from `?root=` query, read client-side), 7 rows with template, past form coloured by `rootSegments`, meaning, frequency badge, example + translation, ⚠ warning, VerifyMark; traps; family; "In the course" link (locked when unavailable). Templates exactly as mockup `BIN`.

- [ ] Steps: failing test (7 rows in fixed binyan order, `null` preserved) → FAIL → implement → `npx vitest run && npm run build` PASS → commit `feat: Pattern Machine`.

### Task 7: Offline — manifest, service worker, local run

**Files:**
- Create: `public/manifest.webmanifest`, `public/icons/icon-192.png`, `icon-512.png` (simple generated שׁ glyph on palette colour), `public/sw.js`, `app/components/RegisterSW.jsx` (registers only in production), `scripts/precache-list.mjs` (postbuild: writes `public/precache.json` = all page routes from `.next` prerender manifest), `scripts/offline-check.mjs` (Playwright)
- Modify: `app/layout.tsx` (manifest link, RegisterSW), `package.json` scripts: `"postbuild": "node scripts/precache-list.mjs"`, `"local": "next build && next start -p 3000"`, `"check:offline": "node scripts/offline-check.mjs"`; `README.md` section "Use it offline on your computer".

SW behaviour: on install, fetch `precache.json`, fetch each route, parse returned HTML for `/_next/static/` asset URLs and cache them too; cache name includes the build id so a new build replaces the old cache on activate; fetch handler: same-origin GET → cache-first for `/_next/static/` and fonts, network-first with cache fallback for pages and `content`; never cache `/api/*`.

- [ ] **Step 1:** Write `offline-check.mjs`: start from a running `npm start`, visit `/` once, wait for SW `ready`, set context offline, then open `/lessons`, a lesson page **never visited**, and `/patterns`; assert each renders its heading and that the story page shows the offline banner. Exit non-zero on failure.
- [ ] **Step 2: Run** `npm run build && (npm start &) && npm run check:offline` — Expected: FAIL (no SW).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same — Expected: PASS.
- [ ] **Step 5: Commit** `feat: installable offline app with precached lessons`.

### Task 8: Content — mockup roots + Foundations unit

**Files:** Create `content/roots/*.json` (כתב, למד, ספר, גדל, דבר, שמר, כנס, לבש, סגר, פתח, starting from mockup data in `docs/mockups/grammar-mockup.html`) and `content/lessons/f-*.json` for Foundations (lessons: what a root is · hidden prefixes ו ה ב כ ל מ ש · gender & number · present tense four forms · reading without niqqud), plus any new roots they use; `content/reports/*.md`.

Per lesson, the content pipeline (same for Tasks 9–11):
- [ ] **Step 1: Draft** lesson + root entries per spec §5–§7 (original 6–12 sentence text, bet level; end check of exactly 5 questions; ≥ 6 Root Hunt items, ≥ 4 Build-the-word, ≥ 4 Spot-the-binyan where the lesson has verbs).
- [ ] **Step 2: Run** `npm run verify:content -- --lesson <id>` — note CONFLICTs and unverified core items.
- [ ] **Step 3: Dispatch the Hebrew checker agent** with `scripts/verify/CHECKER.md` on the lesson and its roots.
- [ ] **Step 4: Fix** conflicts; **remove** core items still unverified (release bar); re-run Step 2 until it exits 0.
- [ ] **Step 5: Run** `npx vitest run content` — Expected: PASS (schema + release bar).
- [ ] **Step 6: Commit** `content: <lesson id>` with the report.

### Task 9: Content — Pa'al unit (present · past · future · infinitive · pa'al vs nif'al preview)
### Task 10: Content — Nif'al unit (present · past · future · pa'al vs nif'al incl. rule-breakers נכנס, נרדם, נשאר)
### Task 11: Content — Pi'el unit (present [mockup text] · past · future · pa'al vs pi'el)

Each: same pipeline as Task 8, regular roots for the taught pattern, weak roots flagged with a note.

### Task 12: Final docs and handoff

- Modify `README.md`, `HANDOFF.md` (content pipeline, how to add a unit, how to run offline), `PLAN.md` status section.
- [ ] Run `npx vitest run && npm run lint && npm run build && npm run check:offline` — all pass. Commit `docs: lessons, content pipeline and offline usage`.
