import assert from "node:assert/strict";
import test from "node:test";
import { lintProjectWithApplyRule, warningIds } from "./lint-harness";

const IDS = {
  asyncStart: "INTERACTION-ASYNC-START-001",
  asyncSettled: "INTERACTION-ASYNC-SETTLED-001",
  asyncError: "INTERACTION-ASYNC-ERROR-001",
  asyncSuccess: "INTERACTION-ASYNC-SUCCESS-001",
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
  "src/service.ts": `
    export async function runSave(setIsSaving, setDidSave, setDidFail) {
      setIsSaving(true);
      try {
        await Promise.resolve();
        setDidSave(true);
      } catch {
        setDidFail(true);
      } finally {
        setIsSaving(false);
      }
    }
  `,
  "src/levels/LevelOne.tsx": `
    import { LevelTwo } from "./LevelTwo";

    export function LevelOne(props) {
      return <LevelTwo {...props} />;
    }
  `,
  "src/levels/LevelTwo.tsx": `
    import { LevelThree } from "./LevelThree";

    export function LevelTwo(props) {
      return <LevelThree {...props} />;
    }
  `,
  "src/levels/LevelThree.tsx": `
    import { LevelFour } from "./LevelFour";

    export function LevelThree(props) {
      return <LevelFour {...props} />;
    }
  `,
} as const;

function lintAsyncDownwardIds(levelFourSource: string): string[] {
  return lintIds({
    entryFilePath: "src/Root.tsx",
    files: {
      ...SHARED_FILES,
      "src/Root.tsx": `
        import React from "react";
        import { runSave } from "./service";
        import { LevelOne } from "./levels/LevelOne";

        export function Root() {
          const [isSaving, setIsSaving] = React.useState(false);
          const [didSave, setDidSave] = React.useState(false);
          const [didFail, setDidFail] = React.useState(false);

          async function handleSave() {
            setDidSave(false);
            setDidFail(false);
            await runSave(setIsSaving, setDidSave, setDidFail);
          }

          function onSave() {
            void handleSave();
          }

          return (
            <LevelOne
              onSave={onSave}
              isSaving={isSaving}
              didSave={didSave}
              didFail={didFail}
            />
          );
        }
      `,
      "src/levels/LevelFour.tsx": levelFourSource,
    },
  });
}

serialTest(
  "reports all async phase warnings when forwarded async state is never visibly rendered",
  () => {
    const ids = lintAsyncDownwardIds(`
      export function LevelFour({ onSave }) {
        return (
          <button type="button" onClick={onSave}>
            Save
          </button>
        );
      }
    `);

    assert.deepEqual(ids, [
      IDS.asyncStart,
      IDS.asyncSettled,
      IDS.asyncError,
      IDS.asyncSuccess,
    ]);
  },
);

serialTest(
  "reports missing async phases when only loading state is visibly rendered through deep children",
  () => {
    const ids = lintAsyncDownwardIds(`
      export function LevelFour({ onSave, isSaving }) {
        return (
          <div>
            <button type="button" onClick={onSave}>
              Save
            </button>
            <div>{isSaving ? "Saving..." : "Idle"}</div>
          </div>
        );
      }
    `);

    assert.deepEqual(ids, [IDS.asyncError, IDS.asyncSuccess]);
  },
);

serialTest(
  "reports missing async phases when only success state is visibly rendered through deep children",
  () => {
    const ids = lintAsyncDownwardIds(`
      export function LevelFour({ onSave, didSave }) {
        return (
          <div>
            <button type="button" onClick={onSave}>
              Save
            </button>
            <div>{didSave && "Saved"}</div>
          </div>
        );
      }
    `);

    assert.deepEqual(ids, [IDS.asyncSettled, IDS.asyncError]);
  },
);

serialTest(
  "reports missing async phases when only failure state is visibly rendered through deep children",
  () => {
    const ids = lintAsyncDownwardIds(`
      export function LevelFour({ onSave, didFail }) {
        return (
          <div>
            <button type="button" onClick={onSave}>
              Save
            </button>
            <div>{didFail && "Failed"}</div>
          </div>
        );
      }
    `);

    assert.deepEqual(ids, [IDS.asyncSettled, IDS.asyncSuccess]);
  },
);

serialTest(
  "does not report async warnings when deep children visibly render all forwarded async state",
  () => {
    const ids = lintAsyncDownwardIds(`
      export function LevelFour({ onSave, isSaving, didSave, didFail }) {
        return (
          <div>
            <button type="button" onClick={onSave} disabled={isSaving}>
              Save
            </button>
            <div>{isSaving ? "Saving..." : ""}</div>
            <div>{didSave && "Saved"}</div>
            <div>{didFail && "Failed"}</div>
          </div>
        );
      }
    `);

    assert.deepEqual(ids, []);
  },
);
