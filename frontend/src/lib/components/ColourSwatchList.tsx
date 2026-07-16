import { useEffect, useRef, useState } from "react";
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
  /** Cap the list length — pass 1 for "solid" patterns. Omit for no cap. */
  maxColours?: number;
};

export default function ColourSwatchList({ colours, onChange, maxColours }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function updateColour(index: number, hex: string) {
    onChange(colours.map((c, i) => (i === index ? hexToRgb(hex) : c)));
  }

  function addColour() {
    onChange([...colours, { r: 255, g: 255, b: 255 }]);
  }

  function removeColour(index: number) {
    onChange(colours.filter((_, i) => i !== index));
    setOpenIndex(null);
  }

  const canAdd = maxColours === undefined || colours.length < maxColours;

  return (
    <div className="swatch-list">
      {colours.map((colour, i) => (
        <SwatchItem
          key={i}
          colour={colour}
          isOpen={openIndex === i}
          onToggle={() => setOpenIndex(openIndex === i ? null : i)}
          onClose={() => setOpenIndex(null)}
          onChange={(hex) => updateColour(i, hex)}
          onRemove={() => removeColour(i)}
          canRemove={colours.length > 1}
        />
      ))}
      {canAdd && (
        <button type="button" className="swatch-add" onClick={addColour}>
          +
        </button>
      )}
    </div>
  );
}

type SwatchItemProps = {
  colour: RgbColour;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChange: (hex: string) => void;
  onRemove: () => void;
  canRemove: boolean;
};

function SwatchItem({
  colour,
  isOpen,
  onToggle,
  onClose,
  onChange,
  onRemove,
  canRemove,
}: SwatchItemProps) {
  const hex = rgbToHex(colour);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <div className="swatch-item" ref={ref}>
      <button
        type="button"
        className="swatch-preview"
        style={{ background: hex }}
        title={hex}
        onClick={onToggle}
        aria-label={`Edit colour ${hex}`}
      />
      {isOpen && (
        <div className="swatch-popover">
          <HexColorPicker color={hex} onChange={onChange} />
        </div>
      )}
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
