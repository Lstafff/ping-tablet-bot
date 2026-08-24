import { MorphingHeading } from "./PageHeader";
import "./AppLoading.css";

export function InitialAppSkeleton() {
  return (
    <div className="initial-app-skeleton" role="status" aria-label="Загрузка приложения">
      <div className="initial-skeleton-header" aria-hidden="true">
        <span className="initial-skeleton-title initial-skeleton-shape" />
        <span className="initial-skeleton-avatar initial-skeleton-shape" />
      </div>
      <div className="initial-skeleton-summary" aria-hidden="true">
        <div className="initial-skeleton-score">
          <span className="initial-skeleton-score-value initial-skeleton-shape" />
          <span className="initial-skeleton-score-divider initial-skeleton-shape" />
          <span className="initial-skeleton-score-value initial-skeleton-shape" />
        </div>
        <span className="initial-skeleton-caption initial-skeleton-shape" />
      </div>
      <div className="initial-skeleton-list" aria-hidden="true">
        <span className="initial-skeleton-section-title initial-skeleton-shape" />
        {[0, 1, 2].map((row) => (
          <div className="initial-skeleton-row" key={row}>
            <span className="initial-skeleton-row-avatar initial-skeleton-shape" />
            <span className="initial-skeleton-row-copy">
              <span className="initial-skeleton-row-title initial-skeleton-shape" />
              <span className="initial-skeleton-row-detail initial-skeleton-shape" />
            </span>
            <span className="initial-skeleton-row-value initial-skeleton-shape" />
          </div>
        ))}
      </div>
      <div className="initial-skeleton-toolbar" aria-hidden="true">
        <span className="initial-skeleton-toolbar-pill initial-skeleton-shape" />
        <span className="initial-skeleton-toolbar-action initial-skeleton-shape" />
      </div>
    </div>
  );
}

export function ErrorScreen({ error, onRetry }: { error: string; onRetry(): void }) {
  return (
    <section className="loading-screen">
      <p className="eyebrow">Ошибка загрузки</p>
      <MorphingHeading>Не удалось открыть матч</MorphingHeading>
      <p>{error}</p>
      <button className="primary-button" type="button" onClick={onRetry}>Повторить</button>
    </section>
  );
}
