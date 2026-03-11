import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { lintProjectWithApplyRule, warningIds } from "./lint-harness";

const IDS = {
  asyncStart: "INTERACTION-ASYNC-START-001",
  asyncSettled: "INTERACTION-ASYNC-SETTLED-001",
  asyncError: "INTERACTION-ASYNC-ERROR-001",
  asyncSuccess: "INTERACTION-ASYNC-SUCCESS-001",
} as const;

const REPO_ROOT = process.cwd();
const FRAMEWORK_ROOT = path.join(
  REPO_ROOT,
  "examples",
  "playground",
  "framework-adapters",
);

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

function readDirectoryFiles(
  directoryPath: string,
  targetPrefix: string,
): Record<string, string> {
  const files: Record<string, string> = {};

  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const absolutePath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      Object.assign(
        files,
        readDirectoryFiles(absolutePath, path.join(targetPrefix, entry.name)),
      );
      continue;
    }

    if (!entry.isFile()) continue;

    files[path.join(targetPrefix, entry.name)] = fs.readFileSync(
      absolutePath,
      "utf8",
    );
  }

  return files;
}

function lintFrameworkEntry(
  frameworkDirectory: string,
  entryRelativePath: string,
): string[] {
  const targetPrefix = path.join(
    "examples",
    "playground",
    "framework-adapters",
    frameworkDirectory,
  );
  const files = readDirectoryFiles(
    path.join(FRAMEWORK_ROOT, frameworkDirectory),
    targetPrefix,
  );
  const entryFilePath = path.join(targetPrefix, entryRelativePath);

  return warningIds(
    lintProjectWithApplyRule({
      entryFilePath,
      files,
    }),
  );
}

serialTest("React Query bad example reports missing success feedback", () => {
  const ids = lintFrameworkEntry(
    "react-query",
    path.join("components", "ReactQueryBadPanel.tsx"),
  );
  assert.deepEqual(ids, [IDS.asyncSuccess, IDS.asyncSuccess]);
});

serialTest("React Query good example reports no warnings", () => {
  const ids = lintFrameworkEntry(
    "react-query",
    path.join("components", "ReactQueryGoodPanel.tsx"),
  );
  assert.deepEqual(ids, []);
});

serialTest("Redux bad example reports missing error feedback", () => {
  const ids = lintFrameworkEntry(
    "redux",
    path.join("components", "ReduxBadPanel.tsx"),
  );
  assert.deepEqual(ids, [IDS.asyncError, IDS.asyncError]);
});

serialTest("Redux good example reports no warnings", () => {
  const ids = lintFrameworkEntry(
    "redux",
    path.join("components", "ReduxGoodPanel.tsx"),
  );
  assert.deepEqual(ids, []);
});

serialTest("Zustand bad example reports missing pending feedback", () => {
  const ids = lintFrameworkEntry(
    "zustand",
    path.join("components", "ZustandBadPanel.tsx"),
  );
  assert.deepEqual(ids, [
    IDS.asyncStart,
    IDS.asyncSettled,
    IDS.asyncStart,
    IDS.asyncSettled,
  ]);
});

serialTest("Zustand good example reports no warnings", () => {
  const ids = lintFrameworkEntry(
    "zustand",
    path.join("components", "ZustandGoodPanel.tsx"),
  );
  assert.deepEqual(ids, []);
});
