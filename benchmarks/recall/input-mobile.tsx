// expect: INPUT-MOBILE-001
export function Bad() {
  return <input type="text" name="badCity" placeholder="City" />;
}

export function Good() {
  return (
    <span>
      <label htmlFor="good-city">City</label>
      <input id="good-city" type="text" name="goodCity" placeholder="Berlin" />
    </span>
  );
}
