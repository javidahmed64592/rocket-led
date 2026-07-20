import {
  type MappingFormState,
  pinsValid,
  type TestStatus,
} from "./mappingFormUtils";

type Props = {
  form: MappingFormState;
  testStatus: TestStatus;
  testError: string | null;
  isSaving: boolean;
  canSave: boolean;
  isEdit: boolean;
  saveError: string | null;
  onChange: (updates: Partial<MappingFormState>) => void;
  onTest: () => void;
  onSave: () => void;
  onCancel?: () => void;
};

export default function MappingForm({
  form,
  testStatus,
  testError,
  isSaving,
  canSave,
  isEdit,
  saveError,
  onChange,
  onTest,
  onSave,
  onCancel,
}: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <input
        className="dash-input"
        placeholder="Name"
        value={form.name}
        onChange={(e) => onChange({ name: e.target.value })}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "8px",
        }}
      >
        <input
          className="dash-input"
          type="number"
          placeholder="Red"
          value={form.red_pin}
          onChange={(e) => onChange({ red_pin: e.target.value })}
        />
        <input
          className="dash-input"
          type="number"
          placeholder="Green"
          value={form.green_pin}
          onChange={(e) => onChange({ green_pin: e.target.value })}
        />
        <input
          className="dash-input"
          type="number"
          placeholder="Blue"
          value={form.blue_pin}
          onChange={(e) => onChange({ blue_pin: e.target.value })}
        />
      </div>

      {testError && (
        <p style={{ color: "var(--dash-danger)", margin: 0, fontSize: "13px" }}>
          {testError}
        </p>
      )}
      {saveError && (
        <p style={{ color: "var(--dash-danger)", margin: 0, fontSize: "13px" }}>
          {saveError}
        </p>
      )}

      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          className="dashboard-btn"
          onClick={onTest}
          disabled={!pinsValid(form) || testStatus === "testing"}
        >
          {testStatus === "testing" ? "Testing…" : "Test"}
        </button>
        {testStatus === "ok" && (
          <span
            style={{
              color: "var(--dash-success)",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            ✓ OK
          </span>
        )}
        {isEdit && onCancel && (
          <button
            className="dashboard-btn secondary"
            onClick={onCancel}
            style={{ marginLeft: "auto" }}
          >
            Cancel
          </button>
        )}
        <button
          className="dashboard-btn"
          onClick={onSave}
          disabled={!canSave}
          style={!isEdit ? { marginLeft: "auto" } : {}}
        >
          {isSaving ? "Saving…" : isEdit ? "Update" : "Save"}
        </button>
      </div>
    </div>
  );
}
