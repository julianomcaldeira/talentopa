import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, DataCard, SectionTitle, LoadingState, EmptyState } from "@/components/dashboard/DashboardComponents";
import { Server, Puzzle, Cog, ChevronRight, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const AdminCatalogo = () => {
  const { toast } = useToast();
  const [softwares, setSoftwares] = useState<any[]>([]);
  const [modulos, setModulos] = useState<any[]>([]);
  const [funcionalidades, setFuncionalidades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSoftware, setSelectedSoftware] = useState<string | null>(null);
  const [selectedModulo, setSelectedModulo] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Dialog states
  const [dialogType, setDialogType] = useState<"software" | "modulo" | "funcionalidade" | null>(null);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    const fetchAll = async () => {
      const [sw, mod, func] = await Promise.all([
        supabase.from("softwares").select("*").order("nome"),
        supabase.from("modulos").select("*").order("nome"),
        supabase.from("funcionalidades").select("*").order("nome"),
      ]);
      if (sw.data) setSoftwares(sw.data);
      if (mod.data) setModulos(mod.data);
      if (func.data) setFuncionalidades(func.data);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const filteredModulos = modulos.filter((m) =>
    selectedSoftware ? m.software_id === selectedSoftware : true
  );
  const filteredFunc = funcionalidades.filter((f) =>
    selectedModulo ? f.modulo_id === selectedModulo : selectedSoftware ? filteredModulos.some((m) => m.id === f.modulo_id) : true
  );

  const handleSave = async () => {
    if (dialogType === "software") {
      const { error } = await supabase.from("softwares").insert({ nome: form.nome, descricao: form.descricao, empresa_desenvolvedora: form.empresa_desenvolvedora });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Software adicionado!" });
    } else if (dialogType === "modulo") {
      const { error } = await supabase.from("modulos").insert({ nome: form.nome, descricao: form.descricao, software_id: form.software_id });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Módulo adicionado!" });
    } else if (dialogType === "funcionalidade") {
      const { error } = await supabase.from("funcionalidades").insert({ nome: form.nome, descricao: form.descricao, modulo_id: form.modulo_id, horas_media_estimadas: Number(form.horas) || 0 });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Funcionalidade adicionada!" });
    }
    setDialogType(null);
    setForm({});
    // Refresh
    const [sw, mod, func] = await Promise.all([
      supabase.from("softwares").select("*").order("nome"),
      supabase.from("modulos").select("*").order("nome"),
      supabase.from("funcionalidades").select("*").order("nome"),
    ]);
    if (sw.data) setSoftwares(sw.data);
    if (mod.data) setModulos(mod.data);
    if (func.data) setFuncionalidades(func.data);
  };

  if (loading) return <div className="py-16"><LoadingState /></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catálogo ERP"
        description="Softwares, módulos e funcionalidades disponíveis na plataforma"
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setDialogType("software"); setForm({}); }}>
              <Plus size={14} /> Software
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setDialogType("modulo"); setForm({ software_id: selectedSoftware || "" }); }}>
              <Plus size={14} /> Módulo
            </Button>
            <Button size="sm" onClick={() => { setDialogType("funcionalidade"); setForm({ modulo_id: selectedModulo || "" }); }}>
              <Plus size={14} /> Funcionalidade
            </Button>
          </div>
        }
      />

      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => { setSelectedSoftware(null); setSelectedModulo(null); }}
          className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
            !selectedSoftware ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Todos os softwares
        </button>
        {selectedSoftware && (
          <>
            <ChevronRight size={14} className="text-muted-foreground" />
            <button
              onClick={() => setSelectedModulo(null)}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                !selectedModulo ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {softwares.find((s) => s.id === selectedSoftware)?.nome}
            </button>
          </>
        )}
        {selectedModulo && (
          <>
            <ChevronRight size={14} className="text-muted-foreground" />
            <span className="text-sm font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground">
              {modulos.find((m) => m.id === selectedModulo)?.nome}
            </span>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Softwares */}
        <DataCard noPadding>
          <div className="p-5 pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Server size={16} className="text-primary" />
              <SectionTitle>Softwares ERP</SectionTitle>
            </div>
          </div>
          <div className="divide-y divide-border/60">
            {softwares.map((sw) => (
              <button
                key={sw.id}
                onClick={() => { setSelectedSoftware(sw.id); setSelectedModulo(null); }}
                className={`w-full text-left p-4 px-5 table-row-interactive flex items-center justify-between ${
                  selectedSoftware === sw.id ? "bg-primary/5" : ""
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{sw.nome}</p>
                  <p className="text-xs text-muted-foreground">{sw.empresa_desenvolvedora || ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[11px]">
                    {modulos.filter((m) => m.software_id === sw.id).length} mód.
                  </Badge>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </div>
              </button>
            ))}
            {softwares.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhum software cadastrado</div>
            )}
          </div>
        </DataCard>

        {/* Modules */}
        <DataCard noPadding>
          <div className="p-5 pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Puzzle size={16} className="text-accent" />
              <SectionTitle>Módulos</SectionTitle>
            </div>
          </div>
          <div className="divide-y divide-border/60">
            {filteredModulos.map((mod) => (
              <button
                key={mod.id}
                onClick={() => setSelectedModulo(mod.id)}
                className={`w-full text-left p-4 px-5 table-row-interactive flex items-center justify-between ${
                  selectedModulo === mod.id ? "bg-primary/5" : ""
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{mod.nome}</p>
                  <p className="text-xs text-muted-foreground">{mod.descricao?.substring(0, 40) || ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[11px]">
                    {funcionalidades.filter((f) => f.modulo_id === mod.id).length} func.
                  </Badge>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </div>
              </button>
            ))}
            {filteredModulos.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {selectedSoftware ? "Nenhum módulo neste software" : "Selecione um software"}
              </div>
            )}
          </div>
        </DataCard>

        {/* Features */}
        <DataCard noPadding>
          <div className="p-5 pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Cog size={16} className="text-info" />
              <SectionTitle>Funcionalidades</SectionTitle>
            </div>
          </div>
          <div className="divide-y divide-border/60">
            {filteredFunc.map((f) => (
              <div key={f.id} className="p-4 px-5">
                <p className="text-sm font-medium text-foreground">{f.nome}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{f.descricao?.substring(0, 50) || ""}</span>
                  {f.horas_media_estimadas > 0 && (
                    <Badge variant="outline" className="text-[10px]">{f.horas_media_estimadas}h</Badge>
                  )}
                </div>
              </div>
            ))}
            {filteredFunc.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {selectedModulo ? "Nenhuma funcionalidade" : "Selecione um módulo"}
              </div>
            )}
          </div>
        </DataCard>
      </div>

      {/* Add Dialog */}
      <Dialog open={!!dialogType} onOpenChange={() => { setDialogType(null); setForm({}); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {dialogType === "software" ? "Novo Software" : dialogType === "modulo" ? "Novo Módulo" : "Nova Funcionalidade"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao || ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} />
            </div>
            {dialogType === "software" && (
              <div className="space-y-2">
                <Label>Empresa desenvolvedora</Label>
                <Input value={form.empresa_desenvolvedora || ""} onChange={(e) => setForm({ ...form, empresa_desenvolvedora: e.target.value })} />
              </div>
            )}
            {dialogType === "modulo" && (
              <div className="space-y-2">
                <Label>Software</Label>
                <Select value={form.software_id || ""} onValueChange={(v) => setForm({ ...form, software_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {softwares.map((sw) => (
                      <SelectItem key={sw.id} value={sw.id}>{sw.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {dialogType === "funcionalidade" && (
              <>
                <div className="space-y-2">
                  <Label>Módulo</Label>
                  <Select value={form.modulo_id || ""} onValueChange={(v) => setForm({ ...form, modulo_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {modulos.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Horas estimadas</Label>
                  <Input type="number" value={form.horas || ""} onChange={(e) => setForm({ ...form, horas: e.target.value })} />
                </div>
              </>
            )}
            <Button className="w-full" onClick={handleSave} disabled={!form.nome}>
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCatalogo;
