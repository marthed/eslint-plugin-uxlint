import fs from "node:fs";
import path from "node:path";
import type { DesignSystemComponentConfig } from "./design-system";

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

export type BuiltinRuleOverride =
  | Severity
  | {
      severity?: Severity;
      message?: string;
    };

export type UXLintProjectConfig = {
  designSystem?: {
    formComponents?: string[];
    submitComponents?: string[];
    errorComponents?: string[];
    errorSummaryComponents?: string[];
    fieldComponents?: string[];
    fieldErrorProps?: string[];
    formSubmitProps?: string[];
    fieldBindingFunctions?: string[];
    labelComponents?: string[];
    components?: Record<string, DesignSystemComponentConfig>;
    feedbackFunctions?: string[];
  };
  builtinRules?: Record<string, BuiltinRuleOverride>;
};

export type ResolvedBuiltinRuleOverride = {
  enabled: boolean;
  message?: string;
};

export function resolveBuiltinRuleOverride(
  config: UXLintProjectConfig,
  ruleId: string,
): ResolvedBuiltinRuleOverride {
  const override = config.builtinRules?.[ruleId];

  if (typeof override === "string") {
    return { enabled: override !== "off" };
  }

  if (typeof override === "object" && override !== null) {
    return {
      enabled: override.severity !== "off",
      message:
        typeof override.message === "string" && override.message.trim()
          ? override.message
          : undefined,
    };
  }

  return { enabled: true };
}

export type HeuristicFile = {
  version: number;
  config?: UXLintProjectConfig;
  rules: Heuristic[];
};

export type LoadedUXLintFile = {
  version: number;
  config: UXLintProjectConfig;
  rules: Heuristic[];
  configPath: string | null;
  configError: string | null;
};

const EMPTY_UXLINT_FILE: LoadedUXLintFile = {
  version: 1,
  config: {},
  rules: [],
  configPath: null,
  configError: null,
};

type CacheEntry = {
  mtimeMs: number;
  size: number;
  loaded: LoadedUXLintFile;
};

const loadedFileCache = new Map<string, CacheEntry>();

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

function parseUXLintFile(configPath: string, raw: string): LoadedUXLintFile {
  let parsed: Partial<HeuristicFile>;
  try {
    parsed = JSON.parse(raw) as Partial<HeuristicFile>;
  } catch (error) {
    return {
      ...EMPTY_UXLINT_FILE,
      configPath,
      configError: error instanceof Error ? error.message : String(error),
    };
  }

  if (parsed.rules !== undefined && !Array.isArray(parsed.rules)) {
    return {
      ...EMPTY_UXLINT_FILE,
      configPath,
      configError: '"rules" must be an array',
    };
  }

  return {
    version: parsed.version ?? 1,
    config: parsed.config ?? {},
    rules: parsed.rules ?? [],
    configPath,
    configError: null,
  };
}

export function loadUXLintFile(cwd: string): LoadedUXLintFile {
  const configPath = findUp("uxlint.rules.json", cwd);
  if (!configPath) return EMPTY_UXLINT_FILE;

  try {
    const stats = fs.statSync(configPath);
    const cached = loadedFileCache.get(configPath);
    if (
      cached &&
      cached.mtimeMs === stats.mtimeMs &&
      cached.size === stats.size
    ) {
      return cached.loaded;
    }

    const raw = fs.readFileSync(configPath, "utf8");
    const loaded = parseUXLintFile(configPath, raw);
    loadedFileCache.set(configPath, {
      mtimeMs: stats.mtimeMs,
      size: stats.size,
      loaded,
    });
    return loaded;
  } catch (error) {
    return {
      ...EMPTY_UXLINT_FILE,
      configPath,
      configError: error instanceof Error ? error.message : String(error),
    };
  }
}

export function loadHeuristics(cwd: string): Heuristic[] {
  return loadUXLintFile(cwd).rules;
}

export function loadUXLintConfig(cwd: string): UXLintProjectConfig {
  return loadUXLintFile(cwd).config;
}
