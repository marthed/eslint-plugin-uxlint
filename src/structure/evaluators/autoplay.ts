import type { AutoplayFact } from "../collectors/jsx-autoplay";

export type AutoplayFinding = {
  node: any;
  message: string;
};

export function evaluateAutoplay(facts: AutoplayFact[]): AutoplayFinding[] {
  return facts.map((fact) => ({
    node: fact.node,
    message: fact.isNativeMedia
      ? `[MEDIA-AUTOPLAY-001] <${fact.elementName}> plays automatically with sound and no controls. ` +
        "Add controls, or mute it, so the user can stop what they did not start."
      : `[MEDIA-AUTOPLAY-001] <${fact.elementName}> starts on its own with no way to pause it. ` +
        "Offer a pause or stop control alongside it.",
  }));
}
