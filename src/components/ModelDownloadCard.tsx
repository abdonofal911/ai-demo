import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatBytes, type ModelInfo } from '@/models/registry';
import type { useModelDownload } from '@/models/useModelDownload';

type Props = { model: ModelInfo; download: ReturnType<typeof useModelDownload> };

export function ModelDownloadCard({ model, download }: Props) {
  const confirmDelete = () =>
    Alert.alert('Delete model?', 'You will need to download it again to use this feature.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: download.remove },
    ]);

  const errorText =
    download.error === 'noSpace'
      ? 'Not enough free storage on this phone.'
      : download.error === 'incomplete'
        ? 'The download was incomplete. Please try again.'
        : 'Download failed. Check your connection and try again.';

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{model.name}</Text>
      <Text style={styles.meta}>
        Size: {formatBytes(model.sizeBytes)}
      </Text>


      {download.status === 'ready' && (
        <View style={styles.row}>
          <Text style={styles.ready}>✓ Downloaded — works offline</Text>
          <Button label="Delete" onPress={confirmDelete} variant="danger" />
        </View>
      )}

      {download.status === 'missing' && (
        <>
          <Text style={styles.meta}>Download once on Wi-Fi. After that it runs without internet.</Text>
          <Button label="Download" onPress={download.start} />
        </>
      )}

      {(download.status === 'downloading' || download.status === 'paused') && (
        <>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${download.progress * 100}%` }]} />
          </View>
          <Text style={styles.meta}>
            {Math.floor(download.progress * 100)}% · {formatBytes(download.bytesWritten)} /{' '}
            {formatBytes(model.sizeBytes)}
            {download.status === 'paused' ? ` · $Paused` : ''}
          </Text>
          <View style={styles.row}>
            {download.status === 'downloading' ? (
              <Button label="Pause" onPress={download.pause} variant="secondary" />
            ) : (
              <Button label="Resume" onPress={download.resume} />
            )}
            <Button label="Cancel" onPress={download.cancel} variant="danger" />
          </View>
        </>
      )}

      {download.status === 'error' && (
        <>
          <Text style={styles.error}>{errorText}</Text>
          <Button label="Try again" onPress={download.start} />
        </>
      )}
    </View>
  );
}

function Button({
  label,
  onPress,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, styles[variant], pressed && styles.pressed]}>
      <Text style={[styles.buttonText, variant !== 'primary' && styles.buttonTextDark]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, borderRadius: 14, backgroundColor: '#F2F4F7', gap: 10 },
  title: { fontSize: 17, fontWeight: '600' },
  meta: { fontSize: 14, color: '#555' },
  ready: { fontSize: 15, fontWeight: '600', color: '#15803D' },
  error: { fontSize: 14, color: '#B91C1C' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  track: { height: 10, borderRadius: 5, backgroundColor: '#D9DEE5', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#1D4ED8' },
  button: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center' },
  primary: { backgroundColor: '#1D4ED8' },
  secondary: { backgroundColor: '#E2E8F0' },
  danger: { backgroundColor: '#FEE2E2' },
  pressed: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  buttonTextDark: { color: '#111' },
});
