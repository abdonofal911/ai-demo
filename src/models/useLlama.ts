import { initLlama, type LlamaContext } from 'llama.rn';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useIdleTimer } from '@/memory/useIdleTimer';

import type { ModelInfo } from './registry';
import { getModelFile } from './useModelDownload';

export type LlamaStatus = 'idle' | 'loading' | 'ready' | 'generating' | 'error';

export type GenerationStats = {
  tokensPerSecond: number;
  tokens: number;
  /** Time spent reading the input before the first word appears. */
  promptMs: number;
};

// Context window in tokens (input + output). 2048 is enough for ~1,200 words of
// input and keeps memory use low. Bigger = more RAM.
const CONTEXT_SIZE = 2048;
const MAX_SUMMARY_TOKENS = 300;

const SYSTEM_PROMPT =
  'You are a helpful assistant that summarizes text. ' +
  'Write a short, clear summary in 3 to 5 bullet points. ' +
  'Always answer in the same language as the text you are given.';

export function useLlama(model: ModelInfo) {
  const [status, setStatus] = useState<LlamaStatus>('idle');
  const [loadProgress, setLoadProgress] = useState(0);
  const [output, setOutput] = useState('');
  const [stats, setStats] = useState<GenerationStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const contextRef = useRef<LlamaContext | null>(null);
  /** In-flight load, shared so release() can wait for it and free what it loaded. */
  const loadRef = useRef<Promise<LlamaContext | null> | null>(null);
  const releaseRef = useRef<() => Promise<void>>(async () => undefined);
  // Unload the model after it sits unused for a while (see MODEL_IDLE_RELEASE_MS).
  const idleTimer = useIdleTimer(() => void release());

  // Free the model's RAM when the screen closes (waits for an in-flight load too).
  useEffect(() => () => void releaseRef.current(), []);

  const loadModel = useCallback(async () => {
    if (contextRef.current) return contextRef.current;
    setStatus('loading');
    setError(null);
    setLoadProgress(0);
    try {
      const context = await initLlama(
        {
          model: getModelFile(model).uri,
          n_ctx: CONTEXT_SIZE,
          // Map the file instead of copying it all into RAM, and don't pin it,
          // so Android can reclaim memory if it needs to.
          use_mmap: true,
          use_mlock: false,
          // Our Q4_K_M model isn't supported by the Android GPU backend, so run on CPU.
          n_gpu_layers: 0,
        },
        (progress) => setLoadProgress(progress),
      );
      contextRef.current = context;
      setStatus('ready');
      return context;
    } catch (e) {
      console.warn('Failed to load model', e);
      setError(String(e));
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

  const summarize = useCallback(
    async (text: string) => {
      idleTimer.cancel();
      const context = contextRef.current ?? (await load());
      // Null if loading failed; a different ref means it was released while loading.
      if (!context || contextRef.current !== context) return;

      setOutput('');
      setStats(null);
      setStatus('generating');
      try {
        const result = await context.completion(
          {
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: `Summarize this text:\n\n${text}` },
            ],
            n_predict: MAX_SUMMARY_TOKENS,
            temperature: 0.3,
          },
          // Called for every new token, so the summary appears word by word.
          (data) => setOutput((previous) => previous + data.token),
        );
        setOutput(result.text.trim());
        setStats({
          tokensPerSecond: result.timings.predicted_per_second,
          tokens: result.timings.predicted_n,
          promptMs: result.timings.prompt_ms,
        });
        // If the model was released mid-run (app backgrounded / memory warning), it's no longer loaded.
        const stillLoaded = contextRef.current === context;
        setStatus(stillLoaded ? 'ready' : 'idle');
        if (stillLoaded) idleTimer.restart();
      } catch (e) {
        if (contextRef.current !== context) {
          setStatus('idle');
          return;
        }
        console.warn('Summarization failed', e);
        setError(String(e));
        setStatus('error');
        idleTimer.restart();
      }
    },
    [load, idleTimer],
  );

  const stop = useCallback(() => {
    void contextRef.current?.stopCompletion();
  }, []);

  /** Stops any generation and frees the model's RAM. It reloads on the next summarize. */
  const release = useCallback(async () => {
    idleTimer.cancel();
    // If a load is in flight, let it finish so we free what it loaded instead of leaking it.
    await loadRef.current?.catch(() => null);
    const context = contextRef.current;
    if (!context) return;
    contextRef.current = null;
    await context.stopCompletion().catch(() => undefined);
    await context.release();
    setStatus('idle');
  }, [idleTimer]);
  releaseRef.current = release;

  return { status, loadProgress, output, stats, error, load, summarize, stop, release };
}
