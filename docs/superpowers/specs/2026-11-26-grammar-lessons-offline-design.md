# Grammar lessons, offline — design

Date: 2026-11-26 · Status: approved by owner (2026-11-26)
Mockups (clickable): https://claude.ai/artifact/VRyiDcLpDPo8C5NsrUXqCM (private to the owner)

## 1. Intent

The owner lived in Israel, is at bet level, and is reactivating Hebrew. The AI story
partner helps with comprehension, but grammar still feels like a pile of exceptions.
The goal of this project is to make Hebrew's **repeating patterns visible** — roots,
binyanim, noun patterns — so that when a new root shows up, the learner can predict its
forms and meaning instead of memorising each word.

It must work **without AI and without internet** (on a plane), because the free AI quotas
run out and because study time often happens offline.

Success, in the owner's terms:
- Meeting a new word, they can find the root and guess the binyan and rough meaning.
- They can see the same root across binyanim and understand why the meanings shift.
- They know which forms are everyday speech vs. mostly written.
- They are warned about the forms that mislead (sound-alikes, look-alikes, "rule-breakers").
- It's fun enough to open daily: games, points, streaks.
- They can trust the content, and can see when something is *not* confirmed by a source.

## 2. Goals, non-goals, anti-goals

**Goals**
- A **Lessons** area in the existing app, next to the story partner, with a locked path:
  Foundations → seven binyanim (as active/passive pairs) → mixed review, plus side tracks.
- Each lesson: short explanation, an original reading text with tappable pattern words,
  a pattern panel, practice games, and an end-of-lesson check that unlocks the next lesson.
- Shared **root data** (forms per binyan, meanings, examples in context, frequency, traps,
  word family) used by lessons, games and — later — the vocabulary/root explorer.
- **Every Hebrew fact carries a verification status** with its sources, and the app shows it.
- **Fully offline** after first load: installable, all lessons, games, fonts and progress
  available in airplane mode. AI features show as unavailable offline (see the AI selector design).

**Non-goals (this project)**
- The standalone root/vocabulary explorer and the pronunciation trainer — separate projects
  that come after this one and will reuse its root data.
- Audio. Accounts, cross-device sync. Spaced repetition scheduling.
- Generating lessons at runtime. All lesson content is authored ahead of time and shipped as files.

**Anti-goals (would make this a failure even if it works)**
- Teaching wrong Hebrew. Content that fails verification is fixed or removed, never shipped
  silently; anything not confirmed by a source is visibly marked.
- Copying copyrighted material (textbook PDFs, news articles) into the app.
- A grammar reference that reads like a textbook wall of text. Explanations stay short; the
  patterns are shown, then practised.
- Lessons that need the network or an AI model to work.

## 3. Constraints

- Existing stack: Next.js 16 (App Router), React 19, inline styles with the `PALETTE` object
  in `app/HebrewStoryPartner.jsx`, no database, `localStorage` for persistence, passphrase
  `Gate` wrapping the app. House rules in `HANDOFF.md` (YAGNI, no needless deps, mark
  simplifications with `ponytail:`). The design look is the existing one (parchment palette,
  Frank Ruhl Libre for Hebrew, Amatic SC display) — the mockups show it.
- Fonts are currently loaded from Google Fonts at runtime → must be self-hosted to work offline.
- Single user, phone first. RTL Hebrew with optional niqqud.
- The build environment's network blocks most sites. Verification needs these hosts allowed
  (owner will be asked to approve when the work starts): `kaikki.org`, `en.wiktionary.org`,
  `he.wiktionary.org`, `hebrew-academy.org.il`. Frequency lists on GitHub are reachable already.
- Copyright: no copying of textbooks or articles. Facts (a form, a root, a meaning) are free to
  check against any source. Reading texts are original, written for the app; a lesson may be
  *inspired by* a real news topic and may link to an article, never reproduce it.

## 4. Approaches considered

1. **Lessons as data files inside the app + installable offline app (chosen).** One codebase,
   one app with a Lessons tab and a Story tab. Content is versioned in git, cached on the device.
2. Separate offline-only app — rejected: splits the codebase and duplicates vocabulary/root data.
3. Lessons in an online database — rejected: adds a server and accounts for content that
   doesn't change between releases, and still needs a full offline cache.

For sourcing: **scraping textbook PDFs into the app — rejected** (copyright). Sources are used
to *verify facts* and to *inform curriculum order*, not as content.

## 5. Curriculum

Order follows the mockup's course map. Each binyan unit uses the active/passive pairing.

- **Foundations** — what a root is; prefixes that hide in front of a root (ו ה ב כ ל מ ש);
  gender & number; present tense as four forms; reading without niqqud (כתיב מלא).
