export const META_APP_ID = '1392579008772004';

let sdkPromise: Promise<any> | null = null;

/** Loads + initialises the Facebook JS SDK once and resolves with window.FB. */
export function loadFacebookSdk(): Promise<any> {
  const w = window as any;
  if (w.FB) {
    try { w.FB.init({ appId: META_APP_ID, cookie: true, xfbml: false, version: 'v21.0' }); } catch { /* already */ }
    return Promise.resolve(w.FB);
  }
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const init = () => {
      if (!w.FB) return;
      try { w.FB.init({ appId: META_APP_ID, cookie: true, xfbml: false, version: 'v21.0' }); } catch { /* already */ }
      resolve(w.FB);
    };
    const prev = w.fbAsyncInit;
    w.fbAsyncInit = () => { prev?.(); init(); };
    let script = document.getElementById('facebook-jssdk') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      document.body.appendChild(script);
    }
    script.addEventListener('load', init);
    script.addEventListener('error', () => { sdkPromise = null; reject(new Error('Facebook SDK failed to load')); });
    window.setTimeout(() => (w.FB ? init() : null), 3000);
  });
  return sdkPromise;
}
