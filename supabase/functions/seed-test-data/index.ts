import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");
    const { data: roleCheck } = await admin.from("user_roles").select("role").eq("user_id", caller.id).eq("role", "admin").single();
    if (!roleCheck) throw new Error("Only admins can seed data");

    const results: string[] = [];

    // Create test consultant users
    const consultores = [
      { email: "joao.silva@teste.com", nome: "João Silva", cidade: "São Paulo", estado: "SP" },
      { email: "maria.santos@teste.com", nome: "Maria Santos", cidade: "Rio de Janeiro", estado: "RJ" },
      { email: "carlos.oliveira@teste.com", nome: "Carlos Oliveira", cidade: "Belo Horizonte", estado: "MG" },
      { email: "ana.costa@teste.com", nome: "Ana Costa", cidade: "Curitiba", estado: "PR" },
      { email: "pedro.lima@teste.com", nome: "Pedro Lima", cidade: "Porto Alegre", estado: "RS" },
      { email: "fernanda.rocha@teste.com", nome: "Fernanda Rocha", cidade: "Campinas", estado: "SP" },
      { email: "rafael.souza@teste.com", nome: "Rafael Souza", cidade: "Salvador", estado: "BA" },
      { email: "julia.ferreira@teste.com", nome: "Julia Ferreira", cidade: "Florianópolis", estado: "SC" },
    ];

    const consultorIds: string[] = [];
    for (const c of consultores) {
      const { data: existing } = await admin.from("profiles").select("user_id").eq("email", c.email).single();
      if (existing) {
        consultorIds.push(existing.user_id);
        results.push(`Consultor ${c.nome} já existe`);
        continue;
      }
      const { data: newUser, error } = await admin.auth.admin.createUser({
        email: c.email,
        password: "Teste123@",
        email_confirm: true,
        user_metadata: { nome: c.nome, tipo_usuario: "consultor" },
      });
      if (error) { results.push(`Erro consultor ${c.nome}: ${error.message}`); continue; }
      consultorIds.push(newUser.user!.id);
      // Update profile with location
      await admin.from("profiles").update({ cidade: c.cidade, estado: c.estado, telefone: `(11) 9${Math.floor(Math.random()*9000+1000)}-${Math.floor(Math.random()*9000+1000)}` }).eq("user_id", newUser.user!.id);
      // Update consultor_perfil with bio
      await admin.from("consultor_perfil").update({ 
        bio_profissional: `Consultor especializado com mais de ${Math.floor(Math.random()*10+3)} anos de experiência em implementações ERP.`,
        linkedin: `https://linkedin.com/in/${c.nome.toLowerCase().replace(/ /g, '-')}`,
        plano: Math.random() > 0.5 ? "premium" : "standard",
      }).eq("user_id", newUser.user!.id);
      results.push(`Consultor ${c.nome} criado`);
    }

    // Create test company users
    const empresas = [
      { email: "contato@abcltda.com.br", nome: "ABC Indústria e Comércio", fantasia: "ABC Ltda", cnpj: "12345678000190", segmento: "Indústria", funcionarios: 250 },
      { email: "ti@xyzsa.com.br", nome: "XYZ Tecnologia S.A.", fantasia: "XYZ Tech", cnpj: "98765432000112", segmento: "Tecnologia", funcionarios: 500 },
      { email: "erp@industriabr.com.br", nome: "Indústria Brasil Ltda", fantasia: "Indústria BR", cnpj: "11222333000144", segmento: "Manufatura", funcionarios: 1200 },
      { email: "admin@gruposol.com.br", nome: "Grupo Sol Participações", fantasia: "Grupo Sol", cnpj: "44555666000177", segmento: "Holding", funcionarios: 3000 },
      { email: "sistemas@metalmax.com.br", nome: "MetalMax Metalurgia", fantasia: "MetalMax", cnpj: "77888999000133", segmento: "Metalurgia", funcionarios: 180 },
    ];

    const empresaIds: string[] = [];
    for (const e of empresas) {
      const { data: existing } = await admin.from("profiles").select("user_id").eq("email", e.email).single();
      if (existing) {
        empresaIds.push(existing.user_id);
        results.push(`Empresa ${e.fantasia} já existe`);
        continue;
      }
      const { data: newUser, error } = await admin.auth.admin.createUser({
        email: e.email,
        password: "Teste123@",
        email_confirm: true,
        user_metadata: { nome: e.nome, tipo_usuario: "empresa" },
      });
      if (error) { results.push(`Erro empresa ${e.fantasia}: ${error.message}`); continue; }
      empresaIds.push(newUser.user!.id);
      await admin.from("empresa_perfil").update({
        cnpj: e.cnpj, nome_fantasia: e.fantasia, segmento: e.segmento, numero_funcionarios: e.funcionarios,
        endereco: `Rua ${e.fantasia}, ${Math.floor(Math.random()*1000+100)} - Centro`,
      }).eq("user_id", newUser.user!.id);
      results.push(`Empresa ${e.fantasia} criada`);
    }

    // Get software and module IDs
    const { data: softwares } = await admin.from("softwares").select("id, nome");
    const { data: modulos } = await admin.from("modulos").select("id, nome, software_id");
    const softwareMap = new Map((softwares || []).map(s => [s.nome, s.id]));
    
    const sapId = softwareMap.get("SAP S/4HANA")!;
    const totvsPId = softwareMap.get("TOTVS Protheus")!;
    const fluigId = softwareMap.get("Fluig")!;
    const oracleId = softwareMap.get("Oracle EBS")!;
    const rmId = softwareMap.get("TOTVS RM")!;

    // Add habilidades for consultores
    if (consultorIds.length >= 8) {
      const habilidades = [
        { user_id: consultorIds[0], software_id: sapId, nivel: "senior", valor_hora: 250 },
        { user_id: consultorIds[0], software_id: sapId, nivel: "especialista", valor_hora: 300 },
        { user_id: consultorIds[1], software_id: totvsPId, nivel: "especialista", valor_hora: 200 },
        { user_id: consultorIds[2], software_id: sapId, nivel: "pleno", valor_hora: 180 },
        { user_id: consultorIds[2], software_id: oracleId, nivel: "senior", valor_hora: 280 },
        { user_id: consultorIds[3], software_id: totvsPId, nivel: "senior", valor_hora: 220 },
        { user_id: consultorIds[3], software_id: fluigId, nivel: "pleno", valor_hora: 150 },
        { user_id: consultorIds[4], software_id: rmId, nivel: "especialista", valor_hora: 190 },
        { user_id: consultorIds[5], software_id: sapId, nivel: "senior", valor_hora: 260 },
        { user_id: consultorIds[5], software_id: totvsPId, nivel: "pleno", valor_hora: 170 },
        { user_id: consultorIds[6], software_id: oracleId, nivel: "pleno", valor_hora: 200 },
        { user_id: consultorIds[7], software_id: totvsPId, nivel: "senior", valor_hora: 210 },
      ];

      // Check existing
      const { data: existingHabs } = await admin.from("consultor_habilidades").select("user_id, software_id");
      const existingSet = new Set((existingHabs || []).map(h => `${h.user_id}-${h.software_id}`));
      const newHabs = habilidades.filter(h => !existingSet.has(`${h.user_id}-${h.software_id}`));
      if (newHabs.length > 0) {
        await admin.from("consultor_habilidades").insert(newHabs);
        results.push(`${newHabs.length} habilidades inseridas`);
      }
    }

    // Create projects
    if (empresaIds.length >= 5) {
      const { data: existingProjects } = await admin.from("projetos").select("id");
      if (!existingProjects || existingProjects.length === 0) {
        const projectsData = [
          { empresa_user_id: empresaIds[0], nome: "Implantação SAP FI/CO", descricao: "Implementação completa dos módulos Financeiro e Controladoria do SAP S/4HANA", software_id: sapId, status: "em_andamento", prazo_estimado: "2026-06-30", problema_atual: "Processos financeiros manuais em planilhas, sem integração entre áreas", objetivo: "Automatizar processos financeiros e de controladoria com SAP" },
          { empresa_user_id: empresaIds[1], nome: "TOTVS Protheus - Módulo Fiscal", descricao: "Implantação do módulo fiscal do TOTVS Protheus para atender SPED e obrigações acessórias", software_id: totvsPId, status: "em_andamento", prazo_estimado: "2026-05-15", problema_atual: "Empresa multada pela Receita por erros nas obrigações acessórias", objetivo: "Compliance fiscal total com SPED, EFD e Reinf" },
          { empresa_user_id: empresaIds[2], nome: "Migração Oracle EBS para S/4HANA", descricao: "Migração de sistema legado Oracle EBS para SAP S/4HANA", software_id: sapId, status: "publicado", prazo_estimado: "2026-09-30", problema_atual: "Oracle EBS sem suporte e sem atualizações", objetivo: "Migrar para SAP S/4HANA mantendo operações" },
          { empresa_user_id: empresaIds[3], nome: "Rollout TOTVS - Filiais", descricao: "Rollout do TOTVS Protheus para 5 novas filiais", software_id: totvsPId, status: "em_selecao", prazo_estimado: "2026-08-01", problema_atual: "Filiais operam com sistemas diferentes, sem consolidação", objetivo: "Unificar operações em todas as filiais com TOTVS" },
          { empresa_user_id: empresaIds[4], nome: "Fluig BPM - Automação", descricao: "Automação de processos de aprovação e workflows com Fluig", software_id: fluigId, status: "publicado", prazo_estimado: "2026-04-30", problema_atual: "Processos de aprovação feitos por e-mail sem rastreabilidade", objetivo: "Automatizar 15 processos de aprovação com Fluig" },
          { empresa_user_id: empresaIds[0], nome: "SAP MM/SD - Logística", descricao: "Implementação dos módulos MM e SD do SAP para gestão logística", software_id: sapId, status: "concluido", prazo_estimado: "2026-02-28", problema_atual: "Gestão de estoque manual com perdas significativas", objetivo: "Implementar gestão integrada de materiais e vendas" },
          { empresa_user_id: empresaIds[1], nome: "TOTVS Protheus - RH/DP", descricao: "Implantação completa da folha de pagamento e ponto eletrônico", software_id: totvsPId, status: "concluido", prazo_estimado: "2026-01-31", problema_atual: "Folha processada em sistema legado sem suporte", objetivo: "Modernizar gestão de RH e DP" },
          { empresa_user_id: empresaIds[3], nome: "TOTVS RM - Financeiro", descricao: "Implantação do módulo financeiro do TOTVS RM", software_id: rmId, status: "em_andamento", prazo_estimado: "2026-07-15", problema_atual: "Controle financeiro em planilhas Excel", objetivo: "Automatizar contas a pagar e receber" },
          { empresa_user_id: empresaIds[2], nome: "SAP HCM - Recursos Humanos", descricao: "Implementação do SAP HCM para gestão de pessoas", software_id: sapId, status: "rascunho", prazo_estimado: "2026-10-30", problema_atual: "RH usa sistema apartado sem integração com financeiro", objetivo: "Integrar RH ao ecossistema SAP" },
          { empresa_user_id: empresaIds[4], nome: "Oracle Financials", descricao: "Implantação Oracle Financials para holding", software_id: oracleId, status: "cancelado", prazo_estimado: "2026-03-01", problema_atual: "Projeto cancelado por mudança de estratégia", objetivo: "Implantação cancelada - migrado para SAP" },
        ];

        const { data: inserted, error: insertErr } = await admin.from("projetos").insert(projectsData).select("id, nome, status, empresa_user_id");
        if (insertErr) { results.push(`Erro projetos: ${insertErr.message}`); }
        else {
          results.push(`${inserted.length} projetos criados`);

          // Add phases for each project
          const faseTemplates: Record<string, { nome: string; horas_est: number; horas_exec: number; status: string; prazo_offset: number }[]> = {
            "em_andamento": [
              { nome: "Levantamento de Requisitos", horas_est: 40, horas_exec: 38, status: "aprovada", prazo_offset: -60 },
              { nome: "Configuração Base", horas_est: 80, horas_exec: 65, status: "em_andamento", prazo_offset: -30 },
              { nome: "Integrações", horas_est: 60, horas_exec: 10, status: "pendente", prazo_offset: 15 },
              { nome: "Testes Integrados", horas_est: 40, horas_exec: 0, status: "pendente", prazo_offset: 45 },
              { nome: "Treinamento", horas_est: 24, horas_exec: 0, status: "pendente", prazo_offset: 60 },
              { nome: "Go-live", horas_est: 16, horas_exec: 0, status: "pendente", prazo_offset: 75 },
            ],
            "concluido": [
              { nome: "Levantamento de Requisitos", horas_est: 32, horas_exec: 30, status: "aprovada", prazo_offset: -90 },
              { nome: "Configuração", horas_est: 60, horas_exec: 55, status: "aprovada", prazo_offset: -60 },
              { nome: "Testes", horas_est: 24, horas_exec: 28, status: "aprovada", prazo_offset: -30 },
              { nome: "Go-live", horas_est: 16, horas_exec: 18, status: "aprovada", prazo_offset: -15 },
              { nome: "Suporte Pós Go-live", horas_est: 20, horas_exec: 22, status: "aprovada", prazo_offset: 0 },
            ],
            "publicado": [
              { nome: "Planejamento", horas_est: 30, horas_exec: 0, status: "pendente", prazo_offset: 30 },
              { nome: "Implantação", horas_est: 100, horas_exec: 0, status: "pendente", prazo_offset: 90 },
              { nome: "Testes", horas_est: 40, horas_exec: 0, status: "pendente", prazo_offset: 120 },
              { nome: "Go-live", horas_est: 16, horas_exec: 0, status: "pendente", prazo_offset: 140 },
            ],
            "em_selecao": [
              { nome: "Análise e Planejamento", horas_est: 40, horas_exec: 0, status: "pendente", prazo_offset: 30 },
              { nome: "Rollout Filial 1-2", horas_est: 80, horas_exec: 0, status: "pendente", prazo_offset: 60 },
              { nome: "Rollout Filial 3-5", horas_est: 120, horas_exec: 0, status: "pendente", prazo_offset: 120 },
              { nome: "Validação Global", horas_est: 40, horas_exec: 0, status: "pendente", prazo_offset: 150 },
            ],
          };

          const allFases: any[] = [];
          const projectsForProposals: { id: string; status: string }[] = [];

          for (const proj of inserted) {
            const template = faseTemplates[proj.status];
            if (template) {
              template.forEach((f, i) => {
                const prazoDate = new Date();
                prazoDate.setDate(prazoDate.getDate() + f.prazo_offset);
                allFases.push({
                  projeto_id: proj.id,
                  nome: f.nome,
                  ordem: i,
                  horas_estimadas: f.horas_est,
                  horas_executadas: f.horas_exec,
                  status: f.status,
                  prazo: prazoDate.toISOString().split("T")[0],
                  valor: f.horas_est * (150 + Math.floor(Math.random() * 100)),
                });
              });
            }
            if (["em_andamento", "em_selecao", "publicado", "concluido"].includes(proj.status)) {
              projectsForProposals.push({ id: proj.id, status: proj.status });
            }
          }

          if (allFases.length > 0) {
            await admin.from("projeto_fases").insert(allFases);
            results.push(`${allFases.length} fases criadas`);
          }

          // Create proposals
          const propostas: any[] = [];
          for (const proj of projectsForProposals) {
            const numProposals = proj.status === "em_andamento" || proj.status === "concluido" ? 3 : 2;
            for (let i = 0; i < Math.min(numProposals, consultorIds.length); i++) {
              const isAccepted = (proj.status === "em_andamento" || proj.status === "concluido") && i === 0;
              propostas.push({
                projeto_id: proj.id,
                consultor_user_id: consultorIds[i % consultorIds.length],
                status: isAccepted ? "aceita" : (Math.random() > 0.5 ? "enviada" : "recusada"),
                valor_proposta: Math.floor(Math.random() * 40000 + 15000),
                estimativa_horas: Math.floor(Math.random() * 150 + 50),
                comentarios: `Proposta para o projeto. Tenho experiência relevante nesta área.`,
              });
            }
          }

          if (propostas.length > 0) {
            await admin.from("propostas").insert(propostas);
            results.push(`${propostas.length} propostas criadas`);
          }

          // Create alerts for at-risk projects
          const alertas: any[] = [];
          for (const proj of inserted.filter((p: any) => p.status === "em_andamento")) {
            alertas.push(
              { projeto_id: proj.id, tipo: "atraso", severidade: "alta", titulo: `Fase atrasada no projeto ${proj.nome.substring(0, 30)}`, descricao: "A fase de configuração está 5 dias atrasada em relação ao cronograma" },
              { projeto_id: proj.id, tipo: "horas", severidade: "media", titulo: "Consumo de horas acima do planejado", descricao: "Horas executadas representam 85% do estimado com apenas 60% do escopo concluído" },
            );
          }
          alertas.push(
            { projeto_id: inserted[3]?.id, tipo: "inatividade", severidade: "media", titulo: "Sem atividade há 7 dias", descricao: "Nenhuma atualização no projeto nos últimos 7 dias" },
          );

          if (alertas.length > 0) {
            await admin.from("projeto_alertas").insert(alertas);
            results.push(`${alertas.length} alertas criados`);
          }

          // Create avaliacoes for concluded projects
          const avaliacoes: any[] = [];
          for (const proj of inserted.filter((p: any) => p.status === "concluido")) {
            if (consultorIds.length > 0) {
              avaliacoes.push({
                projeto_id: proj.id,
                avaliado_user_id: consultorIds[0],
                avaliador_user_id: proj.empresa_user_id,
                nota: Math.floor(Math.random() * 2) + 4, // 4 or 5
                comentario: "Excelente trabalho! Muito profissional e pontual.",
                recomendacao: true,
              });
            }
          }

          if (avaliacoes.length > 0) {
            await admin.from("avaliacoes").insert(avaliacoes);
            results.push(`${avaliacoes.length} avaliações criadas`);
          }

          // Create aprendizados for concluded projects  
          const aprendizados: any[] = [];
          for (const proj of inserted.filter((p: any) => p.status === "concluido")) {
            const sw = softwares?.find(s => s.id === projectsData.find(pd => pd.nome === proj.nome)?.software_id);
            aprendizados.push({
              projeto_id: proj.id,
              tipo_projeto: "implantacao",
              erp_utilizado: sw?.nome || "SAP",
              modulos_implementados: ["Financeiro", "Controladoria"],
              horas_estimadas: 150,
              horas_reais: 155,
              tempo_estimado_dias: 90,
              tempo_real_dias: 95,
              dificuldades: "Integração com sistema legado, resistência dos usuários à mudança",
              licoes_aprendidas: "Envolver key users desde o início acelera a adoção. Testes integrados devem ter mais tempo alocado.",
              recomendacoes: "Alocar 20% mais tempo para testes. Treinamento hands-on é mais eficaz que teórico.",
              tags: ["implantacao", "financeiro", "integracao"],
              created_by: consultorIds[0] || null,
            });
          }

          if (aprendizados.length > 0) {
            await admin.from("projeto_aprendizados").insert(aprendizados);
            results.push(`${aprendizados.length} aprendizados criados`);
          }
        }
      } else {
        results.push(`Projetos já existem (${existingProjects.length}), pulando...`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
