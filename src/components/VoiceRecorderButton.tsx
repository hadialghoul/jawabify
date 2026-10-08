import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { Mic, Square } from 'lucide-react-native';
import type { MediaFile } from '../types';
import { colors } from '../theme';

export function VoiceRecorderButton({
  disabled,
  onRecorded,
  onError,
}: {
  disabled?: boolean;
  onRecorded: (file: MediaFile) => void;
  onError: (message: string) => void;
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const secondsRef = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const start = async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      onError('Allow microphone access to record a voice message.');
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      secondsRef.current = 0;
      setSeconds(0);
      setRecording(true);
      timer.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
      }, 1000);
    } catch {
      onError('Could not start the microphone.');
    }
  };

  const stop = async () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    setRecording(false);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (!uri || secondsRef.current < 1) {
        onError('That recording was too short. Hold a little longer and try again.');
        return;
      }
      onRecorded({
        uri,
        type: 'audio/mp4',
        name: `voice-${Date.now()}.m4a`,
      });
    } catch {
      onError('Could not save the voice message.');
    }
  };

  if (recording) {
    return (
      <Pressable onPress={stop} style={styles.stop} accessibilityLabel="Stop and send voice message">
        <Square size={14} color="#fff" />
        <Text style={styles.time}>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={start}
      disabled={disabled}
      style={styles.mic}
      accessibilityLabel="Record a voice message"
    >
      <Mic size={20} color={disabled ? colors.border : colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mic: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stop: {
    height: 36,
    minWidth: 72,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: colors.destructive,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  time: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
