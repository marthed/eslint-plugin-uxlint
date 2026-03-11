type ZustandGoodStatusProps = {
  isSaving: boolean;
  saveError: string;
  isSuccess: boolean;
};

export function ZustandGoodStatus({
  isSaving,
  saveError,
  isSuccess,
}: ZustandGoodStatusProps) {
  return (
    <>
      <div>{isSaving ? "Saving..." : ""}</div>
      <div>{saveError && "Failed"}</div>
      <div>{isSuccess && "Saved"}</div>
    </>
  );
}
