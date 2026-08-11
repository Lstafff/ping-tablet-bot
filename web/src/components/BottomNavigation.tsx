import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";

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

export function BottomNavigation({
  active,
  onSelect,
  profileEditing = false,
  profileSaveDisabled = false,
}: {
  active: MainTab;
  onSelect(tab: MainTab): void;
  profileEditing?: boolean;
  profileSaveDisabled?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const saveMorphTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.18, ease: easeInOut };

  return (
    <GlassContainer
      className="bottom-nav"
      style={{
        "--primary-5": "var(--color-glass-highlight)",
        "--primary-10": "var(--color-glass-shadow)",
        "--primary-90": "var(--color-glass-surface)",
        "--primary-20": "var(--color-glass-muted)",
        "--black": "var(--color-text-primary)",
      } as React.CSSProperties}
    >
      <nav className="bottom-nav-content" aria-label="Разделы">
        <LayoutGroup id="main-navigation">
          <motion.div
            className="nav-tabs-grid"
            initial={false}
            animate={{ opacity: profileEditing ? 0 : 1 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.1, delay: !profileEditing && !reduceMotion ? 0.08 : 0, ease: easeOut }}
            aria-hidden={profileEditing}
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
                  disabled={profileEditing}
                  onClick={() => {
                    tma.haptic.selection();
                    onSelect(id);
                  }}
                >
                  {isActive && !profileEditing ? (
                    <motion.span
                      className="nav-active-pill"
                      layoutId="active-main-tab"
                      style={{ borderRadius: 999 }}
                      transition={{
                        layout: active === "profile"
                          ? saveMorphTransition
                          : { type: "spring", stiffness: 500, damping: 36, mass: 0.7 },
                      }}
                    />
                  ) : null}
                  <span className="nav-button-content"><AppIcon name={icon} aria-hidden="true" size={25} /></span>
                </motion.button>
              );
            })}
          </motion.div>
          <AnimatePresence initial={false}>
            {profileEditing ? (
              <motion.button
                className="nav-save-button"
                type="submit"
                form="profile-name-form"
                aria-label="Сохранить"
                title="Сохранить"
                disabled={profileSaveDisabled}
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 1 }}
              >
                <motion.span
                  className="nav-save-surface"
                  aria-hidden="true"
                  layoutId="active-main-tab"
                  style={{ borderRadius: 999 }}
                  transition={{ layout: saveMorphTransition }}
                />
                <motion.span
                  className="nav-button-content nav-button-save-label"
                  initial={{ opacity: 0, transform: reduceMotion ? "scale(1)" : "scale(0.96)" }}
                  animate={{ opacity: 1, transform: "scale(1)" }}
                  exit={{ opacity: 0, transform: reduceMotion ? "scale(1)" : "scale(0.96)" }}
                  transition={{ duration: reduceMotion ? 0.12 : 0.12, delay: reduceMotion ? 0 : 0.06, ease: easeOut }}
                >
                  Сохранить
                </motion.span>
              </motion.button>
            ) : null}
          </AnimatePresence>
        </LayoutGroup>
      </nav>
    </GlassContainer>
  );
}
