import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DataCard, SectionTitle } from "@/components/dashboard/DashboardComponents";
import { Lock, Eye, EyeOff } from "lucide-react";

const ChangePasswordCard = () => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });

  const handleChangePassword = async () => {
    if (form.newPassword.length < 6) {
      toast({ title: "Senha muito curta", description: "A senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      toast({ title: "Senhas não conferem", description: "A nova senha e a confirmação devem ser iguais", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: form.newPassword });
      if (error) throw error;
      toast({ title: "Senha alterada com sucesso!" });
      setForm({ newPassword: "", confirmPassword: "" });
    } catch (error: any) {
      toast({ title: "Erro ao alterar senha", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DataCard>
      <div className="flex items-center gap-2 mb-4">
        <Lock size={16} className="text-muted-foreground" />
        <SectionTitle>Alterar Senha</SectionTitle>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nova senha</Label>
          <div className="relative">
            <Input
              type={showNew ? "text" : "password"}
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              placeholder="••••••••"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              onClick={() => setShowNew(!showNew)}
            >
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirmar nova senha</Label>
          <div className="relative">
            <Input
              type={showConfirm ? "text" : "password"}
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              placeholder="••••••••"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              onClick={() => setShowConfirm(!showConfirm)}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-5">
        <Button
          onClick={handleChangePassword}
          disabled={saving || !form.newPassword || !form.confirmPassword}
          variant="outline"
        >
          {saving ? "Salvando..." : "Alterar senha"}
        </Button>
      </div>
    </DataCard>
  );
};

export default ChangePasswordCard;
