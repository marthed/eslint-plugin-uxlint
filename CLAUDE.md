# eslint-plugin-uxlint

A UX heuristic linter for web apps. One ESLint rule, `uxlint/apply`, orchestrates
every built-in rule plus project rules authored as data in `uxlint.rules.json`.

Audience: design-system teams — teams with a component library who can declare a
`designSystem.components` vocabulary. Several rules are inert without one.

## Architecture

Collectors run during traversal and record normalized facts; evaluators run at
`Program:exit` and turn facts into findings.

- `src/structure/` — within-file structural facts (forms, inputs, toggles,
  split buttons). Named `structure/`, not `jsx/`, to leave room for HTML, web
  components, Vue, and Svelte later.
- `src/interactions/` — cross-function, cross-component, cross-file dataflow:
  which handler runs, what state it writes, whether that state becomes visible.
  Writes are classified into phases: `sync`, `start`, `success`, `error`,
  `settled`.
- `src/shared/` — config loading, design-system vocabulary, signals.

## The core rule: report only what you can prove

Findings are tri-state. `true` / `false` / `"unknown"`, and **unknown never
reports**. A heuristic fires on a proven condition, and any exemption needs
proof of absence, not absence of proof. Concretely:

- `<form {...props}>` may hide an `onSubmit`, so it does not qualify for the
  "cannot submit" exemption.
- An outcome handed to a parent callback that cannot be resolved is unknown, so
  the phase is not reported.
- A toggle bound to an expression rather than an identifier is left unclassified.

## Two benchmark axes — use both

```bash
npm run benchmark:corpus   # clone the corpus into ~/.cache (once)
npm run benchmark:noise ~/.cache/uxlint-benchmark-corpus/*
npm run benchmark:recall   # exits non-zero on a miss
```

Noise measures false positives on 8 real repos. **On its own it rewards a
linter that reports nothing** — a detection bug that silences a rule scores as
an improvement, which happened twice before the recall axis existed. Recall
lints deliberately broken fixtures and fails when UXLint stays silent.

Run both after any detection change. See `docs/noise-benchmark.md`.

## How to verify a change

Compare **finding sets, not totals**. Rebuild the previous commit, dump
locations, and diff:

```bash
node benchmarks/noise-benchmark.mjs <target> --samples 500 | grep "^      " | sort > after.txt
git stash push -- src tests && npm run build
node benchmarks/noise-benchmark.mjs <target> --samples 500 | grep "^      " | sort > before.txt
git stash pop && npm run build
comm -13 before.txt after.txt   # newly reported
```

Totals hide compensating changes. A net -5 has repeatedly been -12 real fixes
plus 7 new false positives. Use a path-limited stash (`-- src tests`); a plain
`git stash` fails on `.claude/settings.json` under the sandbox.

Then classify a sample of what remains by opening the actual files. Several
times this session a fixture "passed" for the wrong reason, and only reading
the source or instrumenting the collector revealed it.

## Constraints

- `docs/` is gitignored on purpose. Keep it updated; never stage it.
- Commit finished, verified work without asking. Never push, publish to npm, or
  create a GitHub Release without being asked.
- `--configured` writes into the corpus directory, which the sandbox blocks for
  `~/.cache`. Run it unsandboxed or allow that path.

## State

v1.2.0 is tagged and pushed but **not published** — npm is still on 1.1.0 until
the GitHub Release is published, which fires `release.yml`.
