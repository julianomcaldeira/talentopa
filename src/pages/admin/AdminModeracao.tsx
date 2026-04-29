import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, DataCard, EmptyState, LoadingState, StatCard } from "@/components/dashboard/DashboardComponents";
import { MessageSquare, Shield, ShieldAlert, Search, Ban, CheckCircle2, Eye, AlertTriangle, Trash2, Building2, UserCircle2, ChevronLeft, ChevronRight, Filter, X, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Papel = "empresa" | "consultor" | "admin" | "desconhecido";

interface Participante {
  user_id: string;
  nome: string;
  email?: string;
  papel: Papel;
}

interface Conversa {
  projeto_id: string;
  projeto_nome: string;
  projeto_status: string;
  empresa_user_id: string;
  total_mensagens: number;
  bloqueadas: number;
  ultima_mensagem: string;
  participantes: Participante[];
  empresa_nome: string;
  consultores_nomes: string[];
}

interface MensagemRow {
  id: string;
  conteudo: string;
  sender_user_id: string;
  tipo: string;
  bloqueado: boolean;
  motivo_bloqueio: string | null;
  created_at: string;
  sender_nome?: string;
  sender_papel?: Papel;
}

interface TentativaBloqueada {
  id: string;
  projeto_id: string;
  projeto_nome?: string;
  sender_user_id: string;
  sender_nome?: string;
  motivo: string;
  created_at: string;
}

const PAGE_SIZE = 8;

const papelLabel: Record<Papel, string> = {
  empresa: "Empresa",
  consultor: "Consultor",
  admin: "Admin",
  desconhecido: "—",
};

const papelStyle: Record<Papel, string> = {
  empresa: "bg-info/10 text-info border-info/20",
  consultor: "bg-accent/10 text-accent border-accent/20",
  admin: "bg-primary/10 text-primary border-primary/20",
  desconhecido: "bg-muted text-muted-foreground border-border",
};

const AdminModeracao = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [selectedConversa, setSelectedConversa] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<MensagemRow[]>([]);
  const [tentativas, setTentativas] = useState<TentativaBloqueada[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, bloqueadas: 0, projetos: 0, tentativas: 0 });

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [papelFilter, setPapelFilter] = useState("todos");
  const [bloqueioFilter, setBloqueioFilter] = useState("todos");
  const [periodoFilter, setPeriodoFilter] = useState("todos");
  const [page, setPage] = useState(1);

  const fetchConversas = async () => {
    const { data: attempts } = await (supabase as any)
      .from("mensagem_tentativas_bloqueadas")
      .select("id, projeto_id, sender_user_id, motivo, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: msgs } = await supabase
      .from("mensagens")
      .select("projeto_id, bloqueado, created_at, sender_user_id")
      .order("created_at", { ascending: false });

    if (!msgs || msgs.length === 0) {
      setConversas([]);
      setStats({ total: 0, bloqueadas: 0, projetos: 0, tentativas: attempts?.length || 0 });
      await hydrateTentativas(attempts || []);
      setLoading(false);
      return;
    }

    const projIds = [...new Set(msgs.map(m => m.projeto_id))];
    const senderIds = [...new Set(msgs.map(m => m.sender_user_id))];

    // Fetch projects, profiles, and roles in parallel
    const [projetosRes, propostasRes, profilesRes, rolesRes] = await Promise.all([
      supabase.from("projetos").select("id, nome, status, empresa_user_id").in("id", projIds),
      supabase.from("propostas").select("projeto_id, consultor_user_id").in("projeto_id", projIds),
      supabase.from("profiles").select("user_id, nome, email").in("user_id", senderIds),
      supabase.from("user_roles").select("user_id, role").in("user_id", senderIds),
    ]);

    const projMap = new Map((projetosRes.data || []).map(p => [p.id, p]));
    const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
    const roleMap = new Map((rolesRes.data || []).map(r => [r.user_id, r.role as Papel]));

    // Map project -> consultores from propostas
    const consultoresPorProjeto = new Map<string, Set<string>>();
    (propostasRes.data || []).forEach(p => {
      if (!consultoresPorProjeto.has(p.projeto_id)) consultoresPorProjeto.set(p.projeto_id, new Set());
      consultoresPorProjeto.get(p.projeto_id)!.add(p.consultor_user_id);
    });

    // Group messages by project
    const grouped = new Map<string, { msgs: typeof msgs; senders: Set<string> }>();
    msgs.forEach(m => {
      if (!grouped.has(m.projeto_id)) grouped.set(m.projeto_id, { msgs: [], senders: new Set() });
      const g = grouped.get(m.projeto_id)!;
      g.msgs.push(m);
      g.senders.add(m.sender_user_id);
    });

    const conversaList: Conversa[] = Array.from(grouped.entries()).map(([projId, g]) => {
      const projeto = projMap.get(projId);
      const empresaUserId = projeto?.empresa_user_id || "";
      const consultorIds = Array.from(consultoresPorProjeto.get(projId) || []);

      // Build participantes: empresa owner + consultores envolvidos + qualquer sender extra
      const participantesIds = new Set<string>([empresaUserId, ...consultorIds, ...g.senders].filter(Boolean));
      const participantes: Participante[] = Array.from(participantesIds).map(uid => {
        const profile = profileMap.get(uid);
        let papel: Papel = roleMap.get(uid) || "desconhecido";
        if (uid === empresaUserId) papel = "empresa";
        else if (consultorIds.includes(uid)) papel = "consultor";
        return {
          user_id: uid,
          nome: profile?.nome || "Desconhecido",
          email: profile?.email,
          papel,
        };
      });

      const empresaNome = participantes.find(p => p.papel === "empresa")?.nome || "—";
      const consultoresNomes = participantes.filter(p => p.papel === "consultor").map(p => p.nome);

      return {
        projeto_id: projId,
        projeto_nome: projeto?.nome || "Projeto",
        projeto_status: projeto?.status || "desconhecido",
        empresa_user_id: empresaUserId,
        total_mensagens: g.msgs.length,
        bloqueadas: g.msgs.filter(m => m.bloqueado).length,
        ultima_mensagem: g.msgs[0]?.created_at || "",
        participantes,
        empresa_nome: empresaNome,
        consultores_nomes: consultoresNomes,
      };
    });

    conversaList.sort((a, b) => new Date(b.ultima_mensagem).getTime() - new Date(a.ultima_mensagem).getTime());

    setConversas(conversaList);
    setStats({
      total: msgs.length,
      bloqueadas: msgs.filter(m => m.bloqueado).length,
      projetos: projIds.length,
      tentativas: attempts?.length || 0,
    });
    await hydrateTentativas(attempts || []);
    setLoading(false);
  };

  const hydrateTentativas = async (attempts: any[]) => {
    if (!attempts.length) { setTentativas([]); return; }
    const projIds = [...new Set(attempts.map((a) => a.projeto_id))];
    const userIds = [...new Set(attempts.map((a) => a.sender_user_id))];
    const [projetosRes, profilesRes] = await Promise.all([
      supabase.from("projetos").select("id, nome").in("id", projIds),
      supabase.from("profiles").select("user_id, nome").in("user_id", userIds),
    ]);
    const projMap = new Map((projetosRes.data || []).map((p) => [p.id, p.nome]));
    const profileMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p.nome]));
    setTentativas(attempts.map((a) => ({ ...a, projeto_nome: projMap.get(a.projeto_id), sender_nome: profileMap.get(a.sender_user_id) })));
  };

  const openConversa = async (projetoId: string) => {
    setSelectedConversa(projetoId);
    setMsgLoading(true);

    const { data: msgs } = await supabase
      .from("mensagens")
      .select("*")
      .eq("projeto_id", projetoId)
      .order("created_at", { ascending: true });

    const conversa = conversas.find(c => c.projeto_id === projetoId);
    const partMap = new Map(conversa?.participantes.map(p => [p.user_id, p]) || []);

    if (msgs && msgs.length > 0) {
      const missingIds = [...new Set(msgs.map(m => m.sender_user_id).filter(id => !partMap.has(id)))];
      if (missingIds.length > 0) {
        const { data: extra } = await supabase.from("profiles").select("user_id, nome").in("user_id", missingIds);
        (extra || []).forEach(p => partMap.set(p.user_id, { user_id: p.user_id, nome: p.nome, papel: "desconhecido" }));
      }
      setMensagens(msgs.map(m => {
        const part = partMap.get(m.sender_user_id);
        return { ...m, sender_nome: part?.nome || "Desconhecido", sender_papel: part?.papel || "desconhecido" };
      }));
    } else {
      setMensagens([]);
    }
    setMsgLoading(false);
  };

  const toggleBlock = async (msg: MensagemRow) => {
    const newBlocked = !msg.bloqueado;
    const { error } = await supabase
      .from("mensagens")
      .update({ bloqueado: newBlocked, motivo_bloqueio: newBlocked ? "Bloqueada manualmente pelo administrador" : null })
      .eq("id", msg.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: newBlocked ? "Mensagem bloqueada" : "Mensagem desbloqueada" });
    setMensagens(prev => prev.map(m => m.id === msg.id ? { ...m, bloqueado: newBlocked, motivo_bloqueio: newBlocked ? "Bloqueada manualmente pelo administrador" : null } : m));
    fetchConversas();
  };

  const deleteMessage = async (msgId: string) => {
    const { error } = await supabase.from("mensagens").delete().eq("id", msgId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Mensagem removida" });
    setMensagens(prev => prev.filter(m => m.id !== msgId));
    fetchConversas();
  };

  useEffect(() => { fetchConversas(); }, []);
  useEffect(() => { setPage(1); }, [search, statusFilter, papelFilter, bloqueioFilter, periodoFilter]);

  const filteredConversas = useMemo(() => {
    const now = Date.now();
    const daysAgo = (d: number) => now - d * 86400000;
    const term = search.toLowerCase().trim();

    return conversas.filter(c => {
      if (term) {
        const haystack = [
          c.projeto_nome, c.empresa_nome, ...c.consultores_nomes,
          ...c.participantes.map(p => p.email || ""),
        ].join(" ").toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (statusFilter !== "todos" && c.projeto_status !== statusFilter) return false;
      if (papelFilter !== "todos" && !c.participantes.some(p => p.papel === papelFilter)) return false;
      if (bloqueioFilter === "com" && c.bloqueadas === 0) return false;
      if (bloqueioFilter === "sem" && c.bloqueadas > 0) return false;
      if (periodoFilter !== "todos") {
        const t = new Date(c.ultima_mensagem).getTime();
        if (periodoFilter === "7d" && t < daysAgo(7)) return false;
        if (periodoFilter === "30d" && t < daysAgo(30)) return false;
        if (periodoFilter === "90d" && t < daysAgo(90)) return false;
      }
      return true;
    });
  }, [conversas, search, statusFilter, papelFilter, bloqueioFilter, periodoFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredConversas.length / PAGE_SIZE));
  const paginated = filteredConversas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilters = [statusFilter, papelFilter, bloqueioFilter, periodoFilter].filter(f => f !== "todos").length;
  const clearFilters = () => {
    setSearch(""); setStatusFilter("todos"); setPapelFilter("todos"); setBloqueioFilter("todos"); setPeriodoFilter("todos");
  };

  const selected = conversas.find(c => c.projeto_id === selectedConversa);

  return (
    <div>
      <PageHeader title="Moderação de Comunicação" description="Monitore conversas e modere mensagens entre empresas e consultores" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={MessageSquare} label="Total de mensagens" value={String(stats.total)} iconColor="text-primary" iconBg="bg-primary/10" />
        <StatCard icon={ShieldAlert} label="Mensagens bloqueadas" value={String(stats.bloqueadas)} iconColor="text-destructive" iconBg="bg-destructive/10" />
        <StatCard icon={Shield} label="Conversas ativas" value={String(stats.projetos)} iconColor="text-success" iconBg="bg-success/10" />
      </div>

      {/* Filters */}
      <DataCard className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por projeto, empresa, consultor ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 text-sm" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Status do projeto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="publicado">Publicado</SelectItem>
              <SelectItem value="em_selecao">Em seleção</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={papelFilter} onValueChange={setPapelFilter}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Papel envolvido" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os papéis</SelectItem>
              <SelectItem value="empresa">Com empresa</SelectItem>
              <SelectItem value="consultor">Com consultor</SelectItem>
              <SelectItem value="admin">Com admin</SelectItem>
            </SelectContent>
          </Select>
          <Select value={bloqueioFilter} onValueChange={setBloqueioFilter}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Moderação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas conversas</SelectItem>
              <SelectItem value="com">Com bloqueios</SelectItem>
              <SelectItem value="sem">Sem bloqueios</SelectItem>
            </SelectContent>
          </Select>
          <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Qualquer período</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Filter size={12} />
            {filteredConversas.length} conversa{filteredConversas.length !== 1 ? "s" : ""}
            {activeFilters > 0 && <Badge variant="secondary" className="text-[10px]">{activeFilters} filtro{activeFilters !== 1 ? "s" : ""} ativo{activeFilters !== 1 ? "s" : ""}</Badge>}
          </p>
          {(activeFilters > 0 || search) && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7"><X size={12} /> Limpar</Button>
          )}
        </div>
      </DataCard>

      {loading ? (
        <DataCard><LoadingState /></DataCard>
      ) : conversas.length === 0 ? (
        <DataCard><EmptyState message="Nenhuma conversa registrada" icon={MessageSquare} /></DataCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Conversation list */}
          <div className="lg:col-span-2 space-y-3">
            {filteredConversas.length === 0 ? (
              <DataCard><EmptyState message="Nenhuma conversa corresponde aos filtros" icon={Filter} /></DataCard>
            ) : (
              <>
                <div className="space-y-2">
                  {paginated.map(c => (
                    <button
                      key={c.projeto_id}
                      onClick={() => openConversa(c.projeto_id)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                        selectedConversa === c.projeto_id ? "bg-primary/5 border-primary/30 shadow-sm" : "bg-card border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-semibold text-foreground truncate">{c.projeto_nome}</h4>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{c.projeto_status.replace("_", " ")}</p>
                        </div>
                        {c.bloqueadas > 0 && (
                          <Badge variant="destructive" className="text-[10px] shrink-0">{c.bloqueadas} bloq.</Badge>
                        )}
                      </div>

                      <div className="space-y-1 mb-2">
                        <div className="flex items-center gap-1.5 text-[11px] text-foreground">
                          <Building2 size={11} className="text-info shrink-0" />
                          <span className="truncate font-medium">{c.empresa_nome}</span>
                        </div>
                        {c.consultores_nomes.length > 0 && (
                          <div className="flex items-center gap-1.5 text-[11px] text-foreground">
                            <UserCircle2 size={11} className="text-accent shrink-0" />
                            <span className="truncate">
                              {c.consultores_nomes.slice(0, 2).join(", ")}
                              {c.consultores_nomes.length > 2 && ` +${c.consultores_nomes.length - 2}`}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">{c.total_mensagens} mensagen{c.total_mensagens !== 1 ? "s" : ""}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(c.ultima_mensagem).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-muted-foreground">
                      {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredConversas.length)} de {filteredConversas.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                        <ChevronLeft size={13} />
                      </Button>
                      <span className="text-[11px] text-muted-foreground px-2 tabular-nums">{page}/{totalPages}</span>
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                        <ChevronRight size={13} />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Message viewer */}
          <div className="lg:col-span-3">
            {!selectedConversa ? (
              <DataCard>
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Eye size={32} className="mb-3 opacity-30" />
                  <p className="text-sm">Selecione uma conversa para visualizar</p>
                </div>
              </DataCard>
            ) : msgLoading ? (
              <DataCard><LoadingState /></DataCard>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Header with all parties */}
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={16} className="text-primary" />
                    <h3 className="text-sm font-display font-semibold text-foreground flex-1">{selected?.projeto_nome}</h3>
                    <Badge variant="outline" className="text-[10px]">{mensagens.length} msg</Badge>
                  </div>
                  {selected && (
                    <div className="flex flex-wrap gap-1.5">
                      {selected.participantes.map(p => (
                        <div key={p.user_id} className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] ${papelStyle[p.papel]}`} title={p.email || ""}>
                          {p.papel === "empresa" ? <Building2 size={10} /> : <UserCircle2 size={10} />}
                          <span className="font-medium">{p.nome}</span>
                          <span className="opacity-70">· {papelLabel[p.papel]}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Messages */}
                <div className="max-h-[55vh] overflow-y-auto custom-scrollbar p-3 space-y-2">
                  {mensagens.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">Nenhuma mensagem</p>
                  ) : (
                    mensagens.map(msg => (
                      <div key={msg.id} className={`p-3 rounded-xl border ${msg.bloqueado ? "bg-destructive/5 border-destructive/20" : "bg-card border-border"}`}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/60 to-accent/60 flex items-center justify-center text-primary-foreground text-[10px] font-bold">
                              {msg.sender_nome?.charAt(0) || "?"}
                            </div>
                            <span className="text-xs font-medium text-foreground">{msg.sender_nome}</span>
                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border ${papelStyle[msg.sender_papel || "desconhecido"]}`}>
                              {papelLabel[msg.sender_papel || "desconhecido"]}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(msg.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {msg.bloqueado && <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Bloqueada</Badge>}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleBlock(msg)} title={msg.bloqueado ? "Desbloquear" : "Bloquear"}>
                              {msg.bloqueado ? <CheckCircle2 size={13} className="text-success" /> : <Ban size={13} className="text-destructive" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMessage(msg.id)} title="Excluir mensagem">
                              <Trash2 size={13} className="text-destructive" />
                            </Button>
                          </div>
                        </div>
                        <p className={`text-sm ml-8 ${msg.bloqueado ? "line-through text-muted-foreground" : "text-foreground"}`}>{msg.conteudo}</p>
                        {msg.motivo_bloqueio && (
                          <p className="text-[10px] text-destructive ml-8 mt-1 flex items-center gap-1">
                            <AlertTriangle size={10} /> {msg.motivo_bloqueio}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminModeracao;
