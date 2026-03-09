import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, FileText, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, DataCard, EmptyState, LoadingState } from "@/components/dashboard/DashboardComponents";

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
    await supabase.from("template_funcionalidades").delete().eq("template_id", templateId);
    if (selectedFuncs.length > 0) {
      await supabase.from("template_funcionalidades").insert(selectedFuncs.map(fid => ({ template_id: templateId, funcionalidade_id: fid })));
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
      <PageHeader
        title="Templates de Implementação"
        description="Pacotes pré-definidos de funcionalidades para projetos"
        action={
          <Button onClick={() => { setEditing(null); setForm({ nome: "", descricao: "" }); setSelectedFuncs([]); setDialogOpen(true); }}>
            <Plus size={16} /> Novo Template
          </Button>
        }
      />

      {loading ? <DataCard><LoadingState /></DataCard> : templates.length === 0 ? (
        <DataCard><EmptyState message="Nenhum template cadastrado" icon={Package} /></DataCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <DataCard key={tpl.id}>
              <div className="flex items-start justify-between mb-3">
                <div className="icon-container icon-container-md bg-accent/10">
                  <Package size={18} className="text-accent" />
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => {
                    setEditing(tpl); setForm({ nome: tpl.nome, descricao: tpl.descricao || "" });
                    setSelectedFuncs(tpl.template_funcionalidades?.map((tf: any) => tf.funcionalidade_id) || []);
                    setDialogOpen(true);
                  }}>
                    <Pencil size={12} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(tpl.id)}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
              <h4 className="font-display font-semibold text-foreground text-[15px] mb-1">{tpl.nome}</h4>
              {tpl.descricao && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{tpl.descricao}</p>}
              <div className="flex items-center gap-2 mt-auto">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                  {tpl.template_funcionalidades?.length || 0} funcionalidades
                </span>
              </div>
            </DataCard>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">{editing ? "Editar Template" : "Novo Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Implantação Financeira Completa" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Funcionalidades ({selectedFuncs.length} selecionadas)</Label>
              <div className="max-h-48 overflow-y-auto border border-border rounded-xl p-3 space-y-1.5 custom-scrollbar">
                {funcionalidades.map((func) => (
                  <label key={func.id} className="flex items-center gap-2.5 cursor-pointer text-sm p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                    <Checkbox checked={selectedFuncs.includes(func.id)} onCheckedChange={() => toggleFunc(func.id)} />
                    <div>
                      <span className="text-foreground text-[13px]">{func.nome}</span>
                      <span className="text-muted-foreground text-[11px] block">
                        {func.modulos?.softwares?.nome} → {func.modulos?.nome}
                      </span>
                    </div>
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
