import { apiFetch } from "./client";
import type { PinMapping } from "../types";

export const listMappings = () => apiFetch<PinMapping[]>("/mappings");

export const createMapping = (mapping: Omit<PinMapping, "id">) =>
  apiFetch<PinMapping>("/mappings", {
    method: "POST",
    body: JSON.stringify(mapping),
  });

export const deleteMapping = (id: number) =>
  apiFetch<void>(`/mappings/${id}`, { method: "DELETE" });

export const testMapping = (pins: {
  red_pin: number;
  green_pin: number;
  blue_pin: number;
}) =>
  apiFetch<void>("/mappings/test", {
    method: "POST",
    body: JSON.stringify(pins),
  });
