import { ZustandActionButtons } from "./ZustandActionButtons";
import { useBadProfileStore } from "../store/profileStore";

export function ZustandBadPanel() {
  const saveProfile = useBadProfileStore((store) => store.saveProfile);
  const saveError = useBadProfileStore((store) => store.saveError);
  const isSuccess = useBadProfileStore((store) => store.isSuccess);

  function handleSaveSuccess() {
    void saveProfile("success");
  }

  function handleSaveFailure() {
    void saveProfile("failure");
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <ZustandActionButtons
        disabled={false}
        onSaveSuccess={handleSaveSuccess}
        onSaveFailure={handleSaveFailure}
      />

      <div>{saveError && "Failed"}</div>
      <div>{isSuccess && "Saved"}</div>
    </div>
  );
}
