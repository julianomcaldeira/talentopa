import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FolderKanban, Plus, User } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { PROJETO_SORT_OPTIONS, sortProjetos, ProjetoSortKey } from "@/lib/projetoSort";

interface Projeto {
  id: string;
  nome: string;
  status: string;
  valor_estimado: number | null;
  prazo_estimado: string | null;
  created_at: string;
  software_id?: string | null;
  consultor_nome?: string | null;
  empresa_nome?: string | null;
  elegiveis_count?: number;
  elegiveis_nomes?: string[];
}

interface EmpresaOption {
  user_id: string;
  nome: string;
}

interface ConsultorOption {
  user_id: string;
  nome: string;
}

const ProjetoItem = ({ p, showConsultor }: { p: Projeto; showConsultor?: boolean }) => (
  <div className="flex items-center justify-between gap-4 p-4">
    <div className="min-w-0">
      <p className="font-medium text-foreground truncate">{p.nome}</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {p.empresa_nome ? `${p.empresa_nome} · ` : ""}
        {p.prazo_estimado
          ? `Prazo: ${new Date(p.prazo_estimado).toLocaleDateString("pt-BR")}`
          : "Sem prazo"}{" "}
        ·{" "}
        {p.valor_estimado
          ? `R$ ${Number(p.valor_estimado).toLocaleString("pt-BR")}`
          : "Sem valor"}
      </p>
      {showConsultor && p.consultor_nome && (
        <p className="text-xs text-foreground/80 mt-1 flex items-center gap-1">
          <User className="h-3 w-3" /> {p.consultor_nome}
        </p>
      )}
    </div>
    <Badge variant="outline" className="capitalize">
      {p.status?.replace(/_/g, " ")}
    </Badge>
  </div>
);

