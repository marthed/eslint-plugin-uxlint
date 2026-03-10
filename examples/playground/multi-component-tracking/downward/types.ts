export type SaveTrigger = () => void | Promise<void>;

export type DownwardFlowProps = {
  onSaveSuccess: SaveTrigger;
  onSaveFailure: SaveTrigger;
  isSaving: boolean;
  didSave: boolean;
  didFail: boolean;
};
