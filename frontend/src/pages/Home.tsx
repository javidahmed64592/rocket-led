import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import {
  applyPreset,
  createPreset,
  deletePreset,
  getState,
  listPresets,
  previewPattern,
  setBrightness,
  turnOff,
  updatePreset,
} from "@/lib/api";
import ActiveStateCard from "@/lib/components/ActiveStateCard";
import PresetCard from "@/lib/components/PresetCard";
import PresetForm, {
  defaultForm,
  patternToForm,
  type FormMode,
  type FormState,
} from "@/lib/components/PresetForm";
import type { LedPreset, RgbColour } from "@/lib/types";

export default function Home() {
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
  const previewMutation = useMutation({
    mutationFn: previewPattern,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["state"] }),
  });
  const brightnessMutation = useMutation({ mutationFn: setBrightness });
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

  // Brightness
  const [brightness, setBrightnessLocal] = useState<number>(1.0);
  const brightnessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Sync brightness from server
  useEffect(() => {
    if (state?.brightness !== undefined) {
      setBrightnessLocal(state.brightness);
    }
  }, [state?.brightness]);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      if (brightnessTimerRef.current) clearTimeout(brightnessTimerRef.current);
    };
  }, []);

  // Handlers
  function handleKindChange(kind: FormState["kind"]) {
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

  function handleBrightnessChange(value: number) {
    setBrightnessLocal(value);
    if (brightnessTimerRef.current) clearTimeout(brightnessTimerRef.current);
    brightnessTimerRef.current = setTimeout(() => {
      brightnessMutation.mutate(value);
    }, 175);
  }

  function handleBrightnessCommit(value: number) {
    if (brightnessTimerRef.current) clearTimeout(brightnessTimerRef.current);
    brightnessMutation.mutate(value);
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
  const formError = createMutation.error ?? updateMutation.error ?? null;

  return (
    <>
      {/* Active-state card */}
      <div style={{ marginBottom: "32px" }}>
        <ActiveStateCard
          activePreset={activePreset}
          draftColours={draftColours}
          brightness={brightness}
          isOn={isOn}
          isDirty={isDirty}
          isSavingDraft={saveDraftMutation.isPending}
          isTurningOff={offMutation.isPending}
          isApplying={applyMutation.isPending}
          canTurnOn={!!state?.preset_id}
          onDraftColourChange={handleDraftColourChange}
          onRevert={handleRevert}
          onBrightnessChange={handleBrightnessChange}
          onBrightnessCommit={handleBrightnessCommit}
          onSaveDraft={handleSaveDraft}
          onTurnOn={() => {
            if (state?.preset_id) applyMutation.mutate(state.preset_id);
          }}
          onTurnOff={() => offMutation.mutate()}
        />
      </div>

      {/* Create / Edit form */}
      {formMode.mode !== "none" && (
        <PresetForm
          formMode={formMode}
          form={form}
          presets={presets}
          isMutating={isMutating}
          error={formError}
          onFormChange={setForm}
          onKindChange={handleKindChange}
          onSubmit={handleFormSubmit}
          onClose={() => setFormMode({ mode: "none" })}
        />
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
          {presets.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              active={state?.preset_id === preset.id}
              isApplying={applyMutation.isPending}
              isDuplicating={createMutation.isPending}
              isDeleting={deleteMutation.isPending}
              onApply={() => applyMutation.mutate(preset.id!)}
              onEdit={() => openEdit(preset)}
              onDuplicate={() =>
                createMutation.mutate({
                  name: `${preset.name} (copy)`,
                  pattern: preset.pattern,
                })
              }
              onDelete={() => deleteMutation.mutate(preset.id!)}
            />
          ))}
        </div>
      )}
    </>
  );
}
