import { InteractionStore } from "../store";

export type InteractionFinding = {
  node: any;
  message: string;
};

function findHandler(source: any, store: InteractionStore) {
  const handlers = store.getHandlers();

  if (source.handlerId) {
    return handlers.find((handler) => handler.id === source.handlerId);
  }

  if (!source.handlerName) return;

  return handlers.find(
    (handler) =>
      handler.name === source.handlerName &&
      handler.scopeKey === source.scopeKey,
  );
}

function hasScopedLoadingFeedback(
  source: any,
  handler: any,
  store: InteractionStore,
): boolean {
  const feedbackInScope = store
    .getLoadingFeedback()
    .filter((feedback) => feedback.scopeKey === source.scopeKey);

  if (feedbackInScope.length === 0) return false;

  if (handler.stateKeysSetLoading.length === 0) {
    return true;
  }

  const loadingStateKeys = new Set(handler.stateKeysSetLoading);
  const hasStateKeyMatch = feedbackInScope.some(
    (feedback) =>
      typeof feedback.stateKey === "string" &&
      loadingStateKeys.has(feedback.stateKey),
  );

  if (hasStateKeyMatch) return true;

  return feedbackInScope.some((feedback) => !feedback.stateKey);
}

export function evaluateAsyncNoLoading(
  store: InteractionStore,
): InteractionFinding[] {
  const findings: InteractionFinding[] = [];

  const sources = store.getSources();

  for (const source of sources) {
    const handler = findHandler(source, store);

    if (!handler) continue;

    const isAsync =
      handler.asyncKind === "async-function" ||
      handler.asyncKind === "await-inside";

    if (!isAsync) continue;

    const hasFeedback = hasScopedLoadingFeedback(source, handler, store);

    if (hasFeedback) continue;

    findings.push({
      node: source.node,
      message:
        "[INTERACTION-ASYNC-001] Async interaction has no detectable loading feedback. Add a spinner, disabled state, loading text, or loading prop.",
    });
  }

  return findings;
}
