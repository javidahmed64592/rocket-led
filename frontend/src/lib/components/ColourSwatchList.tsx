import { HexColorPicker } from "react-colorful";
import type { RgbColour } from "../types";

function rgbToHex({ r, g, b }: RgbColour): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
      .join("")
  );
}

function hexToRgb(hex: string): RgbColour {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  };
}

type Props = {
  colours: RgbColour[];
  onChange: (colours: RgbColour[]) => void;
};

export default function ColourSwatchList({ colours, onChange }: Props) {
  function updateColour(index: number, hex: string) {
    const next = colours.map((c, i) => (i === index ? hexToRgb(hex) : c));
    onChange(next);
  }

  function addColour() {
    onChange([...colours, { r: 255, g: 255, b: 255 }]);
  }

  function removeColour(index: number) {
    onChange(colours.filter((_, i) => i !== index));
  }

  return (
    <div className="swatch-list">
      {colours.map((colour, i) => (
        <SwatchItem
          key={i}
          colour={colour}
          onChange={(hex) => updateColour(i, hex)}
          onRemove={() => removeColour(i)}
          canRemove={colours.length > 1}
        />
      ))}
      <button type="button" className="swatch-add" onClick={addColour}>
        +
      </button>
    </div>
  );
}

type SwatchItemProps = {
  colour: RgbColour;
  onChange: (hex: string) => void;
  onRemove: () => void;
  canRemove: boolean;
};

function SwatchItem({ colour, onChange, onRemove, canRemove }: SwatchItemProps) {
  const hex = rgbToHex(colour);

  return (
    <div className="swatch-item">
      <div
        className="swatch-preview"
        style={{ background: hex }}
        title={hex}
      />
      <HexColorPicker color={hex} onChange={onChange} />
      {canRemove && (
        <button
          type="button"
          className="swatch-remove"
          onClick={onRemove}
          aria-label="Remove colour"
        >
          ×
        </button>
      )}
    </div>
  );
}
