import assert from "node:assert/strict";
import test from "node:test";
import { lintWithApplyRule, warningIds } from "./lint-harness";

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

const SPLIT_001 = "INPUT-SPLIT-001";
const SPLIT_002 = "INPUT-SPLIT-002";

const SPLIT_BUTTON_CONFIG = {
  version: 1 as const,
  config: {
    designSystem: {
      components: {
        SplitButton: { role: "split-button" as const },
      },
    },
  },
  rules: [],
};

serialTest(
  "split button with a primary action and a menu does not report SPLIT-001",
  () => {
    const code = `
      const ui = (
        <SplitButton onClick={() => save()} items={[{ label: "Save as..." }]} />
      );
    `;

    const ids = warningIds(
      lintWithApplyRule(code, { uxlintFile: SPLIT_BUTTON_CONFIG }),
    );

    assert.deepEqual(ids, []);
  },
);

serialTest("split button with only a menu reports SPLIT-001", () => {
  const code = `
      const ui = <SplitButton items={[{ label: "Export CSV" }, { label: "Export PDF" }]} />;
    `;

  const ids = warningIds(
    lintWithApplyRule(code, { uxlintFile: SPLIT_BUTTON_CONFIG }),
  );

  assert.deepEqual(ids, [SPLIT_001]);
});

serialTest(
  "an undeclared component named SplitButton is not evaluated at all",
  () => {
    const code = `
      const ui = <SplitButton items={[{ label: "Export CSV" }]} />;
    `;

    assert.deepEqual(warningIds(lintWithApplyRule(code)), []);
  },
);

serialTest("split button with an href prop reports SPLIT-002", () => {
  const code = `
    const ui = <SplitButton href="/settings" items={[{ label: "More" }]} />;
  `;

  const ids = warningIds(
    lintWithApplyRule(code, { uxlintFile: SPLIT_BUTTON_CONFIG }),
  );

  assert.deepEqual(ids.sort(), [SPLIT_001, SPLIT_002].sort());
});

serialTest("split button with a to prop reports SPLIT-002", () => {
  const code = `
    const ui = <SplitButton to="/settings" onClick={() => {}} items={[]} />;
  `;

  const ids = warningIds(
    lintWithApplyRule(code, { uxlintFile: SPLIT_BUTTON_CONFIG }),
  );

  assert.deepEqual(ids, [SPLIT_002]);
});

serialTest(
  "split button whose primary action navigates via router.push reports SPLIT-002",
  () => {
    const code = `
      const ui = (
        <SplitButton onClick={() => router.push("/settings")} items={[{ label: "More" }]} />
      );
    `;

    const ids = warningIds(
      lintWithApplyRule(code, { uxlintFile: SPLIT_BUTTON_CONFIG }),
    );

    assert.deepEqual(ids, [SPLIT_002]);
  },
);

serialTest(
  "split button whose menu action navigates via navigate() reports SPLIT-002",
  () => {
    const code = `
      const ui = (
        <SplitButton
          onClick={() => save()}
          items={[{ onSelect: () => navigate("/archive") }]}
        />
      );
    `;

    const ids = warningIds(
      lintWithApplyRule(code, { uxlintFile: SPLIT_BUTTON_CONFIG }),
    );

    assert.deepEqual(ids, [SPLIT_002]);
  },
);

serialTest(
  "split button with a non-navigating primary action does not report SPLIT-002",
  () => {
    const code = `
      const ui = (
        <SplitButton onClick={() => saveDocument()} items={[{ label: "Save as..." }]} />
      );
    `;

    const ids = warningIds(
      lintWithApplyRule(code, { uxlintFile: SPLIT_BUTTON_CONFIG }),
    );

    assert.deepEqual(ids, []);
  },
);

serialTest("configured primaryActionProps/menuProps are honored", () => {
  const code = `
    const ui = (
      <ActionGroup run={() => doThing()} options={[{ label: "Alt action" }]} />
    );
  `;

  const ids = warningIds(
    lintWithApplyRule(code, {
      uxlintFile: {
        version: 1,
        config: {
          designSystem: {
            components: {
              ActionGroup: {
                role: "split-button",
                primaryActionProps: ["run"],
                menuProps: ["options"],
              },
            },
          },
        },
        rules: [],
      },
    }),
  );

  assert.deepEqual(ids, []);
});
