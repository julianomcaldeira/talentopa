import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function requireUser(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return null;
  const token = authHeader.replace("Bearer ", "").trim();
  try {
    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user?.id) {
      console.error("auth getUser failed:", error?.message);
      return null;
    }
    return data.user.id;
  } catch (e) {
    console.error("auth check exception:", e);
    return null;
  }
}

const DEFAULT_MASTER_CONTEXT = `CONTEXTO MESTRE DA IA WORKZ
A Workz é uma plataforma SaaS B2B que conecta empresas que usam ERPs a consultores especializados.
A IA deve responder somente assuntos relacionados ao core da Workz: projetos ERP, consultores, empresas, propostas, matching, gestão, relatórios, performance e operação da plataforma.
Se o usuário pedir algo fora do escopo, recuse educadamente sem classificar como projeto ERP.`;

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await requireUser(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { problema_atual, objetivo, descricao, software_nome, modelo_contratacao, prazo_estimado } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    if (!problema_atual && !objetivo) {
      return new Response(JSON.stringify({ error: "Preencha o problema atual e/ou objetivo." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPayload = `
Software ERP: ${software_nome || "não informado"}
Modelo: ${modelo_contratacao || "não informado"}
Prazo desejado: ${prazo_estimado || "não informado"}

Descrição: ${descricao || "—"}

Problema atual:
${problema_atual || "—"}

Objetivo:
${objetivo || "—"}
`.trim();

    const tools = [{
      type: "function",
      function: {
        name: "classificar_projeto",
        description: "Classifica e estrutura um projeto de consultoria ERP a partir do briefing da empresa.",
        parameters: {
          type: "object",
          properties: {
            tipo_projeto: { type: "string", enum: ["implantacao", "rollout", "suporte", "melhoria", "migracao", "integracao"] },
            complexidade: { type: "string", enum: ["baixa", "media", "alta", "critica"] },
            senioridade_recomendada: { type: "string", enum: ["junior", "pleno", "senior", "especialista"] },
            horas_estimadas: { type: "number", description: "Estimativa total de horas." },
            modulos_sugeridos: { type: "array", items: { type: "string" }, description: "Nomes de módulos ERP sugeridos." },
            riscos: { type: "array", items: { type: "string" } },
            resumo_executivo: { type: "string", description: "Resumo curto (3-4 frases) do projeto." },
            escopo_sugerido: { type: "string", description: "Escopo detalhado em markdown, incluindo objetivos, entregáveis, premissas e fora-de-escopo." },
            fases_sugeridas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nome: { type: "string" },
                  descricao: { type: "string" },
                  percentual_tempo: { type: "number", description: "Percentual do tempo total (0-100)." },
                },
                required: ["nome", "percentual_tempo"],
                additionalProperties: false,
              },
            },
          },
          required: ["tipo_projeto", "complexidade", "senioridade_recomendada", "resumo_executivo", "escopo_sugerido", "fases_sugeridas"],
          additionalProperties: false,
        },
      },
    }];

    const masterContext = await loadMasterContext();

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: `${masterContext}\n\nVocê é um analista sênior de projetos ERP. Classifique e estruture somente projetos aderentes ao domínio Workz e ao contexto mestre. Responda em português brasileiro. A soma dos percentuais das fases deve totalizar 100.` },
          { role: "user", content: userPayload },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "classificar_projeto" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos da IA esgotados. Contate o administrador." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "IA não retornou classificação." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const args = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("project-classifier error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
