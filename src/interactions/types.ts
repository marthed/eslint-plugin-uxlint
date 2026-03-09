export type InteractionSource = {
  id: string;
  node: any;
  scopeKey: string;
  eventName: "onClick" | "onSubmit" | "onPress" | "unknown";
  label?: string;
  handlerId?: string;
  handlerName?: string;
  componentName?: string;
};

export type AsyncHandler = {
  id: string;
  name: string;
  node: any;
  scopeKey: string;
  asyncKind: "async-function" | "await-inside" | "promise-chain" | "mutation-call";
  stateKeysSetLoading: string[];
};

export type LoadingFeedback = {
  id: string;
  node: any;
  scopeKey: string;
  kind:
    | "disabled-control"
    | "loading-text"
    | "spinner-component"
    | "progress-component"
    | "loading-prop";
  stateKey?: string;
};

export type AsyncInteractionFlow = {
  source: InteractionSource;
  handler?: AsyncHandler;
  loadingFeedback: LoadingFeedback[];
};
