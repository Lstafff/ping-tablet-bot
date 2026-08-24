import { useEffect, useRef } from "react";
import "./ProgressiveLoadTrigger.css";

export function ProgressiveLoadTrigger({
  error,
  hasMore,
  loading,
  onLoadMore,
}: {
  error: string;
  hasMore: boolean;
  loading: boolean;
  onLoadMore(): void;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger || !hasMore || loading || error) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(trigger);
    return () => observer.disconnect();
  }, [error, hasMore, loading, onLoadMore]);

  if (!hasMore && !loading && !error) return null;

  return (
    <div className="progressive-load" ref={triggerRef}>
      {loading ? <span role="status">Загружаем ещё…</span> : null}
      {error ? (
        <span role="alert">
          {error}
          <button type="button" onClick={onLoadMore}>Повторить</button>
        </span>
      ) : null}
    </div>
  );
}
