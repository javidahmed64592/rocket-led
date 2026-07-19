import ColourSwatchList from "@/lib/components/ColourSwatchList";
import PatternPreview from "@/lib/components/PatternPreview";
import type { LedPreset, RgbColour } from "@/lib/types";

export type ActiveCardControls = {
  draftColours: RgbColour[] | null;
  brightness: number;
  isOn: boolean;
  isDirty: boolean;
  isSavingDraft: boolean;
  isTurningOff: boolean;
  isApplying: boolean;
  canTurnOn: boolean;
  onDraftColourChange: (colours: RgbColour[]) => void;
  onRevert: () => void;
  onBrightnessChange: (value: number) => void;
  onBrightnessCommit: (value: number) => void;
  onSaveDraft: () => void;
  onTurnOn: () => void;
  onTurnOff: () => void;
};

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
  activeControls?: ActiveCardControls;
};

function formatInterval(ms: number): string {
  const s = ms / 1000;
  return `${Number.isInteger(s) ? s : s.toFixed(1)}s`;
}

function PowerIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  );
}

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
  activeControls,
}: Props) {
  const ac = active ? activeControls : undefined;

  return (
    <div
      className={`dashboard-card${active ? " active-preset" : ""}`}
      style={{ display: "flex", flexDirection: "column", gap: "10px" }}
    >
      {/* Name — always */}
      <strong style={{ fontSize: "14px" }}>{preset.name}</strong>

      {/* Kind · interval — always, never moves */}
      <span style={{ fontSize: "12px", color: "var(--dash-text-muted)" }}>
        {preset.pattern.kind} · {formatInterval(preset.pattern.interval_ms)}
      </span>

      {/* Pattern preview — non-active cards only */}
      {!ac && <PatternPreview pattern={preset.pattern} />}

      {/* Active card: editable swatches or rainbow preview */}
      {ac &&
        (preset.pattern.kind === "rainbow" ? (
          <PatternPreview pattern={preset.pattern} />
        ) : ac.draftColours != null ? (
          <ColourSwatchList
            colours={ac.draftColours}
            onChange={ac.onDraftColourChange}
            maxColours={preset.pattern.kind === "solid" ? 1 : undefined}
          />
        ) : null)}

      {/* Brightness slider — active card only */}
      {ac && (
        <div>
          <label
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12px",
              color: "var(--dash-text-muted)",
              marginBottom: "4px",
            }}
          >
            <span>Brightness</span>
            <span>{Math.round(ac.brightness * 100)}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={ac.brightness}
            onChange={(e) => ac.onBrightnessChange(parseFloat(e.target.value))}
            onPointerUp={(e) =>
              ac.onBrightnessCommit(
                parseFloat((e.target as HTMLInputElement).value),
              )
            }
            style={{ width: "100%" }}
          />
        </div>
      )}

      {/* Save/Revert — shown when active and dirty */}
      {ac?.isDirty && (
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            className="dashboard-btn"
            style={{ fontSize: "12px", padding: "6px 12px" }}
            onClick={ac.onSaveDraft}
            disabled={ac.isSavingDraft}
          >
            Save
          </button>
          <button
            className="dashboard-btn secondary"
            style={{ fontSize: "12px", padding: "6px 12px" }}
            onClick={ac.onRevert}
          >
            Revert
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          marginTop: "auto",
          flexWrap: "wrap",
        }}
      >
        {ac ? (
          // Active card: green when on, muted when off
          <button
            className={`dashboard-btn icon-btn${
              ac.isOn ? " power-on" : " secondary"
            }`}
            onClick={ac.isOn ? ac.onTurnOff : ac.onTurnOn}
            disabled={
              ac.isTurningOff || (!ac.isOn && (!ac.canTurnOn || ac.isApplying))
            }
            title={ac.isOn ? "Turn off" : "Turn on"}
            aria-label={ac.isOn ? "Turn off" : "Turn on"}
          >
            <PowerIcon />
          </button>
        ) : (
          // Inactive card: standard purple — activate
          <button
            className="dashboard-btn icon-btn"
            disabled={isApplying}
            onClick={onApply}
            title="Activate preset"
            aria-label="Activate preset"
          >
            <PowerIcon />
          </button>
        )}
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
