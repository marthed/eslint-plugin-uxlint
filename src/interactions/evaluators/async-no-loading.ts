import { InteractionStore } from "../store";

export type InteractionFinding = {
  node: any;
  message: string;
};

const LOADING_READ_KINDS = new Set([
  "disabled-prop",
  "loading-prop",
  "conditional-render",
  "ternary-render",
]);

export function evaluateAsyncNoLoading(
  store: InteractionStore,
): InteractionFinding[] {
  const findings: InteractionFinding[] = [];

  for (const component of store.getComponents()) {
    for (const interaction of component.interactions) {
      if (!interaction.handlerName) continue;

      const handler = component.handlers.find(
        (h) => h.name === interaction.handlerName,
      );
      if (!handler) continue;

      const writes = component.stateWrites.filter(
        (w) => w.handlerName === interaction.handlerName,
      );

      if (writes.length === 0) {
        findings.push({
          node: interaction.node,
          message:
            "[INTERACTION-ASYNC-001] Async interaction has no detectable loading feedback. " +
            "No component state written by this handler appears to drive visible loading UI.",
        });
        continue;
      }

      const hasFeedback = writes.some((write) =>
        component.stateReads.some(
          (read) =>
            read.stateVar === write.stateVar &&
            LOADING_READ_KINDS.has(read.kind),
        ),
      );

      if (!hasFeedback) {
        findings.push({
          node: interaction.node,
          message:
            "[INTERACTION-ASYNC-001] Async interaction has no detectable loading feedback. " +
            "This handler writes component state, but that state does not appear to be rendered as loading UI.",
        });
      }
    }
  }

  return findings;
}
