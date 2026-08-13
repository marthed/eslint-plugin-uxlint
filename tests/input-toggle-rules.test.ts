import assert from "node:assert/strict";
import test from "node:test";
import { lintWithApplyRule, warningIds } from "./lint-harness";

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

const TOGGLE_001 = "INPUT-TOGGLE-001";
const TOGGLE_002 = "INPUT-TOGGLE-002";

// A bare checkbox (even role="switch") without an associated label also
// trips INPUT-CHOICE-005, and a form with a submit control but no error
// indicator trips FORM-MULTI-001 — both correct, but unrelated to what
// these tests check, so isolate the toggle rules by turning them off.
function lintToggleFixture(
  code: string,
  designSystem?: Record<string, unknown>,
) {
  return warningIds(
    lintWithApplyRule(code, {
      uxlintFile: {
        version: 1,
        config: {
          builtinRules: {
            "INPUT-CHOICE-005": "off",
            "FORM-MULTI-001": "off",
          },
          ...(designSystem ? { designSystem } : {}),
        },
        rules: [],
      },
    }),
  );
}

function nativeSwitch(initializer: string) {
  return `
    import React from "react";

    function Settings() {
      const [mode, setMode] = React.useState(${initializer});

      return (
        <input
          type="checkbox"
          role="switch"
          checked={mode}
          onChange={() => setMode(!mode)}
        />
      );
    }
  `;
}

serialTest("boolean-bound native switch does not report TOGGLE-001", () => {
  assert.deepEqual(lintToggleFixture(nativeSwitch("false")), []);
});

serialTest("string-bound native switch reports TOGGLE-001", () => {
  assert.deepEqual(lintToggleFixture(nativeSwitch('"light"')), [TOGGLE_001]);
});

serialTest("array-bound native switch reports TOGGLE-001", () => {
  assert.deepEqual(lintToggleFixture(nativeSwitch("[]")), [TOGGLE_001]);
});

serialTest("Set-bound native switch reports TOGGLE-001", () => {
  assert.deepEqual(lintToggleFixture(nativeSwitch("new Set()")), [TOGGLE_001]);
});

serialTest("number-bound native switch reports TOGGLE-001", () => {
  assert.deepEqual(lintToggleFixture(nativeSwitch("0")), [TOGGLE_001]);
});

serialTest(
  "switch bound to a prop (no local useState) does not report TOGGLE-001",
  () => {
    const code = `
      function Settings({ mode, onChange }: { mode: boolean; onChange: () => void }) {
        return (
          <input type="checkbox" role="switch" checked={mode} onChange={onChange} />
        );
      }
    `;

    assert.deepEqual(lintToggleFixture(code), []);
  },
);

serialTest("plain checkbox without role=switch is not evaluated at all", () => {
  const code = `
    import React from "react";

    function Settings() {
      const [mode, setMode] = React.useState("light");

      return (
        <input type="checkbox" checked={Boolean(mode)} onChange={() => setMode("dark")} />
      );
    }
  `;

  assert.deepEqual(lintToggleFixture(code), []);
});

serialTest(
  "declared design-system switch honors configured checkedProp",
  () => {
    const code = `
    import React from "react";

    function Settings() {
      const [mode, setMode] = React.useState(["dark", "light"]);

      return <ThemeSwitch on={mode} onToggle={() => setMode([])} />;
    }
  `;

    const ids = lintToggleFixture(code, {
      components: { ThemeSwitch: { role: "switch", checkedProps: ["on"] } },
    });

    assert.deepEqual(ids, [TOGGLE_001]);
  },
);

serialTest(
  "switch inside a form with a submit control reports TOGGLE-002",
  () => {
    const code = `
    import React from "react";

    function SettingsForm() {
      const [enabled, setEnabled] = React.useState(false);

      return (
        <form>
          <input
            type="checkbox"
            role="switch"
            checked={enabled}
            onChange={() => setEnabled(!enabled)}
          />
          <button type="submit">Save</button>
        </form>
      );
    }
  `;

    assert.deepEqual(lintToggleFixture(code), [TOGGLE_002]);
  },
);

