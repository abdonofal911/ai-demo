import { useCallback, useEffect, useMemo, useRef } from 'react';

/**
 * How long a loaded model may sit unused before we free its RAM.
 * Long enough that back-to-back runs stay instant, short enough that the
 * ~1.5 GB a model holds isn't kept while the user just reads the result.
 */
export const MODEL_IDLE_RELEASE_MS = 30_000;

/** A restartable timer: call `restart()` after each use; `onIdle` fires if nothing restarts it in time. */
export function useIdleTimer(onIdle: () => void, ms = MODEL_IDLE_RELEASE_MS) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);
  useEffect(() => {
    onIdleRef.current = onIdle;
  });

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const restart = useCallback(() => {
    cancel();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onIdleRef.current();
    }, ms);
  }, [cancel, ms]);

  useEffect(() => cancel, [cancel]);

  return useMemo(() => ({ restart, cancel }), [restart, cancel]);
}
