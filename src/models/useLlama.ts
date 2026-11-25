import { initLlama, type LlamaContext } from 'llama.rn';
import { useCallback, useEffect, useRef, useState } from 'react';

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

  // Free the model's RAM when the screen closes.
  useEffect(
    () => () => {
      const context = contextRef.current;
      contextRef.current = null;
      void context?.release();
    },
    [],
  );

  const load = useCallback(async () => {
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

  const summarize = useCallback(
    async (text: string) => {
      const context = contextRef.current ?? (await load());
      if (!context) return;

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
        setStatus('ready');
      } catch (e) {
        console.warn('Summarization failed', e);
        setError(String(e));
        setStatus('error');
      }
    },
    [load],
  );

  const stop = useCallback(() => {
    void contextRef.current?.stopCompletion();
  }, []);

  return { status, loadProgress, output, stats, error, load, summarize, stop };
}
