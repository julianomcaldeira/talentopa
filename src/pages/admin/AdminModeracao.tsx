import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, DataCard, EmptyState, LoadingState, StatCard } from "@/components/dashboard/DashboardComponents";
import { MessageSquare, Shield, ShieldAlert, Search, Ban, CheckCircle2, Eye, AlertTriangle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Conversa {
  projeto_id: string;
  projeto_nome: string;
  total_mensagens: number;
  bloqueadas: number;
  ultima_mensagem: string;
  participantes: string[];
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
}

const AdminModeracao = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [selectedConversa, setSelectedConversa] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<MensagemRow[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState({ total: 0, bloqueadas: 0, projetos: 0 });

  const fetchConversas = async () => {
    // Get all messages grouped by project
    const { data: msgs } = await supabase
      .from("mensagens")
      .select("projeto_id, bloqueado, created_at, sender_user_id")
      .order("created_at", { ascending: false });

    if (!msgs || msgs.length === 0) {
      setConversas([]);
      setStats({ total: 0, bloqueadas: 0, projetos: 0 });
      setLoading(false);
      return;
    }

    // Get project names
    const projIds = [...new Set(msgs.map(m => m.projeto_id))];
    const { data: projetos } = await supabase
      .from("projetos")
      .select("id, nome")
      .in("id", projIds);

    const projMap = new Map(projetos?.map(p => [p.id, p.nome]) || []);

    // Get sender names
    const senderIds = [...new Set(msgs.map(m => m.sender_user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nome")
      .in("user_id", senderIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p.nome]) || []);

    // Group by project
    const grouped = new Map<string, { msgs: typeof msgs; participants: Set<string> }>();
    msgs.forEach(m => {
      if (!grouped.has(m.projeto_id)) {
        grouped.set(m.projeto_id, { msgs: [], participants: new Set() });
      }
      const g = grouped.get(m.projeto_id)!;
      g.msgs.push(m);
      g.participants.add(profileMap.get(m.sender_user_id) || "Desconhecido");
    });

    const conversaList: Conversa[] = Array.from(grouped.entries()).map(([projId, g]) => ({
      projeto_id: projId,
      projeto_nome: projMap.get(projId) || "Projeto",
      total_mensagens: g.msgs.length,
      bloqueadas: g.msgs.filter(m => m.bloqueado).length,
      ultima_mensagem: g.msgs[0]?.created_at || "",
      participantes: Array.from(g.participants),
    }));

    conversaList.sort((a, b) => new Date(b.ultima_mensagem).getTime() - new Date(a.ultima_mensagem).getTime());

    setConversas(conversaList);
    setStats({
      total: msgs.length,
      bloqueadas: msgs.filter(m => m.bloqueado).length,
      projetos: projIds.length,
    });
    setLoading(false);
  };

  const openConversa = async (projetoId: string) => {
    setSelectedConversa(projetoId);
    setMsgLoading(true);

    const { data: msgs } = await supabase
      .from("mensagens")
      .select("*")
      .eq("projeto_id", projetoId)
      .order("created_at", { ascending: true });

    if (msgs && msgs.length > 0) {
      const senderIds = [...new Set(msgs.map(m => m.sender_user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", senderIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.nome]) || []);
      setMensagens(msgs.map(m => ({ ...m, sender_nome: profileMap.get(m.sender_user_id) || "Desconhecido" })));
    } else {
      setMensagens([]);
    }
    setMsgLoading(false);
  };

  const toggleBlock = async (msg: MensagemRow) => {
    const newBlocked = !msg.bloqueado;
    const { error } = await supabase
      .from("mensagens")
      .update({
        bloqueado: newBlocked,
        motivo_bloqueio: newBlocked ? "Bloqueada manualmente pelo administrador" : null,
      })
      .eq("id", msg.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: newBlocked ? "Mensagem bloqueada" : "Mensagem desbloqueada" });
    setMensagens(prev => prev.map(m => m.id === msg.id ? { ...m, bloqueado: newBlocked, motivo_bloqueio: newBlocked ? "Bloqueada manualmente pelo administrador" : null } : m));
    fetchConversas();
  };

  const deleteMessage = async (msgId: string) => {
    const { error } = await supabase.from("mensagens").delete().eq("id", msgId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Mensagem removida" });
    setMensagens(prev => prev.filter(m => m.id !== msgId));
    fetchConversas();
  };

  useEffect(() => {
    fetchConversas();
  }, []);

  const filteredConversas = conversas.filter(c =>
    c.projeto_nome.toLowerCase().includes(search.toLowerCase()) ||
    c.participantes.some(p => p.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedProjetoNome = conversas.find(c => c.projeto_id === selectedConversa)?.projeto_nome;

  return (
    <div>
      <PageHeader title="Moderação de Comunicação" description="Monitore conversas e modere mensagens entre empresas e consultores" />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={MessageSquare} label="Total de mensagens" value={String(stats.total)} iconColor="text-primary" iconBg="bg-primary/10" />
        <StatCard icon={ShieldAlert} label="Mensagens bloqueadas" value={String(stats.bloqueadas)} iconColor="text-destructive" iconBg="bg-destructive/10" />
        <StatCard icon={Shield} label="Conversas ativas" value={String(stats.projetos)} iconColor="text-success" iconBg="bg-success/10" />
      </div>

      {loading ? (
        <DataCard><LoadingState /></DataCard>
      ) : conversas.length === 0 ? (
        <DataCard><EmptyState message="Nenhuma conversa registrada" icon={MessageSquare} /></DataCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Conversation list */}
          <div className="lg:col-span-2 space-y-3">
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar conversa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {filteredConversas.map(c => (
                <button
                  key={c.projeto_id}
                  onClick={() => openConversa(c.projeto_id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    selectedConversa === c.projeto_id
                      ? "bg-primary/5 border-primary/30 shadow-sm"
                      : "bg-card border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <h4 className="text-sm font-semibold text-foreground truncate flex-1">{c.projeto_nome}</h4>
                    {c.bloqueadas > 0 && (
                      <Badge variant="destructive" className="text-[10px] ml-2 shrink-0">
                        {c.bloqueadas} bloq.
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-1">
                    {c.participantes.slice(0, 3).join(", ")}{c.participantes.length > 3 ? ` +${c.participantes.length - 3}` : ""}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {c.total_mensagens} mensagen{c.total_mensagens !== 1 ? "s" : ""}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(c.ultima_mensagem).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </button>
              ))}
            </div>
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
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
                  <Shield size={16} className="text-primary" />
                  <div className="flex-1">
                    <h3 className="text-sm font-display font-semibold text-foreground">{selectedProjetoNome}</h3>
                    <p className="text-[11px] text-muted-foreground">{mensagens.length} mensagens</p>
                  </div>
                </div>

                {/* Messages */}
                <div className="max-h-[50vh] overflow-y-auto custom-scrollbar p-3 space-y-2">
                  {mensagens.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">Nenhuma mensagem</p>
                  ) : (
                    mensagens.map(msg => (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-xl border ${
                          msg.bloqueado
                            ? "bg-destructive/5 border-destructive/20"
                            : "bg-card border-border"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/60 to-accent/60 flex items-center justify-center text-primary-foreground text-[10px] font-bold">
                              {msg.sender_nome?.charAt(0) || "?"}
                            </div>
                            <span className="text-xs font-medium text-foreground">{msg.sender_nome}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(msg.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {msg.bloqueado && (
                              <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Bloqueada</Badge>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => toggleBlock(msg)}
                              title={msg.bloqueado ? "Desbloquear" : "Bloquear"}
                            >
                              {msg.bloqueado ? (
                                <CheckCircle2 size={13} className="text-success" />
                              ) : (
                                <Ban size={13} className="text-destructive" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => deleteMessage(msg.id)}
                              title="Excluir mensagem"
                            >
                              <Trash2 size={13} className="text-destructive" />
                            </Button>
                          </div>
                        </div>
                        <p className={`text-sm ml-8 ${msg.bloqueado ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {msg.conteudo}
                        </p>
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
