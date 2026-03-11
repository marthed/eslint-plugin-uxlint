type ReduxBadStatusProps = {
  saveSuccess: boolean;
};

export function ReduxBadStatus({ saveSuccess }: ReduxBadStatusProps) {
  return <div>{saveSuccess && "Saved"}</div>;
}
