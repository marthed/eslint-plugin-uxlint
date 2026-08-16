// expect: INTERACTION-ASYNC-ERROR-001, INTERACTION-ASYNC-START-001
// Regression shape: every state write lives inside a promise-chain callback.
// Chain callbacks are nested functions that the state-write walk skips, so a
// handler like this once looked like it wrote no state at all -- and the
// interaction rules skip those entirely, turning the bug into silence.
import React from "react";

export function Bad() {
  const [status, setStatus] = React.useState("idle");
  const handlePublish = async () => {
    const payload = await buildPayload();
    fetch("/publish", { method: "post", body: payload }).then(() => {
      setStatus("published");
    });
  };
  return (
    <div>
      <p>{status}</p>
      <button onClick={handlePublish}>Publish</button>
    </div>
  );
}

export function Good() {
  const [status, setStatus] = React.useState("idle");
  const handlePublish = async () => {
    setStatus("publishing");
    const payload = await buildPayload();
    fetch("/publish", { method: "post", body: payload })
      .then(() => {
        setStatus("published");
      })
      .catch(() => {
        setStatus("failed");
      })
      .finally(() => {
        setStatus("idle");
      });
  };
  return (
    <div>
      <p>{status}</p>
      <button onClick={handlePublish}>Publish</button>
    </div>
  );
}
