import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function requireUser(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return null;
  try {
    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error } = await client.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (error || !data?.claims?.sub) return null;
    return data.claims.sub as string;
  } catch {
    return null;
  }
}

// PII patterns to detect and block
const PII_PATTERNS = [
  { pattern: /\b\d{3}[\.\-]?\d{3}[\.\-]?\d{3}[\.\-]?\d{2}\b/, label: "CPF" },
  { pattern: /\b\d{2}[\.\-]?\d{3}[\.\-]?\d{3}[\/\-]?\d{4}[\.\-]?\d{2}\b/, label: "CNPJ" },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, label: "e-mail" },
  { pattern: /\b(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[\-\s]?\d{4}\b/, label: "telefone" },
  { pattern: /\bhttps?:\/\/[^\s]+/i, label: "link externo" },
  { pattern: /\b(?:whatsapp|whats|zap|telegram|instagram|facebook|linkedin\.com)\b/i, label: "rede social" },
  { pattern: /\bpix\b/i, label: "chave PIX" },
];

// Offensive words list (Portuguese)
const OFFENSIVE_WORDS = [
  "idiota", "imbecil", "burro", "estúpido", "estupido", "otário", "otario",
  "babaca", "cretino", "lixo", "merda", "porra", "caralho", "puta",
  "vagabundo", "vagabunda", "fdp", "filho da puta", "desgraçado", "desgraça",
  "arrombado", "arrombada", "viado", "retardado", "mongol", "anta",
  "inútil", "incompetente", "palhaço", "ridículo", "nojento",
];

function checkPII(text: string): { found: boolean; types: string[] } {
  const types: string[] = [];
  for (const { pattern, label } of PII_PATTERNS) {
    if (pattern.test(text)) {
      types.push(label);
    }
  }
  return { found: types.length > 0, types };
}

function checkOffensive(text: string): { found: boolean; words: string[] } {
  const lower = text.toLowerCase();
  const words = OFFENSIVE_WORDS.filter(w => {
    const regex = new RegExp(`\\b${w}\\b`, 'i');
    return regex.test(lower);
  });
  return { found: words.length > 0, words };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conteudo } = await req.json();

    if (!conteudo || typeof conteudo !== 'string') {
      return new Response(JSON.stringify({ aprovado: false, motivo: "Mensagem vazia" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const trimmed = conteudo.trim();
    if (trimmed.length === 0 || trimmed.length > 2000) {
      return new Response(JSON.stringify({
        aprovado: false,
        motivo: trimmed.length === 0 ? "Mensagem vazia" : "Mensagem muito longa (máx. 2000 caracteres)"
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check PII
    const pii = checkPII(trimmed);
    if (pii.found) {
      return new Response(JSON.stringify({
        aprovado: false,
        motivo: `Sua mensagem contém dados pessoais (${pii.types.join(", ")}). Por segurança, não é permitido compartilhar informações de contato direto pela plataforma.`,
        tipo: "pii",
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check offensive content
    const offensive = checkOffensive(trimmed);
    if (offensive.found) {
      return new Response(JSON.stringify({
        aprovado: false,
        motivo: "Sua mensagem contém linguagem ofensiva. Por favor, mantenha um tom profissional e respeitoso.",
        tipo: "ofensivo",
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      aprovado: true,
      conteudo: trimmed,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ aprovado: false, motivo: "Erro ao processar mensagem" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