- **Binyan units**, in order: פָּעַל, נִפְעַל, פִּעֵל, פֻּעַל, הִפְעִיל, הֻפְעַל, הִתְפַּעֵל.
  Each unit: present · past · future · infinitive (passives skip what doesn't exist) ·
  a "compare with its pair/neighbour" lesson (e.g. pa'al vs nif'al, pa'al vs pi'el).
  Special notes inside units: hitpa'el ת-swap and assimilation; "rule-breakers"
  (nif'al with active meaning: נכנס, נרדם, נשאר).
- **Mixed review** — spot the binyan, one root across binyanim, an "article challenge" text.
- **Side tracks**, unlocking alongside the binyan path:
  - Weak roots: ל״ה, פ״נ, פ״י, ע״ו/ע״י, guttural letters, doubled roots.
  - Noun patterns (משקלים): מִקְטָל, מִקְטֶלֶת, קַטָּל, תַּקְטִיל, קְטִילָה, קִטּוּל, הַקְטָלָה, הִתְקַטְּלוּת.
  - Prepositions with endings (לי, לך, שלי, איתו, ממני…), construct state (סמיכות).
- **Sound-alike / look-alike notes** are woven into lessons and root entries (merged
  letters כ/ח, ת/ט, ק/כ, א/ע, ס/שׂ, ב/ו; unvowelled ambiguity like ספר). A dedicated trainer
  is the later pronunciation project.

**First release scope:** the engine (all screens, games, verification, offline) plus
**Foundations and the first three binyanim (pa'al, nif'al, pi'el)**, meeting the release bar in §8.
Later units are added with the same pipeline, one unit at a time.

- **Roots in v1:** every root the v1 lessons use, plus the 10 mockup roots (כתב, למד, ספר, גדל, דבר,
  שמר, כנס, לבש, סגר, פתח) — roughly 30–40 roots. Each root entry covers all seven binyanim
  (`null` where unused), so the Pattern Machine is complete even for binyanim not yet taught.
- **Forms per binyan:** the principal parts only — past 3rd masc. sing., present masc. sing.,
  future 3rd masc. sing., infinitive (passives: what exists). Lesson texts may use other persons;
  those forms live in the lesson and are verified there. Games drill these principal parts plus
  the forms that appear in lessons.
- **Weak roots:** v1 lessons use regular roots for the pattern being taught; a weak root that
  appears (e.g. חכה) is flagged with a short note pointing to the weak-roots side track.
- **Side tracks and mixed review:** shown on the course map as locked "coming later"; no content in v1.
  Links from the Pattern Machine to lessons that don't exist yet show as locked.

## 6. What the learner sees

- **Lessons tab** next to the existing story. Home = course map (mockup tab 1): binyan pairs
  compass, path with done/current/locked, side tracks.
- **Lesson** (mockup tab 2):
  1. Short explanation (a few sentences + the pattern template with root slots).
  2. Reading text, 6–12 short sentences, original, bet level, on an everyday or news-type topic.
     Pattern words highlighted. Toggles: vowels on pattern words / English line under each sentence.
     Tap a highlighted word → card with root (colour-coded in the word), binyan, form, meaning,
     word family, trap/sound-alike note.
  3. Pattern panel: template, how to spot it without vowels, contrast with a neighbour pattern.
  4. Practice rounds (games below) using this lesson's words plus earlier ones.
  5. End check: 5 questions mixed from the game types; 4/5 unlocks the next lesson.
     Any locked lesson can be "tested out" by taking its end check directly.
- **Games**
  - **Root Hunt** (mockup tab 3): tap the three root letters. Shows the pattern name, family
    words, and links to the root in the Pattern Machine and to the lesson where it appears.
  - **Build the word**: given root + meaning ("was dictated"), choose the binyan/tense; the word
    assembles into the template.
  - **Spot the binyan**: a word or a word in a sentence → pick the binyan.
  - Scoring: points, ×2 on a streak of 3+, a daily streak, stars per lesson (1–3 from the end check).
- **Pattern Machine** (mockup tab 4): pick any root in the data; table of all seven binyanim
  with past form (root letters coloured), meaning, frequency label, example sentence + translation,
  ⚠ warning; "watch out" traps; word family; link to the lesson that teaches it. "—" where a
  binyan isn't used with that root.
- **Verification markers**: verified content looks normal. Content that is only AI-checked or
  unverified shows a small marker; tapping it says what is and isn't confirmed and lists sources.
  An "About the content" page explains the statuses.

## 7. Content model

Plain JSON files in the repo, bundled with the app. Two kinds:

**Root entry** (one file per root, e.g. `content/roots/ספר.json` or a transliterated filename —
builder's call). Holds: root letters; for each binyan either `null` (not used) or a list of
forms: form with niqqud, which binyan/tense/person, English meaning, frequency band
(`speech` / `written` / `rare`), one example sentence (Hebrew + English), optional warning;
root-level traps; word family (word with niqqud + meaning + pattern name).

**Lesson** (one file per lesson): id, unit, order, title, explanation (short, with the pattern
template), reading text as sentences (each: Hebrew, English, and which tokens are pattern words
pointing to a root entry + form), pattern-panel content, game item lists, end-check questions,
topic note / optional link to a real article.

**Verification block** on every atomic Hebrew fact (a form, a root assignment, a binyan label,
a meaning, a family word, a frequency band) and on every sentence:
```
"verify": { "status": "verified" | "ai-checked" | "unverified",
            "sources": [{ "name": "...", "url": "..." }],
            "note": "what was checked / what is missing" }
```
- **verified** — confirmed by at least one listed source.
- **ai-checked** — for things no dictionary can confirm (original example sentences,
  explanations): every word form inside is verified and the Hebrew checker agent found no error.
  Shown with a light marker — it is not source-verified and the app says so.
- **unverified** — no source confirms it, or sources were unreachable. Shown with a clear marker.
- A **conflict** (a source disagrees) is a build failure: the content is fixed or removed before it ships.

## 8. Producing and verifying content

A repeatable pipeline, run by Claude Code at authoring time (never at app runtime):

1. **Draft** — a drafting agent writes a lesson and its root entries in the content format,
   following the curriculum and the mockup's style (short, everyday, with traps and examples).
2. **Source data** — download once and cache locally (not committed if large/licensed for
   reference only): Wiktionary Hebrew extract from kaikki.org (forms with niqqud, roots, binyanim,
   conjugation tables, meanings); Hebrew word-frequency lists (subtitles for speech,
   Wikipedia/news for writing).
3. **Automatic check** — a script compares every form, root and binyan label in the content against
   the Wiktionary data and fills in `verify` blocks; it assigns frequency bands from the lists.
   Unvowelled frequency counts are ambiguous (ספר); the band is applied per root/lemma as a
   best estimate and the note says so.
4. **Hebrew checker agent** — a separate agent whose only job is finding Hebrew errors. It reviews
   everything the script couldn't settle and everything sentence-level (grammar, niqqud, natural
   usage, translation accuracy), looks things up on the allowed sources (Wiktionary pages, Academy of
   the Hebrew Language; open-licensed grammar pages/PDFs it finds may be cited as supporting sources),
   and sets `verified` / `ai-checked` / `unverified` with sources and notes. It reports conflicts.
5. **Fix loop** — conflicts go back to drafting; repeat until no conflicts.

**Release bar (owner decision):** the grammar core must be `verified` — every verb/noun form,
root assignment and binyan label. A core item no source confirms is **removed** from the lesson
(not shipped as unverified). Meanings, family words, frequency bands, example sentences and
explanations may ship as `ai-checked` or `unverified`, with the marker shown.
6. **Content tests** — a test suite fails the build if any content file is malformed, references a
   missing root/form, has a conflict, or lacks a `verify` block.

The pipeline produces a short report per lesson (counts per status, open issues) committed next to
the content, so the owner can see quality at a glance.

## 9. Offline and storage

- The app becomes installable (web app manifest, icons) and registers a service worker that
  caches the app shell, all lesson and root files, and self-hosted fonts on first visit, and
  updates them when a new version is deployed.
- Fonts move from the Google Fonts link to self-hosted files.
- Progress (lesson status, stars, points, daily streak, game history) is stored on the device in
  `localStorage` under new `hsp_`-prefixed keys, alongside the existing vocab keys. Reads/writes are
  guarded; losing it is annoying, not fatal.
- **Where it runs:** on the owner's own computer, started locally (production build served on
  `localhost`). Service workers work on `localhost`, so no deployment or HTTPS is needed for v1.
  Phone install comes later, with a deploy.
- The passphrase gate stays as is (it works offline once the passphrase is stored). Lesson files
  themselves are not secret; the gate exists to protect AI quota.

## 10. Decided by the owner

- Lessons + games + explanations; practice is gamified (Root Hunt, Pattern Machine kept; all mockup
  items kept: course map, lesson text, vowel toggle, Root Hunt, Pattern Machine, end check, side tracks).
- More roots in the Pattern Machine, each with context, misleading-use warnings, and speech/written
  frequency. Root Hunt connects to lessons and patterns.
- No human reviewer: the app marks unverified content; a dedicated checker agent verifies against
  online sources; scraping is used to find sources.
- Works without AI and without internet, on the owner's computer (localhost) for v1.
- Release bar: option A (grammar core verified or removed; the rest may ship marked).
- Approved the calls in §11 and the v1 root/form scope in §5.

## 11. Calls made by Claude (owner can change)

- First release = engine + Foundations + pa'al, nif'al, pi'el.
- Three visible statuses (verified / ai-checked / unverified); conflicts never ship.
- Original reading texts inspired by news topics, not adapted copies.
- Unlock at 4/5, with test-out allowed.
- Games for v1: Root Hunt, Build the word, Spot the binyan, end check. Pattern Machine as reference.
- Progress in `localStorage`.

## 12. Left to the builder

- Routing/page structure for the Lessons area; component breakdown; styling details within the palette.
- Service worker approach (hand-written vs. a library), as long as it works with the Next.js 16
  production build on localhost.
- Build order: the AI selector is already merged (Vitest, `/api/models`, offline banner exist).
- Exact JSON schema field names and file naming; the content test runner (Vitest is being added by
  the AI selector work).
- How the verification script indexes the Wiktionary data.
