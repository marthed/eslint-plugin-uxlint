// expect: INTERACTION-ASYNC-SUCCESS-001
import React from "react";

export function Bad() {
  const [isSaving, setIsSaving] = React.useState(false);
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await save();
    } catch (error) {
      toast.error(String(error));
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

export function Good() {
  const [isSaving, setIsSaving] = React.useState(false);
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await save();
      toast.success("Saved");
    } catch (error) {
      toast.error(String(error));
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
