import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { MemoryBar } from '@/components/MemoryBar';
import { useMemoryGuard } from '@/memory/useMemoryGuard';
import { LLAMA_3_2_1B, WHISPER_SMALL_Q8 } from '@/models/registry';
import { useKokoro } from '@/models/useKokoro';
import { useLlama, type ChatMessage } from '@/models/useLlama';
import { useModelDownload } from '@/models/useModelDownload';
import { useRecorder } from '@/models/useRecorder';
import { useWhisper } from '@/models/useWhisper';

type Stage = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';
/** Internal: the voice is fully synthesized and may still be playing. */
type TurnStage = Stage | 'playback';

const STAGES: { id: Exclude<Stage, 'idle'>; label: string }[] = [
  { id: 'listening', label: '🎙️ Listening' },
  { id: 'transcribing', label: '📝 Transcribing' },
  { id: 'thinking', label: '🧠 Thinking' },
  { id: 'speaking', label: '🔊 Speaking' },
];

type TurnTimings = { transcribeMs: number; thinkMs: number };

/** Whisper writes tags like "[BLANK_AUDIO]" or "(music)" for non-speech; drop them. */
function cleanTranscript(text: string) {
  return text.replace(/\[[^\]]*\]|\([^)]*\)/g, '').trim();
}

export default function Assistant() {
  const llamaDownload = useModelDownload(LLAMA_3_2_1B);
  const whisperDownload = useModelDownload(WHISPER_SMALL_Q8);
  const llama = useLlama(LLAMA_3_2_1B);
  const whisper = useWhisper(WHISPER_SMALL_Q8);
  const kokoro = useKokoro();
  const recorder = useRecorder();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stage, setStage] = useState<TurnStage>('idle');
  const [keepLoaded, setKeepLoaded] = useState(false);
  const [timings, setTimings] = useState<TurnTimings | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Bumped to cancel an in-flight turn (Stop, leaving the screen, memory warning). */
  const turnRef = useRef(0);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const allReady =
    llamaDownload.status === 'ready' && whisperDownload.status === 'ready' && kokoro.downloadStatus === 'ready';

  const { release: releaseWhisper } = whisper;
  const { release: releaseLlama } = llama;
  const { release: releaseKokoro, refreshDownloadStatus: refreshKokoro } = kokoro;
  const { refresh: refreshLlama } = llamaDownload;
  const { refresh: refreshWhisper } = whisperDownload;

  const releaseAll = useCallback(async () => {
    turnRef.current += 1;
    await Promise.allSettled([releaseWhisper(), releaseLlama(), releaseKokoro()]);
    setStage('idle');
  }, [releaseWhisper, releaseLlama, releaseKokoro]);

  const memoryGuard = useMemoryGuard(releaseAll);

  useFocusEffect(
    useCallback(() => {
      refreshLlama();
      refreshWhisper();
      refreshKokoro();
      return () => void releaseAll();
    }, [refreshLlama, refreshWhisper, refreshKokoro, releaseAll]),
  );

  // After synthesis, the turn is over once the voice stops playing (finished, stopped or failed).
  const current: Stage = stage === 'playback' ? (kokoro.status === 'speaking' ? 'speaking' : 'idle') : stage;

  /** One model at a time unless "Keep models loaded" is on. */
  const freeExcept = async (keep: 'whisper' | 'llama' | 'kokoro') => {
    if (keepLoaded) return;
    await Promise.allSettled([
      keep !== 'whisper' ? whisper.release() : null,
      keep !== 'llama' ? llama.release() : null,
      keep !== 'kokoro' ? kokoro.release() : null,
    ]);
  };

  const runTurn = async () => {
    const turn = ++turnRef.current;
    const cancelled = () => turnRef.current !== turn;

    const recording = await recorder.stop();
    if (!recording || cancelled()) return setStage('idle');

    // 1) Speech → text
    setStage('transcribing');
    await freeExcept('whisper');
    if (cancelled()) return;
    let startedAt = Date.now();
    const transcript = cleanTranscript((await whisper.transcribe(recording.uri, 'en')) ?? '');
    if (cancelled()) return;
    const transcribeMs = Date.now() - startedAt;
    if (!transcript) {
      setNotice("Didn't catch that — try again.");
      return setStage('idle');
    }
    const history: ChatMessage[] = [...messages, { role: 'user', content: transcript }];
    setMessages(history);

    // 2) Text → answer
    setStage('thinking');
    await freeExcept('llama');
    if (cancelled()) return;
    startedAt = Date.now();
    const answer = await llama.chat(history);
    if (cancelled()) return;
    if (!answer) {
      setNotice('The model could not answer. Try again.');
      return setStage('idle');
    }
    setMessages([...history, { role: 'assistant', content: answer }]);
    setTimings({ transcribeMs, thinkMs: Date.now() - startedAt });

    // 3) Answer → voice
    setStage('speaking');
    await freeExcept('kokoro');
    if (cancelled()) return;
    await kokoro.speak(answer, 'af_heart');
    if (!cancelled()) setStage('playback');
  };

  const onMicPress = async () => {
    setNotice(null);
    if (current === 'listening') {
      await runTurn();
      return;
    }
    // Tapping while it's talking interrupts it (and ends that turn) and starts listening again.
    if (current === 'speaking') {
      turnRef.current += 1;
      kokoro.stop();
    }
    await recorder.start();
    setStage('listening');
  };

  const onStop = () => {
    turnRef.current += 1;
    whisper.stop();
    llama.stop();
    kokoro.stop();
    setStage('idle');
  };

  const busy = current === 'transcribing' || current === 'thinking';
  const loadingModel =
    whisper.status === 'loading' || llama.status === 'loading' || kokoro.status === 'loading';

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <MemoryBar />
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchLabel}>Keep models loaded</Text>
            <Text style={styles.meta}>
              {keepLoaded ? 'Faster replies, ~3 GB RAM' : 'One model in RAM at a time, ~2 GB peak'}
            </Text>
          </View>
          <Switch value={keepLoaded} onValueChange={setKeepLoaded} disabled={current !== 'idle'} />
        </View>
        {memoryGuard.releasedForPressure && (
          <Pressable onPress={memoryGuard.dismiss}>
            <Text style={styles.warning}>Low memory: models were unloaded. (Tap to dismiss)</Text>
          </Pressable>
        )}
      </View>

      {!allReady ? (
        <View style={styles.checklist}>
          <Text style={styles.label}>Download the three models first:</Text>
          <Requirement ready={whisperDownload.status === 'ready'} label="Whisper (speech to text)" href="/transcribe" />
          <Requirement ready={llamaDownload.status === 'ready'} label="Llama (answers)" href="/summarize" />
          <Requirement ready={kokoro.downloadStatus === 'ready'} label="Kokoro (voice)" href="/speak" />
        </View>
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            style={styles.chat}
            contentContainerStyle={styles.chatContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
            {messages.length === 0 && (
              <Text style={styles.empty}>Tap the mic and ask anything. Everything runs on this phone.</Text>
            )}
            {messages.map((m, i) => (
              <View key={i} style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.botBubble]}>
                <Text style={m.role === 'user' ? styles.userText : styles.botText}>{m.content}</Text>
              </View>
            ))}
            {current === 'thinking' && llama.output.length > 0 && (
              <View style={[styles.bubble, styles.botBubble]}>
                <Text style={styles.botText}>{llama.output}▍</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.bottom}>
            <View style={styles.stages}>
              {STAGES.map((s) => (
                <Text key={s.id} style={[styles.stage, current === s.id && styles.stageActive]}>
                  {s.label}
                </Text>
              ))}
            </View>

            {loadingModel && (
              <View style={styles.statusRow}>
                <ActivityIndicator size="small" />
                <Text style={styles.meta}>Loading model into memory…</Text>
              </View>
            )}
            {notice && <Text style={styles.error}>{notice}</Text>}
            {recorder.status === 'denied' && (
              <Text style={styles.error}>Microphone permission is needed. Enable it in Settings.</Text>
            )}

            {timings && current === 'idle' && (
              <Text style={styles.meta}>
                ⚡ heard in {(timings.transcribeMs / 1000).toFixed(1)}s · answered in {(timings.thinkMs / 1000).toFixed(1)}s
                {llama.stats ? ` (${llama.stats.tokensPerSecond.toFixed(0)} tok/s)` : ''}
                {kokoro.stats ? ` · voice in ${(kokoro.stats.firstAudioMs / 1000).toFixed(1)}s` : ''}
              </Text>
            )}

            {busy ? (
              <Pressable style={[styles.mic, styles.micBusy]} onPress={onStop}>
                <Text style={styles.micText}>■ Stop</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.mic, current === 'listening' && styles.micListening]}
                onPress={onMicPress}>
                <Text style={styles.micText}>
                  {current === 'listening'
                    ? `■ Done · ${recorder.elapsedSec.toFixed(1)}s`
                    : current === 'speaking'
                      ? '🎙️ Interrupt & talk'
                      : '🎙️ Tap to talk'}
                </Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </View>
  );
}

