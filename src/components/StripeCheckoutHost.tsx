import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { colors } from '../theme';
import {
  cancelStripeCheckout,
  finishStripeCheckout,
  subscribeStripeCheckout,
  type StripeCheckoutRequest,
} from '../lib/stripeCheckout';

export function StripeCheckoutHost() {
  const [req, setReq] = useState<StripeCheckoutRequest | null>(null);

  useEffect(() => subscribeStripeCheckout(setReq), []);

  const handleNav = (nav: WebViewNavigation) => {
    if (!req) return;
    const url = nav.url || '';
    if (!url.startsWith(req.doneUrlPrefix)) return;
    finishStripeCheckout({ status: 'success' });
  };

  return (
    <Modal visible={!!req} animationType="slide" onRequestClose={cancelStripeCheckout}>
      <View style={styles.wrap}>
        <View style={styles.bar}>
          <Text style={styles.title}>Start free trial</Text>
          <Pressable onPress={cancelStripeCheckout} hitSlop={12}>
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
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
