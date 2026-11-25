import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import MemoryInfo from '../../modules/memory-info';

/**
 * Calls `release` (free the loaded model) when:
 * - the app goes to the background, so Android/iOS don't kill it while you're elsewhere;
 * - the OS sends a memory warning.
 * Returns true after a memory warning so the screen can tell the user what happened.
 */
export function useMemoryGuard(release: () => void | Promise<void>) {
  const [releasedForPressure, setReleasedForPressure] = useState(false);
  const releaseRef = useRef(release);
  releaseRef.current = release;

  useEffect(() => {
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'background') void releaseRef.current();
    });
    const pressure = MemoryInfo.addListener('onMemoryPressure', (event) => {
      void releaseRef.current();
      // Android also sends a trim signal routinely after the app is backgrounded; the
      // model is already released then, so only tell the user if they're in the app.
      if (AppState.currentState === 'active') {
        console.warn('Memory pressure from OS, released model', event);
        setReleasedForPressure(true);
      }
    });
    return () => {
      appState.remove();
      pressure.remove();
    };
  }, []);

  return { releasedForPressure, dismiss: () => setReleasedForPressure(false) };
}
