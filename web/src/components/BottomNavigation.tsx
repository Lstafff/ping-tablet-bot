import { Glass } from "@samasante/liquid-glass";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { AppIcon, AppIconName } from "./AppIcon";
import { easeInOut, easeOut } from "../lib/motion";
import { tma } from "../lib/tma";
import "./BottomNavigation.css";

export type MainTab = "matches" | "stats" | "profile";

const tabs: ReadonlyArray<{ id: MainTab; label: string; icon: AppIconName }> = [
  { id: "stats", label: "История", icon: "clock" },
  { id: "matches", label: "Главная", icon: "swords" },
  { id: "profile", label: "Профиль", icon: "user" },
] as const;

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
    <Glass
      className={actionVisible ? "bottom-nav bottom-nav-action" : "bottom-nav"}
      radius={30}
      style={{ display: "block", overflow: "hidden" }}
    >
      <nav className="bottom-nav-content" aria-label="Разделы">
        <motion.div
            className="nav-tabs-grid"
            initial={false}
            animate={{ opacity: actionVisible ? 0 : 1 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.1, delay: !actionVisible && !reduceMotion ? 0.08 : 0, ease: easeOut }}
            aria-hidden={actionVisible}
          >
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
                  {isActive ? (
                    <motion.span
                      className="nav-active-pill"
                      layoutId="main-tab-active-pill"
                      aria-hidden="true"
                      transition={{ layout: reduceMotion ? { duration: 0 } : { duration: 0.18, ease: easeInOut } }}
                    />
                  ) : null}
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
    </Glass>
  );
}
