import assert from "node:assert/strict";
import test from "node:test";
import {
  lintProjectWithApplyRule,
  lintWithApplyRule,
  warningIds,
} from "./lint-harness";

function serialTest(name: string, fn: () => void | Promise<void>) {
  test(name, { concurrency: false }, fn);
}

const CREATE_BUTTON_WITHOUT_TOASTS = `
  import React from "react";

  function CreateButton() {
    const [isLoading, setIsLoading] = React.useState(false);

    async function onClick() {
      setIsLoading(true);
      const response = await fakeCreate();
      setIsLoading(false);
      if (!response.ok) {
        return;
      }
    }

    return (
      <button type="button" onClick={onClick} disabled={isLoading}>
        New post
      </button>
    );
  }

  async function fakeCreate() {
    return { ok: true };
  }
`;

const CREATE_BUTTON_WITH_TOASTS = CREATE_BUTTON_WITHOUT_TOASTS.replace(
  "if (!response.ok) {\n        return;\n      }",
  `if (!response.ok) {
        toast({ title: "Something went wrong." });
        return;
      }
      toast({ title: "Post created." });`,
);

serialTest(
  "reports missing error and success feedback without imperative feedback",
  () => {
    const ids = warningIds(lintWithApplyRule(CREATE_BUTTON_WITHOUT_TOASTS));

    assert.deepEqual(ids, [
      "INTERACTION-ASYNC-ERROR-001",
      "INTERACTION-ASYNC-SUCCESS-001",
    ]);
  },
);

serialTest(
  "post-await toast calls cover success and error outcome feedback",
  () => {
    const ids = warningIds(lintWithApplyRule(CREATE_BUTTON_WITH_TOASTS));

    assert.deepEqual(ids, []);
  },
);

serialTest("toast in catch covers only the error phase", () => {
  const code = `
    import React from "react";

    function SaveButton() {
      const [isSaving, setIsSaving] = React.useState(false);
      const [didSave, setDidSave] = React.useState(false);

      async function handleSave() {
        setIsSaving(true);
        try {
          await fakeSave();
          setDidSave(true);
        } catch {
          toast({ title: "Save failed." });
        } finally {
          setIsSaving(false);
        }
      }

      return (
        <div>
          <button type="button" onClick={handleSave} disabled={isSaving}>
            Save
          </button>
          <div>{didSave && "Saved"}</div>
        </div>
      );
    }

    async function fakeSave() {
      return true;
    }
  `;

  assert.deepEqual(warningIds(lintWithApplyRule(code)), []);
});

serialTest(
  "toast.success after await covers success but not error feedback",
  () => {
    const code = CREATE_BUTTON_WITH_TOASTS.replace(
      'toast({ title: "Something went wrong." });\n        return;',
      "return;",
    ).replace(
      'toast({ title: "Post created." });',
      'toast.success("Post created.");',
    );

    assert.deepEqual(warningIds(lintWithApplyRule(code)), [
      "INTERACTION-ASYNC-ERROR-001",
    ]);
  },
);

serialTest(
  "custom feedbackFunctions from designSystem config are recognized",
  () => {
    const code = CREATE_BUTTON_WITH_TOASTS.replace(/toast\(/g, "notify(");

    const withoutConfig = warningIds(lintWithApplyRule(code));
    assert.deepEqual(withoutConfig, [
      "INTERACTION-ASYNC-ERROR-001",
      "INTERACTION-ASYNC-SUCCESS-001",
    ]);

    const withConfig = warningIds(
      lintWithApplyRule(code, {
        uxlintFile: {
          version: 1,
          config: {
            designSystem: { feedbackFunctions: ["notify"] },
          },
          rules: [],
        },
      }),
    );
    assert.deepEqual(withConfig, []);
  },
);

serialTest("sync interactions with imperative feedback do not report", () => {
  const code = `
    import React from "react";

    function CopyButton() {
      const [copyCount, setCopyCount] = React.useState(0);

      function handleCopy() {
        setCopyCount(copyCount + 1);
        toast("Copied to clipboard");
      }

      return (
        <button type="button" onClick={handleCopy}>
          Copy
        </button>
      );
    }
  `;

  assert.deepEqual(warningIds(lintWithApplyRule(code)), []);

  const withoutToast = code.replace('toast("Copied to clipboard");', "");
  assert.deepEqual(warningIds(lintWithApplyRule(withoutToast)), [
    "INTERACTION-SYNC-001",
  ]);
});

serialTest(
  "forms whose submit handler shows toast errors pass FORM-MULTI-001",
  () => {
    const code = `
      import React from "react";

      function SettingsForm() {
        const [isSaving, setIsSaving] = React.useState(false);

        async function onSubmit(event: React.FormEvent) {
          event.preventDefault();
          setIsSaving(true);
          const response = await fakeSave();
          setIsSaving(false);
          if (!response.ok) {
            toast({ title: "Your settings were not saved." });
            return;
          }
          toast({ title: "Settings saved." });
        }

        return (
          <form onSubmit={onSubmit}>
            <input name="email" />
            <button type="submit" disabled={isSaving}>
              Save
            </button>
          </form>
        );
      }

      async function fakeSave() {
        return { ok: true };
      }
    `;

    assert.deepEqual(warningIds(lintWithApplyRule(code)), []);
  },
);

serialTest("feedback calls are found through multi-file helper tracing", () => {
  const messages = lintProjectWithApplyRule({
    entryFilePath: "CreatePanel.tsx",
    files: {
      "CreatePanel.tsx": `
        import React from "react";
        import { reportOutcome } from "./feedback";

        function CreatePanel() {
          const [isLoading, setIsLoading] = React.useState(false);

          async function onClick() {
            setIsLoading(true);
            const response = await fakeCreate();
            setIsLoading(false);
            reportOutcome(response.ok);
          }

          return (
            <button type="button" onClick={onClick} disabled={isLoading}>
              Create
            </button>
          );
        }

        async function fakeCreate() {
          return { ok: true };
        }
      `,
      "feedback.ts": `
        export function reportOutcome(ok: boolean) {
          toast({ title: ok ? "Created." : "Something went wrong." });
        }
      `,
    },
  });

  assert.deepEqual(warningIds(messages), []);
});
