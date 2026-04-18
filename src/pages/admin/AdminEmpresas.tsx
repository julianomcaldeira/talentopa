import { useState, useEffect } from "react";
import { Building2, Search, MapPin, Phone, Mail, Globe, Users, Calendar, Eye, RefreshCw, UserPlus, Briefcase, CheckCircle2, DollarSign, Loader2, Trash2, Plus, ShieldCheck, Wallet, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, DataCard, EmptyState, LoadingState, StatusBadge, SectionTitle } from "@/components/dashboard/DashboardComponents";
import { Badge } from "@/components/ui/badge";

type PapelEmpresa = "responsavel" | "financeiro" | "operacional";

const PAPEL_LABELS: Record<PapelEmpresa, string> = {
  responsavel: "Responsável",
  financeiro: "Financeiro",
  operacional: "Operacional",
};

const PAPEL_ICONS: Record<PapelEmpresa, any> = {
  responsavel: ShieldCheck,
  financeiro: Wallet,
  operacional: Wrench,
};

interface EmpresaUsuarioRow {
  id: string;
  user_id: string;
  papel: PapelEmpresa;
  observacoes: string | null;
  created_at: string;
  isOwner?: boolean;
  profile?: {
    nome: string;
    email: string;
    telefone: string | null;
    status: string;
    avatar_url: string | null;
  };
}

interface EmpresaRow {
  id: string;
  user_id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  endereco: string | null;
  segmento: string | null;
  numero_funcionarios: number | null;
  inscricao_estadual: string | null;
  created_at: string;
  profile?: {
    nome: string;
    email: string;
    telefone: string | null;
    cidade: string | null;
    estado: string | null;
    status: string;
    avatar_url: string | null;
  };
  projetos_count?: number;
  usuarios_count?: number;
  usuarios_resumo?: { nome: string; papel: PapelEmpresa; isOwner?: boolean }[];
}

interface CnpjData {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  endereco: string;
  segmento: string;
  situacao_cadastral: string;
  porte: string;
  natureza_juridica: string;
  capital_social: number;
  data_abertura: string;
  telefone: string;
  email: string;
}

interface ProjetoEmpresa {
  id: string;
  nome: string;
  status: string;
  protocolo: string | null;
  created_at: string;
  prazo_estimado: string | null;
  valor_contratado: number;
}

const formatCnpj = (cnpj: string) => {
  const c = cnpj.replace(/\D/g, '');
  if (c.length !== 14) return cnpj;
  return `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12)}`;
};

const maskCnpjInput = (val: string) => {
  const c = val.replace(/\D/g, '').slice(0, 14);
  if (c.length <= 2) return c;
  if (c.length <= 5) return `${c.slice(0,2)}.${c.slice(2)}`;
  if (c.length <= 8) return `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5)}`;
  if (c.length <= 12) return `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8)}`;
  return `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12)}`;
};

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  publicado: "Publicado",
  em_selecao: "Em seleção",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const ACTIVE_STATUSES = ["publicado", "em_selecao", "em_andamento"];

