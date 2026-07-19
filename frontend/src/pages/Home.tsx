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

  // Sort state
  type SortField = "name" | "pattern";
  const [sortBy, setSortBy] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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

  // Sorted presets
  const sortedPresets = presets ? [...presets].sort((a, b) => {
    if (!sortBy) return 0;
    const av = sortBy === "name" ? a.name : a.pattern.kind;
    const bv = sortBy === "name" ? b.name : b.pattern.kind;
    const cmp = av.localeCompare(bv);
    return sortDir === "asc" ? cmp : -cmp;
  }) : presets;

  function handleSortClick(field: SortField) {
    if (sortBy === field) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortBy(null); setSortDir("asc"); }
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  }

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
      <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "0 0 16px", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Presets</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
          <span style={{ fontSize: "12px", color: "var(--dash-text-muted)", whiteSpace: "nowrap" }}>Sort by</span>
          {(["name", "pattern"] as const).map((field) => {
            const active = sortBy === field;
            return (
              <button
                key={field}
                className={`dashboard-btn sort-btn${active ? " sort-btn-active" : " secondary"}`}
                onClick={() => handleSortClick(field)}
                title={active ? (sortDir === "asc" ? "Sorted A→Z, click for Z→A" : "Sorted Z→A, click to clear") : `Sort by ${field}`}
              >
                {field.charAt(0).toUpperCase() + field.slice(1)}
                {active && <span style={{ marginLeft: "4px" }}>{sortDir === "asc" ? "↑" : "↓"}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        {sortedPresets?.map((preset) => {
          const isActive = state?.preset_id === preset.id;
          return (
            <PresetCard
              key={preset.id}
              preset={preset}
              active={isActive}
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
              activeControls={
                isActive
                  ? {
                      draftColours,
                      brightness,
                      isOn,
                      isDirty,
                      isSavingDraft: saveDraftMutation.isPending,
                      isTurningOff: offMutation.isPending,
                      isApplying: applyMutation.isPending,
                      canTurnOn: !!state?.preset_id,
                      onDraftColourChange: handleDraftColourChange,
                      onRevert: handleRevert,
                      onBrightnessChange: handleBrightnessChange,
                      onBrightnessCommit: handleBrightnessCommit,
                      onSaveDraft: handleSaveDraft,
                      onTurnOn: () => {
                        if (state?.preset_id)
                          applyMutation.mutate(state.preset_id);
                      },
                      onTurnOff: () => offMutation.mutate(),
                    }
                  : undefined
              }
            />
          );
        })}
        {formMode.mode === "none" && (
          <div
            className="dashboard-card new-preset-card"
            role="button"
            tabIndex={0}
            onClick={openCreate}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") openCreate();
            }}
            aria-label="Create new preset"
          >
            <span style={{ fontSize: "28px", lineHeight: 1 }}>+</span>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>New Preset</span>
          </div>
        )}
      </div>
    </>
  );
}
