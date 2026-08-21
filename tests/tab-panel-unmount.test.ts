import assert from "node:assert/strict";
import test from "node:test";
import { lintWithApplyRule, warningIds } from "./lint-harness";

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

const UNMOUNT = "TABS-UNMOUNT-001";

function lintIds(code: string): string[] {
  return warningIds(lintWithApplyRule(code));
}

serialTest("reports a tab panel gated by &&", () => {
  const code = `
    function Settings({ active }) {
      return (
        <div>
          <div role="tablist">
            <button role="tab" aria-selected={active === "profile"}>Profile</button>
          </div>
          {active === "profile" && (
            <div role="tabpanel">
              <input name="displayName" aria-label="Display name" />
            </div>
          )}
        </div>
      );
    }
  `;

  assert.deepEqual(lintIds(code), [UNMOUNT]);
});

serialTest("reports a tab panel gated by a ternary", () => {
  const code = `
    function Settings({ active }) {
      return (
        <div>
          {active === "profile" ? (
            <div role="tabpanel">Profile</div>
          ) : (
            <div role="tabpanel">Billing</div>
          )}
        </div>
      );
    }
  `;

  assert.deepEqual(lintIds(code), [UNMOUNT, UNMOUNT]);
});

serialTest("accepts a panel kept mounted with hidden", () => {
  const code = `
    function Settings({ active }) {
      return (
        <div>
          <div role="tabpanel" hidden={active !== "profile"}>
            <input name="displayName" aria-label="Display name" />
          </div>
          <div role="tabpanel" hidden={active !== "billing"}>Billing</div>
        </div>
      );
    }
  `;

  assert.deepEqual(lintIds(code), []);
});

// Conditional rendering is correct nearly everywhere else; the rule must not
// creep into it.
serialTest("does not report ordinary conditional rendering", () => {
  const code = `
    function Panel({ isOpen, error, items }) {
      return (
        <div>
          {isOpen && <div role="dialog">A modal should unmount</div>}
          {error && <p role="alert">{error}</p>}
          {items.length === 0 && <p>Nothing here yet</p>}
        </div>
      );
    }
  `;

  assert.deepEqual(lintIds(code), []);
});

serialTest("does not report an unconditional tab panel", () => {
  const code = `
    function Settings() {
      return <div role="tabpanel">Always here</div>;
    }
  `;

  assert.deepEqual(lintIds(code), []);
});

// A condition in a different component must not reach across into this one.
serialTest("a condition outside the component does not count", () => {
  const code = `
    function Wrapper({ show }) {
      return <div>{show && <Inner />}</div>;
    }

    function Inner() {
      return <div role="tabpanel">Panel</div>;
    }
  `;

  assert.deepEqual(lintIds(code), []);
});

// The rule is only reachable on real code through a declaration, because
// role="tabpanel" has all but vanished from source in favour of library
// components that set it at runtime.
serialTest("a declared tab-panel component is recognised", () => {
  const code = `
    function Settings({ active }) {
      return (
        <Tabs value={active}>
          {active === "profile" && (
            <TabsContent value="profile">
              <input name="displayName" aria-label="Display name" />
            </TabsContent>
          )}
        </Tabs>
      );
    }
  `;

  const ids = warningIds(
    lintWithApplyRule(code, {
      uxlintFile: {
        version: 1,
        config: {
          designSystem: { components: { TabsContent: { role: "tab-panel" } } },
        },
        rules: [],
      },
    }),
  );

  assert.deepEqual(ids, [UNMOUNT]);
});

serialTest("forceMount keeps a declared panel in the DOM", () => {
  const code = `
    function Settings({ active }) {
      return (
        <Tabs value={active}>
          {active === "profile" && (
            <TabsContent value="profile" forceMount>
              <input name="displayName" aria-label="Display name" />
            </TabsContent>
          )}
        </Tabs>
      );
    }
  `;

  const ids = warningIds(
    lintWithApplyRule(code, {
      uxlintFile: {
        version: 1,
        config: {
          designSystem: { components: { TabsContent: { role: "tab-panel" } } },
        },
        rules: [],
      },
    }),
  );

  assert.deepEqual(ids, []);
});
