import fs from "node:fs";
import path from "node:path";

export type Severity = "off" | "warn" | "error";

export type Heuristic = {
  id: string;
  title: string;
  severity: Severity;
  appliesTo: string[];
  when: any;
  report: {
    message: string;
    evidence?: string[];
  };
};

export type UXLintProjectConfig = {
  designSystem?: {
    formComponents?: string[];
    submitComponents?: string[];
    errorComponents?: string[];
    errorSummaryComponents?: string[];
    fieldComponents?: string[];
    fieldErrorProps?: string[];
  };
};

export type HeuristicFile = {
  version: number;
  config?: UXLintProjectConfig;
  rules: Heuristic[];
};

function findUp(filename: string, startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 25; i++) {
    const p = path.join(dir, filename);
    if (fs.existsSync(p)) return p;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function loadUXLintFile(cwd: string): HeuristicFile {
  const p = findUp("uxlint.rules.json", cwd);

  if (!p) {
    return {
      version: 1,
      config: {},
      rules: [],
    };
  }

  try {
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as HeuristicFile;

    return {
      version: parsed.version ?? 1,
      config: parsed.config ?? {},
      rules: Array.isArray(parsed.rules) ? parsed.rules : [],
    };
  } catch {
    return {
      version: 1,
      config: {},
      rules: [],
    };
  }
}

export function loadHeuristics(cwd: string): Heuristic[] {
  return loadUXLintFile(cwd).rules;
}

export function loadUXLintConfig(cwd: string): UXLintProjectConfig {
  return loadUXLintFile(cwd).config ?? {};
}