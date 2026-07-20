import type { LedPatternKind, LedPreset, RgbColour } from "@/lib/types";

export const PATTERN_KINDS: Exclude<LedPatternKind, "off">[] = [
  "solid",
  "pulse",
  "blink",
  "gradient",
  "rainbow",
];

export type FormState = {
  name: string;
  kind: Exclude<LedPatternKind, "off">;
  colours: RgbColour[];
  interval_ms: number;
};

export const defaultForm: FormState = {
  name: "",
  kind: "solid",
  colours: [{ r: 255, g: 255, b: 255 }],
  interval_ms: 1000,
};

export type FormMode =
  | { mode: "none" }
  | { mode: "create" }
  | { mode: "edit"; preset: LedPreset };

export function patternToForm(preset: LedPreset): FormState {
  return {
    name: preset.name,
    kind: preset.pattern.kind as Exclude<LedPatternKind, "off">,
    colours:
      preset.pattern.colours.length > 0
        ? preset.pattern.colours
        : [{ r: 255, g: 255, b: 255 }],
    interval_ms: preset.pattern.interval_ms,
  };
}
