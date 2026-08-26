import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { AppIcon, AppIconName } from "./AppIcon";
import { easeInOut, easeOut } from "../lib/motion";
import { tma } from "../lib/tma";
import "./BottomNavigation.css";
// @ts-ignore The Deslop kit is JavaScript and supplies the chosen glass material.
import { GlassContainer } from "../../mini-app/components/GlassEffect";

export type MainTab = "matches" | "stats" | "profile";

const tabs: ReadonlyArray<{ id: MainTab; label: string; icon: AppIconName }> = [
  { id: "stats", label: "История", icon: "clock" },
  { id: "matches", label: "Главная", icon: "swords" },
  { id: "profile", label: "Профиль", icon: "user" },
] as const;

const tabPosition: Record<MainTab, number> = {
  stats: 0,
  matches: 1,
  profile: 2,
};

export function BottomNavigation({
  active,
  onSelect,
  actionLabel,
  actionDisabled = false,
  actionForm,
  onAction,
  auxiliaryActionLabel,
  auxiliaryActionDisabled = false,
  onAuxiliaryAction,
}: {
  active: MainTab;
  onSelect(tab: MainTab): void;
  actionLabel?: string;
  actionDisabled?: boolean;
  actionForm?: string;
  onAction?(): void;
  auxiliaryActionLabel?: string;
  auxiliaryActionDisabled?: boolean;
  onAuxiliaryAction?(): void;
}) {
  const reduceMotion = useReducedMotion();
  const actionVisible = Boolean(actionLabel);
  const actionMorphTransition = reduceMotion ? { duration: 0 } : { duration: 0.18, ease: easeInOut };

  return (
    <GlassContainer
      className="bottom-nav"
      style={{
        "--primary-5": "var(--color-glass-muted)",
        "--primary-10": "transparent",
        "--primary-90": "var(--color-glass-edge)",
        "--primary-20": "var(--color-glass-muted)",
        "--black": "var(--color-text-primary)",
        "--glass-blur": "var(--space-12)",
        "--glass-saturate": "180%",
        "--glass-brightness": "1.06",
        "--glass-contrast": "1.04",
      } as React.CSSProperties}
    >
      <svg className="bottom-nav-filter-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <filter id="bottom-nav-liquid-refraction" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="1" seed="7" result="noise" />
            <feGaussianBlur in="noise" stdDeviation="1.5" result="softNoise" />
            <feDisplacementMap in="SourceGraphic" in2="softNoise" scale="12" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <nav className="bottom-nav-content" aria-label="Разделы">
        <motion.div
            className="nav-tabs-grid"
            initial={false}
            animate={{ opacity: actionVisible ? 0 : 1 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.1, delay: !actionVisible && !reduceMotion ? 0.08 : 0, ease: easeOut }}
            aria-hidden={actionVisible}
          >
            <span
              className="nav-active-pill"
              aria-hidden="true"
              style={{ transform: `translateX(${tabPosition[active] * 100}%)` }}
            />
            {tabs.map(({ id, label, icon }) => {
              const isActive = active === id;
              return (
                <motion.button
                  className={isActive ? "nav-button nav-button-active" : "nav-button"}
                  type="button"
                  key={id}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={label}
                  title={label}
                  disabled={actionVisible}
                  onClick={() => {
                    tma.haptic.selection();
                    onSelect(id);
                  }}
                >
                  <span className="nav-button-content">
                    <AppIcon name={icon} aria-hidden="true" size={22} />
                    <span className="nav-button-label" aria-hidden="true">{label}</span>
                  </span>
                </motion.button>
              );
            })}
          </motion.div>
          <AnimatePresence initial={false}>
            {actionVisible ? (
              <motion.div
                className={auxiliaryActionLabel ? "nav-action-row nav-action-row-with-auxiliary" : "nav-action-row"}
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 1 }}
              >
                <motion.button
                  className="nav-save-button"
                  type={actionForm ? "submit" : "button"}
                  form={actionForm}
                  aria-label={actionLabel}
                  title={actionLabel}
                  disabled={actionDisabled}
                  onClick={actionForm ? undefined : onAction}
                >
                  <motion.span
                    className="nav-save-surface"
                    aria-hidden="true"
                    initial={{ opacity: 0, transform: reduceMotion ? "scale(1)" : "scale(0.96)" }}
                    animate={{ opacity: 1, transform: "scale(1)" }}
                    exit={{ opacity: 0, transform: reduceMotion ? "scale(1)" : "scale(0.96)" }}
                    transition={actionMorphTransition}
                  />
                  <motion.span
                    className="nav-button-content nav-button-save-label"
                    initial={{ opacity: 0, transform: reduceMotion ? "scale(1)" : "scale(0.96)" }}
                    animate={{ opacity: 1, transform: "scale(1)" }}
                    exit={{ opacity: 0, transform: reduceMotion ? "scale(1)" : "scale(0.96)" }}
                    transition={{ duration: reduceMotion ? 0.12 : 0.12, delay: reduceMotion ? 0 : 0.06, ease: easeOut }}
                  >
                    {actionLabel}
                  </motion.span>
                </motion.button>
                {auxiliaryActionLabel ? (
                  <button
                    className="nav-auxiliary-button"
                    type="button"
                    aria-label={auxiliaryActionLabel}
                    title={auxiliaryActionLabel}
                    disabled={auxiliaryActionDisabled}
                    onClick={onAuxiliaryAction}
                  >
                    <AppIcon name="refresh" aria-hidden="true" size={25} />
                  </button>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
      </nav>
    </GlassContainer>
  );
}
