import { AnimatePresence, LayoutGroup, animate, useMotionValue, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { memo, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { Drawer } from "vaul";

import { AnimatedNumber } from "../../components/AnimatedNumber";
import { AppIcon } from "../../components/AppIcon";
import { NumericKeypad } from "../../components/NumericKeypad";
import { ScorePair } from "../../components/ScoreDisplay";
import { SegmentedControl } from "../../components/SegmentedControl";
import { easeInOut, easeOut } from "../../lib/motion";
import "./scoreDrawer.css";

export type ScoreSide = "own" | "opponent";

const scoreRules = [
  {
    icon: "target" as const,
    title: "До 10 : 10",
    description: "Партия заканчивается, когда игрок набирает 11 очков и опережает соперника минимум на 2.",
  },
  {
    icon: "zap" as const,
    title: "После 10 : 10",
    description: "Игра продолжается до преимущества в 2 очка: 12 : 10, 13 : 11 и дальше.",
  },
  {
    icon: "crown" as const,
    title: "Без ничьей",
    description: "В завершённой партии всегда есть победитель.",
  },
] as const;

function ScoreValidationSnackbar({ message }: { message: string }) {
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const wasExpanded = useRef(false);
  const dragY = useMotionValue(0);
  const swipeStart = useRef<{ pointerId: number; y: number; at: number } | null>(null);
  const layoutTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.24, ease: easeInOut };

  useEffect(() => {
    if (!message) setExpanded(false);
  }, [message]);

  useEffect(() => {
    if (expanded) {
      wasExpanded.current = true;
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>(".score-validation-expanded")?.focus());
    } else if (wasExpanded.current) {
      wasExpanded.current = false;
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>(".score-validation-compact")?.focus());
    }
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setExpanded(false);
      } else if (event.key === "Tab") {
        event.preventDefault();
        document.querySelector<HTMLElement>(".score-validation-expanded")?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expanded]);

  const startSwipe = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    const surface = event.currentTarget;
    try {
      surface.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer events in browser tests do not create an active pointer.
    }
    swipeStart.current = { pointerId: event.pointerId, y: event.clientY, at: performance.now() };
  }, []);
  const moveSwipe = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    const start = swipeStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const distance = event.clientY - start.y;
    dragY.set(expanded ? Math.max(-12, Math.min(76, distance)) : Math.max(-76, Math.min(12, distance)));
  }, [dragY, expanded]);
  const finishSwipe = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    const start = swipeStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    swipeStart.current = null;
    const distance = event.clientY - start.y;
    const velocity = distance / Math.max(1, performance.now() - start.at);
    const completes = expanded ? distance >= 28 || velocity >= 0.42 : distance <= -28 || velocity <= -0.42;
    if (completes) {
      dragY.set(0);
      setExpanded(!expanded);
    } else if (reduceMotion) dragY.set(0);
    else animate(dragY, 0, { type: "spring", stiffness: 460, damping: 38 });
  }, [dragY, expanded, reduceMotion]);
  const cancelSwipe = useCallback(() => {
    swipeStart.current = null;
    dragY.set(0);
  }, [dragY]);

  return (
    <LayoutGroup id="score-validation" inherit={false}>
      <AnimatePresence>
        {message ? (
        <m.div
          className={expanded ? "score-validation-layer score-validation-layer-expanded" : "score-validation-layer"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.18, ease: easeOut }}
        >
          <AnimatePresence>
            {expanded ? (
              <m.div
                className="score-validation-backdrop"
                role="presentation"
                aria-hidden="true"
                onClick={() => setExpanded(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0.12 : 0.18, ease: easeOut }}
              />
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {expanded ? (
              <m.section
                className="score-validation-surface score-validation-expanded"
                key="expanded"
                layout
                layoutId="score-validation-surface"
                role="dialog"
                aria-modal="true"
                aria-label="Правила счёта"
                tabIndex={-1}
                style={{ y: dragY }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ layout: layoutTransition, opacity: { duration: reduceMotion ? 0.12 : 0.18, ease: easeOut } }}
              >
                <m.div
                  className="score-rules-list"
                  initial={{ opacity: 0, transform: reduceMotion ? "translateY(0px)" : "translateY(6px)" }}
                  animate={{ opacity: 1, transform: "translateY(0px)" }}
                  exit={{ opacity: 0, transform: reduceMotion ? "translateY(0px)" : "translateY(-6px)" }}
                  transition={{ duration: reduceMotion ? 0.12 : 0.18, delay: reduceMotion ? 0 : 0.04, ease: easeOut }}
                >
                  {scoreRules.map((rule) => (
                    <div className="score-rule" key={rule.title}>
                      <span aria-hidden="true"><AppIcon name={rule.icon} size={23} /></span>
                      <div><strong>{rule.title}</strong><p>{rule.description}</p></div>
                    </div>
                  ))}
                </m.div>
                <div
                  className="score-validation-handle"
                  aria-hidden="true"
                >
                  <span aria-hidden="true" />
                </div>
                <div
                  className="score-validation-gesture-layer"
                  aria-hidden="true"
                  onPointerDown={startSwipe}
                  onPointerMove={moveSwipe}
                  onPointerUp={finishSwipe}
                  onPointerCancel={cancelSwipe}
                />
              </m.section>
            ) : (
              <m.div
                className="score-validation-surface score-validation-compact"
                key="compact"
                layout
                layoutId="score-validation-surface"
                role="alert"
                aria-label={`${message}. Проведи вверх, чтобы показать правила счёта`}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setExpanded(true);
                  }
                }}
                style={{ y: dragY }}
                initial={{ opacity: 0, transform: reduceMotion ? "translateY(0px) scale(1)" : "translateY(-8px) scale(0.96)" }}
                animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
                exit={{ opacity: 0, transform: reduceMotion ? "translateY(0px) scale(1)" : "translateY(-8px) scale(0.96)" }}
                transition={{ layout: layoutTransition, opacity: { duration: reduceMotion ? 0.12 : 0.18, ease: easeOut }, transform: { duration: reduceMotion ? 0.12 : 0.18, ease: easeOut } }}
              >
                <span>{message}</span>
                <span className="score-validation-info" aria-hidden="true">
                  <m.span layoutId="score-validation-info"><AppIcon name="info" size={21} /></m.span>
                </span>
                <div
                  className="score-validation-gesture-layer"
                  aria-hidden="true"
                  onPointerDown={startSwipe}
                  onPointerMove={moveSwipe}
                  onPointerUp={finishSwipe}
                  onPointerCancel={cancelSwipe}
                />
              </m.div>
            )}
          </AnimatePresence>
        </m.div>
        ) : null}
      </AnimatePresence>
    </LayoutGroup>
  );
}

