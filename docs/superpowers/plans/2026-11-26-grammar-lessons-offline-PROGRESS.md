# Progress — grammar lessons offline (paused 2026-11-26)

Plan: `docs/superpowers/plans/2026-11-26-grammar-lessons-offline.md` · Spec: `docs/superpowers/specs/2026-11-26-grammar-lessons-offline-design.md`

## Done
- AI model selector (separate design) — merged, tests/lint/build pass.
- Task 1 Hebrew utils + content schema/validator — complete, reviewed (commits b66c5c3..32a114c).

## In progress (paused by owner)
- Task 2 verification CLI — implementer was stopped mid-task. Its unreviewed partial work is
  parked in `scripts/verify-wip/` (moved out of `scripts/verify/` so nothing treats it as done).
  To resume: re-dispatch Task 2 from the plan; the new implementer may reuse or discard the WIP.
  `.cache/` (kaikki download) is gitignored and won't survive a new container — re-download.

## Next
Tasks 3–12 per the plan, using superpowers:subagent-driven-development.

## Pre-flight rulings (from the execution ledger)
- scripts/verify import app/lib modules with explicit `.ts` extensions; app/lib modules used by scripts stay import-free or `import type` only.
- If Next refuses empty generateStaticParams, render a placeholder/guard (v1 has content after Task 8).
- Deferred minors from Task 1: maqaf/sof-pasuq glue onto the previous grapheme (hebrew.ts); validateRoot doesn't check id/letters consistency or id uniqueness.

## Environment
- This repo has a personal cloud environment "hebrew-app" allowing kaikki.org, en/he.wiktionary.org, hebrew-academy.org.il (the Academy site answered 403 from here).
