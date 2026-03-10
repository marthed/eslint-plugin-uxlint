import React from "react";
import { HierarchyCard } from "../shared/HierarchyCard";
import { UpwardGoodLevelOne } from "./levels/UpwardGoodLevelOne";

export function UpwardFlowGoodCase() {
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

  const latestAction = history[0] ?? "No actions yet";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <UpwardGoodLevelOne
        onAction={recordAction}
        totalActions={history.length}
        latestAction={latestAction}
      />

      <HierarchyCard
        title="Root Aggregated State"
        borderColor="#bcd7cf"
        background="#f4fffb"
      >
        <div>Total actions captured in root: {history.length}</div>
        <div>Latest action path: {latestAction}</div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {history.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </HierarchyCard>
    </div>
  );
}
