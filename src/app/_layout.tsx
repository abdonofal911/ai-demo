import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text } from 'react-native';

import { LanguageProvider, useLanguage } from '@/i18n/LanguageProvider';

function LanguageButton() {
  const { t, toggleLanguage } = useLanguage();
  return (
    <Pressable onPress={toggleLanguage} hitSlop={10} style={styles.langButton}>
      <Text style={styles.langText}>{t('switchLanguage')}</Text>
    </Pressable>
  );
}

function AppStack() {
  const { t } = useLanguage();
  return (
    <Stack screenOptions={{ headerRight: () => <LanguageButton /> }}>
      <Stack.Screen name="index" options={{ title: t('appTitle') }} />
      <Stack.Screen name="summarize" options={{ title: t('summarizeTitle') }} />
      <Stack.Screen name="transcribe" options={{ title: t('transcribeTitle') }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <LanguageProvider>
      <AppStack />
      <StatusBar style="auto" />
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  langButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F2F4F7' },
  langText: { fontSize: 14, fontWeight: '600', color: '#1D4ED8' },
});
