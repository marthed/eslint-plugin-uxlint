import React from "react";
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
        title="Async warnings: missing error + settled"
        bad={<AsyncMissingError />}
        good={<AsyncErrorVisible />}
      />

      <CaseRow
        title="Async warnings: missing success + settled"
        bad={<AsyncMissingSuccess />}
        good={<AsyncAllPhasesVisible />}
      />

      <CaseRow
        title="Async warnings: no visible feedback (all async phase warnings)"
        bad={<AsyncNoVisibleFeedback />}
        good={<AsyncAllPhasesVisible />}
      />

      <CaseRow
        title="Placeholder-only label"
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
        title="Button type"
        bad={<button>Save</button>}
        good={<button type="button">Save</button>}
      />

      <CaseRow
        title="Image alt text"
        bad={<img src="/placeholder.svg" />}
        good={<img src="/placeholder.svg" alt="Placeholder logo" />}
      />

      <CaseRow
        title="Native form error state"
        bad={
          <form style={{ display: "grid", gap: 8 }}>
            <input name="email" type="email" placeholder="Email" />
            <button type="submit">Submit</button>
          </form>
        }
        good={
          <form style={{ display: "grid", gap: 8 }}>
            <label htmlFor="native-email">Email</label>
            <input
              id="native-email"
              name="email"
              type="email"
              aria-invalid="true"
              aria-describedby="native-email-error"
            />
            <div id="native-email-error" role="alert">
              Please enter a valid email address.
            </div>
            <button type="submit">Submit</button>
          </form>
        }
      />

      <CaseRow
        title="Design-system form error state"
        bad={
          <Form style={{ display: "grid", gap: 8 }}>
            <TextField name="email" />
            <SubmitButton />
          </Form>
        }
        good={
          <Form style={{ display: "grid", gap: 8 }}>
            <TextField name="email" error="Email is required" />
            <SubmitButton type="submit" />
          </Form>
        }
      />

      <CaseRow
        title="Icon button label"
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

function Form(props: any) {
  return <div {...props} />;
}

function TextField(props: any) {
  return <input {...props} />;
}

function SubmitButton(props: any) {
  return (
    <button type="submit" {...props}>
      Submit
    </button>
  );
}

function IconButton(props: any) {
  return (
    <button type="button" {...props}>
      ☆
    </button>
  );
}

function AsyncNoVisibleFeedback() {
  const [isSaving, setIsSaving] = React.useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      await fakeSave();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <button type="button" onClick={handleSave}>
      Save
    </button>
  );
}

function SyncNoVisibleFeedback() {
  const [isOpen, setIsOpen] = React.useState(false);

  function handleToggle() {
    setIsOpen(!isOpen);
  }

  return (
    <button type="button" onClick={handleToggle}>
      Toggle
    </button>
  );
}

function SyncVisibleFeedback() {
  const [isOpen, setIsOpen] = React.useState(false);

  function handleToggle() {
    setIsOpen(!isOpen);
  }

  return (
    <div>
      <button type="button" onClick={handleToggle}>
        Toggle
      </button>
      <div>{isOpen ? "Open" : "Closed"}</div>
    </div>
  );
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
      <button type="button" onClick={handleSave} disabled={isSaving}>
        Save
      </button>
      <div>{didSave && "Saved"}</div>
      <div>{didFail && "Failed"}</div>
    </div>
  );
}

function AsyncMissingStart() {
  const [isSaving, setIsSaving] = React.useState(false);
  const [didSave, setDidSave] = React.useState(false);

  async function handleSave() {
    try {
      await fakeSave();
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
      <div>{didSave && "Saved"}</div>
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
      <div>{didSave && "Saved"}</div>
      <div>{didFail && "Failed"}</div>
    </div>
  );
}

function AsyncMissingError() {
  const [isSaving, setIsSaving] = React.useState(false);
  const [didSave, setDidSave] = React.useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      await fakeSave();
      setDidSave(true);
      throw new Error("Save failed");
    } catch {
      // Intentionally no visible error feedback in this example.
    }
  }

  return (
    <div>
      <button type="button" onClick={handleSave} disabled={isSaving}>
        Save
      </button>
      <div>{didSave && "Saved"}</div>
    </div>
  );
}

function AsyncErrorVisible() {
  const [isSaving, setIsSaving] = React.useState(false);
  const [didFail, setDidFail] = React.useState(false);

  async function handleSave() {
    setIsSaving(true);
    setDidFail(false);
    try {
      await fakeSave();
      throw new Error("Save failed");
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
      <div>{didFail && "Failed"}</div>
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
  }

  return (
    <div>
      <button type="button" onClick={handleSave} disabled={isSaving}>
        Save
      </button>
      <div>{didFail && "Failed"}</div>
    </div>
  );
}

async function fakeSave() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, 500);
  });
}