function Requirement({ ready, label, href }: { ready: boolean; label: string; href: '/transcribe' | '/summarize' | '/speak' }) {
  return ready ? (
    <Text style={styles.ready}>✓ {label}</Text>
  ) : (
    <Link href={href} style={styles.link}>
      ⬇︎ {label} — open page to download
    </Link>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  top: { padding: 16, gap: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchText: { flex: 1 },
  switchLabel: { fontSize: 15, fontWeight: '600' },
  checklist: { padding: 20, gap: 12 },
  label: { fontSize: 15, fontWeight: '600' },
  ready: { fontSize: 15, color: '#15803D', fontWeight: '600' },
  link: { fontSize: 15, color: '#1D4ED8', fontWeight: '600' },
  chat: { flex: 1 },
  chatContent: { padding: 16, gap: 10 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
  bubble: { maxWidth: '85%', padding: 12, borderRadius: 16 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#1D4ED8' },
  botBubble: { alignSelf: 'flex-start', backgroundColor: '#F2F4F7' },
  userText: { color: '#fff', fontSize: 15, lineHeight: 21 },
  botText: { color: '#111', fontSize: 15, lineHeight: 21 },
  bottom: { padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: '#EEF0F3' },
  stages: { flexDirection: 'row', justifyContent: 'space-between' },
  stage: { fontSize: 12, color: '#9CA3AF' },
  stageActive: { color: '#1D4ED8', fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { fontSize: 13, color: '#555' },
  error: { fontSize: 14, color: '#B91C1C' },
  warning: { fontSize: 14, color: '#92400E', backgroundColor: '#FEF3C7', padding: 10, borderRadius: 10 },
  mic: { backgroundColor: '#1D4ED8', paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  micListening: { backgroundColor: '#B91C1C' },
  micBusy: { backgroundColor: '#6B7280' },
  micText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
