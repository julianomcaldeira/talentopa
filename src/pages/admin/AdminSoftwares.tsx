import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, DataCard, EmptyState, LoadingState } from "@/components/dashboard/DashboardComponents";

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
    setDialogOpen(false); setEditing(null); setForm({ nome: "", descricao: "", empresa_desenvolvedora: "" });
    fetchSoftwares();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("softwares").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Software removido!" }); fetchSoftwares();
  };

  const openEdit = (sw: Software) => {
    setEditing(sw);
    setForm({ nome: sw.nome, descricao: sw.descricao || "", empresa_desenvolvedora: sw.empresa_desenvolvedora || "" });
    setDialogOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Softwares ERP"
        description="Gerencie os sistemas ERP disponíveis na plataforma"
        action={
          <Button onClick={() => { setEditing(null); setForm({ nome: "", descricao: "", empresa_desenvolvedora: "" }); setDialogOpen(true); }}>
            <Plus size={16} /> Novo Software
          </Button>
        }
      />

      <DataCard noPadding>
        {loading ? <LoadingState /> : softwares.length === 0 ? (
          <EmptyState message="Nenhum software cadastrado" icon={Server} />
        ) : (
          <div className="divide-y divide-border/60">
            {softwares.map((sw) => (
              <div key={sw.id} className="flex items-center justify-between p-4 px-5 table-row-interactive">
                <div className="flex items-center gap-3.5">
                  <div className="icon-container icon-container-md bg-primary/8">
                    <Server size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{sw.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {sw.empresa_desenvolvedora && <span className="font-medium text-foreground/70">{sw.empresa_desenvolvedora}</span>}
                      {sw.empresa_desenvolvedora && sw.descricao && " · "}
                      {sw.descricao}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(sw)}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(sw.id)}>
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
            <DialogTitle className="font-display text-lg">{editing ? "Editar Software" : "Novo Software ERP"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: TOTVS Protheus" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Empresa Desenvolvedora</Label>
              <Input value={form.empresa_desenvolvedora} onChange={(e) => setForm({ ...form, empresa_desenvolvedora: e.target.value })} placeholder="Ex: TOTVS" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição do software" rows={3} />
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
