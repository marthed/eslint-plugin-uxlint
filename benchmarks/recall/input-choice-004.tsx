// expect: INPUT-CHOICE-004
export function Bad() {
  return (
    <fieldset>
      <label htmlFor="bad-plan-a">Monthly</label>
      <input id="bad-plan-a" type="radio" name="badPlan" value="monthly" />
      <label htmlFor="bad-plan-b">Yearly</label>
      <input id="bad-plan-b" type="radio" name="badPlan" value="yearly" />
    </fieldset>
  );
}

export function Good() {
  return (
    <fieldset>
      <label htmlFor="good-plan-a">Monthly</label>
      <input
        id="good-plan-a"
        type="radio"
        name="goodPlan"
        value="monthly"
        defaultChecked
      />
      <label htmlFor="good-plan-b">Yearly</label>
      <input id="good-plan-b" type="radio" name="goodPlan" value="yearly" />
    </fieldset>
  );
}
