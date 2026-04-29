import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Shield, AlertTriangle, MessageSquare, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ProjectChatProps {
  projetoId: string;
  projetoNome: string;
}

interface Message {
  id: string;
  conteudo: string;
  sender_user_id: string;
  tipo: string;
  bloqueado: boolean;
  motivo_bloqueio: string | null;
  created_at: string;
  sender?: { nome: string } | null;
}

export const ProjectChat = ({ projetoId, projetoNome }: ProjectChatProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [conversationOpen, setConversationOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchConversationAccess = async () => {
    const { data } = await (supabase as any).rpc("can_user_message_project", {
      p_projeto_id: projetoId,
      p_escopo: "compartilhado",
    });
    setConversationOpen(Boolean(data));
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("mensagens")
      .select("*")
      .eq("projeto_id", projetoId)
      .order("created_at", { ascending: true });

    if (data && data.length > 0) {
      // Fetch sender names
      const senderIds = [...new Set(data.map(m => m.sender_user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", senderIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.nome]) || []);
      const enriched = data.map(m => ({
        ...m,
        sender: { nome: profileMap.get(m.sender_user_id) || "Usuário" },
      }));
      setMessages(enriched);
    } else {
      setMessages([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchConversationAccess();
    fetchMessages();

    const channel = supabase
      .channel(`chat-${projetoId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "mensagens",
        filter: `projeto_id=eq.${projetoId}`,
      }, () => {
        fetchMessages();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projetoId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!user || !newMessage.trim() || sending) return;
    if (!conversationOpen) {
      await (supabase as any).rpc("registrar_mensagem_bloqueada_pre_aprovacao", {
        p_projeto_id: projetoId,
        p_escopo: "compartilhado",
      });
      toast({
        title: "Conversa ainda bloqueada",
        description: "A troca de mensagens com consultores só é liberada após a pré-aprovação.",
        variant: "destructive",
      });
      return;
    }
    setSending(true);

    try {
      // Moderate the message first
      const { data: modResult, error: modError } = await supabase.functions.invoke("moderate-message", {
        body: { conteudo: newMessage.trim() },
      });

      if (modError) throw modError;

      if (!modResult.aprovado) {
        toast({
          title: "Mensagem bloqueada",
          description: modResult.motivo,
          variant: "destructive",
        });
        setSending(false);
        return;
      }

      const { error } = await supabase.from("mensagens").insert({
        projeto_id: projetoId,
        sender_user_id: user.id,
        conteudo: modResult.conteudo,
        tipo: "mensagem",
        moderado: true,
      });

      if (error) throw error;
      setNewMessage("");
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isMe = (senderId: string) => senderId === user?.id;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <div className="icon-container icon-container-md bg-primary/10">
          <MessageSquare size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-display font-semibold text-foreground truncate">Chat — {projetoNome}</h3>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Shield size={10} /> Comunicação moderada pela plataforma
          </p>
        </div>
      </div>

      {/* Policy notice */}
      {!conversationOpen && (
        <div className="mx-3 mt-3 mb-1 p-2.5 rounded-lg bg-muted border border-border">
          <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
            <Lock size={12} className="mt-0.5 shrink-0 text-primary" />
            <span>Conversa bloqueada até a pré-aprovação. Após essa etapa, empresa e consultor poderão trocar mensagens neste projeto.</span>
          </p>
        </div>
      )}
      <div className="mx-3 mt-3 mb-1 p-2.5 rounded-lg bg-warning/10 border border-warning/20">
        <p className="text-[11px] text-warning-foreground flex items-start gap-1.5">
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-warning" />
          <span>
            Por segurança, não compartilhe dados pessoais (telefone, e-mail, CPF) ou links externos.
            Mensagens ofensivas serão bloqueadas automaticamente.
          </span>
        </p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 custom-scrollbar min-h-[200px] max-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            {conversationOpen ? <MessageSquare size={24} className="mb-2 opacity-40" /> : <Lock size={24} className="mb-2 opacity-40" />}
            <p className="text-xs">{conversationOpen ? "Nenhuma mensagem ainda. Inicie a conversa!" : "A conversa será exibida após a pré-aprovação."}</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isMe(msg.sender_user_id) ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
                    msg.bloqueado
                      ? "bg-destructive/10 border border-destructive/20"
                      : isMe(msg.sender_user_id)
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted rounded-bl-md"
                  }`}
                >
                  {!isMe(msg.sender_user_id) && (
                    <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">
                      {msg.sender?.nome}
                    </p>
                  )}
                  {msg.bloqueado ? (
                    <p className="text-xs text-destructive italic">
                      ⚠️ Mensagem removida por violação das regras
                    </p>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.conteudo}</p>
                  )}
                  <p className={`text-[10px] mt-1 ${isMe(msg.sender_user_id) ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-border bg-card">
        <div className="flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            rows={1}
            className="resize-none min-h-[40px] max-h-[100px] text-sm rounded-xl"
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            className="shrink-0 rounded-xl h-10 w-10"
          >
            <Send size={16} />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          {newMessage.length}/2000 caracteres · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
};
