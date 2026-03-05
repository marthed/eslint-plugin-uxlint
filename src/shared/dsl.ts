import type { Signals } from "./signals";

export type Expr =
  | { all: Expr[] }
  | { any: Expr[] }
  | { not: Expr }
  | { eq: [ValueRef, unknown] }
  | { in: [ValueRef, unknown[]] }
  | { hasAttr: string }
  | { hasAnyAttr: string[] };

export type ValueRef =
  | "node.type"
  | "jsx.tag"
  | "jsx.componentName"
  | { call: ["jsx.attrText", string] }; // extensible

function readValue(signals: Signals, ref: ValueRef): unknown {
  if (typeof ref === "string") return (signals as any)[ref];
  if ("call" in ref) {
    const [fn, arg] = ref.call;
    if (fn === "jsx.attrText") return signals["jsx.attrText"](arg);
    return null;
  }
  return null;
}

export function evalExpr(signals: Signals, expr: Expr): boolean | "unknown" {
  if ("all" in expr) {
    let sawUnknown = false;
    for (const e of expr.all) {
      const r = evalExpr(signals, e);
      if (r === false) return false;
      if (r === "unknown") sawUnknown = true;
    }
    return sawUnknown ? "unknown" : true;
  }

  if ("any" in expr) {
    let sawUnknown = false;
    for (const e of expr.any) {
      const r = evalExpr(signals, e);
      if (r === true) return true;
      if (r === "unknown") sawUnknown = true;
    }
    return sawUnknown ? "unknown" : false;
  }

  if ("not" in expr) {
    const r = evalExpr(signals, expr.not);
    if (r === "unknown") return "unknown";
    return !r;
  }

  if ("eq" in expr) {
    const [ref, expected] = expr.eq;
    const got = readValue(signals, ref);
    // If we can’t know (e.g., attrText returned null), fail safely: unknown.
    if (got === null) return "unknown";
    return got === expected;
  }

  if ("in" in expr) {
    const [ref, options] = expr.in;
    const got = readValue(signals, ref);
    if (got === null) return "unknown";
    return options.includes(got as any);
  }

  if ("hasAttr" in expr) return signals["jsx.hasAttr"](expr.hasAttr);
  if ("hasAnyAttr" in expr) return signals["jsx.hasAnyAttr"](expr.hasAnyAttr);

  return "unknown";
}