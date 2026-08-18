import type { ReactNode } from "react";

export function EloDeltaBadge({ value }: { value?: number | null }) {
  const delta = value ?? 0;
  const tone = delta > 0 ? "elo-delta-positive" : delta < 0 ? "elo-delta-negative" : "elo-delta-neutral";
  return <small className={`elo-delta-badge ${tone}`}>{delta >= 0 ? "+" : ""}{delta}</small>;
}

export function ScorePair({ left, right }: { left: ReactNode; right: ReactNode }) {
  return <span className="score-pair"><span>{left}</span><span className="score-separator"> : </span><span>{right}</span></span>;
}

export function ScoreValue({ value }: { value: string | null }) {
  if (!value) return <>—</>;
  const parts = value.split(":");
  return parts.length === 2 ? <ScorePair left={parts[0].trim()} right={parts[1].trim()} /> : <>{value}</>;
}
