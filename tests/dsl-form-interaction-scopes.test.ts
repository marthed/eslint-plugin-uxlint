import assert from "node:assert/strict";
import test from "node:test";
import { lintWithApplyRule, warningIds } from "./lint-harness";

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

const FORM_ERROR_RULE = {
  id: "TEAM-FORM-001",
  title: "Forms that submit must show errors",
  severity: "warn",
  appliesTo: ["Form"],
  when: {
    all: [
      { eq: ["form.hasSubmitControl", true] },
      { eq: ["form.hasErrorIndicator", false] },
    ],
  },
  report: {
    message: "Forms that can submit must render an error path.",
  },
};

const ASYNC_ERROR_FEEDBACK_RULE = {
  id: "TEAM-INT-001",
  title: "Async interactions need error feedback",
  severity: "warn",
  appliesTo: ["Interaction"],
  when: {
    all: [
      { eq: ["interaction.isAsync", true] },
      { eq: ["interaction.writesState", true] },
      { eq: ["interaction.hasErrorFeedback", false] },
    ],
  },
  report: {
    message: "Show the user when this async action fails.",
  },
};

const ASYNC_MISSING_ERROR_COMPONENT = `
  import React from "react";

  function MissingError() {
    const [isSaving, setIsSaving] = React.useState(false);
    const [didSave, setDidSave] = React.useState(false);

    async function handleSave() {
      setIsSaving(true);
      try {
        await fakeSave();
        setDidSave(true);
      } finally {
        setIsSaving(false);
      }
    }

    return (
      <div>
        <button type="button" onClick={handleSave} disabled={isSaving}>
          Save
        </button>
        <div>{didSave && "Saved"}</div>
      </div>
    );
  }

  async function fakeSave() {
    return true;
  }
`;

serialTest("a Form DSL rule can replace the built-in form rule", () => {
  const code = `
    function ContactForm() {
      return (
        <form>
          <input name="email" />
          <button type="submit">Send</button>
        </form>
      );
    }
  `;

  const ids = warningIds(
    lintWithApplyRule(code, {
      uxlintFile: {
        version: 1,
        config: {
          builtinRules: { "FORM-MULTI-001": "off" },
        },
        rules: [FORM_ERROR_RULE],
      },
    }),
  );

  assert.deepEqual(ids, ["TEAM-FORM-001"]);
});

serialTest("Form DSL rules see error indicators", () => {
  const code = `
    function ContactForm() {
      return (
        <form>
          <input name="email" />
          <button type="submit">Send</button>
          <div role="alert">Please check your input.</div>
        </form>
      );
    }
  `;

  const ids = warningIds(
    lintWithApplyRule(code, {
      uxlintFile: {
        version: 1,
        config: {
          builtinRules: { "FORM-MULTI-001": "off" },
        },
        rules: [FORM_ERROR_RULE],
      },
    }),
  );

  assert.deepEqual(ids, []);
});

serialTest(
  "an Interaction DSL rule can replace a built-in async phase rule",
  () => {
    const ids = warningIds(
      lintWithApplyRule(ASYNC_MISSING_ERROR_COMPONENT, {
        uxlintFile: {
          version: 1,
          config: {
            builtinRules: { "INTERACTION-ASYNC-ERROR-001": "off" },
          },
          rules: [ASYNC_ERROR_FEEDBACK_RULE],
        },
      }),
    );

    assert.deepEqual(ids, ["TEAM-INT-001"]);
  },
);

serialTest("Interaction DSL rules see covered phases", () => {
  const code = ASYNC_MISSING_ERROR_COMPONENT.replace(
    "} finally {",
    `} catch {
        setDidFail(true);
      } finally {`,
  )
    .replace(
      "const [didSave, setDidSave] = React.useState(false);",
      `const [didSave, setDidSave] = React.useState(false);
    const [didFail, setDidFail] = React.useState(false);`,
    )
    .replace(
      '<div>{didSave && "Saved"}</div>',
      `<div>{didSave && "Saved"}</div>
        <div>{didFail && "Failed"}</div>`,
    );

  const ids = warningIds(
    lintWithApplyRule(code, {
      uxlintFile: {
        version: 1,
        config: {
          builtinRules: { "INTERACTION-ASYNC-ERROR-001": "off" },
        },
        rules: [ASYNC_ERROR_FEEDBACK_RULE],
      },
    }),
  );

  assert.deepEqual(ids, []);
});

serialTest("sync interactions without visible feedback are expressible", () => {
  const code = `
    import React from "react";

    function Toggle() {
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

  const ids = warningIds(
    lintWithApplyRule(code, {
      uxlintFile: {
        version: 1,
        config: {
          builtinRules: { "INTERACTION-SYNC-001": "off" },
        },
        rules: [
          {
            id: "TEAM-INT-002",
            title: "Interactions must respond visibly",
            severity: "warn",
            appliesTo: ["Interaction"],
            when: {
              all: [
                { eq: ["interaction.writesState", true] },
                { eq: ["interaction.hasVisibleFeedback", false] },
              ],
            },
            report: { message: "This action produces no visible response." },
          },
        ],
      },
    }),
  );

  assert.deepEqual(ids, ["TEAM-INT-002"]);
});
