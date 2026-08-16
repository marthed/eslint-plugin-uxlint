// expect: FORM-MULTI-001
export function Bad() {
  return (
    <form action="/subscribe">
      <label htmlFor="bad-email">Email</label>
      <input id="bad-email" name="email" />
      <button type="submit">Subscribe</button>
    </form>
  );
}

export function Good() {
  return (
    <form action="/subscribe">
      <label htmlFor="good-email">Email</label>
      <input id="good-email" name="email" />
      <p role="alert">Please enter a valid address.</p>
      <button type="submit">Subscribe</button>
    </form>
  );
}
