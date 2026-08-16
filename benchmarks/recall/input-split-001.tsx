// expect: INPUT-SPLIT-001
export function Bad() {
  return <AppSplitButton items={["Duplicate", "Archive"]} />;
}

export function Good() {
  return (
    <AppSplitButton
      label="Save"
      onClick={save}
      items={["Save and close", "Save as draft"]}
    />
  );
}
