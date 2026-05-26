import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  PageHeader, DataCard, EmptyState, LoadingState, SectionTitle,
} from "@/components/dashboard/DashboardComponents";
import { ShieldCheck, UserPlus, Mail, Phone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface AdminRow {
  user_id: string;
  nome: string;
  email: string;
  telefone: string | null;
  avatar_url: string | null;
  created_at: string;
}

const AdminUsuarios = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", password: "" });

  const load = async () => {
    setLoading(true);
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    const ids = (roles || []).map((r) => r.user_id);
    if (ids.length === 0) {
      setAdmins([]);
      setLoading(false);
      return;
    }
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nome, email, telefone, avatar_url, created_at")
      .in("user_id", ids)
      .order("created_at", { ascending: false });
    setAdmins((profiles || []) as AdminRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const criarAdmin = async () => {
    if (!form.email || !form.password || !form.nome) {
      toast({ title: "Preencha nome, e-mail e senha", variant: "destructive" });
      return;
    }
    if (form.password.length < 6) {
      toast({ title: "Senha muito curta", description: "Mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: form.email,
          password: form.password,
          nome: form.nome,
          tipo_usuario: "admin",
          extra: { telefone: form.telefone || null },
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Admin criado com sucesso" });
      setOpen(false);
      setForm({ nome: "", email: "", telefone: "", password: "" });
      load();
    } catch (e: any) {
      toast({ title: "Erro ao criar admin", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Administradores"
        description="Gerencie e crie novos usuários administradores centrais."
        action={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <UserPlus size={16} /> Novo admin
          </Button>
        }
      />

      <DataCard noPadding>
        {loading ? (
          <div className="p-6"><LoadingState /></div>
        ) : admins.length === 0 ? (
          <EmptyState message="Nenhum administrador encontrado." icon={ShieldCheck} />
        ) : (
          <div className="divide-y divide-border">
            {admins.map((a) => {
              const initials = (a.nome || a.email || "U").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
              const isYou = a.user_id === user?.id;
              return (
                <div key={a.user_id} className="flex items-center gap-4 p-5">
                  <div className="w-11 h-11 rounded-xl overflow-hidden bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center text-primary-foreground font-display font-bold text-sm shadow">
                    {a.avatar_url ? (
                      <img src={a.avatar_url} alt={a.nome} className="w-full h-full object-cover" />
                    ) : initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">{a.nome}</p>
                      {isYou && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold uppercase">Você</span>}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><Mail size={12} />{a.email}</span>
                      {a.telefone && <span className="flex items-center gap-1"><Phone size={12} />{a.telefone}</span>}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Desde {new Date(a.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </DataCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo administrador central</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Telefone (opcional)</Label>
              <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Senha inicial</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <p className="text-[11px] text-muted-foreground">Mínimo 6 caracteres. O novo admin pode alterar em "Meu perfil".</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={criarAdmin} disabled={saving}>{saving ? "Criando..." : "Criar admin"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsuarios;
