import { useState, useEffect } from "react";
import { Users, Search, Star, FolderKanban, Eye, MapPin, Mail, Phone, Briefcase, Award, Calendar, Linkedin, FileText, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, DataCard, EmptyState, LoadingState, StatusBadge, SectionTitle, StatCard } from "@/components/dashboard/DashboardComponents";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { maskPhone, unmask } from "@/lib/cnpjMask";

interface ConsultorRow {
  user_id: string;
  profile: {
    nome: string;
    email: string;
    telefone: string | null;
    cidade: string | null;
    estado: string | null;
    status: string;
    avatar_url: string | null;
    created_at: string;
  };
  perfil: {
    bio_profissional: string | null;
    linkedin: string | null;
    curriculo_url: string | null;
    plano: string;
  } | null;
  habilidades: {
    id: string;
    nivel: string;
    valor_hora: number | null;
    software_nome: string;
    modulo_nome: string | null;
    funcionalidade_nome: string | null;
  }[];
  avaliacoes: {
    nota: number;
    comentario: string | null;
    recomendacao: boolean | null;
    avaliador_nome: string;
    projeto_nome: string;
    created_at: string;
  }[];
  propostas: {
    id: string;
    status: string;
    valor_proposta: number | null;
    estimativa_horas: number | null;
    projeto_nome: string;
    projeto_protocolo: string | null;
  }[];
  media_nota: number;
  total_projetos: number;
}

const nivelLabels: Record<string, string> = {
  junior: "Júnior",
  pleno: "Pleno",
  senior: "Sênior",
  especialista: "Especialista",
};

const nivelColors: Record<string, string> = {
  junior: "bg-muted text-muted-foreground",
  pleno: "bg-info/10 text-info",
  senior: "bg-primary/10 text-primary",
  especialista: "bg-success/10 text-success",
};

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

