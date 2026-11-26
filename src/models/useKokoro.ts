import { useAudioPlayer } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createKokoroTextToSpeech,
  download,
  models,
  setTelemetryEnabled,
  type KokoroTextToSpeech,
} from 'react-native-executorch';

import { encodeWav } from '@/audio/wav';
import { useIdleTimer } from '@/memory/useIdleTimer';

// The library pings an analytics endpoint when it downloads a model. This is an
// offline-first app, so turn that off.
setTelemetryEnabled(false);

/** Kokoro English (US), CPU backend. ~348 MB: two model files, phonemizer data, 6 voices. */
const KOKORO_EN = models.textToSpeech.KOKORO.EN_US.XNNPACK_FP32;
export const KOKORO_DOWNLOAD_BYTES = 348_000_000;

export type KokoroVoice = keyof typeof KOKORO_EN.voices;
export const KOKORO_VOICES: { id: KokoroVoice; label: string }[] = [
  { id: 'af_heart', label: 'Heart (F)' },
  { id: 'af_sarah', label: 'Sarah (F)' },
  { id: 'af_river', label: 'River (F)' },
  { id: 'am_adam', label: 'Adam (M)' },
  { id: 'am_michael', label: 'Michael (M)' },
  { id: 'am_santa', label: 'Santa (M)' },
];

type ResolvedModel = typeof KOKORO_EN;
type DownloadStatus = 'missing' | 'downloading' | 'ready' | 'error';
export type KokoroStatus = 'idle' | 'loading' | 'speaking' | 'error';

export type SpeechStats = {
  /** Time from pressing Speak until the first audio starts. */
  firstAudioMs: number;
  /** Total time to synthesize everything. */
  synthesisMs: number;
  /** Length of the generated speech. */
  audioSec: number;
};

// The library caches downloads in its own folder; this marker just tells us, without
// touching the network, that a previous download finished.
const readyMarker = () => new File(Paths.document, 'kokoro-ready.json');
// Each synthesized sentence is written here as a small WAV and played in order.
const chunksDir = () => new Directory(Paths.cache, 'tts');

