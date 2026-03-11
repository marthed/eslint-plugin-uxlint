type ReactQueryGoodStatusProps = {
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
};

export function ReactQueryGoodStatus({
  isPending,
  isError,
  isSuccess,
}: ReactQueryGoodStatusProps) {
  return (
    <>
      <div>{isPending ? "Saving..." : ""}</div>
      <div>{isError && "Failed"}</div>
      <div>{isSuccess && "Saved"}</div>
    </>
  );
}
