import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import {
  createMapping,
  deleteMapping,
  listMappings,
  testMapping,
  updateMapping,
} from "@/lib/api";
import PageHeader from "@/lib/components/PageHeader";
import type { PinMapping } from "@/lib/types";

type FormState = {
  name: string;
  red_pin: string;
  green_pin: string;
  blue_pin: string;
};

const emptyForm: FormState = {
  name: "",
  red_pin: "",
  green_pin: "",
  blue_pin: "",
};

type FormMode = { mode: "create" } | { mode: "edit"; mapping: PinMapping };

export default function Mappings() {
  const qc = useQueryClient();

  const { data: mappings, isLoading } = useQuery({
    queryKey: ["mappings"],
    queryFn: listMappings,
  });

  const [formMode, setFormMode] = useState<FormMode>({ mode: "create" });
  const [form, setForm] = useState<FormState>(emptyForm);
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "ok" | "error"
  >("idle");
  const [testError, setTestError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: deleteMapping,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mappings"] }),
  });

  const createMutation = useMutation({
    mutationFn: createMapping,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mappings"] });
      setForm(emptyForm);
      setTestStatus("idle");
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
      setForm(emptyForm);
      setFormMode({ mode: "create" });
      setTestStatus("idle");
    },
  });

  const testRowMutation = useMutation({
    mutationFn: (id: number) => testMapping({ id }),
  });

  function parsePins() {
    return {
      red_pin: parseInt(form.red_pin, 10),
      green_pin: parseInt(form.green_pin, 10),
      blue_pin: parseInt(form.blue_pin, 10),
    };
  }

  function pinsValid() {
    const { red_pin, green_pin, blue_pin } = parsePins();
    return !isNaN(red_pin) && !isNaN(green_pin) && !isNaN(blue_pin);
  }

  async function handleTest() {
    if (!pinsValid()) return;
    setTestStatus("testing");
    setTestError(null);
    try {
      await testMapping({ ...parsePins() });
      setTestStatus("ok");
    } catch (e) {
      setTestStatus("error");
      setTestError(e instanceof Error ? e.message : "Test failed");
    }
  }

  function handleSave() {
    if (!form.name.trim() || !pinsValid()) return;
    const mappingData = {
      name: form.name.trim(),
      ...parsePins(),
    } as Omit<PinMapping, "id">;
    if (formMode.mode === "edit") {
      updateMutation.mutate({ id: formMode.mapping.id!, mapping: mappingData });
    } else {
      createMutation.mutate(mappingData);
    }
  }

  function openEdit(mapping: PinMapping) {
    setForm({
      name: mapping.name,
      red_pin: String(mapping.red_pin),
      green_pin: String(mapping.green_pin),
      blue_pin: String(mapping.blue_pin),
    });
    setFormMode({ mode: "edit", mapping });
    setTestStatus("ok"); // saved mapping already has proven pins
    setTestError(null);
  }

  function cancelEdit() {
    setForm(emptyForm);
    setFormMode({ mode: "create" });
    setTestStatus("idle");
    setTestError(null);
  }

  const canSave =
    !!form.name.trim() &&
    pinsValid() &&
    (formMode.mode === "edit" || testStatus === "ok") &&
    !createMutation.isPending &&
    !updateMutation.isPending;

  return (
    <div className="dashboard-page" style={{ padding: "32px" }}>
      <PageHeader title="Pin Mappings">
        <Link to="/home" className="nav-link">
          Dashboard
        </Link>
      </PageHeader>

      {/* Add / Edit form */}
      <section
        className="dashboard-card"
        style={{ marginBottom: "32px", maxWidth: "400px" }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "16px" }}>
          {formMode.mode === "edit" ? "Edit Mapping" : "Add Mapping"}
        </h2>

        <div style={{ marginBottom: "12px" }}>
          <input
            className="dash-input"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <input
            className="dash-input"
            type="number"
            placeholder="Red pin"
            value={form.red_pin}
            onChange={(e) => {
              setForm((f) => ({ ...f, red_pin: e.target.value }));
              setTestStatus("idle");
            }}
          />
          <input
            className="dash-input"
            type="number"
            placeholder="Green pin"
            value={form.green_pin}
            onChange={(e) => {
              setForm((f) => ({ ...f, green_pin: e.target.value }));
              setTestStatus("idle");
            }}
          />
          <input
            className="dash-input"
            type="number"
            placeholder="Blue pin"
            value={form.blue_pin}
            onChange={(e) => {
              setForm((f) => ({ ...f, blue_pin: e.target.value }));
              setTestStatus("idle");
            }}
          />
        </div>

        {testError && (
          <p style={{ color: "var(--dash-danger)", margin: "0 0 12px" }}>
            {testError}
          </p>
        )}
        {(createMutation.error || updateMutation.error) && (
          <p style={{ color: "var(--dash-danger)", margin: "0 0 12px" }}>
            {(createMutation.error ?? updateMutation.error)?.message}
          </p>
        )}

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            className="dashboard-btn"
            onClick={handleTest}
            disabled={!pinsValid() || testStatus === "testing"}
          >
            {testStatus === "testing" ? "Testing…" : "Test"}
          </button>
          {testStatus === "ok" && (
            <span style={{ color: "var(--dash-success)", fontSize: "14px" }}>
              ✓ OK
            </span>
          )}
          {formMode.mode === "edit" && (
            <button
              className="dashboard-btn secondary"
              onClick={cancelEdit}
              style={{ marginLeft: "auto" }}
            >
              Cancel
            </button>
          )}
          <button
            className="dashboard-btn"
            onClick={handleSave}
            disabled={!canSave}
            style={formMode.mode === "create" ? { marginLeft: "auto" } : {}}
          >
            {createMutation.isPending || updateMutation.isPending
              ? "Saving…"
              : formMode.mode === "edit"
                ? "Update Mapping"
                : "Save Mapping"}
          </button>
        </div>
      </section>

      {/* Existing mappings */}
      <h2 style={{ marginBottom: "16px" }}>Existing Mappings</h2>
      {isLoading ? (
        <p style={{ color: "var(--dash-text-muted)" }}>Loading…</p>
      ) : !mappings || mappings.length === 0 ? (
        <p style={{ color: "var(--dash-text-muted)" }}>No mappings yet.</p>
      ) : (
        <table className="dash-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Red pin</th>
              <th>Green pin</th>
              <th>Blue pin</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {mappings.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.red_pin}</td>
                <td>{m.green_pin}</td>
                <td>{m.blue_pin}</td>
                <td>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      className="dashboard-btn icon-btn"
                      onClick={() => openEdit(m)}
                      title="Edit mapping"
                      aria-label="Edit mapping"
                    >
                      ✏
                    </button>
                    <button
                      className="dashboard-btn icon-btn"
                      onClick={() => testRowMutation.mutate(m.id!)}
                      disabled={testRowMutation.isPending}
                      title="Test this mapping (pauses active pattern)"
                      aria-label="Test mapping"
                    >
                      ⚡
                    </button>
                    <button
                      className="dashboard-btn icon-btn danger"
                      onClick={() => deleteMutation.mutate(m.id!)}
                      disabled={deleteMutation.isPending}
                      title="Delete mapping"
                      aria-label="Delete mapping"
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
