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

serialTest(
  "Zustand: missing pending feedback reports start and settled warnings",
  () => {
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

    assert.deepEqual(lintIds(code), [IDS.asyncStart, IDS.asyncSettled]);
  },
);
