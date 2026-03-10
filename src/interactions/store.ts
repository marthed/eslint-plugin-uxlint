import type {
  ComponentStateModel,
  InteractionHandler,
  InteractionSource,
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
