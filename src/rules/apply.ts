import type { Rule } from "eslint";
import { loadHeuristics } from "../shared/rules-loader";
import { makeSignals } from "../shared/signals";
import { evalExpr, type Expr } from "../shared/dsl";
function severityToEslintLevel(sev: "off" | "warn" | "error"): 0 | 1 | 2 {
  if (sev === "off") return 0;
  if (sev === "warn") return 1;
  return 2;
}

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: { description: "Apply UX heuristics defined in uxlint.rules.json" },
    schema: [
      {
        type: "object",
        properties: {
          rulesFileName: { type: "string" } // optional future
        },
        additionalProperties: false
      }
    ],
    messages: {
      uxFinding: "{{message}}"
    }
  },

  create(context) {
    const cwd = process.cwd();
    const heuristics = loadHeuristics(cwd);

    const sourceCode = context.sourceCode;
    const filename = context.filename;

    function applyToNode(node: any) {
      const signals = makeSignals({ node, sourceCode, filename });

      for (const h of heuristics) {
        if (!h.appliesTo.includes(node.type)) continue;

        const match = evalExpr(signals, h.when as Expr);

        // Fail safely:
        // - true => report
        // - false => no report
        // - unknown => do nothing (or optionally "warn" in a special mode)
        if (match !== true) continue;

        // Respect severity from heuristics file by converting to ESLint "report" level:
        const level = severityToEslintLevel(h.severity);
        if (level === 0) continue;

        // ESLint doesn't let you set per-report severity directly in flat config.
        // Solution: expose findings under different rule IDs OR encode severity in message.
        // v0 pragmatic approach: include severity in message.
        const msg = `[${h.id}] ${h.report.message}`;

        context.report({
          node,
          messageId: "uxFinding",
          data: { message: msg }
        });
      }
    }

    return {
      JSXOpeningElement: applyToNode,
      // You can expand to other node types later:
      // CallExpression: applyToNode,
      // ImportDeclaration: applyToNode,
    };
  }
};

export default rule;