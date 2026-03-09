export type StatePair = {
  stateVar: string;
  setterVar: string;
};

export type StateWrite = {
  handlerName: string;
  stateVar: string;
  setterVar: string;
};

export type StateRead = {
  stateVar: string;
  node: any;
  kind:
    | "disabled-prop"
    | "loading-prop"
    | "conditional-render"
    | "ternary-render"
    | "text-feedback";
};

export type InteractionSource = {
  id: string;
  node: any;
  eventName: "onClick" | "onSubmit" | "onPress" | "unknown";
  label?: string;
  handlerName?: string;
  componentName?: string;
};

export type AsyncHandler = {
  id: string;
  name: string;
  node: any;
  asyncKind:
    | "async-function"
    | "await-inside"
    | "promise-chain"
    | "mutation-call";
};

export type ComponentStateModel = {
  componentName: string;
  statePairs: StatePair[];
  stateWrites: StateWrite[];
  stateReads: StateRead[];
  handlers: AsyncHandler[];
  interactions: InteractionSource[];
};
