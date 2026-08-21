// expect: INTERACTION-PRESERVE-001
// The comment is thrown away when sending fails, so the user retypes it to
// try again. Every other phase is covered so only this is under test.
import React from "react";

export function Bad() {
  const [text, setText] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);

  const handleSend = async () => {
    setIsSending(true);
    try {
      await send(text);
      toast.success("Sent");
    } catch {
      setText("");
      toast.error("Could not send");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Comment"
      />
      <button onClick={handleSend} disabled={isSending}>
        Send
      </button>
    </div>
  );
}

export function Good() {
  const [text, setText] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);

  const handleSend = async () => {
    setIsSending(true);
    try {
      await send(text);
      setText("");
      toast.success("Sent");
    } catch {
      toast.error("Could not send");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Comment"
      />
      <button onClick={handleSend} disabled={isSending}>
        Send
      </button>
    </div>
  );
}
