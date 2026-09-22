import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Eye, X } from 'lucide-react';

export function ActingAsBanner() {
  const { isActingAs, actingTenantName, stopActingAs } = useAuth();
  const navigate = useNavigate();

  if (!isActingAs) return null;

  const exit = () => {
    stopActingAs();
    navigate('/super-admin', { replace: true });
  };

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-3 bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-md">
      <Eye className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">
        Managing <span className="font-semibold">{actingTenantName}</span> — changes are saved to their account
      </span>
      <Button
        size="sm"
        variant="secondary"
        onClick={exit}
        className="h-6 gap-1 px-2 text-xs"
      >
        <X className="h-3 w-3" />
        Exit
      </Button>
    </div>
  );
}
