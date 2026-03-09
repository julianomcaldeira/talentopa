import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Software {
  id: string;
  nome: string;
  descricao: string | null;
  empresa_desenvolvedora: string | null;
}

const AdminSoftwares = () => {
  const [softwares, setSoftwares] = useState<Software[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Software | null>(null);
  const [form, setForm] = useState({ nome: "", descricao: "", empresa_desenvolvedora: "" });
  const { toast } = useToast();

  const fetchSoftwares = async () => {
    const { data, error } = await supabase.from("softwares").select("*").order("nome");
    if (data) setSoftwares(data);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    setLoading(false);
  };

  useEffect(() => { fetchSoftwares(); }, []);

  const handleSave = async () => {
    if (editing) {
      const { error } = await supabase.from("softwares").update(form).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Software atualizado!" });
    } else {
      const { error } = await supabase.from("softwares").insert(form);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Software criado!" });
    }
    setDialogOpen(false);
    setEditing(null);
    setForm({ nome: "", descricao: "", empresa_desenvolvedora: "" });
    fetchSoftwares();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("softwares").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Software removido!" });
    fetchSoftwares();
  };

  const openEdit = (sw: Software) => {
    setEditing(sw);
    setForm({ nome: sw.nome, descricao: sw.descricao || "", empresa_desenvolvedora: sw.empresa_desenvolvedora || "" });
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ nome: "", descricao: "", empresa_desenvolvedora: "" });
    setDialogOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Softwares ERP</h1>
          <p className="text-muted-foreground mt-1">Gerencie os sistemas ERP disponíveis</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} className="mr-2" /> Novo Software</Button>
      </div>

      <div className="bg-card rounded-xl shadow-card border border-border">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : softwares.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhum software cadastrado</div>
        ) : (
          <div className="divide-y divide-border">
            {softwares.map((sw) => (
              <div key={sw.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                <div>
                  <p className="font-medium text-foreground">{sw.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {sw.empresa_desenvolvedora && <span>{sw.empresa_desenvolvedora} • </span>}
                    {sw.descricao || "Sem descrição"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(sw)}>
                    <Pencil size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(sw.id)}>
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
            <DialogTitle className="font-display">{editing ? "Editar Software" : "Novo Software"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: TOTVS Protheus" />
            </div>
            <div className="space-y-2">
              <Label>Empresa Desenvolvedora</Label>
              <Input value={form.empresa_desenvolvedora} onChange={(e) => setForm({ ...form, empresa_desenvolvedora: e.target.value })} placeholder="Ex: TOTVS" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição do software" />
            </div>
            <Button className="w-full" onClick={handleSave} disabled={!form.nome}>
              {editing ? "Salvar alterações" : "Criar software"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSoftwares;
