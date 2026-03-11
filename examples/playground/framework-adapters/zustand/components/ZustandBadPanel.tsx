import { ZustandActionButtons } from "./ZustandActionButtons";
import { ZustandBadStatus } from "./ZustandBadStatus";
import { useBadProfileStore } from "../store/profileStore";

export function ZustandBadPanel() {
  return <ZustandBadActions />;
}

function ZustandBadActions() {
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
      <ZustandBadStatus saveError={saveError} isSuccess={isSuccess} />
    </div>
  );
}
