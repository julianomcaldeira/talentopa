CREATE POLICY "Companies can update proposals on own projects"
ON public.propostas
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projetos
    WHERE projetos.id = propostas.projeto_id
    AND projetos.empresa_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projetos
    WHERE projetos.id = propostas.projeto_id
    AND projetos.empresa_user_id = auth.uid()
  )
);