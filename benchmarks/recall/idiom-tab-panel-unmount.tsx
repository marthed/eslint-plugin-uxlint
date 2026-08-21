// expect: TABS-UNMOUNT-001
// The inactive panel is destroyed, so switching tabs and back loses whatever
// was typed and puts the text beyond find-in-page.
export function Bad({ active }) {
  return (
    <div>
      <div role="tablist">
        <button role="tab" aria-selected={active === "profile"}>
          Profile
        </button>
      </div>
      {active === "profile" && (
        <div role="tabpanel">
          <label htmlFor="bad-display-name">Display name</label>
          <input id="bad-display-name" name="displayName" />
        </div>
      )}
    </div>
  );
}

export function Good({ active }) {
  return (
    <div>
      <div role="tablist">
        <button role="tab" aria-selected={active === "profile"}>
          Profile
        </button>
      </div>
      <div role="tabpanel" hidden={active !== "profile"}>
        <label htmlFor="good-display-name">Display name</label>
        <input id="good-display-name" name="displayName" />
      </div>
    </div>
  );
}
