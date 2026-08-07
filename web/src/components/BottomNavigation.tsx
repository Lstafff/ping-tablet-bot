import { LayoutGroup, motion } from "motion/react";

import { tma } from "../lib/tma";
// @ts-ignore The Deslop symbol component is JavaScript with a local declaration file.
import { MaterialSymbol } from "../../primitives/material-symbols-react";
// @ts-ignore The Deslop kit is JavaScript and supplies the chosen glass material.
import { GlassContainer } from "../../mini-app/components/GlassEffect";

export type MainTab = "matches" | "stats" | "profile";

const tabs = [
  { id: "matches" as const, label: "Матчи", icon: "workspace_premium" },
  { id: "stats" as const, label: "История", icon: "schedule" },
  { id: "profile" as const, label: "Профиль", icon: "person" },
] as const;

export function BottomNavigation({ active, onSelect }: { active: MainTab; onSelect(tab: MainTab): void }) {
  return (
    <GlassContainer
      className="bottom-nav"
      style={{
        "--primary-5": "rgba(255, 255, 255, 0.82)",
        "--primary-10": "rgba(17, 17, 17, 0.1)",
        "--primary-90": "rgba(255, 255, 255, 0.94)",
        "--primary-20": "rgba(255, 255, 255, 0.58)",
        "--black": "#000",
      } as React.CSSProperties}
    >
      <nav className="bottom-nav-content" aria-label="Разделы">
        <LayoutGroup id="main-navigation">
          {tabs.map(({ id, label, icon }) => {
            const isActive = active === id;
            return (
              <button
                className={isActive ? "nav-button nav-button-active" : "nav-button"}
                type="button"
                key={id}
                aria-current={isActive ? "page" : undefined}
                aria-label={label}
                title={label}
                onClick={() => {
                  tma.haptic.selection();
                  onSelect(id);
                }}
              >
                {isActive ? <motion.span className="nav-active-pill" layoutId="active-main-tab" transition={{ type: "spring", stiffness: 500, damping: 36, mass: 0.7 }} /> : null}
                <MaterialSymbol name={icon} aria-hidden="true" size={25} fill weight={600} />
              </button>
            );
          })}
        </LayoutGroup>
      </nav>
    </GlassContainer>
  );
}
