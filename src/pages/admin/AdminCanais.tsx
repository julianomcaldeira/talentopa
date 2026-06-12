import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Network, Mail, Phone, Search, Users, Calendar } from "lucide-react";
import { PageHeader } from "@/components/dashboard/DashboardComponents";

interface Canal {
  id: string;
  nome: string;
  cnpj: string | null;
  responsavel_nome: string | null;
  email_contato: string | null;
  telefone: string | null;
  status: string;
  created_at: string;
}
interface Vinculo {
  id: string;
  canal_id: string;
  consultor_user_id: string | null;
  convite_email: string | null;
  status: string;
  data_vinculo: string | null;
  created_at: string;
}
interface Convite {
  id: string;
  canal_id: string;
  email: string;
  status: string;
  consultor_user_id: string | null;
  created_at: string;
}
interface ProfileLite { user_id: string; nome: string; email: string; }

const statusVar: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ativo: "default", pendente: "secondary", aceito: "default",
  recusado: "destructive", desvinculado: "outline", expirado: "outline",
};

const AdminCanais = () => {
  const [loading, setLoading] = useState(true);
  const [canais, setCanais] = useState<Canal[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [busca, setBusca] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: v }, { data: cv }] = await Promise.all([
        supabase.from("canais").select("*").order("nome"),
        supabase.from("canal_consultores").select("*"),
        supabase.from("canal_convites").select("*"),
      ]);
      const cs = (c as Canal[]) || [];
      const vs = (v as Vinculo[]) || [];
      const cvs = (cv as Convite[]) || [];
      setCanais(cs); setVinculos(vs); setConvites(cvs);

      const ids = Array.from(new Set([
        ...vs.map(x => x.consultor_user_id),
        ...cvs.map(x => x.consultor_user_id),
      ].filter(Boolean) as string[]));

      if (ids.length) {
        const { data: pr } = await supabase.from("profiles").select("user_id, nome, email").in("user_id", ids);
        const map: Record<string, ProfileLite> = {};
        (pr || []).forEach((p: any) => { map[p.user_id] = p; });
        setProfiles(map);
      }
      setLoading(false);
    })();
  }, []);

  const termo = busca.trim().toLowerCase();
  const canaisFiltrados = canais.filter(c =>
    !termo ||
    c.nome.toLowerCase().includes(termo) ||
    (c.cnpj || "").toLowerCase().includes(termo) ||
    (c.email_contato || "").toLowerCase().includes(termo)
  );

  return (
    <div>
      <PageHeader
        title="Canais e Consultores"
        description="Visão consolidada de todos os canais e os consultores vinculados a cada um."
      />

      <div className="flex items-center gap-3 mb-5 max-w-md">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar canal por nome, CNPJ ou e-mail" className="pl-9" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : canaisFiltrados.length === 0 ? (
        <Card className="p-10 text-center">
          <Network className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium text-foreground">Nenhum canal encontrado</p>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {canaisFiltrados.map((c) => {
            const vincCanal = vinculos.filter(v => v.canal_id === c.id);
            const ativos = vincCanal.filter(v => v.status === "ativo");
            const convCanal = convites.filter(cv => cv.canal_id === c.id);
            const pendentes = convCanal.filter(cv => cv.status === "pendente").length;

            return (
              <AccordionItem key={c.id} value={c.id} className="border border-border rounded-lg bg-card px-4">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center justify-between w-full pr-3">
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <Network className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-foreground">{c.nome}</span>
                        <Badge variant={c.status === "ativo" ? "default" : "outline"}>{c.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                        {c.cnpj && <span>CNPJ: {c.cnpj}</span>}
                        {c.responsavel_nome && <span>· Resp.: {c.responsavel_nome}</span>}
                        {c.email_contato && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email_contato}</span>}
                        {c.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.telefone}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm shrink-0">
                      <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" />{ativos.length} ativos</Badge>
                      {pendentes > 0 && <Badge variant="outline">{pendentes} pendentes</Badge>}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  {vincCanal.length === 0 && convCanal.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-3">Nenhum convite enviado ainda.</p>
                  ) : (
                    <div className="border border-border rounded-md divide-y divide-border">
                      {/* Vínculos (incluem aceitos / desvinculados) */}
                      {vincCanal.map((v) => {
                        const p = v.consultor_user_id ? profiles[v.consultor_user_id] : null;
                        return (
                          <div key={`v-${v.id}`} className="flex items-center justify-between gap-3 p-3 text-sm">
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">{p?.nome || v.convite_email || "—"}</p>
                              <p className="text-xs text-muted-foreground truncate">{p?.email || v.convite_email}</p>
                              {v.data_vinculo && (
                                <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                  <Calendar className="h-3 w-3" /> Vinculado em {new Date(v.data_vinculo).toLocaleDateString("pt-BR")}
                                </p>
                              )}
                            </div>
                            <Badge variant={statusVar[v.status] || "outline"}>{v.status}</Badge>
                          </div>
                        );
                      })}
                      {/* Convites pendentes/expirados sem vínculo correspondente */}
                      {convCanal
                        .filter(cv => !vincCanal.some(v => v.consultor_user_id && v.consultor_user_id === cv.consultor_user_id))
                        .filter(cv => cv.status === "pendente" || cv.status === "expirado" || cv.status === "recusado")
                        .map((cv) => (
                          <div key={`c-${cv.id}`} className="flex items-center justify-between gap-3 p-3 text-sm">
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">{cv.email}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Convidado em {new Date(cv.created_at).toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                            <Badge variant={statusVar[cv.status] || "outline"}>{cv.status}</Badge>
                          </div>
                        ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
};

export default AdminCanais;
