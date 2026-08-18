import type { CSSProperties } from "react";

export type SegmentOption<Value extends string> = {
  value: Value;
  label: string;
};

export function SegmentedControl<Value extends string>({
  value,
  options,
  ariaLabel,
  tone = "light",
  className = "",
  onChange,
}: {
  value: Value;
  options: readonly SegmentOption<Value>[];
  ariaLabel: string;
  tone?: "light" | "dark";
  className?: string;
  onChange(value: Value): void;
}) {
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const style = {
    "--segment-count": options.length,
  } as CSSProperties;

  return (
    <div className={`segmented-control segmented-control-${tone}${className ? ` ${className}` : ""}`} role="tablist" aria-label={ariaLabel} style={style}>
      <span
        className="segment-active-indicator"
        aria-hidden="true"
        style={{ transform: `translate3d(calc(${activeIndex * 100}% + ${activeIndex * 4}px), 0, 0)` }}
      />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            className={active ? "segment-button segment-button-active" : "segment-button"}
            type="button"
            role="tab"
            aria-selected={active}
            key={option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
