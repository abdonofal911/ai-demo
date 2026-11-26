import { Directory, File, Paths, type DownloadTask } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ModelInfo } from './registry';

export type DownloadStatus = 'missing' | 'downloading' | 'paused' | 'ready' | 'error';

export type DownloadError = 'noSpace' | 'failed' | 'incomplete';

const modelsDir = () => new Directory(Paths.document, 'models');

export function getModelFile(model: ModelInfo) {
  return new File(modelsDir(), model.fileName);
}

function isComplete(model: ModelInfo) {
  const file = getModelFile(model);
  return file.exists && file.size === model.sizeBytes;
}

export function useModelDownload(model: ModelInfo) {
  const [status, setStatus] = useState<DownloadStatus>(() =>
    isComplete(model) ? 'ready' : 'missing',
  );
  const [bytesWritten, setBytesWritten] = useState(0);
  const [error, setError] = useState<DownloadError | null>(null);
  const taskRef = useRef<DownloadTask | null>(null);

  /** Re-checks the file on disk (e.g. after the model was downloaded on another screen). */
  const refresh = useCallback(() => {
    setStatus((current) =>
      current === 'downloading' || current === 'paused' ? current : isComplete(model) ? 'ready' : 'missing',
    );
  }, [model]);

  // Stop an in-flight download if the user leaves the screen.
  useEffect(() => () => taskRef.current?.cancel(), []);

  // Runs after downloadAsync/resumeAsync settles. `null` means the task was paused.
  const handleResult = useCallback(
    async (task: DownloadTask, run: Promise<File | null>) => {
      try {
        const file = await run;
        if (file === null) return;
        if (taskRef.current === task) taskRef.current = null;
        if (isComplete(model)) {
          setStatus('ready');
        } else {
          getModelFile(model).delete();
          setError('incomplete');
          setStatus('error');
        }
      } catch (e) {
        // Cancelling rejects the pending promise; that's expected, not an error.
        if (task.state === 'cancelled' || taskRef.current !== task) return;
        console.warn('Model download failed', e);
        taskRef.current = null;
        setError('failed');
        setStatus('error');
      }
    },
    [model],
  );

  const start = useCallback(() => {
    setError(null);
    // Keep 200 MB headroom on top of the model so the phone isn't left completely full.
    if (Paths.availableDiskSpace < model.sizeBytes + 200 * 1024 ** 2) {
      setError('noSpace');
      setStatus('error');
      return;
    }

    const dir = modelsDir();
    if (!dir.exists) dir.create({ intermediates: true });
    const file = getModelFile(model);
    if (file.exists) file.delete();

    const task = File.createDownloadTask(model.url, file, {
      onProgress: ({ bytesWritten: written }) => setBytesWritten(written),
    });
    taskRef.current = task;
    setBytesWritten(0);
    setStatus('downloading');
    void handleResult(task, task.downloadAsync());
  }, [model, handleResult]);

  const pause = useCallback(async () => {
    await taskRef.current?.pauseAsync();
    setStatus('paused');
  }, []);

  const resume = useCallback(() => {
    const task = taskRef.current;
    if (!task) return;
    setStatus('downloading');
    void handleResult(task, task.resumeAsync());
  }, [handleResult]);

  const cancel = useCallback(() => {
    taskRef.current?.cancel();
    taskRef.current = null;
    const file = getModelFile(model);
    if (file.exists) file.delete();
    setBytesWritten(0);
    setStatus('missing');
  }, [model]);

  const remove = useCallback(() => {
    const file = getModelFile(model);
    if (file.exists) file.delete();
    setStatus('missing');
  }, [model]);

  return {
    status,
    error,
    bytesWritten,
    progress: Math.min(bytesWritten / model.sizeBytes, 1),
    refresh,
    start,
    pause,
    resume,
    cancel,
    remove,
  };
}
