ALTER TABLE public.propostas REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.propostas;