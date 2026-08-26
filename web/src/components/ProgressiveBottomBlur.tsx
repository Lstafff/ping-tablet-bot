import "./ProgressiveBottomBlur.css";

export function ProgressiveBottomBlur({ blurOnly = false }: { blurOnly?: boolean }) {
  return <div className={blurOnly ? "progressive-bottom-blur progressive-bottom-blur-only" : "progressive-bottom-blur"} aria-hidden="true" />;
}
