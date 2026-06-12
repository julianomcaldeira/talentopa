import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DataCard, SectionTitle } from "@/components/dashboard/DashboardComponents";
import { Badge } from "@/components/ui/badge";
import { Network, Calendar, Mail, Phone } from "lucide-react";

interface CanalVinculo {
  data_vinculo: string | null;
  canal: {
    nome: string;
    responsavel_nome: string | null;
    email_contato: string | null;
    telefone: string | null;
  } | null;
}

const CanalVinculadoCard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [vinculos, setVinculos] = useState<CanalVinculo[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("canal_consultores")
        .select("data_vinculo, canal:canais(nome, responsavel_nome, email_contato, telefone)")
        .eq("consultor_user_id", user.id)
        .eq("status", "ativo");
      setVinculos((data as any) || []);
      setLoading(false);
    })();
  }, [user?.id]);

  if (loading) return null;

  return (
    <DataCard>
      <div className="flex items-center gap-2 mb-4">
        <Network size={16} className="text-muted-foreground" />
        <SectionTitle>Canal Vinculado</SectionTitle>
      </div>
      {vinculos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Você não está vinculado a nenhum canal no momento.
        </p>
      ) : (
        <div className="space-y-3">
          {vinculos.map((v, i) => (
            <div key={i} className="border border-border rounded-lg p-4 bg-muted/30">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h4 className="font-semibold text-foreground">{v.canal?.nome || "Canal"}</h4>
                <Badge variant="secondary">Ativo</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                {v.canal?.responsavel_nome && (
                  <div>Responsável: <span className="text-foreground">{v.canal.responsavel_nome}</span></div>
                )}
                {v.canal?.email_contato && (
                  <div className="flex items-center gap-1.5"><Mail size={12} /> {v.canal.email_contato}</div>
                )}
                {v.canal?.telefone && (
                  <div className="flex items-center gap-1.5"><Phone size={12} /> {v.canal.telefone}</div>
                )}
                {v.data_vinculo && (
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} /> Vinculado em {new Date(v.data_vinculo).toLocaleDateString("pt-BR")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </DataCard>
  );
};

export default CanalVinculadoCard;
