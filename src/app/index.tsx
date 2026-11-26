import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>Everything here runs on your device — no internet needed</Text>

      <Link href="/assistant" asChild>
        {/* <Link asChild> rejects style arrays on its direct child, so use one merged style. */}
        <Pressable style={styles.featuredCard}>
          <Text style={[styles.cardTitle, styles.featuredText]}>Voice assistant</Text>
          <Text style={[styles.cardBody, styles.featuredText]}>Whisper → Llama → Kokoro, fully offline</Text>
        </Pressable>
      </Link>

      <Link href="/summarize" asChild>
        <Pressable style={styles.card}>
          <Text style={styles.cardTitle}>Summarize text</Text>
          <Text style={styles.cardBody}>Llama 3.2 1B</Text>
        </Pressable>
      </Link>

      <Link href="/transcribe" asChild>
        <Pressable style={styles.card}>
          <Text style={styles.cardTitle}>Speech to text</Text>
          <Text style={styles.cardBody}>Whisper</Text>
        </Pressable>
      </Link>

      <Link href="/speak" asChild>
        <Pressable style={styles.card}>
          <Text style={styles.cardTitle}>Text to speech</Text>
          <Text style={styles.cardBody}>Kokoro</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const card = { padding: 20, borderRadius: 14, backgroundColor: '#F2F4F7' };

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 16, backgroundColor: '#fff' },
  subtitle: { fontSize: 15, color: '#555', textAlign: 'center', marginBottom: 8 },
  card,
  featuredCard: { ...card, backgroundColor: '#1D4ED8' },
  featuredText: { color: '#fff' },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  cardBody: { fontSize: 14, color: '#666', marginTop: 4 },
});
