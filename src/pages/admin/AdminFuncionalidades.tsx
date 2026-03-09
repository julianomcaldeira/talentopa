import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Cog, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, DataCard, EmptyState, LoadingState } from "@/components/dashboard/DashboardComponents";

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
      nome: form.nome, descricao: form.descricao || null, modulo_id: form.modulo_id,
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
      <PageHeader
        title="Funcionalidades"
        description="Gerencie funcionalidades dos módulos ERP"
        action={
          <Button onClick={() => { setEditing(null); setForm({ nome: "", descricao: "", modulo_id: "", horas_media_estimadas: "" }); setSelectedSoftware(""); setDialogOpen(true); }}>
            <Plus size={16} /> Nova Funcionalidade
          </Button>
        }
      />

      <DataCard noPadding>
        {loading ? <LoadingState /> : funcionalidades.length === 0 ? (
          <EmptyState message="Nenhuma funcionalidade cadastrada" icon={Cog} />
        ) : (
          <div className="divide-y divide-border/60">
            {funcionalidades.map((func) => (
              <div key={func.id} className="flex items-center justify-between p-4 px-5 table-row-interactive">
                <div className="flex items-center gap-3.5">
                  <div className="icon-container icon-container-md bg-info/8">
                    <Cog size={18} className="text-info" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{func.nome}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">
                        <span className="text-foreground/70">{func.modulos?.softwares?.nome}</span> → {func.modulos?.nome}
                      </p>
                      {func.horas_media_estimadas > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                          <Clock size={10} /> {func.horas_media_estimadas}h
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => {
                    setEditing(func); setSelectedSoftware(func.modulos?.software_id || "");
                    setForm({ nome: func.nome, descricao: func.descricao || "", modulo_id: func.modulo_id, horas_media_estimadas: func.horas_media_estimadas?.toString() || "" });
                    setDialogOpen(true);
                  }}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(func.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DataCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">{editing ? "Editar Funcionalidade" : "Nova Funcionalidade"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Software ERP</Label>
              <Select value={selectedSoftware} onValueChange={(v) => { setSelectedSoftware(v); setForm({ ...form, modulo_id: "" }); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{softwares.map((sw) => <SelectItem key={sw.id} value={sw.id}>{sw.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Módulo</Label>
              <Select value={form.modulo_id} onValueChange={(v) => setForm({ ...form, modulo_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{filteredModulos.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Parametrização fiscal" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Horas médias estimadas</Label>
              <Input type="number" value={form.horas_media_estimadas} onChange={(e) => setForm({ ...form, horas_media_estimadas: e.target.value })} placeholder="40" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} />
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
