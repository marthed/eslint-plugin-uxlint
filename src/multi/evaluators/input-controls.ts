import type {
  NormalizedInputControl,
  NormalizedLabel,
} from "../normalized-types";

export type MultiNodeFinding = {
  node: any;
  message: string;
};

const INPUT_CHOICE_004_MESSAGE =
  "[INPUT-CHOICE-004] Radio groups should have a default selection or an explicit neutral option.";
const INPUT_CHOICE_005_MESSAGE =
  "[INPUT-CHOICE-005] Associate labels with checkbox/radio controls so users can click the label.";
const INPUT_MOBILE_001_MESSAGE =
  "[INPUT-MOBILE-001] Input fields should have labels outside the field, not rely on placeholder text.";
const INPUT_DATE_001_MESSAGE =
  "[INPUT-DATE-001] Avoid split month/day/year dropdowns for date entry; they add interaction cost.";

function uniqueTexts(texts: Array<string | undefined>): string[] {
  return [
    ...new Set(texts.map((text) => text?.trim()).filter(Boolean) as string[]),
  ];
}

function splitIdRefs(value: string | undefined): string[] {
  return (
    value
      ?.split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean) ?? []
  );
}

function getLabelTextsForControl(
  control: NormalizedInputControl,
  labels: NormalizedLabel[],
): string[] {
  const texts: Array<string | undefined> = [control.wrappingLabelText];

  if (control.id) {
    for (const label of labels) {
      if (label.htmlFor === control.id) {
        texts.push(label.text);
      }
    }
  }

  for (const ref of splitIdRefs(control.ariaLabelledBy)) {
    for (const label of labels) {
      if (label.id === ref) {
        texts.push(label.text);
      }
    }
  }

  return uniqueTexts(texts);
}

function hasUsableAssociatedLabel(
  control: NormalizedInputControl,
  labels: NormalizedLabel[],
): boolean {
  return getLabelTextsForControl(control, labels).some(
    (text) => text.trim().length > 0,
  );
}

function tokenize(...values: Array<string | undefined>): string[] {
  return values
    .filter(Boolean)
    .flatMap((value) =>
      value!
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .toLowerCase()
        .split(/[^a-z0-9]+/),
    )
    .filter(Boolean);
}

function isNeutralChoiceText(value: string): boolean {
  return [
    /\bnone\b/i,
    /\bno preference\b/i,
    /\bprefer not to say\b/i,
    /\bnot specified\b/i,
    /\bnot applicable\b/i,
    /\bnone of the above\b/i,
    /\bn\/a\b/i,
    /\bskip\b/i,
  ].some((pattern) => pattern.test(value));
}

function getDatePart(
  control: NormalizedInputControl,
  labels: NormalizedLabel[],
) {
  const tokens = tokenize(
    control.name,
    control.id,
    control.componentName,
    control.labelProp,
    control.ariaLabel,
    ...getLabelTextsForControl(control, labels),
  );

  if (tokens.includes("month")) return "month";
  if (tokens.includes("day")) return "day";
  if (tokens.includes("year")) return "year";
  return null;
}

function getDateBase(
  control: NormalizedInputControl,
  labels: NormalizedLabel[],
) {
  const tokens = tokenize(
    control.name,
    control.id,
    control.componentName,
    control.labelProp,
    control.ariaLabel,
    ...getLabelTextsForControl(control, labels),
  ).filter(
    (token) =>
      !["day", "month", "year", "date", "select", "field", "dropdown"].includes(
        token,
      ),
  );

  return tokens.length > 0 ? tokens.join("-") : undefined;
}

function evaluateChoiceLabels(
  controls: NormalizedInputControl[],
  labels: NormalizedLabel[],
): MultiNodeFinding[] {
  return controls
    .filter(
      (control) => control.kind === "checkbox" || control.kind === "radio",
    )
    .filter((control) => !hasUsableAssociatedLabel(control, labels))
    .map((control) => ({
      node: control.node,
      message: INPUT_CHOICE_005_MESSAGE,
    }));
}

function evaluateRadioGroups(
  controls: NormalizedInputControl[],
  labels: NormalizedLabel[],
): MultiNodeFinding[] {
  const groups = new Map<string, NormalizedInputControl[]>();

  for (const control of controls) {
    if (control.kind !== "radio" || !control.name) continue;

    const scope = control.formId ?? control.containerKey ?? "file";
    const groupKey = `${scope}::${control.name}`;
    const existing = groups.get(groupKey) ?? [];
    existing.push(control);
    groups.set(groupKey, existing);
  }

  const findings: MultiNodeFinding[] = [];

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const hasDefaultSelection = group.some(
      (control) => control.isDefaultSelected,
    );
    if (hasDefaultSelection) continue;

    const hasNeutralOption = group.some((control) =>
      uniqueTexts([
        control.value,
        control.ariaLabel,
        ...getLabelTextsForControl(control, labels),
      ]).some((text) => isNeutralChoiceText(text)),
    );

    if (hasNeutralOption) continue;

    findings.push({
      node: group[0].node,
      message: INPUT_CHOICE_004_MESSAGE,
    });
  }

  return findings;
}

function evaluatePlaceholderLabels(
  controls: NormalizedInputControl[],
  labels: NormalizedLabel[],
): MultiNodeFinding[] {
  return controls
    .filter(
      (control) =>
        control.kind === "text-input" ||
        control.kind === "textarea" ||
        control.kind === "design-system-field",
    )
    .filter((control) => Boolean(control.placeholder?.trim()))
    .filter(
      (control) =>
        !control.labelProp?.trim() &&
        !hasUsableAssociatedLabel(control, labels),
    )
    .map((control) => ({
      node: control.node,
      message: INPUT_MOBILE_001_MESSAGE,
    }));
}

function evaluateSplitDates(
  controls: NormalizedInputControl[],
  labels: NormalizedLabel[],
): MultiNodeFinding[] {
  const groups = new Map<
    string,
    { controls: NormalizedInputControl[]; parts: Set<string> }
  >();

  for (const control of controls) {
    if (control.kind !== "select" && control.kind !== "design-system-select") {
      continue;
    }

    const datePart = getDatePart(control, labels);
    if (!datePart) continue;

    const scope = control.formId ?? control.containerKey;
    if (!scope) continue;

    const dateBase = getDateBase(control, labels);
    const groupKey = dateBase
      ? `${scope}::${dateBase}`
      : control.containerKey
        ? `${scope}::container::${control.containerKey}`
        : null;
    if (!groupKey) continue;

    const group = groups.get(groupKey) ?? {
      controls: [],
      parts: new Set<string>(),
    };
    group.controls.push(control);
    group.parts.add(datePart);
    groups.set(groupKey, group);
  }

  const findings: MultiNodeFinding[] = [];

  for (const group of groups.values()) {
    if (
      group.parts.has("day") &&
      group.parts.has("month") &&
      group.parts.has("year")
    ) {
      findings.push({
        node: group.controls[0].node,
        message: INPUT_DATE_001_MESSAGE,
      });
    }
  }

  return findings;
}

export function evaluateInputControls(
  controls: NormalizedInputControl[],
  labels: NormalizedLabel[],
): MultiNodeFinding[] {
  return [
    ...evaluateChoiceLabels(controls, labels),
    ...evaluateRadioGroups(controls, labels),
    ...evaluatePlaceholderLabels(controls, labels),
    ...evaluateSplitDates(controls, labels),
  ];
}
