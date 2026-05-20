import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { maskCNPJ, maskPhone } from "@/lib/cnpjMask";

interface Canal {
  id: string;
  nome: string;
  cnpj: string | null;
  responsavel_nome: string | null;
  email_contato: string | null;
  telefone: string | null;
  observacoes: string | null;
  status: string;
}

const CanalConfiguracoes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [canal, setCanal] = useState<Canal | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase.from("canais").select("*").eq("user_id", user.id).single();
      setCanal(data as Canal);
      setLoading(false);
    })();
  }, [user?.id]);

  const salvar = async () => {
    if (!canal) return;
    setSalvando(true);
    const { error } = await supabase
      .from("canais")
      .update({
        nome: canal.nome,
        cnpj: canal.cnpj,
        responsavel_nome: canal.responsavel_nome,
        email_contato: canal.email_contato,
        telefone: canal.telefone,
        observacoes: canal.observacoes,
      })
      .eq("id", canal.id);
    setSalvando(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Dados atualizados" });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!canal) {
    return <Card className="p-10 text-center"><p className="text-muted-foreground">Canal não encontrado.</p></Card>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Configurações do canal</h1>
        <p className="text-muted-foreground text-sm mt-1">Dados cadastrais e de contato do seu canal.</p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <Label>Nome do canal</Label>
          <Input value={canal.nome} onChange={(e) => setCanal({ ...canal, nome: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>CNPJ</Label>
          <Input value={canal.cnpj || ""} onChange={(e) => setCanal({ ...canal, cnpj: maskCNPJ(e.target.value) })} />
        </div>
        <div className="space-y-2">
          <Label>Responsável</Label>
          <Input value={canal.responsavel_nome || ""} onChange={(e) => setCanal({ ...canal, responsavel_nome: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>E-mail de contato</Label>
            <Input type="email" value={canal.email_contato || ""} onChange={(e) => setCanal({ ...canal, email_contato: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={canal.telefone || ""} onChange={(e) => setCanal({ ...canal, telefone: maskPhone(e.target.value) })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea rows={3} value={canal.observacoes || ""} onChange={(e) => setCanal({ ...canal, observacoes: e.target.value })} />
        </div>
        <div className="flex justify-end">
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar alterações"}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default CanalConfiguracoes;
