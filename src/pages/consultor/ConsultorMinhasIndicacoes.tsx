import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Handshake, Info } from "lucide-react";

type Row = {
  id: string;
  status: string;
  created_at: string;
  valor_proposto: number | null;
  canal_id: string;
  canais?: { nome: string | null } | null;
  parceiro_respostas?: {
    projeto_id: string;
    projetos?: {
      nome: string | null;
      protocolo: string | null;
      empresa_user_id: string | null;
    } | null;
  } | null;
};

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  indicado: { label: "Indicado", variant: "default" },
  selecionado: { label: "Selecionado", variant: "secondary" },
  recusado: { label: "Recusado", variant: "destructive" },
  retirado: { label: "Retirado", variant: "outline" },
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const formatCurrency = (v: number | null) =>
  v == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const ConsultorMinhasIndicacoes = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [empresas, setEmpresas] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("parceiro_indicacoes")
        .select(`
          id, status, created_at, valor_proposto, canal_id,
          canais:canal_id ( nome ),
          parceiro_respostas:resposta_id (
            projeto_id,
            projetos:projeto_id ( nome, protocolo, empresa_user_id )
          )
        `)
        .eq("consultor_user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setRows(data as Row[]);
        const ids = Array.from(
          new Set(
            (data as Row[])
              .map((r) => r.parceiro_respostas?.projetos?.empresa_user_id)
              .filter((x): x is string => !!x)
          )
        );
        if (ids.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, nome")
            .in("user_id", ids);
          if (profs) {
            const map: Record<string, string> = {};
            profs.forEach((p: any) => { map[p.user_id] = p.nome; });
            setEmpresas(map);
          }
        }
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Minhas Indicações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Demandas em que você foi indicado pelo seu parceiro. Visualização somente leitura — a resposta oficial é do parceiro.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/5 p-3 text-xs text-muted-foreground">
        <Info size={14} className="text-info mt-0.5 shrink-0" />
        <span>Todas as tratativas comerciais destas demandas são conduzidas pelo seu parceiro.</span>
      </div>

      {rows.length === 0 ? (
        <Card className="p-10 text-center">
          <Handshake size={28} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Você ainda não foi indicado em nenhuma demanda.
          </p>
        </Card>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Demanda</th>
                  <th className="text-left px-4 py-3 font-semibold">Empresa</th>
                  <th className="text-left px-4 py-3 font-semibold">Parceiro</th>
                  <th className="text-left px-4 py-3 font-semibold">Indicado em</th>
                  <th className="text-left px-4 py-3 font-semibold">Valor proposto</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const proj = r.parceiro_respostas?.projetos;
                  const st = statusMap[r.status] ?? { label: r.status, variant: "outline" as const };
                  return (
                    <tr key={r.id} className="border-t border-border/60 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{proj?.nome ?? "—"}</div>
                        {proj?.protocolo && (
                          <div className="text-[11px] text-muted-foreground">#{proj.protocolo}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {proj?.empresa_user_id ? empresas[proj.empresa_user_id] ?? "—" : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.canais?.nome ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatCurrency(r.valor_proposto)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsultorMinhasIndicacoes;
