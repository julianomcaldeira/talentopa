
-- Replace permissive INSERT policy with a restricted one
-- Notifications are inserted by SECURITY DEFINER functions, so we restrict direct inserts
DROP POLICY "System can insert notifications" ON public.notificacoes;

-- Only allow users to insert notifications for themselves (edge case: self-notifications)
CREATE POLICY "Users can insert own notifications" ON public.notificacoes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
