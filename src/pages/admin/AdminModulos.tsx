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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Módulos</h1>
          <p className="text-muted-foreground mt-1">Gerencie módulos dos softwares ERP</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ nome: "", descricao: "", software_id: "" }); setDialogOpen(true); }}>
          <Plus size={16} className="mr-2" /> Novo Módulo
        </Button>
      </div>

      <div className="bg-card rounded-xl shadow-card border border-border">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : modulos.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhum módulo cadastrado</div>
        ) : (
          <div className="divide-y divide-border">
            {modulos.map((mod) => (
              <div key={mod.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                <div>
                  <p className="font-medium text-foreground">{mod.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {mod.softwares?.nome} {mod.descricao && `• ${mod.descricao}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => {
                    setEditing(mod);
                    setForm({ nome: mod.nome, descricao: mod.descricao || "", software_id: mod.software_id });
                    setDialogOpen(true);
                  }}>
                    <Pencil size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(mod.id)}>
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
            <DialogTitle className="font-display">{editing ? "Editar Módulo" : "Novo Módulo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Software ERP</Label>
              <Select value={form.software_id} onValueChange={(v) => setForm({ ...form, software_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o software" /></SelectTrigger>
                <SelectContent>
                  {softwares.map((sw) => (
                    <SelectItem key={sw.id} value={sw.id}>{sw.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome do Módulo</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Financeiro" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
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
