export type DesignSystemComponentRole =
  | "button"
  | "text-input"
  | "textarea"
  | "select"
  | "switch"
  | "split-button";

export type DesignSystemComponentConfig = {
  role?: DesignSystemComponentRole;
  labelProps?: string[];
  loadingProps?: string[];
  disabledProps?: string[];
  checkedProps?: string[];
  primaryActionProps?: string[];
  menuProps?: string[];
};

type DesignSystemSlice = {
  fieldComponents?: string[];
  components?: Record<string, DesignSystemComponentConfig>;
  feedbackFunctions?: string[];
};

const DEFAULT_LABEL_PROPS = ["label", "labelText"];
const DEFAULT_LOADING_PROPS = ["loading", "isLoading"];
const DEFAULT_DISABLED_PROPS = ["disabled"];
const DEFAULT_CHECKED_PROPS = ["checked", "isChecked", "value", "on"];
const DEFAULT_PRIMARY_ACTION_PROPS = [
  "onClick",
  "onPress",
  "label",
  "primaryAction",
  "primaryLabel",
];
const DEFAULT_MENU_PROPS = ["items", "menuItems", "actions", "options"];

export const DEFAULT_FEEDBACK_FUNCTIONS = ["toast", "alert"];

export type FieldRole = "text-input" | "textarea" | "select";

export type ComponentVocabulary = {
  isDeclaredComponent(componentName: string | null | undefined): boolean;
  getFieldRole(componentName: string | null | undefined): FieldRole | undefined;
  getComponentRole(
    componentName: string | null | undefined,
  ): DesignSystemComponentRole | undefined;
  getLabelProps(componentName: string | null | undefined): string[];
  getLoadingProps(componentName: string | null | undefined): string[];
  getDisabledProps(componentName: string | null | undefined): string[];
  getCheckedProps(componentName: string | null | undefined): string[];
  getPrimaryActionProps(componentName: string | null | undefined): string[];
  getMenuProps(componentName: string | null | undefined): string[];
  getFeedbackFunctions(): string[];
};

export function createComponentVocabulary(
  designSystem: DesignSystemSlice | undefined,
): ComponentVocabulary {
  const components = designSystem?.components ?? {};
  const legacyFieldComponents = designSystem?.fieldComponents ?? [];

  function getComponentConfig(
    componentName: string | null | undefined,
  ): DesignSystemComponentConfig | undefined {
    if (!componentName) return undefined;
    const entry = components[componentName];
    return entry && typeof entry === "object" ? entry : undefined;
  }

  function isDeclaredComponent(
    componentName: string | null | undefined,
  ): boolean {
    return Boolean(getComponentConfig(componentName));
  }

  function getFieldRole(
    componentName: string | null | undefined,
  ): FieldRole | undefined {
    const declaredRole = getComponentConfig(componentName)?.role;
    if (
      declaredRole === "text-input" ||
      declaredRole === "textarea" ||
      declaredRole === "select"
    ) {
      return declaredRole;
    }
    if (declaredRole) return undefined;

    // Legacy fieldComponents entries keep their historical classification:
    // names containing "select" behave as selects, everything else as fields.
    if (componentName && legacyFieldComponents.includes(componentName)) {
      return /select/i.test(componentName) ? "select" : "text-input";
    }

    return undefined;
  }

  function getComponentRole(
    componentName: string | null | undefined,
  ): DesignSystemComponentRole | undefined {
    return getComponentConfig(componentName)?.role;
  }

  function withDefaults(
    custom: string[] | undefined,
    defaults: string[],
  ): string[] {
    return [...(custom ?? []), ...defaults];
  }

  function getLabelProps(componentName: string | null | undefined): string[] {
    return withDefaults(
      getComponentConfig(componentName)?.labelProps,
      DEFAULT_LABEL_PROPS,
    );
  }

  function getLoadingProps(componentName: string | null | undefined): string[] {
    return withDefaults(
      getComponentConfig(componentName)?.loadingProps,
      DEFAULT_LOADING_PROPS,
    );
  }

  function getDisabledProps(
    componentName: string | null | undefined,
  ): string[] {
    return withDefaults(
      getComponentConfig(componentName)?.disabledProps,
      DEFAULT_DISABLED_PROPS,
    );
  }

  function getCheckedProps(componentName: string | null | undefined): string[] {
    return withDefaults(
      getComponentConfig(componentName)?.checkedProps,
      DEFAULT_CHECKED_PROPS,
    );
  }

  function getPrimaryActionProps(
    componentName: string | null | undefined,
  ): string[] {
    return withDefaults(
      getComponentConfig(componentName)?.primaryActionProps,
      DEFAULT_PRIMARY_ACTION_PROPS,
    );
  }

  function getMenuProps(componentName: string | null | undefined): string[] {
    return withDefaults(
      getComponentConfig(componentName)?.menuProps,
      DEFAULT_MENU_PROPS,
    );
  }

  function getFeedbackFunctions(): string[] {
    return withDefaults(
      designSystem?.feedbackFunctions,
      DEFAULT_FEEDBACK_FUNCTIONS,
    );
  }

  return {
    isDeclaredComponent,
    getFieldRole,
    getComponentRole,
    getLabelProps,
    getLoadingProps,
    getDisabledProps,
    getCheckedProps,
    getPrimaryActionProps,
    getMenuProps,
    getFeedbackFunctions,
  };
}
