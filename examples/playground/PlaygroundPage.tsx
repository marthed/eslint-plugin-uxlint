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
  return <div>{loading ? "Saving..." : "Idle"}</div>;
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
