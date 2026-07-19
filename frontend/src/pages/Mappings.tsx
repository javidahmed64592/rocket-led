import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  createMapping,
  deleteMapping,
  listMappings,
  testMapping,
  updateMapping,
} from "@/lib/api";
import MappingCard from "@/lib/components/MappingCard";
import MappingForm, {
  emptyMappingForm,
  parsePins,
  pinsValid,
  type MappingFormState,
  type TestStatus,
} from "@/lib/components/MappingForm";
import type { PinMapping } from "@/lib/types";

export default function Mappings() {
  const qc = useQueryClient();

  const { data: mappings } = useQuery({
    queryKey: ["mappings"],
    queryFn: listMappings,
  });

  // Create form state
  const [createForm, setCreateForm] =
    useState<MappingFormState>(emptyMappingForm);
  const [createTestStatus, setCreateTestStatus] = useState<TestStatus>("idle");
  const [createTestError, setCreateTestError] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<MappingFormState>(emptyMappingForm);
  const [editTestStatus, setEditTestStatus] = useState<TestStatus>("idle");
  const [editTestError, setEditTestError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: deleteMapping,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mappings"] }),
  });

  const createMutation = useMutation({
    mutationFn: createMapping,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mappings"] });
      setCreateForm(emptyMappingForm);
      setCreateTestStatus("idle");
      setCreateTestError(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      mapping,
    }: {
      id: number;
      mapping: Omit<PinMapping, "id">;
    }) => updateMapping(id, mapping),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mappings"] });
      setEditingId(null);
      setEditForm(emptyMappingForm);
      setEditTestStatus("idle");
      setEditTestError(null);
    },
  });

  const testRowMutation = useMutation({
    mutationFn: (id: number) => testMapping({ id }),
  });

  // Handlers — create
  async function handleCreateTest() {
    if (!pinsValid(createForm)) return;
    setCreateTestStatus("testing");
    setCreateTestError(null);
    try {
      await testMapping(parsePins(createForm));
      setCreateTestStatus("ok");
    } catch (e) {
      setCreateTestStatus("error");
      setCreateTestError(e instanceof Error ? e.message : "Test failed");
    }
  }

  function handleCreate() {
    if (!createForm.name.trim() || !pinsValid(createForm)) return;
    createMutation.mutate({
      name: createForm.name.trim(),
      ...parsePins(createForm),
    } as Omit<PinMapping, "id">);
  }

  function handleCreateFormChange(updates: Partial<MappingFormState>) {
    setCreateForm((f) => ({ ...f, ...updates }));
    if (
      updates.red_pin !== undefined ||
      updates.green_pin !== undefined ||
      updates.blue_pin !== undefined
    ) {
      setCreateTestStatus("idle");
      setCreateTestError(null);
    }
  }

  // Handlers — edit
  async function handleEditTest() {
    if (!pinsValid(editForm)) return;
    setEditTestStatus("testing");
    setEditTestError(null);
    try {
      await testMapping(parsePins(editForm));
      setEditTestStatus("ok");
    } catch (e) {
      setEditTestStatus("error");
      setEditTestError(e instanceof Error ? e.message : "Test failed");
    }
  }

  function handleSaveEdit() {
    if (!editingId || !editForm.name.trim() || !pinsValid(editForm)) return;
    updateMutation.mutate({
      id: editingId,
      mapping: {
        name: editForm.name.trim(),
        ...parsePins(editForm),
      } as Omit<PinMapping, "id">,
    });
  }

  function handleEditFormChange(updates: Partial<MappingFormState>) {
    setEditForm((f) => ({ ...f, ...updates }));
    if (
      updates.red_pin !== undefined ||
      updates.green_pin !== undefined ||
      updates.blue_pin !== undefined
    ) {
      setEditTestStatus("idle");
      setEditTestError(null);
    }
  }

  function openEdit(mapping: PinMapping) {
    setEditingId(mapping.id!);
    setEditForm({
      name: mapping.name,
      red_pin: String(mapping.red_pin),
      green_pin: String(mapping.green_pin),
      blue_pin: String(mapping.blue_pin),
    });
    setEditTestStatus("ok"); // saved mapping already has proven pins
    setEditTestError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyMappingForm);
    setEditTestStatus("idle");
    setEditTestError(null);
  }

  const canCreate =
    !!createForm.name.trim() &&
    pinsValid(createForm) &&
    createTestStatus === "ok" &&
    !createMutation.isPending;

  const canSaveEdit =
    !!editForm.name.trim() &&
    pinsValid(editForm) &&
    editTestStatus === "ok" &&
    !updateMutation.isPending;

  return (
    <>
      <h1 style={{ margin: "0 0 32px" }}>Pin Mappings</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "16px",
        }}
      >
        {mappings?.map((m) => (
          <MappingCard
            key={m.id}
            mapping={m}
            isEditing={editingId === m.id}
            isDeleting={deleteMutation.isPending}
            isTesting={testRowMutation.isPending}
            editForm={editingId === m.id ? editForm : undefined}
            editTestStatus={editTestStatus}
            editTestError={editTestError}
            isSavingEdit={updateMutation.isPending}
            canSaveEdit={canSaveEdit}
            saveError={updateMutation.error?.message ?? null}
            onEdit={() => openEdit(m)}
            onDelete={() => deleteMutation.mutate(m.id!)}
            onTestRow={() => testRowMutation.mutate(m.id!)}
            onCancelEdit={cancelEdit}
            onEditFormChange={handleEditFormChange}
            onEditTest={handleEditTest}
            onSaveEdit={handleSaveEdit}
          />
        ))}

        {/* Add Mapping card — always visible */}
        <div
          className="dashboard-card"
          style={{ display: "flex", flexDirection: "column", gap: "12px" }}
        >
          <strong style={{ fontSize: "14px" }}>Add Mapping</strong>
          <MappingForm
            form={createForm}
            testStatus={createTestStatus}
            testError={createTestError}
            isSaving={createMutation.isPending}
            canSave={canCreate}
            isEdit={false}
            saveError={createMutation.error?.message ?? null}
            onChange={handleCreateFormChange}
            onTest={handleCreateTest}
            onSave={handleCreate}
          />
        </div>
      </div>
    </>
  );
}
