/** Landing URL Expo AuthSession waits for after WhatsApp Embedded Signup finishes. */
export default function WhatsAppConnectDone() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  const phone = params.get('phone');
  const ok = params.get('ok') === '1';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          {error ? 'WhatsApp connection did not finish' : ok ? 'WhatsApp connected' : 'Returning to Jawabify…'}
        </p>
        <p className="text-sm text-muted-foreground">
          {error || (phone ? `Number: ${phone}` : 'You can return to the app now.')}
        </p>
      </div>
    </div>
  );
}
