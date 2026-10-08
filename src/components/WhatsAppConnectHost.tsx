import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { colors } from '../theme';
import {
  cancelWhatsAppConnect,
  finishWhatsAppConnect,
  subscribeWhatsAppConnect,
  type WhatsAppConnectRequest,
} from '../lib/whatsappConnect';

function parseDoneUrl(url: string) {
  try {
    const u = new URL(url);
    const error = u.searchParams.get('error');
    if (error) return { ok: false as const, error };
    return {
      ok: u.searchParams.get('ok') === '1',
      phone: u.searchParams.get('phone') || undefined,
      warning: u.searchParams.get('warning') || undefined,
    };
  } catch {
    return { ok: false as const, error: 'Invalid return from WhatsApp connection' };
  }
}

export function WhatsAppConnectHost() {
  const [req, setReq] = useState<WhatsAppConnectRequest | null>(null);

  useEffect(() => subscribeWhatsAppConnect(setReq), []);

  const handleNav = (nav: WebViewNavigation) => {
    if (!req) return;
    const url = nav.url || '';
    if (!url.startsWith(req.doneUrlPrefix)) return;
    const parsed = parseDoneUrl(url);
    if ('error' in parsed && parsed.error && !parsed.ok) {
      finishWhatsAppConnect({ ok: false, error: parsed.error });
      return;
    }
    finishWhatsAppConnect({
      ok: parsed.ok,
      phone: 'phone' in parsed ? parsed.phone : undefined,
      warning: 'warning' in parsed ? parsed.warning : undefined,
    });
  };

  return (
    <Modal visible={!!req} animationType="slide" onRequestClose={cancelWhatsAppConnect}>
      <View style={styles.wrap}>
        <View style={styles.bar}>
          <Text style={styles.title}>Connect WhatsApp</Text>
          <Pressable onPress={cancelWhatsAppConnect} hitSlop={12}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
        {req ? (
          <WebView
            style={styles.web}
            originWhitelist={['*']}
            source={{ html: req.html, baseUrl: req.baseUrl }}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            setSupportMultipleWindows={false}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            )}
            onNavigationStateChange={handleNav}
            onShouldStartLoadWithRequest={(request) => {
              if (request.url.startsWith(req.doneUrlPrefix)) {
                handleNav({ url: request.url } as WebViewNavigation);
                return false;
              }
              return true;
            }}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background, paddingTop: 48 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.foreground },
  cancel: { fontSize: 14, fontWeight: '600', color: colors.primary },
  web: { flex: 1 },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
