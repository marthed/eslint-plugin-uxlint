type BooleanSetter = (value: boolean) => void;

export async function runProfileSave({
  shouldFail,
  setIsSaving,
  setDidSave,
  setDidFail,
}: {
  shouldFail: boolean;
  setIsSaving: BooleanSetter;
  setDidSave: BooleanSetter;
  setDidFail: BooleanSetter;
}) {
  setIsSaving(true);

  try {
    await wait(900);

    if (shouldFail) {
      throw new Error("Save failed");
    }

    setDidSave(true);
  } catch {
    setDidFail(true);
  } finally {
    setIsSaving(false);
  }
}

async function wait(ms: number) {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
