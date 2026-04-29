import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_MASTER_CONTEXT = `CONTEXTO MESTRE DA IA WORKZ
A Workz é uma plataforma SaaS B2B que conecta empresas que usam ERPs a consultores especializados.
A IA deve responder somente assuntos relacionados ao core da Workz: projetos ERP, consultores, empresas, propostas, matching, gestão, relatórios, performance e operação da plataforma.
Se o usuário pedir algo fora do escopo, recuse educadamente com: "Não consigo responder sobre esse tema. Meu foco é apoiar usuários dentro da plataforma Workz, em assuntos relacionados a projetos ERP, consultores, empresas, propostas, matching, gestão, relatórios e operação da plataforma."`;

const OUT_OF_SCOPE_MESSAGE = "Não consigo responder sobre esse tema. Meu foco é apoiar usuários dentro da plataforma Workz, em assuntos relacionados a projetos ERP, consultores, empresas, propostas, matching, gestão, relatórios e operação da plataforma.";

function createSseMessage(content: string) {
  const chunk = JSON.stringify({
    choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }],
  });
  const done = JSON.stringify({
    choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: "stop" }],
  });
  return `data: ${chunk}\n\ndata: ${done}\n\ndata: [DONE]\n\n`;
}

async function loadMasterContext() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return DEFAULT_MASTER_CONTEXT;

  try {
    const response = await fetch(`${url}/rest/v1/ai_context_config?id=eq.singleton&ativo=eq.true&select=contexto`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!response.ok) return DEFAULT_MASTER_CONTEXT;
    const rows = await response.json();
    return rows?.[0]?.contexto || DEFAULT_MASTER_CONTEXT;
  } catch {
    return DEFAULT_MASTER_CONTEXT;
  }
}

function getUserIdFromRequest(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload?.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

async function logOutOfScopeBlock({ userId, mode, message, reason }: {
  userId: string | null;
  mode: string;
  message: string;
  reason?: string;
}) {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return;

  try {
    let actorNome = "Usuário não identificado";
    let actorRole = "desconhecido";

    if (userId) {
      const profileResponse = await fetch(`${url}/rest/v1/profiles?user_id=eq.${userId}&select=nome`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      const roleResponse = await fetch(`${url}/rest/v1/user_roles?user_id=eq.${userId}&select=role&limit=1`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });

      if (profileResponse.ok) {
        const profiles = await profileResponse.json();
        actorNome = profiles?.[0]?.nome || actorNome;
      }
      if (roleResponse.ok) {
        const roles = await roleResponse.json();
        actorRole = roles?.[0]?.role || actorRole;
      }
    }

    await fetch(`${url}/rest/v1/audit_logs`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        actor_user_id: userId,
        actor_role: actorRole,
        actor_nome: actorNome,
        categoria: "ia",
        acao: "pergunta_fora_escopo_bloqueada",
        entidade: "ai-assistant",
        descricao: `Pergunta fora do escopo bloqueada. Motivo: ${reason || "Não informado"}`,
        dados_novos: { modo: mode, motivo: reason || null, pergunta: message.slice(0, 1000) },
        severidade: "warning",
      }),
    });
  } catch (error) {
    console.error("audit log out-of-scope error:", error);
  }
}

async function isInScope({ messages, mode, projectData, masterContext, apiKey }: {
  messages: Array<{ role: string; content: string }>;
  mode: string;
  projectData?: unknown;
  masterContext: string;
  apiKey: string;
}) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content?.trim();
  if (!lastUserMessage) return { allowed: true };

  const tools = [{
    type: "function",
    function: {
      name: "verificar_escopo_workz",
      description: "Verifica se a mensagem do usuário está dentro do escopo permitido da plataforma Workz.",
      parameters: {
        type: "object",
        properties: {
          permitido: { type: "boolean", description: "True somente se a pergunta for relacionada ao core da Workz." },
          motivo: { type: "string", description: "Motivo curto da classificação." },
        },
        required: ["permitido", "motivo"],
        additionalProperties: false,
      },
    },
  }];

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: `${masterContext}\n\nVocê é uma barreira de escopo. Responda apenas chamando a função. Marque permitido=false para perguntas fora do domínio Workz, mesmo que sejam simples, educativas ou gerais.` },
        { role: "user", content: JSON.stringify({ mode, mensagem: lastUserMessage, contexto_projeto: projectData ? JSON.stringify(projectData).slice(0, 2500) : null }) },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "verificar_escopo_workz" } },
    }),
  });

  if (!response.ok) return { allowed: true };
  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) return { allowed: true };
  const args = JSON.parse(toolCall.function.arguments);
  return { allowed: args.permitido !== false, reason: args.motivo as string | undefined };
}

