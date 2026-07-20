import type { LedPattern } from "@/lib/types";

export default function PatternPreview({ pattern }: { pattern: LedPattern }) {
  if (pattern.kind === "rainbow") {
    return (
      <div
        aria-label="Rainbow"
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          flexShrink: 0,
          background:
            "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
        }}
      />
    );
  }
  return (
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
      {pattern.colours.map((c, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: `rgb(${c.r},${c.g},${c.b})`,
            border: "1px solid var(--dash-border)",
          }}
        />
      ))}
    </div>
  );
}
