export type UpwardActionHandler = (actionLabel: string) => void;

export type UpwardFlowProps = {
  onAction: UpwardActionHandler;
};

export type UpwardGoodFlowProps = {
  onAction: UpwardActionHandler;
  totalActions: number;
  latestAction: string;
};

export type UpwardLeafProps = {
  onApprove: () => void;
  onReject: () => void;
};

export type UpwardGoodLeafProps = {
  onApprove: () => void;
  onReject: () => void;
  totalActions: number;
  latestAction: string;
};
