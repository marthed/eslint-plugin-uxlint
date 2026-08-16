// expect: INPUT-CHOICE-005
export function Bad() {
  return (
    <fieldset>
      <input type="checkbox" name="badTerms" />
      <span>I accept the terms</span>
    </fieldset>
  );
}

export function Good() {
  return (
    <fieldset>
      <label htmlFor="good-terms">I accept the terms</label>
      <input id="good-terms" type="checkbox" name="goodTerms" />
    </fieldset>
  );
}
