export type FrameworkKind = "html" | "react" | "vue" | "svelte" | "unknown";
export type SourceKind = "native" | "framework" | "design-system";

export type NormalizedSubmitControl = {
  node: any;
  kind: "native-submit" | "button-submit" | "submit-component" | "unknown";
};

export type NormalizedField = {
  node: any;
  name?: string;
  hasAriaInvalid: boolean;
  hasErrorProp: boolean;
};

export type NormalizedErrorIndicator = {
  node: any;
  kind:
    | "role-alert"
    | "aria-live"
    | "error-component"
    | "field-error-prop"
    | "error-summary"
    | "unknown";
};

export type NormalizedForm = {
  id: string;
  filePath: string;
  node: any;

  framework: FrameworkKind;
  source: SourceKind;

  submitControls: NormalizedSubmitControl[];
  fields: NormalizedField[];
  errorIndicators: NormalizedErrorIndicator[];
};