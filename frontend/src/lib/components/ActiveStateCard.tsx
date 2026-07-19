import ColourSwatchList from "@/lib/components/ColourSwatchList";
import PatternPreview from "@/lib/components/PatternPreview";
import type { LedPreset, RgbColour } from "@/lib/types";

type Props = {
  activePreset: LedPreset | null;
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

export default function ActiveStateCard({
  activePreset,
  draftColours,
  brightness,
  isOn,
  isDirty,
  isSavingDraft,
  isTurningOff,
  isApplying,
  canTurnOn,
  onDraftColourChange,
  onRevert,
  onBrightnessChange,
  onBrightnessCommit,
  onSaveDraft,
  onTurnOn,
  onTurnOff,
}: Props) {
  return (
    <div
      className={`dashboard-card${isOn ? " active-preset" : ""}`}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: "10px",
        minWidth: "200px",
        maxWidth: "260px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span className={`dashboard-status-dot${isOn ? " on" : ""}`} />
        <strong style={{ fontSize: "13px", color: "var(--dash-text-muted)" }}>
          {isOn ? "Active" : "Off"}
        </strong>
      </div>

      {activePreset && (
        <strong style={{ fontSize: "14px" }}>{activePreset.name}</strong>
      )}

      {activePreset?.pattern.kind === "rainbow" ? (
        <PatternPreview pattern={activePreset.pattern} />
      ) : activePreset && draftColours ? (
        <ColourSwatchList
          colours={draftColours}
          onChange={onDraftColourChange}
        />
      ) : null}

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
          <span>{Math.round(brightness * 100)}%</span>
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={brightness}
          onChange={(e) => onBrightnessChange(parseFloat(e.target.value))}
          onPointerUp={(e) =>
            onBrightnessCommit(parseFloat((e.target as HTMLInputElement).value))
          }
          style={{ width: "100%" }}
        />
      </div>

      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {isDirty && (
          <>
            <button
              className="dashboard-btn"
              style={{ fontSize: "12px", padding: "6px 12px" }}
              onClick={onSaveDraft}
              disabled={isSavingDraft}
            >
              Save
            </button>
            <button
              className="dashboard-btn secondary"
              style={{ fontSize: "12px", padding: "6px 12px" }}
              onClick={onRevert}
            >
              Revert
            </button>
          </>
        )}
        {isOn ? (
          <button
            className="dashboard-btn danger"
            style={{ fontSize: "12px", padding: "6px 12px" }}
            onClick={onTurnOff}
            disabled={isTurningOff}
          >
            {isTurningOff ? "Turning off…" : "Turn Off"}
          </button>
        ) : (
          <button
            className="dashboard-btn"
            style={{ fontSize: "12px", padding: "6px 12px" }}
            onClick={onTurnOn}
            disabled={!canTurnOn || isApplying}
          >
            Turn On
          </button>
        )}
      </div>
    </div>
  );
}
