# ponytail-review

Review a diff exclusively for over-engineering: find code to delete.

## What to Hunt

- Reinvented standard library functions
- Unneeded dependencies
- Speculative abstractions
- Dead flexibility (unused config, single-impl interfaces)

## Finding Format

`L<line>: <tag> <what>. <replacement>.`

## Tags

- **delete**: unused code or speculative features (no replacement needed)
- **stdlib**: hand-rolled logic the standard library provides
- **native**: dependencies duplicating platform capabilities
- **yagni**: abstractions with only one implementation or single callers
- **shrink**: identical logic expressible more concisely

## Example

`L12-38: stdlib: 27-line validator. Use '@' check, 1 line instead.`

## Scope

Complexity only. Excludes correctness bugs, security issues, and performance — those belong in normal review. Leave minimal smoke tests untouched.

## Outcome

End with: `net: -<N> lines possible.` If nothing cuts: `Lean already. Ship.`
