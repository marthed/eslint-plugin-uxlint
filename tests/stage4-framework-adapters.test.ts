import assert from "node:assert/strict";
import test from "node:test";
import { lintWithApplyRule, warningIds } from "./lint-harness";

const IDS = {
  asyncStart: "INTERACTION-ASYNC-START-001",
  asyncSettled: "INTERACTION-ASYNC-SETTLED-001",
  asyncError: "INTERACTION-ASYNC-ERROR-001",
  asyncSuccess: "INTERACTION-ASYNC-SUCCESS-001",
} as const;

function lintIds(code: string): string[] {
  return warningIds(lintWithApplyRule(code));
}

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

serialTest(
  "React Query: supports destructured mutation status lifecycle",
  () => {
    const code = `
    function ReactQueryGood() {
      const { mutate, isPending, isError, isSuccess } = useMutation({
        mutationFn: saveData,
      });

      function handleSave() {
        mutate();
      }

      return (
        <div>
          <button type="button" onClick={handleSave} disabled={isPending}>
            Save
          </button>
          <div>{isError && "Failed"}</div>
          <div>{isSuccess && "Saved"}</div>
        </div>
      );
    }

    async function saveData() {
      return true;
    }
  `;

    assert.deepEqual(lintIds(code), []);
  },
);

serialTest(
  "React Query: object mutation status is tracked and missing success is reported",
  () => {
    const code = `
      function ReactQueryMissingSuccess() {
        const saveMutation = useMutation({ mutationFn: saveData });

        function handleSave() {
          saveMutation.mutate();
        }

        return (
          <div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              Save
            </button>
            <div>{saveMutation.isError && "Failed"}</div>
          </div>
        );
      }

      async function saveData() {
        return true;
      }
    `;

    assert.deepEqual(lintIds(code), [IDS.asyncSuccess]);
  },
);

serialTest(
  "Redux: dispatch + selector status fields satisfy async lifecycle",
  () => {
    const code = `
    function ReduxGood() {
      const dispatch = useDispatch();
      const isSaving = useSelector((state) => state.profile.isSaving);
      const saveError = useSelector((state) => state.profile.saveError);
      const saveSuccess = useSelector((state) => state.profile.saveSuccess);

      function handleSave() {
        dispatch(saveProfile());
      }

      return (
        <div>
          <button type="button" onClick={handleSave} disabled={isSaving}>
            Save
          </button>
          <div>{saveError && "Failed"}</div>
          <div>{saveSuccess && "Saved"}</div>
        </div>
      );
    }
  `;

    assert.deepEqual(lintIds(code), []);
  },
);

serialTest("Redux: missing error feedback is reported", () => {
  const code = `
    function ReduxMissingError() {
      const dispatch = useDispatch();
      const isSaving = useSelector((state) => state.profile.isSaving);
      const saveSuccess = useSelector((state) => state.profile.saveSuccess);

      function handleSave() {
        dispatch(saveProfile());
      }

      return (
        <div>
          <button type="button" onClick={handleSave} disabled={isSaving}>
            Save
          </button>
          <div>{saveSuccess && "Saved"}</div>
        </div>
      );
    }
  `;

  assert.deepEqual(lintIds(code), [IDS.asyncError]);
});

serialTest(
  "Zustand: store action + status selectors satisfy async lifecycle",
  () => {
    const code = `
    function ZustandGood() {
      const saveProfile = useAppStore((store) => store.saveProfile);
      const isSaving = useAppStore((store) => store.isSaving);
      const saveError = useAppStore((store) => store.saveError);
      const isSuccess = useAppStore((store) => store.isSuccess);

      function handleSave() {
        saveProfile();
      }

      return (
        <div>
          <button type="button" onClick={handleSave} disabled={isSaving}>
            Save
          </button>
          <div>{saveError && "Failed"}</div>
          <div>{isSuccess && "Saved"}</div>
        </div>
      );
    }
  `;

    assert.deepEqual(lintIds(code), []);
  },
);

serialTest("Zustand: missing pending feedback reports a start warning", () => {
  const code = `
      function ZustandMissingPending() {
        const saveProfile = useAppStore((store) => store.saveProfile);
        const saveError = useAppStore((store) => store.saveError);
        const isSuccess = useAppStore((store) => store.isSuccess);

        function handleSave() {
          saveProfile();
        }

        return (
          <div>
            <button type="button" onClick={handleSave}>
              Save
            </button>
            <div>{saveError && "Failed"}</div>
            <div>{isSuccess && "Saved"}</div>
          </div>
        );
      }
    `;

  assert.deepEqual(lintIds(code), [IDS.asyncStart]);
});

// tRPC and other generated clients expose useMutation through a member path
// (trpc.admin.document.delete.useMutation()), not as a bare identifier.
serialTest(
  "tRPC: a member-path useMutation still provides a status model",
  () => {
    const code = `
      import { trpc } from "@documenso/trpc/react";

      function DeleteDialog({ id }) {
        const { mutateAsync: deleteDocument, isPending } =
          trpc.admin.document.delete.useMutation();

        const handleDelete = async () => {
          try {
            await deleteDocument({ id });
            toast({ title: "Deleted" });
          } catch {
            toast({ title: "Failed", variant: "destructive" });
          }
        };

        return <Button loading={isPending} onClick={handleDelete}>Delete</Button>;
      }
    `;

    assert.deepEqual(lintIds(code), []);
  },
);

// Feedback commonly lives in the mutation's lifecycle options rather than in
// the handler that calls mutateAsync.
serialTest(
  "React Query: onSuccess and onError callbacks count as phase feedback",
  () => {
    const code = `
      function ClaimDeleteDialog({ id }) {
        const { mutateAsync: deleteClaim, isPending } = trpc.admin.claims.delete.useMutation({
          onSuccess: () => {
            toast({ title: "Deleted successfully" });
          },
          onError: () => {
            toast({ title: "Failed to delete", variant: "destructive" });
          },
        });

        return (
          <Button loading={isPending} onClick={async () => deleteClaim({ id })}>
            Delete
          </Button>
        );
      }
    `;

    assert.deepEqual(lintIds(code), []);
  },
);

serialTest("React Query: an onError that only logs is not feedback", () => {
  const code = `
      function SilentDialog({ id }) {
        const { mutateAsync: deleteClaim, isPending } = trpc.admin.claims.delete.useMutation({
          onSuccess: () => {
            toast({ title: "Deleted successfully" });
          },
          onError: (err) => {
            console.error(err);
          },
        });

        return (
          <Button loading={isPending} onClick={async () => deleteClaim({ id })}>
            Delete
          </Button>
        );
      }
    `;

  assert.deepEqual(lintIds(code), [IDS.asyncError]);
});
