import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";

import { createMapping, deleteMapping, listMappings, testMapping } from "@/lib/api";
import type { PinMapping } from "@/lib/types";

type FormState = {
  name: string;
  red_pin: string;
  green_pin: string;
  blue_pin: string;
};

const emptyForm: FormState = { name: "", red_pin: "", green_pin: "", blue_pin: "" };

export default function Mappings() {
  const qc = useQueryClient();

  const { data: mappings, isLoading } = useQuery({
    queryKey: ["mappings"],
    queryFn: listMappings,
  });

  const [form, setForm] = useState<FormState>(emptyForm);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [testError, setTestError] = useState<string | null>(null);
  const testTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (testTimerRef.current) clearTimeout(testTimerRef.current);
    try {
      await testMapping(parsePins());
      setTestStatus("ok");
    } catch (e) {
      setTestStatus("error");
      setTestError(e instanceof Error ? e.message : "Test failed");
    }
  }

  function handleSave() {
    if (!form.name.trim() || !pinsValid()) return;
    createMutation.mutate({
      name: form.name.trim(),
      ...parsePins(),
    } as Omit<PinMapping, "id">);
  }

  return (
    <div className="dashboard-page" style={{ padding: "32px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <h1 style={{ margin: 0, fontSize: "28px" }}>Pin Mappings</h1>
        <nav style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <Link to="/home" className="nav-link">Dashboard</Link>
        </nav>
      </header>

      <section className="dashboard-card" style={{ marginBottom: "32px" }}>
        <h2 style={{ marginTop: 0, marginBottom: "16px" }}>Add Mapping</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          <input
            className="dash-input"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            className="dash-input"
            type="number"
            placeholder="Red pin (BCM)"
            value={form.red_pin}
            onChange={(e) => { setForm((f) => ({ ...f, red_pin: e.target.value })); setTestStatus("idle"); }}
          />
          <input
            className="dash-input"
            type="number"
            placeholder="Green pin (BCM)"
            value={form.green_pin}
            onChange={(e) => { setForm((f) => ({ ...f, green_pin: e.target.value })); setTestStatus("idle"); }}
          />
          <input
            className="dash-input"
            type="number"
            placeholder="Blue pin (BCM)"
            value={form.blue_pin}
            onChange={(e) => { setForm((f) => ({ ...f, blue_pin: e.target.value })); setTestStatus("idle"); }}
          />
        </div>

        {testError && <p style={{ color: "var(--dash-danger)", margin: "0 0 12px" }}>{testError}</p>}
        {createMutation.error && (
          <p style={{ color: "var(--dash-danger)", margin: "0 0 12px" }}>
            {createMutation.error.message}
          </p>
        )}

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button
            className="dashboard-btn"
            onClick={handleTest}
            disabled={!pinsValid() || testStatus === "testing"}
          >
            {testStatus === "testing" ? "Testing…" : "Test LED"}
          </button>
          {testStatus === "ok" && (
            <span style={{ color: "var(--dash-success)", fontSize: "14px" }}>
              ✓ LED cycled successfully
            </span>
          )}
          <button
            className="dashboard-btn"
            onClick={handleSave}
            disabled={testStatus !== "ok" || !form.name.trim() || createMutation.isPending}
            style={{ marginLeft: "auto" }}
          >
            {createMutation.isPending ? "Saving…" : "Save Mapping"}
          </button>
        </div>
      </section>

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
                  <button
                    className="dashboard-btn danger"
                    onClick={() => deleteMutation.mutate(m.id!)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
