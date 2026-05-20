import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FolderKanban, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface Projeto {
  id: string;
  nome: string;
  status: string;
  valor_estimado: number | null;
  prazo_estimado: string | null;
  created_at: string;
}

interface EmpresaOption {
  user_id: string;
  nome: string;
}

interface ConsultorOption {
  user_id: string;
  nome: string;
}

const CanalProjetos = () => {
  const { user } = useAuth();
  const [canalId, setCanalId] = useState<string | null>(null);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [consultores, setConsultores] = useState<ConsultorOption[]>([]);

  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    empresa_user_id: "",
    consultor_user_id: "",
    valor: "",
    prazo: "",
  });

  const loadProjetos = async (cid: string) => {
    const { data } = await supabase
      .from("projetos")
      .select("id, nome, status, valor_estimado, prazo_estimado, created_at")
      .eq("canal_id", cid)
      .order("created_at", { ascending: false });
    setProjetos((data as any) || []);
  };

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: canalRow } = await supabase
        .from("canais")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!canalRow) {
        setLoading(false);
        return;
      }
      setCanalId(canalRow.id);
      await loadProjetos(canalRow.id);
      setLoading(false);
    })();
  }, [user?.id]);

  const loadFormOptions = async () => {
    if (!canalId) return;
    // Empresas: lista todas as empresas (perfis públicos para autenticados)
    const { data: emps } = await supabase
      .from("empresa_perfil")
      .select("user_id, nome_fantasia, razao_social")
      .order("razao_social", { ascending: true });
    setEmpresas(
      ((emps as any[]) || []).map((e) => ({
        user_id: e.user_id,
        nome: e.nome_fantasia || e.razao_social,
      }))
    );

    // Consultores vinculados ao canal (ativos)
    const { data: links } = await supabase
      .from("canal_consultores")
      .select("consultor_user_id")
      .eq("canal_id", canalId)
      .eq("status", "ativo");
    const ids = ((links as any[]) || []).map((l) => l.consultor_user_id);
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", ids);
      setConsultores(((profs as any[]) || []).map((p) => ({ user_id: p.user_id, nome: p.nome })));
    } else {
      setConsultores([]);
    }
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) loadFormOptions();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canalId || !user) return;
    if (!form.nome || !form.empresa_user_id || !form.consultor_user_id) {
      toast({ title: "Preencha nome, empresa e consultor", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const valorNum = form.valor ? Number(form.valor.replace(/\./g, "").replace(",", ".")) : null;

      const { data: projeto, error: pErr } = await supabase
        .from("projetos")
        .insert({
          nome: form.nome,
          descricao: form.descricao || null,
          empresa_user_id: form.empresa_user_id,
          canal_id: canalId,
          criado_por_tipo: "canal",
          valor_estimado: valorNum,
          prazo_estimado: form.prazo || null,
          status: "rascunho",
        })
        .select("id")
        .single();
      if (pErr) throw pErr;

      // Cria alocação proposta pelo canal (já pré-aprovada pelo próprio canal)
      const { error: aErr } = await supabase.from("alocacoes").insert({
        projeto_id: projeto.id,
        canal_id: canalId,
        consultor_user_id: form.consultor_user_id,
        valor: valorNum,
        prazo_estimado: form.prazo || null,
        solicitado_por: user.id,
        status: "aprovada",
        aprovado_por: user.id,
        data_aprovacao: new Date().toISOString(),
      });
      if (aErr) throw aErr;

      toast({ title: "Projeto criado com sucesso" });
      setForm({ nome: "", descricao: "", empresa_user_id: "", consultor_user_id: "", valor: "", prazo: "" });
      setOpen(false);
      await loadProjetos(canalId);
    } catch (err: any) {
      toast({ title: "Erro ao criar projeto", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Projetos do canal</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Projetos criados pelo seu canal, com valor e status.
          </p>
        </div>

        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button disabled={!canalId}>
              <Plus className="h-4 w-4 mr-2" />
              Novo projeto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Criar projeto</DialogTitle>
              <DialogDescription>
                Vincule uma empresa e um consultor do seu canal ao novo projeto.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do projeto *</Label>
                <Input
                  id="nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  required
                  maxLength={120}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  rows={3}
                  maxLength={1000}
                />
              </div>

              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Select
                  value={form.empresa_user_id}
                  onValueChange={(v) => setForm({ ...form, empresa_user_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhuma empresa</div>
                    ) : (
                      empresas.map((e) => (
                        <SelectItem key={e.user_id} value={e.user_id}>
                          {e.nome}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Consultor *</Label>
                <Select
                  value={form.consultor_user_id}
                  onValueChange={(v) => setForm({ ...form, consultor_user_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o consultor" />
                  </SelectTrigger>
                  <SelectContent>
                    {consultores.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Nenhum consultor ativo no canal
                      </div>
                    ) : (
                      consultores.map((c) => (
                        <SelectItem key={c.user_id} value={c.user_id}>
                          {c.nome}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="valor">Valor (R$)</Label>
                  <Input
                    id="valor"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={form.valor}
                    onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prazo">Prazo estimado</Label>
                  <Input
                    id="prazo"
                    type="date"
                    value={form.prazo}
                    onChange={(e) => setForm({ ...form, prazo: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar projeto
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : projetos.length === 0 ? (
        <Card className="p-10 text-center">
          <FolderKanban className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium text-foreground">Nenhum projeto ainda</p>
          <p className="text-sm text-muted-foreground mt-1">
            Clique em "Novo projeto" para criar o primeiro.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {projetos.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{p.nome}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {p.prazo_estimado
                    ? `Prazo: ${new Date(p.prazo_estimado).toLocaleDateString("pt-BR")}`
                    : "Sem prazo"}{" "}
                  ·{" "}
                  {p.valor_estimado
                    ? `R$ ${Number(p.valor_estimado).toLocaleString("pt-BR")}`
                    : "Sem valor"}
                </p>
              </div>
              <Badge variant="outline" className="capitalize">
                {p.status?.replace(/_/g, " ")}
              </Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};

export default CanalProjetos;
