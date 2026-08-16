// expect: INTERACTION-ASYNC-START-001
import React from "react";

export function Bad() {
  const [saved, setSaved] = React.useState(false);
  const handleSave = async () => {
    try {
      await save();
      setSaved(true);
    } catch {
      toast.error("Failed");
    } finally {
      setSaved(false);
    }
  };
  return (
    <div>
      {saved && <p>Saved</p>}
      <button onClick={handleSave}>Save</button>
    </div>
  );
}

export function Good() {
  const [isSaving, setIsSaving] = React.useState(false);
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await save();
      toast.success("Saved");
    } catch {
      toast.error("Failed");
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <button onClick={handleSave} disabled={isSaving}>
      Save
    </button>
  );
}
