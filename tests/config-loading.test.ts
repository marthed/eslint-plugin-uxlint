import assert from "node:assert/strict";
import test from "node:test";
import { lintWithApplyRule, warningIds } from "./lint-harness";

const CONFIG_ERROR_ID = "UXLINT-CONFIG-001";

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

serialTest(
  "reports a config error when uxlint.rules.json is invalid JSON",
  () => {
    const messages = lintWithApplyRule("const x = 1;", {
      uxlintFileRaw: "{ this is not json",
    });

    assert.deepEqual(warningIds(messages), [CONFIG_ERROR_ID]);
    assert.match(messages[0].message, /uxlint\.rules\.json/);
  },
);

serialTest('reports a config error when "rules" is not an array', () => {
  const messages = lintWithApplyRule("const x = 1;", {
    uxlintFileRaw: JSON.stringify({ version: 1, rules: { id: "X" } }),
  });

  assert.deepEqual(warningIds(messages), [CONFIG_ERROR_ID]);
  assert.match(messages[0].message, /"rules" must be an array/);
});

serialTest("does not report config errors for a valid rules file", () => {
  const messages = lintWithApplyRule("const x = 1;");

  assert.deepEqual(messages, []);
});

serialTest("still applies DSL rules from a valid rules file", () => {
  const messages = lintWithApplyRule('const ui = <img src="a.png" />;', {
    uxlintFile: {
      version: 1,
      rules: [
        {
          id: "A11Y-IMG-001",
          title: "Images must have alt text",
          severity: "error",
          appliesTo: ["JSXOpeningElement"],
          when: {
            all: [{ eq: ["jsx.tag", "img"] }, { not: { hasAttr: "alt" } }],
          },
          report: { message: "<img> must have alt text." },
        },
      ],
    },
  });

  assert.deepEqual(warningIds(messages), ["A11Y-IMG-001"]);
});
