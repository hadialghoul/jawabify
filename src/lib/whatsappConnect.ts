import { APP_ORIGIN, SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';
import { supabase } from './supabase';
import { getActingMemory } from './actingTenant';

const META_APP_ID = '1392579008772004';
const META_CONFIG_ID = '1648388239943864';

/** AuthSession / WebView return path — must stay on app.jawabify.com for Meta. */
export const WHATSAPP_DONE_URL = `${APP_ORIGIN}/oauth/whatsapp-done`;

export type WhatsAppConnectResult = {
  ok: boolean;
  phone?: string;
  warning?: string;
  error?: string;
};

export type WhatsAppConnectRequest = {
  html: string;
  baseUrl: string;
  doneUrlPrefix: string;
  resolve: (result: WhatsAppConnectResult) => void;
  reject: (error: Error) => void;
};

type Listener = (req: WhatsAppConnectRequest | null) => void;

let pending: WhatsAppConnectRequest | null = null;
const listeners = new Set<Listener>();

export function subscribeWhatsAppConnect(listener: Listener) {
  listeners.add(listener);
  listener(pending);
  return () => {
    listeners.delete(listener);
  };
}

function notify(req: WhatsAppConnectRequest | null) {
  pending = req;
  listeners.forEach((l) => l(req));
}

export function cancelWhatsAppConnect() {
  if (!pending) return;
  const { reject } = pending;
  notify(null);
  reject(new Error('WhatsApp connection was cancelled.'));
}

export function finishWhatsAppConnect(result: WhatsAppConnectResult) {
  if (!pending) return;
  const { resolve, reject } = pending;
  notify(null);
  if (result.error) {
    reject(new Error(result.error));
    return;
  }
  resolve(result);
}

function buildBridgeHtml(accessToken: string, tenantId: string, actingTenant?: string | null) {
  const done = WHATSAPP_DONE_URL;
  const acting = actingTenant ? String(actingTenant).replace(/\\/g, '\\\\').replace(/'/g, "\\'") : '';
  const token = accessToken.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const tid = tenantId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Connect WhatsApp — Jawabify</title>
<style>
body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font-family:system-ui,sans-serif;color:#334155;background:#f8fafc;padding:24px;text-align:center}
.spin{width:28px;height:28px;border:3px solid #cbd5e1;border-top-color:#10b981;border-radius:50%;animation:r .8s linear infinite}
@keyframes r{to{transform:rotate(360deg)}}
.err{color:#dc2626;max-width:28rem;font-size:14px}.msg{color:#64748b;font-size:14px;max-width:28rem}
a{color:#059669;font-size:14px}
</style></head><body>
<div class="spin" id="spin"></div>
<p class="msg" id="msg">Preparing WhatsApp connection…</p>
<p class="err" id="err" hidden></p>
<a id="back" href="${done}?error=Cancelled" hidden>Return to the app</a>
<script>
var META_APP_ID='${META_APP_ID}';
var META_CONFIG_ID='${META_CONFIG_ID}';
var SUPABASE_URL='${SUPABASE_URL}';
var SUPABASE_ANON_KEY='${SUPABASE_ANON_KEY}';
var DONE='${done}';
var ACCESS_TOKEN='${token}';
var TENANT_ID='${tid}';
var ACTING_TENANT='${acting}';
var msgEl=document.getElementById('msg'), errEl=document.getElementById('err'), spinEl=document.getElementById('spin'), backEl=document.getElementById('back');
var signupData=null;
window.open=function(url){if(url)location.href=url;return null;};
function fail(text){spinEl.hidden=true;msgEl.hidden=true;errEl.hidden=false;errEl.textContent=text;backEl.hidden=false;backEl.href=DONE+'?error='+encodeURIComponent(text);}
function finish(params){var q=new URLSearchParams(params);location.replace(DONE+'?'+q.toString());}
window.addEventListener('message',function(event){
  if(!/facebook\\.com$/.test(event.origin)&&!/facebook\\.net$/.test(event.origin))return;
  try{var data=typeof event.data==='string'?JSON.parse(event.data):event.data;
  if(!data||data.type!=='WA_EMBEDDED_SIGNUP')return;
  if(data.event&&String(data.event).indexOf('FINISH')===0)signupData=data.data||null;
  if(data.event==='CANCEL'&&data.data&&data.data.error_message)fail(data.data.error_message);}catch(e){}
});
function waitSignup(cb){var n=0;(function tick(){if(signupData||n>10)return cb(signupData);n+=1;setTimeout(tick,200);})();}
msgEl.textContent='Opening Facebook to connect WhatsApp…';
window.fbAsyncInit=function(){
  FB.init({appId:META_APP_ID,cookie:true,xfbml:false,version:'v21.0'});
  FB.login(function(response){
    if(!response||!response.authResponse||!response.authResponse.code){finish({error:'Facebook login was cancelled.'});return;}
    msgEl.textContent='Saving WhatsApp connection…';
    waitSignup(function(data){
      var body={code:response.authResponse.code,tenant_id:TENANT_ID,
        waba_id:(data&&(data.waba_id||(data.waba_ids&&data.waba_ids[0])))||undefined,
        phone_number_id:data&&data.phone_number_id,business_id:data&&data.business_id};
      var headers={'Content-Type':'application/json',apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+ACCESS_TOKEN};
      if(ACTING_TENANT)headers['x-acting-tenant']=ACTING_TENANT;
      fetch(SUPABASE_URL+'/functions/v1/meta-exchange-token',{method:'POST',headers:headers,body:JSON.stringify(body)})
        .then(function(r){return r.json();})
        .then(function(json){
          if(!json||!json.success){finish({error:(json&&json.error)||'Failed to complete WhatsApp connection'});return;}
          finish({ok:'1',phone:json.phone_number||json.phone_number_id||'',warning:json.warning||''});
        }).catch(function(e){finish({error:e.message||'Failed to reconnect WhatsApp'});});
    });
  },{config_id:META_CONFIG_ID,response_type:'code',override_default_response_type:true,auth_type:'reauthenticate',extras:{setup:{},featureType:'',sessionInfoVersion:'3'}});
};
var s=document.createElement('script');s.src='https://connect.facebook.net/en_US/sdk.js';s.async=true;s.defer=true;
s.onerror=function(){fail('Facebook SDK failed to load. Check your connection and try again.');};
document.body.appendChild(s);
</script></body></html>`;
}

/**
 * Opens WhatsApp Embedded Signup (Facebook Login) in an in-app WebView.
 * Origin is spoofed to app.jawabify.com so Meta accepts the SDK without a website deploy.
 */
export async function connectWhatsApp(tenantId: string): Promise<WhatsAppConnectResult> {
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;
  const session = sessionData.session;
  if (!session?.access_token) {
    throw new Error('You are not signed in. Sign in to Jawabify in the app first.');
  }
  if (!tenantId) throw new Error('No workspace found.');

  const acting = getActingMemory();
  const html = buildBridgeHtml(session.access_token, tenantId, acting?.id);

  return new Promise<WhatsAppConnectResult>((resolve, reject) => {
    notify({
      html,
      baseUrl: `${APP_ORIGIN}/`,
      doneUrlPrefix: WHATSAPP_DONE_URL,
      resolve,
      reject,
    });
  });
}
