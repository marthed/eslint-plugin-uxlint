import { useDispatch, useSelector } from "react-redux";
import { ReduxActionButtons } from "./ReduxActionButtons";
import { saveProfile } from "../state/profileSlice";
import type { AppDispatch, RootState } from "../state/store";

export function ReduxGoodPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const isSaving = useSelector((state: RootState) => state.profile.isSaving);
  const saveError = useSelector((state: RootState) => state.profile.saveError);
  const saveSuccess = useSelector(
    (state: RootState) => state.profile.saveSuccess,
  );

  function handleSaveSuccess() {
    void dispatch(saveProfile("success"));
  }

  function handleSaveFailure() {
    void dispatch(saveProfile("failure"));
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <ReduxActionButtons
        disabled={isSaving}
        onSaveSuccess={handleSaveSuccess}
        onSaveFailure={handleSaveFailure}
      />

      <div>{saveError && "Failed"}</div>
      <div>{saveSuccess && "Saved"}</div>
    </div>
  );
}
