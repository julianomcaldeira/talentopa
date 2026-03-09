import { useState, useEffect } from "react";
import { Building2, Search, MapPin, Phone, Mail, Globe, Users, Calendar, Eye, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, DataCard, EmptyState, LoadingState, StatusBadge, SectionTitle } from "@/components/dashboard/DashboardComponents";
import { Badge } from "@/components/ui/badge";

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

const formatCnpj = (cnpj: string) => {
  const c = cnpj.replace(/\D/g, '');
  if (c.length !== 14) return cnpj;
  return `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12)}`;
};

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const AdminEmpresas = () => {
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaRow | null>(null);
  const [cnpjData, setCnpjData] = useState<CnpjData | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
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

    // Fetch profiles and project counts
    const userIds = empresaData.map(e => e.user_id);
    const [profilesRes, projetosRes] = await Promise.all([
      supabase.from("profiles").select("*").in("user_id", userIds),
      supabase.from("projetos").select("id, empresa_user_id").in("empresa_user_id", userIds),
    ]);

    const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
    const projetoCountMap = new Map<string, number>();
    (projetosRes.data || []).forEach(p => {
      projetoCountMap.set(p.empresa_user_id, (projetoCountMap.get(p.empresa_user_id) || 0) + 1);
    });

    const enriched: EmpresaRow[] = empresaData.map(e => ({
      ...e,
      profile: profileMap.get(e.user_id) as any,
      projetos_count: projetoCountMap.get(e.user_id) || 0,
    }));

    setEmpresas(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchEmpresas(); }, []);

  const consultarCnpj = async (cnpj: string) => {
    setCnpjLoading(true);
    setCnpjData(null);
    try {
      const { data, error } = await supabase.functions.invoke('consulta-cnpj', {
        body: { cnpj },
      });
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

  const openDetail = (empresa: EmpresaRow) => {
    setSelectedEmpresa(empresa);
    setCnpjData(null);
    setDetailOpen(true);
    if (empresa.cnpj) {
      consultarCnpj(empresa.cnpj);
    }
  };

  const filtered = empresas.filter(e => {
    const term = search.toLowerCase();
    return !term || 
      e.razao_social.toLowerCase().includes(term) ||
      e.nome_fantasia?.toLowerCase().includes(term) ||
      e.cnpj?.includes(term) ||
      e.profile?.email.toLowerCase().includes(term);
  });

  return (
    <div>
      <PageHeader
        title="Empresas"
        description="Gerencie empresas cadastradas na plataforma"
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
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg flex items-center gap-2">
              <Building2 size={20} className="text-primary" />
              {selectedEmpresa?.nome_fantasia || selectedEmpresa?.razao_social}
            </DialogTitle>
          </DialogHeader>

          {selectedEmpresa && (
            <div className="space-y-6 pt-2">
              {/* Platform data */}
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
                  <InfoItem label="Projetos" value={`${selectedEmpresa.projetos_count} projeto(s)`} />
                </div>
              </div>

              {/* Contact */}
              {selectedEmpresa.profile && (
                <div>
                  <SectionTitle>Contato</SectionTitle>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoItem label="Responsável" value={selectedEmpresa.profile.nome} icon={<Users size={14} />} />
                    <InfoItem label="E-mail" value={selectedEmpresa.profile.email} icon={<Mail size={14} />} />
                    <InfoItem label="Telefone" value={selectedEmpresa.profile.telefone} icon={<Phone size={14} />} />
                    <InfoItem label="Localização" value={
                      [selectedEmpresa.profile.cidade, selectedEmpresa.profile.estado].filter(Boolean).join(" - ") || null
                    } icon={<MapPin size={14} />} />
                  </div>
                </div>
              )}

              {/* Receita Federal */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <SectionTitle>Dados da Receita Federal</SectionTitle>
                  {selectedEmpresa.cnpj && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => consultarCnpj(selectedEmpresa.cnpj!)}
                      disabled={cnpjLoading}
                    >
                      <RefreshCw size={14} className={cnpjLoading ? "animate-spin" : ""} />
                      {cnpjLoading ? "Consultando..." : "Consultar"}
                    </Button>
                  )}
                </div>

                {!selectedEmpresa.cnpj ? (
                  <p className="text-sm text-muted-foreground bg-muted/50 rounded-xl p-4 text-center">
                    CNPJ não informado pela empresa
                  </p>
                ) : cnpjLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
                ) : (
                  <p className="text-sm text-muted-foreground bg-muted/50 rounded-xl p-4 text-center">
                    Clique em "Consultar" para buscar dados da Receita Federal
                  </p>
                )}
              </div>

              {/* Registration date */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/60">
                <Calendar size={12} />
                Cadastrada em {new Date(selectedEmpresa.created_at).toLocaleDateString("pt-BR")}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
