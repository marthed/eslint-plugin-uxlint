import { StructureFactStore } from "../fact-store";
import type { NormalizedSubmitControl } from "../normalized-types";
import type { UXLintProjectConfig } from "../../shared/rules-loader";
import {
  attrText,
  getJSXName,
  hasAttr,
  hasSpreadAttribute,
  isLowerTagName,
} from "./jsx-helpers";

function includesName(
  names: string[] | undefined,
  name: string | null,
): boolean {
  return !!name && !!names?.includes(name);
}

const ERROR_STATE_NAME = /^(errors|fieldErrors|formErrors|validationErrors)$/;

function isErrorStateMemberExpression(node: any): boolean {
  if (node?.type !== "MemberExpression") return false;

  return (
    (node.object?.type === "Identifier" &&
      ERROR_STATE_NAME.test(node.object.name)) ||
    (node.computed === false &&
      node.property?.type === "Identifier" &&
      ERROR_STATE_NAME.test(node.property.name))
  );
}

// Finds rendered reads of error state (e.g. react-hook-form's
// {errors.name && <p>{errors.name.message}</p>}) inside a form subtree.
// JSX attributes are skipped so handler expressions don't count as render.
function findErrorStateRead(formNode: any): any | null {
  let found: any = null;

  function visit(current: any) {
    if (found || !current || typeof current.type !== "string") return;
    if (current.type === "JSXAttribute") return;

    if (isErrorStateMemberExpression(current)) {
      found = current;
      return;
    }

    for (const key of Object.keys(current)) {
      if (key === "parent") continue;
      const value = current[key];
      if (Array.isArray(value)) {
        for (const entry of value) {
          if (entry && typeof entry === "object") visit(entry);
        }
      } else if (value && typeof value === "object") {
        visit(value);
      }
    }
  }

  visit(formNode);
  return found;
}

// Attributes that make a form submit for real: a handler, a server action,
// or an HTTP method. `onFinish` covers design systems (antd, and others that
// follow it) that name their submit handler differently.
const DEFAULT_FORM_SUBMIT_PROPS = ["onSubmit", "onFinish"];
const FORM_ACTION_PROPS = ["action", "formAction", "method"];

// Form libraries bind a field by spreading the result of a call:
// <TextInput {...form.getInputProps('email')} />. Those bindings usually
// carry the field's error prop, so the error UI cannot be proven absent.
// A plain {...props} pass-through implies nothing and is not included.
const DEFAULT_FIELD_BINDING_FUNCTIONS = [
  "getInputProps",
  "getFieldProps",
  "register",
];

function getCalleeName(node: any): string | null {
  if (node?.type === "Identifier") return node.name;
  if (node?.type === "MemberExpression" && node.computed === false) {
    return node.property?.name ?? null;
  }
  return null;
}

function hasFieldBindingSpread(
  openingEl: any,
  bindingNames: string[],
): boolean {
  const attrs = openingEl?.attributes ?? [];

  return attrs.some((attr: any) => {
    if (attr?.type !== "JSXSpreadAttribute") return false;
    if (attr.argument?.type !== "CallExpression") return false;

    const calleeName = getCalleeName(attr.argument.callee);
    return !!calleeName && bindingNames.includes(calleeName);
  });
}

