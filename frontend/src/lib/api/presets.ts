import { apiFetch } from "./client";
import type { ActiveState, LedPreset } from "../types";

export const listPresets = () => apiFetch<LedPreset[]>("/presets");

export const createPreset = (preset: Omit<LedPreset, "id">) =>
  apiFetch<LedPreset>("/presets", {
    method: "POST",
    body: JSON.stringify(preset),
  });

export const deletePreset = (id: number) =>
  apiFetch<void>(`/presets/${id}`, { method: "DELETE" });

export const applyPreset = (id: number) =>
  apiFetch<void>(`/presets/${id}/apply`, { method: "POST" });

export const turnOff = () => apiFetch<void>("/state/off", { method: "POST" });

export const getState = () => apiFetch<ActiveState>("/state");
