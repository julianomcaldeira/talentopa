CREATE TABLE IF NOT EXISTS public.ai_context_config (
  id text PRIMARY KEY DEFAULT 'singleton',
  contexto text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  atualizado_por uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_context_config_singleton CHECK (id = 'singleton')
);

ALTER TABLE public.ai_context_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view AI master context" ON public.ai_context_config;
CREATE POLICY "Admins can view AI master context"
ON public.ai_context_config
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert AI master context" ON public.ai_context_config;
CREATE POLICY "Admins can insert AI master context"
ON public.ai_context_config
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update AI master context" ON public.ai_context_config;
CREATE POLICY "Admins can update AI master context"
ON public.ai_context_config
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_ai_context_config_updated_at ON public.ai_context_config;
CREATE TRIGGER update_ai_context_config_updated_at
BEFORE UPDATE ON public.ai_context_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ai_context_config (id, contexto, ativo)
VALUES (
  'singleton',
  'CONTEXTO MESTRE DA IA WORKZ

A Workz é uma plataforma SaaS B2B que conecta empresas que usam ERPs a consultores especializados. A plataforma apoia a criação, publicação, análise, matching, contratação, gestão e acompanhamento de projetos ERP.

Papéis principais:
- Admin: administra a plataforma, catálogo ERP, consultores, empresas, projetos, métricas, relatórios, auditoria, moderação, score e configurações.
- Empresa: cria projetos ERP, define escopo, prazo para propostas, avalia consultores, analisa propostas e acompanha a execução.
- Consultor: cadastra habilidades, encontra projetos, envia propostas, executa projetos, registra entregas, horas, reuniões e usa copiloto técnico.

Domínio permitido da IA:
- Projetos ERP, implantação, rollout, migração, integração, suporte e melhoria.
- ERPs como SAP, TOTVS, Oracle, Microsoft Dynamics e módulos/funcionalidades relacionados.
- Escopo, requisitos, riscos, cronograma, estimativa de horas, senioridade, fases e entregáveis.
- Matching entre projeto e consultor, propostas, contratação, seleção e performance.
- Gestão de projetos, comunicação, reuniões, atas, horas, entregáveis, alertas e saúde do projeto.
- Relatórios, benchmarking, métricas operacionais, score, portfólio e inteligência da plataforma.
- Uso, regras de negócio e operação da Workz.

Regra de ouro:
A IA deve responder somente assuntos relacionados ao core da Workz e ao contexto acima. Se o usuário pedir algo fora do escopo, a IA deve recusar de forma educada, curta e profissional, sem tentar responder o conteúdo externo.

Resposta padrão para temas fora do escopo:
"Não consigo responder sobre esse tema. Meu foco é apoiar usuários dentro da plataforma Workz, em assuntos relacionados a projetos ERP, consultores, empresas, propostas, matching, gestão, relatórios e operação da plataforma."

Estilo de resposta:
- Responder sempre em português brasileiro.
- Ser profissional, objetivo e acionável.
- Não inventar dados inexistentes.
- Quando faltar contexto, fazer perguntas objetivas.
- Priorizar recomendações aplicáveis ao ambiente ERP e à operação da Workz.
- Não orientar ações fora da plataforma quando isso não tiver relação com o core do sistema.',
  true
)
ON CONFLICT (id) DO NOTHING;