import assert from "node:assert/strict";
import test from "node:test";
import { lintProjectWithApplyRule, warningIds } from "./lint-harness";

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

function lintIds(options: {
  entryFilePath: string;
  files: Record<string, string>;
}): string[] {
  return warningIds(lintProjectWithApplyRule(options));
}

serialTest(
  "traces async state writes through named imports across files",
  () => {
    const ids = lintIds({
      entryFilePath: "src/ProfilePage.tsx",
      files: {
        "src/ProfilePage.tsx": `
          import React from "react";
          import { runSave as executeSave } from "./save-profile";

          export function ProfilePage() {
            const [isSaving, setIsSaving] = React.useState(false);
            const [didSave, setDidSave] = React.useState(false);
            const [didFail, setDidFail] = React.useState(false);

            async function handleSave() {
              setDidSave(false);
              setDidFail(false);
              await executeSave(setIsSaving, setDidSave, setDidFail);
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
        `,
        "src/save-profile.ts": `
          export async function runSave(setIsSaving, setDidSave, setDidFail) {
            setIsSaving(true);
            try {
              await performSave(setDidSave);
            } catch {
              setDidFail(true);
            } finally {
              setIsSaving(false);
            }
          }

          async function performSave(setDidSave) {
            await fakeSave();
            setDidSave(true);
          }

          async function fakeSave() {
            return true;
          }
        `,
      },
    });

    assert.deepEqual(ids, []);
  },
);
