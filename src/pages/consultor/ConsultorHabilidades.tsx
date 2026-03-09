import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const niveisLabels: Record<string, string> = {
  junior: "Júnior", pleno: "Pleno", senior: "Sênior", especialista: "Especialista"
};

const ConsultorHabilidades = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [habilidades, setHabilidades] = useState<any[]>([]);
  const [softwares, setSoftwares] = useState<any[]>([]);
  const [modulos, setModulos] = useState<any[]>([]);
  const [funcionalidades, setFuncionalidades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSoftware, setSelectedSoftware] = useState("");
  const [selectedModulo, setSelectedModulo] = useState("");
  const [form, setForm] = useState({ software_id: "", modulo_id: "", funcionalidade_id: "", nivel: "pleno", valor_hora: "" });

  const fetchData = async () => {
    if (!user) return;
    const [habRes, swRes, modRes, funcRes] = await Promise.all([
      supabase.from("consultor_habilidades").select("*, softwares(nome), modulos(nome), funcionalidades(nome)").eq("user_id", user.id),
      supabase.from("softwares").select("id, nome").order("nome"),
      supabase.from("modulos").select("id, nome, software_id").order("nome"),
      supabase.from("funcionalidades").select("id, nome, modulo_id").order("nome"),
    ]);
    if (habRes.data) setHabilidades(habRes.data);
    if (swRes.data) setSoftwares(swRes.data);
    if (modRes.data) setModulos(modRes.data);
    if (funcRes.data) setFuncionalidades(funcRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const filteredModulos = modulos.filter(m => m.software_id === selectedSoftware);
  const filteredFuncs = funcionalidades.filter(f => f.modulo_id === selectedModulo);

  const handleSave = async () => {
    if (!user) return;
    const { error } = await supabase.from("consultor_habilidades").insert({
      user_id: user.id,
      software_id: form.software_id,
      modulo_id: form.modulo_id || null,
      funcionalidade_id: form.funcionalidade_id || null,
      nivel: form.nivel as any,
      valor_hora: form.valor_hora ? Number(form.valor_hora) : null,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Habilidade adicionada!" });
    setDialogOpen(false);
    setForm({ software_id: "", modulo_id: "", funcionalidade_id: "", nivel: "pleno", valor_hora: "" });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("consultor_habilidades").delete().eq("id", id);
    toast({ title: "Habilidade removida!" }); fetchData();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Minhas Habilidades</h1>
          <p className="text-muted-foreground mt-1">Informe suas especialidades técnicas em ERP</p>
        </div>
        <Button onClick={() => { setSelectedSoftware(""); setSelectedModulo(""); setForm({ software_id: "", modulo_id: "", funcionalidade_id: "", nivel: "pleno", valor_hora: "" }); setDialogOpen(true); }}>
          <Plus size={16} className="mr-2" /> Adicionar
        </Button>
      </div>

      <div className="bg-card rounded-xl shadow-card border border-border">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : habilidades.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhuma habilidade cadastrada. Adicione suas especialidades!</div>
        ) : (
          <div className="divide-y divide-border">
            {habilidades.map((hab) => (
              <div key={hab.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-foreground">
                    {hab.softwares?.nome}
                    {hab.modulos?.nome && ` → ${hab.modulos.nome}`}
                    {hab.funcionalidades?.nome && ` → ${hab.funcionalidades.nome}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {niveisLabels[hab.nivel] || hab.nivel}
                    {hab.valor_hora && ` • R$ ${hab.valor_hora}/h`}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(hab.id)}>
                  <Trash2 size={16} className="text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Adicionar Habilidade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Software ERP *</Label>
              <Select value={form.software_id} onValueChange={(v) => { setForm({ ...form, software_id: v, modulo_id: "", funcionalidade_id: "" }); setSelectedSoftware(v); setSelectedModulo(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{softwares.map(sw => <SelectItem key={sw.id} value={sw.id}>{sw.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {selectedSoftware && (
              <div className="space-y-2">
                <Label>Módulo (opcional)</Label>
                <Select value={form.modulo_id} onValueChange={(v) => { setForm({ ...form, modulo_id: v, funcionalidade_id: "" }); setSelectedModulo(v); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{filteredModulos.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {selectedModulo && (
              <div className="space-y-2">
                <Label>Funcionalidade (opcional)</Label>
                <Select value={form.funcionalidade_id} onValueChange={(v) => setForm({ ...form, funcionalidade_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{filteredFuncs.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nível de Senioridade</Label>
                <Select value={form.nivel} onValueChange={(v) => setForm({ ...form, nivel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="junior">Júnior</SelectItem>
                    <SelectItem value="pleno">Pleno</SelectItem>
                    <SelectItem value="senior">Sênior</SelectItem>
                    <SelectItem value="especialista">Especialista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor/hora (R$)</Label>
                <Input type="number" value={form.valor_hora} onChange={(e) => setForm({ ...form, valor_hora: e.target.value })} placeholder="150" />
              </div>
            </div>
            <Button className="w-full" onClick={handleSave} disabled={!form.software_id}>
              Adicionar habilidade
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConsultorHabilidades;
