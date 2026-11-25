import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useLanguage } from '@/i18n/LanguageProvider';
import { formatBytes, type ModelInfo } from '@/models/registry';
import type { useModelDownload } from '@/models/useModelDownload';

type Props = { model: ModelInfo; download: ReturnType<typeof useModelDownload> };

export function ModelDownloadCard({ model, download }: Props) {
  const { t, isRTL } = useLanguage();
  const textAlign = isRTL ? 'right' : 'left';

  const confirmDelete = () =>
    Alert.alert(t('deleteModelTitle'), t('deleteModelMessage'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: download.remove },
    ]);

  const errorText =
    download.error === 'noSpace'
      ? t('errorNoSpace')
      : download.error === 'incomplete'
        ? t('errorIncomplete')
        : t('errorFailed');

  return (
    <View style={styles.card}>
      <Text style={[styles.title, { textAlign }]}>{model.name}</Text>
      <Text style={[styles.meta, { textAlign }]}>
        {t('modelSize')}: {formatBytes(model.sizeBytes)}
      </Text>

      {download.status === 'checking' && <Text style={[styles.meta, { textAlign }]}>{t('checking')}</Text>}

      {download.status === 'ready' && (
        <View style={styles.row}>
          <Text style={styles.ready}>✓ {t('modelReady')}</Text>
          <Button label={t('delete')} onPress={confirmDelete} variant="danger" />
        </View>
      )}

      {download.status === 'missing' && (
        <>
          <Text style={[styles.meta, { textAlign }]}>{t('downloadHint')}</Text>
          <Button label={t('download')} onPress={download.start} />
        </>
      )}

      {(download.status === 'downloading' || download.status === 'paused') && (
        <>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${download.progress * 100}%` }]} />
          </View>
          <Text style={[styles.meta, { textAlign }]}>
            {Math.floor(download.progress * 100)}% · {formatBytes(download.bytesWritten)} /{' '}
            {formatBytes(model.sizeBytes)}
            {download.status === 'paused' ? ` · ${t('paused')}` : ''}
          </Text>
          <View style={styles.row}>
            {download.status === 'downloading' ? (
              <Button label={t('pause')} onPress={download.pause} variant="secondary" />
            ) : (
              <Button label={t('resume')} onPress={download.resume} />
            )}
            <Button label={t('cancel')} onPress={download.cancel} variant="danger" />
          </View>
        </>
      )}

      {download.status === 'error' && (
        <>
          <Text style={[styles.error, { textAlign }]}>{errorText}</Text>
          <Button label={t('retry')} onPress={download.start} />
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
