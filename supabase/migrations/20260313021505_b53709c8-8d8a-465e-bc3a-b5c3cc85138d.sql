
-- Allow admins to update messages (block/unblock)
CREATE POLICY "Admins can update messages" ON public.mensagens
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete messages
CREATE POLICY "Admins can delete messages" ON public.mensagens
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
