const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cnpj } = await req.json();
    if (!cnpj) {
      return new Response(JSON.stringify({ error: 'CNPJ é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) {
      return new Response(JSON.stringify({ error: `CNPJ ${cnpj} inválido. Verifique se possui 14 dígitos.` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Basic CNPJ validation (reject all-same-digit CNPJs)
    if (/^(\d)\1+$/.test(cleanCnpj)) {
      return new Response(JSON.stringify({ error: `CNPJ ${cnpj} inválido.` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate CNPJ check digits
    const calcDigit = (str: string, weights: number[]) => {
      const sum = weights.reduce((s, w, i) => s + parseInt(str[i]) * w, 0);
      const rem = sum % 11;
      return rem < 2 ? 0 : 11 - rem;
    };
    const w1 = [5,4,3,2,9,8,7,6,5,4,3,2];
    const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
    const d1 = calcDigit(cleanCnpj, w1);
    const d2 = calcDigit(cleanCnpj, w2);
    if (parseInt(cleanCnpj[12]) !== d1 || parseInt(cleanCnpj[13]) !== d2) {
      return new Response(JSON.stringify({ error: `CNPJ ${cnpj} inválido. Os dígitos verificadores não conferem.` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use BrasilAPI for CNPJ lookup (free, no key needed)
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: data.message || 'CNPJ não encontrado' }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      razao_social: data.razao_social || '',
      nome_fantasia: data.nome_fantasia || '',
      cnpj: cleanCnpj,
      endereco: [data.logradouro, data.numero, data.complemento, data.bairro, data.municipio, data.uf]
        .filter(Boolean).join(', '),
      segmento: data.cnae_fiscal_descricao || '',
      situacao_cadastral: data.descricao_situacao_cadastral || '',
      porte: data.porte || '',
      natureza_juridica: data.natureza_juridica || '',
      capital_social: data.capital_social || 0,
      data_abertura: data.data_inicio_atividade || '',
      telefone: data.ddd_telefone_1 || '',
      email: data.email || '',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Erro ao consultar CNPJ' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
