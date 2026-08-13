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
        <form action="/save">
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

// react-hook-form drives isSubmitting around the wrapped handler, so a form
// whose only pending cue is the fieldset/button disabled state is covered.
serialTest("formState.isSubmitting counts as a pending cue", () => {
  const code = `
    function CreateOrganisationDialog() {
      const form = useForm();

      const onFormSubmit = async (values) => {
        try {
          await createOrganisation(values);
          toast({ title: "Created" });
        } catch {
          toast({ title: "Failed", variant: "destructive" });
        }
      };

      return (
        <form onSubmit={form.handleSubmit(onFormSubmit)}>
          <fieldset disabled={form.formState.isSubmitting}>
            <input name="name" aria-label="Name" />
            <button type="submit">Create</button>
          </fieldset>
        </form>
      );
    }
  `;

  assert.deepEqual(warningIds(lintWithApplyRule(code)), []);
});

serialTest("destructured isSubmitting counts as a pending cue", () => {
  const code = `
    function CreateDialog() {
      const {
        handleSubmit,
        formState: { isSubmitting },
      } = useForm();

      const onSubmit = async (values) => {
        try {
          await save(values);
          toast({ title: "Saved" });
        } catch {
          toast({ title: "Failed", variant: "destructive" });
        }
      };

      return (
        <form onSubmit={handleSubmit(onSubmit)}>
          <input name="name" aria-label="Name" />
          <button type="submit" disabled={isSubmitting}>Save</button>
        </form>
      );
    }
  `;

  assert.deepEqual(warningIds(lintWithApplyRule(code)), []);
});

serialTest("an unread isSubmitting is still reported", () => {
  const code = `
    function SilentDialog() {
      const form = useForm();

      const onFormSubmit = async (values) => {
        try {
          await save(values);
          toast({ title: "Saved" });
        } catch {
          toast({ title: "Failed", variant: "destructive" });
        }
      };

      return (
        <form onSubmit={form.handleSubmit(onFormSubmit)}>
          <input name="name" aria-label="Name" />
          <button type="submit">Save</button>
        </form>
      );
    }
  `;

  assert.deepEqual(warningIds(lintWithApplyRule(code)), [
    "INTERACTION-ASYNC-START-001",
  ]);
});

// A synchronous submit handler has no pending period, so the wrapper must not
// confer async-phase status writes on it and reclassify it as async.
serialTest("a synchronous submit handler stays synchronous", () => {
  const code = `
    function BugReportForm() {
      const form = useForm();

      function onSubmit(data) {
        toast("Report submitted", { description: data.title });
      }

      return (
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset disabled={form.formState.isSubmitting}>
            <input name="title" aria-label="Title" />
            <button type="submit">Submit</button>
          </fieldset>
        </form>
      );
    }
  `;

  assert.deepEqual(warningIds(lintWithApplyRule(code)), []);
});

// next-safe-action's useAction has the same shape as useMutation: a trigger,
// status fields, and onSuccess/onError options.
serialTest("useAction is modelled like useMutation", () => {
  const code = `
    import { useAction } from "next-safe-action/hooks";

    function SendVerificationCodeForm() {
      const { handleSubmit, formState: { isSubmitting } } = useForm();

      const { executeAsync, isPending } = useAction(mergeAccountsAction, {
        onSuccess: () => {
          toast.success("Code sent");
        },
        onError: ({ error }) => {
          toast.error(error.serverError);
        },
      });

      const onSubmit = async () => {
        await executeAsync({ step: "send-tokens" });
      };

      return (
        <form onSubmit={handleSubmit(onSubmit)}>
          <input name="email" aria-label="Email" />
          <button type="submit" disabled={isPending || isSubmitting}>Send</button>
        </form>
      );
    }
  `;

  assert.deepEqual(warningIds(lintWithApplyRule(code)), []);
});
