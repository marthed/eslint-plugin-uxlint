import type {
  ComponentStateModel,
  HandlerPropCall,
  HandlerPropPass,
  InteractionHandler,
  InteractionSource,
  PropPass,
  PropSpreadPass,
  PropRead,
  StatePair,
  StatePropPass,
  StateRead,
  StateWrite,
} from "./types";

export class InteractionStore {
  private components = new Map<string, ComponentStateModel>();
  private idCounter = 0;

  nextId(prefix: string): string {
    this.idCounter += 1;
    return `${prefix}-${this.idCounter}`;
  }

  private getOrCreateComponent(name: string): ComponentStateModel {
    const existing = this.components.get(name);
    if (existing) return existing;

    const created: ComponentStateModel = {
      componentName: name,
      statePairs: [],
      stateWrites: [],
      stateReads: [],
      propReads: [],
      statePropPasses: [],
      propPasses: [],
      propSpreadPasses: [],
      handlerPropPasses: [],
      handlerPropCalls: [],
      handlers: [],
      interactions: [],
    };

    this.components.set(name, created);
    return created;
  }

  addStatePair(componentName: string, pair: StatePair) {
    this.getOrCreateComponent(componentName).statePairs.push(pair);
  }

  addStateWrite(componentName: string, write: StateWrite) {
    this.getOrCreateComponent(componentName).stateWrites.push(write);
  }

  addStateRead(componentName: string, read: StateRead) {
    this.getOrCreateComponent(componentName).stateReads.push(read);
  }

  addPropRead(componentName: string, read: PropRead) {
    this.getOrCreateComponent(componentName).propReads.push(read);
  }

  addStatePropPass(componentName: string, pass: StatePropPass) {
    this.getOrCreateComponent(componentName).statePropPasses.push(pass);
  }

  addPropPass(componentName: string, pass: PropPass) {
    this.getOrCreateComponent(componentName).propPasses.push(pass);
  }

  addPropSpreadPass(componentName: string, pass: PropSpreadPass) {
    this.getOrCreateComponent(componentName).propSpreadPasses.push(pass);
  }

  addHandlerPropPass(componentName: string, pass: HandlerPropPass) {
    this.getOrCreateComponent(componentName).handlerPropPasses.push(pass);
  }

  addHandlerPropCall(componentName: string, call: HandlerPropCall) {
    this.getOrCreateComponent(componentName).handlerPropCalls.push(call);
  }

  addHandler(componentName: string, handler: InteractionHandler) {
    this.getOrCreateComponent(componentName).handlers.push(handler);
  }

  addInteraction(componentName: string, interaction: InteractionSource) {
    this.getOrCreateComponent(componentName).interactions.push(interaction);
  }

  ensureComponent(componentName: string) {
    this.getOrCreateComponent(componentName);
  }

  getComponents(): ComponentStateModel[] {
    return [...this.components.values()];
  }
}