const AdminConsultores = () => {
  const [consultores, setConsultores] = useState<ConsultorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [nivelFilter, setNivelFilter] = useState("todos");
  const [selectedConsultor, setSelectedConsultor] = useState<ConsultorRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({ nome: "", email: "", password: "", telefone: "", cidade: "", estado: "" });
  const { toast } = useToast();

  useEffect(() => {
    const fetchAll = async () => {
      // 1) consultor_perfil
      const { data: perfilData, error: perfilErr } = await supabase
        .from("consultor_perfil")
        .select("*")
        .order("created_at", { ascending: false });

      if (perfilErr || !perfilData) {
        toast({ title: "Erro", description: perfilErr?.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      const userIds = perfilData.map((p) => p.user_id);
      if (userIds.length === 0) { setLoading(false); return; }

      // 2) parallel fetches
      const [profilesRes, habilidadesRes, avaliacoesRes, propostasRes] = await Promise.all([
        supabase.from("profiles").select("*").in("user_id", userIds),
        supabase.from("consultor_habilidades").select("*, softwares(nome), modulos(nome), funcionalidades(nome)").in("user_id", userIds),
        supabase.from("avaliacoes").select("*, projetos(nome)").in("avaliado_user_id", userIds),
        supabase.from("propostas").select("*, projetos(nome, protocolo)").in("consultor_user_id", userIds),
      ]);

      // profiles for avaliadores
      const avaliadorIds = [...new Set((avaliacoesRes.data || []).map((a) => a.avaliador_user_id))];
      let avaliadorMap = new Map<string, string>();
      if (avaliadorIds.length > 0) {
        const { data: avProfiles } = await supabase.from("profiles").select("user_id, nome").in("user_id", avaliadorIds);
        avaliadorMap = new Map((avProfiles || []).map((p) => [p.user_id, p.nome]));
      }

      const profileMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p]));

      const rows: ConsultorRow[] = perfilData.map((cp) => {
        const profile = profileMap.get(cp.user_id);
        const habs = (habilidadesRes.data || [])
          .filter((h) => h.user_id === cp.user_id)
          .map((h: any) => ({
            id: h.id,
            nivel: h.nivel,
            valor_hora: h.valor_hora,
            software_nome: h.softwares?.nome || "",
            modulo_nome: h.modulos?.nome || null,
            funcionalidade_nome: h.funcionalidades?.nome || null,
          }));

        const avals = (avaliacoesRes.data || [])
          .filter((a) => a.avaliado_user_id === cp.user_id)
          .map((a: any) => ({
            nota: a.nota,
            comentario: a.comentario,
            recomendacao: a.recomendacao,
            avaliador_nome: avaliadorMap.get(a.avaliador_user_id) || "Anônimo",
            projeto_nome: a.projetos?.nome || "Projeto",
            created_at: a.created_at,
          }));

        const props = (propostasRes.data || [])
          .filter((p) => p.consultor_user_id === cp.user_id)
          .map((p: any) => ({
            id: p.id,
            status: p.status,
            valor_proposta: p.valor_proposta,
            estimativa_horas: p.estimativa_horas,
            projeto_nome: p.projetos?.nome || "Projeto",
            projeto_protocolo: p.projetos?.protocolo || null,
          }));

        const notas = avals.map((a) => a.nota);
        const media = notas.length > 0 ? notas.reduce((s, n) => s + n, 0) / notas.length : 0;

        return {
          user_id: cp.user_id,
          profile: profile
            ? { nome: profile.nome, email: profile.email, telefone: profile.telefone, cidade: profile.cidade, estado: profile.estado, status: profile.status, avatar_url: profile.avatar_url, created_at: profile.created_at }
            : { nome: "Consultor", email: "", telefone: null, cidade: null, estado: null, status: "ativo", avatar_url: null, created_at: cp.created_at },
          perfil: { bio_profissional: cp.bio_profissional, linkedin: cp.linkedin, curriculo_url: cp.curriculo_url, plano: cp.plano },
          habilidades: habs,
          avaliacoes: avals,
          propostas: props,
          media_nota: media,
          total_projetos: props.filter((p) => p.status === "aceita").length,
        };
      });

      setConsultores(rows);
      setLoading(false);
    };

    fetchAll();
  }, []);

  const filtered = consultores.filter((c) => {
    const term = search.toLowerCase();
    const matchesSearch =
      !term ||
      c.profile.nome.toLowerCase().includes(term) ||
      c.profile.email.toLowerCase().includes(term) ||
      c.habilidades.some((h) => h.software_nome.toLowerCase().includes(term));
    const matchesNivel =
      nivelFilter === "todos" || c.habilidades.some((h) => h.nivel === nivelFilter);
    return matchesSearch && matchesNivel;
  });

  const totalAtivos = consultores.filter((c) => c.profile.status === "ativo").length;
  const totalComHabilidades = consultores.filter((c) => c.habilidades.length > 0).length;
  const totalAvaliados = consultores.filter((c) => c.avaliacoes.length > 0).length;

  const handleCreateConsultor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newUser.telefone && unmask(newUser.telefone).length < 10) {
      toast({ title: "Telefone inválido", description: "Use o formato (99) 99999-9999.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: newUser.email,
          password: newUser.password,
          nome: newUser.nome,
          tipo_usuario: "consultor",
          extra: {
            telefone: newUser.telefone ? newUser.telefone.trim() : null,
            cidade: newUser.cidade || null,
            estado: newUser.estado || null,
          },
        },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: "Consultor cadastrado com sucesso!" });
      setCreateOpen(false);
      setNewUser({ nome: "", email: "", password: "", telefone: "", cidade: "", estado: "" });
      setLoading(true);
      window.location.reload();
    } catch (err: any) {
      toast({ title: "Erro ao cadastrar", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Consultores"
        description="Gerencie consultores da plataforma"
        action={
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <UserPlus size={16} /> Novo Consultor
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users} label="Total de consultores" value={consultores.length.toString()} iconColor="text-primary" iconBg="bg-primary/10" />
        <StatCard icon={Users} label="Ativos" value={totalAtivos.toString()} iconColor="text-success" iconBg="bg-success/10" />
        <StatCard icon={Award} label="Com habilidades" value={totalComHabilidades.toString()} iconColor="text-info" iconBg="bg-info/10" />
        <StatCard icon={Star} label="Com avaliações" value={totalAvaliados.toString()} iconColor="text-warning" iconBg="bg-warning/10" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
          <Input placeholder="Buscar por nome, e-mail ou software..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={nivelFilter} onValueChange={setNivelFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Nível" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os níveis</SelectItem>
            <SelectItem value="junior">Júnior</SelectItem>
            <SelectItem value="pleno">Pleno</SelectItem>
            <SelectItem value="senior">Sênior</SelectItem>
            <SelectItem value="especialista">Especialista</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataCard noPadding>
        {loading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState message={search ? "Nenhum consultor encontrado" : "Nenhum consultor cadastrado"} icon={Users} />
        ) : (
          <div className="divide-y divide-border/60">
            {filtered.map((c) => (
              <div
                key={c.user_id}
                className="flex items-center justify-between p-4 px-5 table-row-interactive cursor-pointer"
                onClick={() => { setSelectedConsultor(c); setDetailOpen(true); }}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center text-primary-foreground font-semibold text-xs shadow-md flex-shrink-0">
                    {c.profile.nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{c.profile.nome}</p>
                      {c.perfil?.plano === "premium" && (
                        <Badge className="text-[10px] bg-warning/10 text-warning border-warning/20 px-1.5 py-0">Premium</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.profile.email}
                      {c.profile.cidade && ` · ${c.profile.cidade}${c.profile.estado ? `/${c.profile.estado}` : ""}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {c.habilidades.length > 0 && (
                    <Badge variant="secondary" className="text-[11px] hidden sm:inline-flex">
                      {c.habilidades.length} habilidade{c.habilidades.length !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {c.media_nota > 0 && (
                    <div className="flex items-center gap-1 text-warning">
                      <Star size={12} fill="currentColor" />
                      <span className="text-xs font-semibold">{c.media_nota.toFixed(1)}</span>
                    </div>
                  )}
                  <StatusBadge status={c.profile.status} labels={{ ativo: "Ativo", inativo: "Inativo" }} />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Eye size={14} /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DataCard>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedConsultor && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-lg flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center text-primary-foreground font-semibold text-xs shadow-md flex-shrink-0">
                    {selectedConsultor.profile.nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div>
                    <span>{selectedConsultor.profile.nome}</span>
                    <p className="text-xs font-normal text-muted-foreground mt-0.5">{selectedConsultor.profile.email}</p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="info" className="mt-4">
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="info">Perfil</TabsTrigger>
                  <TabsTrigger value="habilidades">Habilidades ({selectedConsultor.habilidades.length})</TabsTrigger>
                  <TabsTrigger value="avaliacoes">Avaliações ({selectedConsultor.avaliacoes.length})</TabsTrigger>
                  <TabsTrigger value="projetos">Projetos ({selectedConsultor.propostas.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoBox label="Telefone" value={selectedConsultor.profile.telefone} icon={<Phone size={14} />} />
                    <InfoBox label="Localização" value={[selectedConsultor.profile.cidade, selectedConsultor.profile.estado].filter(Boolean).join(" - ") || null} icon={<MapPin size={14} />} />
                    <InfoBox label="Plano" value={selectedConsultor.perfil?.plano === "premium" ? "Premium" : "Standard"} icon={<Award size={14} />} />
                    <InfoBox label="Cadastro" value={new Date(selectedConsultor.profile.created_at).toLocaleDateString("pt-BR")} icon={<Calendar size={14} />} />
                    {selectedConsultor.perfil?.linkedin && (
                      <InfoBox label="LinkedIn" value={selectedConsultor.perfil.linkedin} icon={<Linkedin size={14} />} />
                    )}
                    <InfoBox label="Nota média" value={selectedConsultor.media_nota > 0 ? `${selectedConsultor.media_nota.toFixed(1)} / 5` : "Sem avaliações"} icon={<Star size={14} />} />
                  </div>
                  {selectedConsultor.perfil?.bio_profissional && (
                    <div>
                      <SectionTitle>Bio profissional</SectionTitle>
                      <p className="text-sm text-foreground/80 bg-muted/40 rounded-xl p-4">{selectedConsultor.perfil.bio_profissional}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="habilidades" className="mt-4">
                  {selectedConsultor.habilidades.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma habilidade cadastrada</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedConsultor.habilidades.map((h) => (
                        <div key={h.id} className="flex items-center justify-between bg-muted/40 rounded-xl p-3.5">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{h.software_nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {[h.modulo_nome, h.funcionalidade_nome].filter(Boolean).join(" → ") || "Geral"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {h.valor_hora && (
                              <span className="text-xs font-semibold text-foreground">{formatCurrency(h.valor_hora)}/h</span>
                            )}
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg ${nivelColors[h.nivel] || ""}`}>
                              {nivelLabels[h.nivel] || h.nivel}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="avaliacoes" className="mt-4">
                  {selectedConsultor.avaliacoes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma avaliação recebida</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedConsultor.avaliacoes.map((a, i) => (
                        <div key={i} className="bg-muted/40 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-0.5 text-warning">
                                {Array.from({ length: 5 }).map((_, si) => (
                                  <Star key={si} size={12} fill={si < a.nota ? "currentColor" : "none"} className={si < a.nota ? "" : "text-muted-foreground/30"} />
                                ))}
                              </div>
                              {a.recomendacao && (
                                <Badge className="text-[10px] bg-success/10 text-success border-success/20 px-1.5 py-0">Recomenda</Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground">{new Date(a.created_at).toLocaleDateString("pt-BR")}</span>
                          </div>
                          {a.comentario && <p className="text-sm text-foreground/80 mb-2">{a.comentario}</p>}
                          <p className="text-xs text-muted-foreground">
                            Por <span className="font-medium text-foreground/70">{a.avaliador_nome}</span> · {a.projeto_nome}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="projetos" className="mt-4">
                  {selectedConsultor.propostas.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma proposta enviada</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedConsultor.propostas.map((p) => (
                        <div key={p.id} className="flex items-center justify-between bg-muted/40 rounded-xl p-3.5">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{p.projeto_nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.projeto_protocolo} · {p.estimativa_horas || 0}h
                            </p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-xs font-semibold">{formatCurrency(p.valor_proposta || 0)}</span>
                            <StatusBadge status={p.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Consultor Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <UserPlus size={18} className="text-primary" />
              Cadastrar Consultor
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateConsultor} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="c-nome">Nome completo *</Label>
              <Input id="c-nome" required value={newUser.nome} onChange={(e) => setNewUser({ ...newUser, nome: e.target.value })} placeholder="Nome do consultor" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-email">E-mail *</Label>
              <Input id="c-email" type="email" required value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="consultor@email.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-password">Senha *</Label>
              <Input id="c-password" type="password" required minLength={6} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="c-tel">Telefone</Label>
                <Input id="c-tel" value={newUser.telefone} onChange={(e) => setNewUser({ ...newUser, telefone: e.target.value })} placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-cidade">Cidade</Label>
                <Input id="c-cidade" value={newUser.cidade} onChange={(e) => setNewUser({ ...newUser, cidade: e.target.value })} placeholder="São Paulo" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-estado">Estado</Label>
              <Input id="c-estado" value={newUser.estado} onChange={(e) => setNewUser({ ...newUser, estado: e.target.value })} placeholder="SP" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={creating}>{creating ? "Cadastrando..." : "Cadastrar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const InfoBox = ({ label, value, icon }: { label: string; value: string | null | undefined; icon?: React.ReactNode }) => (
  <div className="bg-muted/40 rounded-xl p-3">
    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 flex items-center gap-1.5">{icon} {label}</p>
    <p className="text-sm font-medium text-foreground">{value || "—"}</p>
  </div>
);

export default AdminConsultores;
