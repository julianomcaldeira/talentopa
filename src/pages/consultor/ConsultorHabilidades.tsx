import { useState, useEffect } from "react";
import { Plus, Trash2, Star, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, DataCard, EmptyState, LoadingState } from "@/components/dashboard/DashboardComponents";

const niveisLabels: Record<string, string> = {
  junior: "Júnior", pleno: "Pleno", senior: "Sênior", especialista: "Especialista"
};

const niveisColors: Record<string, string> = {
  junior: "badge-muted", pleno: "badge-info", senior: "badge-primary", especialista: "badge-success"
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
      user_id: user.id, software_id: form.software_id,
      modulo_id: form.modulo_id || null, funcionalidade_id: form.funcionalidade_id || null,
      nivel: form.nivel as any, valor_hora: form.valor_hora ? Number(form.valor_hora) : null,
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
      <PageHeader
        title="Minhas Habilidades"
        description="Informe suas especialidades técnicas em ERP para receber projetos compatíveis"
        action={
          <Button onClick={() => { setSelectedSoftware(""); setSelectedModulo(""); setForm({ software_id: "", modulo_id: "", funcionalidade_id: "", nivel: "pleno", valor_hora: "" }); setDialogOpen(true); }}>
            <Plus size={16} /> Adicionar
          </Button>
        }
      />

      {loading ? <DataCard><LoadingState /></DataCard> : habilidades.length === 0 ? (
        <DataCard><EmptyState message="Nenhuma habilidade cadastrada. Adicione suas especialidades!" icon={Star} /></DataCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {habilidades.map((hab) => (
            <DataCard key={hab.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3.5">
                  <div className="icon-container icon-container-md bg-primary/10 mt-0.5">
                    <Zap size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {hab.softwares?.nome}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {hab.modulos?.nome && `${hab.modulos.nome}`}
                      {hab.funcionalidades?.nome && ` → ${hab.funcionalidades.nome}`}
                    </p>
                    <div className="flex items-center gap-2 mt-2.5">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${niveisColors[hab.nivel] || "badge-muted"}`}>
                        {niveisLabels[hab.nivel] || hab.nivel}
                      </span>
                      {hab.valor_hora && (
                        <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                          R$ {hab.valor_hora}/h
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(hab.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </DataCard>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Adicionar Habilidade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Software ERP *</Label>
              <Select value={form.software_id} onValueChange={(v) => { setForm({ ...form, software_id: v, modulo_id: "", funcionalidade_id: "" }); setSelectedSoftware(v); setSelectedModulo(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{softwares.map(sw => <SelectItem key={sw.id} value={sw.id}>{sw.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {selectedSoftware && filteredModulos.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Módulo</Label>
                <Select value={form.modulo_id} onValueChange={(v) => { setForm({ ...form, modulo_id: v, funcionalidade_id: "" }); setSelectedModulo(v); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                  <SelectContent>{filteredModulos.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {selectedModulo && filteredFuncs.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Funcionalidade</Label>
                <Select value={form.funcionalidade_id} onValueChange={(v) => setForm({ ...form, funcionalidade_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                  <SelectContent>{filteredFuncs.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Senioridade</Label>
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
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor/hora (R$)</Label>
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
