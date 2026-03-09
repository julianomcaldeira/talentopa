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
      return new Response(JSON.stringify({ error: 'CNPJ inválido' }), {
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
