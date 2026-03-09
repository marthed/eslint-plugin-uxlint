import { InteractionStore } from "../store";

function isAstNode(value: unknown): value is { type: string } {
  return Boolean(
    value &&
    typeof value === "object" &&
    "type" in (value as Record<string, unknown>) &&
    typeof (value as Record<string, unknown>).type === "string",
  );
}

function walkAst(
  node: unknown,
  visitor: (node: any) => void,
  visited = new Set<object>(),
) {
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

function getComponentName(node: any): string | null {
  if (node.type === "FunctionDeclaration") {
    return node.id?.name ?? null;
  }

  if (
    node.type === "VariableDeclarator" &&
    (node.init?.type === "ArrowFunctionExpression" ||
      node.init?.type === "FunctionExpression")
  ) {
    return node.id?.name ?? null;
  }

  return null;
}

function collectStatePairsFromFunctionBody(body: any) {
  const pairs: Array<{ stateVar: string; setterVar: string }> = [];

  if (!body?.body || !Array.isArray(body.body)) return pairs;

  for (const stmt of body.body) {
    if (stmt.type !== "VariableDeclaration") continue;

    for (const decl of stmt.declarations ?? []) {
      const init = decl.init;
      const id = decl.id;

      if (
        init?.type === "CallExpression" &&
        init.callee?.type === "Identifier" &&
        init.callee.name === "useState" &&
        id?.type === "ArrayPattern" &&
        id.elements?.length === 2 &&
        id.elements[0]?.type === "Identifier" &&
        id.elements[1]?.type === "Identifier"
      ) {
        pairs.push({
          stateVar: id.elements[0].name,
          setterVar: id.elements[1].name,
        });
      }
    }
  }

  return pairs;
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

function collectNamedHandlers(fnBody: any) {
  const handlers: Array<{
    name: string;
    node: any;
    asyncKind: "async-function" | "await-inside";
  }> = [];

  if (!fnBody?.body || !Array.isArray(fnBody.body)) return handlers;

  for (const stmt of fnBody.body) {
    if (stmt.type === "FunctionDeclaration" && stmt.id?.name) {
      if (stmt.async || functionContainsAwait(stmt)) {
        handlers.push({
          name: stmt.id.name,
          node: stmt,
          asyncKind: stmt.async ? "async-function" : "await-inside",
        });
      }
    }

    if (stmt.type === "VariableDeclaration") {
      for (const decl of stmt.declarations ?? []) {
        const init = decl.init;
        if (
          decl.id?.type === "Identifier" &&
          (init?.type === "ArrowFunctionExpression" ||
            init?.type === "FunctionExpression")
        ) {
          if (init.async || functionContainsAwait(init)) {
            handlers.push({
              name: decl.id.name,
              node: init,
              asyncKind: init.async ? "async-function" : "await-inside",
            });
          }
        }
      }
    }
  }

  return handlers;
}

function collectStateWrites(
  handlerNode: any,
  statePairs: Array<{ stateVar: string; setterVar: string }>,
) {
  const writes: Array<{ stateVar: string; setterVar: string }> = [];

  walkAst(handlerNode.body ?? handlerNode, (current) => {
    if (current.type !== "CallExpression") return;
    if (current.callee?.type !== "Identifier") return;

    const called = current.callee.name;
    const pair = statePairs.find((p) => p.setterVar === called);
    if (!pair) return;

    writes.push({
      stateVar: pair.stateVar,
      setterVar: pair.setterVar,
    });
  });

  return writes;
}

function collectStateReads(
  componentNode: any,
  statePairs: Array<{ stateVar: string; setterVar: string }>,
) {
  const reads: Array<{
    stateVar: string;
    node: any;
    kind:
      | "disabled-prop"
      | "loading-prop"
      | "conditional-render"
      | "ternary-render"
      | "text-feedback";
  }> = [];

  const stateNames = new Set(statePairs.map((p) => p.stateVar));

  walkAst(componentNode.body ?? componentNode, (current) => {
    if (current.type === "JSXAttribute" && current.name?.name === "disabled") {
      const expr = current.value?.expression;
      if (expr?.type === "Identifier" && stateNames.has(expr.name)) {
        reads.push({
          stateVar: expr.name,
          node: current,
          kind: "disabled-prop",
        });
      }
    }

    if (
      current.type === "JSXAttribute" &&
      (current.name?.name === "loading" || current.name?.name === "isLoading")
    ) {
      const expr = current.value?.expression;
      if (expr?.type === "Identifier" && stateNames.has(expr.name)) {
        reads.push({
          stateVar: expr.name,
          node: current,
          kind: "loading-prop",
        });
      }
    }

    if (current.type === "LogicalExpression" && current.operator === "&&") {
      if (
        current.left?.type === "Identifier" &&
        stateNames.has(current.left.name)
      ) {
        reads.push({
          stateVar: current.left.name,
          node: current,
          kind: "conditional-render",
        });
      }
    }

    if (current.type === "ConditionalExpression") {
      if (
        current.test?.type === "Identifier" &&
        stateNames.has(current.test.name)
      ) {
        reads.push({
          stateVar: current.test.name,
          node: current,
          kind: "ternary-render",
        });
      }
    }
  });

  return reads;
}

export function createComponentStateCollector(store: InteractionStore) {
  return {
    FunctionDeclaration(node: any) {
      const componentName = getComponentName(node);
      if (!componentName) return;

      const statePairs = collectStatePairsFromFunctionBody(node.body);
      for (const pair of statePairs) {
        store.addStatePair(componentName, pair);
      }

      const handlers = collectNamedHandlers(node.body);
      for (const handler of handlers) {
        store.addHandler(componentName, {
          id: store.nextId("handler"),
          name: handler.name,
          node: handler.node,
          asyncKind: handler.asyncKind,
        });

        const writes = collectStateWrites(handler.node, statePairs);
        for (const write of writes) {
          store.addStateWrite(componentName, {
            handlerName: handler.name,
            stateVar: write.stateVar,
            setterVar: write.setterVar,
          });
        }
      }

      const reads = collectStateReads(node, statePairs);
      for (const read of reads) {
        store.addStateRead(componentName, read);
      }
    },

    VariableDeclarator(node: any) {
      const componentName = getComponentName(node);
      if (!componentName) return;

      const fn = node.init;
      const statePairs = collectStatePairsFromFunctionBody(fn.body);
      for (const pair of statePairs) {
        store.addStatePair(componentName, pair);
      }

      const handlers = collectNamedHandlers(fn.body);
      for (const handler of handlers) {
        store.addHandler(componentName, {
          id: store.nextId("handler"),
          name: handler.name,
          node: handler.node,
          asyncKind: handler.asyncKind,
        });

        const writes = collectStateWrites(handler.node, statePairs);
        for (const write of writes) {
          store.addStateWrite(componentName, {
            handlerName: handler.name,
            stateVar: write.stateVar,
            setterVar: write.setterVar,
          });
        }
      }

      const reads = collectStateReads(fn, statePairs);
      for (const read of reads) {
        store.addStateRead(componentName, read);
      }
    },
  };
}
