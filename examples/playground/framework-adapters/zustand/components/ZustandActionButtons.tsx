type ZustandActionButtonsProps = {
  disabled: boolean;
  onSaveSuccess: () => void;
  onSaveFailure: () => void;
};

export function ZustandActionButtons({
  disabled,
  onSaveSuccess,
  onSaveFailure,
}: ZustandActionButtonsProps) {
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
