# Benchmark target configurations

One `uxlint.rules.json` per target, used by `--configured`. The runner copies
the matching `<target-basename>.json` into the target directory for the
duration of the run and removes it afterwards.

These exist because several rules cannot fire without a component vocabulary.
`<Switch checked={x} />` is statically just an unknown JSX identifier — nothing
distinguishes it from `<Card>` — so `INPUT-TOGGLE-*`, `INPUT-SPLIT-*`, and the
design-system half of `INPUT-DATE-*` only apply to declared components. Running
unconfigured leaves them unmeasured rather than clean.

Each mapping is grounded in what the library actually exports, not in guessed
names:

- **ui** — shadcn/ui. `Switch` wraps Radix's switch primitive and is the only
  switch. `Toggle` is Radix's _toggle button_ (`aria-pressed`), a different
  control, so it is deliberately not declared as a switch.
- **taxonomy** — the same shadcn components, vendored into `components/ui`.
- **mantine** — `@mantine/core` inputs plus `DateInput`, the one date component
  that takes free-text entry. `DatePickerInput`, `MonthPickerInput`,
  `YearPickerInput`, and `DateTimePicker` are calendar pickers and are
  deliberately _not_ declared as fields: declaring them made `INPUT-DATE-002`
  demand a format hint from controls that never accept typed input.

No target declares a `split-button`. Neither library ships one — Mantine
composes `Button.Group` with `Menu` — so inventing a mapping would manufacture
findings rather than measure them. `INPUT-SPLIT-*` stays honestly unmeasured
until a target that actually has split buttons is added.

`excalidraw` and `commerce` have no config; they use in-house components that
would need per-repo research to map, and they run unconfigured.