export function createJSXFormCollector(
  store: StructureFactStore,
  config: UXLintProjectConfig,
) {
  const ds = config.designSystem ?? {};
  const formSubmitProps = ds.formSubmitProps ?? DEFAULT_FORM_SUBMIT_PROPS;
  const fieldBindingFunctions =
    ds.fieldBindingFunctions ?? DEFAULT_FIELD_BINDING_FUNCTIONS;

  // Records how (or whether) this form can submit. A form with no evidence at
  // all is a layout-only demo, and rules about submission outcomes skip it.
  function addSubmissionEvidence(formNode: any) {
    const opening = formNode.openingElement;

    for (const prop of formSubmitProps) {
      if (hasAttr(opening, prop)) {
        store.addSubmissionEvidence({ node: opening, kind: "submit-handler" });
        return;
      }
    }

    for (const prop of FORM_ACTION_PROPS) {
      if (hasAttr(opening, prop)) {
        store.addSubmissionEvidence({ node: opening, kind: "form-action" });
        return;
      }
    }

    // A spread may carry onSubmit, so absence is unproven and the form does
    // not qualify for the "cannot submit" exemption.
    if (hasSpreadAttribute(opening)) {
      store.addSubmissionEvidence({ node: opening, kind: "unknown" });
    }
  }

  function addErrorStateReadIndicator(formNode: any) {
    const errorStateRead = findErrorStateRead(formNode);
    if (!errorStateRead) return;

    store.addErrorIndicator({
      node: errorStateRead,
      kind: "error-state-read",
    });
  }

  function enterJSXElement(node: any) {
    const opening = node.openingElement;
    if (!opening) return;

    const name = getJSXName(opening);
    const isNative = isLowerTagName(name);

    // 1) Form scope start
    if (name === "form") {
      store.enterForm(node, "html", "native");
      addSubmissionEvidence(node);
      addErrorStateReadIndicator(node);
      return;
    }

    if (includesName(ds.formComponents, name)) {
      store.enterForm(node, "react", "design-system");
      addSubmissionEvidence(node);
      addErrorStateReadIndicator(node);
      return;
    }

    const currentForm = store.currentForm();
    if (!currentForm) return;

    if (hasFieldBindingSpread(opening, fieldBindingFunctions)) {
      store.addErrorIndicator({ node, kind: "unknown" });
    }

    // 2) Submit controls. A handler or form action on the control itself is
    // also submission evidence — `<button type="submit" formAction={save}>`.
    function addSubmit(kind: NormalizedSubmitControl["kind"]) {
      store.addSubmit({ node, kind });

      if (hasAttr(opening, "onClick") || hasAttr(opening, "formAction")) {
        store.addSubmissionEvidence({
          node: opening,
          kind: "submit-click-handler",
        });
      } else if (hasSpreadAttribute(opening)) {
        store.addSubmissionEvidence({ node: opening, kind: "unknown" });
      }
    }

    if (name === "button" && attrText(opening, "type") === "submit") {
      addSubmit("native-submit");
    }

    if (name === "input" && attrText(opening, "type") === "submit") {
      addSubmit("native-submit");
    }

    if (
      !isNative &&
      (name === "Button" || name === "SubmitButton") &&
      attrText(opening, "type") === "submit"
    ) {
      addSubmit("button-submit");
    }

    if (includesName(ds.submitComponents, name)) {
      addSubmit("submit-component");
    }

    // 3) Fields
    const isField =
      name === "input" ||
      name === "textarea" ||
      name === "select" ||
      includesName(ds.fieldComponents, name);

    if (isField) {
      const fieldErrorProps = ds.fieldErrorProps ?? [
        "error",
        "errorMessage",
        "invalid",
      ];
      const hasErrorProp = fieldErrorProps.some((prop) =>
        hasAttr(opening, prop),
      );

      store.addField({
        node,
        name: attrText(opening, "name") ?? undefined,
        hasErrorProp,
      });

      if (hasErrorProp) {
        store.addErrorIndicator({
          node,
          kind: "field-error-prop",
        });
      }
    }

    // 4) Explicit error UI
    if (attrText(opening, "role") === "alert") {
      store.addErrorIndicator({ node, kind: "role-alert" });
    }

    if (hasAttr(opening, "aria-live")) {
      store.addErrorIndicator({ node, kind: "aria-live" });
    }

    if (includesName(ds.errorComponents, name)) {
      store.addErrorIndicator({ node, kind: "error-component" });
    }

    if (includesName(ds.errorSummaryComponents, name)) {
      store.addErrorIndicator({ node, kind: "error-summary" });
    }

    if (
      !isNative &&
      ["ErrorMessage", "InlineError", "FormError", "FormErrorSummary"].includes(
        name ?? "",
      )
    ) {
      store.addErrorIndicator({
        node,
        kind: name === "FormErrorSummary" ? "error-summary" : "error-component",
      });
    }
  }

  function exitJSXElement(node: any) {
    const opening = node.openingElement;
    if (!opening) return;

    const name = getJSXName(opening);

    if (name === "form" || includesName(ds.formComponents, name)) {
      store.exitForm();
    }
  }

  return {
    JSXElement: enterJSXElement,
    "JSXElement:exit": exitJSXElement,
  };
}
