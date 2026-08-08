import assert from "node:assert/strict";
import test from "node:test";
import { lintWithApplyRule, warningIds } from "./lint-harness";

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

serialTest("rendered errors.* reads count as a form error indicator", () => {
  const code = `
    function UserNameForm() {
      const { register, handleSubmit, formState: { errors } } = useForm();

      return (
        <form onSubmit={handleSubmit(save)}>
          <input id="name" {...register("name")} />
          {errors?.name && (
            <p className="text-red-600">{errors.name.message}</p>
          )}
          <button type="submit">Save</button>
        </form>
      );
    }

    function save() {}
    function useForm(): any {
      return {};
    }
  `;

  assert.deepEqual(warningIds(lintWithApplyRule(code)), []);
});

serialTest("formState.errors chains also count as error indicators", () => {
  const code = `
    function ProfileForm() {
      const form = useForm();

      return (
        <form>
          <input name="email" />
          <p>{form.formState.errors.email?.message}</p>
          <button type="submit">Save</button>
        </form>
      );
    }

    function useForm(): any {
      return {};
    }
  `;

  assert.deepEqual(warningIds(lintWithApplyRule(code)), []);
});

serialTest("forms without any error surface still report", () => {
  const code = `
    function PlainForm() {
      return (
        <form>
          <input name="email" />
          <button type="submit">Save</button>
        </form>
      );
    }
  `;

  assert.deepEqual(warningIds(lintWithApplyRule(code)), ["FORM-MULTI-001"]);
});

serialTest(
  "handlers wrapped in calls like handleSubmit(onSubmit) are resolved",
  () => {
    const code = `
      import React from "react";

      function SettingsForm() {
        const { handleSubmit } = useForm();
        const [saveCount, setSaveCount] = React.useState(0);

        async function onSubmit() {
          setSaveCount(saveCount + 1);
          await fakeSave();
        }

        return (
          <form onSubmit={handleSubmit(onSubmit)}>
            <input name="email" />
            <button type="submit">Save</button>
            <div role="alert" />
          </form>
        );
      }

      function useForm(): any {
        return {};
      }

      async function fakeSave() {
        return true;
      }
    `;

    assert.deepEqual(warningIds(lintWithApplyRule(code)), [
      "INTERACTION-ASYNC-START-001",
      "INTERACTION-ASYNC-ERROR-001",
      "INTERACTION-ASYNC-SUCCESS-001",
    ]);
  },
);

serialTest("a full react-hook-form flow with toasts and errors passes", () => {
  const code = `
    import React from "react";

    function UserNameForm() {
      const { register, handleSubmit, formState: { errors } } = useForm();
      const [isSaving, setIsSaving] = React.useState(false);

      async function onSubmit() {
        setIsSaving(true);
        const response = await fakeSave();
        setIsSaving(false);
        if (!response.ok) {
          toast({ title: "Your name was not updated." });
          return;
        }
        toast({ title: "Your name has been updated." });
      }

      return (
        <form onSubmit={handleSubmit(onSubmit)}>
          <input id="name" {...register("name")} />
          {errors?.name && (
            <p className="text-red-600">{errors.name.message}</p>
          )}
          <button type="submit" disabled={isSaving}>
            Save
          </button>
        </form>
      );
    }

    function useForm(): any {
      return {};
    }

    async function fakeSave() {
      return { ok: true };
    }
  `;

  assert.deepEqual(warningIds(lintWithApplyRule(code)), []);
});
