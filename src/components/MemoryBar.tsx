import { StyleSheet, Text, View } from 'react-native';

import { useMemoryStats } from '@/memory/useMemoryStats';
import { formatBytes } from '@/models/registry';

/** Live RAM readout: how much this app uses vs. what's left on the phone. */
export function MemoryBar() {
  const memory = useMemoryStats();
  if (!memory) return null;

  const share = memory.totalBytes > 0 ? memory.appUsedBytes / memory.totalBytes : 0;

  return (
    <View style={[styles.container, memory.lowMemory && styles.low]}>
      <View style={styles.row}>
        <Text style={styles.label}>RAM</Text>
        <Text style={styles.value}>
          {formatBytes(memory.appUsedBytes)} used by app · {formatBytes(memory.availableBytes)} free
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(share * 100, 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, borderRadius: 12, backgroundColor: '#0F172A', gap: 8 },
  low: { backgroundColor: '#7F1D1D' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { color: '#93C5FD', fontWeight: '700', fontSize: 13 },
  value: { color: '#F8FAFC', fontSize: 13, fontVariant: ['tabular-nums'], flexShrink: 1 },
  track: { height: 6, borderRadius: 3, backgroundColor: '#334155', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#60A5FA' },
});
