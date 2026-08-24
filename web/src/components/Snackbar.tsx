import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { AppIcon } from "./AppIcon";
import { easeOut } from "../lib/motion";
import "./Snackbar.css";

export type SnackbarTone = "neutral" | "success" | "error";

export function Snackbar({
  message,
  tone = "neutral",
  onDismiss,
}: {
  message: string;
  tone?: SnackbarTone;
  onDismiss(): void;
}) {
  const reduceMotion = useReducedMotion();
  const onDismissRef = useRef(onDismiss);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!message || paused) return;
    const timeout = window.setTimeout(() => onDismissRef.current(), 4200);
    return () => window.clearTimeout(timeout);
  }, [message, paused]);

  return (
    <AnimatePresence>
      {message ? (
        <motion.div className="app-snackbar-layer">
          <motion.div
            className={`app-snackbar app-snackbar-${tone}`}
            role={tone === "error" ? "alert" : "status"}
            aria-live={tone === "error" ? "assertive" : "polite"}
            drag={reduceMotion ? false : "y"}
            dragConstraints={{ top: -48, bottom: 48 }}
            dragElastic={0.16}
            onDragEnd={(_, info) => {
              if (Math.abs(info.offset.y) >= 32 || Math.abs(info.velocity.y) >= 420) onDismiss();
            }}
            initial={{ opacity: 0, y: reduceMotion ? 0 : -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.18, ease: easeOut }}
            onPointerEnter={() => setPaused(true)}
            onPointerLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
            }}
          >
            <span>{message}</span>
            <button type="button" aria-label="Закрыть уведомление" onClick={onDismiss}>
              <AppIcon name="x" size={18} />
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
