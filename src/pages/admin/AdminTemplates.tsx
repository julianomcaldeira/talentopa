import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AdminTemplates = () => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [funcionalidades, setFuncionalidades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ nome: "", descricao: "" });
  const [selectedFuncs, setSelectedFuncs] = useState<string[]>([]);
  const { toast } = useToast();

  const fetchData = async () => {
    const [tplRes, funcRes] = await Promise.all([
      supabase.from("templates").select("*, template_funcionalidades(funcionalidade_id)").order("nome"),
      supabase.from("funcionalidades").select("id, nome, modulos(nome, softwares(nome))").order("nome"),
    ]);
    if (tplRes.data) setTemplates(tplRes.data);
    if (funcRes.data) setFuncionalidades(funcRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    let templateId = editing?.id;

    if (editing) {
      const { error } = await supabase.from("templates").update({ nome: form.nome, descricao: form.descricao || null }).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else {
      const { data, error } = await supabase.from("templates").insert({ nome: form.nome, descricao: form.descricao || null }).select("id").single();
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      templateId = data.id;
    }

    // Update funcionalidades
    await supabase.from("template_funcionalidades").delete().eq("template_id", templateId);
    if (selectedFuncs.length > 0) {
      await supabase.from("template_funcionalidades").insert(
        selectedFuncs.map(fid => ({ template_id: templateId, funcionalidade_id: fid }))
      );
    }

    toast({ title: editing ? "Template atualizado!" : "Template criado!" });
    setDialogOpen(false); setEditing(null); setForm({ nome: "", descricao: "" }); setSelectedFuncs([]);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("templates").delete().eq("id", id);
    toast({ title: "Template removido!" }); fetchData();
  };

  const toggleFunc = (id: string) => {
    setSelectedFuncs(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Templates de Implementação</h1>
          <p className="text-muted-foreground mt-1">Pacotes pré-definidos de funcionalidades</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ nome: "", descricao: "" }); setSelectedFuncs([]); setDialogOpen(true); }}>
          <Plus size={16} className="mr-2" /> Novo Template
        </Button>
      </div>

      <div className="bg-card rounded-xl shadow-card border border-border">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : templates.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhum template cadastrado</div>
        ) : (
          <div className="divide-y divide-border">
            {templates.map((tpl) => (
              <div key={tpl.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                <div>
                  <p className="font-medium text-foreground">{tpl.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {tpl.template_funcionalidades?.length || 0} funcionalidades
                    {tpl.descricao && ` • ${tpl.descricao}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => {
                    setEditing(tpl);
                    setForm({ nome: tpl.nome, descricao: tpl.descricao || "" });
                    setSelectedFuncs(tpl.template_funcionalidades?.map((tf: any) => tf.funcionalidade_id) || []);
                    setDialogOpen(true);
                  }}>
                    <Pencil size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(tpl.id)}>
                    <Trash2 size={16} className="text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Editar Template" : "Novo Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Implantação Financeira Completa" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Funcionalidades incluídas</Label>
              <div className="max-h-48 overflow-y-auto border border-border rounded-lg p-3 space-y-2">
                {funcionalidades.map((func) => (
                  <label key={func.id} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox checked={selectedFuncs.includes(func.id)} onCheckedChange={() => toggleFunc(func.id)} />
                    <span className="text-foreground">{func.nome}</span>
                    <span className="text-muted-foreground text-xs">
                      ({func.modulos?.softwares?.nome} → {func.modulos?.nome})
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={handleSave} disabled={!form.nome}>
              {editing ? "Salvar" : "Criar template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTemplates;
