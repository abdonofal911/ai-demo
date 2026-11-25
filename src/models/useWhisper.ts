import { useCallback, useEffect, useRef, useState } from 'react';
import { initWhisper, type WhisperContext } from 'whisper.rn';

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
  const stopRef = useRef<(() => Promise<void>) | null>(null);

  // Free the model's RAM when the screen closes.
  useEffect(
    () => () => {
      void stopRef.current?.();
      const context = contextRef.current;
      contextRef.current = null;
      void context?.release();
    },
    [],
  );

  const load = useCallback(async () => {
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

  /** Transcribes a 16-bit WAV file. whisper.rn resamples to 16 kHz mono itself. */
  const transcribe = useCallback(
    async (audioUri: string, language: SpeechLanguage) => {
      const context = contextRef.current ?? (await load());
      if (!context) return;

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
        setStatus('ready');
      } catch (e) {
        stopRef.current = null;
        console.warn('Transcription failed', e);
        setStatus('error');
      }
    },
    [load],
  );

  const stop = useCallback(() => {
    void stopRef.current?.();
  }, []);

  return { status, progress, text, stats, load, transcribe, stop };
}
