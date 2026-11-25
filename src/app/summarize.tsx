import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ModelDownloadCard } from '@/components/ModelDownloadCard';
import { useLanguage } from '@/i18n/LanguageProvider';
import { LLAMA_3_2_1B } from '@/models/registry';
import { useLlama } from '@/models/useLlama';
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
  const { t, isRTL } = useLanguage();
  const download = useModelDownload(LLAMA_3_2_1B);
  const llama = useLlama(LLAMA_3_2_1B);
  const [input, setInput] = useState('');

  const textAlign = isRTL ? 'right' : 'left';
  const busy = llama.status === 'loading' || llama.status === 'generating';
  const canSummarize = download.status === 'ready' && input.trim().length > 0 && !busy;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { direction: isRTL ? 'rtl' : 'ltr' }]}
      keyboardShouldPersistTaps="handled">
      <ModelDownloadCard model={LLAMA_3_2_1B} download={download} />

      {download.status === 'ready' && (
        <>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{t('inputLabel')}</Text>
            <Pressable onPress={() => setInput(SAMPLE_TEXT)} hitSlop={8}>
              <Text style={styles.link}>{t('useSample')}</Text>
            </Pressable>
          </View>
          <TextInput
            style={[styles.input, { textAlign }]}
            value={input}
            onChangeText={setInput}
            placeholder={t('inputPlaceholder')}
            multiline
            maxLength={MAX_INPUT_CHARS}
            editable={!busy}
          />

          {llama.status === 'generating' ? (
            <Pressable style={[styles.button, styles.stopButton]} onPress={llama.stop}>
              <Text style={styles.buttonText}>{t('stop')}</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.button, !canSummarize && styles.disabled]}
              disabled={!canSummarize}
              onPress={() => llama.summarize(input)}>
              <Text style={styles.buttonText}>{t('summarize')}</Text>
            </Pressable>
          )}

          {llama.status === 'loading' && (
            <View style={styles.statusRow}>
              <ActivityIndicator />
              <Text style={styles.meta}>
                {t('loadingModel')} {Math.round(llama.loadProgress)}%
              </Text>
            </View>
          )}

          {(llama.output.length > 0 || llama.status === 'generating') && (
            <View style={styles.outputCard}>
              <Text style={[styles.label, { textAlign }]}>{t('summaryLabel')}</Text>
              <Text style={[styles.output, { textAlign }]}>
                {llama.output}
                {llama.status === 'generating' ? '▍' : ''}
              </Text>
            </View>
          )}

          {llama.stats && (
            <Text style={[styles.meta, { textAlign }]}>
              ⚡ {llama.stats.tokensPerSecond.toFixed(1)} {t('tokensPerSecond')} · {llama.stats.tokens}{' '}
              {t('tokens')} · {t('readingTime')} {(llama.stats.promptMs / 1000).toFixed(1)}s
            </Text>
          )}

          {llama.status === 'error' && <Text style={styles.error}>{t('errorModel')}</Text>}
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
  disabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  outputCard: { padding: 16, borderRadius: 12, backgroundColor: '#F2F4F7', gap: 8 },
  output: { fontSize: 15, lineHeight: 23 },
  meta: { fontSize: 13, color: '#555' },
  error: { fontSize: 14, color: '#B91C1C' },
});
