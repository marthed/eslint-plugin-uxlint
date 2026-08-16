// expect: INPUT-TOGGLE-002
import React from "react";

export function Bad() {
  const [emailAlerts, setEmailAlerts] = React.useState(false);
  return (
    <form action="/settings">
      <AppSwitch
        checked={emailAlerts}
        onChange={() => setEmailAlerts(!emailAlerts)}
        label="Email alerts"
      />
      <p role="alert">Could not save settings.</p>
      <button type="submit">Save</button>
    </form>
  );
}

export function Good() {
  const [emailAlerts, setEmailAlerts] = React.useState(false);
  return (
    <AppSwitch
      checked={emailAlerts}
      onChange={() => setEmailAlerts(!emailAlerts)}
      label="Email alerts"
    />
  );
}
