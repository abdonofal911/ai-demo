import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatBytes } from '@/models/registry';
import { KOKORO_DOWNLOAD_BYTES, type useKokoro } from '@/models/useKokoro';

type Props = { kokoro: ReturnType<typeof useKokoro> };

/** Download state for the Kokoro voice model (several files, fetched by react-native-executorch). */
export function VoiceModelCard({ kokoro }: Props) {
  const { downloadStatus, downloadProgress } = kokoro;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Kokoro TTS (English)</Text>
      <Text style={styles.meta}>Size: ~{formatBytes(KOKORO_DOWNLOAD_BYTES)} · 6 voices</Text>


      {downloadStatus === 'ready' && <Text style={styles.ready}>✓ Downloaded — works offline</Text>}

      {downloadStatus === 'missing' && (
        <>
          <Text style={styles.meta}>Download once on Wi-Fi. After that it runs without internet.</Text>
          <Button label="Download" onPress={kokoro.startDownload} />
        </>
      )}

      {downloadStatus === 'downloading' && (
        <>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${downloadProgress}%` }]} />
          </View>
          <View style={styles.row}>
            <Text style={styles.meta}>
              {Math.floor(downloadProgress)}% · {formatBytes((downloadProgress / 100) * KOKORO_DOWNLOAD_BYTES)} /{' '}
              {formatBytes(KOKORO_DOWNLOAD_BYTES)}
            </Text>
            <Button label="Cancel" onPress={kokoro.cancelDownload} danger />
          </View>
        </>
      )}

      {downloadStatus === 'error' && (
        <>
          <Text style={styles.error}>Download failed. Check your connection and try again.</Text>
          <Button label="Try again" onPress={kokoro.startDownload} />
        </>
      )}
    </View>
  );
}

function Button({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, danger && styles.danger, pressed && styles.pressed]}>
      <Text style={[styles.buttonText, danger && styles.buttonTextDark]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, borderRadius: 14, backgroundColor: '#F2F4F7', gap: 10 },
  title: { fontSize: 17, fontWeight: '600' },
  meta: { fontSize: 14, color: '#555' },
  ready: { fontSize: 15, fontWeight: '600', color: '#15803D' },
  error: { fontSize: 14, color: '#B91C1C' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { height: 10, borderRadius: 5, backgroundColor: '#D9DEE5', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#1D4ED8' },
  button: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center', backgroundColor: '#1D4ED8' },
  danger: { backgroundColor: '#FEE2E2' },
  pressed: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  buttonTextDark: { color: '#111' },
});
