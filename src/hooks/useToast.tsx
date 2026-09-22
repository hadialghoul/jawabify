import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../theme';

type ToastKind = 'success' | 'error' | 'info';

interface ToastContextType {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  };
}

const ToastContext = createContext<ToastContextType>({
  toast: { success: () => {}, error: () => {}, info: () => {} },
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const [kind, setKind] = useState<ToastKind>('info');
  const opacity = useMemo(() => new Animated.Value(0), []);

  const show = useCallback(
    (next: string, nextKind: ToastKind) => {
      setMessage(next);
      setKind(nextKind);
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.delay(2400),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setMessage(null));
    },
    [opacity],
  );

  const value = useMemo(
    () => ({
      toast: {
        success: (m: string) => show(m, 'success'),
        error: (m: string) => show(m, 'error'),
        info: (m: string) => show(m, 'info'),
      },
    }),
    [show],
  );

  const bg = kind === 'error' ? colors.destructive : kind === 'success' ? colors.success : colors.header;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? (
        <Animated.View pointerEvents="none" style={[styles.wrap, { opacity, top: Math.max(insets.top, 24) + 12 }]}>
          <View style={[styles.toast, { backgroundColor: bg }]}>
            <Text style={styles.text}>{message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext).toast;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
    alignItems: 'center',
  },
  toast: {
    maxWidth: 420,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