export function useKokoro() {
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>(() =>
    readyMarker().exists ? 'ready' : 'missing',
  );
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [status, setStatus] = useState<KokoroStatus>('idle');
  const [stats, setStats] = useState<SpeechStats | null>(null);

  const resolvedRef = useRef<ResolvedModel | null>(null);
  const ttsRef = useRef<KokoroTextToSpeech<KokoroVoice> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** In-flight model load, so release() can wait for it instead of missing it. */
  const loadRef = useRef<Promise<KokoroTextToSpeech<KokoroVoice>> | null>(null);
  /** The current synthesis loop; resolves once it has fully exited. */
  const runRef = useRef<Promise<void> | null>(null);
  /**
   * Every speak() gets a new session id; stop()/release() bump it to cancel.
   * Async steps re-check their id after each await and bail out if it changed,
   * so a cancelled run can never resume, mix into a newer one, or play in the background.
   */
  const sessionRef = useRef(0);

  // Simple playback queue: one player, next chunk starts when the current one ends.
  const player = useAudioPlayer(null);
  const queueRef = useRef<string[]>([]);
  const playingRef = useRef(false);
  const synthDoneRef = useRef(true);

  const releaseRef = useRef<() => Promise<void>>(async () => undefined);
  const idleTimer = useIdleTimer(() => void releaseRef.current());

  const refreshDownloadStatus = useCallback(() => {
    setDownloadStatus((current) =>
      current === 'downloading' ? current : readyMarker().exists ? 'ready' : 'missing',
    );
  }, []);

  const finishIfDone = useCallback(() => {
    if (synthDoneRef.current && !playingRef.current && queueRef.current.length === 0) {
      setStatus((s) => (s === 'speaking' ? 'idle' : s));
      idleTimer.restart();
    }
  }, [idleTimer]);

  const playNext = useCallback(() => {
    const uri = queueRef.current.shift();
    if (!uri) {
      playingRef.current = false;
      finishIfDone();
      return;
    }
    playingRef.current = true;
    player.replace({ uri });
    player.play();
  }, [player, finishIfDone]);

  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (s) => {
      if (s.didJustFinish) playNext();
    });
    return () => sub.remove();
  }, [player, playNext]);

  /** Cancels the current session: stops synthesis and silences playback. */
  const cancelCurrent = useCallback(() => {
    sessionRef.current += 1;
    ttsRef.current?.synthesizeStop();
    synthDoneRef.current = true;
    queueRef.current = [];
    playingRef.current = false;
    player.pause();
  }, [player]);

  const startDownload = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setDownloadStatus('downloading');
    setDownloadProgress(0);
    try {
      resolvedRef.current = await download(KOKORO_EN, {
        signal: controller.signal,
        // The library reports progress as a fraction in [0, 1]; we keep percent (0–100).
        onProgress: (fraction) => setDownloadProgress(fraction * 100),
      });
      await readyMarker().write(JSON.stringify({ downloadedAt: Date.now() }));
      setDownloadStatus('ready');
    } catch (e) {
      if (controller.signal.aborted) {
        setDownloadStatus('missing');
        return;
      }
      console.warn('Kokoro download failed', e);
      setDownloadStatus('error');
    } finally {
      abortRef.current = null;
    }
  }, []);

  const cancelDownload = useCallback(() => abortRef.current?.abort(), []);

  const load = useCallback(() => {
    if (ttsRef.current) return Promise.resolve(ttsRef.current);
    loadRef.current ??= (async () => {
      try {
        // Cache hit when already downloaded, so this works offline.
        resolvedRef.current ??= await download(KOKORO_EN);
        const tts = await createKokoroTextToSpeech(resolvedRef.current);
        ttsRef.current = tts;
        return tts;
      } finally {
        loadRef.current = null;
      }
    })();
    return loadRef.current;
  }, []);

  /** Stops speaking but keeps the model loaded (the idle timer frees it later). */
  const stop = useCallback(() => {
    cancelCurrent();
    setStatus('idle');
    idleTimer.restart();
  }, [cancelCurrent, idleTimer]);

  /** Stops speech and frees the model's RAM. It reloads on the next Speak. */
  const release = useCallback(async () => {
    idleTimer.cancel();
    cancelCurrent();
    // Don't free native memory while inference or a load is still using it:
    // wait for the synthesis loop to exit and for any pending load to finish.
    await runRef.current;
    await loadRef.current?.catch(() => undefined);
    const tts = ttsRef.current;
    ttsRef.current = null;
    tts?.dispose();
    setStatus('idle');
  }, [cancelCurrent, idleTimer]);

  const speak = useCallback(
    async (text: string, voice: KokoroVoice) => {
      idleTimer.cancel();
      cancelCurrent();
      const session = sessionRef.current;
      const cancelled = () => sessionRef.current !== session;
      setStats(null);
      const startedAt = Date.now();

      // Let a previous (cancelled) run finish exiting before we reuse the model and folder.
      await runRef.current;
      if (cancelled()) return;

      try {
        if (!ttsRef.current) setStatus('loading');
        const tts = await load();
        if (cancelled()) return; // Stop or release happened while loading.

        const dir = chunksDir();
        if (dir.exists) dir.delete();
        dir.create({ intermediates: true });

        setStatus('speaking');
        synthDoneRef.current = false;
        let firstAudioMs = 0;
        let audioSec = 0;

        // Kokoro yields one chunk per sentence; start playing as soon as the first is ready.
        const run = (async () => {
          for await (const chunk of tts.synthesize(text, { voice })) {
            if (cancelled()) break;
            const file = new File(dir, `chunk-${chunk.chunkIndex}.wav`);
            await file.write(encodeWav(chunk.audio, chunk.sampleRate));
            if (cancelled()) break;
            audioSec += chunk.duration;
            if (!firstAudioMs) firstAudioMs = Date.now() - startedAt;
            queueRef.current.push(file.uri);
            if (!playingRef.current) playNext();
          }
        })();
        runRef.current = run.catch(() => undefined);
        await run;
        if (cancelled()) return;

        synthDoneRef.current = true;
        setStats({ firstAudioMs, synthesisMs: Date.now() - startedAt, audioSec });
        finishIfDone();
      } catch (e) {
        // A stop/release mid-run can make the native call throw; that's not an error.
        if (cancelled()) return;
        console.warn('Speech synthesis failed', e);
        synthDoneRef.current = true;
        setStatus('error');
        idleTimer.restart();
      }
    },
    [cancelCurrent, load, playNext, finishIfDone, idleTimer],
  );

  // Free the model when the screen closes (release waits for any in-flight work first).
  useEffect(() => {
    releaseRef.current = release;
  }, [release]);
  useEffect(
    () => () => {
      abortRef.current?.abort();
      void releaseRef.current();
    },
    [],
  );

  return {
    downloadStatus,
    downloadProgress,
    refreshDownloadStatus,
    startDownload,
    cancelDownload,
    status,
    stats,
    speak,
    stop,
    release,
  };
}
