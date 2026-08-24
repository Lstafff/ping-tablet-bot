import { AppIcon } from "./AppIcon";
import "./NumericKeypad.css";

const keypadKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "erase"] as const;

export function NumericKeypad({
  ariaLabel,
  onDigit,
  onErase,
}: {
  ariaLabel: string;
  onDigit(digit: string): void;
  onErase(): void;
}) {
  return (
    <div className="numeric-keypad" aria-label={ariaLabel}>
      {keypadKeys.map((key, index) => key === "" ? (
        <span key={`empty-${index}`} aria-hidden="true" />
      ) : (
        <button
          key={key}
          type="button"
          aria-label={key === "erase" ? "Удалить цифру" : key}
          onClick={key === "erase" ? onErase : () => onDigit(key)}
        >
          {key === "erase" ? <AppIcon name="arrow-left" size={29} /> : key}
        </button>
      ))}
    </div>
  );
}
