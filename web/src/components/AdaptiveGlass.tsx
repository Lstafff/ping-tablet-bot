import { Glass } from "@samasante/liquid-glass";
import { memo, type CSSProperties, type ReactNode } from "react";

export function shouldUseAndroidGlassFallback(userAgent: string): boolean {
  return /Android/i.test(userAgent);
}

export const AdaptiveGlass = memo(function AdaptiveGlass({
  children,
  className,
  radius,
  style,
}: {
  children: ReactNode;
  className?: string;
  radius: number;
  style?: CSSProperties;
}) {
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;

  if (!shouldUseAndroidGlassFallback(userAgent)) {
    return (
      <Glass className={className} radius={radius} style={style}>
        {children}
      </Glass>
    );
  }

  return (
    <div
      className={className}
      data-liquid-glass="android-fallback"
      style={{
        WebkitBackdropFilter: "blur(6px) saturate(1.15)",
        backdropFilter: "blur(6px) saturate(1.15)",
        borderRadius: radius,
        ...style,
      }}
    >
      {children}
    </div>
  );
});
