import React, { useState } from "react";
import type { ReactNode } from "react";

export function PlaygroundPage() {
  return (
    <div
      style={{
        fontFamily: "sans-serif",
        padding: 24,
        maxWidth: 1000,
        margin: "0 auto",
      }}
    >
      <h1 style={{ marginTop: 0 }}>UXLint Playground</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Bad case on the left, good case on the right.
      </p>

      <CaseRow
        title="Sync interaction without visible feedback (INTERACTION-SYNC-001)"
        bad={<SyncNoVisibleFeedback />}
        good={<SyncVisibleFeedback />}
      />

      <CaseRow
        title="Async warning: missing start (INTERACTION-ASYNC-START-001)"
        bad={<AsyncMissingStart />}
        good={<AsyncAllPhasesVisible />}
      />

      <CaseRow
        title="Async warning: missing settled (INTERACTION-ASYNC-SETTLED-001)"
        bad={<AsyncMissingSettled />}
        good={<AsyncAllPhasesVisible />}
      />

      <CaseRow
        title="Async warning: missing error (INTERACTION-ASYNC-ERROR-001)"
        bad={<AsyncMissingError />}
        good={<AsyncErrorVisible />}
      />

      <CaseRow
        title="Async warning: missing success (INTERACTION-ASYNC-SUCCESS-001)"
        bad={<AsyncMissingSuccess />}
        good={<AsyncAllPhasesVisible />}
      />

      <CaseRow
        title="Stage 3: child prop loading visibility"
        bad={<AsyncChildLoadingNotVisible />}
        good={<AsyncChildLoadingVisible />}
      />

      <CaseRow
        title="Stage 4: React Query adapter (INTERACTION-ASYNC-SUCCESS-001)"
        bad={<ReactQueryMissingSuccess />}
        good={<ReactQueryAllPhasesVisible />}
      />

      <CaseRow
        title="Stage 4: Redux adapter (INTERACTION-ASYNC-ERROR-001)"
        bad={<ReduxMissingErrorFeedback />}
        good={<ReduxAllPhasesVisible />}
      />

      <CaseRow
        title="Stage 4: Zustand adapter (INTERACTION-ASYNC-START-001 / INTERACTION-ASYNC-SETTLED-001)"
        bad={<ZustandMissingPendingFeedback />}
        good={<ZustandAllPhasesVisible />}
      />

      <CaseRow
        title="Placeholder-only label (FORM-001)"
        bad={<input placeholder="Email" />}
        good={
          <>
            <label htmlFor="good-email">Email</label>
            <input
              id="good-email"
              name="email"
              type="email"
              autoComplete="email"
            />
          </>
        }
      />

      <CaseRow
        title="Button type (BTN-001)"
        bad={<button>Save</button>}
        good={<button type="button">Save</button>}
      />

      <CaseRow
        title="Image alt text (IMG-001)"
        bad={<img src="/placeholder.svg" />}
        good={<img src="/placeholder.svg" alt="Placeholder logo" />}
      />

      <CaseRow
        title="Icon button label (ICON-001)"
        bad={<IconButton />}
        good={<IconButton aria-label="Open menu" />}
      />
    </div>
  );
}

function CaseRow({
  title,
  bad,
  good,
}: {
  title: string;
  bad: ReactNode;
  good: ReactNode;
}) {
  return (
    <section
      style={{
        marginBottom: 16,
        padding: 16,
        border: "1px solid #ddd",
        borderRadius: 8,
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 12 }}>{title}</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <CaseColumn title="Bad">{bad}</CaseColumn>
        <CaseColumn title="Good">{good}</CaseColumn>
      </div>
    </section>
  );
}

function CaseColumn({
  title,
  children,
}: {
  title: "Bad" | "Good";
  children: ReactNode;
}) {
  const isBad = title === "Bad";

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        border: `1px solid ${isBad ? "#f2c4c4" : "#cde8cf"}`,
        background: isBad ? "#fff8f8" : "#f6fff6",
        display: "grid",
        gap: 8,
      }}
    >
      <h3 style={{ margin: 0 }}>{title}</h3>
      {children}
    </div>
  );
}

function IconButton(props: any) {
  return (
    <button type="button" {...props}>
      ☆
    </button>
  );
}

