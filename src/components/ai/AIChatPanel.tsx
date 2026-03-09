import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Bot, User, Loader2, Sparkles, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

interface AIChatPanelProps {
  mode: "project-scope" | "project-manager" | "erp-knowledge" | "consultant-copilot" | "consultant-analysis";
  projectData?: any;
  initialMessage?: string;
  placeholder?: string;
  onScopeGenerated?: (content: string) => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

async function streamChat({
  messages, mode, projectData, onDelta, onDone, onError,
}: {
  messages: Msg[]; mode: string; projectData?: any;
  onDelta: (text: string) => void; onDone: () => void; onError: (msg: string) => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, mode, projectData }),
  });

  if (resp.status === 429) { onError("Limite de requisições excedido. Aguarde um momento."); return; }
  if (resp.status === 402) { onError("Créditos insuficientes. Entre em contato com o suporte."); return; }
  if (!resp.ok || !resp.body) { onError("Falha ao conectar com a IA."); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let done = false;

  while (!done) {
    const { done: rd, value } = await reader.read();
    if (rd) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "" || !line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { done = true; break; }
      try {
        const parsed = JSON.parse(json);
        const c = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (c) onDelta(c);
      } catch { buf = line + "\n" + buf; break; }
    }
  }
  onDone();
}

const AIChatPanel = ({ mode, projectData, initialMessage, placeholder, onScopeGenerated }: AIChatPanelProps) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (initialMessage && messages.length === 0) {
      sendMessage(initialMessage, true);
    }
  }, []);

  const sendMessage = async (text?: string, isInit = false) => {
    const msg = text || input.trim();
    if (!msg && !isInit) return;

    const userMsg: Msg = { role: "user", content: msg };
    const newMessages = isInit ? [] : [...messages, userMsg];
    if (!isInit) setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    let assistantText = "";
    const upsert = (chunk: string) => {
      assistantText += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantText } : m);
        }
        return [...prev, { role: "assistant", content: assistantText }];
      });
    };

    try {
      await streamChat({
        messages: isInit ? [userMsg] : [...newMessages],
        mode, projectData,
        onDelta: upsert,
        onDone: () => {
          setLoading(false);
          if (mode === "project-scope" && onScopeGenerated && assistantText.includes("Etapas")) {
            onScopeGenerated(assistantText);
          }
        },
        onError: (msg) => {
          setLoading(false);
          toast({ title: "Erro", description: msg, variant: "destructive" });
        },
      });
    } catch {
      setLoading(false);
      toast({ title: "Erro", description: "Falha na conexão com a IA.", variant: "destructive" });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="text-primary" size={24} />
            </div>
            <h3 className="font-display font-semibold text-foreground text-lg mb-1">
              {mode === "project-scope" && "Assistente de Escopo"}
              {mode === "project-manager" && "Gerente de Projetos IA"}
              {mode === "erp-knowledge" && "Base de Conhecimento ERP"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {mode === "project-scope" && "Descreva seu projeto e eu vou te ajudar a criar um escopo estruturado."}
              {mode === "project-manager" && "Analiso seus projetos e gero alertas, resumos e recomendações."}
              {mode === "erp-knowledge" && "Tire dúvidas técnicas sobre ERP, configurações, erros e melhores práticas."}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot size={16} className="text-primary" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-muted/60 text-foreground rounded-bl-md"
            }`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-display prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-li:text-foreground/90">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : msg.content}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User size={16} className="text-accent" />
              </div>
            )}
          </div>
        ))}

        {loading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bot size={16} className="text-primary" />
            </div>
            <div className="bg-muted/60 rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          {messages.length > 0 && (
            <Button variant="outline" size="icon" className="flex-shrink-0" onClick={() => setMessages([])} title="Nova conversa">
              <RotateCcw size={16} />
            </Button>
          )}
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "Digite sua mensagem..."}
            rows={1}
            className="min-h-[44px] max-h-[120px] resize-none"
            disabled={loading}
          />
          <Button size="icon" className="flex-shrink-0" onClick={() => sendMessage()} disabled={!input.trim() || loading}>
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AIChatPanel;
