import type { SaveOutcome } from "../types";

export async function saveProfileRequest(outcome: SaveOutcome) {
  await new Promise((resolve) => {
    setTimeout(resolve, 400);
  });

  if (outcome === "failure") {
    throw new Error("Profile save failed");
  }

  return {
    savedAt: new Date().toLocaleTimeString("en-US", { hour12: false }),
  };
}
