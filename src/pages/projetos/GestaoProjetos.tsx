import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader, DataCard, StatusBadge, EmptyState, LoadingState } from "@/components/dashboard/DashboardComponents";
import { Button } from "@/components/ui/button";
import { Briefcase, ArrowRight, Clock } from "lucide-react";

const GestaoProjetos = () => {
  const { user, role, empresaUserId } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projetos, setProjetos] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      if (!user) return;
      let query = supabase
        .from("projetos")
        .select("*, softwares(nome)")
        .in("status", ["em_selecao", "em_andamento"])
        .order("updated_at", { ascending: false });

      if (role === "empresa") {
        query = query.eq("empresa_user_id", empresaUserId || user.id);
      } else if (role === "consultor") {
        const { data: props } = await supabase
          .from("propostas")
          .select("projeto_id")
          .eq("consultor_user_id", user.id)
          .in("status", ["aceita", "aguardando_consultor"]);
        const ids = (props || []).map((p: any) => p.projeto_id);
        if (ids.length === 0) {
          setProjetos([]);
          setLoading(false);
          return;
        }
        query = query.in("id", ids);
      }

      const { data } = await query;
      setProjetos(data || []);
      setLoading(false);
    };
    fetch();
  }, [user, role]);

  const basePath = role === "empresa" ? "/empresa" : role === "consultor" ? "/consultor" : "/admin";

  if (loading) return <DataCard><LoadingState /></DataCard>;

  return (
    <div>
      <PageHeader
        title="Gestão de Projetos"
        description="Acompanhe e execute os projetos ativos com fases, entregáveis, reuniões, horas e comunicação."
      />

      {projetos.length === 0 ? (
        <DataCard>
          <EmptyState
            message="Nenhum projeto ativo. Quando um projeto for aceito e iniciado, ele aparecerá aqui."
            icon={Briefcase}
          />
        </DataCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {projetos.map((p) => (
            <DataCard key={p.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-foreground truncate">{p.nome}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {p.softwares?.nome || "—"} · {p.protocolo || ""}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock size={12} />
                  Atualizado em {new Date(p.updated_at).toLocaleDateString("pt-BR")}
                </div>
                <Button size="sm" onClick={() => navigate(`${basePath}/projetos/${p.id}/gestao`)}>
                  Abrir gestão <ArrowRight size={14} />
                </Button>
              </div>
            </DataCard>
          ))}
        </div>
      )}
    </div>
  );
};

export default GestaoProjetos;
