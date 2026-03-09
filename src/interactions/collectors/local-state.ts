import { InteractionStore } from "../store";
import { getInteractionScopeKey } from "../scope";

function isAstNode(value: unknown): value is { type: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "type" in (value as Record<string, unknown>) &&
      typeof (value as Record<string, unknown>).type === "string"
  );
}

function walkAst(node: unknown, visitor: (node: any) => void, visited = new Set<object>()) {
  if (!isAstNode(node)) return;
  if (visited.has(node as object)) return;

  visited.add(node as object);
  visitor(node);

  for (const [key, value] of Object.entries(node)) {
    if (key === "parent" || key === "loc" || key === "range") continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        if (isAstNode(item)) {
          walkAst(item, visitor, visited);
        }
      }
    } else if (isAstNode(value)) {
      walkAst(value, visitor, visited);
    }
  }
}

function functionContainsAwait(node: any): boolean {
  let found = false;

  walkAst(node?.body ?? node, (current) => {
    if (found) return;

    if (current.type === "AwaitExpression") {
      found = true;
    }
  });

  return found;
}

function collectLoadingStateKeysFromBody(body: any): string[] {
  const keys = new Set<string>();

  walkAst(body, (current) => {
    if (current.type !== "CallExpression") return;
    if (current.callee?.type !== "Identifier") return;

    const calleeName = current.callee.name as string;

    if (
      calleeName.startsWith("setIs") ||
      calleeName.startsWith("setLoading") ||
      calleeName.startsWith("setSaving") ||
      calleeName.startsWith("setSubmitting") ||
      calleeName.startsWith("setPending")
    ) {
      const rawName = calleeName.slice(3);
      if (!rawName) return;

      const stateKey = `${rawName[0].toLowerCase()}${rawName.slice(1)}`;
      keys.add(stateKey);
    }
  });

  return [...keys];
}

function inferAsyncKind(node: any): "async-function" | "await-inside" | "promise-chain" | "mutation-call" | null {
  const isAsync = Boolean(node?.async);
  const hasAwait = functionContainsAwait(node);

  if (isAsync) return "async-function";
  if (hasAwait) return "await-inside";

  return null;
}

export function createAsyncHandlerCollector(store: InteractionStore) {
  function maybeAddHandler(name: string | undefined, node: any, scopeKey: string) {
    if (!name || !node) return;

    const asyncKind = inferAsyncKind(node);
    if (!asyncKind) return;

    const stateKeysSetLoading = collectLoadingStateKeysFromBody(node.body ?? node);

    store.addHandler({
      id: store.nextId("handler"),
      name,
      node,
      scopeKey,
      asyncKind,
      stateKeysSetLoading,
    });
  }

  return {
    FunctionDeclaration(node: any) {
      maybeAddHandler(node.id?.name, node, getInteractionScopeKey(node.parent ?? node));
    },

    VariableDeclarator(node: any) {
      const init = node.init;
      if (!init) return;

      const name = node.id?.name;

      if (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression") {
        maybeAddHandler(name, init, getInteractionScopeKey(node));
      }
    },
  };
}
