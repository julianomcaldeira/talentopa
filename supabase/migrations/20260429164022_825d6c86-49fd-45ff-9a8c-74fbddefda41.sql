CREATE OR REPLACE FUNCTION public.empresa_pre_aprovar_consultor(p_projeto_id uuid, p_consultor_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto record;
  v_proposta_id uuid;
BEGIN
  SELECT * INTO v_projeto FROM public.projetos WHERE id = p_projeto_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF NOT public.is_empresa_team_member(auth.uid(), v_projeto.empresa_user_id)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para pré-aprovar consultores';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_consultor_user_id
      AND role = 'consultor'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Usuário não é consultor';
  END IF;

  INSERT INTO public.propostas (projeto_id, consultor_user_id, status, comentarios)
  VALUES (p_projeto_id, p_consultor_user_id, 'pre_aprovada'::public.status_proposta, 'Consultor pré-aprovado pela empresa a partir do matching.')
  ON CONFLICT (projeto_id, consultor_user_id)
  DO UPDATE SET status = 'pre_aprovada'::public.status_proposta,
                updated_at = now()
  WHERE public.propostas.status IN ('enviada'::public.status_proposta, 'pre_aprovada'::public.status_proposta)
  RETURNING id INTO v_proposta_id;

  IF v_proposta_id IS NULL THEN
    RAISE EXCEPTION 'Este consultor já está em uma etapa que não permite pré-aprovação';
  END IF;

  UPDATE public.projetos
     SET status = 'em_selecao'::public.status_projeto,
         updated_at = now()
   WHERE id = p_projeto_id
     AND status IN ('publicado'::public.status_projeto, 'em_selecao'::public.status_projeto);

  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (
    p_consultor_user_id,
    'sucesso',
    'Você foi pré-aprovado',
    'A empresa pré-aprovou seu perfil para "' || v_projeto.nome || '". A comunicação foi liberada para alinhamentos antes da aprovação final.',
    p_projeto_id,
    'projeto'
  );

  RETURN jsonb_build_object('success', true, 'proposta_id', v_proposta_id);
END;
$$;

REVOKE ALL ON FUNCTION public.empresa_pre_aprovar_consultor(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.empresa_pre_aprovar_consultor(uuid, uuid) TO authenticated;