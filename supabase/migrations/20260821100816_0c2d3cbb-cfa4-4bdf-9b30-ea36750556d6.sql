UPDATE public.subscriptions
SET status = 'active',
    current_period_end = now() + interval '1 year',
    cancel_at_period_end = false,
    updated_at = now()
WHERE user_id = 'f50e0d4c-8862-49ed-9bdb-977f3002a50d'
  AND id = (
    SELECT id FROM public.subscriptions
    WHERE user_id = 'f50e0d4c-8862-49ed-9bdb-977f3002a50d'
    ORDER BY created_at DESC LIMIT 1
  );