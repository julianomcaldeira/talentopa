import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserCheck, ThumbsUp, ThumbsDown, Users } from "lucide-react";

type Item = {
  id: string;
  projeto_id: string;
  proposta_id: string;
  status: string;
  projeto_nome?: string;
  consultor_nome?: string;
  valor?: number | null;
  parecer?: { aprovado: boolean; comentario: string | null } | null;
};

export default function EmpresaCoordenadorPainel() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Item | null>(null);
  const [comentario, setComentario] = useState("");

  const fetchData = async () => {
    if (!user) return;
    // projetos onde sou coordenador
    const { data: projs } = await supabase
      .from("projetos")
      .select("id,nome")
      .eq("coordenador_user_id", user.id);
    if (!projs || !projs.length) {
      setLoading(false);
      setItems([]);
      return;
    }
    const projIds = projs.map((p) => p.id);
    const projMap = new Map(projs.map((p) => [p.id, p.nome]));

    const { data: sl } = await (supabase as any)
      .from("projeto_shortlist")
      .select("id,projeto_id,proposta_id,status")
      .in("projeto_id", projIds);

    const propIds = (sl || []).map((s: any) => s.proposta_id);
    const { data: props } = propIds.length
      ? await supabase.from("propostas").select("id,consultor_user_id,valor_proposta").in("id", propIds)
      : { data: [] as any[] };

    const userIds = [...new Set((props || []).map((p: any) => p.consultor_user_id))];
    const { data: profs } = userIds.length
      ? await supabase.from("profiles").select("user_id,nome").in("user_id", userIds)
      : { data: [] as any[] };

    const nomeMap = new Map((profs || []).map((p: any) => [p.user_id, p.nome]));
    const propMap = new Map((props || []).map((p: any) => [p.id, p]));

    // pareceres já emitidos
    const slIds = (sl || []).map((s: any) => s.id);
    const { data: pareceres } = slIds.length
      ? await (supabase as any)
          .from("projeto_shortlist_pareceres")
          .select("shortlist_id,aprovado,comentario")
          .in("shortlist_id", slIds)
      : { data: [] as any[] };
    const parMap = new Map((pareceres || []).map((p: any) => [p.shortlist_id, p]));

    const enriched: Item[] = (sl || []).map((s: any) => {
      const prop: any = propMap.get(s.proposta_id);
      return {
        id: s.id,
        projeto_id: s.projeto_id,
        proposta_id: s.proposta_id,
        status: s.status,
        projeto_nome: projMap.get(s.projeto_id),
        consultor_nome: prop ? nomeMap.get(prop.consultor_user_id) || "Consultor" : "Consultor",
        valor: prop?.valor_proposta,
        parecer: parMap.get(s.id) || null,
      };
    });
    setItems(enriched);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const emitirParecer = async (aprovado: boolean) => {
    if (!selected) return;
    const { error } = await (supabase as any).rpc("coordenador_emitir_parecer", {
      p_shortlist_id: selected.id,
      p_aprovado: aprovado,
      p_comentario: comentario || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Parecer registrado");
    setSelected(null);
    setComentario("");
    fetchData();
  };

  if (loading) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <UserCheck size={22} /> Coordenação Técnica
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Entreviste os candidatos indicados na shortlist do RMO e emita seu parecer técnico.
        </p>
      </div>

      {items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-3 opacity-40" size={32} />
            Nenhuma shortlist pendente. Você será notificado quando o RMO enviar novos candidatos.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {items.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base">{item.consultor_nome}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Projeto: <span className="font-medium">{item.projeto_nome}</span>
                    {item.valor ? ` · R$ ${Number(item.valor).toLocaleString("pt-BR")}` : ""}
                  </p>
                </div>
                <Badge variant={item.parecer ? (item.parecer.aprovado ? "default" : "destructive") : "outline"}>
                  {item.parecer ? (item.parecer.aprovado ? "Aprovado" : "Reprovado") : item.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {item.parecer ? (
                item.parecer.comentario && (
                  <p className="text-sm bg-muted/50 rounded-lg p-3">{item.parecer.comentario}</p>
                )
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    setSelected(item);
                    setComentario("");
                  }}
                >
                  Emitir parecer
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Parecer sobre {selected?.consultor_nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Projeto: {selected?.projeto_nome}</p>
            <Textarea
              placeholder="Comentários da entrevista técnica (opcional)"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={5}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => emitirParecer(false)}>
              <ThumbsDown size={14} className="mr-1" /> Reprovar
            </Button>
            <Button onClick={() => emitirParecer(true)}>
              <ThumbsUp size={14} className="mr-1" /> Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
