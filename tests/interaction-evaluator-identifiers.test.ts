import assert from "node:assert/strict";
import test from "node:test";
import { evaluateInteractionFeedback } from "../src/interactions/evaluators/interaction-feedback";
import { InteractionStore } from "../src/interactions/store";

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

function makeStoreWithUnseenSyncWrite(interaction: {
  handlerId?: string;
  handlerName?: string;
}) {
  const store = new InteractionStore();
  const componentName = "ExampleComponent";

  store.addHandler(componentName, {
    id: "handler-1",
    name: "handleClick",
    node: {},
    isAsync: false,
    kind: "named",
  });

  store.addStateWrite(componentName, {
    handlerId: "handler-1",
    stateVar: "isOpen",
    setterVar: "setIsOpen",
    phase: "sync",
    node: {},
  });

  store.addInteraction(componentName, {
    id: "interaction-1",
    node: {},
    eventName: "onClick",
    handlerId: interaction.handlerId,
    handlerName: interaction.handlerName,
  });

  return store;
}

serialTest("resolves handlers by handlerName when handlerId is absent", () => {
  const store = makeStoreWithUnseenSyncWrite({
    handlerName: "handleClick",
  });

  const findings = evaluateInteractionFeedback(store);

  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /\[INTERACTION-SYNC-001\]/);
});

serialTest(
  "falls back to handlerName when handlerId is present but unresolved",
  () => {
    const store = makeStoreWithUnseenSyncWrite({
      handlerId: "missing-handler-id",
      handlerName: "handleClick",
    });

    const findings = evaluateInteractionFeedback(store);

    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /\[INTERACTION-SYNC-001\]/);
  },
);

serialTest(
  "skips interactions when neither handlerId nor handlerName resolves",
  () => {
    const store = makeStoreWithUnseenSyncWrite({
      handlerName: "doesNotExist",
    });

    const findings = evaluateInteractionFeedback(store);

    assert.equal(findings.length, 0);
  },
);
