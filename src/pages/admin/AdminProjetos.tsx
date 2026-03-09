import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Search, Calendar, Building2, Users, Filter, Eye, ArrowUpDown, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, DataCard, EmptyState, LoadingState, StatusBadge, SectionTitle, StatCard } from "@/components/dashboard/DashboardComponents";
import { Badge } from "@/components/ui/badge";
import { calculateHealthScore, getScoreColor } from "@/lib/projectHealth";

interface ProjetoRow {
  id: string;
  nome: string;
  descricao: string | null;
  objetivo: string | null;
  problema_atual: string | null;
  observacoes: string | null;
  protocolo: string | null;
  status: string;
  prazo_estimado: string | null;
  created_at: string;
  empresa_user_id: string;
  software?: { nome: string } | null;
  fases?: { id: string; nome: string; status: string; ordem: number }[];
  propostas_count?: number;
  empresa_nome?: string;
}

const AdminProjetos = () => {
  const [projetos, setProjetos] = useState<ProjetoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [selectedProjeto, setSelectedProjeto] = useState<ProjetoRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { toast } = useToast();

  const fetchProjetos = async () => {
    const { data, error } = await supabase
      .from("projetos")
      .select("*, softwares(nome), projeto_fases(id, nome, status, ordem)")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (!data) { setLoading(false); return; }

    // Fetch empresa names and proposal counts
    const userIds = [...new Set(data.map(p => p.empresa_user_id))];
    const [profilesRes, propostasRes] = await Promise.all([
      supabase.from("profiles").select("user_id, nome").in("user_id", userIds),
      supabase.from("propostas").select("id, projeto_id"),
    ]);

    const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p.nome]));
    const propostaCountMap = new Map<string, number>();
    (propostasRes.data || []).forEach(p => {
      propostaCountMap.set(p.projeto_id, (propostaCountMap.get(p.projeto_id) || 0) + 1);
    });

    const enriched: ProjetoRow[] = data.map(p => ({
      ...p,
      software: p.softwares,
      fases: p.projeto_fases || [],
      propostas_count: propostaCountMap.get(p.id) || 0,
      empresa_nome: profileMap.get(p.empresa_user_id) || "Empresa",
    }));

    setProjetos(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchProjetos(); }, []);

  const filtered = projetos.filter(p => {
    const term = search.toLowerCase();
    const matchesSearch = !term ||
      p.nome.toLowerCase().includes(term) ||
      p.protocolo?.toLowerCase().includes(term) ||
      p.empresa_nome?.toLowerCase().includes(term);
    const matchesStatus = statusFilter === "todos" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    total: projetos.length,
    em_andamento: projetos.filter(p => p.status === "em_andamento").length,
    publicado: projetos.filter(p => p.status === "publicado").length,
    concluido: projetos.filter(p => p.status === "concluido").length,
  };

  return (
    <div>
      <PageHeader
        title="Projetos"
        description="Todos os projetos da plataforma"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={FolderKanban} label="Total de projetos" value={statusCounts.total.toString()} iconColor="text-primary" iconBg="bg-primary/10" />
        <StatCard icon={FolderKanban} label="Em andamento" value={statusCounts.em_andamento.toString()} iconColor="text-info" iconBg="bg-info/10" />
        <StatCard icon={FolderKanban} label="Publicados" value={statusCounts.publicado.toString()} iconColor="text-warning" iconBg="bg-warning/10" />
        <StatCard icon={FolderKanban} label="Concluídos" value={statusCounts.concluido.toString()} iconColor="text-success" iconBg="bg-success/10" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            placeholder="Buscar por nome, protocolo ou empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter size={14} className="mr-2 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="publicado">Publicado</SelectItem>
            <SelectItem value="em_selecao">Em seleção</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <DataCard noPadding>
        {loading ? <LoadingState /> : filtered.length === 0 ? (
          <EmptyState message={search || statusFilter !== "todos" ? "Nenhum projeto encontrado" : "Nenhum projeto cadastrado"} icon={FolderKanban} />
        ) : (
          <div className="divide-y divide-border/60">
            {filtered.map((projeto) => (
              <div
                key={projeto.id}
                className="p-4 px-5 table-row-interactive cursor-pointer"
                onClick={() => navigate(`/admin/projetos/${projeto.id}`)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="icon-container icon-container-md bg-primary/8 flex-shrink-0">
                      <FolderKanban size={18} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{projeto.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {projeto.software?.nome || "Software não definido"} · {projeto.protocolo} · {projeto.empresa_nome}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge variant="secondary" className="text-[11px]">
                      {projeto.propostas_count} proposta{projeto.propostas_count !== 1 ? "s" : ""}
                    </Badge>
                    <StatusBadge status={projeto.status} />
                  </div>
                </div>
                {projeto.fases && projeto.fases.length > 0 && (
                  <div className="flex gap-1 ml-[54px]">
                    {projeto.fases
                      .sort((a, b) => a.ordem - b.ordem)
                      .map((f) => (
                        <div
                          key={f.id}
                          className={`flex-1 h-1.5 rounded-full transition-colors ${
                            f.status === "aprovada" ? "bg-success" :
                            f.status === "em_andamento" ? "bg-primary" :
                            f.status === "aguardando_aprovacao" ? "bg-warning" : "bg-border"
                          }`}
                          title={`${f.nome}: ${f.status}`}
                        />
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DataCard>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg flex items-center gap-2">
              <FolderKanban size={20} className="text-primary" />
              {selectedProjeto?.nome}
            </DialogTitle>
          </DialogHeader>

          {selectedProjeto && (
            <div className="space-y-6 pt-2">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={selectedProjeto.status} />
                <Badge variant="outline">{selectedProjeto.protocolo}</Badge>
                {selectedProjeto.software?.nome && (
                  <Badge variant="secondary">{selectedProjeto.software.nome}</Badge>
                )}
              </div>

              <div>
                <SectionTitle>Informações gerais</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DetailItem label="Empresa" value={selectedProjeto.empresa_nome} icon={<Building2 size={14} />} />
                  <DetailItem label="Prazo estimado" value={
                    selectedProjeto.prazo_estimado 
                      ? new Date(selectedProjeto.prazo_estimado).toLocaleDateString("pt-BR")
                      : null
                  } icon={<Calendar size={14} />} />
                  <DetailItem label="Propostas recebidas" value={`${selectedProjeto.propostas_count} proposta(s)`} icon={<Users size={14} />} />
                  <DetailItem label="Criado em" value={new Date(selectedProjeto.created_at).toLocaleDateString("pt-BR")} icon={<Calendar size={14} />} />
                </div>
              </div>

              {selectedProjeto.descricao && (
                <div>
                  <SectionTitle>Descrição</SectionTitle>
                  <p className="text-sm text-foreground/80 bg-muted/40 rounded-xl p-4">{selectedProjeto.descricao}</p>
                </div>
              )}

              {selectedProjeto.objetivo && (
                <div>
                  <SectionTitle>Objetivo</SectionTitle>
                  <p className="text-sm text-foreground/80 bg-muted/40 rounded-xl p-4">{selectedProjeto.objetivo}</p>
                </div>
              )}

              {selectedProjeto.problema_atual && (
                <div>
                  <SectionTitle>Problema atual</SectionTitle>
                  <p className="text-sm text-foreground/80 bg-muted/40 rounded-xl p-4">{selectedProjeto.problema_atual}</p>
                </div>
              )}

              {selectedProjeto.fases && selectedProjeto.fases.length > 0 && (
                <div>
                  <SectionTitle>Fases do projeto</SectionTitle>
                  <div className="space-y-2">
                    {selectedProjeto.fases.sort((a, b) => a.ordem - b.ordem).map((fase, i) => (
                      <div key={fase.id} className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {i + 1}
                        </div>
                        <span className="text-sm font-medium text-foreground flex-1">{fase.nome}</span>
                        <StatusBadge status={fase.status} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const DetailItem = ({ label, value, icon }: { label: string; value: string | null | undefined; icon?: React.ReactNode }) => (
  <div className="bg-muted/40 rounded-xl p-3">
    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 flex items-center gap-1.5">
      {icon} {label}
    </p>
    <p className="text-sm font-medium text-foreground">{value || "—"}</p>
  </div>
);

export default AdminProjetos;
