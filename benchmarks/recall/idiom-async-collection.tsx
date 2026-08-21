// expect: DATA-EMPTY-001, DATA-ERROR-001, DATA-LOADING-001
// A list rendered straight from a query with no other branch: a failed fetch,
// a slow fetch, and a genuinely empty result all render as nothing.
export function Bad() {
  const { data } = useQuery({ queryKey: ["posts"] });

  return (
    <ul>
      {data.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}

export function Good() {
  const { data, isLoading, error } = useQuery({ queryKey: ["posts"] });

  if (isLoading) return <Spinner />;
  if (error) return <p role="alert">Could not load posts.</p>;
  if (data.length === 0) return <p>No posts yet. Write your first one.</p>;

  return (
    <ul>
      {data.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
