import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MemoryBar } from '@/components/MemoryBar';
import { ModelDownloadCard } from '@/components/ModelDownloadCard';
import { useMemoryGuard } from '@/memory/useMemoryGuard';
import { WHISPER_SMALL_Q8 } from '@/models/registry';
import { useModelDownload } from '@/models/useModelDownload';
import { useRecorder, type Recording } from '@/models/useRecorder';
import { useWhisper, type SpeechLanguage } from '@/models/useWhisper';

const LANGUAGES: { value: SpeechLanguage; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
];

export default function Transcribe() {
  const download = useModelDownload(WHISPER_SMALL_Q8);
  const whisper = useWhisper(WHISPER_SMALL_Q8);
  const recorder = useRecorder();
  const [speechLanguage, setSpeechLanguage] = useState<SpeechLanguage>('auto');
  const [lastRecording, setLastRecording] = useState<Recording | null>(null);
  const memoryGuard = useMemoryGuard(whisper.release);
  const recording = recorder.status === 'recording';
  const busy = whisper.status === 'loading' || whisper.status === 'transcribing';

  const onRecordPress = async () => {
    if (!recording) {
      await recorder.start();
      return;
    }
    const result = await recorder.stop();
    if (!result) return;
    setLastRecording(result);
    await whisper.transcribe(result.uri, speechLanguage);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}>
      <MemoryBar />
      {memoryGuard.releasedForPressure && (
        <Pressable onPress={memoryGuard.dismiss}>
          <Text style={styles.warning}>The phone was low on memory, so the model was unloaded to keep the app from crashing. It will reload next time you use it. (Tap to dismiss)</Text>
        </Pressable>
      )}
      <ModelDownloadCard model={WHISPER_SMALL_Q8} download={download} />

      {download.status === 'ready' && (
        <>
          <Text style={styles.label}>Spoken language</Text>
          <View style={styles.segment}>
            {LANGUAGES.map(({ value, label }) => (
              <Pressable
                key={value}
                disabled={recording || busy}
                onPress={() => setSpeechLanguage(value)}
                style={[styles.segmentItem, speechLanguage === value && styles.segmentActive]}>
                <Text style={[styles.segmentText, speechLanguage === value && styles.segmentTextActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            disabled={busy}
            onPress={onRecordPress}
            style={[styles.recordButton, recording && styles.recordingButton, busy && styles.disabled]}>
            <Text style={styles.recordText}>
              {recording ? `■ $Stop · ${recorder.elapsedSec.toFixed(1)}s` : `● $Record`}
            </Text>
          </Pressable>

          {recorder.status === 'denied' && <Text style={styles.error}>Microphone permission is needed. Enable it in Settings.</Text>}
          {recorder.status === 'error' && <Text style={styles.error}>Could not use the microphone. Try again.</Text>}

          {whisper.status === 'loading' && (
            <View style={styles.statusRow}>
              <ActivityIndicator />
              <Text style={styles.meta}>Loading model into memory…</Text>
            </View>
          )}

          {whisper.status === 'transcribing' && (
            <View style={styles.statusRow}>
              <ActivityIndicator />
              <Text style={styles.meta}>
                Transcribing… {Math.round(whisper.progress)}%
              </Text>
              <Pressable onPress={whisper.stop} hitSlop={8}>
                <Text style={styles.link}>Stop</Text>
              </Pressable>
            </View>
          )}

          {whisper.text.length > 0 && (
            <View style={styles.outputCard}>
              <Text style={styles.label}>Transcript</Text>
              {/* Align by the transcript's own script, not the UI language. */}
              <Text style={[styles.output, { writingDirection: 'auto' }]}>{whisper.text}</Text>
            </View>
          )}

          {whisper.stats && lastRecording && (
            <Text style={styles.meta}>
              ⚡ {lastRecording.durationSec.toFixed(1)}s of audio in {(whisper.stats.processingMs / 1000).toFixed(1)}s ·{' '}
              language: {whisper.stats.detectedLanguage} · {lastRecording.sampleRate} Hz
            </Text>
          )}

          {whisper.status === 'error' && <Text style={styles.error}>Something went wrong running the model. Try again.</Text>}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, gap: 14 },
  label: { fontSize: 15, fontWeight: '600' },
  segment: { flexDirection: 'row', backgroundColor: '#F2F4F7', borderRadius: 10, padding: 4, gap: 4 },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: '#fff' },
  segmentText: { fontSize: 14, color: '#555' },
  segmentTextActive: { color: '#111', fontWeight: '600' },
  recordButton: { backgroundColor: '#1D4ED8', paddingVertical: 18, borderRadius: 14, alignItems: 'center' },
  recordingButton: { backgroundColor: '#B91C1C' },
  disabled: { opacity: 0.4 },
  recordText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  link: { fontSize: 14, color: '#1D4ED8', fontWeight: '600' },
  outputCard: { padding: 16, borderRadius: 12, backgroundColor: '#F2F4F7', gap: 8 },
  output: { fontSize: 16, lineHeight: 24 },
  meta: { fontSize: 13, color: '#555' },
  error: { fontSize: 14, color: '#B91C1C' },
  warning: { fontSize: 14, color: '#92400E', backgroundColor: '#FEF3C7', padding: 12, borderRadius: 10 },
});
