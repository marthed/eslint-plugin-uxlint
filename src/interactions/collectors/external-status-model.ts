// Recognizes common external status signals so a component's async lifecycle
// can be tied to state that lives outside its own useState calls: React
// Query mutation objects, Redux selector/dispatch pairs, and Zustand store
// selectors with status-like names.

import type { InteractionPhase } from "../types";
import {
  getObjectPatternPropertyKeyName,
  unwrapAssignmentPattern,
  walkAst,
} from "./ast-helpers";

// A mutation's onSuccess/onError/onSettled/onMutate option, where the feedback
// for that phase very often lives instead of in the calling handler.
export type LifecycleCallback = {
  phase: InteractionPhase;
  node: any;
};

export type ExternalStatusModel = {
  observableStateVars: Set<string>;
  statusPhasesByStateVar: Map<string, Set<InteractionPhase>>;
  triggerStateVarsByIdentifier: Map<string, Set<string>>;
  triggerStateVarsByMember: Map<string, Map<string, Set<string>>>;
  // Keyed by trigger identifier (`deleteClaim`) or `object.method`
  // (`deleteMutation.mutateAsync`).
  lifecycleCallbacksByTrigger: Map<string, LifecycleCallback[]>;
  // react-hook-form: the status vars a handleSubmit wrapper confers on the
  // handler it wraps. Keyed by `handleSubmit` or `form.handleSubmit`.
  submitWrapperStatusVars: Map<string, Set<string>>;
};

// react-hook-form manages these around the wrapped submit handler, so a form
// whose only pending cue is disabled={form.formState.isSubmitting} is still
// giving the user feedback.
const FORM_STATE_STATUS_FIELDS: Array<{
  fieldName: string;
  phases: InteractionPhase[];
}> = [
  { fieldName: "isSubmitting", phases: ["start", "settled"] },
  { fieldName: "isLoading", phases: ["start", "settled"] },
  { fieldName: "isValidating", phases: ["start", "settled"] },
  { fieldName: "isSubmitSuccessful", phases: ["success"] },
];

const LIFECYCLE_OPTION_PHASES: Record<string, InteractionPhase> = {
  onMutate: "start",
  onSuccess: "success",
  onError: "error",
  onSettled: "settled",
};

const PENDING_NAME_HINT =
  /(pending|loading|saving|submitting|fetching|mutating)/i;
const ERROR_NAME_HINT = /(error|failed|failure|invalid)/i;
const SUCCESS_NAME_HINT =
  /(success|succeed|succeeded|saved|done|complete|completed)/i;
const STATUS_NAME_HINT = /status/i;
const ACTION_NAME_HINT =
  /^(set|save|submit|create|update|remove|delete|load|fetch|mutate)/i;

function createExternalStatusModel(): ExternalStatusModel {
  return {
    observableStateVars: new Set<string>(),
    statusPhasesByStateVar: new Map<string, Set<InteractionPhase>>(),
    triggerStateVarsByIdentifier: new Map<string, Set<string>>(),
    triggerStateVarsByMember: new Map<string, Map<string, Set<string>>>(),
    lifecycleCallbacksByTrigger: new Map<string, LifecycleCallback[]>(),
    submitWrapperStatusVars: new Map<string, Set<string>>(),
  };
}

function isUseFormCallExpression(node: any): boolean {
  if (node?.type !== "CallExpression") return false;

  const callee = node.callee;
  if (callee?.type === "Identifier") return callee.name === "useForm";

  return (
    callee?.type === "MemberExpression" &&
    callee.computed === false &&
    callee.property?.type === "Identifier" &&
    callee.property.name === "useForm"
  );
}

