import assert from "node:assert/strict";
import test from "node:test";
import { lintWithApplyRule, warningIds } from "./lint-harness";

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

const OPTIMISTIC = "INTERACTION-OPTIMISTIC-001";

function lintIds(code: string): string[] {
  return warningIds(lintWithApplyRule(code));
}

serialTest("reports an optimistic count that is never rolled back", () => {
  const code = `
    import React from "react";

    function LikeButton({ postId }) {
      const [likes, setLikes] = React.useState(0);

      const handleLike = async () => {
        setLikes(likes + 1);
        try {
          await like(postId);
          toast.success("Liked");
        } catch {
          toast.error("Could not like");
        }
      };

      return <button onClick={handleLike}>{likes} likes</button>;
    }
  `;

  assert.ok(lintIds(code).includes(OPTIMISTIC));
});

serialTest("accepts an optimistic update restored on the error path", () => {
  const code = `
    import React from "react";

    function LikeButton({ postId }) {
      const [likes, setLikes] = React.useState(0);

      const handleLike = async () => {
        setLikes(likes + 1);
        try {
          await like(postId);
          toast.success("Liked");
        } catch {
          setLikes(likes);
          toast.error("Could not like");
        }
      };

      return <button onClick={handleLike}>{likes} likes</button>;
    }
  `;

  assert.ok(!lintIds(code).includes(OPTIMISTIC));
});

serialTest("accepts a functional updater reconciled in finally", () => {
  const code = `
    import React from "react";

    function Basket({ item }) {
      const [items, setItems] = React.useState([]);

      const handleAdd = async () => {
        setItems((prev) => [...prev, item]);
        try {
          await save(item);
          toast.success("Added");
        } catch {
          toast.error("Could not add");
        } finally {
          setItems(await fetchItems());
        }
      };

      return (
        <div>
          <p>{items.length} items</p>
          <button onClick={handleAdd}>Add</button>
        </div>
      );
    }
  `;

  assert.ok(!lintIds(code).includes(OPTIMISTIC));
});

// The rule must not fire on the far more common shapes that merely look
// similar: a pending flag, or a write that records an argument.
serialTest("a pending flag is not an optimistic update", () => {
  const code = `
    import React from "react";

    function SaveButton() {
      const [isSaving, setIsSaving] = React.useState(false);

      const handleSave = async () => {
        setIsSaving(true);
        try {
          await save();
          toast.success("Saved");
        } catch {
          toast.error("Failed");
        } finally {
          setIsSaving(false);
        }
      };

      return <button onClick={handleSave} disabled={isSaving}>Save</button>;
    }
  `;

  assert.deepEqual(lintIds(code), []);
});

serialTest("recording an argument is not an optimistic update", () => {
  const code = `
    import React from "react";

    function Search() {
      const [query, setQuery] = React.useState("");
      const [status, setStatus] = React.useState("idle");

      const handleSearch = async (value) => {
        setQuery(value);
        setStatus("searching");
        try {
          await search(value);
          setStatus("done");
        } catch {
          setStatus("failed");
        }
      };

      return (
        <div>
          <p>{query} — {status}</p>
          <button onClick={() => handleSearch("x")}>Search</button>
        </div>
      );
    }
  `;

  assert.ok(!lintIds(code).includes(OPTIMISTIC));
});

serialTest("an unrendered optimistic value is not reported", () => {
  const code = `
    import React from "react";

    function Tracker({ postId }) {
      const [count, setCount] = React.useState(0);
      const [status, setStatus] = React.useState("idle");

      const handleLike = async () => {
        setCount(count + 1);
        setStatus("saving");
        try {
          await like(postId);
          setStatus("saved");
        } catch {
          setStatus("failed");
        }
      };

      return (
        <div>
          <p>{status}</p>
          <button onClick={handleLike}>Like</button>
        </div>
      );
    }
  `;

  assert.ok(!lintIds(code).includes(OPTIMISTIC));
});