function SyncNoVisibleFeedback() {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <button
      type="button"
      onClick={() => toggleOpenState(setIsOpen, isOpen)}
      style={{ justifySelf: "start" }}
    >
      Toggle
    </button>
  );
}

function SyncVisibleFeedback() {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div>
      <button type="button" onClick={() => toggleOpenState(setIsOpen, isOpen)}>
        Toggle
      </button>
      <div>{isOpen ? "Open" : "Closed"}</div>
    </div>
  );
}

function toggleOpenState(setOpen: (value: boolean) => void, isOpen: boolean) {
  setOpen(!isOpen);
}

function AsyncAllPhasesVisible() {
  const [isSaving, setIsSaving] = React.useState(false);
  const [didSave, setDidSave] = React.useState(false);
  const [didFail, setDidFail] = React.useState(false);

  async function handleSave() {
    setIsSaving(true);
    setDidSave(false);
    setDidFail(false);
    try {
      await fakeSave(false, 2000);
      setDidSave(true);
    } catch {
      setDidFail(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={handleSave} disabled={isSaving}>
        Save
      </button>
      {isSaving ? (
        <div>Loading...</div>
      ) : (
        <>
          <div>{didSave && "Saved"}</div>
          <div>{didFail && "Failed"}</div>
        </>
      )}
    </div>
  );
}

function AsyncMissingStart() {
  const [isSaving, setIsSaving] = React.useState(false);
  const [didSave, setDidSave] = React.useState(false);
  const [didFail, setDidFail] = React.useState(false);

  async function handleSave() {
    try {
      await fakeSave(false, 2000);
      setDidSave(true);
    } catch {
      setDidFail(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={handleSave} disabled={isSaving}>
        Save
      </button>
      {isSaving ? (
        <div>Loading...</div>
      ) : (
        <>
          <div>{didSave && "Saved"}</div>
          <div>{didFail && "Failed"}</div>
        </>
      )}
    </div>
  );
}

function AsyncMissingSettled() {
  const [isSaving, setIsSaving] = React.useState(false);
  const [didSave, setDidSave] = React.useState(false);
  const [didFail, setDidFail] = React.useState(false);

  async function handleSave() {
    setIsSaving(true);
    setDidSave(false);
    setDidFail(false);
    try {
      await fakeSave();
      setDidSave(true);
    } catch {
      setDidFail(true);
    }
  }

  return (
    <div>
      <button type="button" onClick={handleSave} disabled={isSaving}>
        Save
      </button>
      {isSaving ? (
        <div>Loading...</div>
      ) : (
        <>
          <div>{didSave && "Saved"}</div>
          <div>{didFail && "Failed"}</div>
        </>
      )}
    </div>
  );
}

function AsyncMissingError() {
  const [isSaving, setIsSaving] = React.useState(false);
  const [didSave, setDidSave] = React.useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      await fakeSave(true);
      setDidSave(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={handleSave} disabled={isSaving}>
        Save
      </button>
      {isSaving ? (
        <div>Loading...</div>
      ) : (
        <>
          <div>{didSave && "Saved"}</div>
        </>
      )}
    </div>
  );
}

function AsyncErrorVisible() {
  const [isSaving, setIsSaving] = React.useState(false);
  const [didFail, setDidFail] = React.useState(false);
  const [didSave, setDidSave] = React.useState(false);

  async function handleSave() {
    setIsSaving(true);
    setDidFail(false);
    try {
      await fakeSave(true);
      setDidSave(true);
    } catch {
      setDidFail(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={handleSave} disabled={isSaving}>
        Save
      </button>
      {isSaving ? (
        <div>Loading...</div>
      ) : (
        <>
          <div>{didSave && "Saved"}</div>
          <div>{didFail && "Failed"}</div>
        </>
      )}
    </div>
  );
}

function AsyncMissingSuccess() {
  const [isSaving, setIsSaving] = React.useState(false);
  const [didFail, setDidFail] = React.useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      await fakeSave();
    } catch {
      setDidFail(true);
    }
    setIsSaving(false);
  }

  return (
    <div>
      <button type="button" onClick={handleSave} disabled={isSaving}>
        Save
      </button>
      {isSaving ? (
        <div>Loading...</div>
      ) : (
        <>
          <div>{didFail && "Failed"}</div>
        </>
      )}
    </div>
  );
}

function AsyncChildLoadingNotVisible() {
  const [isSaving, setIsSaving] = React.useState(false);
  const [didSave, setDidSave] = React.useState(false);
  const [didFail, setDidFail] = React.useState(false);

  async function handleSave() {
    setIsSaving(true);
    setDidSave(false);
    setDidFail(false);
    try {
      await fakeSave();
      setDidSave(true);
    } catch {
      setDidFail(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={handleSave}>
        Save
      </button>
      <SaveFeedbackBadgeBad loading={isSaving} />
      <div>{didSave && "Saved"}</div>
      <div>{didFail && "Failed"}</div>
    </div>
  );
}

function SaveFeedbackBadgeBad({ loading: _loading }: { loading: boolean }) {
  return <div>Idle</div>;
}

function AsyncChildLoadingVisible() {
  const [isSaving, setIsSaving] = React.useState(false);
  const [didSave, setDidSave] = React.useState(false);
  const [didFail, setDidFail] = React.useState(false);

  async function handleSave() {
    setIsSaving(true);
    setDidSave(false);
    setDidFail(false);
    try {
      await fakeSave();
      setDidSave(true);
    } catch {
      setDidFail(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={handleSave}>
        Save
      </button>
      <SaveFeedbackBadgeGood loading={isSaving} />
      <div>{didSave && "Saved"}</div>
      <div>{didFail && "Failed"}</div>
    </div>
  );
}

function SaveFeedbackBadgeGood({ loading }: { loading: boolean }) {
  return <div>{loading ? "Saving..." : ""}</div>;
}

type MutationStatus = "idle" | "pending" | "success" | "error";

function useMutation({ mutationFn }: { mutationFn: () => Promise<unknown> }) {
  const [status, setStatus] = React.useState<MutationStatus>("idle");

  function mutate() {
    setStatus("pending");
    void mutationFn()
      .then(() => {
        setStatus("success");
      })
      .catch(() => {
        setStatus("error");
      });
  }

  async function mutateAsync() {
    mutate();
  }

  return {
    mutate,
    mutateAsync,
    isPending: status === "pending",
    isError: status === "error",
    isSuccess: status === "success",
    status,
    error: status === "error" ? new Error("Request failed") : null,
  };
}

type ReduxState = {
  profile: {
    isSaving: boolean;
    saveError: string;
    saveSuccess: boolean;
  };
};

const MOCK_REDUX_STATE: ReduxState = {
  profile: {
    isSaving: false,
    saveError: "",
    saveSuccess: true,
  },
};

function useDispatch() {
  return (_action: unknown) => undefined;
}

function useSelector<T>(selector: (state: ReduxState) => T): T {
  return selector(MOCK_REDUX_STATE);
}

type AppStore = {
  saveProfile: () => void;
  isSaving: boolean;
  saveError: string;
  isSuccess: boolean;
};

const MOCK_APP_STORE: AppStore = {
  saveProfile: () => undefined,
  isSaving: false,
  saveError: "",
  isSuccess: true,
};

function useAppStore<T>(selector: (store: AppStore) => T): T {
  return selector(MOCK_APP_STORE);
}

function saveProfile() {
  return { type: "profile/save" };
}

function ReactQueryAllPhasesVisible() {
  const { mutate, isPending, isError, isSuccess } = useMutation({
    mutationFn: fakeSave,
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

function ReactQueryMissingSuccess() {
  const saveMutation = useMutation({ mutationFn: fakeSave });

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

function ReduxAllPhasesVisible() {
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

function ReduxMissingErrorFeedback() {
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

function ZustandAllPhasesVisible() {
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

function ZustandMissingPendingFeedback() {
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

async function fakeSave(shouldFail = false, timeoutMs = 500) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldFail) {
        reject(new Error("Save failed"));
        return;
      }
      resolve(true);
    }, timeoutMs);
  });
}

const ParentComp = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<string>("");

  return (
    <ChildComp
      loading={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await fakeSave();
          setData("Success!");
        } catch (e) {
          setError("Failed to Save");
        }
        setLoading(false);
      }}
      text={error || data}
    />
  );
};

const ChildComp = ({
  loading,
  onClick,
  text = "",
}: {
  loading: boolean;
  onClick: () => {};
  text: string;
}) => {
  return (
    <div>
      <button type="button" onClick={onClick}>
        Save
      </button>
      <div>{loading && "Loading..."}</div>
      <div>{!loading && text}</div>
    </div>
  );
};
