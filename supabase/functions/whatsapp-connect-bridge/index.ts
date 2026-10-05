/**
 * Serves the mobile WhatsApp Embedded Signup HTML (Facebook Login) without
 * depending on a website deploy. Opened by Expo AuthSession.
 *
 *   GET ?page=start  (default) → Facebook connect page
 *   GET ?page=done             → return landing for AuthSession close
 */
const META_APP_ID = '1392579008772004';
const META_CONFIG_ID = '1648388239943864';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'https://qemxlbjwpxyljkansqsl.supabase.co';
// Public anon key (same as the mobile/web clients). Prefer the project secret when present.
const SUPABASE_ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ||
  Deno.env.get('SB_PUBLISHABLE_KEY') ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlbXhsYmp3cHh5bGprYW5zcXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NTgwNzEsImV4cCI6MjA4MTUzNDA3MX0.YZ7bs6m2UvzM8WDx_ui2kPWHmValHIXLI6ProoSWOmA';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function html(body: string) {
  return new Response(body, {
    status: 200,
    headers: { ...cors, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function donePage() {
  return html(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>WhatsApp — Jawabify</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#f8fafc;padding:24px;text-align:center}
h1{font-size:16px;margin:0 0 8px;color:#0f172a}p{margin:0;font-size:14px;color:#64748b}
</style></head><body>
<div><h1 id="t">Returning to Jawabify…</h1><p id="s">You can return to the app now.</p></div>
<script>
(function(){
  var p=new URLSearchParams(location.search);
  var err=p.get('error'), ok=p.get('ok')==='1', phone=p.get('phone');
  var t=document.getElementById('t'), s=document.getElementById('s');
  if(err){t.textContent='WhatsApp connection did not finish';s.textContent=err;}
  else if(ok){t.textContent='WhatsApp connected';s.textContent=phone?('Number: '+phone):'You can return to the app now.';}
})();
</script></body></html>`);
}

function startPage(selfUrl: string) {
  const doneUrl = `${selfUrl}?page=done`;
  const anon = SUPABASE_ANON_KEY.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return html(`<!DOCTYPE html>
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
<a id="back" href="${doneUrl}&error=Cancelled" hidden>Return to the app</a>
<script>
var META_APP_ID='${META_APP_ID}';
var META_CONFIG_ID='${META_CONFIG_ID}';
var SUPABASE_URL='${SUPABASE_URL}';
var SUPABASE_ANON_KEY='${anon}';
var DONE='${doneUrl}';
var msgEl=document.getElementById('msg'), errEl=document.getElementById('err'), spinEl=document.getElementById('spin'), backEl=document.getElementById('back');
var signupData=null;
function fail(text){spinEl.hidden=true;msgEl.hidden=true;errEl.hidden=false;errEl.textContent=text;backEl.hidden=false;backEl.href=DONE+'&error='+encodeURIComponent(text);}
function finish(params){var q=new URLSearchParams(params);location.replace(DONE+'&'+q.toString());}
window.addEventListener('message',function(event){
  if(!/facebook\\.com$/.test(event.origin)&&!/facebook\\.net$/.test(event.origin))return;
  try{var data=typeof event.data==='string'?JSON.parse(event.data):event.data;
  if(!data||data.type!=='WA_EMBEDDED_SIGNUP')return;
  if(data.event&&String(data.event).indexOf('FINISH')===0)signupData=data.data||null;
  if(data.event==='CANCEL'&&data.data&&data.data.error_message)fail(data.data.error_message);}catch(e){}
});
function waitSignup(cb){var n=0;(function tick(){if(signupData||n>10)return cb(signupData);n+=1;setTimeout(tick,200);})();}
function startFbLogin(accessToken,tenantId,actingTenant){
  msgEl.textContent='Opening Facebook to connect WhatsApp…';
  window.fbAsyncInit=function(){
    FB.init({appId:META_APP_ID,cookie:true,xfbml:false,version:'v21.0'});
    FB.login(function(response){
      if(!response||!response.authResponse||!response.authResponse.code){finish({error:'Facebook login was cancelled.'});return;}
      msgEl.textContent='Saving WhatsApp connection…';
      waitSignup(function(data){
        var body={code:response.authResponse.code,tenant_id:tenantId,
          waba_id:(data&&(data.waba_id||(data.waba_ids&&data.waba_ids[0])))||undefined,
          phone_number_id:data&&data.phone_number_id,business_id:data&&data.business_id};
        var headers={'Content-Type':'application/json',apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+accessToken};
        if(actingTenant)headers['x-acting-tenant']=actingTenant;
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
}
(function(){
  var hash=new URLSearchParams(location.hash.replace(/^#/,''));
  var accessToken=hash.get('access_token'), tenantId=hash.get('tenant_id'), actingTenant=hash.get('acting_tenant');
  if(accessToken)history.replaceState({},'',location.pathname+location.search);
  if(!accessToken||!tenantId){fail('Your Jawabify session was missing. Go back to the app and try again.');return;}
  startFbLogin(accessToken,tenantId,actingTenant);
})();
</script></body></html>`);
}

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const url = new URL(req.url);
  const page = url.searchParams.get('page') || 'start';
  if (page === 'done') return donePage();
  // Self URL without hash — used for the done redirect.
  const selfUrl = `${url.origin}${url.pathname}`;
  return startPage(selfUrl);
});
