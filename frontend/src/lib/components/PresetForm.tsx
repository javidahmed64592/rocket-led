import ColourSwatchList from "@/lib/components/ColourSwatchList";
import type { LedPatternKind, LedPreset } from "@/lib/types";

import {
  type FormMode,
  type FormState,
  PATTERN_KINDS,
} from "./presetFormUtils";

type Props = {
  formMode: Exclude<FormMode, { mode: "none" }>;
  form: FormState;
  presets: LedPreset[] | undefined;
  isMutating: boolean;
  error: Error | null;
  onFormChange: (form: FormState) => void;
  onKindChange: (kind: Exclude<LedPatternKind, "off">) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
};

export default function PresetForm({
  formMode,
  form,
  presets,
  isMutating,
  error,
  onFormChange,
  onKindChange,
  onSubmit,
  onClose,
}: Props) {
  return (
    <section
      className="dashboard-card"
      style={{ marginBottom: "32px", maxWidth: "500px" }}
    >
      <h2 style={{ marginTop: 0, marginBottom: "16px" }}>
        {formMode.mode === "edit" ? "Edit Preset" : "New Preset"}
      </h2>
      <form onSubmit={onSubmit}>
        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "16px",
          }}
        >
          <input
            className="dash-input"
            placeholder="Preset name"
            value={form.name}
            onChange={(e) => onFormChange({ ...form, name: e.target.value })}
            required
            autoFocus
            style={{ flex: "1 1 160px" }}
          />
          <select
            className="dash-input"
            value={form.kind}
            onChange={(e) =>
              onKindChange(e.target.value as Exclude<LedPatternKind, "off">)
            }
            style={{ flex: "0 0 auto" }}
          >
            {PATTERN_KINDS.map((k) => (
              <option key={k} value={k}>
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {form.kind !== "rainbow" && (
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                color: "var(--dash-text-muted)",
              }}
            >
              Colours
            </label>
            <ColourSwatchList
              colours={form.colours}
              onChange={(colours) => onFormChange({ ...form, colours })}
              maxColours={form.kind === "solid" ? 1 : undefined}
            />
          </div>
        )}

        {form.kind !== "rainbow" &&
          presets &&
          presets.filter(
            (p) => formMode.mode !== "edit" || p.id !== formMode.preset.id
          ).length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontSize: "13px",
                  color: "var(--dash-text-muted)",
                }}
              >
                Copy colours from…
              </label>
              <select
                className="dash-input"
                style={{ maxWidth: "260px" }}
                value=""
                onChange={(e) => {
                  const src = presets.find(
                    (p) => p.id === Number(e.target.value)
                  );
                  if (src && src.pattern.colours.length > 0) {
                    const colours =
                      form.kind === "solid"
                        ? src.pattern.colours.slice(0, 1)
                        : src.pattern.colours;
                    onFormChange({ ...form, colours });
                  }
                }}
              >
                <option value="">— pick a preset —</option>
                {presets
                  .filter(
                    (p) =>
                      formMode.mode !== "edit" || p.id !== formMode.preset.id
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
              color: "var(--dash-text-muted)",
            }}
          >
            Interval: {form.interval_ms}ms (
            {(form.interval_ms / 1000).toFixed(1)}s)
          </label>
          <input
            type="range"
            min={200}
            max={10000}
            step={100}
            value={form.interval_ms}
            onChange={(e) =>
              onFormChange({
                ...form,
                interval_ms: parseInt(e.target.value, 10),
              })
            }
            style={{ width: "100%", maxWidth: "400px" }}
          />
        </div>

        {error && (
          <p style={{ color: "var(--dash-danger)", margin: "0 0 12px" }}>
            {error.message}
          </p>
        )}

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="submit"
            className="dashboard-btn"
            disabled={isMutating || !form.name.trim()}
          >
            {isMutating
              ? "Saving…"
              : formMode.mode === "edit"
                ? "Update Preset"
                : "Save Preset"}
          </button>
          <button
            type="button"
            className="dashboard-btn secondary"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
