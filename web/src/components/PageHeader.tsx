import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId } from "react";

import { easeInOut, easeOut } from "../lib/motion";
import { AppIcon, type AppIconName } from "./AppIcon";
import { ProfileAvatarContent } from "./ProfileAvatar";
import "./PageHeader.css";

export function MorphingHeading({
  as = "h1",
  children,
  className,
  morphId,
}: {
  as?: "h1" | "h2";
  children: string;
  className?: string;
  morphId?: string;
}) {
  const StaticHeading = as === "h2" ? "h2" : "h1";

  if (!morphId) {
    return <StaticHeading className={className}>{children}</StaticHeading>;
  }
  return <TextStateSwapHeading as={as} className={className}>{children}</TextStateSwapHeading>;
}

function TextStateSwapHeading({ as = "h1", children, className }: { as?: "h1" | "h2"; children: string; className?: string }) {
  const reduceMotion = useReducedMotion();
  const Heading = as === "h2" ? motion.h2 : motion.h1;

  return (
    <Heading className={className} aria-label={children}>
      <span className="screen-title-copy" aria-hidden="true">
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            className="text-state-swap"
            key={children}
            initial={{
              opacity: 0,
              transform: reduceMotion ? "translateY(0)" : "translateY(4px)",
              filter: reduceMotion ? "blur(0)" : "blur(2px)",
            }}
            animate={{ opacity: 1, transform: "translateY(0)", filter: "blur(0)" }}
            exit={{
              opacity: 0,
              transform: reduceMotion ? "translateY(0)" : "translateY(-4px)",
              filter: reduceMotion ? "blur(0)" : "blur(2px)",
            }}
            transition={{ duration: reduceMotion ? 0.12 : 0.15, ease: easeInOut }}
          >
            {children}
          </motion.span>
        </AnimatePresence>
      </span>
    </Heading>
  );
}

export function LegacyWaveHeaderTitle({ as = "h1", children, className }: { as?: "h1" | "h2"; children: string; className?: string }) {
  const reduceMotion = useReducedMotion();
  const Heading = as === "h2" ? motion.h2 : motion.h1;
  const glyphs = Array.from(children);

  return (
    <Heading className={className} aria-label={children}>
      <span className="screen-title-copy" aria-hidden="true">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span className="screen-title-wave" key={children}>
            {glyphs.map((glyph, index) => (
              <motion.span
                className="screen-title-glyph"
                key={`${children}-${index}-${glyph}`}
                initial={{ opacity: 0, transform: reduceMotion ? "translateY(0)" : "translateY(100%)" }}
                animate={{ opacity: 1, transform: "translateY(0)" }}
                exit={{ opacity: 0, transform: reduceMotion ? "translateY(0)" : "translateY(-100%)" }}
                transition={{ duration: 0.12, delay: reduceMotion ? 0 : index * 0.003, ease: easeOut }}
              >
                {glyph === " " ? "\u00a0" : glyph}
              </motion.span>
            ))}
          </motion.span>
        </AnimatePresence>
      </span>
    </Heading>
  );
}

export function LegacyMorphingHeaderTitle({
  as = "h1",
  children,
  className,
  morphId,
}: {
  as?: "h1" | "h2";
  children: string;
  className?: string;
  morphId?: string;
}) {
  const reduceMotion = useReducedMotion();
  const generatedId = useId().replace(/:/g, "");
  const headingId = morphId ?? `heading-${generatedId}`;
  const Heading = as === "h2" ? motion.h2 : motion.h1;
  const glyphs = Array.from(children).map((glyph, index) => ({
    glyph,
    slotId: `${headingId}-slot-${index}`,
  }));

  return (
    <Heading className={className} aria-label={children}>
      <motion.span className="screen-title-copy" aria-hidden="true">
        <AnimatePresence mode="popLayout">
          {glyphs.map(({ glyph, slotId }) => (
            <motion.span
              className="screen-title-slot"
              key={slotId}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reduceMotion
                ? { duration: 0.12, ease: easeOut }
                : {
                    layout: { duration: 0.18, ease: easeOut },
                    opacity: { duration: 0.14, ease: easeOut },
                  }}
            >
              <AnimatePresence initial={false} mode="sync">
                <motion.span
                  className="screen-title-glyph"
                  key={glyph}
                  initial={{
                    opacity: 0,
                    transform: reduceMotion ? "translateX(0)" : "translateX(-100%)",
                  }}
                  animate={{ opacity: 1, transform: "translateX(0)" }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0.12 : 0.14, ease: easeOut }}
                >
                  {glyph === " " ? "\u00a0" : glyph}
                </motion.span>
              </AnimatePresence>
            </motion.span>
          ))}
        </AnimatePresence>
      </motion.span>
    </Heading>
  );
}

function ScreenTitle({ children }: { children: string }) {
  return <MorphingHeading morphId="screen-header-title">{children}</MorphingHeading>;
}

