// expect: INPUT-DATE-002
export function Bad() {
  return (
    <span>
      <label htmlFor="bad-start">Start date</label>
      <input id="bad-start" type="text" name="startDate" />
    </span>
  );
}

export function Good() {
  return (
    <span>
      <label htmlFor="good-start">Start date (MM/DD/YYYY)</label>
      <input id="good-start" type="text" name="startDate" />
    </span>
  );
}
