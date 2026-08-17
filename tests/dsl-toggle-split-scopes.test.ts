import assert from "node:assert/strict";
import test from "node:test";
import { lintWithApplyRule, warningIds } from "./lint-harness";

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

const DESIGN_SYSTEM = {
  components: {
    AppSwitch: { role: "switch" },
    AppSplitButton: { role: "split-button" },
  },
};

// The built-in packs are turned off so each test shows the DSL rule firing on
// its own, which is the point of the scopes: a team can replace them.
function lintWithRule(
  code: string,
  rule: Record<string, unknown>,
  builtinRules: Record<string, string>,
) {
  return warningIds(
    lintWithApplyRule(code, {
      uxlintFile: {
        version: 1,
        config: { designSystem: DESIGN_SYSTEM, builtinRules },
        rules: [rule],
      },
    }),
  );
}

const SWITCH_IN_SUBMIT_FORM_RULE = {
  id: "TEAM-TOGGLE-001",
  title: "Switches must apply immediately",
  severity: "warn",
  appliesTo: ["ToggleControl"],
  when: {
    all: [
      { eq: ["toggle.isInsideSubmitForm", true] },
      { eq: ["toggle.controlsConditionalRender", false] },
    ],
  },
  report: { message: "Use a checkbox when the change is deferred to Submit." },
};

serialTest("a DSL ToggleControl rule can replace INPUT-TOGGLE-002", () => {
  const code = `
    import React from "react";

    function SettingsForm() {
      const [emailAlerts, setEmailAlerts] = React.useState(false);

      return (
        <form action="/settings">
          <AppSwitch
            checked={emailAlerts}
            onChange={() => setEmailAlerts(!emailAlerts)}
            label="Email alerts"
          />
          <p role="alert">Could not save.</p>
          <button type="submit">Save</button>
        </form>
      );
    }
  `;

  assert.deepEqual(
    lintWithRule(code, SWITCH_IN_SUBMIT_FORM_RULE, {
      "INPUT-TOGGLE-002": "off",
    }),
    ["TEAM-TOGGLE-001"],
  );
});

serialTest("ToggleControl rules see the disclosure fact", () => {
  // Same form, but the switch gates other content, so the rule's second
  // condition is false and it stays quiet.
  const code = `
    import React from "react";

    function BountyForm() {
      const [hasStartDate, setHasStartDate] = React.useState(false);

      return (
        <form action="/bounties">
          <AppSwitch
            checked={hasStartDate}
            onChange={() => setHasStartDate(!hasStartDate)}
            label="Set a start date"
          />
          {hasStartDate && <input type="date" name="startsAt" />}
          <p role="alert">Could not save.</p>
          <button type="submit">Save</button>
        </form>
      );
    }
  `;

  assert.deepEqual(
    lintWithRule(code, SWITCH_IN_SUBMIT_FORM_RULE, {
      "INPUT-TOGGLE-002": "off",
    }),
    [],
  );
});

serialTest("ToggleControl rules can match the bound value shape", () => {
  const rule = {
    id: "TEAM-TOGGLE-002",
    title: "Switches must be boolean",
    severity: "warn",
    appliesTo: ["ToggleControl"],
    when: { eq: ["toggle.boundValueShape", "non-boolean"] },
    report: { message: "A switch should hold a boolean." },
  };

  const code = `
    import React from "react";

    function ThemeToggle() {
      const [theme, setTheme] = React.useState("light");
      return <AppSwitch checked={theme} onChange={setTheme} label="Theme" />;
    }
  `;

  assert.deepEqual(lintWithRule(code, rule, { "INPUT-TOGGLE-001": "off" }), [
    "TEAM-TOGGLE-002",
  ]);
});

serialTest("a DSL SplitButton rule can replace INPUT-SPLIT-001", () => {
  const rule = {
    id: "TEAM-SPLIT-001",
    title: "Split buttons need a default action",
    severity: "warn",
    appliesTo: ["SplitButton"],
    when: { eq: ["splitButton.hasPrimaryAction", false] },
    report: { message: "Give the split button a default action." },
  };

  const code = `
    const ui = <AppSplitButton items={["Duplicate", "Archive"]} />;
  `;

  assert.deepEqual(lintWithRule(code, rule, { "INPUT-SPLIT-001": "off" }), [
    "TEAM-SPLIT-001",
  ]);
});

serialTest(
  "SplitButton rules see the component name and navigation fact",
  () => {
    const rule = {
      id: "TEAM-SPLIT-002",
      title: "Split buttons are for commands",
      severity: "warn",
      appliesTo: ["SplitButton"],
      when: {
        all: [
          { eq: ["splitButton.componentName", "AppSplitButton"] },
          { eq: ["splitButton.navigatesToRoute", true] },
        ],
      },
      report: { message: "Use a link when the action navigates." },
    };

    const code = `
    const ui = (
      <AppSplitButton label="Open" href="/reports/42" items={["New tab"]} />
    );
  `;

    assert.deepEqual(lintWithRule(code, rule, { "INPUT-SPLIT-002": "off" }), [
      "TEAM-SPLIT-002",
    ]);
  },
);
