import assert from "node:assert/strict";
import test from "node:test";
import { lintWithApplyRule, warningIds } from "./lint-harness";

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

const DATE_002 = "INPUT-DATE-002";

serialTest(
  "plain text date field with no placeholder or label reports DATE-002",
  () => {
    const code = `const ui = <input type="text" name="dob" />;`;
    assert.deepEqual(warningIds(lintWithApplyRule(code)), [DATE_002]);
  },
);

serialTest("a placeholder format hint satisfies DATE-002", () => {
  // The placeholder alone also trips INPUT-MOBILE-001 (placeholder-as-label),
  // which is correct but unrelated to what this test checks — isolate.
  const code = `const ui = <input type="text" name="date" placeholder="MM/DD/YYYY" />;`;

  const ids = warningIds(
    lintWithApplyRule(code, {
      uxlintFile: {
        version: 1,
        config: { builtinRules: { "INPUT-MOBILE-001": "off" } },
        rules: [],
      },
    }),
  );

  assert.deepEqual(ids, []);
});

serialTest("a label format hint satisfies DATE-002", () => {
  const code = `
    const ui = (
      <label>
        Birthdate (DD/MM/YYYY)
        <input type="text" name="birthdate" />
      </label>
    );
  `;

  assert.deepEqual(warningIds(lintWithApplyRule(code)), []);
});

serialTest("native type=date inputs are not evaluated at all", () => {
  const code = `const ui = <input type="date" name="date" />;`;
  assert.deepEqual(warningIds(lintWithApplyRule(code)), []);
});

serialTest("fields whose name does not look date-like are not flagged", () => {
  const code = `const ui = <input type="text" name="email" />;`;
  assert.deepEqual(warningIds(lintWithApplyRule(code)), []);
});

serialTest(
  "a declared design-system text field with a date-like name reports DATE-002",
  () => {
    const code = `const ui = <TextField name="date" />;`;

    const ids = warningIds(
      lintWithApplyRule(code, {
        uxlintFile: {
          version: 1,
          config: {
            designSystem: {
              components: { TextField: { role: "text-input" } },
            },
          },
          rules: [],
        },
      }),
    );

    assert.deepEqual(ids, [DATE_002]);
  },
);
