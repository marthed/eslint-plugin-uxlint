import { useMutation } from "@tanstack/react-query";
import { MutationButtons } from "./MutationButtons";
import { ReactQueryBadStatus } from "./ReactQueryBadStatus";
import { saveProfile } from "../services/saveProfile";

export function ReactQueryBadPanel() {
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
    <ReactQueryBadActions
      isPending={saveMutation.isPending}
      isError={saveMutation.isError}
      onSaveSuccess={handleSaveSuccess}
      onSaveFailure={handleSaveFailure}
    />
  );
}

type ReactQueryBadActionsProps = {
  isPending: boolean;
  isError: boolean;
  onSaveSuccess: () => void;
  onSaveFailure: () => void;
};

function ReactQueryBadActions({
  isPending,
  isError,
  onSaveSuccess,
  onSaveFailure,
}: ReactQueryBadActionsProps) {
  function handleSaveSuccess() {
    onSaveSuccess();
  }

  function handleSaveFailure() {
    onSaveFailure();
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <MutationButtons
        disabled={isPending}
        onSaveSuccess={handleSaveSuccess}
        onSaveFailure={handleSaveFailure}
      />
      <ReactQueryBadStatus isPending={isPending} isError={isError} />
    </div>
  );
}
