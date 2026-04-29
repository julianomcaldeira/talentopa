import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Send, Lock, Eye, AtSign, Users, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  projetoId: string;
  projetoNome: string;
  empresaUserId: string;
}

interface TeamMember {
  user_id: string;
  nome: string;
  papel?: string;
}

interface InternalMessage {
  id: string;
  conteudo: string;
  sender_user_id: string;
  escopo: string;
  mencionados: string[];
  created_at: string;
  sender_nome?: string;
}

export const ProjectInternalChat = ({ projetoId, projetoNome, empresaUserId }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [text, setText] = useState("");
  const [shareWithConsultor, setShareWithConsultor] = useState(false);
  const [mentioned, setMentioned] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [sharedConversationOpen, setSharedConversationOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchSharedAccess = async () => {
    const { data } = await (supabase as any).rpc("can_user_message_project", {
      p_projeto_id: projetoId,
      p_escopo: "compartilhado",
    });
    setSharedConversationOpen(Boolean(data));
  };

  const fetchTeam = async () => {
    // dono da empresa + vinculados via empresa_usuarios
    const { data: vinc } = await supabase
      .from("empresa_usuarios")
      .select("user_id, papel")
      .eq("empresa_user_id", empresaUserId);

    const ids = Array.from(new Set([empresaUserId, ...(vinc?.map((v) => v.user_id) || [])]));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nome")
      .in("user_id", ids);

    const papelMap = new Map(vinc?.map((v) => [v.user_id, v.papel]) || []);
    setTeam(
      (profiles || []).map((p) => ({
        user_id: p.user_id,
        nome: p.nome,
        papel: p.user_id === empresaUserId ? "responsavel" : papelMap.get(p.user_id),
      })),
    );
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("mensagens")
      .select("*")
      .eq("projeto_id", projetoId)
      .in("escopo", ["interno_empresa", "compartilhado"])
      .order("created_at", { ascending: true });

    if (!data) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const senderIds = Array.from(new Set(data.map((m) => m.sender_user_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nome")
      .in("user_id", senderIds);
    const nameMap = new Map(profiles?.map((p) => [p.user_id, p.nome]) || []);

    setMessages(
      data.map((m: any) => ({
        id: m.id,
        conteudo: m.conteudo,
        sender_user_id: m.sender_user_id,
        escopo: m.escopo,
        mencionados: m.mencionados || [],
        created_at: m.created_at,
        sender_nome: nameMap.get(m.sender_user_id) || "Usuário",
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchSharedAccess();
    fetchTeam();
    fetchMessages();
    const ch = supabase
      .channel(`internal-chat-${projetoId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mensagens", filter: `projeto_id=eq.${projetoId}` },
        () => fetchMessages(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoId, empresaUserId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const toggleMention = (uid: string) => {
    setMentioned((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
  };

  const insertMentionInText = (member: TeamMember) => {
    setText((t) => `${t}${t.endsWith(" ") || t === "" ? "" : " "}@${member.nome.split(" ")[0]} `);
    if (!mentioned.includes(member.user_id)) setMentioned((prev) => [...prev, member.user_id]);
  };

  const send = async () => {
    if (!user || !text.trim() || sending) return;
    if (shareWithConsultor && !sharedConversationOpen) {
      await (supabase as any).rpc("registrar_mensagem_bloqueada_pre_aprovacao", {
        p_projeto_id: projetoId,
        p_escopo: "compartilhado",
      });
      toast({ title: "Compartilhamento bloqueado", description: "Mensagens para consultores só são liberadas após a pré-aprovação.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.from("mensagens").insert({
        projeto_id: projetoId,
        sender_user_id: user.id,
        conteudo: text.trim(),
        tipo: "mensagem",
        escopo: shareWithConsultor ? "compartilhado" : "interno_empresa",
        mencionados: mentioned,
        moderado: shareWithConsultor ? false : true,
      });
      if (error) throw error;
      setText("");
      setMentioned([]);
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    }
    setSending(false);
  };

  const releaseToConsultor = async (id: string) => {
    if (!sharedConversationOpen) {
      await (supabase as any).rpc("registrar_mensagem_bloqueada_pre_aprovacao", {
        p_projeto_id: projetoId,
        p_escopo: "compartilhado",
      });
      toast({ title: "Compartilhamento bloqueado", description: "Pré-aprove um consultor antes de liberar mensagens para ele.", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("mensagens")
      .update({ escopo: "compartilhado" })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Mensagem liberada", description: "O consultor agora pode visualizá-la." });
  };

  const isMe = (uid: string) => uid === user?.id;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <div className="icon-container icon-container-md bg-primary/10">
          <Building2 size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-display font-semibold text-foreground truncate">
            Chat interno — {projetoNome}
          </h3>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Lock size={10} /> Visível apenas à equipe da empresa, exceto se compartilhado
          </p>
        </div>
        <Badge variant="outline" className="gap-1 text-[10px]">
          <Users size={10} /> {team.length}
        </Badge>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 custom-scrollbar min-h-[240px] max-h-[420px]">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Building2 size={24} className="mb-2 opacity-40" />
            <p className="text-xs">Nenhuma mensagem ainda.</p>
            <p className="text-[10px] mt-1">Discuta o projeto com sua equipe aqui.</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isMe(m.sender_user_id) ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${
                    isMe(m.sender_user_id)
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted rounded-bl-md"
                  }`}
                >
                  {!isMe(m.sender_user_id) && (
                    <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">{m.sender_nome}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{m.conteudo}</p>
                  <div className={`flex items-center gap-2 mt-1 ${isMe(m.sender_user_id) ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    <span className="text-[10px]">
                      {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {m.escopo === "compartilhado" ? (
                      <Badge variant="outline" className={`text-[9px] gap-1 px-1.5 py-0 ${isMe(m.sender_user_id) ? "border-primary-foreground/30 text-primary-foreground" : ""}`}>
                        <Eye size={9} /> Visível ao consultor
                      </Badge>
                    ) : (
                      <Badge variant="outline" className={`text-[9px] gap-1 px-1.5 py-0 ${isMe(m.sender_user_id) ? "border-primary-foreground/30 text-primary-foreground" : ""}`}>
                        <Lock size={9} /> Interno
                      </Badge>
                    )}
                    {m.escopo === "interno_empresa" && (
                      <button
                        onClick={() => releaseToConsultor(m.id)}
                        className={`text-[9px] underline hover:no-underline ${isMe(m.sender_user_id) ? "text-primary-foreground" : "text-primary"}`}
                      >
                        Liberar
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="px-3 py-3 border-t border-border bg-card space-y-2">
        {mentioned.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {mentioned.map((uid) => {
              const m = team.find((t) => t.user_id === uid);
              return (
                <Badge key={uid} variant="secondary" className="text-[10px] gap-1">
                  @{m?.nome.split(" ")[0]}
                  <button onClick={() => toggleMention(uid)} className="ml-1 hover:text-destructive">×</button>
                </Badge>
              );
            })}
          </div>
        )}
        <div className="flex gap-2">
          <Popover open={mentionOpen} onOpenChange={setMentionOpen}>
            <PopoverTrigger asChild>
              <Button size="icon" variant="outline" className="shrink-0 h-10 w-10 rounded-xl" title="Mencionar">
                <AtSign size={16} />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-1">
              <p className="text-[10px] text-muted-foreground px-2 py-1.5">Equipe da empresa</p>
              {team.length === 0 && <p className="text-xs text-muted-foreground px-2 py-2">Nenhum membro vinculado</p>}
              {team.map((m) => (
                <button
                  key={m.user_id}
                  onClick={() => {
                    insertMentionInText(m);
                    setMentionOpen(false);
                  }}
                  className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-xs"
                >
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold">
                    {m.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{m.nome}</p>
                    {m.papel && <p className="text-[10px] text-muted-foreground capitalize">{m.papel}</p>}
                  </div>
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Mensagem para a equipe..."
            rows={1}
            className="resize-none min-h-[40px] max-h-[100px] text-sm rounded-xl"
          />
          <Button size="icon" onClick={send} disabled={!text.trim() || sending} className="shrink-0 rounded-xl h-10 w-10">
            <Send size={16} />
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch id="share-toggle" checked={shareWithConsultor} onCheckedChange={setShareWithConsultor} />
            <Label htmlFor="share-toggle" className="text-[11px] cursor-pointer flex items-center gap-1">
              {shareWithConsultor ? <Eye size={11} className="text-primary" /> : <Lock size={11} />}
              {shareWithConsultor ? "Visível ao consultor" : sharedConversationOpen ? "Apenas equipe interna" : "Consultor bloqueado até pré-aprovação"}
            </Label>
          </div>
          <p className="text-[10px] text-muted-foreground">Shift+Enter = nova linha</p>
        </div>
      </div>
    </div>
  );
};
