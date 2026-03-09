import type { AsyncHandler, InteractionSource, LoadingFeedback } from "./types";

export class InteractionStore {
  private sources: InteractionSource[] = [];
  private handlers: AsyncHandler[] = [];
  private loadingFeedback: LoadingFeedback[] = [];
  private idCounter = 0;

  nextId(prefix: string): string {
    this.idCounter += 1;
    return `${prefix}-${this.idCounter}`;
  }

  addSource(source: InteractionSource) {
    this.sources.push(source);
  }

  addHandler(handler: AsyncHandler) {
    this.handlers.push(handler);
  }

  addLoadingFeedback(feedback: LoadingFeedback) {
    this.loadingFeedback.push(feedback);
  }

  getSources() {
    return this.sources;
  }

  getHandlers() {
    return this.handlers;
  }

  getLoadingFeedback() {
    return this.loadingFeedback;
  }
}