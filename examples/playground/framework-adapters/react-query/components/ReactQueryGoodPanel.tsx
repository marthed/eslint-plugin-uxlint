import { useMutation } from "@tanstack/react-query";
import { MutationButtons } from "./MutationButtons";
import { ReactQueryGoodStatus } from "./ReactQueryGoodStatus";
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
    <ReactQueryGoodActions
      isPending={saveMutation.isPending}
      isError={saveMutation.isError}
      isSuccess={saveMutation.isSuccess}
      onSaveSuccess={handleSaveSuccess}
      onSaveFailure={handleSaveFailure}
    />
  );
}

type ReactQueryGoodActionsProps = {
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  onSaveSuccess: () => void;
  onSaveFailure: () => void;
};

function ReactQueryGoodActions({
  isPending,
  isError,
  isSuccess,
  onSaveSuccess,
  onSaveFailure,
}: ReactQueryGoodActionsProps) {
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
      <ReactQueryGoodStatus
        isPending={isPending}
        isError={isError}
        isSuccess={isSuccess}
      />
    </div>
  );
}
