import assert from "node:assert/strict";
import test from "node:test";
import { lintWithApplyRule, warningIds } from "./lint-harness";

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

// The action is what makes this a submittable form; without one,
// FORM-MULTI-001 correctly stays quiet and there is nothing to override.
const FORM_WITH_PLACEHOLDER_ONLY_INPUT = `
  function SignupForm() {
    return (
      <form action="/signup">
        <input type="text" placeholder="Email" />
        <button type="submit">Sign up</button>
      </form>
    );
  }
`;

const SYNC_INTERACTION_WITHOUT_FEEDBACK = `
  import React from "react";

  function SyncNoVisibleFeedback() {
    const [isOpen, setIsOpen] = React.useState(false);

    function handleClick() {
      setIsOpen(!isOpen);
    }

    return (
      <button type="button" onClick={handleClick}>
        Toggle
      </button>
    );
  }
`;

serialTest("reports built-in rules normally without overrides", () => {
  const ids = warningIds(lintWithApplyRule(FORM_WITH_PLACEHOLDER_ONLY_INPUT));

  assert.deepEqual(ids.sort(), ["FORM-MULTI-001", "INPUT-MOBILE-001"]);
});

serialTest('disables a built-in rule with the string form "off"', () => {
  const ids = warningIds(
    lintWithApplyRule(FORM_WITH_PLACEHOLDER_ONLY_INPUT, {
      uxlintFile: {
        version: 1,
        config: {
          builtinRules: { "INPUT-MOBILE-001": "off" },
        },
        rules: [],
      },
    }),
  );

  assert.deepEqual(ids, ["FORM-MULTI-001"]);
});

serialTest('disables a built-in rule with { severity: "off" }', () => {
  const ids = warningIds(
    lintWithApplyRule(SYNC_INTERACTION_WITHOUT_FEEDBACK, {
      uxlintFile: {
        version: 1,
        config: {
          builtinRules: { "INTERACTION-SYNC-001": { severity: "off" } },
        },
        rules: [],
      },
    }),
  );

  assert.deepEqual(ids, []);
});

serialTest(
  "overrides a built-in rule message, keeping the rule id prefix",
  () => {
    const messages = lintWithApplyRule(FORM_WITH_PLACEHOLDER_ONLY_INPUT, {
      uxlintFile: {
        version: 1,
        config: {
          builtinRules: {
            "INPUT-MOBILE-001": {
              message: "Use the DS <TextField label> prop instead.",
            },
          },
        },
        rules: [],
      },
    });

    const overridden = messages.find((message) =>
      message.message.startsWith("[INPUT-MOBILE-001]"),
    );

    assert.ok(overridden);
    assert.equal(
      overridden.message,
      "[INPUT-MOBILE-001] Use the DS <TextField label> prop instead.",
    );
  },
);

serialTest("ignores unknown rule ids and non-off severities", () => {
  const ids = warningIds(
    lintWithApplyRule(FORM_WITH_PLACEHOLDER_ONLY_INPUT, {
      uxlintFile: {
        version: 1,
        config: {
          builtinRules: {
            "NOT-A-REAL-RULE-001": "off",
            "FORM-MULTI-001": "error",
            "INPUT-MOBILE-001": { severity: "warn" },
          },
        },
        rules: [],
      },
    }),
  );

  assert.deepEqual(ids.sort(), ["FORM-MULTI-001", "INPUT-MOBILE-001"]);
});
