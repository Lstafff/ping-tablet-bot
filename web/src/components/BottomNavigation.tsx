import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { AppIcon, AppIconName } from "./AppIcon";
import { easeInOut, easeOut } from "../lib/motion";
import { tma } from "../lib/tma";
// @ts-ignore The Deslop kit is JavaScript and supplies the chosen glass material.
import { GlassContainer } from "../../mini-app/components/GlassEffect";

export type MainTab = "matches" | "stats" | "profile";

const tabs: ReadonlyArray<{ id: MainTab; label: string; icon: AppIconName }> = [
  { id: "stats", label: "История", icon: "clock" },
  { id: "matches", label: "Матчи", icon: "swords" },
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
}: {
  active: MainTab;
  onSelect(tab: MainTab): void;
  actionLabel?: string;
  actionDisabled?: boolean;
  actionForm?: string;
  onAction?(): void;
}) {
  const reduceMotion = useReducedMotion();
  const actionVisible = Boolean(actionLabel);
  const actionMorphTransition = reduceMotion ? { duration: 0 } : { duration: 0.18, ease: easeInOut };

  return (
    <GlassContainer
      className="bottom-nav"
      style={{
        "--primary-5": "var(--color-glass-highlight)",
        "--primary-10": "transparent",
        "--primary-90": "var(--color-glass-surface)",
        "--primary-20": "var(--color-glass-muted)",
        "--black": "var(--color-text-primary)",
      } as React.CSSProperties}
    >
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
                  <span className="nav-button-content"><AppIcon name={icon} aria-hidden="true" size={25} /></span>
                </motion.button>
              );
            })}
          </motion.div>
          <AnimatePresence initial={false}>
            {actionVisible ? (
              <motion.button
                className="nav-save-button"
                type={actionForm ? "submit" : "button"}
                form={actionForm}
                aria-label={actionLabel}
                title={actionLabel}
                disabled={actionDisabled}
                onClick={actionForm ? undefined : onAction}
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 1 }}
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
            ) : null}
          </AnimatePresence>
      </nav>
    </GlassContainer>
  );
}
