// Traces the state writes a handler performs: direct setState calls,
// imperative feedback calls (toast, alert, ...), navigation, and external
// status triggers (React Query mutate, Redux dispatch, Zustand actions).
// Writes are classified into interaction phases (start/success/error/settled)
// by their position relative to await/catch/finally, and tracing follows
// same-file and cross-file helper calls up to a bounded depth.

import {
  IMPERATIVE_FEEDBACK_STATE_VAR,
  NAVIGATION_FEEDBACK_STATE_VAR,
} from "../types";
import type {
  InteractionHandler,
  InteractionPhase,
  StatePair,
  StateWrite,
} from "../types";
import {
  getCallTargetName,
  getNodeStart,
  inferIsAsyncHandler,
  walkAst,
} from "./ast-helpers";
import type { ExternalStatusModel } from "./external-status-model";
import type { HelperFunctionResolver } from "./helper-resolver";
import {
  isLocationAssignmentTarget as isLocationAssignment,
  isNavigationCallExpression as isNavigationCall,
} from "../../shared/navigation";

function isInsideCatch(node: any): boolean {
  let current = node;
  let parent = node?.parent;

  while (parent) {
    if (parent.type === "CatchClause" && parent.body === current) {
      return true;
    }

    current = parent;
    parent = parent.parent;
  }

  return false;
}

function isInsideFinally(node: any): boolean {
  let current = node;
  let parent = node?.parent;

  while (parent) {
    if (parent.type === "TryStatement" && parent.finalizer === current) {
      return true;
    }

    current = parent;
    parent = parent.parent;
  }

  return false;
}

function classifyStateWritePhase(
  writeNode: any,
  isAsyncHandler: boolean,
  firstAwaitStart: number | null,
  orderingNode?: any,
): InteractionPhase {
  if (!isAsyncHandler) return "sync";
  if (isInsideFinally(writeNode)) return "settled";
  if (isInsideCatch(writeNode)) return "error";

  const writeStart = getNodeStart(orderingNode ?? writeNode);
  if (
    firstAwaitStart !== null &&
    writeStart !== null &&
    writeStart < firstAwaitStart
  ) {
    return "start";
  }

  if (firstAwaitStart !== null) return "success";
  return "start";
}

function findFirstAwaitStart(handlerNode: any): number | null {
  let firstAwaitStart: number | null = null;

  walkAst(
    handlerNode.body ?? handlerNode,
    (current) => {
      if (current.type !== "AwaitExpression") return;
      const start = getNodeStart(current);
      if (start === null) return;
      if (firstAwaitStart === null || start < firstAwaitStart) {
        firstAwaitStart = start;
      }
    },
    { skipNestedFunctions: true },
  );

  return firstAwaitStart;
}

type WritePhaseContext = {
  firstAwaitStart: number | null;
  isAsync: boolean;
  orderingNode: any | null;
};

function createWritePhaseContext(
  functionNode: any,
  parentContext: WritePhaseContext | null,
  callSiteNode: any | null,
): WritePhaseContext {
  const functionIsAsync = inferIsAsyncHandler(functionNode);
  if (functionIsAsync) {
    return {
      isAsync: true,
      firstAwaitStart: findFirstAwaitStart(functionNode),
      orderingNode: null,
    };
  }

  if (!parentContext?.isAsync) {
    return {
      isAsync: false,
      firstAwaitStart: null,
      orderingNode: null,
    };
  }

  return {
    isAsync: true,
    firstAwaitStart: parentContext.firstAwaitStart,
    orderingNode: callSiteNode,
  };
}

function classifyStateWriteWithContext(
  writeNode: any,
  phaseContext: WritePhaseContext,
  fallbackOrderingNode?: any,
): InteractionPhase {
  return classifyStateWritePhase(
    writeNode,
    phaseContext.isAsync,
    phaseContext.firstAwaitStart,
    phaseContext.orderingNode ?? fallbackOrderingNode ?? writeNode,
  );
}

