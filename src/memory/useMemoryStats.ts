import { useEffect, useState } from 'react';

import MemoryInfo, { type MemorySnapshot } from '../../modules/memory-info';

/** Polls the app's RAM usage. One second is frequent enough to see a model load. */
export function useMemoryStats(intervalMs = 1000) {
  const [snapshot, setSnapshot] = useState<MemorySnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    const read = () =>
      MemoryInfo.getMemoryAsync()
        .then((next) => !cancelled && setSnapshot(next))
        .catch((e) => console.warn('Could not read memory', e));

    void read();
    const timer = setInterval(read, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [intervalMs]);

  return snapshot;
}
