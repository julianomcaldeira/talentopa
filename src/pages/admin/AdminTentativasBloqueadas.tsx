import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, DataCard, EmptyState, LoadingState, StatCard } from "@/components/dashboard/DashboardComponents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, Clock, Eye, Filter, RefreshCw, ScrollText, Search, ShieldCheck, UserCircle2 } from "lucide-react";

interface AttemptRow {
  id: string;
  projeto_id: string;
  sender_user_id: string;
  recipient_user_id: string | null;
  escopo: string;
  motivo: string;
  status: string;
  revisado_por: string | null;
  revisado_em: string | null;
  observacao_revisao: string | null;
  created_at: string;
  projeto_nome?: string;
  sender_nome?: string;
  recipient_nome?: string;
  revisor_nome?: string;
}

interface AuditRow {
  id: string;
  acao: string;
  descricao: string | null;
  severidade: string;
  actor_nome: string | null;
  created_at: string;
  dados_novos: any;
}

const statusStyle: Record<string, string> = {
  auditada: "bg-warning/10 text-warning border-warning/20",
  aprovada: "bg-success/10 text-success border-success/20",
};

const AdminTentativasBloqueadas = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [selected, setSelected] = useState<AttemptRow | null>(null);
  const [approvalNote, setApprovalNote] = useState("");
  const [approving, setApproving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("pendentes");

  const hydrateAttempts = async (rows: any[]) => {
    if (!rows.length) return [];
    const projectIds = Array.from(new Set(rows.map((r) => r.projeto_id).filter(Boolean)));
    const userIds = Array.from(new Set(rows.flatMap((r) => [r.sender_user_id, r.recipient_user_id, r.revisado_por]).filter(Boolean)));
    const [projectsRes, profilesRes] = await Promise.all([
      supabase.from("projetos").select("id, nome").in("id", projectIds),
      supabase.from("profiles").select("user_id, nome").in("user_id", userIds),
    ]);
    const projectMap = new Map((projectsRes.data || []).map((p) => [p.id, p.nome]));
    const profileMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p.nome]));
    return rows.map((r) => ({
      ...r,
      projeto_nome: projectMap.get(r.projeto_id) || "Projeto",
      sender_nome: profileMap.get(r.sender_user_id) || "Usuário",
      recipient_nome: r.recipient_user_id ? profileMap.get(r.recipient_user_id) || "Destinatário" : "Compartilhado",
      revisor_nome: r.revisado_por ? profileMap.get(r.revisado_por) || "Administrador" : undefined,
    })) as AttemptRow[];
  };

  const fetchData = async () => {
    setLoading(true);
    const [attemptsRes, logsRes] = await Promise.all([
      (supabase as any)
        .from("mensagem_tentativas_bloqueadas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("audit_logs")
        .select("id, acao, descricao, severidade, actor_nome, created_at, dados_novos")
        .eq("categoria", "comunicacao")
        .in("acao", ["tentativa_mensagem_antes_pre_aprovacao", "mensagem_bloqueada_pre_aprovacao", "liberacao_mensagem_bloqueada_pre_aprovacao", "tentativa_mensagem_aprovada_manual"])
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (attemptsRes.error) toast({ title: "Erro ao carregar tentativas", description: attemptsRes.error.message, variant: "destructive" });
    setAttempts(await hydrateAttempts(attemptsRes.data || []));
    setAuditLogs((logsRes.data || []) as AuditRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const approveAttempt = async (attempt: AttemptRow) => {
    setApproving(attempt.id);
    const { error } = await (supabase as any).rpc("admin_aprovar_tentativa_mensagem_bloqueada", {
      p_tentativa_id: attempt.id,
      p_observacao: approvalNote,
    });
    setApproving(null);
    if (error) {
      toast({ title: "Erro ao aprovar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Tentativa aprovada", description: "A decisão foi registrada nos logs de auditoria." });
    setSelected(null);
    setApprovalNote("");
    fetchData();
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return attempts.filter((a) => {
      if (statusFilter === "pendentes" && a.status === "aprovada") return false;
      if (statusFilter !== "todos" && statusFilter !== "pendentes" && a.status !== statusFilter) return false;
      if (!term) return true;
      return [a.projeto_nome, a.sender_nome, a.recipient_nome, a.motivo, a.status].join(" ").toLowerCase().includes(term);
    });
  }, [attempts, search, statusFilter]);

  const pending = attempts.filter((a) => a.status !== "aprovada").length;
  const approved = attempts.filter((a) => a.status === "aprovada").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tentativas bloqueadas"
        description="Revise conversas bloqueadas antes da pré-aprovação, aprove exceções manualmente e consulte auditoria."
        action={<Button variant="outline" size="sm" onClick={fetchData}><RefreshCw size={14} className="mr-2" />Atualizar</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={Clock} label="Pendentes de revisão" value={String(pending)} iconColor="text-warning" iconBg="bg-warning/10" />
        <StatCard icon={ShieldCheck} label="Aprovadas manualmente" value={String(approved)} iconColor="text-success" iconBg="bg-success/10" />
        <StatCard icon={ScrollText} label="Logs consultáveis" value={String(auditLogs.length)} iconColor="text-primary" iconBg="bg-primary/10" />
      </div>

      <DataCard>
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground"><Filter size={14} />Filtros</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por projeto, usuário, motivo ou status..." className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendentes">Pendentes</SelectItem>
              <SelectItem value="auditada">Auditadas</SelectItem>
              <SelectItem value="aprovada">Aprovadas</SelectItem>
              <SelectItem value="todos">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </DataCard>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <DataCard noPadding>
            {loading ? <LoadingState /> : filtered.length === 0 ? (
              <EmptyState message="Nenhuma tentativa bloqueada encontrada" icon={AlertTriangle} />
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((a) => (
                  <button key={a.id} onClick={() => { setSelected(a); setApprovalNote(a.observacao_revisao || ""); }} className="w-full text-left p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-sm text-foreground truncate">{a.projeto_nome}</h3>
                          <Badge variant="outline" className={`text-[10px] ${statusStyle[a.status] || "bg-muted text-muted-foreground border-border"}`}>{a.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{a.motivo}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1"><UserCircle2 size={12} />{a.sender_nome}</span>
                          <span>Destino: {a.recipient_nome}</span>
                          <span>{new Date(a.created_at).toLocaleString("pt-BR")}</span>
                        </div>
                      </div>
                      <Eye size={15} className="text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </DataCard>
        </div>

        <DataCard>
          <div className="flex items-center gap-2 mb-3">
            <ScrollText size={15} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Logs de auditoria</h3>
          </div>
          {auditLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Nenhum log encontrado</p>
          ) : (
            <div className="space-y-2 max-h-[560px] overflow-y-auto custom-scrollbar pr-1">
              {auditLogs.map((log) => (
                <div key={log.id} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px] font-mono">{log.acao}</Badge>
                    <span className="text-[10px] text-muted-foreground shrink-0">{new Date(log.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <p className="text-xs text-foreground line-clamp-2">{log.descricao}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Ator: {log.actor_nome || "Sistema"} · {log.severidade}</p>
                </div>
              ))}
            </div>
          )}
        </DataCard>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Revisar tentativa bloqueada</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Projeto</p><p className="font-medium">{selected.projeto_nome}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><Badge variant="outline" className={statusStyle[selected.status] || ""}>{selected.status}</Badge></div>
                <div><p className="text-xs text-muted-foreground">Usuário origem</p><p className="font-medium">{selected.sender_nome}</p></div>
                <div><p className="text-xs text-muted-foreground">Destino</p><p className="font-medium">{selected.recipient_nome}</p></div>
                <div><p className="text-xs text-muted-foreground">Data/hora</p><p className="font-medium">{new Date(selected.created_at).toLocaleString("pt-BR")}</p></div>
                {selected.revisado_em && <div><p className="text-xs text-muted-foreground">Revisado por</p><p className="font-medium">{selected.revisor_nome} · {new Date(selected.revisado_em).toLocaleString("pt-BR")}</p></div>}
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground mb-1">Motivo do bloqueio</p>
                <p className="text-sm text-foreground">{selected.motivo}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Observação da revisão</p>
                <Textarea value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} placeholder="Explique o motivo da aprovação manual..." />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button>
                <Button onClick={() => approveAttempt(selected)} disabled={selected.status === "aprovada" || approving === selected.id}>
                  <CheckCircle2 size={14} className="mr-2" />{selected.status === "aprovada" ? "Já aprovada" : "Aprovar manualmente"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTentativasBloqueadas;