import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>Everything here runs on your device — no internet needed</Text>

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
