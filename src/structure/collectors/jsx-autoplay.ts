// Content that starts moving or making noise on its own must be stoppable.
//
// The catalog is unusually firm about this. Carousel: "don't make the carousel
// autoplay without also providing pause/stop controls", with the pause button
// listed as required. Video Player: "do not autoplay or auto-upload in a way
// that surprises people." It is also the oldest rule in accessibility --
// auto-playing audio the user cannot silence.
//
// `eslint-plugin-jsx-a11y` has no autoplay rule, so this does not duplicate it.

import { walkAst } from "../../interactions/collectors/ast-helpers";
import { getJSXName, hasAttr, attrText } from "../../shared/jsx-helpers";

const AUTOPLAY_PROPS = ["autoPlay", "autoplay", "autoRotate", "autorotate"];
const NATIVE_MEDIA = new Set(["video", "audio"]);

// A control that lets the user halt it. Matched by name, which is the
// suppressing direction: finding one silences the rule.
const PAUSE_NAME = /(pause|stop|autoplay|autoPlay|playing|paused)/i;

export type AutoplayFact = {
  node: any;
  elementName: string;
  isNativeMedia: boolean;
};

function getEnclosingFunction(node: any): any | null {
  let current = node?.parent;
  while (current) {
    if (
      current.type === "FunctionDeclaration" ||
      current.type === "FunctionExpression" ||
      current.type === "ArrowFunctionExpression"
    ) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

// Anything in the same component that reads as a way to stop it: a handler,
// a piece of state, or a control labelled "pause"/"stop".
function hasPauseAffordance(scope: any, autoplayNode: any): boolean {
  if (!scope) return false;

  let found = false;
  walkAst(scope.body ?? scope, (current) => {
    if (found) return;
    if (current === autoplayNode) return;

    if (current.type === "Identifier" && PAUSE_NAME.test(current.name)) {
      found = true;
      return;
    }

    if (
      (current.type === "Literal" || current.type === "JSXText") &&
      typeof current.value === "string" &&
      PAUSE_NAME.test(current.value)
    ) {
      found = true;
    }
  });

  return found;
}

export function collectAutoplayInFile(programNode: any): AutoplayFact[] {
  const facts: AutoplayFact[] = [];

  walkAst(programNode, (current) => {
    if (current.type !== "JSXElement") return;

    const opening = current.openingElement;
    if (!opening) return;

    const hasAutoplay = AUTOPLAY_PROPS.some((prop) => hasAttr(opening, prop));
    if (!hasAutoplay) return;

    const elementName = getJSXName(opening) ?? "";
    const isNativeMedia = NATIVE_MEDIA.has(elementName);

    if (isNativeMedia) {
      // Native controls are the stop mechanism. Muted video makes no sound,
      // which is the case this rule is really about, so leave it alone.
      if (hasAttr(opening, "controls")) return;
      if (elementName === "video" && hasAttr(opening, "muted")) return;
      // An explicitly false autoPlay is not autoplay.
      if (attrText(opening, "autoPlay") === "false") return;
    } else if (hasPauseAffordance(getEnclosingFunction(current), current)) {
      return;
    }

    facts.push({ node: current, elementName, isNativeMedia });
  });

  return facts;
}
