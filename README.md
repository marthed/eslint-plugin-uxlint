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
````

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
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: {
      uxlint
    },
    rules: {
      "uxlint/apply": "warn"
    }
  }
];
```

---

# Defining UX Rules

Rules are defined in a file named:

```
uxlint.rules.json
```

placed in your project root.

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
  id: string
  title: string
  severity: "off" | "warn" | "error"
  appliesTo: string[]
  when: Expr
  report: {
    message: string
  }
}
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

# Reading Attribute Values

To read JSX attribute values use the `call` syntax:

```json
{ "call": ["jsx.attrText", "type"] }
```

Example:

```json
{
  "eq": [
    { "call": ["jsx.attrText", "type"] },
    "email"
  ]
}
```

---

# DSL Operators

## all (AND)

```json
{
  "all": [
    { "eq": ["jsx.tag", "button"] },
    { "hasAttr": "type" }
  ]
}
```

## any (OR)

```json
{
  "any": [
    { "eq": ["jsx.tag", "a"] },
    { "eq": ["jsx.componentName", "Link"] }
  ]
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
    "all": [
      { "eq": ["jsx.tag", "img"] },
      { "not": { "hasAttr": "alt" } }
    ]
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
    "all": [
      { "eq": ["jsx.tag", "button"] },
      { "not": { "hasAttr": "type" } }
    ]
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

* `true` → report
* `false` → no report
* `unknown` → no report

This avoids noisy or misleading lint warnings.


---

# License

MIT