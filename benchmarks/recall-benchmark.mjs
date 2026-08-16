// Recall benchmark: the other half of the noise benchmark.
//
// The noise axis measures false positives, and on its own it rewards a linter
// that reports nothing — a detection bug that silences a rule scores as an
// improvement. This lints a corpus of code with deliberately missing feedback
// and checks that UXLint does *not* stay silent.
//
// Each fixture in benchmarks/recall/ declares what it should produce:
//
//   // expect: INTERACTION-ASYNC-START-001
//
// and contains a violating component plus a compliant one, so a rule that
// fires on the compliant half shows up as an unexpected extra.
//
// Usage:
//   npm run build
//   node benchmarks/recall-benchmark.mjs
//
// Exits non-zero when a fixture misses its expected rule, so it can gate CI.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import tsParser from "@typescript-eslint/parser";
import uxlintModule from "../dist/index.js";

const uxlint = uxlintModule.default ?? uxlintModule;

const RULE_ID_PATTERN = /^\[([A-Z0-9-]+)\]/;
const EXPECT_PATTERN = /^\/\/\s*expect:\s*(.*)$/m;
const CORPUS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "recall",
);

function readExpectations(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const match = EXPECT_PATTERN.exec(source);
  if (!match) return null;

  return match[1]
    .split(",")
    .map((ruleId) => ruleId.trim())
    .filter(Boolean)
    .sort();
}

async function lintCorpus() {
  const eslint = new ESLint({
    cwd: CORPUS_DIR,
    allowInlineConfig: false,
    errorOnUnmatchedPattern: false,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.{ts,tsx,js,jsx}"],
        languageOptions: {
          parser: tsParser,
          parserOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            ecmaFeatures: { jsx: true },
          },
        },
        plugins: { uxlint },
        rules: { "uxlint/apply": "warn" },
      },
    ],
  });

  const results = await eslint.lintFiles(["**/*.tsx"]);
  const foundByFile = new Map();

  for (const result of results) {
    const ids = result.messages
      .filter((message) => !message.fatal)
      .map((message) => RULE_ID_PATTERN.exec(message.message)?.[1])
      .filter(Boolean);
    foundByFile.set(result.filePath, ids.sort());
  }

  return foundByFile;
}

function difference(left, right) {
  const rightSet = new Set(right);
  return left.filter((entry) => !rightSet.has(entry));
}

async function main() {
  const foundByFile = await lintCorpus();
  const rows = [];
  let expectedTotal = 0;
  let detectedTotal = 0;
  let extrasTotal = 0;

  for (const [filePath, found] of [...foundByFile.entries()].sort()) {
    const expected = readExpectations(filePath);
    if (expected === null) continue;

    const missed = difference(expected, found);
    const extra = difference(found, expected);

    expectedTotal += expected.length;
    detectedTotal += expected.length - missed.length;
    extrasTotal += extra.length;

    rows.push({ name: path.basename(filePath), expected, missed, extra });
  }

  console.log(`\n=== recall corpus (${rows.length} fixtures) ===\n`);

  for (const row of rows) {
    const status = row.missed.length === 0 ? "ok  " : "MISS";
    console.log(
      `  ${status} ${row.name.padEnd(32)} ${row.expected.join(", ")}`,
    );
    if (row.missed.length > 0) {
      console.log(`       missed: ${row.missed.join(", ")}`);
    }
    if (row.extra.length > 0) {
      console.log(`       extra:  ${row.extra.join(", ")}`);
    }
  }

  const recall =
    expectedTotal === 0 ? 1 : (detectedTotal / expectedTotal).toFixed(3);

  console.log(
    `\n${detectedTotal}/${expectedTotal} expected findings detected (recall ${recall})`,
  );
  console.log(`${extrasTotal} unexpected findings on compliant code\n`);

  if (detectedTotal < expectedTotal) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
