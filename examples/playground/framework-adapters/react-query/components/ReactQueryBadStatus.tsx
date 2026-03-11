type ReactQueryBadStatusProps = {
  isPending: boolean;
  isError: boolean;
};

export function ReactQueryBadStatus({
  isPending,
  isError,
}: ReactQueryBadStatusProps) {
  return (
    <>
      <div>{isPending ? "Saving..." : ""}</div>
      <div>{isError && "Failed"}</div>
    </>
  );
}
