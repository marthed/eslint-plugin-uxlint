export type Expr =
  | { all: Expr[] }
  | { any: Expr[] }
  | { not: Expr }
  | { eq: [ValueRef, unknown] }
  | { in: [ValueRef, unknown[]] }
  | { hasAttr: string }
  | { hasAnyAttr: string[] };

// A signal name (e.g. "jsx.tag", "input.kind") or a call into a
// function-valued signal (e.g. { call: ["jsx.attrText", "type"] }).
export type ValueRef = string | { call: [string, string] };

export type SignalBag = Record<string, unknown>;

function readValue(signals: SignalBag, ref: ValueRef): unknown {
  if (typeof ref === "string") {
    const value = signals[ref];
    return value === undefined ? null : value;
  }
  if ("call" in ref) {
    const [fn, arg] = ref.call;
    const signalFn = signals[fn];
    if (typeof signalFn === "function") return signalFn(arg);
    return null;
  }
  return null;
}

export function evalExpr(signals: SignalBag, expr: Expr): boolean | "unknown" {
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

  if ("hasAttr" in expr) {
    const hasAttr = signals["jsx.hasAttr"];
    return typeof hasAttr === "function" ? hasAttr(expr.hasAttr) : "unknown";
  }

  if ("hasAnyAttr" in expr) {
    const hasAnyAttr = signals["jsx.hasAnyAttr"];
    return typeof hasAnyAttr === "function"
      ? hasAnyAttr(expr.hasAnyAttr)
      : "unknown";
  }

  return "unknown";
}
