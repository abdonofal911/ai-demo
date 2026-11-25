import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioStream } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderStatus = 'idle' | 'recording' | 'denied' | 'error';

export type Recording = { uri: string; durationSec: number; sampleRate: number };

/**
 * Records the microphone straight to a 16-bit mono WAV file, which is what Whisper reads.
 * (The regular expo-audio recorder can only make AAC/AMR files on Android.)
 */
export function useRecorder() {
  const { stream } = useAudioStream({ sampleRate: 16000, channels: 1, encoding: 'int16' });
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  // Release the microphone if the screen closes mid-recording.
  useEffect(
    () => () => {
      clearTimer();
      if (stream.isStreaming) stream.stop();
    },
    [stream],
  );

  const start = useCallback(async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setStatus('denied');
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await stream.start();
      await stream.startFileRecordingAsync({ format: 'wav' });
      setElapsedSec(0);
      const startedAt = Date.now();
      timerRef.current = setInterval(() => setElapsedSec((Date.now() - startedAt) / 1000), 200);
      setStatus('recording');
    } catch (e) {
      console.warn('Could not start recording', e);
      setStatus('error');
    }
  }, [stream]);

  const stop = useCallback(async (): Promise<Recording | null> => {
    clearTimer();
    try {
      const result = await stream.stopFileRecordingAsync();
      stream.stop();
      setStatus('idle');
      return { uri: result.uri, durationSec: result.duration, sampleRate: result.sampleRate };
    } catch (e) {
      console.warn('Could not stop recording', e);
      setStatus('error');
      return null;
    }
  }, [stream]);

  return { status, elapsedSec, start, stop };
}
