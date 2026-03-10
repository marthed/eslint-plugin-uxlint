import assert from "node:assert/strict";
import test from "node:test";
import { lintWithApplyRule, warningIds } from "./lint-harness";

const IDS = {
  sync: "INTERACTION-SYNC-001",
  asyncStart: "INTERACTION-ASYNC-START-001",
  asyncSettled: "INTERACTION-ASYNC-SETTLED-001",
  asyncError: "INTERACTION-ASYNC-ERROR-001",
  asyncSuccess: "INTERACTION-ASYNC-SUCCESS-001",
  formMulti: "FORM-MULTI-001",
} as const;

function lintIds(code: string): string[] {
  return warningIds(lintWithApplyRule(code));
}

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

serialTest("reports sync interactions with no visible feedback", () => {
  const code = `
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

  assert.deepEqual(lintIds(code), [IDS.sync]);
});

serialTest("does not report sync interactions with visible feedback", () => {
  const code = `
    import React from "react";

    function SyncVisibleFeedback() {
      const [isOpen, setIsOpen] = React.useState(false);

      function handleClick() {
        setIsOpen(!isOpen);
      }

      return (
        <div>
          <button type="button" onClick={handleClick}>
            Toggle
          </button>
          <div>{isOpen ? "Open" : "Closed"}</div>
        </div>
      );
    }
  `;

  assert.deepEqual(lintIds(code), []);
});

serialTest("reports async interactions missing start feedback", () => {
  const code = `
    import React from "react";

    function MissingStart() {
      const [isSaving, setIsSaving] = React.useState(false);
      const [didSave, setDidSave] = React.useState(false);
      const [didFail, setDidFail] = React.useState(false);

      async function handleSave() {
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
          <button type="button" onClick={handleSave} disabled={isSaving}>
            Save
          </button>
          <div>{didSave && "Saved"}</div>
          <div>{didFail && "Failed"}</div>
        </div>
      );
    }

    async function fakeSave() {
      return true;
    }
  `;

  assert.deepEqual(lintIds(code), [IDS.asyncStart]);
});

serialTest("reports async interactions missing settled feedback", () => {
  const code = `
    import React from "react";

    function MissingSettled() {
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
        }
      }

      return (
        <div>
          <button type="button" onClick={handleSave} disabled={isSaving}>
            Save
          </button>
          <div>{didSave && "Saved"}</div>
          <div>{didFail && "Failed"}</div>
        </div>
      );
    }

    async function fakeSave() {
      return true;
    }
  `;

  assert.deepEqual(lintIds(code), [IDS.asyncSettled]);
});

serialTest("reports async interactions missing error feedback", () => {
  const code = `
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

  assert.deepEqual(lintIds(code), [IDS.asyncError]);
});

serialTest("reports async interactions missing success feedback", () => {
  const code = `
    import React from "react";

    function MissingSuccess() {
      const [isSaving, setIsSaving] = React.useState(false);
      const [didFail, setDidFail] = React.useState(false);

      async function handleSave() {
        setIsSaving(true);
        try {
          await fakeSave();
        } catch {
          setDidFail(true);
        } finally {
          setIsSaving(false);
        }
      }

      return (
        <div>
          <button type="button" onClick={handleSave} disabled={isSaving}>
            Save
          </button>
          <div>{didFail && "Failed"}</div>
        </div>
      );
    }

    async function fakeSave() {
      return true;
    }
  `;

  assert.deepEqual(lintIds(code), [IDS.asyncSuccess]);
});

serialTest(
  "does not report async warnings when all phases are visibly covered",
  () => {
    const code = `
    import React from "react";

    function AllAsyncPhasesVisible() {
      const [isSaving, setIsSaving] = React.useState(false);
      const [didSave, setDidSave] = React.useState(false);
      const [didFail, setDidFail] = React.useState(false);

      async function handleSave() {
        setIsSaving(true);
        setDidSave(false);
        setDidFail(false);
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
          <button type="button" onClick={handleSave} disabled={isSaving}>
            Save
          </button>
          <div>{didSave && "Saved"}</div>
          <div>{didFail && "Failed"}</div>
        </div>
      );
    }

    async function fakeSave() {
      return true;
    }
  `;

    assert.deepEqual(lintIds(code), []);
  },
);