// Registers the status vars a useForm() result exposes, and ties them to the
// handleSubmit wrapper so the handler it wraps inherits them.
function collectUseFormStatusModel(
  model: ExternalStatusModel,
  declarator: any,
) {
  function registerFormState(formStatePath: string, wrapperKey: string) {
    const statusVars = new Set<string>();

    for (const field of FORM_STATE_STATUS_FIELDS) {
      const stateVar = `${formStatePath}.${field.fieldName}`;
      addStatusPhases(model, stateVar, field.phases);
      statusVars.add(stateVar);
    }

    const existing =
      model.submitWrapperStatusVars.get(wrapperKey) ?? new Set<string>();
    for (const stateVar of statusVars) existing.add(stateVar);
    model.submitWrapperStatusVars.set(wrapperKey, existing);
  }

  if (declarator.id?.type === "Identifier") {
    const formName = declarator.id.name;
    registerFormState(`${formName}.formState`, `${formName}.handleSubmit`);
    return;
  }

  if (declarator.id?.type !== "ObjectPattern") return;

  // const { handleSubmit, formState } = useForm(), including the nested
  // const { formState: { isSubmitting } } = useForm() shape.
  let submitWrapperName: string | null = null;
  const formStateNames: string[] = [];
  const directStatusVars = new Set<string>();

  for (const property of declarator.id.properties ?? []) {
    const keyName = getObjectPatternPropertyKeyName(property);
    if (!keyName) continue;

    const valueNode = unwrapAssignmentPattern(property.value);

    if (keyName === "handleSubmit" && valueNode?.type === "Identifier") {
      submitWrapperName = valueNode.name;
      continue;
    }

    if (keyName !== "formState") continue;

    if (valueNode?.type === "Identifier") {
      formStateNames.push(valueNode.name);
      continue;
    }

    if (valueNode?.type === "ObjectPattern") {
      for (const nested of valueNode.properties ?? []) {
        const nestedKey = getObjectPatternPropertyKeyName(nested);
        if (!nestedKey) continue;

        const nestedValue = unwrapAssignmentPattern(nested.value);
        if (nestedValue?.type !== "Identifier") continue;

        const field = FORM_STATE_STATUS_FIELDS.find(
          (candidate) => candidate.fieldName === nestedKey,
        );
        if (!field) continue;

        addStatusPhases(model, nestedValue.name, field.phases);
        directStatusVars.add(nestedValue.name);
      }
    }
  }

  if (!submitWrapperName) return;

  for (const formStateName of formStateNames) {
    registerFormState(formStateName, submitWrapperName);
  }

  if (directStatusVars.size > 0) {
    const existing =
      model.submitWrapperStatusVars.get(submitWrapperName) ?? new Set<string>();
    for (const stateVar of directStatusVars) existing.add(stateVar);
    model.submitWrapperStatusVars.set(submitWrapperName, existing);
  }
}

// Reads the options object of a useMutation call: useMutation({ onSuccess })
// for a bare hook, useMutation(fn, { onSuccess }) for the positional form.
function getLifecycleCallbacks(callNode: any): LifecycleCallback[] {
  const callbacks: LifecycleCallback[] = [];

  for (const argument of callNode.arguments ?? []) {
    if (argument?.type !== "ObjectExpression") continue;

    for (const property of argument.properties ?? []) {
      if (property?.type !== "Property" || property.computed) continue;

      const keyName =
        property.key?.type === "Identifier"
          ? property.key.name
          : property.key?.type === "Literal"
            ? String(property.key.value)
            : null;
      const phase = keyName ? LIFECYCLE_OPTION_PHASES[keyName] : undefined;
      if (!phase) continue;

      const value = property.value;
      if (
        value?.type === "ArrowFunctionExpression" ||
        value?.type === "FunctionExpression"
      ) {
        callbacks.push({ phase, node: value });
      }
    }
  }

  return callbacks;
}

function addLifecycleCallbacks(
  model: ExternalStatusModel,
  triggerKey: string,
  callbacks: LifecycleCallback[],
) {
  if (callbacks.length === 0) return;

  const existing = model.lifecycleCallbacksByTrigger.get(triggerKey) ?? [];
  existing.push(...callbacks);
  model.lifecycleCallbacksByTrigger.set(triggerKey, existing);
}

function addStatusPhases(
  model: ExternalStatusModel,
  stateVar: string,
  phases: Iterable<InteractionPhase>,
) {
  const existingPhases =
    model.statusPhasesByStateVar.get(stateVar) ?? new Set<InteractionPhase>();

  for (const phase of phases) {
    existingPhases.add(phase);
  }

  if (existingPhases.size === 0) return;
  model.observableStateVars.add(stateVar);
  model.statusPhasesByStateVar.set(stateVar, existingPhases);
}

function addTriggerIdentifier(
  model: ExternalStatusModel,
  triggerName: string,
  stateVars: Iterable<string>,
) {
  const existingStateVars =
    model.triggerStateVarsByIdentifier.get(triggerName) ?? new Set<string>();

  for (const stateVar of stateVars) {
    existingStateVars.add(stateVar);
  }

  if (existingStateVars.size === 0) return;
  model.triggerStateVarsByIdentifier.set(triggerName, existingStateVars);
}

