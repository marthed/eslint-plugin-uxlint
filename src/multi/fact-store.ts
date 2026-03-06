import type {
  NormalizedErrorIndicator,
  NormalizedField,
  NormalizedForm,
  NormalizedSubmitControl,
} from "./normalized-types";

export class MultiNodeFactStore {
  private forms: NormalizedForm[] = [];
  private formStack: NormalizedForm[] = [];
  private idCounter = 0;

  constructor(private readonly filePath: string) {}

  enterForm(node: any, framework: NormalizedForm["framework"], source: NormalizedForm["source"]) {
    const form: NormalizedForm = {
      id: `form-${++this.idCounter}`,
      filePath: this.filePath,
      node,
      framework,
      source,
      submitControls: [],
      fields: [],
      errorIndicators: [],
    };

    this.forms.push(form);
    this.formStack.push(form);
    return form;
  }

  exitForm() {
    this.formStack.pop();
  }

  currentForm(): NormalizedForm | null {
    return this.formStack[this.formStack.length - 1] ?? null;
  }

  addSubmit(control: NormalizedSubmitControl) {
    const form = this.currentForm();
    if (!form) return;
    form.submitControls.push(control);
  }

  addField(field: NormalizedField) {
    const form = this.currentForm();
    if (!form) return;
    form.fields.push(field);
  }

  addErrorIndicator(indicator: NormalizedErrorIndicator) {
    const form = this.currentForm();
    if (!form) return;
    form.errorIndicators.push(indicator);
  }

  getForms(): NormalizedForm[] {
    return this.forms;
  }
}