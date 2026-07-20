export type MappingFormState = {
  name: string;
  red_pin: string;
  green_pin: string;
  blue_pin: string;
};

export type TestStatus = "idle" | "testing" | "ok" | "error";

export const emptyMappingForm: MappingFormState = {
  name: "",
  red_pin: "",
  green_pin: "",
  blue_pin: "",
};

export function pinsValid(form: MappingFormState): boolean {
  return (
    !isNaN(parseInt(form.red_pin, 10)) &&
    !isNaN(parseInt(form.green_pin, 10)) &&
    !isNaN(parseInt(form.blue_pin, 10))
  );
}

export function parsePins(form: MappingFormState): {
  red_pin: number;
  green_pin: number;
  blue_pin: number;
} {
  return {
    red_pin: parseInt(form.red_pin, 10),
    green_pin: parseInt(form.green_pin, 10),
    blue_pin: parseInt(form.blue_pin, 10),
  };
}
