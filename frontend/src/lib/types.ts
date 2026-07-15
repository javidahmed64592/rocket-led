export type RgbColour = { r: number; g: number; b: number };

export type LedPatternKind =
  | "off"
  | "solid"
  | "pulse"
  | "blink"
  | "gradient"
  | "rainbow";

export type LedPattern = {
  kind: LedPatternKind;
  colours: RgbColour[];
  interval_ms: number;
};

export type LedPreset = {
  id?: number;
  name: string;
  pattern: LedPattern;
};

export type PinMapping = {
  id?: number;
  name: string;
  red_pin: number;
  green_pin: number;
  blue_pin: number;
};

export type ActiveState = {
  preset_id: number | null;
  preset_name: string | null;
  source: "manual" | "schedule" | "off";
};
