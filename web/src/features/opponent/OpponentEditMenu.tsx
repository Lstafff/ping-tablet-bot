import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { AppIcon } from "../../components/AppIcon";
import { NumericKeypad } from "../../components/NumericKeypad";
import { MorphingHeading } from "../../components/PageHeader";
import { SegmentedControl } from "../../components/SegmentedControl";
import { easeOut } from "../../lib/motion";
import { useModalDialog } from "../../lib/dialog";
import { tma } from "../../lib/tma";
import type { ScoreSide } from "../score/ScoreDrawer";
import "../../components/ActionSheet.css";
import "./opponent.css";

export type OpponentEditSheet = "actions" | "games" | "points" | "reset" | "delete" | null;

export function linkedStatsPolicyText(action: "reset" | "delete", opponentName: string): string {
  const localAction = action === "delete"
    ? `${opponentName} исчезнет только из вашего списка.`
    : `Ваша статистика с ${opponentName} обнулится.`;
  return `${localAction} Если данные останутся у соперника, они вернутся после новой партии. Если их не останется у вас обоих, счёт начнётся с нуля.`;
}

function PairKeypadEditor({
  ariaLabel,
  keypadLabel,
  opponentName,
  own,
  opponent,
  side,
  submitting,
  onSide,
  onDigit,
  onErase,
  onSave,
}: {
  ariaLabel: string;
  keypadLabel: string;
  opponentName: string;
  own: string;
  opponent: string;
  side: ScoreSide;
  submitting: boolean;
  onSide(side: ScoreSide): void;
  onDigit(digit: string): void;
  onErase(): void;
  onSave(): void;
}) {
  return (
    <div className="opponent-edit-form">
      <SegmentedControl<ScoreSide>
        ariaLabel={ariaLabel}
        className="pair-keypad-switch"
        semantic="choice"
        tone="dark"
        value={side}
        options={([
          { value: "own" as const, label: "Ты", score: own },
          { value: "opponent" as const, label: opponentName, score: opponent },
        ]).map((option) => ({
          value: option.value,
          label: <><span>{option.label}</span><strong>{option.score || "0"}</strong></>,
        }))}
        onChange={onSide}
      />
      <NumericKeypad ariaLabel={keypadLabel} onDigit={onDigit} onErase={onErase} />
      <button className="sheet-primary-button" type="button" onClick={onSave} disabled={submitting || !own || !opponent}>Сохранить</button>
    </div>
  );
}

