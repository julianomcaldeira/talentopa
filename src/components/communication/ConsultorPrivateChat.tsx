import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Shield, AlertTriangle, MessageSquare, Lock, Paperclip, FileText, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  projetoId: string;
  projetoNome: string;
  consultorUserId: string;
  consultorNome: string;
}

interface PrivateMessage {
  id: string;
  conteudo: string;
  sender_user_id: string;
  recipient_user_id: string | null;
  bloqueado: boolean;
  motivo_bloqueio: string | null;
  created_at: string;
}

const MAX_LEN = 2000;

export const ConsultorPrivateChat = ({ projetoId, projetoNome, consultorUserId, consultorNome }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [conversationOpen, setConversationOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchConversationAccess = async () => {
    if (!user) return;
    const { data } = await (supabase as any).rpc("can_user_send_project_message", {
      p_projeto_id: projetoId,
      p_sender_user_id: user.id,
      p_recipient_user_id: consultorUserId,
      p_escopo: "compartilhado",
    });
    setConversationOpen(Boolean(data));
  };

  const fetchMessages = async () => {
    if (!user) return;
    // Buscar somente mensagens privadas entre o usuário atual e o consultor neste projeto
    const { data } = await supabase
      .from("mensagens")
      .select("id, conteudo, sender_user_id, recipient_user_id, bloqueado, motivo_bloqueio, created_at")
      .eq("projeto_id", projetoId)
      .not("recipient_user_id", "is", null)
      .or(
        `and(sender_user_id.eq.${user.id},recipient_user_id.eq.${consultorUserId}),and(sender_user_id.eq.${consultorUserId},recipient_user_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true });

    setMessages((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchConversationAccess();
    fetchMessages();
    const channel = supabase
      .channel(`private-${projetoId}-${consultorUserId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "mensagens",
        filter: `projeto_id=eq.${projetoId}`,
      }, () => fetchMessages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projetoId, consultorUserId, user?.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    if (!user || !newMessage.trim() || sending) return;
    if (!conversationOpen) {
      await (supabase as any).rpc("registrar_mensagem_bloqueada_pre_aprovacao", {
        p_projeto_id: projetoId,
        p_recipient_user_id: consultorUserId,
        p_escopo: "compartilhado",
      });
      toast({ title: "Conversa ainda bloqueada", description: "Este consultor precisa estar pré-aprovado para liberar a troca de mensagens.", variant: "destructive" });
      return;
    }
    const trimmed = newMessage.trim();
    if (trimmed.length > MAX_LEN) {
      toast({ title: "Mensagem muito longa", description: `Máximo ${MAX_LEN} caracteres.`, variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { data: modResult, error: modError } = await supabase.functions.invoke("moderate-message", {
        body: { conteudo: trimmed },
      });
      if (modError) throw modError;
      if (!modResult.aprovado) {
        toast({ title: "Mensagem bloqueada", description: modResult.motivo, variant: "destructive" });
        setSending(false);
        return;
      }
      const { error } = await supabase.from("mensagens").insert({
        projeto_id: projetoId,
        sender_user_id: user.id,
        recipient_user_id: consultorUserId,
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

  const parseAttachment = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      return parsed?.path && parsed?.nome ? parsed : null;
    } catch {
      return null;
    }
  };

  const previewAttachment = async (path: string, senderId: string) => {
    if (!conversationOpen && senderId !== user?.id) {
      toast({ title: "Pré-visualização bloqueada", description: "O arquivo só será disponibilizado ao destinatário após a pré-aprovação.", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase.storage.from("projeto-anexos").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      toast({ title: "Erro ao pré-visualizar anexo", description: error?.message || "Arquivo indisponível.", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const sendAttachment = async (file?: File) => {
    if (!user || sending) return;
    if (!conversationOpen) {
      await (supabase as any).rpc("registrar_mensagem_bloqueada_pre_aprovacao", {
        p_projeto_id: projetoId,
        p_recipient_user_id: consultorUserId,
        p_escopo: "compartilhado",
      });
      toast({ title: "Anexo bloqueado", description: "Este consultor precisa estar pré-aprovado para liberar anexos no chat.", variant: "destructive" });
      return;
    }
    if (!file) return;

    setSending(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${projetoId}/chat/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("projeto-anexos").upload(path, file);
      if (uploadError) throw uploadError;

      const { error: attachmentError } = await (supabase as any).from("projeto_anexos").insert({
        projeto_id: projetoId,
        uploader_user_id: user.id,
        nome: file.name,
        arquivo_url: path,
        tamanho_bytes: file.size,
        mime_type: file.type || "application/octet-stream",
        origem: "chat",
        escopo: "compartilhado",
        recipient_user_id: consultorUserId,
      });
      if (attachmentError) throw attachmentError;

      const { error: messageError } = await supabase.from("mensagens").insert({
        projeto_id: projetoId,
        sender_user_id: user.id,
        recipient_user_id: consultorUserId,
        conteudo: JSON.stringify({ nome: file.name, path, mime_type: file.type || "application/octet-stream", tamanho_bytes: file.size }),
        tipo: "anexo",
        escopo: "compartilhado",
        moderado: true,
      });
      if (messageError) throw messageError;
      toast({ title: "Anexo enviado", description: "O envio foi registrado na auditoria." });
    } catch (err: any) {
      toast({ title: "Erro ao enviar anexo", description: err.message, variant: "destructive" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isMe = (senderId: string) => senderId === user?.id;

  return (
    <div className="flex flex-col h-full border border-border rounded-xl bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
        <div className="icon-container icon-container-md bg-primary/10">
          <Lock size={14} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-display font-semibold text-foreground truncate">
            Conversa privada com {consultorNome}
          </h3>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Shield size={10} /> Sobre "{projetoNome}" · moderado
          </p>
        </div>
      </div>

      <div className="mx-3 mt-3 mb-1 p-2.5 rounded-lg bg-warning/10 border border-warning/20">
        <p className="text-[11px] text-warning-foreground flex items-start gap-1.5">
          {conversationOpen ? <AlertTriangle size={12} className="mt-0.5 shrink-0 text-warning" /> : <Lock size={12} className="mt-0.5 shrink-0 text-warning" />}
          <span>{conversationOpen ? "Não compartilhe dados pessoais (telefone, e-mail, CPF) ou links externos." : "Conversa bloqueada até a pré-aprovação deste consultor."}</span>
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 custom-scrollbar min-h-[260px] max-h-[360px]">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            {conversationOpen ? <MessageSquare size={24} className="mb-2 opacity-40" /> : <Lock size={24} className="mb-2 opacity-40" />}
            <p className="text-xs">{conversationOpen ? "Nenhuma mensagem ainda. Inicie a conversa com o consultor!" : "A conversa será liberada após a pré-aprovação."}</p>
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
                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
                  msg.bloqueado
                    ? "bg-destructive/10 border border-destructive/20"
                    : isMe(msg.sender_user_id)
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted rounded-bl-md"
                }`}>
                  {msg.bloqueado ? (
                    <p className="text-xs text-destructive italic">⚠️ Mensagem removida por violação das regras</p>
                  ) : parseAttachment(msg.conteudo) ? (
                    <button type="button" onClick={() => previewAttachment(parseAttachment(msg.conteudo)!.path, msg.sender_user_id)} className="flex max-w-full items-center gap-2 text-left text-sm hover:underline">
                      <FileText size={16} className="shrink-0" />
                      <span className="truncate">{parseAttachment(msg.conteudo)!.nome}</span>
                      <Eye size={14} className="shrink-0 opacity-70" />
                    </button>
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

      <div className="px-3 py-3 border-t border-border bg-card">
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => sendAttachment(e.target.files?.[0])} />
          <Button size="icon" variant="outline" onClick={() => conversationOpen ? fileInputRef.current?.click() : sendAttachment(undefined)} disabled={sending} className="shrink-0 rounded-xl h-10 w-10" title={conversationOpen ? "Anexar arquivo" : "Anexos bloqueados até a pré-aprovação"}>
            <Paperclip size={16} />
          </Button>
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value.slice(0, MAX_LEN))}
            onKeyDown={handleKeyDown}
            placeholder={conversationOpen ? `Mensagem privada para ${consultorNome}...` : "Conversa bloqueada até a pré-aprovação"}
            rows={1}
            className="resize-none min-h-[40px] max-h-[100px] text-sm rounded-xl"
          />
          <Button size="icon" onClick={sendMessage} disabled={!newMessage.trim() || sending} className="shrink-0 rounded-xl h-10 w-10">
            <Send size={16} />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          {newMessage.length}/{MAX_LEN} caracteres · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
};
