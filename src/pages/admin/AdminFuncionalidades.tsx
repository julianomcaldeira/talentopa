import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AdminFuncionalidades = () => {
  const [funcionalidades, setFuncionalidades] = useState<any[]>([]);
  const [softwares, setSoftwares] = useState<any[]>([]);
  const [modulos, setModulos] = useState<any[]>([]);
  const [filteredModulos, setFilteredModulos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selectedSoftware, setSelectedSoftware] = useState("");
  const [form, setForm] = useState({ nome: "", descricao: "", modulo_id: "", horas_media_estimadas: "" });
  const { toast } = useToast();

  const fetchData = async () => {
    const [funcRes, softRes, modRes] = await Promise.all([
      supabase.from("funcionalidades").select("*, modulos(nome, software_id, softwares(nome))").order("nome"),
      supabase.from("softwares").select("id, nome").order("nome"),
      supabase.from("modulos").select("id, nome, software_id").order("nome"),
    ]);
    if (funcRes.data) setFuncionalidades(funcRes.data);
    if (softRes.data) setSoftwares(softRes.data);
    if (modRes.data) setModulos(modRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    setFilteredModulos(selectedSoftware ? modulos.filter(m => m.software_id === selectedSoftware) : modulos);
  }, [selectedSoftware, modulos]);

  const handleSave = async () => {
    const payload = {
      nome: form.nome,
      descricao: form.descricao || null,
      modulo_id: form.modulo_id,
      horas_media_estimadas: form.horas_media_estimadas ? Number(form.horas_media_estimadas) : 0,
    };
    if (editing) {
      const { error } = await supabase.from("funcionalidades").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Funcionalidade atualizada!" });
    } else {
      const { error } = await supabase.from("funcionalidades").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Funcionalidade criada!" });
    }
    setDialogOpen(false); setEditing(null);
    setForm({ nome: "", descricao: "", modulo_id: "", horas_media_estimadas: "" });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("funcionalidades").delete().eq("id", id);
    toast({ title: "Funcionalidade removida!" }); fetchData();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Funcionalidades</h1>
          <p className="text-muted-foreground mt-1">Gerencie funcionalidades dos módulos</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ nome: "", descricao: "", modulo_id: "", horas_media_estimadas: "" }); setSelectedSoftware(""); setDialogOpen(true); }}>
          <Plus size={16} className="mr-2" /> Nova Funcionalidade
        </Button>
      </div>

      <div className="bg-card rounded-xl shadow-card border border-border">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : funcionalidades.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhuma funcionalidade cadastrada</div>
        ) : (
          <div className="divide-y divide-border">
            {funcionalidades.map((func) => (
              <div key={func.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                <div>
                  <p className="font-medium text-foreground">{func.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {func.modulos?.softwares?.nome} → {func.modulos?.nome}
                    {func.horas_media_estimadas ? ` • ${func.horas_media_estimadas}h estimadas` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => {
                    setEditing(func);
                    setSelectedSoftware(func.modulos?.software_id || "");
                    setForm({
                      nome: func.nome,
                      descricao: func.descricao || "",
                      modulo_id: func.modulo_id,
                      horas_media_estimadas: func.horas_media_estimadas?.toString() || "",
                    });
                    setDialogOpen(true);
                  }}>
                    <Pencil size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(func.id)}>
                    <Trash2 size={16} className="text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Editar Funcionalidade" : "Nova Funcionalidade"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Software ERP</Label>
              <Select value={selectedSoftware} onValueChange={(v) => { setSelectedSoftware(v); setForm({ ...form, modulo_id: "" }); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o software" /></SelectTrigger>
                <SelectContent>
                  {softwares.map((sw) => <SelectItem key={sw.id} value={sw.id}>{sw.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Módulo</Label>
              <Select value={form.modulo_id} onValueChange={(v) => setForm({ ...form, modulo_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o módulo" /></SelectTrigger>
                <SelectContent>
                  {filteredModulos.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Parametrização fiscal" />
            </div>
            <div className="space-y-2">
              <Label>Horas Médias Estimadas</Label>
              <Input type="number" value={form.horas_media_estimadas} onChange={(e) => setForm({ ...form, horas_media_estimadas: e.target.value })} placeholder="Ex: 40" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <Button className="w-full" onClick={handleSave} disabled={!form.nome || !form.modulo_id}>
              {editing ? "Salvar" : "Criar funcionalidade"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFuncionalidades;
