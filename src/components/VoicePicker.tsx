import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { KOKORO_VOICES, type KokoroVoice } from '@/models/useKokoro';

type Props = { value: KokoroVoice; onChange: (voice: KokoroVoice) => void; disabled?: boolean };

export function VoicePicker({ value, onChange, disabled }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {KOKORO_VOICES.map((voice) => (
        <Pressable
          key={voice.id}
          disabled={disabled}
          onPress={() => onChange(voice.id)}
          style={[styles.chip, value === voice.id && styles.chipActive, disabled && styles.disabled]}>
          <Text style={[styles.chipText, value === voice.id && styles.chipTextActive]}>{voice.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#F2F4F7' },
  chipActive: { backgroundColor: '#1D4ED8' },
  chipText: { fontSize: 14, color: '#333' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
