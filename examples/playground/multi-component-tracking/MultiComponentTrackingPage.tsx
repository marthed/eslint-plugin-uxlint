import type { ReactNode } from "react";
import { DownwardFlowCase } from "./downward/DownwardFlowCase";
import { DownwardFlowGoodCase } from "./downward/DownwardFlowGoodCase";
import { UpwardFlowCase } from "./upward/UpwardFlowCase";
import { UpwardFlowGoodCase } from "./upward/UpwardFlowGoodCase";

export function MultiComponentTrackingPage() {
  return (
    <div
      style={{
        fontFamily: "sans-serif",
        padding: 24,
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <h1 style={{ marginTop: 0 }}>Multi-Component Tracking Playground</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Interaction and state tracking through 4-level component hierarchies.
      </p>

      <CaseRow
        title="Downward Props Through 4 Levels (Bad vs Good)"
        bad={<DownwardFlowCase />}
        good={<DownwardFlowGoodCase />}
      />

      <CaseRow
        title="Upward Events Through 4 Levels (Bad vs Good)"
        bad={<UpwardFlowCase />}
        good={<UpwardFlowGoodCase />}
      />
    </div>
  );
}

function CaseRow({
  title,
  bad,
  good,
}: {
  title: string;
  bad: ReactNode;
  good: ReactNode;
}) {
  return (
    <section
      style={{
        marginBottom: 16,
        padding: 16,
        border: "1px solid #ddd",
        borderRadius: 8,
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 12 }}>{title}</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <CaseColumn title="Bad">{bad}</CaseColumn>
        <CaseColumn title="Good">{good}</CaseColumn>
      </div>
    </section>
  );
}

function CaseColumn({
  title,
  children,
}: {
  title: "Bad" | "Good";
  children: ReactNode;
}) {
  const isBad = title === "Bad";

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        border: `1px solid ${isBad ? "#f2c4c4" : "#cde8cf"}`,
        background: isBad ? "#fff8f8" : "#f6fff6",
        display: "grid",
        gap: 8,
      }}
    >
      <h3 style={{ margin: 0 }}>{title}</h3>
      {children}
    </div>
  );
}
