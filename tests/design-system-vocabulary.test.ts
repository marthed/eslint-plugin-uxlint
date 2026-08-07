import assert from "node:assert/strict";
import test from "node:test";
import { lintWithApplyRule, warningIds } from "./lint-harness";

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

const SAVE_PANEL_WITH_UNRENDERED_BUSY_PROP = `
  import React from "react";

  function SavePanel() {
    const [isSaving, setIsSaving] = React.useState(false);
    const [didSave, setDidSave] = React.useState(false);
    const [didFail, setDidFail] = React.useState(false);

    async function handleSave() {
      setIsSaving(true);
      try {
        await fakeSave();
        setDidSave(true);
      } catch {
        setDidFail(true);
      } finally {
        setIsSaving(false);
      }
    }

    return (
      <div>
        <button type="button" onClick={handleSave}>
          Save
        </button>
        <SaveBadge busy={isSaving} />
        <div>{didSave && "Saved"}</div>
        <div>{didFail && "Failed"}</div>
      </div>
    );
  }

  function SaveBadge({ busy: _busy }: { busy: boolean }) {
    return <div>Idle</div>;
  }

  async function fakeSave() {
    return true;
  }
`;

serialTest(
  "reports pending warnings when a traced child never renders the passed state",
  () => {
    const ids = warningIds(
      lintWithApplyRule(SAVE_PANEL_WITH_UNRENDERED_BUSY_PROP),
    );

    assert.deepEqual(ids, [
      "INTERACTION-ASYNC-START-001",
      "INTERACTION-ASYNC-SETTLED-001",
    ]);
  },
);

serialTest(
  "trusts declared loadingProps as visible feedback over child tracing",
  () => {
    const ids = warningIds(
      lintWithApplyRule(SAVE_PANEL_WITH_UNRENDERED_BUSY_PROP, {
        uxlintFile: {
          version: 1,
          config: {
            designSystem: {
              components: {
                SaveBadge: { loadingProps: ["busy"] },
              },
            },
          },
          rules: [],
        },
      }),
    );

    assert.deepEqual(ids, []);
  },
);

serialTest(
  "declared components get default disabled/loading props without extra config",
  () => {
    const code = SAVE_PANEL_WITH_UNRENDERED_BUSY_PROP.replace(
      "busy={isSaving}",
      "disabled={isSaving}",
    );

    const ids = warningIds(
      lintWithApplyRule(code, {
        uxlintFile: {
          version: 1,
          config: {
            designSystem: {
              components: {
                SaveBadge: {},
              },
            },
          },
          rules: [],
        },
      }),
    );

    assert.deepEqual(ids, []);
  },
);

serialTest(
  "declared text-input role is checked for placeholder-only labels",
  () => {
    const ids = warningIds(
      lintWithApplyRule('const ui = <TextField placeholder="Email" />;', {
        uxlintFile: {
          version: 1,
          config: {
            designSystem: {
              components: {
                TextField: { role: "text-input" },
              },
            },
          },
          rules: [],
        },
      }),
    );

    assert.deepEqual(ids, ["INPUT-MOBILE-001"]);
  },
);

serialTest("custom labelProps satisfy the placeholder-only label rule", () => {
  const ids = warningIds(
    lintWithApplyRule(
      'const ui = <TextField caption="Email" placeholder="you@example.com" />;',
      {
        uxlintFile: {
          version: 1,
          config: {
            designSystem: {
              components: {
                TextField: { role: "text-input", labelProps: ["caption"] },
              },
            },
          },
          rules: [],
        },
      },
    ),
  );

  assert.deepEqual(ids, []);
});

serialTest("declared select roles participate in split-date detection", () => {
  const code = `
    function BirthDate() {
      return (
        <div>
          <AppSelect name="birth-month" />
          <AppSelect name="birth-day" />
          <AppSelect name="birth-year" />
        </div>
      );
    }
  `;

  const ids = warningIds(
    lintWithApplyRule(code, {
      uxlintFile: {
        version: 1,
        config: {
          designSystem: {
            components: {
              AppSelect: { role: "select" },
            },
          },
        },
        rules: [],
      },
    }),
  );

  assert.deepEqual(ids, ["INPUT-DATE-001"]);
});

serialTest("legacy fieldComponents arrays keep working", () => {
  const ids = warningIds(
    lintWithApplyRule('const ui = <TextField placeholder="Email" />;', {
      uxlintFile: {
        version: 1,
        config: {
          designSystem: {
            fieldComponents: ["TextField"],
          },
        },
        rules: [],
      },
    }),
  );

  assert.deepEqual(ids, ["INPUT-MOBILE-001"]);
});
