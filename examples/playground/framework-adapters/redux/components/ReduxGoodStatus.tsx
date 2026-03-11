type ReduxGoodStatusProps = {
  saveError: string;
  saveSuccess: boolean;
};

export function ReduxGoodStatus({
  saveError,
  saveSuccess,
}: ReduxGoodStatusProps) {
  return (
    <>
      <div>{saveError && "Failed"}</div>
      <div>{saveSuccess && "Saved"}</div>
    </>
  );
}
