// expect: INPUT-DATE-001
export function Bad() {
  return (
    <fieldset>
      <label htmlFor="bad-month">Month</label>
      <select id="bad-month" name="birthMonth" />
      <label htmlFor="bad-day">Day</label>
      <select id="bad-day" name="birthDay" />
      <label htmlFor="bad-year">Year</label>
      <select id="bad-year" name="birthYear" />
    </fieldset>
  );
}

export function Good() {
  return (
    <span>
      <label htmlFor="good-dob">Date of birth</label>
      <input id="good-dob" type="date" name="dateOfBirth" />
    </span>
  );
}
