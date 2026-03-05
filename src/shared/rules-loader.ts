import fs from "node:fs";
import path from "node:path";

export type Severity = "off" | "warn" | "error";

export type Heuristic = {
  id: string;
  title: string;
  severity: Severity;
  appliesTo: string[]; // AST node types
  when: any;           // DSL Expr (validated at runtime)
  report: {
    message: string;
    evidence?: string[];
  };
};

export type HeuristicFile = {
  version: number;
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

export function loadHeuristics(cwd: string): Heuristic[] {
  const p = findUp("uxlint.rules.json", cwd);
  if (!p) return [];
  try {
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as HeuristicFile;
    return Array.isArray(parsed.rules) ? parsed.rules : [];
  } catch {
    return [];
  }
}