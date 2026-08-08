# eslint-plugin-uxlint

`eslint-plugin-uxlint` is a customizable **UX heuristic linter** for web applications.

It allows teams to define **UX rules as data** using a JSON-based DSL and enforce them during development via ESLint.

Instead of writing custom lint rules in JavaScript, designers and developers can define heuristics such as:

- Inputs should not rely on placeholder-only labels
- Icon-only buttons must have an accessible label
- Buttons should explicitly define their type

These rules are evaluated statically against your codebase.

---

# Installation

Install the plugin:

```bash
npm install eslint-plugin-uxlint --save-dev
```

or

```bash
yarn add eslint-plugin-uxlint -D
```

---

# Usage

Add the plugin to your ESLint configuration.

Example using **ESLint flat config (v9+)**:

```javascript
import uxlint from "eslint-plugin-uxlint";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      uxlint,
    },
    rules: {
      "uxlint/apply": "warn",
    },
  },
];
```

---

# Built-in Rules

Besides the JSON DSL, `uxlint/apply` ships built-in rule packs that analyze
interaction feedback and input controls:

- **Interaction feedback** (`INTERACTION-SYNC-001`, `INTERACTION-ASYNC-START-001`,
  `INTERACTION-ASYNC-SETTLED-001`, `INTERACTION-ASYNC-ERROR-001`,
  `INTERACTION-ASYNC-SUCCESS-001`) — traces user interactions (`onClick`,
  `onSubmit`, `onPress`) through handlers and state writes, across components
  and files, and reports when no visible UI feedback is detectable for the
  interaction or for an async phase (pending, settled, error, success). Common
  React Query, Redux, and Zustand status patterns are recognized.
- **Form feedback** (`FORM-MULTI-001`) — a form with a submit control should
  also expose a detectable error path.
- **Input controls** (`INPUT-CHOICE-004`, `INPUT-CHOICE-005`,
  `INPUT-MOBILE-001`, `INPUT-DATE-001`) — structural checks on radio groups,
  checkbox/radio label association, placeholder-as-label, and split
  month/day/year date dropdowns.

See [docs/built-in-rule-reference.md](docs/built-in-rule-reference.md) for the
full reference, and [docs/uxlint-direction.md](docs/uxlint-direction.md) for the
project direction.

Built-in rules can recognize your design-system components through
`config.designSystem` in `uxlint.rules.json`:

```json
{
  "version": 1,
  "config": {
    "designSystem": {
      "formComponents": ["AppForm"],
      "submitComponents": ["PrimaryButton"],
      "errorComponents": ["InlineError"],
      "components": {
        "TextField": { "role": "text-input", "labelProps": ["caption"] },
        "AppSelect": { "role": "select" },
        "UIButton": { "role": "button", "loadingProps": ["busy"] }
      }
    }
  },
  "rules": []
}
```

Each entry in `components` declares what a component is (`role`:
`"button"`, `"text-input"`, `"textarea"`, or `"select"`) and which props matter:

- `labelProps` — props that provide a visible label (in addition to the
  defaults `label` and `labelText`), used by the input-controls rules
- `loadingProps` / `disabledProps` — props the component visibly renders as
  loading or disabled state (in addition to the defaults `loading`,
  `isLoading`, and `disabled`); interaction rules trust these as visible
  feedback even when the component's implementation cannot be traced

The older flat `fieldComponents` array keeps working and behaves like a
`text-input`/`select` role declaration.

Imperative feedback calls in handlers — `toast(...)`, `toast.error(...)`,
`alert(...)` by default — count as visible interaction feedback and are
classified into async phases by their position (before the first `await`,
after it, in `catch`, in `finally`) and by member names like `.error` /
`.success`. Add your own notifier names with `designSystem.feedbackFunctions`:

```json
{
  "config": {
    "designSystem": {
      "feedbackFunctions": ["notify", "enqueueSnackbar"]
    }
  }
}
```

Individual built-in rules can be turned off or given a team-specific message
through `config.builtinRules`:

```json
{
  "version": 1,
  "config": {
    "builtinRules": {
      "INPUT-DATE-001": "off",
      "INTERACTION-ASYNC-SUCCESS-001": {
        "message": "Show a success toast or update the page after saving."
      }
    }
  },
  "rules": []
}
```

