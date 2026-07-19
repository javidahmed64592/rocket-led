import type { ReactNode } from "react";

type Props = {
  title: string;
  children?: ReactNode;
};

export default function PageHeader({ title, children }: Props) {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "32px",
      }}
    >
      <h2 style={{ margin: 0, fontSize: "28px" }}>{title}</h2>
      <nav style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        {children}
      </nav>
    </header>
  );
}
