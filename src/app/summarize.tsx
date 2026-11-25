import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { MemoryBar } from '@/components/MemoryBar';
import { ModelDownloadCard } from '@/components/ModelDownloadCard';
import { useMemoryGuard } from '@/memory/useMemoryGuard';
import { LLAMA_3_2_1B } from '@/models/registry';
import { useLlama } from '@/models/useLlama';
import { useKokoro } from '@/models/useKokoro';
import { useModelDownload } from '@/models/useModelDownload';

// About 1,200 words — keeps input + summary inside the model's 2048-token window.
const MAX_INPUT_CHARS = 6000;

const SAMPLE_TEXT =
  'Running AI models directly on mobile phones is becoming practical. ' +
  'Small language models like Llama 3.2 1B can now summarize text on a modern phone ' +
  'without sending any data to the cloud. This improves privacy, because the text never ' +
  'leaves the device, and it works anywhere, even on a plane or in areas with poor coverage. ' +
  'The main challenges are memory and battery: a 1B model needs close to a gigabyte of RAM, ' +
  'and the operating system may close apps that use too much. Developers handle this by using ' +
  'compressed (quantized) models, keeping the context window small, and unloading the model ' +
  'when the app goes to the background.';

export default function Summarize() {
  const download = useModelDownload(LLAMA_3_2_1B);
  const llama = useLlama(LLAMA_3_2_1B);
  const [input, setInput] = useState('');
  const kokoro = useKokoro();
  // Release both independently: one failing must not keep the other in RAM.
  const releaseAll = useCallback(
    async () => {
      await Promise.allSettled([llama.release(), kokoro.release()]);
    },
    [llama.release, kokoro.release],
  );
  const memoryGuard = useMemoryGuard(releaseAll);

  // This screen stays mounted under any screen pushed on top of it (e.g. Text to speech),
  // so free its models when it loses focus, and re-check the voice download when it regains it.
  useFocusEffect(
    useCallback(() => {
      kokoro.refreshDownloadStatus();
      return () => void releaseAll();
    }, [kokoro.refreshDownloadStatus, releaseAll]),
  );

  const summarize = async () => {
    // Kokoro may still be loaded (30s idle window) after reading aloud; free it first.
    await kokoro.release();
    await llama.summarize(input);
  };
  const busy = llama.status === 'loading' || llama.status === 'generating';
  const speaking = kokoro.status === 'loading' || kokoro.status === 'speaking';
  const canReadAloud = llama.output.length > 0 && !busy;
  // Don't load Llama while Kokoro is talking — only one model in RAM at a time.
  const canSummarize = download.status === 'ready' && input.trim().length > 0 && !busy && !speaking;

  const readAloud = async () => {
    // Llama and Kokoro together would need ~3 GB; free Llama first so only one model is in RAM.
    await llama.release();
    await kokoro.speak(llama.output, 'af_heart');
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <MemoryBar />
      {memoryGuard.releasedForPressure && (
        <Pressable onPress={memoryGuard.dismiss}>
          <Text style={styles.warning}>The phone was low on memory, so the model was unloaded to keep the app from crashing. It will reload next time you use it. (Tap to dismiss)</Text>
        </Pressable>
      )}
      <ModelDownloadCard model={LLAMA_3_2_1B} download={download} />

      {download.status === 'ready' && (
        <>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Text to summarize</Text>
            <Pressable onPress={() => setInput(SAMPLE_TEXT)} hitSlop={8}>
              <Text style={styles.link}>Use sample</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Paste or type some text…"
            multiline
            maxLength={MAX_INPUT_CHARS}
            editable={!busy}
          />

          {llama.status === 'generating' ? (
            <Pressable style={[styles.button, styles.stopButton]} onPress={llama.stop}>
              <Text style={styles.buttonText}>Stop</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.button, !canSummarize && styles.disabled]}
              disabled={!canSummarize}
              onPress={summarize}>
              <Text style={styles.buttonText}>Summarize</Text>
            </Pressable>
          )}

          {llama.status === 'loading' && (
            <View style={styles.statusRow}>
              <ActivityIndicator />
              <Text style={styles.meta}>
                Loading model into memory… {Math.round(llama.loadProgress)}%
              </Text>
            </View>
          )}

          {(llama.output.length > 0 || llama.status === 'generating') && (
            <View style={styles.outputCard}>
              <Text style={styles.label}>Summary</Text>
              <Text style={styles.output}>
                {llama.output}
                {llama.status === 'generating' ? '▍' : ''}
              </Text>
            </View>
          )}

          {canReadAloud &&
            (kokoro.downloadStatus === 'ready' ? (
              <Pressable
                style={[styles.button, speaking ? styles.stopButton : styles.secondaryButton]}
                onPress={speaking ? kokoro.stop : readAloud}>
                <Text style={styles.buttonText}>
                  {kokoro.status === 'loading' ? 'Loading voice…' : speaking ? '■ Stop reading' : '🔊 Read summary aloud'}
                </Text>
              </Pressable>
            ) : (
              <Link href="/speak" style={styles.link}>
                🔊 Download the voice model on the Text to speech page to read summaries aloud
              </Link>
            ))}

          {kokoro.status === 'error' && (
            <Text style={styles.error}>Couldn't read the summary aloud. Try again.</Text>
          )}

          {llama.stats && (
            <Text style={styles.meta}>
              ⚡ {llama.stats.tokensPerSecond.toFixed(1)} tokens/sec · {llama.stats.tokens}{' '}
              tokens · read in {(llama.stats.promptMs / 1000).toFixed(1)}s
            </Text>
          )}

          {llama.status === 'error' && <Text style={styles.error}>Something went wrong running the model. Try again.</Text>}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, gap: 14 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 15, fontWeight: '600' },
  link: { fontSize: 14, color: '#1D4ED8', fontWeight: '600' },
  input: {
    minHeight: 140,
    maxHeight: 260,
    borderWidth: 1,
    borderColor: '#D9DEE5',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  button: { backgroundColor: '#1D4ED8', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  stopButton: { backgroundColor: '#B91C1C' },
  secondaryButton: { backgroundColor: '#0F766E' },
  disabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  outputCard: { padding: 16, borderRadius: 12, backgroundColor: '#F2F4F7', gap: 8 },
  output: { fontSize: 15, lineHeight: 23 },
  meta: { fontSize: 13, color: '#555' },
  error: { fontSize: 14, color: '#B91C1C' },
  warning: { fontSize: 14, color: '#92400E', backgroundColor: '#FEF3C7', padding: 12, borderRadius: 10 },
});
