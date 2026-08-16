// expect: INPUT-SPLIT-002
export function Bad() {
  return (
    <AppSplitButton
      label="Open report"
      href="/reports/42"
      items={["Open in new tab"]}
    />
  );
}

export function Good() {
  return (
    <AppSplitButton
      label="Export"
      onClick={exportReport}
      items={["Export as CSV"]}
    />
  );
}
