import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { MemoryBar } from '@/components/MemoryBar';
import { VoiceModelCard } from '@/components/VoiceModelCard';
import { VoicePicker } from '@/components/VoicePicker';
import { useMemoryGuard } from '@/memory/useMemoryGuard';
import { useKokoro, type KokoroVoice } from '@/models/useKokoro';

const SAMPLE_TEXT =
  'This voice is generated entirely on this phone. There is no internet connection and no cloud server. ' +
  'A small neural network turns the text into speech in real time.';

export default function Speak() {
  const kokoro = useKokoro();
  const [text, setText] = useState('');
  const [voice, setVoice] = useState<KokoroVoice>('af_heart');
  const memoryGuard = useMemoryGuard(kokoro.release);

  const busy = kokoro.status === 'loading' || kokoro.status === 'speaking';
  const canSpeak = kokoro.downloadStatus === 'ready' && text.trim().length > 0 && !busy;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <MemoryBar />
      {memoryGuard.releasedForPressure && (
        <Pressable onPress={memoryGuard.dismiss}>
          <Text style={styles.warning}>
            The phone was low on memory, so the voice model was unloaded. It will reload next time. (Tap to dismiss)
          </Text>
        </Pressable>
      )}
      <VoiceModelCard kokoro={kokoro} />

      {kokoro.downloadStatus === 'ready' && (
        <>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Text to read</Text>
            <Pressable onPress={() => setText(SAMPLE_TEXT)} hitSlop={8}>
              <Text style={styles.link}>Use sample</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Type some English text…"
            multiline
            editable={!busy}
          />

          <Text style={styles.label}>Voice</Text>
          <VoicePicker value={voice} onChange={setVoice} disabled={busy} />

          {busy ? (
            <Pressable style={[styles.button, styles.stopButton]} onPress={kokoro.stop}>
              <Text style={styles.buttonText}>■ Stop</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.button, !canSpeak && styles.disabled]}
              disabled={!canSpeak}
              onPress={() => kokoro.speak(text, voice)}>
              <Text style={styles.buttonText}>▶ Speak</Text>
            </Pressable>
          )}

          {kokoro.status === 'loading' && (
            <View style={styles.statusRow}>
              <ActivityIndicator />
              <Text style={styles.meta}>Loading voice model into memory…</Text>
            </View>
          )}

          {kokoro.stats && (
            <Text style={styles.meta}>
              ⚡ first audio in {(kokoro.stats.firstAudioMs / 1000).toFixed(1)}s ·{' '}
              {kokoro.stats.audioSec.toFixed(1)}s of speech generated in {(kokoro.stats.synthesisMs / 1000).toFixed(1)}s
            </Text>
          )}

          {kokoro.status === 'error' && (
            <Text style={styles.error}>Something went wrong generating speech. Try again.</Text>
          )}
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
    minHeight: 120,
    maxHeight: 240,
    borderWidth: 1,
    borderColor: '#D9DEE5',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  button: { backgroundColor: '#1D4ED8', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  stopButton: { backgroundColor: '#B91C1C' },
  disabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  meta: { fontSize: 13, color: '#555' },
  error: { fontSize: 14, color: '#B91C1C' },
  warning: { fontSize: 14, color: '#92400E', backgroundColor: '#FEF3C7', padding: 12, borderRadius: 10 },
});