const CanalProjetos = () => {
  const { user } = useAuth();
  const [canalId, setCanalId] = useState<string | null>(null);
  const [projetosCanal, setProjetosCanal] = useState<Projeto[]>([]);
  const [projetosConsultores, setProjetosConsultores] = useState<Projeto[]>([]);
  const [demandasPlataforma, setDemandasPlataforma] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<ProjetoSortKey>("recent");
  const sortedCanal = sortProjetos(projetosCanal, sortBy);
  const sortedConsultores = sortProjetos(projetosConsultores, sortBy);
  const sortedDemandas = sortProjetos(demandasPlataforma, sortBy);
  

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [consultores, setConsultores] = useState<ConsultorOption[]>([]);

  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    empresa_user_id: "",
    consultor_user_id: "",
    valor: "",
    prazo: "",
  });

  const enrichProjetos = async (rows: any[]): Promise<Projeto[]> => {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const empresaIds = Array.from(new Set(rows.map((r) => r.empresa_user_id).filter(Boolean)));

    const [{ data: alocs }, { data: profsEmp }] = await Promise.all([
      supabase
        .from("alocacoes")
        .select("projeto_id, consultor_user_id, status")
        .in("projeto_id", ids)
        .eq("status", "aprovada"),
      empresaIds.length
        ? supabase.from("profiles").select("user_id, nome").in("user_id", empresaIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const consultorIds = Array.from(
      new Set(((alocs as any[]) || []).map((a) => a.consultor_user_id).filter(Boolean))
    );
    const { data: profsCons } = consultorIds.length
      ? await supabase.from("profiles").select("user_id, nome").in("user_id", consultorIds)
      : ({ data: [] as any[] } as any);

    const consultorByProj = new Map<string, string>();
    ((alocs as any[]) || []).forEach((a) => {
      const nome = (profsCons as any[])?.find((p) => p.user_id === a.consultor_user_id)?.nome;
      if (nome && !consultorByProj.has(a.projeto_id)) consultorByProj.set(a.projeto_id, nome);
    });
    const empresaMap = new Map<string, string>();
    ((profsEmp as any[]) || []).forEach((p) => empresaMap.set(p.user_id, p.nome));

    return rows.map((r) => ({
      ...r,
      consultor_nome: consultorByProj.get(r.id) || null,
      empresa_nome: empresaMap.get(r.empresa_user_id) || null,
    }));
  };

  const loadProjetos = async (cid: string) => {
    // 1) Projetos criados pelo canal
    const { data: criados } = await supabase
      .from("projetos")
      .select("id, nome, status, valor_estimado, prazo_estimado, created_at, empresa_user_id")
      .eq("canal_id", cid)
      .order("created_at", { ascending: false });

    // 2) Projetos executados pelos consultores vinculados
    const { data: links } = await supabase
      .from("canal_consultores")
      .select("consultor_user_id")
      .eq("canal_id", cid)
      .eq("status", "ativo");
    const consultorIds = ((links as any[]) || []).map((l) => l.consultor_user_id).filter(Boolean);

    let projetosDosConsultores: any[] = [];
    if (consultorIds.length) {
      const { data: props } = await supabase
        .from("propostas")
        .select("projeto_id, status")
        .in("consultor_user_id", consultorIds)
        .in("status", ["aceita", "pre_aprovada"]);
      const projetoIds = Array.from(new Set(((props as any[]) || []).map((p) => p.projeto_id)));
      const criadosIds = new Set(((criados as any[]) || []).map((p) => p.id));
      const filtrados = projetoIds.filter((id) => !criadosIds.has(id));
      if (filtrados.length) {
        const { data: pjs } = await supabase
          .from("projetos")
          .select("id, nome, status, valor_estimado, prazo_estimado, created_at, empresa_user_id")
          .in("id", filtrados)
          .order("created_at", { ascending: false });
        projetosDosConsultores = (pjs as any[]) || [];
      }
    }

    // 3) Demandas da plataforma (roteamento v2, abertas)
    const { data: demandas } = await supabase
      .from("projetos")
      .select("id, nome, status, valor_estimado, prazo_estimado, created_at, empresa_user_id, software_id")
      .eq("roteamento_v2", true)
      .in("status", ["publicado", "em_selecao"])
      .order("created_at", { ascending: false });

    const [enrCanal, enrCons, enrDem] = await Promise.all([
      enrichProjetos((criados as any[]) || []),
      enrichProjetos(projetosDosConsultores),
      enrichProjetos((demandas as any[]) || []),
    ]);

    // Anota consultores elegíveis do canal para cada demanda (CA-01/CA-03)
    if (enrDem.length && consultorIds.length) {
      const softwareIds = Array.from(
        new Set(enrDem.map((d) => d.software_id).filter(Boolean) as string[])
      );
      if (softwareIds.length) {
        const { data: habs } = await supabase
          .from("consultor_habilidades")
          .select("user_id, software_id")
          .in("user_id", consultorIds)
          .in("software_id", softwareIds);
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, nome")
          .in("user_id", consultorIds);
        const nomeMap = new Map<string, string>(
          ((profs as any[]) || []).map((p) => [p.user_id, p.nome as string])
        );
        const bySoftware = new Map<string, Set<string>>();
        ((habs as any[]) || []).forEach((h) => {
          if (!bySoftware.has(h.software_id)) bySoftware.set(h.software_id, new Set());
          bySoftware.get(h.software_id)!.add(h.user_id);
        });
        enrDem.forEach((d) => {
          const set = d.software_id ? bySoftware.get(d.software_id) : null;
          const ids = set ? Array.from(set) : [];
          d.elegiveis_count = ids.length;
          d.elegiveis_nomes = ids.map((id) => nomeMap.get(id) || "Consultor");
        });
      }
    }

    setProjetosCanal(enrCanal);
    setProjetosConsultores(enrCons);
    setDemandasPlataforma(enrDem);
  };

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: canalRow } = await supabase
        .from("canais")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!canalRow) {
        setLoading(false);
        return;
      }
      setCanalId(canalRow.id);
      await loadProjetos(canalRow.id);
      setLoading(false);
    })();
  }, [user?.id]);

  const loadFormOptions = async () => {
    if (!canalId) return;
    // Empresas: lista todas as empresas (perfis públicos para autenticados)
    const { data: emps } = await supabase
      .from("empresa_perfil_public" as any)
      .select("user_id, nome_fantasia, razao_social")
      .order("razao_social", { ascending: true });
    setEmpresas(
      ((emps as any[]) || []).map((e) => ({
        user_id: e.user_id,
        nome: e.nome_fantasia || e.razao_social,
      }))
    );

    // Consultores vinculados ao canal (ativos)
    const { data: links } = await supabase
      .from("canal_consultores")
      .select("consultor_user_id")
      .eq("canal_id", canalId)
      .eq("status", "ativo");
    const ids = ((links as any[]) || []).map((l) => l.consultor_user_id);
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", ids);
      setConsultores(((profs as any[]) || []).map((p) => ({ user_id: p.user_id, nome: p.nome })));
    } else {
      setConsultores([]);
    }
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) loadFormOptions();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canalId || !user) return;
    if (!form.nome || !form.empresa_user_id || !form.consultor_user_id) {
      toast({ title: "Preencha nome, empresa e consultor", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const valorNum = form.valor ? Number(form.valor.replace(/\./g, "").replace(",", ".")) : null;

      const { data: projeto, error: pErr } = await supabase
        .from("projetos")
        .insert({
          nome: form.nome,
          descricao: form.descricao || null,
          empresa_user_id: form.empresa_user_id,
          canal_id: canalId,
          criado_por_tipo: "canal",
          valor_estimado: valorNum,
          prazo_estimado: form.prazo || null,
          status: "rascunho",
          roteamento_v2: true,
        })
        .select("id")
        .single();
      if (pErr) throw pErr;

      // Cria alocação proposta pelo canal (já pré-aprovada pelo próprio canal)
      const { error: aErr } = await supabase.from("alocacoes").insert({
        projeto_id: projeto.id,
        canal_id: canalId,
        consultor_user_id: form.consultor_user_id,
        valor: valorNum,
        prazo_estimado: form.prazo || null,
        solicitado_por: user.id,
        status: "aprovada",
        aprovado_por: user.id,
        data_aprovacao: new Date().toISOString(),
      });
      if (aErr) throw aErr;

      toast({ title: "Projeto criado com sucesso" });
      setForm({ nome: "", descricao: "", empresa_user_id: "", consultor_user_id: "", valor: "", prazo: "" });
      setOpen(false);
      await loadProjetos(canalId);
    } catch (err: any) {
      toast({ title: "Erro ao criar projeto", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Projetos do canal</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Projetos criados pelo seu canal, com valor e status.
          </p>
        </div>

        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button disabled={!canalId}>
              <Plus className="h-4 w-4 mr-2" />
              Novo projeto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Criar projeto</DialogTitle>
              <DialogDescription>
                Vincule uma empresa e um consultor do seu canal ao novo projeto.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do projeto *</Label>
                <Input
                  id="nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  required
                  maxLength={120}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  rows={3}
                  maxLength={1000}
                />
              </div>

              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Select
                  value={form.empresa_user_id}
                  onValueChange={(v) => setForm({ ...form, empresa_user_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhuma empresa</div>
                    ) : (
                      empresas.map((e) => (
                        <SelectItem key={e.user_id} value={e.user_id}>
                          {e.nome}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Consultor *</Label>
                <Select
                  value={form.consultor_user_id}
                  onValueChange={(v) => setForm({ ...form, consultor_user_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o consultor" />
                  </SelectTrigger>
                  <SelectContent>
                    {consultores.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Nenhum consultor ativo no canal
                      </div>
                    ) : (
                      consultores.map((c) => (
                        <SelectItem key={c.user_id} value={c.user_id}>
                          {c.nome}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="valor">Valor (R$)</Label>
                  <Input
                    id="valor"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={form.valor}
                    onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prazo">Prazo estimado</Label>
                  <Input
                    id="prazo"
                    type="date"
                    value={form.prazo}
                    onChange={(e) => setForm({ ...form, prazo: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar projeto
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="plataforma" className="w-full">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
            <div />
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Ordenar por</Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as ProjetoSortKey)}>
                <SelectTrigger className="h-8 w-52 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJETO_SORT_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <TabsList>
            <TabsTrigger value="plataforma">
              Demandas da plataforma ({demandasPlataforma.length})
            </TabsTrigger>
            <TabsTrigger value="canal">
              Criados pelo canal ({projetosCanal.length})
            </TabsTrigger>
            <TabsTrigger value="consultores">
              Realizados pelos consultores ({projetosConsultores.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="plataforma" className="mt-4">
            {demandasPlataforma.length === 0 ? (
              <Card className="p-10 text-center">
                <FolderKanban className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium text-foreground">Nenhuma demanda aberta no momento</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Quando uma empresa publicar uma nova demanda, ela aparecerá aqui para você indicar consultores.
                </p>
              </Card>
            ) : (
              <Card className="divide-y divide-border">
                {sortedDemandas.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{p.nome}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {p.empresa_nome ? `${p.empresa_nome} · ` : ""}
                        {p.prazo_estimado
                          ? `Prazo: ${new Date(p.prazo_estimado).toLocaleDateString("pt-BR")}`
                          : "Sem prazo"}{" "}
                        ·{" "}
                        {p.valor_estimado
                          ? `R$ ${Number(p.valor_estimado).toLocaleString("pt-BR")}`
                          : "Sem valor"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="capitalize">
                        {p.status?.replace(/_/g, " ")}
                      </Badge>
                      <Button size="sm" asChild>
                        <Link to={`/canal/demandas/${p.id}`}>Ver e indicar consultores</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </TabsContent>

          <TabsContent value="canal" className="mt-4">
            {projetosCanal.length === 0 ? (
              <Card className="p-10 text-center">
                <FolderKanban className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium text-foreground">Nenhum projeto ainda</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Clique em "Novo projeto" para criar o primeiro.
                </p>
              </Card>
            ) : (
              <Card className="divide-y divide-border">
                {sortedCanal.map((p) => (
                  <ProjetoItem key={p.id} p={p} />
                ))}
              </Card>
            )}
          </TabsContent>

          <TabsContent value="consultores" className="mt-4">
            {projetosConsultores.length === 0 ? (
              <Card className="p-10 text-center">
                <FolderKanban className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium text-foreground">
                  Nenhum projeto realizado pelos seus consultores ainda
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Quando um consultor vinculado ao seu canal tiver uma proposta
                  aceita, o projeto aparecerá aqui.
                </p>
              </Card>
            ) : (
              <Card className="divide-y divide-border">
                {sortedConsultores.map((p) => (
                  <ProjetoItem key={p.id} p={p} showConsultor />
                ))}
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

    </div>
  );
};

export default CanalProjetos;
