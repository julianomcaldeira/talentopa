import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mode, projectData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS["erp-knowledge"];

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