export const ScoreDrawer = memo(function ScoreDrawer(props: {
  open: boolean;
  opponentName: string;
  ownScore: string;
  opponentScore: string;
  side: ScoreSide;
  submitting: boolean;
  validationMessage: string;
  onOpenChange(open: boolean): void;
  onDigit(digit: string): void;
  onErase(): void;
  onContinue(): void;
  onBack(): void;
  onClose(): void;
  onSide(side: ScoreSide): void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <Drawer.Root
      open={props.open}
      onOpenChange={props.onOpenChange}
      fixed
      repositionInputs={false}
      shouldScaleBackground={!reduceMotion}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="score-drawer-overlay" />
        <Drawer.Content className="score-drawer-content">
          <Drawer.Title className="visually-hidden">Добавление счёта с {props.opponentName}</Drawer.Title>
          <Drawer.Description className="visually-hidden">Введи свой счёт и счёт соперника</Drawer.Description>
          <Drawer.Handle className="score-drawer-handle" aria-label="Потянуть, чтобы закрыть" />
          <ScoreScreen {...props} />
          <ScoreValidationSnackbar message={props.validationMessage} />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
});

function ScoreScreen(props: {
  opponentName: string;
  ownScore: string;
  opponentScore: string;
  side: ScoreSide;
  submitting: boolean;
  onDigit(digit: string): void;
  onErase(): void;
  onContinue(): void;
  onBack(): void;
  onClose(): void;
  onSide(side: ScoreSide): void;
}) {
  const current = props.side === "own" ? props.ownScore : props.opponentScore;
  const canContinue = props.side === "own" ? Boolean(props.ownScore) : Boolean(props.ownScore && props.opponentScore);

  return (
    <m.section className="score-screen">
      <header className="score-header">
        <button type="button" aria-label="Назад" onClick={props.onBack}><AppIcon name="arrow-left" size={29} /></button>
        <h1><strong>Добавление счёта</strong><small>с&nbsp;{props.opponentName}</small></h1>
        <button type="button" aria-label="Закрыть" onClick={props.onClose}><AppIcon name="x" size={30} /></button>
      </header>
      <div className="score-value" aria-live="polite"><AnimatedNumber value={current || "0"} /></div>
      <p className="score-progress">
        <ScorePair
          left={<AnimatedNumber value={props.ownScore || "0"} />}
          right={<AnimatedNumber value={props.opponentScore || "0"} />}
        />
      </p>
      <SegmentedControl
        ariaLabel="Выбор игрока"
        className="score-player-switch"
        semantic="choice"
        tone="dark"
        value={props.side}
        options={[
          { value: "own", label: "Ты" },
          { value: "opponent", label: "Противник" },
        ]}
        onChange={props.onSide}
      />
      <NumericKeypad ariaLabel="Клавиатура счёта" onDigit={props.onDigit} onErase={props.onErase} />
      <button className="score-continue" type="button" disabled={!canContinue || props.submitting} onClick={props.onContinue}>{props.submitting ? "Сохраняем…" : props.side === "own" ? "Дальше" : "Сохранить"}</button>
    </m.section>
  );
}
