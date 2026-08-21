// expect: INTERACTION-OPTIMISTIC-001
// The count is raised before the request and never put back if it fails, so a
// failed like still reads as a successful one. Every other phase is covered so
// that only the rollback question is under test.
import React from "react";

export function Bad({ postId }) {
  const [likes, setLikes] = React.useState(0);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleLike = async () => {
    setIsSaving(true);
    setLikes(likes + 1);
    try {
      await like(postId);
      toast.success("Liked");
    } catch {
      toast.error("Could not like");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <button onClick={handleLike} disabled={isSaving} aria-label="Like">
      {likes} likes
    </button>
  );
}

export function Good({ postId }) {
  const [likes, setLikes] = React.useState(0);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleLike = async () => {
    setIsSaving(true);
    setLikes(likes + 1);
    try {
      await like(postId);
      toast.success("Liked");
    } catch {
      setLikes(likes);
      toast.error("Could not like");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <button onClick={handleLike} disabled={isSaving} aria-label="Like">
      {likes} likes
    </button>
  );
}