`severity` currently supports `"off"`; the warning versus error level of
reported findings follows the `uxlint/apply` setting in your ESLint config.

---

# Defining UX Rules

Rules are defined in a file named:

```
uxlint.rules.json
```

placed in your project root.

If the file cannot be parsed, `uxlint/apply` reports `UXLINT-CONFIG-001` on each
linted file instead of silently disabling your rules.

Example:

```json
{
  "version": 1,
  "rules": [
    {
      "id": "FORM-001",
      "title": "Avoid placeholder-only labels",
      "severity": "warn",
      "appliesTo": ["JSXOpeningElement"],
      "when": {
        "all": [
          { "in": ["jsx.tag", ["input", "textarea", "select"]] },
          { "hasAttr": "placeholder" },
          { "not": { "hasAnyAttr": ["aria-label", "aria-labelledby"] } }
        ]
      },
      "report": {
        "message": "Avoid placeholder-only labels. Provide a visible <label> or an accessible name."
      }
    }
  ]
}
```

---

# Rule DSL

Each rule has the following structure:

```typescript
type Heuristic = {
  id: string;
  title: string;
  severity: "off" | "warn" | "error";
  appliesTo: string[];
  when: Expr;
  report: {
    message: string;
  };
};
```

---

# Supported Signals

The DSL can reference signals extracted from the AST.

| Signal              | Description                    |
| ------------------- | ------------------------------ |
| `node.type`         | AST node type                  |
| `jsx.tag`           | HTML tag name (e.g. `"input"`) |
| `jsx.componentName` | JSX component name             |
| `file.path`         | Current file path              |

---

# Fact Scopes

Besides raw AST node types, `appliesTo` can name a **fact scope**. Fact-scope
rules run against the normalized facts the built-in analyzers collect, so a
single rule covers native elements and declared design-system components
alike.

## `InputControl`

Evaluated once per collected input control (inputs, textareas, selects,
checkboxes, radios, and design-system fields declared via
`designSystem.components` or `designSystem.fieldComponents`).

| Signal                    | Type    | Description                                                                                                          |
| ------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| `input.kind`              | string  | `"text-input"`, `"textarea"`, `"select"`, `"checkbox"`, `"radio"`, `"design-system-field"`, `"design-system-select"` |
| `input.componentName`     | string  | Component name for design-system controls                                                                            |
| `input.inputType`         | string  | The `type` attribute for native inputs                                                                               |
| `input.name` / `input.id` | string  | `name` / `id` attributes                                                                                             |
| `input.placeholder`       | string  | Placeholder text                                                                                                     |
| `input.hasPlaceholder`    | boolean | Placeholder present and non-empty                                                                                    |
| `input.ariaLabel`         | string  | `aria-label` text                                                                                                    |
| `input.hasAriaLabel`      | boolean | `aria-label` present and non-empty                                                                                   |
| `input.hasVisibleLabel`   | boolean | Wrapping label, `htmlFor`/`id` pair, `aria-labelledby`, or a design-system label prop                                |
| `input.isWrappedByLabel`  | boolean | Control is nested inside a `<label>`                                                                                 |
| `input.isDefaultSelected` | boolean | `checked` / `defaultChecked` present                                                                                 |

Missing facts read as `""` / `false`, so comparisons stay decidable.

Example: replace the built-in placeholder rule with your team's own wording:

```json
{
  "version": 1,
  "config": {
    "builtinRules": { "INPUT-MOBILE-001": "off" }
  },
  "rules": [
    {
      "id": "TEAM-LABEL-001",
      "title": "Placeholder is not a label",
      "severity": "warn",
      "appliesTo": ["InputControl"],
      "when": {
        "all": [
          {
            "in": [
              "input.kind",
              ["text-input", "textarea", "design-system-field"]
            ]
          },
          { "eq": ["input.hasPlaceholder", true] },
          { "eq": ["input.hasVisibleLabel", false] }
        ]
      },
      "report": {
        "message": "Fields need a visible label; placeholder text is not one."
      }
    }
  ]
}
```

## `Form`

Evaluated once per collected form (native `<form>` or configured
`designSystem.formComponents`).

