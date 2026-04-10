import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, Users, CreditCard, Receipt, FileText, Download, Calendar, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, DataCard, SectionTitle, StatCard, StatusBadge, LoadingState, EmptyState } from "@/components/dashboard/DashboardComponents";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

const statusPagamentoLabels: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

const statusFaturaLabels: Record<string, string> = {
  rascunho: "Rascunho",
  emitida: "Emitida",
  paga: "Paga",
  cancelada: "Cancelada",
};

const AdminFinanceiro = () => {
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [faturas, setFaturas] = useState<any[]>([]);
  const [propostas, setPropostas] = useState<any[]>([]);
  const [projetos, setProjetos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("todos");

  useEffect(() => {
    const fetchData = async () => {
      const [pagRes, fatRes, propRes, projRes] = await Promise.all([
        supabase.from("pagamentos").select("*, projetos(nome, protocolo)").order("created_at", { ascending: false }),
        supabase.from("faturas").select("*, pagamentos(projeto_id, projetos(nome, protocolo))").order("created_at", { ascending: false }),
        supabase.from("propostas").select("*, projetos(nome, protocolo)").eq("status", "aceita").order("created_at", { ascending: false }),
        supabase.from("projetos").select("id, nome, status, software_id, softwares(nome)").order("created_at", { ascending: false }),
      ]);

      const pagData = pagRes.data || [];
      const fatData = fatRes.data || [];
      const propData = propRes.data || [];
      const projData = projRes.data || [];

      // Enrich with profile names
      const allUserIds = [
        ...new Set([
          ...pagData.map((p: any) => p.empresa_user_id),
          ...pagData.map((p: any) => p.consultor_user_id),
          ...propData.map((p: any) => p.consultor_user_id),
        ].filter(Boolean)),
      ];

      let nameMap = new Map<string, string>();
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, nome").in("user_id", allUserIds);
        if (profiles) nameMap = new Map(profiles.map((p) => [p.user_id, p.nome]));
      }

      setPagamentos(pagData.map((p: any) => ({
        ...p,
        empresa_nome: nameMap.get(p.empresa_user_id) || "Empresa",
        consultor_nome: nameMap.get(p.consultor_user_id) || "Consultor",
      })));
      setFaturas(fatData);
      setPropostas(propData.map((p: any) => ({
        ...p,
        consultor_nome: nameMap.get(p.consultor_user_id) || "Consultor",
      })));
      setProjetos(projData);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Metrics
  const totalContratado = pagamentos.reduce((s, p) => s + Number(p.valor_total || 0), 0);
  const totalComissao = pagamentos.reduce((s, p) => s + Number(p.comissao_plataforma || 0), 0);
  const totalConsultores = pagamentos.reduce((s, p) => s + Number(p.valor_consultor || 0), 0);
  const pagamentosPagos = pagamentos.filter((p) => p.status === "pago");
  const totalRecebido = pagamentosPagos.reduce((s, p) => s + Number(p.valor_total || 0), 0);
  const totalPendente = pagamentos.filter((p) => p.status === "pendente").reduce((s, p) => s + Number(p.valor_total || 0), 0);

  // If no pagamentos yet, fall back to propostas aceitas for metrics
  const fallbackTotal = propostas.reduce((s, p) => s + Number(p.valor_proposta || 0), 0);
  const displayTotal = totalContratado > 0 ? totalContratado : fallbackTotal;
  const displayComissao = totalComissao > 0 ? totalComissao : fallbackTotal * 0.15;

  const filteredPagamentos = filtroStatus === "todos"
    ? pagamentos
    : pagamentos.filter((p) => p.status === filtroStatus);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Financeiro" description="Gestão financeira completa da plataforma" />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={DollarSign} label="Total contratado" value={formatCurrency(displayTotal)} iconColor="text-success" iconBg="bg-success/10" />
        <StatCard icon={TrendingUp} label="Receita plataforma (15%)" value={formatCurrency(displayComissao)} iconColor="text-primary" iconBg="bg-primary/10" />
        <StatCard icon={CreditCard} label="Recebido" value={formatCurrency(totalRecebido)} iconColor="text-info" iconBg="bg-info/10" />
        <StatCard icon={Receipt} label="Pendente" value={formatCurrency(totalPendente > 0 ? totalPendente : displayTotal)} iconColor="text-warning" iconBg="bg-warning/10" />
      </div>

      {/* Breakdown cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <DataCard>
          <div className="flex items-center gap-3 mb-3">
            <div className="icon-container icon-container-sm bg-success/10">
              <DollarSign size={14} className="text-success" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Para consultores</span>
          </div>
          <p className="text-xl font-display font-bold text-foreground">
            {formatCurrency(totalConsultores > 0 ? totalConsultores : displayTotal * 0.85)}
          </p>
        </DataCard>
        <DataCard>
          <div className="flex items-center gap-3 mb-3">
            <div className="icon-container icon-container-sm bg-primary/10">
              <TrendingUp size={14} className="text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Comissão plataforma</span>
          </div>
          <p className="text-xl font-display font-bold text-foreground">{formatCurrency(displayComissao)}</p>
        </DataCard>
        <DataCard>
          <div className="flex items-center gap-3 mb-3">
            <div className="icon-container icon-container-sm bg-info/10">
              <Users size={14} className="text-info" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Contratos ativos</span>
          </div>
          <p className="text-xl font-display font-bold text-foreground">
            {pagamentos.length > 0 ? pagamentos.length : propostas.length}
          </p>
        </DataCard>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pagamentos" className="space-y-6">
        <TabsList className="bg-muted/60">
          <TabsTrigger value="pagamentos" className="gap-2">
            <CreditCard size={14} /> Pagamentos
          </TabsTrigger>
          <TabsTrigger value="faturas" className="gap-2">
            <FileText size={14} /> Faturas
          </TabsTrigger>
          <TabsTrigger value="contratos" className="gap-2">
            <Receipt size={14} /> Contratos
          </TabsTrigger>
        </TabsList>

        {/* PAGAMENTOS TAB */}
        <TabsContent value="pagamentos">
          <DataCard noPadding>
            <div className="p-5 pb-3 border-b border-border/60 flex items-center justify-between">
              <SectionTitle>Pagamentos</SectionTitle>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[160px] h-9 text-xs">
                  <Filter size={14} className="mr-1" />
                  <SelectValue placeholder="Filtrar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                  <SelectItem value="pago">Pagos</SelectItem>
                  <SelectItem value="atrasado">Atrasados</SelectItem>
                  <SelectItem value="cancelado">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filteredPagamentos.length === 0 ? (
              <EmptyState message={pagamentos.length === 0 ? "Nenhum pagamento registrado. Pagamentos são criados automaticamente ao aceitar uma proposta." : "Nenhum pagamento com este filtro"} icon={CreditCard} />
            ) : (
              <div className="divide-y divide-border/60">
                {filteredPagamentos.map((p) => (
                  <div key={p.id} className="p-4 px-5 table-row-interactive">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`icon-container icon-container-sm flex-shrink-0 ${
                          p.status === "pago" ? "bg-success/10" : p.status === "atrasado" ? "bg-destructive/10" : "bg-muted"
                        }`}>
                          <CreditCard size={14} className={
                            p.status === "pago" ? "text-success" : p.status === "atrasado" ? "text-destructive" : "text-muted-foreground"
                          } />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.projetos?.nome || "Projeto"}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.empresa_nome} → {p.consultor_nome} · {p.projetos?.protocolo}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground">{formatCurrency(Number(p.valor_total))}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Comissão: {formatCurrency(Number(p.comissao_plataforma))}
                          </p>
                        </div>
                        <StatusBadge
                          status={p.status}
                          labels={statusPagamentoLabels}
                        />
                      </div>
                    </div>
                    {p.data_vencimento && (
                      <p className="text-[11px] text-muted-foreground mt-1.5 ml-[54px]">
                        <Calendar size={11} className="inline mr-1" />
                        Vencimento: {format(new Date(p.data_vencimento), "dd/MM/yyyy")}
                        {p.data_pagamento && ` · Pago em: ${format(new Date(p.data_pagamento), "dd/MM/yyyy")}`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </DataCard>
        </TabsContent>

        {/* FATURAS TAB */}
        <TabsContent value="faturas">
          <DataCard noPadding>
            <div className="p-5 pb-3 border-b border-border/60">
              <SectionTitle>Faturas</SectionTitle>
            </div>
            {faturas.length === 0 ? (
              <EmptyState message="Nenhuma fatura emitida ainda" icon={FileText} />
            ) : (
              <div className="divide-y divide-border/60">
                {faturas.map((f) => (
                  <div key={f.id} className="p-4 px-5 table-row-interactive">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="icon-container icon-container-sm bg-primary/10 flex-shrink-0">
                          <FileText size={14} className="text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            Fatura #{f.numero_fatura}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Tipo: {f.tipo} · {f.emitida_em ? format(new Date(f.emitida_em), "dd/MM/yyyy", { locale: ptBR }) : "Não emitida"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm font-semibold text-foreground">{formatCurrency(Number(f.valor))}</span>
                        <StatusBadge
                          status={f.status}
                          labels={statusFaturaLabels}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DataCard>
        </TabsContent>

        {/* CONTRATOS TAB */}
        <TabsContent value="contratos">
          <DataCard noPadding>
            <div className="p-5 pb-3 border-b border-border/60 flex items-center justify-between">
              <SectionTitle>Contratos (Propostas Aceitas)</SectionTitle>
              <Badge variant="secondary" className="text-[11px]">{propostas.length} contratos</Badge>
            </div>
            {propostas.length === 0 ? (
              <EmptyState message="Nenhum contrato firmado ainda" icon={Receipt} />
            ) : (
              <div className="divide-y divide-border/60">
                {propostas.map((p) => (
                  <div key={p.id} className="p-4 px-5 table-row-interactive">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="icon-container icon-container-sm bg-success/10 flex-shrink-0">
                          <DollarSign size={14} className="text-success" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.projetos?.nome || "Projeto"}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.consultor_nome} · {p.estimativa_horas || 0}h · {p.projetos?.protocolo}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-success">{formatCurrency(Number(p.valor_proposta || 0))}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Plataforma: {formatCurrency(Number(p.valor_proposta || 0) * 0.15)}
                          </p>
                        </div>
                        <StatusBadge status="aceita" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DataCard>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminFinanceiro;
