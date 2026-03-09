import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, DataCard, EmptyState, LoadingState } from "@/components/dashboard/DashboardComponents";

const AdminModulos = () => {
  const [modulos, setModulos] = useState<any[]>([]);
  const [softwares, setSoftwares] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ nome: "", descricao: "", software_id: "" });
  const { toast } = useToast();

  const fetchData = async () => {
    const [modulosRes, softwaresRes] = await Promise.all([
      supabase.from("modulos").select("*, softwares(nome)").order("nome"),
      supabase.from("softwares").select("id, nome").order("nome"),
    ]);
    if (modulosRes.data) setModulos(modulosRes.data);
    if (softwaresRes.data) setSoftwares(softwaresRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    const payload = { nome: form.nome, descricao: form.descricao || null, software_id: form.software_id };
    if (editing) {
      const { error } = await supabase.from("modulos").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Módulo atualizado!" });
    } else {
      const { error } = await supabase.from("modulos").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Módulo criado!" });
    }
    setDialogOpen(false); setEditing(null); setForm({ nome: "", descricao: "", software_id: "" });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("modulos").delete().eq("id", id);
    toast({ title: "Módulo removido!" }); fetchData();
  };

  return (
    <div>
      <PageHeader
        title="Módulos"
        description="Gerencie módulos dos softwares ERP"
        action={
          <Button onClick={() => { setEditing(null); setForm({ nome: "", descricao: "", software_id: "" }); setDialogOpen(true); }}>
            <Plus size={16} /> Novo Módulo
          </Button>
        }
      />

      <DataCard noPadding>
        {loading ? <LoadingState /> : modulos.length === 0 ? (
          <EmptyState message="Nenhum módulo cadastrado" icon={Puzzle} />
        ) : (
          <div className="divide-y divide-border/60">
            {modulos.map((mod) => (
              <div key={mod.id} className="flex items-center justify-between p-4 px-5 table-row-interactive">
                <div className="flex items-center gap-3.5">
                  <div className="icon-container icon-container-md bg-accent/8">
                    <Puzzle size={18} className="text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{mod.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/70">{mod.softwares?.nome}</span>
                      {mod.descricao && ` · ${mod.descricao}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => {
                    setEditing(mod); setForm({ nome: mod.nome, descricao: mod.descricao || "", software_id: mod.software_id }); setDialogOpen(true);
                  }}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(mod.id)}>
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
            <DialogTitle className="font-display text-lg">{editing ? "Editar Módulo" : "Novo Módulo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Software ERP</Label>
              <Select value={form.software_id} onValueChange={(v) => setForm({ ...form, software_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o software" /></SelectTrigger>
                <SelectContent>
                  {softwares.map((sw) => <SelectItem key={sw.id} value={sw.id}>{sw.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Financeiro" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} />
            </div>
            <Button className="w-full" onClick={handleSave} disabled={!form.nome || !form.software_id}>
              {editing ? "Salvar" : "Criar módulo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminModulos;