| Signal                    | Type    | Description                                     |
| ------------------------- | ------- | ----------------------------------------------- |
| `form.hasSubmitControl`   | boolean | A submit control was found inside the form      |
| `form.hasErrorIndicator`  | boolean | An error indicator was found inside the form    |
| `form.fieldCount`         | number  | Number of collected fields                      |
| `form.submitControlCount` | number  | Number of collected submit controls             |
| `form.source`             | string  | `"native"`, `"framework"`, or `"design-system"` |

## `Interaction`

Evaluated once per traced interaction (an `onClick`/`onSubmit`/`onPress`
binding whose handler could be resolved), after handler expansion, multi-file
tracing, and cross-component visibility analysis.

| Signal                           | Type    | Description                                            |
| -------------------------------- | ------- | ------------------------------------------------------ |
| `interaction.eventName`          | string  | `"onClick"`, `"onSubmit"`, `"onPress"`, or `"unknown"` |
| `interaction.elementName`        | string  | JSX element the handler is attached to                 |
| `interaction.componentName`      | string  | React component containing the interaction             |
| `interaction.label`              | string  | `aria-label` of the interaction source, if any         |
| `interaction.isAsync`            | boolean | Handler is async or writes non-sync phases             |
| `interaction.writesState`        | boolean | Handler writes component or adapter state              |
| `interaction.hasVisibleFeedback` | boolean | Any written state is detectably visible                |
| `interaction.hasStartFeedback`   | boolean | Visible feedback for the pending phase                 |
| `interaction.hasSettledFeedback` | boolean | Visible feedback when pending clears                   |
| `interaction.hasErrorFeedback`   | boolean | Visible feedback for the error phase                   |
| `interaction.hasSuccessFeedback` | boolean | Visible feedback for the success phase                 |

Example: an interaction lifecycle rule as data:

```json
{
  "id": "TEAM-INT-001",
  "title": "Async interactions need error feedback",
  "severity": "warn",
  "appliesTo": ["Interaction"],
  "when": {
    "all": [
      { "eq": ["interaction.isAsync", true] },
      { "eq": ["interaction.writesState", true] },
      { "eq": ["interaction.hasErrorFeedback", false] }
    ]
  },
  "report": {
    "message": "Show the user when this async action fails."
  }
}
```

---

# Reading Attribute Values

To read JSX attribute values use the `call` syntax:

```json
{ "call": ["jsx.attrText", "type"] }
```

Example:

```json
{
  "eq": [{ "call": ["jsx.attrText", "type"] }, "email"]
}
```

---

# DSL Operators

## all (AND)

```json
{
  "all": [{ "eq": ["jsx.tag", "button"] }, { "hasAttr": "type" }]
}
```

## any (OR)

```json
{
  "any": [{ "eq": ["jsx.tag", "a"] }, { "eq": ["jsx.componentName", "Link"] }]
}
```

## not

```json
{ "not": { "hasAttr": "href" } }
```

## eq

```json
{ "eq": ["jsx.tag", "img"] }
```

## in

```json
{ "in": ["jsx.tag", ["input", "textarea"]] }
```

## hasAttr

```json
{ "hasAttr": "placeholder" }
```

## hasAnyAttr

```json
{ "hasAnyAttr": ["aria-label", "aria-labelledby"] }
```

---

# Example Rules

## Images must have alt text

```json
{
  "id": "A11Y-IMG-001",
  "title": "Images must have alt text",
  "severity": "error",
  "appliesTo": ["JSXOpeningElement"],
  "when": {
    "all": [{ "eq": ["jsx.tag", "img"] }, { "not": { "hasAttr": "alt" } }]
  },
  "report": {
    "message": "<img> must have alt text."
  }
}
```

---

## Buttons should explicitly set type

```json
{
  "id": "BTN-001",
  "title": "Buttons should explicitly set type",
  "severity": "warn",
  "appliesTo": ["JSXOpeningElement"],
  "when": {
    "all": [{ "eq": ["jsx.tag", "button"] }, { "not": { "hasAttr": "type" } }]
  },
  "report": {
    "message": "<button> should explicitly set type=\"button\" or type=\"submit\"."
  }
}
```

---

# Fail-safe behavior

When the engine cannot confidently evaluate a condition (for example due to dynamic expressions), the rule result becomes **unknown**.

The engine fails safely:

- `true` → report
- `false` → no report
- `unknown` → no report

This avoids noisy or misleading lint warnings.

---

# License

MIT
