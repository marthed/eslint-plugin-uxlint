export type FrameworkKind = "html" | "react" | "vue" | "svelte" | "unknown";
export type SourceKind = "native" | "framework" | "design-system";

export type NormalizedSubmitControl = {
  node: any;
  kind: "native-submit" | "button-submit" | "submit-component" | "unknown";
};

export type NormalizedInputControl = {
  node: any;
  kind:
    | "text-input"
    | "textarea"
    | "checkbox"
    | "radio"
    | "select"
    | "design-system-field"
    | "design-system-select";
  componentName?: string;
  inputType?: string;
  formId?: string;
  containerKey?: string;
  name?: string;
  id?: string;
  value?: string;
  placeholder?: string;
  labelProp?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  wrappingLabelText?: string;
  isWrappedByLabel: boolean;
  isDefaultSelected: boolean;
};

export type NormalizedLabel = {
  node: any;
  id?: string;
  htmlFor?: string;
  text: string;
  formId?: string;
};

export type NormalizedField = {
  node: any;
  name?: string;
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
