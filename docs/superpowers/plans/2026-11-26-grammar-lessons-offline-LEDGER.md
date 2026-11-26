# SDD ledger — plan: docs/superpowers/plans/2026-11-26-grammar-lessons-offline.md
Spec: docs/superpowers/specs/2026-11-26-grammar-lessons-offline-design.md
Branch: claude/ecstatic-ptolemy-0i4lc2 (dedicated feature branch, not main; executing in place)

## Pre-flight scan
| Pair / task | Produces → consumes | Finding |
|---|---|---|
| T1→T2 | types.ts, normalizeHebrew/stripNiqqud → verify scripts | Node strip-types needs explicit .ts imports. Ruling below. |
| T1→T3 | Course type → lessonState | consistent |
| T1,T3→T4 | types, progress → pages | consistent |
| T4→T5 | LessonView (T5 modifies) | sequential, ok |
| T4→T6 | VerifyMark, load.ts → PatternMachine; T5 links /patterns?root=<id>, T6 reads ?root= | consistent |
| T4↔T7 | both modify app/layout.tsx | sequential, ok |
| T2→T8–11 | verify CLI, CHECKER.md → content pipeline | consistent |
| T1→T8 | RootEntry.id ascii translit vs mockup Hebrew keys | content uses translit ids; ok |
| T1 self | content.test.ts tolerates missing lessons | consistent |
| T2 self | CLI must not downgrade checker-set verified | consistent |
| T3 self | stars rule vs tests | consistent |
| T4 self | build with zero lessons + dynamicParams=false | Ruling below |
| T5 self | checkRootGuess root tuple vs RootEntry.letters | consistent |
| T6 self | templates = mockup BIN | consistent |
| T7 self | precache from prerender manifest; check never-visited lesson | needs ≥1 lesson to be meaningful; ok after T8 (re-run check in T12) |
| T8–11 self | release bar removes unverified core items | consistent |

Ruling: scripts/verify import app/lib modules with explicit `.ts` extensions; app/lib modules used by scripts must not import other modules without extensions (or use `import type` only); enable tsconfig `allowImportingTsExtensions` only if needed (noEmit already set by Next) — why: Node 22 strip-types can't resolve extensionless — cost if wrong: small refactor.
Ruling: if Next refuses empty generateStaticParams, implementer may render a placeholder or add a guard — why: v1 has content after T8 anyway — cost: trivial.

## Progress
Task 1: implemented 0e2e480 (implementer a8893056d6324ec73); review: 2 Important (release bar must require `verified`; tokens with rootId/binyan need verify)
Task 1: minor (deferred): maqaf/sof-pasuq in mark range glue onto previous grapheme (hebrew.ts:4,29)
Task 1: minor (deferred): validateRoot doesn't check id/letters consistency or cross-root id uniqueness
Ruling: commit trailer "Claude Opus 5.5" is correct per this session's attribution reminder — reviewer ⚠️ dismissed.
Task 1: fix round 1/5 (2 addressed, 0 open; commits 0e2e480..32a114c)
Task 1: complete (commits b66c5c3..32a114c, review clean)
Task 2: dispatched (implementer a6e67819b21af484b), BASE 32a114c
