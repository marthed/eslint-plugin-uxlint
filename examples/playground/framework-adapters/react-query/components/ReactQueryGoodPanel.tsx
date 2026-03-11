import { useMutation } from "@tanstack/react-query";
import { MutationButtons } from "./MutationButtons";
import { saveProfile } from "../services/saveProfile";

export function ReactQueryGoodPanel() {
  const saveMutation = useMutation({
    mutationFn: saveProfile,
    retry: false,
  });

  function handleSaveSuccess() {
    saveMutation.mutate("success");
  }

  function handleSaveFailure() {
    saveMutation.mutate("failure");
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <MutationButtons
        disabled={saveMutation.isPending}
        onSaveSuccess={handleSaveSuccess}
        onSaveFailure={handleSaveFailure}
      />

      <div>{saveMutation.isPending ? "Saving..." : ""}</div>
      <div>{saveMutation.isError && "Failed"}</div>
      <div>{saveMutation.isSuccess && "Saved"}</div>
    </div>
  );
}