export function HeaderActionButton({ icon, label, onClick, flipped = false, className = "" }: { icon: AppIconName; label: string; onClick(): void; flipped?: boolean; className?: string }) {
  const reduceMotion = useReducedMotion();
  const iconTransition = reduceMotion
    ? { layout: { duration: 0 }, opacity: { duration: 0.12, ease: easeOut }, transform: { duration: 0 } }
    : { layout: { duration: 0.24, ease: easeInOut }, opacity: { duration: 0.16, ease: easeOut }, transform: { duration: 0.24, ease: easeInOut } };
  const classes = ["page-header-action-button", className].filter(Boolean).join(" ");

  return (
    <button className={classes} type="button" onClick={onClick} aria-label={label} title={label}>
      <motion.span
        className={`page-header-action-icon${icon === "filter" ? " history-sort-icon" : ""}`}
        layoutId="screen-header-action-icon"
        animate={{ opacity: 1, transform: `scale(1) scaleY(${flipped ? -1 : 1})` }}
        transition={iconTransition}
      >
        <AppIcon name={icon} size={22} />
      </motion.span>
    </button>
  );
}

function HeaderTrailingMorph({ newestFirst, onSort, onSettings }: { newestFirst?: boolean; onSort?(): void; onSettings?(): void }) {
  if (onSort) {
    return (
      <HeaderActionButton
        className="history-sort-button"
        icon="filter"
        onClick={onSort}
        label={newestFirst ? "Сначала старые" : "Сначала новые"}
        flipped={newestFirst === false}
      />
    );
  }

  if (onSettings) {
    return (
      <HeaderActionButton
        className="profile-settings-button"
        icon="settings"
        onClick={onSettings}
        label="Настройки"
      />
    );
  }

  return <span className="page-header-spacer page-header-action-pivot" aria-hidden="true" />;
}

function HeaderProfileAvatar({ value, back }: { value: string | null; back: boolean }) {
  const reduceMotion = useReducedMotion();
  const morphTransition = reduceMotion
    ? { duration: 0.12, ease: easeOut }
    : { duration: 0.24, ease: easeInOut };
  return (
    <motion.span
      className={`header-profile-avatar header-leading-surface${back ? " header-leading-surface-back" : ""}`}
      layoutId={reduceMotion ? undefined : "profile-avatar-surface"}
      transition={{ layout: morphTransition }}
      aria-hidden="true"
    >
      <motion.span
        className="header-leading-avatar-background"
        animate={{ opacity: back ? 0 : 1, transform: reduceMotion || !back ? "scale(1)" : "scale(0.72)" }}
        transition={morphTransition}
      />
      <motion.span
        className="header-leading-custom-avatar"
        animate={{ opacity: back ? 0 : 1, transform: reduceMotion || !back ? "scale(1)" : "scale(0.72)" }}
        transition={morphTransition}
      >
        <ProfileAvatarContent value={value} defaultIconSize={22} />
      </motion.span>
      <motion.svg className="header-leading-morph-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
        {back ? (
          <motion.path
            d="m15 18-6-6 6-6"
            initial={{ opacity: 0, pathLength: 0, transform: reduceMotion ? "scale(1)" : "scale(0.72)" }}
            animate={{ opacity: 1, pathLength: 1, transform: "scale(1)" }}
            transition={morphTransition}
          />
        ) : null}
      </motion.svg>
    </motion.span>
  );
}

export function HeaderAvatarBackMorph({ value, onBack, className = "" }: { value: string | null; onBack?(): void; className?: string }) {
  const classes = ["header-profile-button", "header-profile-static", "header-leading-slot", className].filter(Boolean).join(" ");
  return (
    <span className={classes}>
      <HeaderProfileAvatar value={value} back={Boolean(onBack)} />
      {onBack ? <button className="header-leading-action" type="button" aria-label="Назад" title="Назад" onClick={onBack} /> : null}
    </span>
  );
}

export function PageHeader({ title, sticky = false, onBack, profileAvatar, sortNewestFirst, onSort, onSettings }: { title: string; sticky?: boolean; onBack?(): void; profileAvatar?: string | null; sortNewestFirst?: boolean; onSort?(): void; onSettings?(): void }) {
  return (
    <header className={sticky ? "page-header page-header-sticky" : "page-header"}>
      {profileAvatar !== undefined ? (
        <HeaderAvatarBackMorph value={profileAvatar} onBack={onBack} />
      ) : onBack ? (
        <button type="button" aria-label="Назад" title="Назад" onClick={onBack}>
          <AppIcon name="chevron-left" size={30} aria-hidden="true" />
        </button>
      ) : (
        <span className="page-header-spacer" aria-hidden="true" />
      )}
      <ScreenTitle>{title}</ScreenTitle>
      <HeaderTrailingMorph newestFirst={sortNewestFirst} onSort={onSort} onSettings={onSettings} />
    </header>
  );
}
