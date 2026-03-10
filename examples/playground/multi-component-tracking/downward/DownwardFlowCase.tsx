import React from "react";
import { DownwardLevelOne } from "./levels/DownwardLevelOne";
import { runProfileSave } from "../services/runProfileSave";

export function DownwardFlowCase() {
  const [isSaving, setIsSaving] = React.useState(false);
  const [didSave, setDidSave] = React.useState(false);
  const [didFail, setDidFail] = React.useState(false);

  async function handleSave(shouldFail: boolean) {
    setDidSave(false);
    setDidFail(false);

    await runProfileSave({
      shouldFail,
      setIsSaving,
      setDidSave,
      setDidFail,
    });
  }

  function handleSaveSuccess() {
    void handleSave(false);
  }

  function handleSaveFailure() {
    void handleSave(true);
  }

  return (
    <>
      <DownwardLevelOne
        onSaveSuccess={handleSaveSuccess}
        onSaveFailure={handleSaveFailure}
        isSaving={isSaving}
        didSave={didSave}
        didFail={didFail}
      />
    </>
  );
}
