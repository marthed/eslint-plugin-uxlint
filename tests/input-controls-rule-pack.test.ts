import assert from "node:assert/strict";
import test from "node:test";
import { lintWithApplyRule, warningIds } from "./lint-harness";

const IDS = {
  inputChoice004: "INPUT-CHOICE-004",
  inputChoice005: "INPUT-CHOICE-005",
  inputMobile001: "INPUT-MOBILE-001",
  inputDate001: "INPUT-DATE-001",
} as const;

function lintIds(code: string): string[] {
  return warningIds(lintWithApplyRule(code));
}

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

serialTest(
  "reports INPUT-CHOICE-005 for checkbox controls with no associated label",
  () => {
    const code = `
      function UnlabeledCheckbox() {
        return (
          <form>
            <input type="checkbox" name="updates" />
          </form>
        );
      }
    `;

    assert.deepEqual(lintIds(code), [IDS.inputChoice005]);
  },
);

serialTest(
  "does not report INPUT-CHOICE-005 when a radio is wrapped by a label",
  () => {
    const code = `
      function LabeledRadio() {
        return (
          <form>
            <label>
              <input type="radio" name="plan" value="pro" />
              Pro
            </label>
          </form>
        );
      }
    `;

    assert.deepEqual(lintIds(code), []);
  },
);

serialTest(
  "reports INPUT-CHOICE-004 for radio groups without a default or neutral option",
  () => {
    const code = `
      function RadioGroupNeedsDefault() {
        return (
          <form>
            <label htmlFor="contact-email">Email</label>
            <input id="contact-email" type="radio" name="contactMethod" value="email" />
            <label htmlFor="contact-phone">Phone</label>
            <input id="contact-phone" type="radio" name="contactMethod" value="phone" />
          </form>
        );
      }
    `;

    assert.deepEqual(lintIds(code), [IDS.inputChoice004]);
  },
);

serialTest(
  "does not report INPUT-CHOICE-004 when a radio group exposes a neutral option",
  () => {
    const code = `
      function RadioGroupWithNeutral() {
        return (
          <form>
            <label htmlFor="delivery-standard">Standard</label>
            <input id="delivery-standard" type="radio" name="delivery" value="standard" />
            <label htmlFor="delivery-express">Express</label>
            <input id="delivery-express" type="radio" name="delivery" value="express" />
            <label htmlFor="delivery-none">None</label>
            <input id="delivery-none" type="radio" name="delivery" value="none" />
          </form>
        );
      }
    `;

    assert.deepEqual(lintIds(code), []);
  },
);

serialTest(
  "reports INPUT-MOBILE-001 when placeholder text is the only visible label",
  () => {
    const code = `
      function PlaceholderOnlyField() {
        return (
          <form>
            <input type="email" name="email" placeholder="Email address" />
          </form>
        );
      }
    `;

    assert.deepEqual(lintIds(code), [IDS.inputMobile001]);
  },
);

serialTest(
  "does not report INPUT-MOBILE-001 when a text field has an external label",
  () => {
    const code = `
      function FieldWithLabel() {
        return (
          <form>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder="name@example.com"
            />
          </form>
        );
      }
    `;

    assert.deepEqual(lintIds(code), []);
  },
);

serialTest(
  "does not report INPUT-MOBILE-001 when aria-labelledby points to a label element",
  () => {
    const code = `
      function FieldWithAriaLabelledByLabel() {
        return (
          <form>
            <label id="username-label">Username</label>
            <input
              type="text"
              name="username"
              aria-labelledby="username-label"
              placeholder="Username"
            />
          </form>
        );
      }
    `;

    assert.deepEqual(lintIds(code), []);
  },
);

serialTest("reports INPUT-DATE-001 for split month/day/year dropdowns", () => {
  const code = `
      function SplitDateSelectors() {
        return (
          <form>
            <label htmlFor="birth-month">Birth month</label>
            <select id="birth-month" name="birthMonth" />
            <label htmlFor="birth-day">Birth day</label>
            <select id="birth-day" name="birthDay" />
            <label htmlFor="birth-year">Birth year</label>
            <select id="birth-year" name="birthYear" />
          </form>
        );
      }
    `;

  assert.deepEqual(lintIds(code), [IDS.inputDate001]);
});

serialTest(
  "does not report INPUT-DATE-001 for a single native date field",
  () => {
    const code = `
      function NativeDateField() {
        return (
          <form>
            <label htmlFor="birth-date">Birth date</label>
            <input id="birth-date" type="date" name="birthDate" />
          </form>
        );
      }
    `;

    assert.deepEqual(lintIds(code), []);
  },
);

// Design systems wrap the native <label>, so a field labelled by
// <FieldLabel htmlFor> would otherwise look like placeholder-as-label.
serialTest("treats design-system label components like a native label", () => {
  const code = `
      function LabelledByComponent() {
        return (
          <div>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" placeholder="you@example.com" />
          </div>
        );
      }
    `;

  const ids = warningIds(
    lintWithApplyRule(code, {
      uxlintFile: {
        version: 1,
        config: {
          designSystem: { fieldComponents: ["Input"] },
        },
        rules: [],
      },
    }),
  );

  assert.deepEqual(ids, []);
});

serialTest(
  "reports INPUT-MOBILE-001 when the label component is not configured",
  () => {
    const code = `
      function LabelledByUnknownComponent() {
        return (
          <div>
            <Caption htmlFor="email">Email</Caption>
            <Input id="email" placeholder="you@example.com" />
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
              fieldComponents: ["Input"],
              labelComponents: ["FieldLabel"],
            },
          },
          rules: [],
        },
      }),
    );

    assert.deepEqual(ids, [IDS.inputMobile001]);
  },
);

// <TextInput type="date" /> forwards type to a native date input, which has
// its own format affordance, so it is excluded like <input type="date" />.
serialTest(
  "does not report date guidance for a design-system field forwarding type=date",
  () => {
    const code = `
      function ForwardedDateType() {
        return <TextInput type="date" label="Birth date" placeholder="Birth date" />;
      }
    `;

    const ids = warningIds(
      lintWithApplyRule(code, {
        uxlintFile: {
          version: 1,
          config: {
            designSystem: { fieldComponents: ["TextInput"] },
          },
          rules: [],
        },
      }),
    );

    assert.deepEqual(ids, []);
  },
);
