type MutationButtonsProps = {
  disabled: boolean;
  onSaveSuccess: () => void;
  onSaveFailure: () => void;
};

export function MutationButtons({
  disabled,
  onSaveSuccess,
  onSaveFailure,
}: MutationButtonsProps) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" disabled={disabled} onClick={onSaveSuccess}>
        Save (Success)
      </button>
      <button type="button" disabled={disabled} onClick={onSaveFailure}>
        Save (Fail)
      </button>
    </div>
  );
}
