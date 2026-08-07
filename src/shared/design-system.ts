export type DesignSystemComponentRole =
  | "button"
  | "text-input"
  | "textarea"
  | "select";

export type DesignSystemComponentConfig = {
  role?: DesignSystemComponentRole;
  labelProps?: string[];
  loadingProps?: string[];
  disabledProps?: string[];
};

type DesignSystemSlice = {
  fieldComponents?: string[];
  components?: Record<string, DesignSystemComponentConfig>;
};

const DEFAULT_LABEL_PROPS = ["label", "labelText"];
const DEFAULT_LOADING_PROPS = ["loading", "isLoading"];
const DEFAULT_DISABLED_PROPS = ["disabled"];

export type FieldRole = "text-input" | "textarea" | "select";

export type ComponentVocabulary = {
  isDeclaredComponent(componentName: string | null | undefined): boolean;
  getFieldRole(componentName: string | null | undefined): FieldRole | undefined;
  getLabelProps(componentName: string | null | undefined): string[];
  getLoadingProps(componentName: string | null | undefined): string[];
  getDisabledProps(componentName: string | null | undefined): string[];
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

  return {
    isDeclaredComponent,
    getFieldRole,
    getLabelProps,
    getLoadingProps,
    getDisabledProps,
  };
}
