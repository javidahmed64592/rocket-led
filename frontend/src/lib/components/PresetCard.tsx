import PatternPreview from "@/lib/components/PatternPreview";
import type { LedPreset } from "@/lib/types";

type Props = {
  preset: LedPreset;
  active: boolean;
  isApplying: boolean;
  isDuplicating: boolean;
  isDeleting: boolean;
  onApply: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export default function PresetCard({
  preset,
  active,
  isApplying,
  isDuplicating,
  isDeleting,
  onApply,
  onEdit,
  onDuplicate,
  onDelete,
}: Props) {
  return (
    <div
      className={`dashboard-card${active ? " active-preset" : ""}`}
      style={{ display: "flex", flexDirection: "column", gap: "10px" }}
    >
      <PatternPreview pattern={preset.pattern} />
      <strong style={{ fontSize: "14px" }}>{preset.name}</strong>
      <span style={{ fontSize: "12px", color: "var(--dash-text-muted)" }}>
        {preset.pattern.kind} · {preset.pattern.interval_ms}ms
      </span>
      <div
        style={{
          display: "flex",
          gap: "6px",
          marginTop: "auto",
          flexWrap: "wrap",
        }}
      >
        <button
          className="dashboard-btn"
          style={{ flex: 1, fontSize: "13px" }}
          disabled={active || isApplying}
          onClick={onApply}
        >
          {active ? "Active" : "Apply"}
        </button>
        <button
          className="dashboard-btn icon-btn"
          onClick={onEdit}
          title="Edit preset"
          aria-label="Edit preset"
        >
          ✏
        </button>
        <button
          className="dashboard-btn icon-btn"
          onClick={onDuplicate}
          title="Duplicate preset"
          aria-label="Duplicate preset"
          disabled={isDuplicating}
        >
          ⧉
        </button>
        <button
          className="dashboard-btn icon-btn danger"
          onClick={onDelete}
          title="Delete preset"
          aria-label="Delete preset"
          disabled={isDeleting}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
