// expect: INTERACTION-ASYNC-SETTLED-001
import React from "react";

export function Bad() {
  const [isSaving, setIsSaving] = React.useState(false);
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await save();
      toast.success("Saved");
    } catch {
      toast.error("Failed");
    }
  };
  return (
    <button onClick={handleSave} disabled={isSaving}>
      Save
    </button>
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