serialTest(
  "classifies post-await pending clears as settled feedback (not success)",
  () => {
    const code = `
      import React from "react";

      function SettledFromPendingClear() {
        const [isSaving, setIsSaving] = React.useState(false);
        const [didFail, setDidFail] = React.useState(false);

        async function handleSave() {
          setIsSaving(true);
          try {
            await fakeSave();
          } catch {
            setDidFail(true);
          }
          setIsSaving(false);
        }

        return (
          <div>
            <button type="button" onClick={handleSave} disabled={isSaving}>
              Save
            </button>
            <div>{didFail && "Failed"}</div>
          </div>
        );
      }

      async function fakeSave() {
        return true;
      }
    `;

    assert.deepEqual(lintIds(code), [IDS.asyncSuccess]);
  },
);

serialTest(
  "does not report false positives for delegated wrapper handlers",
  () => {
    const code = `
      import React from "react";

      function DelegatedHandler() {
        const [isOpen, setIsOpen] = React.useState(false);

        function handleToggle() {
          setIsOpen((prev) => !prev);
        }

        return (
          <div>
            <button type="button" onClick={() => handleToggle()}>
              Toggle
            </button>
            <div>{isOpen && "Open"}</div>
          </div>
        );
      }
    `;

    assert.deepEqual(lintIds(code), []);
  },
);

serialTest("does not report false positives for inline handlers", () => {
  const code = `
    import React from "react";

    function InlineHandler() {
      const [isOpen, setIsOpen] = React.useState(false);

      return (
        <div>
          <button type="button" onClick={() => setIsOpen((prev) => !prev)}>
            Toggle
          </button>
          <div>{isOpen && "Open"}</div>
        </div>
      );
    }
  `;

  assert.deepEqual(lintIds(code), []);
});

serialTest(
  "reports settled warning when loading state is passed to a child but never visibly read",
  () => {
    const code = `
      import React from "react";

      function ParentBad() {
        const [isSaving, setIsSaving] = React.useState(false);
        const [didSave, setDidSave] = React.useState(false);
        const [didFail, setDidFail] = React.useState(false);

        async function handleSave() {
          setIsSaving(true);
          setDidSave(false);
          try {
            await fakeSave();
            setDidSave(true);
          } catch {
            setDidFail(true);
          }
          setIsSaving(false);
        }

        return (
          <div>
            <button type="button" onClick={handleSave}>
              Save
            </button>
            <SaveBadgeBad loading={isSaving} />
            <div>{didSave && "Saved"}</div>
            <div>{didFail && "Failed"}</div>
          </div>
        );
      }

      function SaveBadgeBad({ loading: _loading }: { loading: boolean }) {
        return <div>Idle</div>;
      }

      async function fakeSave() {
        return true;
      }
    `;

    assert.deepEqual(lintIds(code), [IDS.asyncSettled]);
  },
);

serialTest(
  "does not report settled warning when child props make pending state visibly readable",
  () => {
    const code = `
      import React from "react";

      function ParentGood() {
        const [isSaving, setIsSaving] = React.useState(false);
        const [didSave, setDidSave] = React.useState(false);
        const [didFail, setDidFail] = React.useState(false);

        async function handleSave() {
          setIsSaving(true);
          setDidSave(false);
          try {
            await fakeSave();
            setDidSave(true);
          } catch {
            setDidFail(true);
          }
          setIsSaving(false);
        }

        return (
          <div>
            <button type="button" onClick={handleSave}>
              Save
            </button>
            <SaveBadgeGood loading={isSaving} />
            <div>{didSave && "Saved"}</div>
            <div>{didFail && "Failed"}</div>
          </div>
        );
      }

      function SaveBadgeGood({ loading }: { loading: boolean }) {
        return <div>{loading ? "Saving..." : "Idle"}</div>;
      }

      async function fakeSave() {
        return true;
      }
    `;

    assert.deepEqual(lintIds(code), []);
  },
);

serialTest(
  "reports FORM-MULTI-001 for forms with submit and no error state",
  () => {
    const code = `
    function FormMissingErrorState() {
      return (
        <form>
          <input name="email" />
          <button type="submit">Save</button>
        </form>
      );
    }
  `;

    assert.deepEqual(lintIds(code), [IDS.formMulti]);
  },
);

serialTest(
  "does not report FORM-MULTI-001 when forms expose an error indicator",
  () => {
    const code = `
    function FormWithErrorState() {
      return (
        <form>
          <input name="email" />
          <button type="submit">Save</button>
          <div role="alert">Please check your input.</div>
        </form>
      );
    }
  `;

    assert.deepEqual(lintIds(code), []);
  },
);
