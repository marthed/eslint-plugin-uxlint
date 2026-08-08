// Noise benchmark: lint real-world React codebases with only the built-in
// UXLint rules and report finding counts per rule id.
//
// Usage:
//   npm run build
//   node benchmarks/noise-benchmark.mjs <targetDir> [glob...]
//
// Example:
//   node benchmarks/noise-benchmark.mjs ../scratch/excalidraw "packages/excalidraw/**/*.tsx"
//
// The target repo is linted without a uxlint.rules.json, so only built-in
// rules fire. Inline eslint-disable comments in the target are ignored to
// measure the raw signal.

import path from "node:path";
import process from "node:process";
import { ESLint } from "eslint";
import tsParser from "@typescript-eslint/parser";
import uxlintModule from "../dist/index.js";

const uxlint = uxlintModule.default ?? uxlintModule;

const RULE_ID_PATTERN = /^\[([A-Z0-9-]+)\]/;

async function main() {
  const [targetDirArg, ...globArgs] = process.argv.slice(2);
  if (!targetDirArg) {
    console.error(
      "Usage: node benchmarks/noise-benchmark.mjs <targetDir> [glob...]",
    );
    process.exit(1);
  }

  const targetDir = path.resolve(targetDirArg);
  const globs = globArgs.length > 0 ? globArgs : ["**/*.{tsx,jsx}"];

  const eslint = new ESLint({
    cwd: targetDir,
    allowInlineConfig: false,
    errorOnUnmatchedPattern: false,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.{ts,tsx,js,jsx}"],
        ignores: ["**/node_modules/**", "**/dist/**", "**/build/**"],
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

  const startedAt = Date.now();
  const results = await eslint.lintFiles(globs);
  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  const countsByRuleId = new Map();
  const findingsByRuleId = new Map();
  let filesLinted = 0;
  let filesWithFindings = 0;
  let fatalErrors = 0;

  for (const result of results) {
    filesLinted += 1;
    let hasFinding = false;

    for (const message of result.messages) {
      if (message.fatal) {
        fatalErrors += 1;
        continue;
      }

      const idMatch = RULE_ID_PATTERN.exec(message.message);
      const ruleId = idMatch?.[1] ?? "(unprefixed)";
      countsByRuleId.set(ruleId, (countsByRuleId.get(ruleId) ?? 0) + 1);

      const findings = findingsByRuleId.get(ruleId) ?? [];
      findings.push(
        `${path.relative(targetDir, result.filePath)}:${message.line}`,
      );
      findingsByRuleId.set(ruleId, findings);
      hasFinding = true;
    }

    if (hasFinding) filesWithFindings += 1;
  }

  const sortedCounts = [...countsByRuleId.entries()].sort(
    (a, b) => b[1] - a[1],
  );

  console.log(`\nTarget: ${targetDir}`);
  console.log(`Globs: ${globs.join(", ")}`);
  console.log(
    `Files linted: ${filesLinted} (with findings: ${filesWithFindings}, parse failures: ${fatalErrors})`,
  );
  console.log(`Elapsed: ${elapsedSeconds}s\n`);

  if (sortedCounts.length === 0) {
    console.log("No findings.");
    return;
  }

  console.log("Findings per rule:");
  for (const [ruleId, count] of sortedCounts) {
    console.log(`  ${ruleId.padEnd(35)} ${count}`);
  }

  console.log("\nSample locations (up to 5 per rule):");
  for (const [ruleId] of sortedCounts) {
    const samples = findingsByRuleId.get(ruleId).slice(0, 5);
    console.log(`  ${ruleId}`);
    for (const sample of samples) {
      console.log(`    ${sample}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
