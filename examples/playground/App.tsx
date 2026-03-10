import React from "react";
import { PlaygroundPage } from "./PlaygroundPage";
import { MultiComponentTrackingPage } from "./multi-component-tracking/MultiComponentTrackingPage";

type PlaygroundView = "baseline" | "multi-component";

export function App() {
  const [view, setView] = React.useState<PlaygroundView>("baseline");

  return (
    <div>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          background: "#ffffff",
          borderBottom: "1px solid #e6e6e6",
          padding: "12px 24px",
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setView("baseline");
          }}
          style={{
            border: "1px solid #bbb",
            borderRadius: 6,
            padding: "8px 12px",
            background: view === "baseline" ? "#f0f7ff" : "#fff",
            cursor: "pointer",
          }}
        >
          Baseline Playground
        </button>

        <button
          type="button"
          onClick={() => {
            setView("multi-component");
          }}
          style={{
            border: "1px solid #bbb",
            borderRadius: 6,
            padding: "8px 12px",
            background: view === "multi-component" ? "#f0f7ff" : "#fff",
            cursor: "pointer",
          }}
        >
          Multi-Component Tracking
        </button>
      </header>

      {view === "baseline" ? (
        <PlaygroundPage />
      ) : (
        <MultiComponentTrackingPage />
      )}
    </div>
  );
}
