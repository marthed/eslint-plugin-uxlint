export type StatePair = {
  stateVar: string;
  setterVar: string;
};

export type InteractionPhase = "sync" | "start" | "success" | "error" | "settled";

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
  kind:
    | "disabled-prop"
    | "loading-prop"
    | "conditional-render"
    | "ternary-render"
    | "generic-visible-read"
    | "prop-passed";
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
  handlers: InteractionHandler[];
  interactions: InteractionSource[];
};