const AdminEmpresas = () => {
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaRow | null>(null);
  const [cnpjData, setCnpjData] = useState<CnpjData | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cnpjLookupLoading, setCnpjLookupLoading] = useState(false);
  const [cnpjLookupDone, setCnpjLookupDone] = useState(false);
  const [newEmpresa, setNewEmpresa] = useState({
    cnpj: "",
    nome: "",
    email: "",
    password: "",
    nome_fantasia: "",
    segmento: "",
    endereco: "",
    numero_funcionarios: "",
  });

  // Dialog detail data
  const [empresaProjetos, setEmpresaProjetos] = useState<ProjetoEmpresa[]>([]);
  const [empresaUsers, setEmpresaUsers] = useState<EmpresaUsuarioRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Add user form
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [newLink, setNewLink] = useState<{ email: string; papel: PapelEmpresa; observacoes: string }>({
    email: "",
    papel: "operacional",
    observacoes: "",
  });

  const { toast } = useToast();

  const fetchEmpresas = async () => {
    const { data: empresaData, error } = await supabase
      .from("empresa_perfil")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (!empresaData) { setLoading(false); return; }

    const userIds = empresaData.map(e => e.user_id);
    const [profilesRes, projetosRes, linksRes] = await Promise.all([
      supabase.from("profiles").select("*").in("user_id", userIds),
      supabase.from("projetos").select("id, empresa_user_id").in("empresa_user_id", userIds),
      supabase.from("empresa_usuarios").select("empresa_user_id, user_id, papel").in("empresa_user_id", userIds),
    ]);

    const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
    const projetoCountMap = new Map<string, number>();
    (projetosRes.data || []).forEach(p => {
      projetoCountMap.set(p.empresa_user_id, (projetoCountMap.get(p.empresa_user_id) || 0) + 1);
    });

    // Coleta IDs de usuários vinculados (não-dono) para buscar perfis
    const linkedUserIds = Array.from(new Set((linksRes.data || []).map(l => l.user_id).filter(uid => !userIds.includes(uid))));
    const linkedProfilesRes = linkedUserIds.length > 0
      ? await supabase.from("profiles").select("user_id, nome").in("user_id", linkedUserIds)
      : { data: [] as any[] };
    const linkedProfileMap = new Map((linkedProfilesRes.data || []).map(p => [p.user_id, p]));

    // Monta resumo de usuários por empresa: dono (responsavel) + vínculos
    const resumoMap = new Map<string, { nome: string; papel: PapelEmpresa; isOwner?: boolean }[]>();
    userIds.forEach(uid => {
      const ownerProfile = profileMap.get(uid) as any;
      resumoMap.set(uid, [{ nome: ownerProfile?.nome || "Dono", papel: "responsavel", isOwner: true }]);
    });
    (linksRes.data || []).forEach(l => {
      // Evita duplicar o dono caso esteja registrado como responsável
      if (l.user_id === l.empresa_user_id && l.papel === "responsavel") return;
      const arr = resumoMap.get(l.empresa_user_id);
      if (!arr) return;
      const profile = (profileMap.get(l.user_id) || linkedProfileMap.get(l.user_id)) as any;
      arr.push({ nome: profile?.nome || "Usuário", papel: l.papel as PapelEmpresa });
    });

    const enriched: EmpresaRow[] = empresaData.map(e => {
      const resumo = resumoMap.get(e.user_id) || [];
      // Conta usuários únicos por user_id
      const uniqueIds = new Set<string>([e.user_id, ...((linksRes.data || []).filter(l => l.empresa_user_id === e.user_id).map(l => l.user_id))]);
      return {
        ...e,
        profile: profileMap.get(e.user_id) as any,
        projetos_count: projetoCountMap.get(e.user_id) || 0,
        usuarios_count: uniqueIds.size,
        usuarios_resumo: resumo,
      };
    });

    setEmpresas(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchEmpresas(); }, []);

  const consultarCnpj = async (cnpj: string) => {
    setCnpjLoading(true);
    setCnpjData(null);
    try {
      const { data, error } = await supabase.functions.invoke('consulta-cnpj', { body: { cnpj } });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setCnpjData(data);
      toast({ title: "Dados da Receita Federal carregados!" });
    } catch (err: any) {
      toast({ title: "Erro ao consultar CNPJ", description: err.message, variant: "destructive" });
    } finally {
      setCnpjLoading(false);
    }
  };

  const fetchEmpresaDetails = async (empresa: EmpresaRow) => {
    setDetailLoading(true);
    setEmpresaProjetos([]);
    setEmpresaUsers([]);

    // Fetch all projects of this empresa
    const { data: projetos } = await supabase
      .from("projetos")
      .select("id, nome, status, protocolo, created_at, prazo_estimado")
      .eq("empresa_user_id", empresa.user_id)
      .order("created_at", { ascending: false });

    const projetoIds = (projetos || []).map(p => p.id);
    let pagamentosByProjeto = new Map<string, number>();
    if (projetoIds.length > 0) {
      const { data: pagamentos } = await supabase
        .from("pagamentos")
        .select("projeto_id, valor_total")
        .in("projeto_id", projetoIds);
      (pagamentos || []).forEach(p => {
        pagamentosByProjeto.set(p.projeto_id, (pagamentosByProjeto.get(p.projeto_id) || 0) + Number(p.valor_total || 0));
      });
    }

    const projetosEnriched: ProjetoEmpresa[] = (projetos || []).map(p => ({
      ...p,
      valor_contratado: pagamentosByProjeto.get(p.id) || 0,
    }));
    setEmpresaProjetos(projetosEnriched);

    await loadEmpresaUsers(empresa);
    setDetailLoading(false);
  };

  const loadEmpresaUsers = async (empresa: EmpresaRow) => {
    const [ownerRes, linksRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", empresa.user_id).maybeSingle(),
      supabase.from("empresa_usuarios").select("*").eq("empresa_user_id", empresa.user_id).order("created_at", { ascending: true }),
    ]);

    const linkedUserIds = (linksRes.data || []).map(l => l.user_id);
    const otherProfilesRes = linkedUserIds.length > 0
      ? await supabase.from("profiles").select("*").in("user_id", linkedUserIds)
      : { data: [] as any[] };
    const profileMap = new Map((otherProfilesRes.data || []).map(p => [p.user_id, p]));

    const rows: EmpresaUsuarioRow[] = [];
    if (ownerRes.data) {
      rows.push({
        id: `owner-${empresa.user_id}`,
        user_id: empresa.user_id,
        papel: "responsavel",
        observacoes: "Dono da empresa (cadastro original)",
        created_at: empresa.created_at,
        isOwner: true,
        profile: ownerRes.data as any,
      });
    }
    (linksRes.data || []).forEach(l => {
      if (l.user_id === empresa.user_id && l.papel === "responsavel") return;
      rows.push({
        id: l.id,
        user_id: l.user_id,
        papel: l.papel as PapelEmpresa,
        observacoes: l.observacoes,
        created_at: l.created_at,
        profile: profileMap.get(l.user_id) as any,
      });
    });
    setEmpresaUsers(rows);
  };

  const handleAddUserLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpresa) return;
    setAddingUser(true);
    try {
      const { data: targetProfile, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, nome, email")
        .ilike("email", newLink.email.trim())
        .maybeSingle();
      if (pErr) throw pErr;
      if (!targetProfile) {
        throw new Error("Nenhum usuário cadastrado com esse e-mail. Cadastre o usuário primeiro.");
      }

      const { error: insErr } = await supabase.from("empresa_usuarios").insert({
        empresa_user_id: selectedEmpresa.user_id,
        user_id: targetProfile.user_id,
        papel: newLink.papel,
        observacoes: newLink.observacoes || null,
      });
      if (insErr) {
        if ((insErr as any).code === "23505") throw new Error("Este usuário já está vinculado com este papel.");
        throw insErr;
      }

      toast({ title: "Usuário vinculado!", description: `${targetProfile.nome} agora é ${PAPEL_LABELS[newLink.papel]}.` });
      setNewLink({ email: "", papel: "operacional", observacoes: "" });
      setAddUserOpen(false);
      await loadEmpresaUsers(selectedEmpresa);
    } catch (err: any) {
      toast({ title: "Erro ao vincular", description: err.message, variant: "destructive" });
    } finally {
      setAddingUser(false);
    }
  };

  const handleRemoveUserLink = async (linkId: string) => {
    if (!selectedEmpresa) return;
    if (!confirm("Remover este vínculo?")) return;
    const { error } = await supabase.from("empresa_usuarios").delete().eq("id", linkId);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Vínculo removido" });
    await loadEmpresaUsers(selectedEmpresa);
  };

  const openDetail = (empresa: EmpresaRow) => {
    setSelectedEmpresa(empresa);
    setCnpjData(null);
    setDetailOpen(true);
    fetchEmpresaDetails(empresa);
    if (empresa.cnpj) consultarCnpj(empresa.cnpj);
  };

  const filtered = empresas.filter(e => {
    const term = search.toLowerCase();
    return !term || 
      e.razao_social.toLowerCase().includes(term) ||
      e.nome_fantasia?.toLowerCase().includes(term) ||
      e.cnpj?.includes(term) ||
      e.profile?.email.toLowerCase().includes(term);
  });

  const handleCnpjLookupForCreate = async () => {
    const clean = newEmpresa.cnpj.replace(/\D/g, '');
    if (clean.length !== 14) {
      toast({ title: "CNPJ inválido", description: "Informe os 14 dígitos do CNPJ", variant: "destructive" });
      return;
    }
    setCnpjLookupLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('consulta-cnpj', { body: { cnpj: clean } });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setNewEmpresa(prev => ({
        ...prev,
        nome: data.razao_social || prev.nome,
        nome_fantasia: data.nome_fantasia || prev.nome_fantasia,
        segmento: data.segmento || prev.segmento,
        endereco: data.endereco || prev.endereco,
        email: prev.email || data.email || "",
      }));
      setCnpjLookupDone(true);
      toast({ title: "Dados preenchidos automaticamente!", description: "Confira e complete os campos restantes." });
    } catch (err: any) {
      toast({ title: "Erro ao buscar CNPJ", description: err.message, variant: "destructive" });
    } finally {
      setCnpjLookupLoading(false);
    }
  };

  const resetCreateForm = () => {
    setNewEmpresa({ cnpj: "", nome: "", email: "", password: "", nome_fantasia: "", segmento: "", endereco: "", numero_funcionarios: "" });
    setCnpjLookupDone(false);
  };

  const handleCreateEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: newEmpresa.email,
          password: newEmpresa.password,
          nome: newEmpresa.nome,
          tipo_usuario: "empresa",
          extra: {
            cnpj: newEmpresa.cnpj.replace(/\D/g, ''),
            nome_fantasia: newEmpresa.nome_fantasia,
            segmento: newEmpresa.segmento,
            endereco: newEmpresa.endereco,
            numero_funcionarios: newEmpresa.numero_funcionarios ? parseInt(newEmpresa.numero_funcionarios) : null,
          },
        },
      });
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: "Empresa cadastrada com sucesso!" });
      setCreateOpen(false);
      resetCreateForm();
      fetchEmpresas();
    } catch (err: any) {
      toast({ title: "Erro ao cadastrar", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  // Detail derived stats
  const projetosAtivos = empresaProjetos.filter(p => ACTIVE_STATUSES.includes(p.status));
  const projetosFinalizados = empresaProjetos.filter(p => p.status === "concluido");
  const valorTotalContratado = empresaProjetos.reduce((s, p) => s + p.valor_contratado, 0);

  return (
    <div>
      <PageHeader
        title="Empresas"
        description="Gerencie empresas cadastradas na plataforma"
        action={
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <UserPlus size={16} /> Nova Empresa
          </Button>
        }
      />

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            placeholder="Buscar por razão social, CNPJ ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="stat-card p-4 flex items-center gap-4">
          <div className="icon-container icon-container-md bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-foreground">{empresas.length}</p>
            <p className="text-xs text-muted-foreground">Total de empresas</p>
          </div>
        </div>
        <div className="stat-card p-4 flex items-center gap-4">
          <div className="icon-container icon-container-md bg-success/10">
            <Users className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-foreground">
              {empresas.filter(e => e.profile?.status === "ativo").length}
            </p>
            <p className="text-xs text-muted-foreground">Empresas ativas</p>
          </div>
        </div>
        <div className="stat-card p-4 flex items-center gap-4">
          <div className="icon-container icon-container-md bg-info/10">
            <Globe className="h-5 w-5 text-info" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-foreground">
              {empresas.filter(e => e.cnpj).length}
            </p>
            <p className="text-xs text-muted-foreground">Com CNPJ verificado</p>
          </div>
        </div>
      </div>

      {/* List */}
      <DataCard noPadding>
        {loading ? <LoadingState /> : filtered.length === 0 ? (
          <EmptyState message={search ? "Nenhuma empresa encontrada" : "Nenhuma empresa cadastrada"} icon={Building2} />
        ) : (
          <div className="divide-y divide-border/60">
            {filtered.map((empresa) => (
              <div
                key={empresa.id}
                className="flex items-center justify-between p-4 px-5 table-row-interactive cursor-pointer"
                onClick={() => openDetail(empresa)}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="icon-container icon-container-md bg-accent/10 flex-shrink-0">
                    <Building2 size={18} className="text-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {empresa.nome_fantasia || empresa.razao_social}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {empresa.cnpj ? formatCnpj(empresa.cnpj) : "CNPJ não informado"}
                      {empresa.segmento && ` · ${empresa.segmento}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Badge variant="secondary" className="text-[11px]">
                    {empresa.projetos_count} projeto{empresa.projetos_count !== 1 ? "s" : ""}
                  </Badge>
                  <Badge variant="outline" className="text-[11px] gap-1">
                    <Users size={11} />
                    {empresa.usuarios_count} usuário{empresa.usuarios_count !== 1 ? "s" : ""}
                  </Badge>
                  <StatusBadge status={empresa.profile?.status || "ativo"} labels={{ ativo: "Ativa", inativo: "Inativa" }} />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                    <Eye size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DataCard>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg flex items-center gap-2">
              <Building2 size={20} className="text-primary" />
              {selectedEmpresa?.nome_fantasia || selectedEmpresa?.razao_social}
            </DialogTitle>
          </DialogHeader>

          {selectedEmpresa && (
            <Tabs defaultValue="dados" className="mt-2">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="usuarios" className="gap-1.5">
                  <Users size={13} /> Usuários ({empresaUsers.length})
                </TabsTrigger>
                <TabsTrigger value="ativos" className="gap-1.5">
                  <Briefcase size={13} /> Ativos ({projetosAtivos.length})
                </TabsTrigger>
                <TabsTrigger value="finalizados" className="gap-1.5">
                  <CheckCircle2 size={13} /> Finalizados ({projetosFinalizados.length})
                </TabsTrigger>
              </TabsList>

              {/* Tab: Dados */}
              <TabsContent value="dados" className="space-y-6 pt-4">
                <div>
                  <SectionTitle>Dados na plataforma</SectionTitle>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoItem label="Razão Social" value={selectedEmpresa.razao_social} />
                    <InfoItem label="Nome Fantasia" value={selectedEmpresa.nome_fantasia} />
                    <InfoItem label="CNPJ" value={selectedEmpresa.cnpj ? formatCnpj(selectedEmpresa.cnpj) : null} />
                    <InfoItem label="Segmento" value={selectedEmpresa.segmento} />
                    <InfoItem label="Endereço" value={selectedEmpresa.endereco} />
                    <InfoItem label="Inscrição Estadual" value={selectedEmpresa.inscricao_estadual} />
                    <InfoItem label="Nº Funcionários" value={selectedEmpresa.numero_funcionarios?.toString()} />
                    <InfoItem label="Total de Projetos" value={`${empresaProjetos.length} projeto(s)`} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <SectionTitle>Dados da Receita Federal</SectionTitle>
                    {selectedEmpresa.cnpj && (
                      <Button variant="outline" size="sm" onClick={() => consultarCnpj(selectedEmpresa.cnpj!)} disabled={cnpjLoading}>
                        <RefreshCw size={14} className={cnpjLoading ? "animate-spin" : ""} />
                        {cnpjLoading ? "Consultando..." : "Atualizar"}
                      </Button>
                    )}
                  </div>

                  {!selectedEmpresa.cnpj ? (
                    <p className="text-sm text-muted-foreground bg-muted/50 rounded-xl p-4 text-center">CNPJ não informado pela empresa</p>
                  ) : cnpjLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="ml-3 text-sm text-muted-foreground">Consultando Receita Federal...</span>
                    </div>
                  ) : cnpjData ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <InfoItem label="Razão Social (RF)" value={cnpjData.razao_social} highlight />
                      <InfoItem label="Nome Fantasia (RF)" value={cnpjData.nome_fantasia} highlight />
                      <InfoItem label="Situação Cadastral" value={cnpjData.situacao_cadastral} highlight />
                      <InfoItem label="Porte" value={cnpjData.porte} highlight />
                      <InfoItem label="Natureza Jurídica" value={cnpjData.natureza_juridica} highlight />
                      <InfoItem label="Capital Social" value={cnpjData.capital_social ? formatCurrency(cnpjData.capital_social) : null} highlight />
                      <InfoItem label="CNAE / Atividade" value={cnpjData.segmento} highlight />
                      <InfoItem label="Data de Abertura" value={cnpjData.data_abertura} highlight />
                      <InfoItem label="Endereço (RF)" value={cnpjData.endereco} highlight className="sm:col-span-2" />
                      <InfoItem label="Telefone (RF)" value={cnpjData.telefone} highlight />
                      <InfoItem label="E-mail (RF)" value={cnpjData.email} highlight />
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/60">
                  <Calendar size={12} /> Cadastrada em {new Date(selectedEmpresa.created_at).toLocaleDateString("pt-BR")}
                </div>
              </TabsContent>

              {/* Tab: Usuários */}
              <TabsContent value="usuarios" className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Vincule múltiplos usuários com papéis distintos (responsável, financeiro, operacional).
                  </p>
                  <Button size="sm" onClick={() => setAddUserOpen(true)} className="gap-1.5">
                    <Plus size={14} /> Vincular usuário
                  </Button>
                </div>

                {detailLoading ? <LoadingState /> : empresaUsers.length === 0 ? (
                  <EmptyState message="Nenhum usuário vinculado" icon={Users} />
                ) : (
                  <div className="space-y-2">
                    {empresaUsers.map((u) => {
                      const Icon = PAPEL_ICONS[u.papel];
                      return (
                        <div key={u.id} className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="icon-container icon-container-md bg-primary/10">
                              <Icon size={16} className="text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {u.profile?.nome || "Usuário sem perfil"}
                                {u.isOwner && <span className="ml-2 text-[10px] uppercase tracking-wider text-primary font-semibold">Dono</span>}
                              </p>
                              <p className="text-xs text-muted-foreground truncate flex items-center gap-2">
                                <Mail size={11} /> {u.profile?.email || "—"}
                                {u.profile?.telefone && (<><span>·</span><Phone size={11} /> {u.profile.telefone}</>)}
                              </p>
                              {u.observacoes && (
                                <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5">{u.observacoes}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <Icon size={10} /> {PAPEL_LABELS[u.papel]}
                            </Badge>
                            <StatusBadge status={u.profile?.status || "ativo"} labels={{ ativo: "Ativo", inativo: "Inativo" }} />
                            {!u.isOwner && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleRemoveUserLink(u.id)}>
                                <Trash2 size={14} />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* Tab: Projetos Ativos */}
              <TabsContent value="ativos" className="pt-4">
                <ProjetosList
                  projetos={projetosAtivos}
                  loading={detailLoading}
                  emptyMessage="Nenhum projeto ativo no momento"
                  totalLabel="Valor contratado em projetos ativos"
                />
              </TabsContent>

              {/* Tab: Projetos Finalizados */}
              <TabsContent value="finalizados" className="pt-4">
                <ProjetosList
                  projetos={projetosFinalizados}
                  loading={detailLoading}
                  emptyMessage="Nenhum projeto finalizado ainda"
                  totalLabel="Valor total contratado em projetos finalizados"
                />
                {projetosFinalizados.length > 0 && (
                  <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <DollarSign size={16} className="text-primary" />
                      Valor total contratado (todos os projetos)
                    </div>
                    <span className="text-base font-display font-bold text-primary">{formatCurrency(valorTotalContratado)}</span>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Empresa Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreateForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <UserPlus size={18} className="text-primary" />
              Cadastrar Empresa
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateEmpresa} className="space-y-4 pt-2">
            {/* CNPJ FIRST with auto-lookup */}
            <div className="space-y-2">
              <Label htmlFor="e-cnpj">CNPJ * <span className="text-[11px] text-muted-foreground font-normal">(busca automática na Receita Federal)</span></Label>
              <div className="flex gap-2">
                <Input
                  id="e-cnpj"
                  required
                  value={newEmpresa.cnpj}
                  onChange={(e) => { setNewEmpresa({ ...newEmpresa, cnpj: maskCnpjInput(e.target.value) }); setCnpjLookupDone(false); }}
                  placeholder="00.000.000/0000-00"
                />
                <Button type="button" variant="outline" onClick={handleCnpjLookupForCreate} disabled={cnpjLookupLoading || newEmpresa.cnpj.replace(/\D/g, '').length !== 14} className="flex-shrink-0">
                  {cnpjLookupLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  {cnpjLookupLoading ? "Buscando..." : "Buscar"}
                </Button>
              </div>
              {cnpjLookupDone && (
                <p className="text-[11px] text-success flex items-center gap-1">
                  <CheckCircle2 size={11} /> Dados preenchidos automaticamente
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="e-nome">Razão Social *</Label>
              <Input id="e-nome" required value={newEmpresa.nome} onChange={(e) => setNewEmpresa({ ...newEmpresa, nome: e.target.value })} placeholder="Razão social da empresa" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-fantasia">Nome Fantasia</Label>
              <Input id="e-fantasia" value={newEmpresa.nome_fantasia} onChange={(e) => setNewEmpresa({ ...newEmpresa, nome_fantasia: e.target.value })} placeholder="Nome fantasia" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="e-email">E-mail *</Label>
                <Input id="e-email" type="email" required value={newEmpresa.email} onChange={(e) => setNewEmpresa({ ...newEmpresa, email: e.target.value })} placeholder="empresa@email.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-password">Senha *</Label>
                <Input id="e-password" type="password" required minLength={6} value={newEmpresa.password} onChange={(e) => setNewEmpresa({ ...newEmpresa, password: e.target.value })} placeholder="Mínimo 6 chars" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-segmento">Segmento</Label>
              <Input id="e-segmento" value={newEmpresa.segmento} onChange={(e) => setNewEmpresa({ ...newEmpresa, segmento: e.target.value })} placeholder="Tecnologia" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="e-end">Endereço</Label>
                <Input id="e-end" value={newEmpresa.endereco} onChange={(e) => setNewEmpresa({ ...newEmpresa, endereco: e.target.value })} placeholder="Endereço completo" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-func">Nº Funcionários</Label>
                <Input id="e-func" type="number" value={newEmpresa.numero_funcionarios} onChange={(e) => setNewEmpresa({ ...newEmpresa, numero_funcionarios: e.target.value })} placeholder="50" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={creating}>{creating ? "Cadastrando..." : "Cadastrar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add User Link Dialog */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <UserPlus size={18} className="text-primary" />
              Vincular usuário à empresa
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddUserLink} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="link-email">E-mail do usuário *</Label>
              <Input
                id="link-email"
                type="email"
                required
                value={newLink.email}
                onChange={(e) => setNewLink({ ...newLink, email: e.target.value })}
                placeholder="usuario@empresa.com"
              />
              <p className="text-[11px] text-muted-foreground">O usuário precisa já ter cadastro na plataforma.</p>
            </div>
            <div className="space-y-2">
              <Label>Papel na empresa *</Label>
              <Select value={newLink.papel} onValueChange={(v) => setNewLink({ ...newLink, papel: v as PapelEmpresa })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="responsavel">Responsável</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="operacional">Operacional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-obs">Observações</Label>
              <Input
                id="link-obs"
                value={newLink.observacoes}
                onChange={(e) => setNewLink({ ...newLink, observacoes: e.target.value })}
                placeholder="Ex: contato para faturamento"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setAddUserOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={addingUser}>
                {addingUser ? <><Loader2 size={14} className="animate-spin mr-1.5" />Vinculando...</> : "Vincular"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ProjetosList = ({ projetos, loading, emptyMessage, totalLabel }: {
  projetos: ProjetoEmpresa[]; loading: boolean; emptyMessage: string; totalLabel: string;
}) => {
  const total = projetos.reduce((s, p) => s + p.valor_contratado, 0);
  if (loading) return <LoadingState />;
  if (projetos.length === 0) return <EmptyState message={emptyMessage} icon={Briefcase} />;
  return (
    <div className="space-y-2">
      {projetos.map((p) => (
        <div key={p.id} className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card">
          <div className="flex items-center gap-3 min-w-0">
            <div className="icon-container icon-container-md bg-accent/10">
              <Briefcase size={16} className="text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{p.nome}</p>
              <p className="text-xs text-muted-foreground truncate">
                {p.protocolo || "Sem protocolo"} · {new Date(p.created_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {p.valor_contratado > 0 ? formatCurrency(p.valor_contratado) : <span className="text-muted-foreground font-normal">—</span>}
            </span>
            <StatusBadge status={p.status} labels={STATUS_LABELS} />
          </div>
        </div>
      ))}
      <div className="mt-3 p-3 rounded-xl bg-muted/40 flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">{totalLabel}</span>
        <span className="text-sm font-display font-bold text-foreground">{formatCurrency(total)}</span>
      </div>
    </div>
  );
};

const InfoItem = ({ label, value, icon, highlight, className }: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
  highlight?: boolean;
  className?: string;
}) => (
  <div className={`${highlight ? "bg-primary/5 border border-primary/10" : "bg-muted/40"} rounded-xl p-3 ${className || ""}`}>
    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 flex items-center gap-1.5">
      {icon} {label}
    </p>
    <p className="text-sm font-medium text-foreground">{value || "—"}</p>
  </div>
);

export default AdminEmpresas;
