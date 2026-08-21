import assert from "node:assert/strict";
import test from "node:test";
import { lintWithApplyRule, warningIds } from "./lint-harness";

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

const PRESERVE = "INTERACTION-PRESERVE-001";

function lintIds(code: string): string[] {
  return warningIds(lintWithApplyRule(code));
}

serialTest("reports an error path that clears the typed value", () => {
  const code = `
    import React from "react";

    function CommentBox() {
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
          <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Comment" />
          <button onClick={handleSend} disabled={isSending}>Send</button>
        </div>
      );
    }
  `;

  assert.ok(lintIds(code).includes(PRESERVE));
});

serialTest("accepts an error path that keeps the value", () => {
  const code = `
    import React from "react";

    function CommentBox() {
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
          <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Comment" />
          <button onClick={handleSend} disabled={isSending}>Send</button>
        </div>
      );
    }
  `;

  assert.ok(!lintIds(code).includes(PRESERVE));
});

// Clearing state that is not bound to a control is not destroying user input.
serialTest("clearing non-input state is not reported", () => {
  const code = `
    import React from "react";

    function Panel() {
      const [results, setResults] = React.useState([]);
      const [isSaving, setIsSaving] = React.useState(false);

      const handleSave = async () => {
        setIsSaving(true);
        try {
          await save();
          toast.success("Saved");
        } catch {
          setResults([]);
          toast.error("Failed");
        } finally {
          setIsSaving(false);
        }
      };

      return (
        <div>
          <p>{results.length} results</p>
          <button onClick={handleSave} disabled={isSaving}>Save</button>
        </div>
      );
    }
  `;

  assert.ok(!lintIds(code).includes(PRESERVE));
});

serialTest("writing a real value on the error path is not clearing", () => {
  const code = `
    import React from "react";

    function CommentBox() {
      const [text, setText] = React.useState("");
      const [isSending, setIsSending] = React.useState(false);

      const handleSend = async () => {
        setIsSending(true);
        try {
          await send(text);
          toast.success("Sent");
        } catch {
          setText(text.trim());
          toast.error("Could not send");
        } finally {
          setIsSending(false);
        }
      };

      return (
        <div>
          <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Comment" />
          <button onClick={handleSend} disabled={isSending}>Send</button>
        </div>
      );
    }
  `;

  assert.ok(!lintIds(code).includes(PRESERVE));
});
