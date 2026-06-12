import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, DataCard, LoadingState, SectionTitle } from "@/components/dashboard/DashboardComponents";
import { MapPin } from "lucide-react";
import AvatarUpload from "@/components/profile/AvatarUpload";
import ChangePasswordCard from "@/components/profile/ChangePasswordCard";
import ChangeEmailCard from "@/components/profile/ChangeEmailCard";
import { EstadoSelect } from "@/components/forms/EstadoSelect";

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</Label>
);

const EmpresaPerfil = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "", telefone: "", cidade: "", estado: "",
    razao_social: "", nome_fantasia: "", cnpj: "", segmento: "",
    numero_funcionarios: "", endereco: "", inscricao_estadual: "",
  });

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: ep } = await supabase.from("empresa_perfil").select("*").eq("user_id", user.id).single();
      setForm({
        nome: profile?.nome || "", telefone: profile?.telefone || "",
        cidade: profile?.cidade || "", estado: profile?.estado || "",
        razao_social: ep?.razao_social || "", nome_fantasia: ep?.nome_fantasia || "",
        cnpj: ep?.cnpj || "", segmento: ep?.segmento || "",
        numero_funcionarios: ep?.numero_funcionarios?.toString() || "",
        endereco: ep?.endereco || "", inscricao_estadual: ep?.inscricao_estadual || "",
      });
      setAvatarUrl(profile?.avatar_url || null);
      setLoading(false);
    };
    fetch();
  }, [user, profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from("profiles").update({
      nome: form.nome, telefone: form.telefone, cidade: form.cidade, estado: form.estado,
    }).eq("user_id", user.id);
    await supabase.from("empresa_perfil").update({
      razao_social: form.razao_social, nome_fantasia: form.nome_fantasia, cnpj: form.cnpj,
      segmento: form.segmento, numero_funcionarios: form.numero_funcionarios ? Number(form.numero_funcionarios) : null,
      endereco: form.endereco, inscricao_estadual: form.inscricao_estadual,
    }).eq("user_id", user.id);
    toast({ title: "Perfil atualizado com sucesso!" });
    setSaving(false);
  };

  if (loading) return <DataCard><LoadingState /></DataCard>;

  return (
    <div>
      <PageHeader title="Perfil da Empresa" description="Dados cadastrais e fiscais" />

      <div className="max-w-3xl space-y-6">
        <DataCard>
          <div className="flex items-center gap-4 mb-6">
            <AvatarUpload currentUrl={avatarUrl} nome={form.razao_social || form.nome} onUploaded={setAvatarUrl} />
            <div>
              <h3 className="font-display font-bold text-lg text-foreground">{form.razao_social || "Nome da empresa"}</h3>
              {form.nome_fantasia && <p className="text-sm text-muted-foreground">{form.nome_fantasia}</p>}
            </div>
          </div>

          <SectionTitle>Dados Gerais</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            <div className="space-y-2"><SectionLabel>Razão Social</SectionLabel><Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} /></div>
            <div className="space-y-2"><SectionLabel>Nome Fantasia</SectionLabel><Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} /></div>
            <div className="space-y-2"><SectionLabel>CNPJ</SectionLabel><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
            <div className="space-y-2"><SectionLabel>Segmento</SectionLabel><Input value={form.segmento} onChange={(e) => setForm({ ...form, segmento: e.target.value })} /></div>
            <div className="space-y-2"><SectionLabel>Nº Funcionários</SectionLabel><Input type="number" value={form.numero_funcionarios} onChange={(e) => setForm({ ...form, numero_funcionarios: e.target.value })} /></div>
            <div className="space-y-2"><SectionLabel>Telefone</SectionLabel><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
          </div>
        </DataCard>

        <DataCard>
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={16} className="text-muted-foreground" />
            <SectionTitle>Endereço e Dados Fiscais</SectionTitle>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-2 md:col-span-3"><SectionLabel>Endereço completo</SectionLabel><Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} /></div>
            <div className="space-y-2"><SectionLabel>Cidade</SectionLabel><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></div>
            <div className="space-y-2"><SectionLabel>Estado</SectionLabel><EstadoSelect value={form.estado} onChange={(uf) => setForm({ ...form, estado: uf })} /></div>
            <div className="space-y-2"><SectionLabel>Inscrição Estadual</SectionLabel><Input value={form.inscricao_estadual} onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })} /></div>
          </div>
        </DataCard>

        <ChangeEmailCard />

        <ChangePasswordCard />

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? "Salvando..." : "Salvar perfil"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EmpresaPerfil;