function addTriggerMember(
  model: ExternalStatusModel,
  objectName: string,
  methodName: string,
  stateVars: Iterable<string>,
) {
  const methodsForObject =
    model.triggerStateVarsByMember.get(objectName) ??
    new Map<string, Set<string>>();
  const existingStateVars =
    methodsForObject.get(methodName) ?? new Set<string>();

  for (const stateVar of stateVars) {
    existingStateVars.add(stateVar);
  }

  if (existingStateVars.size === 0) return;
  methodsForObject.set(methodName, existingStateVars);
  model.triggerStateVarsByMember.set(objectName, methodsForObject);
}

function getStatusPhasesFromName(name: string): Set<InteractionPhase> {
  const phases = new Set<InteractionPhase>();

  if (PENDING_NAME_HINT.test(name)) {
    phases.add("start");
    phases.add("settled");
  }

  if (ERROR_NAME_HINT.test(name)) {
    phases.add("error");
  }

  if (SUCCESS_NAME_HINT.test(name)) {
    phases.add("success");
  }

  if (STATUS_NAME_HINT.test(name)) {
    phases.add("start");
    phases.add("settled");
    phases.add("error");
    phases.add("success");
  }

  return phases;
}

// Hooks that return a trigger plus status fields and take onSuccess/onError
// style options: React Query and tRPC's useMutation, next-safe-action's
// useAction. They differ only in naming, so they share one model.
const ACTION_HOOK_NAMES = new Set(["useMutation", "useAction"]);
const ACTION_TRIGGER_KEYS = [
  "mutate",
  "mutateAsync",
  "execute",
  "executeAsync",
];

// Matches a bare call and any member-expression path ending in one of the
// hook names, so tRPC's `trpc.admin.document.delete.useMutation()` and similar
// generated clients (`api.users.create.useMutation()`) are recognized too.
// Without this, every tRPC mutation looks like an interaction with no status
// model at all.
function isUseMutationCallExpression(node: any): boolean {
  if (node?.type !== "CallExpression") return false;

  const callee = node.callee;
  if (callee?.type === "Identifier") return ACTION_HOOK_NAMES.has(callee.name);

  return (
    callee?.type === "MemberExpression" &&
    callee.computed === false &&
    callee.property?.type === "Identifier" &&
    ACTION_HOOK_NAMES.has(callee.property.name)
  );
}

function isUseSelectorCallExpression(node: any): boolean {
  return node?.type === "CallExpression" && node.callee?.type === "Identifier"
    ? node.callee.name === "useSelector"
    : false;
}

function isUseDispatchCallExpression(node: any): boolean {
  return node?.type === "CallExpression" && node.callee?.type === "Identifier"
    ? node.callee.name === "useDispatch"
    : false;
}

function isLikelyUseStoreHook(node: any): boolean {
  if (node?.type !== "CallExpression") return false;
  if (node.callee?.type !== "Identifier") return false;
  return node.callee.name === "useStore" || /Store$/.test(node.callee.name);
}

function isActionLikeName(name: string): boolean {
  return ACTION_NAME_HINT.test(name);
}

function extractReturnedNodeFromSelector(selectorNode: any): any | null {
  if (!selectorNode) return null;

  if (
    selectorNode.type === "ArrowFunctionExpression" ||
    selectorNode.type === "FunctionExpression"
  ) {
    if (selectorNode.body?.type === "BlockStatement") {
      for (const statement of selectorNode.body.body ?? []) {
        if (statement.type !== "ReturnStatement") continue;
        return statement.argument ?? null;
      }
      return null;
    }

    return selectorNode.body ?? null;
  }

  return null;
}

function extractSelectedStoreMemberName(selectorNode: any): string | null {
  const returnedNode = extractReturnedNodeFromSelector(selectorNode);
  if (!returnedNode) return null;

  if (
    returnedNode.type === "MemberExpression" &&
    returnedNode.computed === false &&
    returnedNode.property?.type === "Identifier"
  ) {
    return returnedNode.property.name;
  }

  return null;
}

