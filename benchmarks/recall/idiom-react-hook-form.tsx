// expect: INTERACTION-ASYNC-START-001
// Regression shape: react-hook-form drives the pending cue through
// formState.isSubmitting, which is only a status source because useForm() is
// modelled as one.
export function Bad() {
  const form = useForm();

  const onFormSubmit = async (values) => {
    try {
      await createOrganisation(values);
      toast.success("Created");
    } catch {
      toast.error("Failed");
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onFormSubmit)}>
      <label htmlFor="bad-name">Name</label>
      <input id="bad-name" name="name" />
      <p role="alert">Something went wrong.</p>
      <button type="submit">Create</button>
    </form>
  );
}

export function Good() {
  const form = useForm();

  const onFormSubmit = async (values) => {
    try {
      await createOrganisation(values);
      toast.success("Created");
    } catch {
      toast.error("Failed");
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onFormSubmit)}>
      <fieldset disabled={form.formState.isSubmitting}>
        <label htmlFor="good-name">Name</label>
        <input id="good-name" name="name" />
        <p role="alert">Something went wrong.</p>
        <button type="submit">Create</button>
      </fieldset>
    </form>
  );
}
