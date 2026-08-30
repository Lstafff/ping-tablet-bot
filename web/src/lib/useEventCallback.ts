import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Keeps callback identity stable while always calling the latest render's logic.
 * Useful at memoized feature boundaries where overlay state must not rerender the
 * screen behind it.
 */
export function useEventCallback<Args extends unknown[], Result>(
  handler: (...args: Args) => Result,
): (...args: Args) => Result {
  const handlerRef = useRef(handler);

  useLayoutEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  return useCallback((...args: Args) => handlerRef.current(...args), []);
}
