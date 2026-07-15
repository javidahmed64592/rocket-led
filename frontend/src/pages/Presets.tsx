import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import ColourSwatchList from "@/lib/components/ColourSwatchList";
import { createPreset, deletePreset, listPresets } from "@/lib/api";
import type { LedPatternKind, LedPreset, RgbColour } from "@/lib/types";

const PATTERN_KINDS: Exclude<LedPatternKind, "off">[] = [
  "solid",
  "pulse",
  "blink",
  "gradient",
  "rainbow",
];

type FormState = {
  name: string;
  kind: Exclude<LedPatternKind, "off">;
  colours: RgbColour[];
  interval_ms: number;
};

const defaultForm: FormState = {
  name: "",
  kind: "solid",
  colours: [{ r: 255, g: 255, b: 255 }],
  interval_ms: 1000,
};

export default function Presets() {
  const qc = useQueryClient();

  const { data: presets, isLoading } = useQuery({
    queryKey: ["presets"],
    queryFn: listPresets,
  });

  const [form, setForm] = useState<FormState>(defaultForm);

  const createMutation = useMutation({
    mutationFn: createPreset,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["presets"] });
      setForm(defaultForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePreset,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["presets"] }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const preset: Omit<LedPreset, "id"> = {
      name: form.name.trim(),
      pattern: {
        kind: form.kind,
        colours: form.kind === "rainbow" ? [] : form.colours,
        interval_ms: form.interval_ms,
      },
    };
    createMutation.mutate(preset);
  }

  return (
    <div className="dashboard-page" style={{ padding: "32px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <h1 style={{ margin: 0, fontSize: "28px" }}>Presets</h1>
        <nav style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <Link to="/home" className="nav-link">Dashboard</Link>
          <Link to="/mappings" className="nav-link">Mappings</Link>
        </nav>
      </header>

      <section className="dashboard-card" style={{ marginBottom: "32px" }}>
        <h2 style={{ marginTop: 0, marginBottom: "16px" }}>Create Preset</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
            <input
              className="dash-input"
              placeholder="Preset name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              style={{ flex: "1 1 160px" }}
            />
            <select
              className="dash-input"
              value={form.kind}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  kind: e.target.value as Exclude<LedPatternKind, "off">,
                }))
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
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", color: "var(--dash-text-muted)" }}>
                Colours
              </label>
              <ColourSwatchList
                colours={form.colours}
                onChange={(colours) => setForm((f) => ({ ...f, colours }))}
              />
            </div>
          )}

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", color: "var(--dash-text-muted)" }}>
              Interval: {form.interval_ms}ms ({(form.interval_ms / 1000).toFixed(1)}s)
            </label>
            <input
              type="range"
              min={200}
              max={10000}
              step={100}
              value={form.interval_ms}
              onChange={(e) =>
                setForm((f) => ({ ...f, interval_ms: parseInt(e.target.value, 10) }))
              }
              style={{ width: "100%", maxWidth: "400px" }}
            />
          </div>

          {createMutation.error && (
            <p style={{ color: "var(--dash-danger)", margin: "0 0 12px" }}>
              {createMutation.error.message}
            </p>
          )}

          <button
            type="submit"
            className="dashboard-btn"
            disabled={createMutation.isPending || !form.name.trim()}
          >
            {createMutation.isPending ? "Saving…" : "Save Preset"}
          </button>
        </form>
      </section>

      <h2 style={{ marginBottom: "16px" }}>Existing Presets</h2>
      {isLoading ? (
        <p style={{ color: "var(--dash-text-muted)" }}>Loading…</p>
      ) : !presets || presets.length === 0 ? (
        <p style={{ color: "var(--dash-text-muted)" }}>No presets yet.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px" }}>
          {presets.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              onDelete={() => deleteMutation.mutate(preset.id!)}
              deleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PresetCard({
  preset,
  onDelete,
  deleting,
}: {
  preset: LedPreset;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="dashboard-card" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {preset.pattern.kind === "rainbow" ? (
          <span
            style={{
              display: "inline-block",
              width: "100%",
              height: "18px",
              borderRadius: "4px",
              background: "linear-gradient(to right, red, orange, yellow, green, cyan, blue, violet)",
            }}
          />
        ) : (
          preset.pattern.colours.map((c, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                background: `rgb(${c.r},${c.g},${c.b})`,
                border: "1px solid var(--dash-border)",
              }}
            />
          ))
        )}
      </div>
      <strong style={{ fontSize: "14px" }}>{preset.name}</strong>
      <span style={{ fontSize: "12px", color: "var(--dash-text-muted)" }}>
        {preset.pattern.kind} · {preset.pattern.interval_ms}ms
      </span>
      <button
        className="dashboard-btn danger"
        style={{ marginTop: "auto" }}
        onClick={onDelete}
        disabled={deleting}
      >
        Delete
      </button>
    </div>
  );
}
