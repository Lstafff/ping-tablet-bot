import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { type FormEvent, useEffect, useRef, useState } from "react";

import type { Opponent } from "../../api/types";
import avatarEmojis from "../../avatar-emojis.json";
import { AppIcon } from "../../components/AppIcon";
import { MorphingHeading } from "../../components/PageHeader";
import { ProfileAvatarContent } from "../../components/ProfileAvatar";
import { ScorePair } from "../../components/ScoreDisplay";
import { useModalDialog } from "../../lib/dialog";
import { easeOut } from "../../lib/motion";
import { opponentName } from "../../lib/player";
// @ts-ignore The existing Deslop kit is JavaScript-only.
import { GlassContainer } from "../../../mini-app/components/GlassEffect";
import "../../components/ActionSheet.css";
import "./actionMenu.css";

export type ActionSheet = "actions" | "opponents" | "share" | "accept" | null;

const EMOJI_BATCH_SIZE = 320;

export function AvatarPicker(props: { open: boolean; submitting: boolean; onClose(): void; onEmoji(value: string): void }) {
  const reduceMotion = useReducedMotion();
  const [visibleEmojiCount, setVisibleEmojiCount] = useState(EMOJI_BATCH_SIZE);
  const dialogRef = useRef<HTMLElement>(null);
  useModalDialog(props.open, props.onClose, dialogRef);

  useEffect(() => {
    if (props.open) setVisibleEmojiCount(EMOJI_BATCH_SIZE);
  }, [props.open]);

  return (
    <AnimatePresence>
      {props.open ? (
        <motion.div
          className="avatar-picker-overlay"
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
            className="avatar-picker"
            role="dialog"
            aria-modal="true"
            aria-label="Выбрать аватар"
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, transform: reduceMotion ? "translateY(0) scale(1)" : "translateY(12px) scale(0.96)" }}
            animate={{ opacity: 1, transform: "translateY(0) scale(1)" }}
            exit={{ opacity: 0, transform: reduceMotion ? "translateY(0) scale(1)" : "translateY(12px) scale(0.96)", transition: { duration: reduceMotion ? 0.12 : 0.15, ease: [0.22, 1, 0.36, 1] } }}
            transition={{ duration: reduceMotion ? 0.12 : 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <header><MorphingHeading as="h2">Выбрать аватар</MorphingHeading><button className="modal-icon-button" type="button" aria-label="Закрыть" onClick={props.onClose}><AppIcon name="x" size={20} /></button></header>
            <div
              className="avatar-emoji-grid"
              aria-label="Выбрать эмодзи"
              onScroll={(event) => {
                const grid = event.currentTarget;
                if (grid.scrollHeight - grid.scrollTop - grid.clientHeight < 480) {
                  setVisibleEmojiCount((count) => Math.min(count + EMOJI_BATCH_SIZE, avatarEmojis.length));
                }
              }}
            >
              {avatarEmojis.slice(0, visibleEmojiCount).map((emoji) => <button type="button" key={emoji} aria-label={`Эмодзи ${emoji}`} disabled={props.submitting} onClick={() => props.onEmoji(emoji)}>{emoji}</button>)}
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function ActionMenu(props: {
  mode: ActionSheet;
  showTrigger: boolean;
  opponents: Opponent[];
  code: string;
  input: string;
  submitting: boolean;
  onOpen(): void;
  onClose(): void;
  onBack(): void;
  onScore(): void;
  onScoreOpponent(opponent: Opponent): void;
  onShare(): void;
  onAccept(): void;
  onInput(value: string): void;
  onCopyInvite(): void;
  onShareInvite(): void;
  onAcceptInvite(event: FormEvent<HTMLFormElement>): void;
}) {
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLElement>(null);
  const surfaceSession = useRef(0);
  const previousShowTrigger = useRef(props.showTrigger);
  useModalDialog(Boolean(props.mode), props.onClose, dialogRef);
  const dropdownEase = [0.22, 1, 0.36, 1] as const;
  const surfaceTransition = reduceMotion
    ? { duration: 0.12, ease: dropdownEase }
    : { duration: props.mode === null ? 0.15 : 0.25, ease: dropdownEase };
  const titles: Record<Exclude<ActionSheet, null>, string> = {
    actions: "Добавить",
    opponents: "Добавить счёт",
    share: "Отправить код",
    accept: "Добавить соперника",
  };
  const isRoot = props.mode === "actions";
  const previousMode = useRef<ActionSheet>(null);
  const stateDirection = previousMode.current === null ? 0 : isRoot ? -1 : 1;

  useEffect(() => {
    previousMode.current = props.mode;
  }, [props.mode]);

  if (props.showTrigger && !previousShowTrigger.current) surfaceSession.current += 1;
  previousShowTrigger.current = props.showTrigger;
  const addSurfaceLayoutId = reduceMotion ? undefined : `add-flow-surface-${surfaceSession.current}`;

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
    <LayoutGroup id="add-flow" key={surfaceSession.current}>
      <motion.div className="action-layer" layoutRoot>
        <AnimatePresence initial={false}>
      {!props.mode && props.showTrigger ? (
        <motion.div
          className="floating-add-slot"
          key="add-trigger"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: "none" }}
          transition={{ duration: reduceMotion ? 0.12 : 0.15, ease: dropdownEase }}
        >
          <div className="floating-add-scale">
            <motion.button
              className="floating-add-button"
              type="button"
              aria-label="Добавить"
              title="Добавить"
              layoutId={addSurfaceLayoutId}
              transition={{ layout: { duration: reduceMotion ? 0 : 0.15, ease: dropdownEase } }}
              onClick={(event) => {
                event.stopPropagation();
                props.onOpen();
              }}
            >
              <GlassContainer />
              <motion.span
                className="add-flow-plus"
                initial={false}
                animate={{ opacity: 1, transform: "scale(1)" }}
              >
                <AppIcon name="add" aria-hidden="true" size={32} strokeWidth={2} />
              </motion.span>
            </motion.button>
          </div>
        </motion.div>
      ) : props.mode ? (
        <motion.div
          className={isRoot ? "action-overlay" : "action-overlay action-overlay-expanded"}
          role="presentation"
          onClick={props.onClose}
        >
          <motion.section
            ref={dialogRef}
            tabIndex={-1}
            className={isRoot ? "action-sheet action-sheet-root" : "action-sheet action-sheet-expanded"}
            role="dialog"
            aria-modal="true"
            aria-label={titles[props.mode]}
            onClick={(event) => event.stopPropagation()}
            layout
            layoutId={addSurfaceLayoutId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{
              opacity: 0,
              transition: { duration: reduceMotion ? 0.12 : 0.15, ease: dropdownEase },
            }}
            transition={{ ...surfaceTransition, layout: { duration: reduceMotion ? 0 : 0.25, ease: dropdownEase } }}
          >
            <AnimatePresence initial={false} mode="popLayout" custom={stateDirection}>
              {isRoot ? (
                <motion.div
                  className="action-list add-flow-menu action-sheet-state"
                  key="actions"
                  custom={stateDirection}
                  variants={stateVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: reduceMotion ? 0.12 : 0.25, ease: dropdownEase }}
                >
                  <button type="button" onClick={props.onScore}><span className="action-icon action-icon-blue"><AppIcon name="add" size={27} /></span><span><strong>Добавить счёт</strong><small>Записать результат партии</small></span></button>
                  <button type="button" onClick={props.onShare}><span className="action-icon action-icon-green"><AppIcon name="send" size={25} /></span><span><strong>Отправить код</strong><small>Пригласить нового соперника</small></span></button>
                  <button type="button" onClick={props.onAccept}><span className="action-icon action-icon-pink"><AppIcon name="circle-plus" size={26} /></span><span><strong>Добавить соперника</strong><small>Ввести полученный код</small></span></button>
                </motion.div>
              ) : (
                <motion.div
                  className="action-sheet-content action-sheet-detail action-sheet-state"
                  key={props.mode}
                  custom={stateDirection}
                  variants={stateVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: reduceMotion ? 0.12 : 0.25, ease: dropdownEase }}
                >
                  <header>
                    <MorphingHeading as="h2">{titles[props.mode]}</MorphingHeading>
                    <motion.button
                      className="modal-icon-button"
                      type="button"
                      aria-label="Назад"
                      onClick={props.onBack}
                      initial={{ opacity: 0, transform: reduceMotion ? "scale(1)" : "scale(0.92)" }}
                      animate={{ opacity: 1, transform: "scale(1)" }}
                      transition={{ duration: reduceMotion ? 0.12 : 0.14, ease: easeOut }}
                    >
                      <AppIcon name="arrow-left" size={20} />
                    </motion.button>
                  </header>
                  <div className="action-sheet-panel">
                    {props.mode === "opponents" ? <div className="action-list opponent-picker">
                      {props.opponents.map((opponent) => <button type="button" key={opponent.id} onClick={() => props.onScoreOpponent(opponent)}><span className="avatar"><ProfileAvatarContent value={opponent.avatar_value ?? null} defaultIconSize={22} /></span><span><strong>{opponentName(opponent)}</strong><small>{opponent.stats ? <ScorePair left={opponent.stats.wins} right={opponent.stats.losses} /> : "Нет матчей"}</small></span><AppIcon name="chevron-right" size={24} /></button>)}
                      {!props.opponents.length ? <p className="muted-copy">Сначала добавь соперника по коду.</p> : null}
                    </div> : null}
                    {props.mode === "share" ? <div className="invite-sheet">
                      <strong>{props.code || "…"}</strong>
                      <div className="invite-actions">
                        <button className="sheet-primary-button" type="button" onClick={props.onCopyInvite} disabled={!props.code}>Скопировать</button>
                        <button className="sheet-telegram-button" type="button" aria-label="Отправить через Telegram" title="Отправить через Telegram" onClick={props.onShareInvite} disabled={!props.code}>
                          <AppIcon name="send" size={25} />
                        </button>
                      </div>
                    </div> : null}
                    {props.mode === "accept" ? <form className="invite-sheet invite-sheet-form" onSubmit={props.onAcceptInvite}>
                      <label htmlFor="invite-code">Код приглашения</label>
                      <input id="invite-code" value={props.input} onChange={(event) => props.onInput(event.target.value.toUpperCase())} placeholder="Например, ABC123" autoComplete="off" required />
                      <button className="sheet-primary-button" type="submit" disabled={props.submitting}>Добавить</button>
                    </form> : null}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        </motion.div>
      ) : null}
        </AnimatePresence>
      </motion.div>
    </LayoutGroup>
  );
}
