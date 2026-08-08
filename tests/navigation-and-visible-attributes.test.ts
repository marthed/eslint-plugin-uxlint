import assert from "node:assert/strict";
import test from "node:test";
import { lintWithApplyRule, warningIds } from "./lint-harness";

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

serialTest("router.push after await counts as outcome feedback", () => {
  const code = `
    import React from "react";

    function CheckoutButton() {
      const router = useRouter();
      const [isLoading, setIsLoading] = React.useState(false);

      async function onClick() {
        setIsLoading(true);
        const session = await createSession();
        router.push(session.url);
      }

      return (
        <button type="button" onClick={onClick} disabled={isLoading}>
          Checkout
        </button>
      );
    }

    function useRouter(): any {
      return {};
    }

    async function createSession() {
      return { url: "/done" };
    }
  `;

  assert.deepEqual(warningIds(lintWithApplyRule(code)), []);
});

serialTest("window.location.href assignment counts as feedback", () => {
  const code = `
    import React from "react";

    function BillingButton() {
      const [isLoading, setIsLoading] = React.useState(false);

      async function onClick() {
        setIsLoading(true);
        const session = await createSession();
        window.location.href = session.url;
      }

      return (
        <button type="button" onClick={onClick} disabled={isLoading}>
          Manage billing
        </button>
      );
    }

    async function createSession() {
      return { url: "/billing" };
    }
  `;

  assert.deepEqual(warningIds(lintWithApplyRule(code)), []);
});

serialTest("navigate() from a routing hook counts as feedback", () => {
  const code = `
    import React from "react";

    function SaveButton() {
      const navigate = useNavigate();
      const [isSaving, setIsSaving] = React.useState(false);

      async function onClick() {
        setIsSaving(true);
        await fakeSave();
        navigate("/list");
      }

      return (
        <button type="button" onClick={onClick} disabled={isSaving}>
          Save
        </button>
      );
    }

    function useNavigate(): any {
      return () => {};
    }

    async function fakeSave() {
      return true;
    }
  `;

  assert.deepEqual(warningIds(lintWithApplyRule(code)), []);
});

serialTest("unrelated method calls named push do not count", () => {
  const code = `
    import React from "react";

    function QueueButton() {
      const [isSaving, setIsSaving] = React.useState(false);
      const items: string[] = [];

      async function onClick() {
        setIsSaving(true);
        await fakeSave();
        items.push("done");
      }

      return (
        <button type="button" onClick={onClick} disabled={isSaving}>
          Queue
        </button>
      );
    }

    async function fakeSave() {
      return true;
    }
  `;

  // Outcome phases stay uncovered because Array#push is not navigation.
  // Settled is also missing here since isSaving is never cleared.
  assert.deepEqual(warningIds(lintWithApplyRule(code)), [
    "INTERACTION-ASYNC-SETTLED-001",
    "INTERACTION-ASYNC-ERROR-001",
    "INTERACTION-ASYNC-SUCCESS-001",
  ]);
});

serialTest("state rendered into a host src attribute is visible", () => {
  const code = `
    import React from "react";

    function ExportButton() {
      const [blobUrl, setBlobUrl] = React.useState("");
      const [isBusy, setIsBusy] = React.useState(false);

      async function onClick() {
        setIsBusy(true);
        const url = await fakeExport();
        setBlobUrl(url);
        setIsBusy(false);
      }

      return (
        <div>
          <button type="button" onClick={onClick} disabled={isBusy}>
            Export
          </button>
          <img src={blobUrl} alt="" />
        </div>
      );
    }

    async function fakeExport() {
      return "blob:1";
    }
  `;

  assert.deepEqual(warningIds(lintWithApplyRule(code)), [
    "INTERACTION-ASYNC-ERROR-001",
  ]);
});

serialTest("state rendered into className is visible", () => {
  const code = `
    import React from "react";

    function ToggleButton() {
      const [isActive, setIsActive] = React.useState(false);

      function onClick() {
        setIsActive(!isActive);
      }

      return (
        <button
          type="button"
          onClick={onClick}
          className={isActive ? "on" : "off"}
        >
          Toggle
        </button>
      );
    }
  `;

  assert.deepEqual(warningIds(lintWithApplyRule(code)), []);
});

serialTest("non-visual attributes do not count as visible feedback", () => {
  const code = `
    import React from "react";

    function TrackedButton() {
      const [clickId, setClickId] = React.useState("");

      function onClick() {
        setClickId("a");
      }

      return (
        <button type="button" onClick={onClick} data-click-id={clickId}>
          Track
        </button>
      );
    }
  `;

  assert.deepEqual(warningIds(lintWithApplyRule(code)), [
    "INTERACTION-SYNC-001",
  ]);
});

serialTest(
  "settled is not reported when no pending cue exists (start covers it)",
  () => {
    const code = `
      import React from "react";

      function SaveButton() {
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
            <button type="button" onClick={handleSave}>
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

    // isSaving is written but never rendered: start is missing, so the
    // settled finding is suppressed as a duplicate of the same root cause.
    assert.deepEqual(warningIds(lintWithApplyRule(code)), [
      "INTERACTION-ASYNC-START-001",
    ]);
  },
);

serialTest("settled is still reported when a pending cue exists", () => {
  const code = `
    import React from "react";

    function SaveButton() {
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

  assert.deepEqual(warningIds(lintWithApplyRule(code)), [
    "INTERACTION-ASYNC-SETTLED-001",
  ]);
});