serialTest(
  "switch inside a form without a submit control does not report TOGGLE-002",
  () => {
    const code = `
      import React from "react";

      function SettingsForm() {
        const [enabled, setEnabled] = React.useState(false);

        return (
          <form>
            <input
              type="checkbox"
              role="switch"
              checked={enabled}
              onChange={() => setEnabled(!enabled)}
            />
          </form>
        );
      }
    `;

    assert.deepEqual(lintToggleFixture(code), []);
  },
);

serialTest("switch outside any form does not report TOGGLE-002", () => {
  const code = `
    import React from "react";

    function Settings() {
      const [enabled, setEnabled] = React.useState(false);

      return (
        <input
          type="checkbox"
          role="switch"
          checked={enabled}
          onChange={() => setEnabled(!enabled)}
        />
      );
    }
  `;

  assert.deepEqual(lintToggleFixture(code), []);
});

serialTest(
  "a plain checkbox (not a switch) inside a submit-gated form does not report TOGGLE-002",
  () => {
    const code = `
      import React from "react";

      function SignupForm() {
        const [agreed, setAgreed] = React.useState(false);

        return (
          <form>
            <input
              type="checkbox"
              checked={agreed}
              onChange={() => setAgreed(!agreed)}
            />
            <button type="submit">Sign up</button>
          </form>
        );
      }
    `;

    assert.deepEqual(lintToggleFixture(code), []);
  },
);

serialTest(
  "declared design-system switch inside a submit-gated form reports TOGGLE-002",
  () => {
    const code = `
      import React from "react";

      function SettingsForm() {
        const [enabled, setEnabled] = React.useState(false);

        return (
          <form>
            <ThemeSwitch on={enabled} onToggle={() => setEnabled(!enabled)} />
            <button type="submit">Save</button>
          </form>
        );
      }
    `;

    const ids = lintToggleFixture(code, {
      components: { ThemeSwitch: { role: "switch", checkedProps: ["on"] } },
    });

    assert.deepEqual(ids, [TOGGLE_002]);
  },
);

// A switch that reveals more of the form already takes effect immediately,
// so INPUT-TOGGLE-002's "changes are deferred" premise does not hold.
serialTest(
  "INPUT-TOGGLE-002 exempts a switch that gates conditional content",
  () => {
    const code = `
    import React from "react";

    function BountyForm() {
      const [hasStartDate, setHasStartDate] = React.useState(false);

      return (
        <form onSubmit={save}>
          <input
            type="checkbox"
            role="switch"
            checked={hasStartDate}
            onChange={() => setHasStartDate(!hasStartDate)}
          />
          {hasStartDate && <input type="date" name="startsAt" />}
          <button type="submit">Save</button>
        </form>
      );
    }
  `;

    assert.deepEqual(lintToggleFixture(code), []);
  },
);

serialTest("INPUT-TOGGLE-002 exempts a ternary-driven disclosure", () => {
  const code = `
    import React from "react";

    function BountyForm() {
      const [hasStartDate, setHasStartDate] = React.useState(false);

      return (
        <form onSubmit={save}>
          <div style={{ height: hasStartDate ? "auto" : "0px" }}>
            <input type="date" name="startsAt" />
          </div>
          <input
            type="checkbox"
            role="switch"
            checked={hasStartDate}
            onChange={() => setHasStartDate(!hasStartDate)}
          />
          <button type="submit">Save</button>
        </form>
      );
    }
  `;

  assert.deepEqual(lintToggleFixture(code), []);
});

serialTest(
  "INPUT-TOGGLE-002 still reports a switch that only holds a setting",
  () => {
    const code = `
    import React from "react";

    function SettingsForm() {
      const [emailAlerts, setEmailAlerts] = React.useState(false);

      return (
        <form onSubmit={save}>
          <input
            type="checkbox"
            role="switch"
            checked={emailAlerts}
            onChange={() => setEmailAlerts(!emailAlerts)}
          />
          <input name="displayName" />
          <button type="submit">Save</button>
        </form>
      );
    }
  `;

    assert.deepEqual(lintToggleFixture(code), [TOGGLE_002]);
  },
);
