import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const ConsultorPerfil = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    nome: "", telefone: "", cidade: "", estado: "", linkedin: "", bio_profissional: "",
  });

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: cp } = await supabase.from("consultor_perfil").select("*").eq("user_id", user.id).single();
      setProfileForm({
        nome: profile?.nome || "",
        telefone: profile?.telefone || "",
        cidade: profile?.cidade || "",
        estado: profile?.estado || "",
        linkedin: cp?.linkedin || "",
        bio_profissional: cp?.bio_profissional || "",
      });
      setLoading(false);
    };
    fetch();
  }, [user, profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from("profiles").update({
      nome: profileForm.nome,
      telefone: profileForm.telefone,
      cidade: profileForm.cidade,
      estado: profileForm.estado,
    }).eq("user_id", user.id);

    await supabase.from("consultor_perfil").update({
      linkedin: profileForm.linkedin,
      bio_profissional: profileForm.bio_profissional,
    }).eq("user_id", user.id);

    toast({ title: "Perfil atualizado!" });
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-foreground mb-2">Meu Perfil</h1>
      <p className="text-muted-foreground mb-8">Mantenha seu perfil atualizado para receber melhores oportunidades</p>

      <div className="bg-card rounded-xl p-6 shadow-card border border-border max-w-2xl space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input value={profileForm.nome} onChange={(e) => setProfileForm({ ...profileForm, nome: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={profileForm.telefone} onChange={(e) => setProfileForm({ ...profileForm, telefone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input value={profileForm.cidade} onChange={(e) => setProfileForm({ ...profileForm, cidade: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Input value={profileForm.estado} onChange={(e) => setProfileForm({ ...profileForm, estado: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>LinkedIn</Label>
          <Input value={profileForm.linkedin} onChange={(e) => setProfileForm({ ...profileForm, linkedin: e.target.value })} placeholder="https://linkedin.com/in/seu-perfil" />
        </div>
        <div className="space-y-2">
          <Label>Bio profissional</Label>
          <Textarea value={profileForm.bio_profissional} onChange={(e) => setProfileForm({ ...profileForm, bio_profissional: e.target.value })} rows={4} placeholder="Descreva sua experiência e especialidades..." />
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar perfil"}
        </Button>
      </div>
    </div>
  );
};

export default ConsultorPerfil;
