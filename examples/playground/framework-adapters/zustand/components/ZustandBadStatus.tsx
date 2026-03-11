type ZustandBadStatusProps = {
  saveError: string;
  isSuccess: boolean;
};

export function ZustandBadStatus({
  saveError,
  isSuccess,
}: ZustandBadStatusProps) {
  return (
    <>
      <div>{saveError && "Failed"}</div>
      <div>{isSuccess && "Saved"}</div>
    </>
  );
}
