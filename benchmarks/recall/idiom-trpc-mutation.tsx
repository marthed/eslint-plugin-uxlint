// expect: INTERACTION-ASYNC-START-001
// Regression shape: a tRPC-style member-path useMutation. The status model was
// once matched only on a bare `useMutation()` callee, so every generated
// client looked like an interaction with no status model at all.
export function Bad() {
  const { mutateAsync: remove, isPending } = trpc.admin.item.remove.useMutation(
    {
      onSuccess: () => {
        toast.success("Removed");
      },
      onError: () => {
        toast.error("Failed");
      },
    },
  );

  return <button onClick={async () => remove({ id: 1 })}>Remove</button>;
}

export function Good() {
  const { mutateAsync: remove, isPending } = trpc.admin.item.remove.useMutation(
    {
      onSuccess: () => {
        toast.success("Removed");
      },
      onError: () => {
        toast.error("Failed");
      },
    },
  );

  return (
    <button disabled={isPending} onClick={async () => remove({ id: 1 })}>
      Remove
    </button>
  );
}
