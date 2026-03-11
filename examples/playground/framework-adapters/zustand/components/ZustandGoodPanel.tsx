import { ZustandActionButtons } from "./ZustandActionButtons";
import { useGoodProfileStore } from "../store/profileStore";

export function ZustandGoodPanel() {
  const saveProfile = useGoodProfileStore((store) => store.saveProfile);
  const isSaving = useGoodProfileStore((store) => store.isSaving);
  const saveError = useGoodProfileStore((store) => store.saveError);
  const isSuccess = useGoodProfileStore((store) => store.isSuccess);

  function handleSaveSuccess() {
    void saveProfile("success");
  }

  function handleSaveFailure() {
    void saveProfile("failure");
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <ZustandActionButtons
        disabled={isSaving}
        onSaveSuccess={handleSaveSuccess}
        onSaveFailure={handleSaveFailure}
      />

      <div>{isSaving ? "Saving..." : ""}</div>
      <div>{saveError && "Failed"}</div>
      <div>{isSuccess && "Saved"}</div>
    </div>
  );
}
