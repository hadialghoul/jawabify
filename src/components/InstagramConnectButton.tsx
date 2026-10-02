import { Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useInstagramConnect } from '@/hooks/useInstagramConnect';

interface Props extends Omit<ButtonProps, 'onClick'> {
  onConnected?: () => void;
  label?: string;
}

/** "Continue with Facebook" button that links an Instagram account via its Facebook Page. */
export function InstagramConnectButton({ onConnected, label = 'Connect with Facebook', ...buttonProps }: Props) {
  const { connecting, startConnect, pages, selectPage, cancelPageSelection } = useInstagramConnect(onConnected);

  return (
    <>
      <Button {...buttonProps} disabled={connecting || buttonProps.disabled} onClick={startConnect}>
        {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {label}
      </Button>
      <Dialog open={!!pages} onOpenChange={(open) => !open && cancelPageSelection()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose the Instagram account</DialogTitle>
            <DialogDescription>Pick the Facebook Page whose Instagram account should reply in Jawabify.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {pages?.map((p) => (
              <Button
                key={p.pageId}
                variant="outline"
                className="h-auto w-full justify-start py-3 text-left"
                disabled={connecting}
                onClick={() => selectPage(p.pageId)}
              >
                <div>
                  <p className="font-medium">{p.igUsername ? `@${p.igUsername}` : 'Instagram account'}</p>
                  <p className="text-xs text-muted-foreground">Page: {p.pageName}</p>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