function getBooleanLiteralArgument(callExpressionNode: any): boolean | null {
  const firstArgument = callExpressionNode?.arguments?.[0];
  if (
    firstArgument?.type === "Literal" &&
    typeof firstArgument.value === "boolean"
  ) {
    return firstArgument.value;
  }

  return null;
}

function getFeedbackCallMatch(
  callExpressionNode: any,
  feedbackFunctionNames: Set<string>,
): { memberName: string | null } | null {
  const callee = callExpressionNode?.callee;

  if (callee?.type === "Identifier") {
    return feedbackFunctionNames.has(callee.name) ? { memberName: null } : null;
  }

  if (
    callee?.type === "MemberExpression" &&
    callee.computed === false &&
    callee.object?.type === "Identifier" &&
    callee.property?.type === "Identifier"
  ) {
    if (
      feedbackFunctionNames.has(callee.object.name) ||
      feedbackFunctionNames.has(callee.property.name)
    ) {
      return { memberName: callee.property.name };
    }
  }

  return null;
}

// Navigation replaces the current view: outcome phases and pending state are
// all resolved from the user's point of view.
function getNavigationPhases(
  positionalPhase: InteractionPhase,
): InteractionPhase[] {
  if (positionalPhase === "sync") return ["sync"];
  if (positionalPhase === "start") return ["start"];
  if (positionalPhase === "settled") return ["settled"];
  if (positionalPhase === "error") return ["error", "settled"];
  return ["success", "error", "settled"];
}

function getFeedbackPhases(
  positionalPhase: InteractionPhase,
  memberName: string | null,
): InteractionPhase[] {
  if (positionalPhase === "sync") return ["sync"];
  if (positionalPhase === "settled") return ["settled"];
  if (positionalPhase === "error") return ["error"];

  // Member names like toast.error / toast.success carry outcome semantics.
  if (memberName) {
    if (/error|fail|warn/i.test(memberName)) return ["error"];
    if (/success/i.test(memberName)) return ["success"];
  }

  if (positionalPhase === "start") return ["start"];

  // A plain feedback call after the first await usually sits in outcome
  // handling; branches for success and failure are statically
  // indistinguishable, so count it for both rather than over-report.
  return ["success", "error"];
}

