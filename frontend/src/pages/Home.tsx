import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { applyPreset, getState, listPresets, logout, turnOff } from "@/lib/api";

export default function Home() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: state } = useQuery({
    queryKey: ["state"],
    queryFn: getState,
  });

  const { data: presets } = useQuery({
    queryKey: ["presets"],
    queryFn: listPresets,
  });

  const applyMutation = useMutation({
    mutationFn: applyPreset,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["state"] }),
  });

  const offMutation = useMutation({
    mutationFn: turnOff,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["state"] }),
  });

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const isOn = state?.source !== "off" && state?.preset_id != null;

  return (
    <div className="dashboard-page" style={{ padding: "32px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <h1 style={{ margin: 0, fontSize: "28px" }}>rocket-led</h1>
        <nav style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <Link to="/mappings" className="nav-link">Mappings</Link>
          <Link to="/presets" className="nav-link">Presets</Link>
          <button className="dashboard-btn" onClick={handleLogout}>Log out</button>
        </nav>
      </header>

      <section className="dashboard-card" style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <span className={`dashboard-status-dot${isOn ? " on" : ""}`} />
          <strong>
            {isOn ? `Active: ${state?.preset_name ?? "Unknown"}` : "Off"}
          </strong>
        </div>
        <button
          className="dashboard-btn danger"
          onClick={() => offMutation.mutate()}
          disabled={offMutation.isPending}
        >
          {offMutation.isPending ? "Turning off…" : "Turn Off"}
        </button>
      </section>

      <h2 style={{ marginBottom: "16px" }}>Presets</h2>
      {!presets || presets.length === 0 ? (
        <p style={{ color: "var(--dash-text-muted)" }}>
          No presets yet. <Link to="/presets">Create one.</Link>
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
          {presets.map((preset) => {
            const active = state?.preset_id === preset.id;
            return (
              <div
                key={preset.id}
                className={`dashboard-card${active ? " active-preset" : ""}`}
                style={{ display: "flex", flexDirection: "column", gap: "10px" }}
              >
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {preset.pattern.colours.length > 0
                    ? preset.pattern.colours.map((c, i) => (
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
                    : <span style={{ fontSize: "12px", color: "var(--dash-text-muted)" }}>Rainbow</span>}
                </div>
                <strong style={{ fontSize: "14px" }}>{preset.name}</strong>
                <span style={{ fontSize: "12px", color: "var(--dash-text-muted)" }}>
                  {preset.pattern.kind} · {preset.pattern.interval_ms}ms
                </span>
                <button
                  className="dashboard-btn"
                  style={{ marginTop: "auto" }}
                  disabled={active || applyMutation.isPending}
                  onClick={() => applyMutation.mutate(preset.id!)}
                >
                  {active ? "Active" : "Apply"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
