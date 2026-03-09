import type {
  AsyncHandler,
  ComponentStateModel,
  InteractionSource,
  StatePair,
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

  addHandler(componentName: string, handler: AsyncHandler) {
    this.getOrCreateComponent(componentName).handlers.push(handler);
  }

  addInteraction(componentName: string, interaction: InteractionSource) {
    this.getOrCreateComponent(componentName).interactions.push(interaction);
  }

  getComponents(): ComponentStateModel[] {
    return [...this.components.values()];
  }
}
