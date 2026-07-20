import type { ActiveState, LedPattern, LedPreset } from "../types";
import { apiFetch } from "./client";

export const listPresets = () => apiFetch<LedPreset[]>("/presets");

export const createPreset = (preset: Omit<LedPreset, "id">) =>
  apiFetch<LedPreset>("/presets", {
    method: "POST",
    body: JSON.stringify(preset),
  });

export const updatePreset = (id: number, preset: Omit<LedPreset, "id">) =>
  apiFetch<LedPreset>(`/presets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(preset),
  });

export const deletePreset = (id: number) =>
  apiFetch<void>(`/presets/${id}`, { method: "DELETE" });

export const applyPreset = (id: number) =>
  apiFetch<void>(`/presets/${id}/apply`, { method: "POST" });

export const getState = () => apiFetch<ActiveState>("/state");

export const previewPattern = (pattern: LedPattern) =>
  apiFetch<void>("/state/preview", {
    method: "POST",
    body: JSON.stringify(pattern),
  });

export const turnOff = () => apiFetch<void>("/state/off", { method: "POST" });

export const setBrightness = (brightness: number) =>
  apiFetch<void>("/state/brightness", {
    method: "PATCH",
    body: JSON.stringify({ brightness }),
  });