const SYSTEM_PROMPTS: Record<string, string> = {
  "project-scope": `Você é o Project Scope AI, um assistente especializado em definir escopos de projetos de consultoria ERP.

Seu papel é fazer perguntas guiadas para entender o projeto e gerar um escopo estruturado.

FLUXO DE PERGUNTAS (faça uma por vez, de forma natural e conversacional):
1. Qual ERP será utilizado? (SAP, TOTVS, Oracle, Dynamics, outro)
2. Qual módulo? (Financeiro/FI, MM, SD, PP, CO, HR etc)
3. Tipo de projeto: Implantação, Rollout, Suporte, Melhorias, Migração
4. Quantos usuários serão impactados?
5. Qual prazo esperado?
6. Qual problema deseja resolver?

Após coletar todas as informações, gere um RELATÓRIO ESTRUTURADO com:
- Nome sugerido do projeto
- Complexidade (Baixa/Média/Alta/Crítica)
- Etapas sugeridas (numeradas)
- Estimativa de horas
- Perfil de consultor necessário (nível + especialização)
- Riscos identificados
- Recomendações

Use emojis moderadamente. Seja profissional mas amigável. Responda SEMPRE em português brasileiro.
Quando tiver todas as informações, gere o relatório automaticamente sem perguntar se o usuário quer.`,

  "project-manager": `Você é o AI Project Manager, um gerente de projetos inteligente para projetos de consultoria ERP.

Você recebe dados de projetos e deve:
1. Analisar o status atual do projeto
2. Identificar riscos e alertas
3. Gerar resumos e recomendações
4. Sugerir ações corretivas

Formato de resposta:
- Use seções claras com cabeçalhos
- Destaque alertas com ⚠️
- Use ✅ para itens positivos
- Use 📊 para métricas
- Seja direto e acionável

Responda SEMPRE em português brasileiro.`,

  "erp-knowledge": `Você é o ERP Knowledge AI, um assistente técnico especializado em ERPs (SAP, TOTVS, Oracle, Dynamics, etc).

Você tem conhecimento profundo sobre:
- Configuração e customização de módulos ERP
- Resolução de erros e problemas comuns
- Melhores práticas de implantação
- Integrações entre módulos
- Transações e códigos específicos (SPRO, OBYC, SE38 etc para SAP)
- Fluxos de processo de negócio

Ao responder:
1. Seja técnico e preciso
2. Forneça passos detalhados quando aplicável
3. Mencione transações/caminhos específicos
4. Sugira possíveis causas quando for um erro
5. Inclua dicas e melhores práticas
6. Use formatação markdown para organizar a resposta

Responda SEMPRE em português brasileiro.`,

  "consultant-copilot": `Você é o Consultant Copilot, um assistente de IA para consultores de ERP durante seus projetos.

Você ajuda consultores com:
1. Gerar respostas profissionais para clientes
2. Criar documentação técnica
3. Sugerir soluções técnicas para problemas
4. Resumir reuniões e gerar atas
5. Criar planos de ação
6. Troubleshooting de erros em ERPs
7. Gerar scripts de configuração
8. Preparar materiais de treinamento

Ao responder:
- Seja direto e acionável
- Forneça exemplos práticos
- Mencione transações/caminhos específicos quando aplicável
- Organize a resposta com markdown
- Sugira próximos passos

Responda SEMPRE em português brasileiro.`,

  "consultant-analysis": `Você é o Consultant Intelligence AI, um analista de performance de consultores de ERP.

Você recebe dados de performance do consultor e deve:
1. Analisar o score e métricas
2. Identificar pontos fortes e fracos
3. Comparar com benchmarks do mercado
4. Sugerir áreas de melhoria
5. Recomendar tipos de projetos ideais para o perfil

Use formatação markdown com seções claras.
Use emojis moderadamente para destacar pontos.
Responda SEMPRE em português brasileiro.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mode, projectData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const masterContext = await loadMasterContext();
    const scope = await isInScope({ messages, mode, projectData, masterContext, apiKey: LOVABLE_API_KEY });
    if (!scope.allowed) {
      const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content?.trim() || "";
      await logOutOfScopeBlock({
        userId: getUserIdFromRequest(req),
        mode,
        message: lastUserMessage,
        reason: scope.reason,
      });

      return new Response(createSseMessage(OUT_OF_SCOPE_MESSAGE), {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    const systemPrompt = `${masterContext}\n\nINSTRUÇÕES ESPECÍFICAS DO ASSISTENTE:\n${SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS["erp-knowledge"]}`;

    // For project-manager, inject project data into the system prompt
    let fullSystemPrompt = systemPrompt;
    if (mode === "project-manager" && projectData) {
      fullSystemPrompt += `\n\nDados do projeto atual:\n${JSON.stringify(projectData, null, 2)}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: fullSystemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Entre em contato com o suporte." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
