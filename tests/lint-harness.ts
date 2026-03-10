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

function createApplyRuleConfig() {
  return [
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
  ];
}

function writeProjectFiles(
  rootDirectory: string,
  files: Record<string, string>,
) {
  for (const [projectFilePath, content] of Object.entries(files)) {
    const absoluteFilePath = path.resolve(rootDirectory, projectFilePath);
    fs.mkdirSync(path.dirname(absoluteFilePath), { recursive: true });
    fs.writeFileSync(absoluteFilePath, content, "utf8");
  }
}

function withTemporaryProject<T>(
  uxlintFile: HeuristicFile,
  files: Record<string, string>,
  run: (tempDir: string) => T,
): T {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uxlint-tests-"));
  const prevCwd = process.cwd();

  try {
    fs.writeFileSync(
      path.join(tempDir, "uxlint.rules.json"),
      JSON.stringify(uxlintFile),
      "utf8",
    );
    writeProjectFiles(tempDir, files);
    process.chdir(tempDir);
    return run(tempDir);
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
  const entryFilePath = options?.filename ?? "test.tsx";

  return lintProjectWithApplyRule({
    entryFilePath,
    files: {
      [entryFilePath]: code,
    },
    uxlintFile: options?.uxlintFile,
  });
}

export function lintProjectWithApplyRule(options: {
  entryFilePath: string;
  files: Record<string, string>;
  uxlintFile?: HeuristicFile;
}) {
  const linter = new Linter();

  return withTemporaryProject(
    options.uxlintFile ?? EMPTY_UXLINT_FILE,
    options.files,
    (tempDir) => {
      const entryFileAbsolutePath = path.resolve(
        tempDir,
        options.entryFilePath,
      );
      const entryCode = fs.readFileSync(entryFileAbsolutePath, "utf8");

      return linter.verify(entryCode, createApplyRuleConfig(), {
        filename: options.entryFilePath,
      });
    },
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
