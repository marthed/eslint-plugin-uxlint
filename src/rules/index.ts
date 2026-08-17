import type { Rule } from "eslint";
import {
  CONFIG_ERROR_RULE_KEY,
  CUSTOM_RULE_KEY,
  ruleKeyForFindingId,
} from "../analysis/analyze";
import { createUXLintRule } from "./create-uxlint-rule";

// Every built-in finding id, with the description its ESLint rule carries.
// The rule name is the id in lower case, so a message like
// "[INPUT-DATE-002] ..." always names the rule that reported it.
export const BUILTIN_FINDING_IDS: Array<{ id: string; description: string }> = [
  {
    id: "INTERACTION-SYNC-001",
    description:
      "A synchronous interaction that writes state should produce visible feedback",
  },
  {
    id: "INTERACTION-ASYNC-START-001",
    description: "Async work should show an immediate pending cue",
  },
  {
    id: "INTERACTION-ASYNC-SETTLED-001",
    description: "Users should be able to perceive that async work finished",
  },
  {
    id: "INTERACTION-ASYNC-ERROR-001",
    description: "Async work should show visible feedback when it fails",
  },
  {
    id: "INTERACTION-ASYNC-SUCCESS-001",
    description: "Async work should show visible feedback when it succeeds",
  },
  {
    id: "FORM-MULTI-001",
    description: "A form that can submit should expose a detectable error path",
  },
  {
    id: "INPUT-CHOICE-004",
    description:
      "Radio groups should have a default selection or an explicit neutral option",
  },
  {
    id: "INPUT-CHOICE-005",
    description: "Checkbox and radio controls should have associated labels",
  },
  {
    id: "INPUT-MOBILE-001",
    description: "Fields should have a visible label, not placeholder text",
  },
  {
    id: "INPUT-DATE-001",
    description: "Avoid split month/day/year dropdowns for date entry",
  },
  {
    id: "INPUT-DATE-002",
    description: "Text-based date fields should show the expected format",
  },
  {
    id: "INPUT-TOGGLE-001",
    description: "Toggle switches should represent only two opposing states",
  },
  {
    id: "INPUT-TOGGLE-002",
    description: "Toggle switches should take immediate effect",
  },
  {
    id: "INPUT-SPLIT-001",
    description: "Split buttons should expose a clear default action",
  },
  {
    id: "INPUT-SPLIT-002",
    description: "Split buttons are for commands, not navigation",
  },
];

const builtinRules: Record<string, Rule.RuleModule> = {};
for (const { id, description } of BUILTIN_FINDING_IDS) {
  builtinRules[ruleKeyForFindingId(id)] = createUXLintRule({
    description,
    ruleKeys: [ruleKeyForFindingId(id)],
  });
}

export const BUILTIN_RULE_NAMES = Object.keys(builtinRules);

export const rules: Record<string, Rule.RuleModule> = {
  ...builtinRules,

  // Rules authored as data in uxlint.rules.json.
  [CUSTOM_RULE_KEY]: createUXLintRule({
    description: "Apply UX rules defined in uxlint.rules.json",
    ruleKeys: [CUSTOM_RULE_KEY],
  }),

  // uxlint.rules.json exists but could not be parsed.
  [CONFIG_ERROR_RULE_KEY]: createUXLintRule({
    description: "Report an unreadable uxlint.rules.json",
    ruleKeys: [CONFIG_ERROR_RULE_KEY],
  }),

  // Everything at one severity. Predates the split and stays supported;
  // enable it *or* the individual rules, not both, or findings double up.
  apply: createUXLintRule({
    description:
      "Apply every UX heuristic — built-in packs and uxlint.rules.json — at one severity",
    ruleKeys: null,
  }),
};

export default rules;
