import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Linter } from "eslint";
import * as tsParserModule from "@typescript-eslint/parser";
import plugin, { configs, rules as uxlintRules } from "../src/index";

const tsParser = (tsParserModule as any).default ?? tsParserModule;

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

// A form with a submit control and no error surface, plus a text input whose
// only prompt is its placeholder: one FORM-MULTI-001 and one INPUT-MOBILE-001.
const TWO_FINDING_FILE = `
  function SignupForm() {
    return (
      <form action="/signup">
        <input type="text" placeholder="Email" />
        <button type="submit">Sign up</button>
      </form>
    );
  }
`;

function lint(ruleSettings: Record<string, unknown>) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uxlint-severity-"));
  const previousCwd = process.cwd();

  try {
    fs.writeFileSync(
      path.join(tempDir, "uxlint.rules.json"),
      JSON.stringify({ version: 1, rules: [] }),
      "utf8",
    );
    process.chdir(tempDir);

    const linter = new Linter({ cwd: tempDir });
    return linter.verify(
      TWO_FINDING_FILE,
      [
        {
          files: ["**/*.tsx"],
          languageOptions: {
            parser: tsParser,
            parserOptions: {
              ecmaVersion: "latest",
              sourceType: "module",
              ecmaFeatures: { jsx: true },
            },
          },
          plugins: { uxlint: { rules: uxlintRules } },
          rules: ruleSettings,
        },
      ],
      { filename: "test.tsx" },
    );
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function summarize(
  messages: Array<{ ruleId?: string | null; severity: number }>,
) {
  return messages
    .map((message) => `${message.ruleId}:${message.severity}`)
    .sort();
}

serialTest("each built-in finding has its own ESLint rule id", () => {
  const messages = lint({
    "uxlint/form-multi-001": "error",
    "uxlint/input-mobile-001": "warn",
  });

  assert.deepEqual(summarize(messages), [
    "uxlint/form-multi-001:2",
    "uxlint/input-mobile-001:1",
  ]);
});

serialTest("severities are independent per rule", () => {
  const messages = lint({
    "uxlint/form-multi-001": "warn",
    "uxlint/input-mobile-001": "error",
  });

  assert.deepEqual(summarize(messages), [
    "uxlint/form-multi-001:1",
    "uxlint/input-mobile-001:2",
  ]);
});

serialTest("a rule left unconfigured reports nothing", () => {
  const messages = lint({ "uxlint/form-multi-001": "error" });

  assert.deepEqual(summarize(messages), ["uxlint/form-multi-001:2"]);
});

serialTest("the legacy apply rule still reports every finding", () => {
  const messages = lint({ "uxlint/apply": "warn" });

  assert.deepEqual(summarize(messages), ["uxlint/apply:1", "uxlint/apply:1"]);
});

serialTest("recommended enables the split rules at warn", () => {
  const recommended = configs.recommended as {
    rules: Record<string, string>;
  };

  assert.equal(recommended.rules["uxlint/form-multi-001"], "warn");
  assert.equal(recommended.rules["uxlint/input-mobile-001"], "warn");
  assert.equal(recommended.rules["uxlint/custom"], "warn");
  // apply reports the same findings as all of them together, so a preset that
  // enabled both would double every finding.
  assert.equal(recommended.rules["uxlint/apply"], undefined);
});

serialTest("strict enables the same rules at error", () => {
  const recommended = configs.recommended as {
    rules: Record<string, string>;
  };
  const strict = configs.strict as { rules: Record<string, string> };

  assert.deepEqual(
    Object.keys(strict.rules).sort(),
    Object.keys(recommended.rules).sort(),
  );
  assert.ok(Object.values(strict.rules).every((level) => level === "error"));
});

serialTest("every rule the presets name exists in the plugin", () => {
  const strict = configs.strict as { rules: Record<string, string> };

  for (const qualifiedName of Object.keys(strict.rules)) {
    const name = qualifiedName.replace(/^uxlint\//, "");
    assert.ok(plugin.rules[name], `missing rule: ${name}`);
  }
});
