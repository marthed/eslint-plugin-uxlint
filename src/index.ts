import { CONFIG_ERROR_RULE_KEY, CUSTOM_RULE_KEY } from "./analysis/analyze";
import { BUILTIN_RULE_NAMES, rules } from "./rules";

export { rules };

// Every rule the presets turn on. `apply` is deliberately excluded: it reports
// the same findings as all of these together, so enabling both doubles up.
const PRESET_RULE_NAMES = [
  ...BUILTIN_RULE_NAMES,
  CUSTOM_RULE_KEY,
  CONFIG_ERROR_RULE_KEY,
];

function presetRules(severity: "warn" | "error"): Record<string, string> {
  return Object.fromEntries(
    PRESET_RULE_NAMES.map((name) => [`uxlint/${name}`, severity]),
  );
}

const plugin = {
  rules,
  configs: {} as Record<string, unknown>,
};

// Flat-config presets. Both enable the same rules; they differ only in
// severity, so a team can start at "recommended" and tighten later, or set
// severities per rule themselves instead of using either.
plugin.configs.recommended = {
  plugins: { uxlint: plugin },
  rules: presetRules("warn"),
};

plugin.configs.strict = {
  plugins: { uxlint: plugin },
  rules: presetRules("error"),
};

export const configs = plugin.configs;

export default plugin;
