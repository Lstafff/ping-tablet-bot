import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { memo, useEffect, useRef, useState } from "react";

import avatarEmojis from "../../avatar-emojis.json";
import { AppIcon } from "../../components/AppIcon";
import { MorphingHeading } from "../../components/PageHeader";
import { useModalDialog } from "../../lib/dialog";
import "../../components/ActionSheet.css";
import "./actionMenu.css";

const EMOJI_BATCH_SIZE = 320;

export const AvatarPicker = memo(function AvatarPicker(props: { open: boolean; submitting: boolean; onClose(): void; onEmoji(value: string): void }) {
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
        <m.div
          className="avatar-picker-overlay"
          role="presentation"
          onClick={props.onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: reduceMotion ? 0.12 : 0.15, ease: [0.22, 1, 0.36, 1] } }}
          transition={{ duration: reduceMotion ? 0.12 : 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <m.section
            ref={dialogRef}
            tabIndex={-1}
            className="avatar-picker"
            role="dialog"
            aria-modal="true"
            aria-label="Выбрать аватар"
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, transform: reduceMotion ? "translateY(0px) scale(1)" : "translateY(12px) scale(0.96)" }}
            animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
            exit={{ opacity: 0, transform: reduceMotion ? "translateY(0px) scale(1)" : "translateY(12px) scale(0.96)", transition: { duration: reduceMotion ? 0.12 : 0.15, ease: [0.22, 1, 0.36, 1] } }}
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
          </m.section>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
});
