import assert from "node:assert/strict";
import test from "node:test";
import { lintWithApplyRule, warningIds } from "./lint-harness";

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

const LOADING = "DATA-LOADING-001";
const EMPTY = "DATA-EMPTY-001";
const ERROR = "DATA-ERROR-001";

function lintIds(code: string): string[] {
  return warningIds(lintWithApplyRule(code));
}

serialTest("reports all three branches when only the happy path exists", () => {
  const code = `
    function PostList() {
      const { data } = useQuery({ queryKey: ["posts"] });
      return <ul>{data.map((post) => <li key={post.id}>{post.title}</li>)}</ul>;
    }
  `;

  assert.deepEqual(lintIds(code).sort(), [EMPTY, ERROR, LOADING]);
});

serialTest("accepts a list that handles all three", () => {
  const code = `
    function PostList() {
      const { data, isLoading, error } = useQuery({ queryKey: ["posts"] });

      if (isLoading) return <Spinner />;
      if (error) return <p role="alert">Could not load posts.</p>;
      if (data.length === 0) return <p>No posts yet. Write your first one.</p>;

      return <ul>{data.map((post) => <li key={post.id}>{post.title}</li>)}</ul>;
    }
  `;

  assert.deepEqual(lintIds(code), []);
});

serialTest("reports only the branch that is missing", () => {
  const code = `
    function PostList() {
      const { data, isLoading, error } = useQuery({ queryKey: ["posts"] });

      if (isLoading) return <Spinner />;
      if (error) return <p role="alert">Could not load posts.</p>;

      return <ul>{data.map((post) => <li key={post.id}>{post.title}</li>)}</ul>;
    }
  `;

  assert.deepEqual(lintIds(code), [EMPTY]);
});

serialTest("recognizes a tRPC member-path query", () => {
  const code = `
    function PostList() {
      const { data, isPending, isError } = trpc.posts.list.useQuery();

      return (
        <div>
          {isPending && <Spinner />}
          {isError && <p role="alert">Failed.</p>}
          <ul>{data.map((post) => <li key={post.id}>{post.title}</li>)}</ul>
        </div>
      );
    }
  `;

  assert.deepEqual(lintIds(code), [EMPTY]);
});

serialTest("recognizes the object form of the hook result", () => {
  const code = `
    function PostList() {
      const query = useQuery({ queryKey: ["posts"] });

      return (
        <div>
          {query.isLoading && <Spinner />}
          {query.error && <p role="alert">Failed.</p>}
          {query.data.length === 0 && <p>Nothing here yet.</p>}
          <ul>{query.data.map((post) => <li key={post.id}>{post.title}</li>)}</ul>
        </div>
      );
    }
  `;

  assert.deepEqual(lintIds(code), []);
});

// Fail-safe: the branches belong wherever the collection is actually rendered.
serialTest("stays quiet when the data is handed to a child", () => {
  const code = `
    function PostsPage() {
      const { data } = useQuery({ queryKey: ["posts"] });
      return <PostList posts={data} />;
    }
  `;

  assert.deepEqual(lintIds(code), []);
});

serialTest("stays quiet for a list that is not from an async source", () => {
  const code = `
    function PostList({ posts }) {
      return <ul>{posts.map((post) => <li key={post.id}>{post.title}</li>)}</ul>;
    }
  `;

  assert.deepEqual(lintIds(code), []);
});
