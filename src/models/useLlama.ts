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

const SUMMARY_PROMPT =
  'You are a helpful assistant that summarizes text. ' +
  'Write a short, clear summary in 3 to 5 bullet points. ' +
  'Always answer in the same language as the text you are given.';

// Answers are read aloud by the voice model, so ask for short, plain spoken sentences.
const ASSISTANT_PROMPT =
  "You are a friendly voice assistant running fully offline on the user's phone. " +
  'Reply in plain spoken English in 1 to 3 short sentences. ' +
  'Do not use lists, markdown, emojis or special symbols.';
const MAX_REPLY_TOKENS = 160;
// Keep only the most recent turns so the conversation fits in the context window.
const MAX_HISTORY_MESSAGES = 8;

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
type PromptMessage = { role: 'system' | 'user' | 'assistant'; content: string };

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
  const idleTimer = useIdleTimer(() => void releaseRef.current());

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

  /** Runs one completion, streaming tokens into `output`. Returns the final text, or null. */
  const generate = useCallback(
    async (messages: PromptMessage[], maxTokens: number, temperature: number) => {
      idleTimer.cancel();
      const context = contextRef.current ?? (await load());
      // Null if loading failed; a different ref means it was released while loading.
      if (!context || contextRef.current !== context) return null;

      setOutput('');
      setStats(null);
      setStatus('generating');
      try {
        const result = await context.completion(
          { messages, n_predict: maxTokens, temperature },
          // Called for every new token, so the text appears word by word.
          (data) => setOutput((previous) => previous + data.token),
        );
        const text = result.text.trim();
        setOutput(text);
        setStats({
          tokensPerSecond: result.timings.predicted_per_second,
          tokens: result.timings.predicted_n,
          promptMs: result.timings.prompt_ms,
        });
        // If the model was released mid-run (app backgrounded / memory warning), it's no longer loaded.
        const stillLoaded = contextRef.current === context;
        setStatus(stillLoaded ? 'ready' : 'idle');
        if (stillLoaded) idleTimer.restart();
        return text;
      } catch (e) {
        if (contextRef.current !== context) {
          setStatus('idle');
          return null;
        }
        console.warn('Generation failed', e);
        setError(String(e));
        setStatus('error');
        idleTimer.restart();
        return null;
      }
    },
    [load, idleTimer],
  );

  const summarize = useCallback(
    (text: string) =>
      generate(
        [
          { role: 'system', content: SUMMARY_PROMPT },
          { role: 'user', content: `Summarize this text:\n\n${text}` },
        ],
        MAX_SUMMARY_TOKENS,
        0.3,
      ),
    [generate],
  );

  /** Replies to a conversation as a short spoken-style answer. */
  const chat = useCallback(
    (history: ChatMessage[]) =>
      generate(
        [{ role: 'system', content: ASSISTANT_PROMPT }, ...history.slice(-MAX_HISTORY_MESSAGES)],
        MAX_REPLY_TOKENS,
        0.7,
      ),
    [generate],
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
    // llama.rn types stopCompletion() as a Promise, but the native function returns
    // undefined — calling `.catch` on it threw, so release() never reached
    // context.release() and every unload leaked the whole model. Never chain on it.
    try {
      await context.stopCompletion();
    } catch {
      // Nothing to stop, or the context is already gone.
    }
    await context.release();
    setStatus('idle');
  }, [idleTimer]);
  useEffect(() => {
    releaseRef.current = release;
  }, [release]);

  return { status, loadProgress, output, stats, error, load, summarize, chat, stop, release };
}
