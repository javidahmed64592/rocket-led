import { useState } from "react";

import ColourSwatchList from "@/lib/components/ColourSwatchList";
import type { LedPatternKind, LedPreset } from "@/lib/types";

import { defaultForm, type FormState, PATTERN_KINDS } from "./presetFormUtils";

type Props = {
  mode: "create" | "edit";
  initialForm?: FormState;
  excludePresetId?: number;
  presets: LedPreset[] | undefined;
  isMutating: boolean;
  error: Error | null;
  onSubmit: (form: FormState) => void;
  onClose: () => void;
};

export default function PresetFormCard({
  mode,
  initialForm,
  excludePresetId,
  presets,
  isMutating,
  error,
  onSubmit,
  onClose,
}: Props) {
  const [form, setForm] = useState<FormState>(initialForm ?? defaultForm);

  function handleKindChange(kind: Exclude<LedPatternKind, "off">) {
    setForm((f) => ({
      ...f,
      kind,
      colours: kind === "solid" ? f.colours.slice(0, 1) : f.colours,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSubmit(form);
  }

  const copyablePresets = (presets ?? []).filter(
    (p) => p.pattern.colours.length > 0 && p.id !== excludePresetId,
  );

  return (
    <div
      className="dashboard-card"
      style={{ display: "flex", flexDirection: "column", gap: "10px" }}
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "10px" }}
      >
        {/* Name */}
        <input
          className="dash-input"
          placeholder="Preset name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          autoFocus
          style={{ fontSize: "14px", fontWeight: 600 }}
        />

        {/* Kind dropdown */}
        <select
          className="dash-input"
          value={form.kind}
          onChange={(e) =>
            handleKindChange(e.target.value as Exclude<LedPatternKind, "off">)
          }
          style={{ fontSize: "12px" }}
        >
          {PATTERN_KINDS.map((k) => (
            <option key={k} value={k}>
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </option>
          ))}
        </select>

        {/* Colour swatches */}
        {form.kind !== "rainbow" && (
          <ColourSwatchList
            colours={form.colours}
            onChange={(colours) => setForm({ ...form, colours })}
            maxColours={form.kind === "solid" ? 1 : undefined}
          />
        )}

        {/* Copy colours from */}
        {form.kind !== "rainbow" && copyablePresets.length > 0 && (
          <select
            className="dash-input"
            style={{ fontSize: "12px" }}
            value=""
            onChange={(e) => {
              const src = presets?.find((p) => p.id === Number(e.target.value));
              if (src && src.pattern.colours.length > 0) {
                const colours =
                  form.kind === "solid"
                    ? src.pattern.colours.slice(0, 1)
                    : src.pattern.colours;
                setForm({ ...form, colours });
              }
            }}
          >
            <option value="">Copy colours from…</option>
            {copyablePresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        {/* Interval slider — shown in ms for fine control */}
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
            <span>Interval</span>
            <span>{form.interval_ms}ms</span>
          </label>
          <input
            type="range"
            min={200}
            max={10000}
            step={100}
            value={form.interval_ms}
            onChange={(e) =>
              setForm({ ...form, interval_ms: parseInt(e.target.value, 10) })
            }
            style={{ width: "100%" }}
          />
        </div>

        {error && (
          <p
            style={{
              color: "var(--dash-danger)",
              margin: 0,
              fontSize: "12px",
            }}
          >
            {error.message}
          </p>
        )}

        {/* Action buttons — mirrors preset card button row */}
        <div
          style={{
            display: "flex",
            gap: "6px",
            marginTop: "auto",
            flexWrap: "wrap",
          }}
        >
          <button
            type="submit"
            className="dashboard-btn icon-btn power-on"
            disabled={isMutating || !form.name.trim()}
            title={mode === "edit" ? "Update preset" : "Save preset"}
            aria-label={mode === "edit" ? "Update preset" : "Save preset"}
          >
            ✓
          </button>
          <button
            type="button"
            className="dashboard-btn icon-btn danger"
            onClick={onClose}
            title="Cancel"
            aria-label="Cancel"
          >
            ✕
          </button>
        </div>
      </form>
    </div>
  );
}
