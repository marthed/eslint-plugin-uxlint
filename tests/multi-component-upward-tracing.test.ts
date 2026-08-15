import assert from "node:assert/strict";
import test from "node:test";
import { lintProjectWithApplyRule, warningIds } from "./lint-harness";

const IDS = {
  sync: "INTERACTION-SYNC-001",
} as const;

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

function lintIds(options: {
  entryFilePath: string;
  files: Record<string, string>;
}): string[] {
  return warningIds(lintProjectWithApplyRule(options));
}

const SHARED_FILES = {
  "src/levels/LevelOne.tsx": `
    import { LevelTwo } from "./LevelTwo";

    export function LevelOne({ onAction }) {
      function handleAction(actionLabel) {
        onAction(\`Level 1 > \${actionLabel}\`);
      }

      return <LevelTwo onAction={handleAction} />;
    }
  `,
  "src/levels/LevelTwo.tsx": `
    import { LevelThree } from "./LevelThree";

    export function LevelTwo({ onAction }) {
      function handleAction(actionLabel) {
        onAction(\`Level 2 > \${actionLabel}\`);
      }

      return <LevelThree onAction={handleAction} />;
    }
  `,
  "src/levels/LevelThree.tsx": `
    import { LevelFour } from "./LevelFour";

    export function LevelThree({ onAction }) {
      function handleApprove() {
        onAction("Level 3 > Approve");
      }

      function handleReject() {
        onAction("Level 3 > Reject");
      }

      return (
        <LevelFour
          onApprove={handleApprove}
          onReject={handleReject}
        />
      );
    }
  `,
  "src/levels/LevelFour.tsx": `
    export function LevelFour({ onApprove, onReject }) {
      return (
        <div>
          <button type="button" onClick={onApprove}>
            Approve
          </button>
          <button type="button" onClick={onReject}>
            Reject
          </button>
        </div>
      );
    }
  `,
} as const;

serialTest(
  "reports sync violations through upward callback wrappers across files",
  () => {
    const ids = lintIds({
      entryFilePath: "src/Root.tsx",
      files: {
        ...SHARED_FILES,
        "src/Root.tsx": `
          import React from "react";
          import { LevelOne } from "./levels/LevelOne";

          export function Root() {
            const [history, setHistory] = React.useState([]);

            function recordAction(actionLabel) {
              setHistory((prevHistory) => [actionLabel, ...prevHistory]);
            }

            return <LevelOne onAction={recordAction} />;
          }
        `,
      },
    });

    assert.deepEqual(ids, [IDS.sync, IDS.sync]);
  },
);

serialTest(
  "does not report sync violations when upward callback effects are visibly rendered",
  () => {
    const ids = lintIds({
      entryFilePath: "src/Root.tsx",
      files: {
        ...SHARED_FILES,
        "src/Root.tsx": `
          import React from "react";
          import { LevelOne } from "./levels/LevelOne";

          export function Root() {
            const [history, setHistory] = React.useState([]);

            function recordAction(actionLabel) {
              setHistory((prevHistory) => [actionLabel, ...prevHistory]);
            }

            return (
              <div>
                <LevelOne onAction={recordAction} />
                <div>Total actions: {history.length}</div>
              </div>
            );
          }
        `,
      },
    });

    assert.deepEqual(ids, []);
  },
);

// Handing an outcome to a parent-supplied callback is feedback whose visible
// half lives in the parent. Every phase below is covered by rendered status
// except error, which is delegated -- so the error phase is what is under test.
//
// The parent is unresolvable here because linting a child never pulls its
// parents into the store. When the parent IS in scope -- traced down from the
// root through pass-through wrappers -- its own feedback is judged directly,
// which the upward-callback tests above cover.
serialTest(
  "does not report an outcome delegated to an unresolvable callback prop",
  () => {
    const ids = lintIds({
      entryFilePath: "src/Child.tsx",
      files: {
        "src/Child.tsx": `
          import React from "react";

          export function Child({ onError }) {
            const [status, setStatus] = React.useState("idle");

            const handleSave = async () => {
              setStatus("saving");
              try {
                await save();
                setStatus("saved");
              } catch (error) {
                onError(error);
              } finally {
                setStatus("idle");
              }
            };

            return (
              <div>
                <p>{status}</p>
                <button onClick={handleSave}>Save</button>
              </div>
            );
          }
        `,
      },
    });

    assert.deepEqual(ids, []);
  },
);
