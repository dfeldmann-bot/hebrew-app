# ponytail-audit

Scan the entire codebase for over-engineering. Generate a ranked list of what to delete, simplify, or replace with stdlib/native equivalents.

## What to Hunt

- Redundant dependencies
- Single-implementation interfaces
- Unnecessary factories or delegation-only wrappers
- Single-export files
- Unused configuration flags
- Hand-rolled logic that stdlib covers

## Finding Format

`<tag> <removable code>. <replacement>. [file path]`

## Tags

- **delete**: unused code or speculative features
- **stdlib**: custom implementations standard libraries provide
- **native**: platform features duplicated by dependencies or custom code
- **yagni**: over-abstracted patterns (single impls, unused config)
- **shrink**: logic reducible without behavior changes

## Scope

Complexity only. Excludes correctness bugs, security vulnerabilities, and performance — those require conventional review. Generates findings only; applies no modifications.

## Outcome

Ranked by impact. End with total line and dependency savings possible.
