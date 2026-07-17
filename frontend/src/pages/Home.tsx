import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  applyPreset,
  createPreset,
  deletePreset,
  getState,
  listPresets,
  logout,
  previewPattern,
  turnOff,
  updatePreset,
} from "@/lib/api";
import ColourSwatchList from "@/lib/components/ColourSwatchList";
import type {
  LedPattern,
  LedPatternKind,
  LedPreset,
  RgbColour,
} from "@/lib/types";

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

type FormMode =
  { mode: "none" } | { mode: "create" } | { mode: "edit"; preset: LedPreset };

function patternToForm(preset: LedPreset): FormState {
  return {
    name: preset.name,
    kind: preset.pattern.kind as Exclude<LedPatternKind, "off">,
    colours:
      preset.pattern.colours.length > 0
        ? preset.pattern.colours
        : [{ r: 255, g: 255, b: 255 }],
    interval_ms: preset.pattern.interval_ms,
  };
}

function PatternPreview({ pattern }: { pattern: LedPattern }) {
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

export default function Home() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Queries
  const { data: state } = useQuery({ queryKey: ["state"], queryFn: getState });
  const { data: presets } = useQuery({
    queryKey: ["presets"],
    queryFn: listPresets,
  });

  // Mutations
  const applyMutation = useMutation({
    mutationFn: applyPreset,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["state"] }),
  });
  const offMutation = useMutation({
    mutationFn: turnOff,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["state"] }),
  });
  const createMutation = useMutation({
    mutationFn: createPreset,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["presets"] });
      setFormMode({ mode: "none" });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      preset,
    }: {
      id: number;
      preset: Omit<LedPreset, "id">;
    }) => updatePreset(id, preset),
    onSuccess: (result, variables) => {
      qc.invalidateQueries({ queryKey: ["presets"] });
      setFormMode({ mode: "none" });
      // If we just updated the active preset, sync the draft to new colours
      if (result.id != null && result.id === lastLoadedPresetIdRef.current) {
        setDraftColours(variables.preset.pattern.colours);
      }
    },
  });
  const saveDraftMutation = useMutation({
    mutationFn: ({
      id,
      preset,
    }: {
      id: number;
      preset: Omit<LedPreset, "id">;
    }) => updatePreset(id, preset),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["presets"] }),
  });
  const previewMutation = useMutation({ mutationFn: previewPattern });
  const deleteMutation = useMutation({
    mutationFn: deletePreset,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["presets"] });
      qc.invalidateQueries({ queryKey: ["state"] });
    },
  });

  // Form state
  const [formMode, setFormMode] = useState<FormMode>({ mode: "none" });
  const [form, setForm] = useState<FormState>(defaultForm);

  // Active-state card draft colours
  const [draftColours, setDraftColours] = useState<RgbColour[] | null>(null);
  const lastLoadedPresetIdRef = useRef<number | null | undefined>(undefined);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived state
  const activePreset = presets?.find((p) => p.id === state?.preset_id) ?? null;
  const isOn = state?.source !== "off" && state?.preset_id != null;
  const isDirty =
    draftColours != null &&
    activePreset != null &&
    JSON.stringify(draftColours) !==
      JSON.stringify(activePreset.pattern.colours);

  // Reset draft when the active preset changes (different preset_id)
  useEffect(() => {
    if (state?.preset_id !== lastLoadedPresetIdRef.current) {
      lastLoadedPresetIdRef.current = state?.preset_id ?? null;
      setDraftColours(activePreset?.pattern.colours ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.preset_id]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, []);

  // Handlers
  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  function handleKindChange(kind: Exclude<LedPatternKind, "off">) {
    setForm((f) => ({
      ...f,
      kind,
      colours: kind === "solid" ? f.colours.slice(0, 1) : f.colours,
    }));
  }

  function handleFormSubmit(e: React.FormEvent) {
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
    if (formMode.mode === "edit" && formMode.preset.id != null) {
      updateMutation.mutate({ id: formMode.preset.id, preset });
    } else {
      createMutation.mutate(preset);
    }
  }

  function handleDraftColourChange(colours: RgbColour[]) {
    setDraftColours(colours);
    if (activePreset) {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      previewTimerRef.current = setTimeout(() => {
        previewMutation.mutate({ ...activePreset.pattern, colours });
      }, 100);
    }
  }

  function handleRevert() {
    if (!activePreset) return;
    setDraftColours(activePreset.pattern.colours);
    previewMutation.mutate(activePreset.pattern);
  }

  function handleSaveDraft() {
    if (!activePreset?.id || !draftColours) return;
    saveDraftMutation.mutate({
      id: activePreset.id,
      preset: {
        name: activePreset.name,
        pattern: { ...activePreset.pattern, colours: draftColours },
      },
    });
  }

  function openEdit(preset: LedPreset) {
    setForm(patternToForm(preset));
    setFormMode({ mode: "edit", preset });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openCreate() {
    setForm(defaultForm);
    setFormMode({ mode: "create" });
  }

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="dashboard-page" style={{ padding: "32px" }}>
      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "32px",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "28px" }}>rocket-led</h1>
        <nav style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <Link to="/mappings" className="nav-link">
            Mappings
          </Link>
          <button className="dashboard-btn" onClick={handleLogout}>
            Log out
          </button>
        </nav>
      </header>

      {/* Active-state card */}
      <div style={{ marginBottom: "32px" }}>
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
            <strong
              style={{ fontSize: "13px", color: "var(--dash-text-muted)" }}
            >
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
              onChange={handleDraftColourChange}
            />
          ) : null}

          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {isDirty && (
              <>
                <button
                  className="dashboard-btn"
                  style={{ fontSize: "12px", padding: "6px 12px" }}
                  onClick={handleSaveDraft}
                  disabled={saveDraftMutation.isPending}
                >
                  Save
                </button>
                <button
                  className="dashboard-btn secondary"
                  style={{ fontSize: "12px", padding: "6px 12px" }}
                  onClick={handleRevert}
                >
                  Revert
                </button>
              </>
            )}
            {isOn ? (
              <button
                className="dashboard-btn danger"
                style={{ fontSize: "12px", padding: "6px 12px" }}
                onClick={() => offMutation.mutate()}
                disabled={offMutation.isPending}
              >
                {offMutation.isPending ? "Turning off…" : "Turn Off"}
              </button>
            ) : (
              <button
                className="dashboard-btn"
                style={{ fontSize: "12px", padding: "6px 12px" }}
                onClick={() => {
                  if (state?.preset_id) applyMutation.mutate(state.preset_id);
                }}
                disabled={!state?.preset_id || applyMutation.isPending}
              >
                Turn On
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Create / Edit form */}
      {formMode.mode !== "none" && (
        <section
          className="dashboard-card"
          style={{ marginBottom: "32px", maxWidth: "500px" }}
        >
          <h2 style={{ marginTop: 0, marginBottom: "16px" }}>
            {formMode.mode === "edit" ? "Edit Preset" : "New Preset"}
          </h2>
          <form onSubmit={handleFormSubmit}>
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
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
                autoFocus
                style={{ flex: "1 1 160px" }}
              />
              <select
                className="dash-input"
                value={form.kind}
                onChange={(e) =>
                  handleKindChange(
                    e.target.value as Exclude<LedPatternKind, "off">
                  )
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
                  onChange={(colours) => setForm((f) => ({ ...f, colours }))}
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
                        setForm((f) => ({ ...f, colours }));
                      }
                    }}
                  >
                    <option value="">— pick a preset —</option>
                    {presets
                      .filter(
                        (p) =>
                          formMode.mode !== "edit" ||
                          p.id !== formMode.preset.id
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
                  setForm((f) => ({
                    ...f,
                    interval_ms: parseInt(e.target.value, 10),
                  }))
                }
                style={{ width: "100%", maxWidth: "400px" }}
              />
            </div>

            {(createMutation.error || updateMutation.error) && (
              <p style={{ color: "var(--dash-danger)", margin: "0 0 12px" }}>
                {(createMutation.error ?? updateMutation.error)?.message}
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
                onClick={() => setFormMode({ mode: "none" })}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Preset list */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <h2 style={{ margin: 0 }}>Presets</h2>
        {formMode.mode === "none" && (
          <button className="dashboard-btn" onClick={openCreate}>
            + New Preset
          </button>
        )}
      </div>

      {!presets || presets.length === 0 ? (
        <p style={{ color: "var(--dash-text-muted)" }}>
          No presets yet. Click "+ New Preset" to create one.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "16px",
          }}
        >
          {presets.map((preset) => {
            const active = state?.preset_id === preset.id;
            return (
              <div
                key={preset.id}
                className={`dashboard-card${active ? " active-preset" : ""}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <PatternPreview pattern={preset.pattern} />
                <strong style={{ fontSize: "14px" }}>{preset.name}</strong>
                <span
                  style={{ fontSize: "12px", color: "var(--dash-text-muted)" }}
                >
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
                    disabled={active || applyMutation.isPending}
                    onClick={() => applyMutation.mutate(preset.id!)}
                  >
                    {active ? "Active" : "Apply"}
                  </button>
                  <button
                    className="dashboard-btn icon-btn"
                    onClick={() => openEdit(preset)}
                    title="Edit preset"
                    aria-label="Edit preset"
                  >
                    ✏
                  </button>
                  <button
                    className="dashboard-btn icon-btn"
                    onClick={() =>
                      createMutation.mutate({
                        name: `${preset.name} (copy)`,
                        pattern: preset.pattern,
                      })
                    }
                    title="Duplicate preset"
                    aria-label="Duplicate preset"
                    disabled={createMutation.isPending}
                  >
                    ⧉
                  </button>
                  <button
                    className="dashboard-btn icon-btn danger"
                    onClick={() => deleteMutation.mutate(preset.id!)}
                    title="Delete preset"
                    aria-label="Delete preset"
                    disabled={deleteMutation.isPending}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
