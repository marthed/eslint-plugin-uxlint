// Finds a component's named handler functions, resolves onClick/onSubmit/
// onPress bindings to a handler (including inline functions, delegating
// wrappers, and wrapper invocations like handleSubmit(onSubmit)), and
// collects the resulting interaction sources.

import type { InteractionHandler, StatePair, StateWrite } from "../types";
import { InteractionStore } from "../store";
import {
  attrText,
  getJSXAttribute,
  getJSXName,
} from "../../structure/collectors/jsx-helpers";
import { inferIsAsyncHandler, walkAst } from "./ast-helpers";
import type { ExternalStatusModel } from "./external-status-model";
import type { HelperFunctionResolver } from "./helper-resolver";
import { extractDirectCalledHandlerName } from "./prop-flow";
import { collectStateWritesForHandler } from "./state-writes";

const HANDLER_EVENT_NAMES = ["onSubmit", "onClick", "onPress"] as const;

export type InteractionSourceFact = {
  id: string;
  node: any;
  eventName: "onClick" | "onSubmit" | "onPress" | "unknown";
  componentName?: string;
  label?: string;
  handlerId?: string;
  handlerName?: string;
};

export function collectNamedHandlers(
  componentFunctionNode: any,
  store: InteractionStore,
): InteractionHandler[] {
  const handlers: InteractionHandler[] = [];
  const bodyStatements = componentFunctionNode.body?.body;

  if (!Array.isArray(bodyStatements)) return handlers;

  for (const statement of bodyStatements) {
    if (statement.type === "FunctionDeclaration" && statement.id?.name) {
      handlers.push({
        id: store.nextId("handler"),
        name: statement.id.name,
        node: statement,
        isAsync: inferIsAsyncHandler(statement),
        kind: "named",
      });
      continue;
    }

    if (statement.type !== "VariableDeclaration") continue;

    for (const declarator of statement.declarations ?? []) {
      if (declarator.id?.type !== "Identifier") continue;
      const init = declarator.init;
      if (
        init?.type !== "ArrowFunctionExpression" &&
        init?.type !== "FunctionExpression"
      ) {
        continue;
      }

      handlers.push({
        id: store.nextId("handler"),
        name: declarator.id.name,
        node: init,
        isAsync: inferIsAsyncHandler(init),
        kind: "named",
      });
    }
  }

  return handlers;
}

function getEventBinding(openingElement: any): {
  eventName: "onClick" | "onSubmit" | "onPress" | "unknown";
  handlerAttribute: any;
} | null {
  for (const eventName of HANDLER_EVENT_NAMES) {
    const attribute = getJSXAttribute(openingElement, eventName);
    if (!attribute) continue;
    return { eventName, handlerAttribute: attribute };
  }

  return null;
}

function resolveInteractionHandlerReference(
  handlerAttribute: any,
  handlersByName: Map<string, InteractionHandler>,
  statePairs: StatePair[],
  helperFunctionResolver: HelperFunctionResolver,
  externalStatusModel: ExternalStatusModel,
  store: InteractionStore,
  currentFilePath: string,
  maxTraceDepth: number,
  feedbackFunctionNames: Set<string>,
): {
  handlerId?: string;
  handlerName?: string;
  inlineHandler?: InteractionHandler;
  inlineWrites?: StateWrite[];
} {
  const expression = handlerAttribute?.value?.expression;
  if (!expression) return {};

  if (expression.type === "Identifier") {
    const namedHandler = handlersByName.get(expression.name);
    return {
      handlerId: namedHandler?.id,
      handlerName: expression.name,
    };
  }

  // Wrapper invocations like react-hook-form's onSubmit={handleSubmit(onSubmit)}:
  // resolve to the first argument that names a known local handler.
  if (expression.type === "CallExpression") {
    for (const argument of expression.arguments ?? []) {
      if (argument?.type !== "Identifier") continue;
      const namedHandler = handlersByName.get(argument.name);
      if (namedHandler) {
        return {
          handlerId: namedHandler.id,
          handlerName: argument.name,
        };
      }
    }
  }

  if (
    expression.type === "ArrowFunctionExpression" ||
    expression.type === "FunctionExpression"
  ) {
    const delegatedHandlerName = extractDirectCalledHandlerName(
      expression.body,
    );
    if (delegatedHandlerName) {
      const namedHandler = handlersByName.get(delegatedHandlerName);
      if (namedHandler) {
        return {
          handlerId: namedHandler.id,
          handlerName: delegatedHandlerName,
        };
      }
    }

    const inlineHandler: InteractionHandler = {
      id: store.nextId("handler"),
      name: "<inline>",
      node: expression,
      isAsync: inferIsAsyncHandler(expression),
      kind: "inline",
    };

    return {
      handlerId: inlineHandler.id,
      handlerName: inlineHandler.name,
      inlineHandler,
      inlineWrites: collectStateWritesForHandler(
        inlineHandler,
        statePairs,
        helperFunctionResolver,
        externalStatusModel,
        currentFilePath,
        maxTraceDepth,
        feedbackFunctionNames,
      ),
    };
  }

  return {};
}

export function collectInteractionsAndInlineHandlers(
  componentFunctionNode: any,
  statePairs: StatePair[],
  namedHandlersByName: Map<string, InteractionHandler>,
  helperFunctionResolver: HelperFunctionResolver,
  externalStatusModel: ExternalStatusModel,
  store: InteractionStore,
  currentFilePath: string,
  maxTraceDepth: number,
  feedbackFunctionNames: Set<string>,
): {
  interactions: InteractionSourceFact[];
  inlineHandlers: InteractionHandler[];
  inlineWrites: StateWrite[];
} {
  const interactions: InteractionSourceFact[] = [];
  const inlineHandlers: InteractionHandler[] = [];
  const inlineWrites: StateWrite[] = [];

  walkAst(
    componentFunctionNode.body ?? componentFunctionNode,
    (current) => {
      if (current.type !== "JSXOpeningElement") return;

      const binding = getEventBinding(current);
      if (!binding) return;

      const resolution = resolveInteractionHandlerReference(
        binding.handlerAttribute,
        namedHandlersByName,
        statePairs,
        helperFunctionResolver,
        externalStatusModel,
        store,
        currentFilePath,
        maxTraceDepth,
        feedbackFunctionNames,
      );

      if (resolution.inlineHandler) {
        inlineHandlers.push(resolution.inlineHandler);
      }

      if (resolution.inlineWrites?.length) {
        inlineWrites.push(...resolution.inlineWrites);
      }

      interactions.push({
        id: store.nextId("interaction"),
        node: current,
        eventName: binding.eventName,
        componentName: getJSXName(current) ?? undefined,
        label: attrText(current, "aria-label") ?? undefined,
        handlerId: resolution.handlerId,
        handlerName: resolution.handlerName,
      });
    },
    { skipNestedFunctions: true },
  );

  return { interactions, inlineHandlers, inlineWrites };
}
