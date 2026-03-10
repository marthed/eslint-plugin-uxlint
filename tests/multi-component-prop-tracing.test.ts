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
  "src/service.ts": `
    export function runSave(setDidSave) {
      setDidSave(true);
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

serialTest(
  "reports violations when interaction handler and state visibility span files/components",
  () => {
    const ids = lintIds({
      entryFilePath: "src/Root.tsx",
      files: {
        ...SHARED_FILES,
        "src/Root.tsx": `
          import React from "react";
          import { runSave } from "./service";
          import { LevelOne } from "./levels/LevelOne";

          export function Root() {
            const [didSave, setDidSave] = React.useState(false);

            function handleSave() {
              runSave(setDidSave);
            }

            function onSave() {
              handleSave();
            }

            return <LevelOne onSave={onSave} didSave={didSave} />;
          }
        `,
        "src/levels/LevelFour.tsx": `
          export function LevelFour({ onSave }) {
            return (
              <button type="button" onClick={onSave}>
                Save
              </button>
            );
          }
        `,
      },
    });

    assert.deepEqual(ids, [IDS.sync]);
  },
);

serialTest(
  "does not report when deep child visibly renders forwarded state",
  () => {
    const ids = lintIds({
      entryFilePath: "src/Root.tsx",
      files: {
        ...SHARED_FILES,
        "src/Root.tsx": `
          import React from "react";
          import { runSave } from "./service";
          import { LevelOne } from "./levels/LevelOne";

          export function Root() {
            const [didSave, setDidSave] = React.useState(false);

            function handleSave() {
              runSave(setDidSave);
            }

            function onSave() {
              handleSave();
            }

            return <LevelOne onSave={onSave} didSave={didSave} />;
          }
        `,
        "src/levels/LevelFour.tsx": `
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
        `,
      },
    });

    assert.deepEqual(ids, []);
  },
);
