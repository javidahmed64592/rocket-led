import MappingForm from "@/lib/components/MappingForm";
import type { MappingFormState, TestStatus } from "@/lib/components/mappingFormUtils";
import type { PinMapping } from "@/lib/types";

type Props = {
  mapping: PinMapping;
  isEditing: boolean;
  isDeleting: boolean;
  isTesting: boolean;
  // edit form — only required when isEditing
  editForm?: MappingFormState;
  editTestStatus?: TestStatus;
  editTestError?: string | null;
  isSavingEdit?: boolean;
  canSaveEdit?: boolean;
  saveError?: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onTestRow: () => void;
  onCancelEdit: () => void;
  onEditFormChange?: (updates: Partial<MappingFormState>) => void;
  onEditTest?: () => void;
  onSaveEdit?: () => void;
};

export default function MappingCard({
  mapping,
  isEditing,
  isDeleting,
  isTesting,
  editForm,
  editTestStatus = "idle",
  editTestError = null,
  isSavingEdit = false,
  canSaveEdit = false,
  saveError = null,
  onEdit,
  onDelete,
  onTestRow,
  onCancelEdit,
  onEditFormChange,
  onEditTest,
  onSaveEdit,
}: Props) {
  return (
    <div
      className={`dashboard-card${isEditing ? " active-preset" : ""}`}
      style={{ display: "flex", flexDirection: "column", gap: "10px" }}
    >
      {isEditing && editForm && onEditFormChange && onEditTest && onSaveEdit ? (
        <>
          <strong
            style={{ fontSize: "13px", color: "var(--dash-text-muted)" }}
          >
            Editing: {mapping.name}
          </strong>
          <MappingForm
            form={editForm}
            testStatus={editTestStatus}
            testError={editTestError}
            isSaving={isSavingEdit}
            canSave={canSaveEdit}
            isEdit={true}
            saveError={saveError}
            onChange={onEditFormChange}
            onTest={onEditTest}
            onSave={onSaveEdit}
            onCancel={onCancelEdit}
          />
        </>
      ) : (
        <>
          <strong style={{ fontSize: "14px" }}>{mapping.name}</strong>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <span className="pin-badge pin-badge--r">R: {mapping.red_pin}</span>
            <span className="pin-badge pin-badge--g">G: {mapping.green_pin}</span>
            <span className="pin-badge pin-badge--b">B: {mapping.blue_pin}</span>
          </div>
          <div style={{ display: "flex", gap: "6px", marginTop: "auto" }}>
            <button
              className="dashboard-btn icon-btn"
              onClick={onEdit}
              title="Edit mapping"
              aria-label="Edit mapping"
            >
              ✏
            </button>
            <button
              className="dashboard-btn icon-btn"
              onClick={onTestRow}
              disabled={isTesting}
              title="Test this mapping (pauses active pattern)"
              aria-label="Test mapping"
            >
              ⚡
            </button>
            <button
              className="dashboard-btn icon-btn danger"
              onClick={onDelete}
              disabled={isDeleting}
              title="Delete mapping"
              aria-label="Delete mapping"
            >
              ✕
            </button>
          </div>
        </>
      )}
    </div>
  );
}
