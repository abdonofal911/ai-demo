import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLanguage } from '@/i18n/LanguageProvider';

export default function Home() {
  const { t, isRTL } = useLanguage();
  const textAlign = isRTL ? 'right' : 'left';

  return (
    <View style={[styles.container, { direction: isRTL ? 'rtl' : 'ltr' }]}>
      <Text style={styles.subtitle}>{t('tagline')}</Text>

      <Link href="/summarize" asChild>
        <Pressable style={styles.card}>
          <Text style={[styles.cardTitle, { textAlign }]}>{t('summarizeTitle')}</Text>
          <Text style={[styles.cardBody, { textAlign }]}>Llama 3.2 1B</Text>
        </Pressable>
      </Link>

      <Link href="/transcribe" asChild>
        <Pressable style={styles.card}>
          <Text style={[styles.cardTitle, { textAlign }]}>{t('transcribeTitle')}</Text>
          <Text style={[styles.cardBody, { textAlign }]}>Whisper</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 16, backgroundColor: '#fff' },
  subtitle: { fontSize: 15, color: '#555', textAlign: 'center', marginBottom: 8 },
  card: { padding: 20, borderRadius: 14, backgroundColor: '#F2F4F7' },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  cardBody: { fontSize: 14, color: '#666', marginTop: 4 },
});
