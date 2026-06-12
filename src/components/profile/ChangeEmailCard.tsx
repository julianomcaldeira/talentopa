import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DataCard, SectionTitle } from "@/components/dashboard/DashboardComponents";
import { Mail } from "lucide-react";

const ChangeEmailCard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  const handleChange = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "E-mail inválido", description: "Informe um e-mail válido.", variant: "destructive" });
      return;
    }
    if (email === user?.email) {
      toast({ title: "Mesmo e-mail", description: "Informe um e-mail diferente do atual.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { email },
        { emailRedirectTo: `${window.location.origin}/` }
      );
      if (error) throw error;
      toast({
        title: "Confirmação enviada",
        description: "Verifique a caixa de entrada do novo e-mail para concluir a alteração.",
      });
      setNewEmail("");
    } catch (err: any) {
      toast({ title: "Erro ao alterar e-mail", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DataCard>
      <div className="flex items-center gap-2 mb-4">
        <Mail size={16} className="text-muted-foreground" />
        <SectionTitle>Alterar E-mail de Login</SectionTitle>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">E-mail atual</Label>
          <Input value={user?.email || ""} disabled />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Novo e-mail</Label>
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="novo@email.com"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Um link de confirmação será enviado ao novo endereço. A alteração só será concluída após a confirmação.
      </p>
      <div className="flex justify-end mt-5">
        <Button onClick={handleChange} disabled={saving || !newEmail} variant="outline">
          {saving ? "Enviando..." : "Solicitar alteração"}
        </Button>
      </div>
    </DataCard>
  );
};

export default ChangeEmailCard;
