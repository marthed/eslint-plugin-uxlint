import assert from "node:assert/strict";
import test from "node:test";
import { lintWithApplyRule, warningIds } from "./lint-harness";

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

const PLACEHOLDER_AS_LABEL_RULE = {
  id: "TEAM-LABEL-001",
  title: "Placeholder is not a label",
  severity: "warn",
  appliesTo: ["InputControl"],
  when: {
    all: [
      {
        in: ["input.kind", ["text-input", "textarea", "design-system-field"]],
      },
      { eq: ["input.hasPlaceholder", true] },
      { eq: ["input.hasVisibleLabel", false] },
    ],
  },
  report: {
    message: "Fields need a visible label; placeholder text is not one.",
  },
};

serialTest(
  "a DSL InputControl rule can replace the built-in placeholder rule",
  () => {
    const ids = warningIds(
      lintWithApplyRule(
        'const ui = <input type="text" placeholder="Email" />;',
        {
          uxlintFile: {
            version: 1,
            config: {
              builtinRules: { "INPUT-MOBILE-001": "off" },
            },
            rules: [PLACEHOLDER_AS_LABEL_RULE],
          },
        },
      ),
    );

    assert.deepEqual(ids, ["TEAM-LABEL-001"]);
  },
);

serialTest("InputControl rules see label association facts", () => {
  const code = `
    const ui = (
      <label>
        Email
        <input type="text" placeholder="you@example.com" />
      </label>
    );
  `;

  const ids = warningIds(
    lintWithApplyRule(code, {
      uxlintFile: {
        version: 1,
        config: {
          builtinRules: { "INPUT-MOBILE-001": "off" },
        },
        rules: [PLACEHOLDER_AS_LABEL_RULE],
      },
    }),
  );

  assert.deepEqual(ids, []);
});

serialTest("InputControl rules cover declared design-system components", () => {
  const ids = warningIds(
    lintWithApplyRule('const ui = <TextField placeholder="Email" />;', {
      uxlintFile: {
        version: 1,
        config: {
          builtinRules: { "INPUT-MOBILE-001": "off" },
          designSystem: {
            components: {
              TextField: { role: "text-input" },
            },
          },
        },
        rules: [PLACEHOLDER_AS_LABEL_RULE],
      },
    }),
  );

  assert.deepEqual(ids, ["TEAM-LABEL-001"]);
});

serialTest("design-system label props satisfy input.hasVisibleLabel", () => {
  const ids = warningIds(
    lintWithApplyRule(
      'const ui = <TextField caption="Email" placeholder="you@example.com" />;',
      {
        uxlintFile: {
          version: 1,
          config: {
            builtinRules: { "INPUT-MOBILE-001": "off" },
            designSystem: {
              components: {
                TextField: { role: "text-input", labelProps: ["caption"] },
              },
            },
          },
          rules: [PLACEHOLDER_AS_LABEL_RULE],
        },
      },
    ),
  );

  assert.deepEqual(ids, []);
});

serialTest("InputControl rules with severity off are skipped", () => {
  const ids = warningIds(
    lintWithApplyRule('const ui = <input type="text" placeholder="Email" />;', {
      uxlintFile: {
        version: 1,
        config: {
          builtinRules: { "INPUT-MOBILE-001": "off" },
        },
        rules: [{ ...PLACEHOLDER_AS_LABEL_RULE, severity: "off" }],
      },
    }),
  );

  assert.deepEqual(ids, []);
});

serialTest("JSX-scoped DSL rules are unaffected by the new scope", () => {
  const ids = warningIds(
    lintWithApplyRule('const ui = <img src="a.png" />;', {
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
          PLACEHOLDER_AS_LABEL_RULE,
        ],
      },
    }),
  );

  assert.deepEqual(ids, ["A11Y-IMG-001"]);
});
