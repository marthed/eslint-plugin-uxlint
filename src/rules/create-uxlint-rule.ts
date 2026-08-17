import type { Rule } from "eslint";
import { analyzeFile } from "../analysis/analyze";

// Builds an ESLint rule that reports one slice of the shared analysis.
// `ruleKeys` is null for the catch-all rule, which reports everything.
export function createUXLintRule(options: {
  description: string;
  ruleKeys: string[] | null;
}): Rule.RuleModule {
  const ruleKeySet = options.ruleKeys ? new Set(options.ruleKeys) : null;

  return {
    meta: {
      type: "problem",
      docs: { description: options.description },
      schema: [],
      messages: { uxFinding: "{{message}}" },
    },

    create(context) {
      return {
        "Program:exit"() {
          for (const finding of analyzeFile(context)) {
            if (ruleKeySet && !ruleKeySet.has(finding.ruleKey)) continue;

            context.report({
              node: finding.node,
              messageId: "uxFinding",
              data: { message: finding.message },
            });
          }
        },
      };
    },
  };
}
