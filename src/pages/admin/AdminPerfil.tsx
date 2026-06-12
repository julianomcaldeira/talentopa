import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, DataCard, SectionTitle, LoadingState } from "@/components/dashboard/DashboardComponents";
import AvatarUpload from "@/components/profile/AvatarUpload";
import ChangePasswordCard from "@/components/profile/ChangePasswordCard";
import { UserCog } from "lucide-react";
import { EstadoSelect } from "@/components/forms/EstadoSelect";

const AdminPerfil = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    cidade: "",
    estado: "",
    avatar_url: "" as string | null,
  });

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
      if (data) {
        setForm({
          nome: data.nome || "",
          email: data.email || "",
          telefone: data.telefone || "",
          cidade: data.cidade || "",
          estado: data.estado || "",
          avatar_url: data.avatar_url,
        });
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const salvar = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        nome: form.nome,
        telefone: form.telefone || null,
        cidade: form.cidade || null,
        estado: form.estado || null,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Perfil atualizado" });
  };

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Meu perfil" description="Atualize seus dados, sua foto e sua senha." />

      <DataCard>
        <div className="flex items-center gap-2 mb-5">
          <UserCog size={16} className="text-muted-foreground" />
          <SectionTitle>Dados pessoais</SectionTitle>
        </div>
        <div className="flex items-start gap-5 mb-6">
          <AvatarUpload
            currentUrl={form.avatar_url}
            nome={form.nome || profile?.nome}
            onUploaded={(url) => setForm((f) => ({ ...f, avatar_url: url }))}
          />
          <div className="text-sm text-muted-foreground pt-2">
            <p className="font-medium text-foreground">{form.nome || "Administrador"}</p>
            <p>{form.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">E-mail</Label>
            <Input value={form.email} disabled />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Telefone</Label>
            <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cidade</Label>
              <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estado</Label>
              <EstadoSelect value={form.estado} onChange={(uf) => setForm({ ...form, estado: uf })} />
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Button>
        </div>
      </DataCard>

      <ChangePasswordCard />
    </div>
  );
};

export default AdminPerfil;
