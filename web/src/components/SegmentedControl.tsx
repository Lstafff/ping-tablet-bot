import { type CSSProperties, type ReactNode, useRef } from "react";
import "./SegmentedControl.css";

export type SegmentOption<Value extends string> = {
  value: Value;
  label: ReactNode;
};

export function SegmentedControl<Value extends string>({
  value,
  options,
  ariaLabel,
  tone = "light",
  semantic = "tabs",
  idPrefix,
  className = "",
  onChange,
}: {
  value: Value;
  options: readonly SegmentOption<Value>[];
  ariaLabel: string;
  tone?: "light" | "dark";
  semantic?: "tabs" | "choice";
  idPrefix?: string;
  className?: string;
  onChange(value: Value): void;
}) {
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const style = {
    "--segment-count": options.length,
  } as CSSProperties;

  return (
    <div className={`segmented-control segmented-control-${tone}${className ? ` ${className}` : ""}`} role={semantic === "tabs" ? "tablist" : "radiogroup"} aria-label={ariaLabel} style={style}>
      <span
        className="segment-active-indicator"
        aria-hidden="true"
        style={{ transform: `translate3d(calc(${activeIndex * 100}% + ${activeIndex * 4}px), 0, 0)` }}
      />
      {options.map((option, index) => {
        const active = option.value === value;
        const optionId = idPrefix ? `${idPrefix}-tab-${option.value}` : undefined;
        const panelId = idPrefix ? `${idPrefix}-panel-${option.value}` : undefined;
        return (
          <button
            className={active ? "segment-button segment-button-active" : "segment-button"}
            type="button"
            role={semantic === "tabs" ? "tab" : "radio"}
            aria-selected={semantic === "tabs" ? active : undefined}
            aria-checked={semantic === "choice" ? active : undefined}
            aria-controls={semantic === "tabs" ? panelId : undefined}
            id={optionId}
            tabIndex={active ? 0 : -1}
            ref={(node) => { buttonRefs.current[index] = node; }}
            key={option.value}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              let nextIndex: number | null = null;
              if (event.key === "Home") nextIndex = 0;
              else if (event.key === "End") nextIndex = options.length - 1;
              else if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % options.length;
              else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + options.length) % options.length;
              if (nextIndex === null) return;
              event.preventDefault();
              onChange(options[nextIndex].value);
              window.requestAnimationFrame(() => buttonRefs.current[nextIndex]?.focus());
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
