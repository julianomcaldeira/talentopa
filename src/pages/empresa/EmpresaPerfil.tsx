import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const EmpresaPerfil = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
        nome: profile?.nome || "",
        telefone: profile?.telefone || "",
        cidade: profile?.cidade || "",
        estado: profile?.estado || "",
        razao_social: ep?.razao_social || "",
        nome_fantasia: ep?.nome_fantasia || "",
        cnpj: ep?.cnpj || "",
        segmento: ep?.segmento || "",
        numero_funcionarios: ep?.numero_funcionarios?.toString() || "",
        endereco: ep?.endereco || "",
        inscricao_estadual: ep?.inscricao_estadual || "",
      });
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
      razao_social: form.razao_social,
      nome_fantasia: form.nome_fantasia,
      cnpj: form.cnpj,
      segmento: form.segmento,
      numero_funcionarios: form.numero_funcionarios ? Number(form.numero_funcionarios) : null,
      endereco: form.endereco,
      inscricao_estadual: form.inscricao_estadual,
    }).eq("user_id", user.id);

    toast({ title: "Perfil atualizado!" });
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-foreground mb-2">Perfil da Empresa</h1>
      <p className="text-muted-foreground mb-8">Dados cadastrais e fiscais</p>

      <div className="bg-card rounded-xl p-6 shadow-card border border-border max-w-3xl space-y-6">
        <h3 className="font-display font-semibold text-foreground">Dados Gerais</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Razão Social</Label><Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} /></div>
          <div className="space-y-2"><Label>Nome Fantasia</Label><Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} /></div>
          <div className="space-y-2"><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
          <div className="space-y-2"><Label>Segmento</Label><Input value={form.segmento} onChange={(e) => setForm({ ...form, segmento: e.target.value })} /></div>
          <div className="space-y-2"><Label>Nº Funcionários</Label><Input type="number" value={form.numero_funcionarios} onChange={(e) => setForm({ ...form, numero_funcionarios: e.target.value })} /></div>
          <div className="space-y-2"><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
        </div>

        <h3 className="font-display font-semibold text-foreground pt-4">Endereço</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2 md:col-span-3"><Label>Endereço completo</Label><Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} /></div>
          <div className="space-y-2"><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></div>
          <div className="space-y-2"><Label>Estado</Label><Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} /></div>
          <div className="space-y-2"><Label>Inscrição Estadual</Label><Input value={form.inscricao_estadual} onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })} /></div>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar perfil"}
        </Button>
      </div>
    </div>
  );
};

export default EmpresaPerfil;