export function collectExternalStatusModel(
  componentFunctionNode: any,
): ExternalStatusModel {
  const model = createExternalStatusModel();
  const reduxStateVars = new Set<string>();
  const reduxTriggerNames = new Set<string>();
  const zustandStateVars = new Set<string>();
  const zustandTriggerNames = new Set<string>();

  walkAst(
    componentFunctionNode.body ?? componentFunctionNode,
    (current) => {
      if (current.type !== "VariableDeclarator") return;
      if (current.init?.type !== "CallExpression") return;

      if (isUseFormCallExpression(current.init)) {
        collectUseFormStatusModel(model, current);
        return;
      }

      if (isUseMutationCallExpression(current.init)) {
        const lifecycleCallbacks = getLifecycleCallbacks(current.init);

        if (current.id?.type === "ObjectPattern") {
          const mutationStatusStateVars = new Set<string>();
          const mutationTriggerNames = new Set<string>();

          for (const property of current.id.properties ?? []) {
            const keyName = getObjectPatternPropertyKeyName(property);
            if (!keyName) continue;

            const valueNode = unwrapAssignmentPattern(property.value);
            if (valueNode?.type !== "Identifier") continue;

            if (ACTION_TRIGGER_KEYS.includes(keyName)) {
              mutationTriggerNames.add(valueNode.name);
              continue;
            }

            const phaseHints = getStatusPhasesFromName(keyName);
            if (phaseHints.size === 0) continue;

            addStatusPhases(model, valueNode.name, phaseHints);
            mutationStatusStateVars.add(valueNode.name);
          }

          for (const triggerName of mutationTriggerNames) {
            addTriggerIdentifier(model, triggerName, mutationStatusStateVars);
            addLifecycleCallbacks(model, triggerName, lifecycleCallbacks);
          }
        }

        if (current.id?.type === "Identifier") {
          const mutationObjectName = current.id.name;
          const memberStatusFields: Array<{
            fieldName: string;
            phases: InteractionPhase[];
          }> = [
            { fieldName: "isPending", phases: ["start", "settled"] },
            { fieldName: "isLoading", phases: ["start", "settled"] },
            { fieldName: "isError", phases: ["error"] },
            { fieldName: "error", phases: ["error"] },
            { fieldName: "isSuccess", phases: ["success"] },
            {
              fieldName: "status",
              phases: ["start", "settled", "error", "success"],
            },
          ];

          const memberStatusStateVars = new Set<string>();
          for (const memberStatusField of memberStatusFields) {
            const stateVar = `${mutationObjectName}.${memberStatusField.fieldName}`;
            addStatusPhases(model, stateVar, memberStatusField.phases);
            memberStatusStateVars.add(stateVar);
          }

          for (const method of ACTION_TRIGGER_KEYS) {
            addTriggerMember(
              model,
              mutationObjectName,
              method,
              memberStatusStateVars,
            );
            addLifecycleCallbacks(
              model,
              `${mutationObjectName}.${method}`,
              lifecycleCallbacks,
            );
          }
        }

        return;
      }

      if (isUseDispatchCallExpression(current.init)) {
        if (current.id?.type !== "Identifier") return;
        reduxTriggerNames.add(current.id.name);
        return;
      }

      if (isUseSelectorCallExpression(current.init)) {
        if (current.id?.type !== "Identifier") return;

        const selectorPhases = getStatusPhasesFromName(current.id.name);
        if (selectorPhases.size === 0) return;

        addStatusPhases(model, current.id.name, selectorPhases);
        reduxStateVars.add(current.id.name);
        return;
      }

      if (!isLikelyUseStoreHook(current.init)) return;
      if (current.id?.type !== "Identifier") return;

      const selectedStoreMember = extractSelectedStoreMemberName(
        current.init.arguments?.[0],
      );
      if (!selectedStoreMember) return;

      const selectedStatePhases = getStatusPhasesFromName(selectedStoreMember);
      if (selectedStatePhases.size > 0) {
        addStatusPhases(model, current.id.name, selectedStatePhases);
        zustandStateVars.add(current.id.name);
        return;
      }

      if (
        isActionLikeName(selectedStoreMember) ||
        isActionLikeName(current.id.name)
      ) {
        zustandTriggerNames.add(current.id.name);
      }
    },
    { skipNestedFunctions: true },
  );

  for (const reduxTriggerName of reduxTriggerNames) {
    addTriggerIdentifier(model, reduxTriggerName, reduxStateVars);
  }

  for (const zustandTriggerName of zustandTriggerNames) {
    addTriggerIdentifier(model, zustandTriggerName, zustandStateVars);
  }

  return model;
}