export function OpponentEditMenu(props: {
  mode: Exclude<OpponentEditSheet, null>;
  opponentName: string;
  gamesTotal: string;
  pointsTotal: string;
  submitting: boolean;
  onClose(): void;
  onBack(): void;
  onMode(mode: Exclude<OpponentEditSheet, null>): void;
  onGamesTotal(value: string): void;
  onPointsTotal(value: string): void;
  onSaveGames(): void;
  onSavePoints(): void;
  onConfirm(): void;
}) {
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLElement>(null);
  const previousMode = useRef<OpponentEditSheet>(null);
  useModalDialog(true, props.onClose, dialogRef);
  const mode = props.mode;
  const stateDirection = previousMode.current === null ? 0 : mode === "actions" ? -1 : 1;
  const [pairSide, setPairSide] = useState<ScoreSide>("own");
  const touchedPairSides = useRef<Set<ScoreSide>>(new Set());
  const titles: Record<Exclude<OpponentEditSheet, null>, string> = {
    actions: "Что изменить?",
    games: "Изменить счёт",
    points: "Изменить мячи",
    reset: "Сбросить статистику",
    delete: "Удалить соперника",
  };
  const isRoot = mode === "actions";
  const isDanger = mode === "reset" || mode === "delete";
  const pairMode = mode === "games" || mode === "points" ? mode : null;
  const pairValue = mode === "games" ? props.gamesTotal : props.pointsTotal;
  const [pairOwn = "", pairOpponent = ""] = pairValue.split(/[-:]/, 2);
  const updatePair = (own: string, opponent: string) => {
    const next = `${own}-${opponent}`;
    if (mode === "games") props.onGamesTotal(next);
    if (mode === "points") props.onPointsTotal(next);
  };
  const enterPairDigit = (digit: string) => {
    const current = pairSide === "own" ? pairOwn : pairOpponent;
    const next = touchedPairSides.current.has(pairSide) ? `${current}${digit}`.slice(0, 4) : digit;
    touchedPairSides.current.add(pairSide);
    if (pairSide === "own") updatePair(next, pairOpponent);
    else updatePair(pairOwn, next);
    tma.haptic.impact("light");
  };
  const erasePairDigit = () => {
    const current = pairSide === "own" ? pairOwn : pairOpponent;
    const next = touchedPairSides.current.has(pairSide) ? current.slice(0, -1) : "";
    touchedPairSides.current.add(pairSide);
    if (pairSide === "own") updatePair(next, pairOpponent);
    else updatePair(pairOwn, next);
  };

  useEffect(() => {
    if (mode !== "games" && mode !== "points") return;
    setPairSide("own");
    touchedPairSides.current = new Set();
  }, [mode]);

  useEffect(() => {
    previousMode.current = mode;
  }, [mode]);

  const stateVariants = {
    enter: (direction: number) => ({
      opacity: direction === 0 ? 1 : 0,
      transform: reduceMotion || direction === 0 ? "translateX(0)" : `translateX(${direction * 8}px)`,
      filter: reduceMotion || direction === 0 ? "none" : "blur(3px)",
    }),
    center: { opacity: 1, transform: "translateX(0)", filter: "none" },
    exit: (direction: number) => ({
      opacity: direction === 0 ? 1 : 0,
      transform: reduceMotion || direction === 0 ? "translateX(0)" : `translateX(${-direction * 8}px)`,
      filter: reduceMotion || direction === 0 ? "none" : "blur(3px)",
    }),
  };

  return (
    <motion.div
      className="action-overlay"
      role="presentation"
      onClick={props.onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduceMotion ? 0.12 : 0.15, ease: [0.22, 1, 0.36, 1] } }}
      transition={{ duration: reduceMotion ? 0.12 : 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.section
        ref={dialogRef}
        tabIndex={-1}
        className="action-sheet action-sheet-root opponent-edit-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={titles[mode]}
        onClick={(event) => event.stopPropagation()}
        initial={{ opacity: 0, transform: reduceMotion ? "translateY(0) scale(1)" : "translateY(12px) scale(0.96)" }}
        animate={{ opacity: 1, transform: "translateY(0) scale(1)" }}
        exit={{ opacity: 0, transform: reduceMotion ? "translateY(0) scale(1)" : "translateY(12px) scale(0.96)", transition: { duration: reduceMotion ? 0.12 : 0.15, ease: [0.22, 1, 0.36, 1] } }}
        transition={{ duration: reduceMotion ? 0.12 : 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        <AnimatePresence initial={false} mode="popLayout" custom={stateDirection}>
        <motion.div
          className="action-sheet-content action-sheet-state"
          key={mode}
          custom={stateDirection}
          variants={stateVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduceMotion ? 0.12 : 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <header>
            <MorphingHeading as="h2">{titles[mode]}</MorphingHeading>
            <button className="modal-icon-button" type="button" aria-label={isRoot ? "Закрыть" : "Назад"} onClick={isRoot ? props.onClose : props.onBack}>
              <motion.span
                className="action-header-icon"
                key={isRoot ? "close" : "back"}
                initial={{ opacity: 0, transform: reduceMotion ? "rotate(0deg) scale(1)" : "rotate(-45deg) scale(0.94)" }}
                animate={{ opacity: 1, transform: "rotate(0deg) scale(1)" }}
                transition={{ duration: 0.18, ease: easeOut }}
              >
                <AppIcon name={isRoot ? "x" : "arrow-left"} size={20} />
              </motion.span>
            </button>
          </header>
          <div className="action-sheet-panel">
                  {mode === "actions" ? (
                    <div className="action-list opponent-edit-list">
                      <button type="button" onClick={() => props.onMode("games")}><span className="action-icon action-icon-blue"><AppIcon name="award" size={25} /></span><span><strong>Общий счёт партий</strong><small>Не повлияет на ELO</small></span></button>
                      <button type="button" onClick={() => props.onMode("points")}><span className="action-icon action-icon-green"><AppIcon name="circle-pile" size={25} /></span><span><strong>Количество мячей</strong><small>Не повлияет на ELO</small></span></button>
                      <button type="button" onClick={() => props.onMode("reset")}><span className="action-icon action-icon-gray"><AppIcon name="refresh" size={25} /></span><span><strong>Обнулить статистику</strong><small>Только у себя, не изменит ELO</small></span></button>
                      <button type="button" onClick={() => props.onMode("delete")}><span className="action-icon action-icon-red"><AppIcon name="trash" size={24} /></span><span><strong>Удалить соперника</strong><small>Только у себя, не изменит ELO</small></span></button>
                    </div>
                  ) : null}
                  {pairMode ? (
                    <PairKeypadEditor
                      ariaLabel={`${pairMode === "games" ? "Счёт матчей" : "Счёт мячей"}: ты и ${props.opponentName}`}
                      keypadLabel={pairMode === "games" ? "Клавиатура итога матчей" : "Клавиатура итога мячей"}
                      opponentName={props.opponentName}
                      own={pairOwn}
                      opponent={pairOpponent}
                      side={pairSide}
                      submitting={props.submitting}
                      onSide={setPairSide}
                      onDigit={enterPairDigit}
                      onErase={erasePairDigit}
                      onSave={pairMode === "games" ? props.onSaveGames : props.onSavePoints}
                    />
                  ) : null}
                  {isDanger ? (
                    <div className="opponent-edit-confirm">
                      <p>{linkedStatsPolicyText(mode, props.opponentName)}</p>
                      <button className="sheet-danger-button" type="button" onClick={props.onConfirm} disabled={props.submitting}>{props.submitting ? (mode === "delete" ? "Удаляем…" : "Сбрасываем…") : mode === "delete" ? "Удалить" : "Сбросить"}</button>
                    </div>
                  ) : null}
          </div>
        </motion.div>
        </AnimatePresence>
      </motion.section>
    </motion.div>
  );
}
