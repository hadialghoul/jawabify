ALTER FUNCTION public.delete_email(queue_name text, message_id bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(queue_name text, payload jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer) SET search_path = public, pgmq;