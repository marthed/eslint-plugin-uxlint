import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Linter } from "eslint";
import * as tsParserModule from "@typescript-eslint/parser";
import * as applyModule from "../src/rules/apply";

type HeuristicFile = {
  version: number;
  config?: Record<string, unknown>;
  rules: unknown[];
};

const EMPTY_UXLINT_FILE: HeuristicFile = {
  version: 1,
  rules: [],
};

const tsParser = (tsParserModule as any).default ?? tsParserModule;
const apply = (applyModule as any).default ?? applyModule;

function withTemporaryUXLintFile<T>(
  uxlintFile: HeuristicFile,
  run: () => T,
): T {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uxlint-tests-"));
  const prevCwd = process.cwd();

  try {
    fs.writeFileSync(
      path.join(tempDir, "uxlint.rules.json"),
      JSON.stringify(uxlintFile),
      "utf8",
    );
    process.chdir(tempDir);
    return run();
  } finally {
    process.chdir(prevCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export function lintWithApplyRule(
  code: string,
  options?: {
    filename?: string;
    uxlintFile?: HeuristicFile;
  },
) {
  const linter = new Linter();

  return withTemporaryUXLintFile(options?.uxlintFile ?? EMPTY_UXLINT_FILE, () =>
    linter.verify(
      code,
      [
        {
          files: ["**/*.{js,jsx,ts,tsx}"],
          languageOptions: {
            parser: tsParser,
            parserOptions: {
              ecmaVersion: "latest",
              sourceType: "module",
              ecmaFeatures: { jsx: true },
            },
          },
          plugins: {
            uxlint: {
              rules: { apply },
            },
          },
          rules: {
            "uxlint/apply": "warn",
          },
        },
      ],
      { filename: options?.filename ?? "test.tsx" },
    ),
  );
}

export function warningIds(messages: Array<{ message: string }>): string[] {
  return messages
    .map((message) => {
      const match = /^\[([A-Z0-9-]+)\]/.exec(message.message);
      return match?.[1] ?? null;
    })
    .filter((id): id is string => id !== null);
}
