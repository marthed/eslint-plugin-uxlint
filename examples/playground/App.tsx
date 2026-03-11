import React from "react";
import { PlaygroundPage } from "./PlaygroundPage";
import { MultiComponentTrackingPage } from "./multi-component-tracking/MultiComponentTrackingPage";
import { ReactQueryPlaygroundPage } from "./framework-adapters/react-query/ReactQueryPlaygroundPage";
import { ReduxPlaygroundPage } from "./framework-adapters/redux/ReduxPlaygroundPage";
import { ZustandPlaygroundPage } from "./framework-adapters/zustand/ZustandPlaygroundPage";

type PlaygroundView =
  | "baseline"
  | "multi-component"
  | "react-query"
  | "redux"
  | "zustand";

export function App() {
  const [view, setView] = React.useState<PlaygroundView>("baseline");

  const views: Array<{ id: PlaygroundView; label: string }> = [
    { id: "baseline", label: "Baseline Playground" },
    { id: "multi-component", label: "Multi-Component Tracking" },
    { id: "react-query", label: "React Query Playground" },
    { id: "redux", label: "Redux Playground" },
    { id: "zustand", label: "Zustand Playground" },
  ];

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
        {views.map((playgroundView) => (
          <button
            key={playgroundView.id}
            type="button"
            onClick={() => {
              setView(playgroundView.id);
            }}
            style={{
              border: "1px solid #bbb",
              borderRadius: 6,
              padding: "8px 12px",
              background: view === playgroundView.id ? "#f0f7ff" : "#fff",
              cursor: "pointer",
            }}
          >
            {playgroundView.label}
          </button>
        ))}
      </header>

      {view === "baseline" && <PlaygroundPage />}
      {view === "multi-component" && <MultiComponentTrackingPage />}
      {view === "react-query" && <ReactQueryPlaygroundPage />}
      {view === "redux" && <ReduxPlaygroundPage />}
      {view === "zustand" && <ZustandPlaygroundPage />}
    </div>
  );
}
