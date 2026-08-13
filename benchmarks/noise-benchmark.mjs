// Noise benchmark: lint real-world React codebases with only the built-in
// UXLint rules and report finding counts per rule id.
//
// Usage:
//   npm run build
//   node benchmarks/noise-benchmark.mjs <targetDir> [targetDir...] [options]
//
// Options:
//   --glob <pattern>   Lint pattern, repeatable (default: **/*.{tsx,jsx})
//   --rule <ID>        Only report this rule id, repeatable. Useful when
//                      investigating whether a specific rule fires at all.
//   --samples <n>      Sample locations to print per rule (default: 5)
//   --configured       Install benchmarks/configs/<target>.json as the
//                      target's uxlint.rules.json for the run. Rules that
//                      need a component vocabulary (INPUT-TOGGLE-*,
//                      INPUT-SPLIT-*, design-system INPUT-DATE-*) cannot fire
//                      without it.
//
// Examples:
//   node benchmarks/noise-benchmark.mjs ../scratch/excalidraw
//   node benchmarks/noise-benchmark.mjs ../scratch/* --rule INPUT-TOGGLE-001
//   node benchmarks/noise-benchmark.mjs ../scratch/ui --configured
//
// Unconfigured is the default so the baseline stays comparable: only built-in
// rules fire, and inline eslint-disable comments are ignored to measure the
// raw signal. See docs/noise-benchmark.md for the recorded baselines.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import tsParser from "@typescript-eslint/parser";
import uxlintModule from "../dist/index.js";

const uxlint = uxlintModule.default ?? uxlintModule;

const RULE_ID_PATTERN = /^\[([A-Z0-9-]+)\]/;
const DEFAULT_GLOBS = ["**/*.{tsx,jsx}"];
const CONFIG_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "configs",
);

function parseArgs(argv) {
  const targets = [];
  const globs = [];
  const ruleFilter = new Set();
  let samples = 5;
  let configured = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--glob") {
      globs.push(argv[++index]);
    } else if (arg === "--rule") {
      ruleFilter.add(argv[++index]);
    } else if (arg === "--samples") {
      samples = Number(argv[++index]) || 0;
    } else if (arg === "--configured") {
      configured = true;
    } else {
      targets.push(arg);
    }
  }

  return {
    targets,
    globs: globs.length > 0 ? globs : DEFAULT_GLOBS,
    ruleFilter,
    samples,
    configured,
  };
}

// Installs benchmarks/configs/<target>.json as the target's uxlint.rules.json
// and returns a function that removes it again. Refuses to touch a target that
// already has one, so a real config is never clobbered.
function installConfig(targetDir) {
  const source = path.join(CONFIG_DIR, `${path.basename(targetDir)}.json`);
  if (!fs.existsSync(source)) return { installed: false, remove: () => {} };

  const destination = path.join(targetDir, "uxlint.rules.json");
  if (fs.existsSync(destination)) {
    throw new Error(
      `${destination} already exists; refusing to overwrite it. ` +
        "Remove it or run without --configured.",
    );
  }

  fs.copyFileSync(source, destination);
  return {
    installed: true,
    remove: () => fs.rmSync(destination, { force: true }),
  };
}

async function lintTarget(targetDir, globs, ruleFilter, configured) {
  const config = configured
    ? installConfig(targetDir)
    : { installed: false, remove: () => {} };

  try {
    const report = await lintTargetFiles(targetDir, globs, ruleFilter);
    return { ...report, configured: config.installed };
  } finally {
    config.remove();
  }
}

async function lintTargetFiles(targetDir, globs, ruleFilter) {
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
  const elapsedSeconds = (Date.now() - startedAt) / 1000;

  const countsByRuleId = new Map();
  const samplesByRuleId = new Map();
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

      const ruleId =
        RULE_ID_PATTERN.exec(message.message)?.[1] ?? "(unprefixed)";
      if (ruleFilter.size > 0 && !ruleFilter.has(ruleId)) continue;

      countsByRuleId.set(ruleId, (countsByRuleId.get(ruleId) ?? 0) + 1);
      const locations = samplesByRuleId.get(ruleId) ?? [];
      locations.push(
        `${path.relative(targetDir, result.filePath)}:${message.line}`,
      );
      samplesByRuleId.set(ruleId, locations);
      hasFinding = true;
    }

    if (hasFinding) filesWithFindings += 1;
  }

  return {
    targetDir,
    name: path.basename(targetDir),
    filesLinted,
    filesWithFindings,
    fatalErrors,
    elapsedSeconds,
    countsByRuleId,
    samplesByRuleId,
  };
}

function reportTarget(report, samples) {
  const sorted = [...report.countsByRuleId.entries()].sort(
    (a, b) => b[1] - a[1],
  );
  const total = sorted.reduce((sum, [, count]) => sum + count, 0);

  console.log(
    `\n=== ${report.name}${report.configured ? " (configured)" : ""} ===`,
  );
  console.log(
    `${report.filesLinted} files linted, ${report.filesWithFindings} with findings, ` +
      `${report.fatalErrors} parse failures, ${report.elapsedSeconds.toFixed(1)}s`,
  );
  console.log(
    `${total} findings (${(total / Math.max(report.filesLinted, 1)).toFixed(3)} per file)`,
  );

  if (sorted.length === 0) {
    console.log("  no findings");
    return;
  }

  console.log("");
  for (const [ruleId, count] of sorted) {
    console.log(`  ${ruleId.padEnd(32)} ${count}`);
  }

  if (samples <= 0) return;

  console.log("\n  samples:");
  for (const [ruleId] of sorted) {
    console.log(`    ${ruleId}`);
    for (const location of report.samplesByRuleId
      .get(ruleId)
      .slice(0, samples)) {
      console.log(`      ${location}`);
    }
  }
}

function reportCombined(reports) {
  if (reports.length < 2) return;

  const combined = new Map();
  let files = 0;
  let findings = 0;

  for (const report of reports) {
    files += report.filesLinted;
    for (const [ruleId, count] of report.countsByRuleId) {
      combined.set(ruleId, (combined.get(ruleId) ?? 0) + count);
      findings += count;
    }
  }

  console.log(`\n=== combined (${reports.length} targets) ===`);
  console.log(
    `${files} files linted, ${findings} findings ` +
      `(${(findings / Math.max(files, 1)).toFixed(3)} per file)\n`,
  );

  for (const [ruleId, count] of [...combined.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${ruleId.padEnd(32)} ${count}`);
  }
}

async function main() {
  const { targets, globs, ruleFilter, samples, configured } = parseArgs(
    process.argv.slice(2),
  );

  if (targets.length === 0) {
    console.error(
      "Usage: node benchmarks/noise-benchmark.mjs <targetDir> [targetDir...] " +
        "[--glob p] [--rule ID] [--samples n] [--configured]",
    );
    process.exit(1);
  }

  const reports = [];
  for (const target of targets) {
    reports.push(
      await lintTarget(path.resolve(target), globs, ruleFilter, configured),
    );
  }

  for (const report of reports) {
    reportTarget(report, samples);
  }

  reportCombined(reports);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
