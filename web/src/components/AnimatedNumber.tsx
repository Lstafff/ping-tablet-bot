import { memo, useEffect, useRef } from "react";
import "./AnimatedNumber.css";

export const AnimatedNumber = memo(function AnimatedNumber({
  value,
  className = "",
  animateOnMount = false,
}: {
  value: string | number;
  className?: string;
  animateOnMount?: boolean;
}) {
  const hasMounted = useRef(false);
  const characters = String(value).split("");
  const shouldAnimate = animateOnMount || hasMounted.current;

  useEffect(() => {
    hasMounted.current = true;
  }, []);

  return (
    <span
      className={`rolling-number t-digit-group${shouldAnimate ? " is-animating" : ""} ${className}`.trim()}
      aria-label={String(value)}
      key={String(value)}
    >
      {characters.map((character, index) => {
        const stagger = index === characters.length - 2 ? 1 : index === characters.length - 1 ? 2 : undefined;
        return (
          <span
            className={`${/\d/.test(character) ? "rolling-digit" : "rolling-separator"} t-digit`}
            aria-hidden="true"
            data-stagger={stagger}
            key={`${index}-${character}`}
          >
            {character}
          </span>
        );
      })}
    </span>
  );
});
