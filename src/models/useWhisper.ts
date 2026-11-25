import { useCallback, useEffect, useRef, useState } from 'react';
import { initWhisper, type WhisperContext } from 'whisper.rn';

import { useIdleTimer } from '@/memory/useIdleTimer';

import type { ModelInfo } from './registry';
import { getModelFile } from './useModelDownload';

export type WhisperStatus = 'idle' | 'loading' | 'ready' | 'transcribing' | 'error';

/** 'auto' lets Whisper detect the spoken language itself. */
export type SpeechLanguage = 'auto' | 'en' | 'ar';

export type TranscriptionStats = {
  /** How long the model took to turn the audio into text. */
  processingMs: number;
  detectedLanguage: string;
};

// expo-audio returns "file:/data/..." (one slash, Java's File.toURI format), but
// whisper.rn only strips "file://", so it would try to open "file:/data/..." and fail
// with "Invalid WAV file". Convert either form to a plain filesystem path.
function toLocalPath(uri: string) {
  return decodeURIComponent(uri.replace(/^file:(\/\/)?/, ''));
}

export function useWhisper(model: ModelInfo) {
  const [status, setStatus] = useState<WhisperStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState('');
  const [stats, setStats] = useState<TranscriptionStats | null>(null);
  const contextRef = useRef<WhisperContext | null>(null);
  /** In-flight load, shared so release() can wait for it and free what it loaded. */
  const loadRef = useRef<Promise<WhisperContext | null> | null>(null);
  const releaseRef = useRef<() => Promise<void>>(async () => undefined);
  const stopRef = useRef<(() => Promise<void>) | null>(null);
  // Unload the model after it sits unused for a while (see MODEL_IDLE_RELEASE_MS).
  const idleTimer = useIdleTimer(() => void release());

  // Free the model's RAM when the screen closes (waits for an in-flight load too).
  useEffect(() => () => void releaseRef.current(), []);

  const loadModel = useCallback(async () => {
    if (contextRef.current) return contextRef.current;
    setStatus('loading');
    try {
      const context = await initWhisper({ filePath: getModelFile(model).uri });
      contextRef.current = context;
      setStatus('ready');
      return context;
    } catch (e) {
      console.warn('Failed to load Whisper model', e);
      setStatus('error');
      return null;
    }
  }, [model]);

  const load = useCallback(() => {
    loadRef.current ??= loadModel().finally(() => {
      loadRef.current = null;
    });
    return loadRef.current;
  }, [loadModel]);

  /** Transcribes a 16-bit WAV file. whisper.rn resamples to 16 kHz mono itself. */
  const transcribe = useCallback(
    async (audioUri: string, language: SpeechLanguage) => {
      idleTimer.cancel();
      const context = contextRef.current ?? (await load());
      // Null if loading failed; a different ref means it was released while loading.
      if (!context || contextRef.current !== context) return;

      setText('');
      setStats(null);
      setProgress(0);
      setStatus('transcribing');
      const startedAt = Date.now();
      try {
        const { stop, promise } = context.transcribe(toLocalPath(audioUri), {
          language,
          onProgress: setProgress,
          // Show text as soon as each sentence is ready instead of waiting for the end.
          onNewSegments: ({ result }) => setText(result.trim()),
        });
        stopRef.current = stop;
        const result = await promise;
        stopRef.current = null;
        setText(result.result.trim());
        setStats({ processingMs: Date.now() - startedAt, detectedLanguage: result.language });
        // If the model was released mid-run (app backgrounded / memory warning), it's no longer loaded.
        const stillLoaded = contextRef.current === context;
        setStatus(stillLoaded ? 'ready' : 'idle');
        if (stillLoaded) idleTimer.restart();
      } catch (e) {
        stopRef.current = null;
        if (contextRef.current !== context) {
          setStatus('idle');
          return;
        }
        console.warn('Transcription failed', e);
        setStatus('error');
        idleTimer.restart();
      }
    },
    [load, idleTimer],
  );

  const stop = useCallback(() => {
    void stopRef.current?.();
  }, []);

  /** Stops any transcription and frees the model's RAM. It reloads on the next recording. */
  const release = useCallback(async () => {
    idleTimer.cancel();
    // If a load is in flight, let it finish so we free what it loaded instead of leaking it.
    await loadRef.current?.catch(() => null);
    const context = contextRef.current;
    if (!context) return;
    contextRef.current = null;
    await stopRef.current?.().catch(() => undefined);
    stopRef.current = null;
    await context.release();
    setStatus('idle');
  }, [idleTimer]);
  releaseRef.current = release;

  return { status, progress, text, stats, load, transcribe, stop, release };
}
