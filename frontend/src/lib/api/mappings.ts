import type { PinMapping } from "../types";
import { apiFetch } from "./client";

export const listMappings = () => apiFetch<PinMapping[]>("/mappings");

export const createMapping = (mapping: Omit<PinMapping, "id">) =>
  apiFetch<PinMapping>("/mappings", {
    method: "POST",
    body: JSON.stringify(mapping),
  });

export const updateMapping = (id: number, mapping: Omit<PinMapping, "id">) =>
  apiFetch<PinMapping>(`/mappings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(mapping),
  });

export const deleteMapping = (id: number) =>
  apiFetch<void>(`/mappings/${id}`, { method: "DELETE" });

type TestRequest =
  { id: number } | { red_pin: number; green_pin: number; blue_pin: number };

export const testMapping = (request: TestRequest) =>
  apiFetch<void>("/mappings/test", {
    method: "POST",
    body: JSON.stringify(request),
  });