export function collectStateWritesForHandler(
  handler: InteractionHandler,
  statePairs: StatePair[],
  helperFunctionResolver: HelperFunctionResolver,
  externalStatusModel: ExternalStatusModel,
  currentFilePath: string,
  maxTraceDepth: number,
  feedbackFunctionNames: Set<string>,
): StateWrite[] {
  const setterToState = new Map(
    statePairs.map((pair) => [pair.setterVar, pair.stateVar]),
  );
  const externalWriteKeys = new Set<string>();
  const rootPhaseContext = createWritePhaseContext(handler.node, null, null);

  // React Query and tRPC mutations usually put their feedback in the hook's
  // lifecycle options rather than in the handler that calls mutateAsync:
  //
  //   const { mutateAsync: del } = trpc.x.delete.useMutation({
  //     onSuccess: () => toast({ title: 'Deleted' }),
  //     onError: () => toast({ variant: 'destructive' }),
  //   });
  //
  // Credit that feedback to the phase the callback runs in. The phase is known
  // from the option name, so no positional classification is needed.
  function collectLifecycleCallbackWrites(
    callNode: any,
    calleeName: string | null,
    setterAliases: Map<string, string>,
  ): StateWrite[] {
    const triggerKeys: string[] = [];
    if (calleeName) triggerKeys.push(calleeName);

    const callee = callNode.callee;
    if (
      callee?.type === "MemberExpression" &&
      callee.computed === false &&
      callee.object?.type === "Identifier" &&
      callee.property?.type === "Identifier"
    ) {
      triggerKeys.push(`${callee.object.name}.${callee.property.name}`);
    }

    const writes: StateWrite[] = [];

    for (const triggerKey of triggerKeys) {
      const callbacks =
        externalStatusModel.lifecycleCallbacksByTrigger.get(triggerKey);
      if (!callbacks) continue;

      for (const callback of callbacks) {
        walkAst(callback.node.body ?? callback.node, (inner: any) => {
          if (inner?.type === "AssignmentExpression") {
            if (isLocationAssignment(inner.left)) {
              writes.push({
                handlerId: handler.id,
                stateVar: NAVIGATION_FEEDBACK_STATE_VAR,
                setterVar: "location",
                phase: callback.phase,
                node: inner,
              });
            }
            return;
          }

          if (inner?.type !== "CallExpression") return;

          const innerCalleeName =
            inner.callee?.type === "Identifier" ? inner.callee.name : null;
          const innerTargetName = getCallTargetName(inner.callee);

          const stateVar = innerCalleeName
            ? setterAliases.get(innerCalleeName)
            : undefined;
          if (stateVar) {
            writes.push({
              handlerId: handler.id,
              stateVar,
              setterVar: innerTargetName,
              phase: callback.phase,
              node: inner,
            });
          }

          if (getFeedbackCallMatch(inner, feedbackFunctionNames)) {
            writes.push({
              handlerId: handler.id,
              stateVar: IMPERATIVE_FEEDBACK_STATE_VAR,
              setterVar: innerTargetName,
              phase: callback.phase,
              node: inner,
            });
          }

          if (isNavigationCall(inner)) {
            writes.push({
              handlerId: handler.id,
              stateVar: NAVIGATION_FEEDBACK_STATE_VAR,
              setterVar: innerTargetName,
              phase: callback.phase,
              node: inner,
            });
          }
        });
      }
    }

    return writes;
  }

  function collectWritesFromFunction(
    functionNode: any,
    functionFilePath: string,
    setterAliases: Map<string, string>,
    phaseContext: WritePhaseContext,
    activeHelpers: Set<string>,
    depth: number,
  ): StateWrite[] {
    const writes: StateWrite[] = [];

    walkAst(
      functionNode.body ?? functionNode,
      (current) => {
        if (current.type === "AssignmentExpression") {
          if (isLocationAssignment(current.left)) {
            const positionalPhase = classifyStateWriteWithContext(
              current,
              phaseContext,
              current,
            );
            for (const phase of getNavigationPhases(positionalPhase)) {
              writes.push({
                handlerId: handler.id,
                stateVar: NAVIGATION_FEEDBACK_STATE_VAR,
                setterVar: "location",
                phase,
                node: current,
              });
            }
          }
          return;
        }

        if (current.type !== "CallExpression") return;

        const calleeName =
          current.callee?.type === "Identifier" ? current.callee.name : null;
        const callTargetName = getCallTargetName(current.callee);

        const stateVar = calleeName ? setterAliases.get(calleeName) : undefined;
        if (stateVar) {
          writes.push({
            handlerId: handler.id,
            stateVar,
            setterVar: callTargetName,
            phase: classifyStateWriteWithContext(
              current,
              phaseContext,
              current,
            ),
            node: current,
          });
        }

        const feedbackMatch = getFeedbackCallMatch(
          current,
          feedbackFunctionNames,
        );
        if (feedbackMatch) {
          const positionalPhase = classifyStateWriteWithContext(
            current,
            phaseContext,
            current,
          );
          for (const phase of getFeedbackPhases(
            positionalPhase,
            feedbackMatch.memberName,
          )) {
            writes.push({
              handlerId: handler.id,
              stateVar: IMPERATIVE_FEEDBACK_STATE_VAR,
              setterVar: callTargetName,
              phase,
              node: current,
            });
          }
        }

        if (isNavigationCall(current)) {
          const positionalPhase = classifyStateWriteWithContext(
            current,
            phaseContext,
            current,
          );
          for (const phase of getNavigationPhases(positionalPhase)) {
            writes.push({
              handlerId: handler.id,
              stateVar: NAVIGATION_FEEDBACK_STATE_VAR,
              setterVar: callTargetName,
              phase,
              node: current,
            });
          }
        }

        const triggeredStateVars = new Set<string>();
        if (calleeName) {
          for (const triggeredStateVar of externalStatusModel.triggerStateVarsByIdentifier.get(
            calleeName,
          ) ?? []) {
            triggeredStateVars.add(triggeredStateVar);
          }
        }

        if (
          current.callee?.type === "MemberExpression" &&
          current.callee.computed === false &&
          current.callee.object?.type === "Identifier" &&
          current.callee.property?.type === "Identifier"
        ) {
          const methodsForObject =
            externalStatusModel.triggerStateVarsByMember.get(
              current.callee.object.name,
            );
          for (const triggeredStateVar of methodsForObject?.get(
            current.callee.property.name,
          ) ?? []) {
            triggeredStateVars.add(triggeredStateVar);
          }
        }

        collectLifecycleCallbackWrites(
          current,
          calleeName,
          setterAliases,
        ).forEach((write) => writes.push(write));

        for (const triggeredStateVar of triggeredStateVars) {
          const phases =
            externalStatusModel.statusPhasesByStateVar.get(triggeredStateVar);
          if (!phases || phases.size === 0) continue;

          for (const phase of phases) {
            const writeKey = `${triggeredStateVar}:${phase}:${callTargetName}`;
            if (externalWriteKeys.has(writeKey)) continue;
            externalWriteKeys.add(writeKey);

            writes.push({
              handlerId: handler.id,
              stateVar: triggeredStateVar,
              setterVar: callTargetName,
              phase,
              node: current,
            });
          }
        }

        if (!calleeName) return;
        if (depth >= maxTraceDepth) return;

        const helperFunction = helperFunctionResolver.resolve(
          functionFilePath,
          calleeName,
        );
        if (!helperFunction) return;

        const helperTraceKey = `${helperFunction.filePath}::${helperFunction.functionName}`;
        if (activeHelpers.has(helperTraceKey)) return;

        const helperSetterAliases = new Map(setterAliases);
        const helperParams = Array.isArray(helperFunction.node.params)
          ? helperFunction.node.params
          : [];
        const helperArgs = Array.isArray(current.arguments)
          ? current.arguments
          : [];

        for (let index = 0; index < helperParams.length; index += 1) {
          const param = helperParams[index];
          const arg = helperArgs[index];
          if (param?.type !== "Identifier") continue;
          if (arg?.type !== "Identifier") continue;

          const argStateVar = setterAliases.get(arg.name);
          if (!argStateVar) continue;
          helperSetterAliases.set(param.name, argStateVar);
        }

        const nestedHelpers = new Set(activeHelpers);
        nestedHelpers.add(helperTraceKey);
        const helperPhaseContext = createWritePhaseContext(
          helperFunction.node,
          phaseContext,
          current,
        );
        writes.push(
          ...collectWritesFromFunction(
            helperFunction.node,
            helperFunction.filePath,
            helperSetterAliases,
            helperPhaseContext,
            nestedHelpers,
            depth + 1,
          ),
        );
      },
      { skipNestedFunctions: true },
    );

    return writes;
  }

  const writes = collectWritesFromFunction(
    handler.node,
    currentFilePath,
    setterToState,
    rootPhaseContext,
    new Set<string>(),
    0,
  );

  if (!writes.some((write) => write.phase !== "sync")) return writes;

  // Treat post-await writes that clear a pending flag as settled feedback
  // when the same state var was set to true in start.
  const startPendingStateVars = new Set(
    writes
      .filter(
        (write) =>
          write.phase === "start" &&
          getBooleanLiteralArgument(write.node) === true,
      )
      .map((write) => write.stateVar),
  );

  for (const write of writes) {
    if (write.phase !== "success") continue;
    if (!startPendingStateVars.has(write.stateVar)) continue;
    if (getBooleanLiteralArgument(write.node) !== false) continue;

    write.phase = "settled";
  }

  return writes;
}
