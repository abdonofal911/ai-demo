import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Offline AI' }} />
        <Stack.Screen name="summarize" options={{ title: 'Summarize text' }} />
        <Stack.Screen name="transcribe" options={{ title: 'Speech to text' }} />
        <Stack.Screen name="speak" options={{ title: 'Text to speech' }} />
        <Stack.Screen name="assistant" options={{ title: 'Voice assistant' }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
