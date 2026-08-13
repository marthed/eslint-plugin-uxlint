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

// Evidence that a form can actually submit something. A form with no
// submission mechanism has no failure path, so error-state rules do not
// apply to it. That exemption needs proof of absence: "unknown" covers spread
// props, which may hide a handler, and counts as evidence so the exemption
// stays narrow rather than silencing real forms.
export type NormalizedSubmissionEvidence = {
  node: any;
  kind: "submit-handler" | "form-action" | "submit-click-handler" | "unknown";
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
    | "error-state-read"
    | "unknown";
};

export type NormalizedForm = {
  id: string;
  filePath: string;
  node: any;

  framework: FrameworkKind;
  source: SourceKind;

  submitControls: NormalizedSubmitControl[];
  submissionEvidence: NormalizedSubmissionEvidence[];
  fields: NormalizedField[];
  errorIndicators: NormalizedErrorIndicator[];
};

export type NormalizedToggleControl = {
  node: any;
  formId?: string;
  // "unknown" when the bound value can't be statically classified (not a
  // simple local identifier, no local useState found, or a non-literal
  // initializer) — the rule stays silent rather than guessing.
  boundValueShape: "boolean" | "non-boolean" | "unknown";
};

export type NormalizedSplitButton = {
  node: any;
  componentName?: string;
  hasPrimaryAction: boolean;
  navigatesToRoute: boolean;
};
