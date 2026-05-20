import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FolderKanban } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Projeto {
  id: string;
  titulo: string;
  status: string;
  orcamento: number | null;
  prazo_dias: number | null;
  created_at: string;
}

const CanalProjetos = () => {
  const { user } = useAuth();
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: canalRow } = await supabase.from("canais").select("id").eq("user_id", user.id).single();
      if (!canalRow) { setLoading(false); return; }
      const { data } = await supabase
        .from("projetos")
        .select("id, titulo, status, orcamento, prazo_dias, created_at")
        .eq("canal_id", canalRow.id)
        .order("created_at", { ascending: false });
      setProjetos((data as Projeto[]) || []);
      setLoading(false);
    })();
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Projetos do canal</h1>
          <p className="text-muted-foreground text-sm mt-1">Projetos criados pelo seu canal e seu valor.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : projetos.length === 0 ? (
        <Card className="p-10 text-center">
          <FolderKanban className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium text-foreground">Nenhum projeto ainda</p>
          <p className="text-sm text-muted-foreground mt-1">Os projetos criados pelo seu canal aparecerão aqui.</p>
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {projetos.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{p.titulo}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {p.prazo_dias ? `${p.prazo_dias} dias` : "Prazo não definido"} ·{" "}
                  {p.orcamento ? `R$ ${Number(p.orcamento).toLocaleString("pt-BR")}` : "Sem orçamento"}
                </p>
              </div>
              <Badge variant="outline" className="capitalize">{p.status?.replace(/_/g, " ")}</Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};

export default CanalProjetos;
