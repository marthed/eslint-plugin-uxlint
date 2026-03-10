import type { ReactNode } from "react";

export function HierarchyCard({
  title,
  children,
  borderColor = "#d9d9d9",
  background = "#fafafa",
}: {
  title: string;
  children: ReactNode;
  borderColor?: string;
  background?: string;
}) {
  return (
    <section
      style={{
        border: `1px solid ${borderColor}`,
        background,
        borderRadius: 8,
        padding: 12,
        display: "grid",
        gap: 8,
      }}
    >
      <h4 style={{ margin: 0, fontSize: 14 }}>{title}</h4>
      {children}
    </section>
  );
}
