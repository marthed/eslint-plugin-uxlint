import React from "react";
import { UpwardLevelOne } from "./levels/UpwardLevelOne";

export function UpwardFlowCase() {
  const [history, setHistory] = React.useState<string[]>([]);

  function recordAction(actionLabel: string) {
    const timestamp = new Date().toLocaleTimeString("en-US", {
      hour12: false,
    });

    setHistory((prevHistory) => {
      const nextHistory = [`${timestamp} ${actionLabel}`, ...prevHistory];
      return nextHistory.slice(0, 6);
    });
  }

  return <UpwardLevelOne onAction={recordAction} />;
}
