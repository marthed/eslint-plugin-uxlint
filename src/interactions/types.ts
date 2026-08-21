export type StatePair = {
  stateVar: string;
  setterVar: string;
};

// Pseudo state var recorded for imperative feedback calls (toast, alert, ...).
// Writes to it are always treated as visible by the interaction evaluator.
export const IMPERATIVE_FEEDBACK_STATE_VAR = "<imperative-feedback>";

// Pseudo state var recorded for navigation (router.push, navigate,
// location.href = ...). Navigation replaces the view, so these writes are
// always treated as visible by the interaction evaluator.
export const NAVIGATION_FEEDBACK_STATE_VAR = "<navigation-feedback>";

// Pseudo state var recorded when a handler hands its outcome to a
// parent-supplied callback prop (onError, onSuccess, onSubmit, ...). The
// feedback lives in the parent, which may be outside the traced scope, so
// reporting the phase as unhandled would assert an absence UXLint cannot see.
export const DELEGATED_FEEDBACK_STATE_VAR = "<delegated-feedback>";

export type InteractionPhase =
  | "sync"
  | "start"
  | "success"
  | "error"
  | "settled";

export type VisibleReadKind =
  | "disabled-prop"
  | "loading-prop"
  | "conditional-render"
  | "ternary-render"
  | "generic-visible-read";

export type InteractionHandler = {
  id: string;
  name: string;
  node: any;
  isAsync: boolean;
  kind: "named" | "inline";
};

export type StateWrite = {
  handlerId: string;
  stateVar: string;
  setterVar: string;
  phase: InteractionPhase;
  node: any;
};

export type StateRead = {
  stateVar: string;
  node: any;
  kind: VisibleReadKind;
};

export type PropRead = {
  propName: string;
  node: any;
  kind: VisibleReadKind;
};

export type StatePropPass = {
  stateVar: string;
  node: any;
  childComponentName: string;
  propName: string;
};

export type PropPass = {
  sourcePropName: string;
  childPropName: string;
  childComponentName: string;
  node: any;
};

export type PropSpreadPass = {
  childComponentName: string;
  node: any;
};

export type HandlerPropPass = {
  childComponentName: string;
  childPropName: string;
  node: any;
  handlerId?: string;
  handlerName?: string;
};

export type AsyncCollectionSource = {
  node: any;
  rendersCollection: boolean;
  hasLoadingBranch: boolean;
  hasErrorBranch: boolean;
  hasEmptyBranch: boolean;
};

export type HandlerPropCall = {
  handlerId: string;
  propName: string;
  node: any;
};

export type InteractionSource = {
  id: string;
  node: any;
  eventName: "onClick" | "onSubmit" | "onPress" | "unknown";
  label?: string;
  handlerId?: string;
  handlerName?: string;
  componentName?: string;
};

export type ComponentStateModel = {
  componentName: string;
  statePairs: StatePair[];
  stateWrites: StateWrite[];
  stateReads: StateRead[];
  propReads: PropRead[];
  statePropPasses: StatePropPass[];
  propPasses: PropPass[];
  propSpreadPasses: PropSpreadPass[];
  handlerPropPasses: HandlerPropPass[];
  handlerPropCalls: HandlerPropCall[];
  asyncCollectionSources: AsyncCollectionSource[];
  handlers: InteractionHandler[];
  interactions: InteractionSource[];
};
