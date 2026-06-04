import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, DataCard, LoadingState, SectionTitle } from "@/components/dashboard/DashboardComponents";
import { MapPin, Linkedin } from "lucide-react";
import AvatarUpload from "@/components/profile/AvatarUpload";
import ChangePasswordCard from "@/components/profile/ChangePasswordCard";
import { maskPhone, unmask } from "@/lib/cnpjMask";

const ConsultorPerfil = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    nome: "", telefone: "", cidade: "", estado: "", linkedin: "", bio_profissional: "",
  });

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: cp } = await supabase.from("consultor_perfil").select("*").eq("user_id", user.id).single();
      setProfileForm({
        nome: profile?.nome || "", telefone: profile?.telefone || "",
        cidade: profile?.cidade || "", estado: profile?.estado || "",
        linkedin: cp?.linkedin || "", bio_profissional: cp?.bio_profissional || "",
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
      nome: profileForm.nome, telefone: profileForm.telefone, cidade: profileForm.cidade, estado: profileForm.estado,
    }).eq("user_id", user.id);
    await supabase.from("consultor_perfil").update({
      linkedin: profileForm.linkedin, bio_profissional: profileForm.bio_profissional,
    }).eq("user_id", user.id);
    toast({ title: "Perfil atualizado com sucesso!" });
    setSaving(false);
  };

  if (loading) return <DataCard><LoadingState /></DataCard>;

  return (
    <div>
      <PageHeader title="Meu Perfil" description="Mantenha seu perfil atualizado para melhores oportunidades" />

      <div className="max-w-3xl space-y-6">
        <DataCard>
          <div className="flex items-center gap-5 mb-6">
            <AvatarUpload currentUrl={avatarUrl} nome={profileForm.nome} onUploaded={setAvatarUrl} />
            <div>
              <h3 className="font-display font-bold text-lg text-foreground">{profileForm.nome || "Seu nome"}</h3>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              {profileForm.cidade && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1.5">
                  <MapPin size={12} /> {profileForm.cidade}{profileForm.estado && `, ${profileForm.estado}`}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome completo</Label>
              <Input value={profileForm.nome} onChange={(e) => setProfileForm({ ...profileForm, nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Telefone</Label>
              <Input value={profileForm.telefone} onChange={(e) => setProfileForm({ ...profileForm, telefone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cidade</Label>
              <Input value={profileForm.cidade} onChange={(e) => setProfileForm({ ...profileForm, cidade: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estado</Label>
              <Input value={profileForm.estado} onChange={(e) => setProfileForm({ ...profileForm, estado: e.target.value })} />
            </div>
          </div>
        </DataCard>

        <DataCard>
          <SectionTitle>Informações Profissionais</SectionTitle>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">LinkedIn</Label>
              <div className="relative">
                <Linkedin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                <Input className="pl-10" value={profileForm.linkedin} onChange={(e) => setProfileForm({ ...profileForm, linkedin: e.target.value })} placeholder="https://linkedin.com/in/seu-perfil" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bio profissional</Label>
              <Textarea value={profileForm.bio_profissional} onChange={(e) => setProfileForm({ ...profileForm, bio_profissional: e.target.value })} rows={5} placeholder="Descreva sua experiência, especialidades e diferenciais..." />
            </div>
          </div>
        </DataCard>

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

export default ConsultorPerfil;
