// expect: INPUT-TOGGLE-001
import React from "react";

export function Bad() {
  const [theme, setTheme] = React.useState("light");
  return (
    <AppSwitch
      checked={theme}
      onChange={() => setTheme(theme === "light" ? "dark" : "light")}
      label="Theme"
    />
  );
}

export function Good() {
  const [isDark, setIsDark] = React.useState(false);
  return (
    <AppSwitch
      checked={isDark}
      onChange={() => setIsDark(!isDark)}
      label="Dark mode"
    />
  );
}
