import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Building2, User, Loader2, Search, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { maskCNPJ, maskPhone, unmask } from "@/lib/cnpjMask";

type UserType = "consultor" | "empresa" | null;

interface CnpjData {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  endereco: string;
  segmento: string;
  telefone: string;
  email: string;
}

const Register = () => {
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [userType, setUserType] = useState<UserType>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    telefone: "",
    cnpj: "",
  });
  const [cnpjData, setCnpjData] = useState<CnpjData | null>(null);
  const [consultandoCnpj, setConsultandoCnpj] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const t = searchParams.get("type");
    if (t === "empresa" || t === "consultor") setUserType(t);
  }, [searchParams]);

  const handleConsultarCnpj = async () => {
    const cleanCnpj = unmask(formData.cnpj);
    if (cleanCnpj.length !== 14) {
      toast({ title: "CNPJ inválido", description: "Informe os 14 dígitos.", variant: "destructive" });
      return;
    }
    setConsultandoCnpj(true);
    setCnpjData(null);
    try {
      const { data, error } = await supabase.functions.invoke("consulta-cnpj", {
        body: { cnpj: cleanCnpj },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || "Erro ao consultar CNPJ");
      }
      setCnpjData(data as CnpjData);
      setFormData((prev) => ({
        ...prev,
        telefone: prev.telefone || maskPhone((data as CnpjData).telefone || ""),
        email: prev.email || (data as CnpjData).email || "",
      }));
      toast({ title: "Empresa encontrada!", description: (data as CnpjData).razao_social });
    } catch (err: any) {
      toast({ title: "Erro ao consultar CNPJ", description: err.message, variant: "destructive" });
    } finally {
      setConsultandoCnpj(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userType) return;

    if (userType === "empresa" && !cnpjData) {
      toast({ title: "Consulte o CNPJ", description: "Clique em buscar para validar o CNPJ.", variant: "destructive" });
      return;
    }
    if (!unmask(formData.telefone) || unmask(formData.telefone).length < 10) {
      toast({ title: "Telefone inválido", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const metadata: Record<string, string> = {
        nome: userType === "empresa" ? cnpjData!.razao_social : formData.name,
        tipo_usuario: userType,
        telefone: formData.telefone,
      };
      if (userType === "empresa" && cnpjData) {
        metadata.cnpj = cnpjData.cnpj;
        metadata.nome_fantasia = cnpjData.nome_fantasia;
        metadata.endereco = cnpjData.endereco;
        metadata.segmento = cnpjData.segmento;
        metadata.contato_nome = formData.name;
      }

      await signUp(formData.email, formData.password, metadata);

      // Update profile/empresa with phone & CNPJ data (trigger creates base records)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({ telefone: formData.telefone }).eq("user_id", user.id);
        if (userType === "empresa" && cnpjData) {
          await supabase.from("empresa_perfil").update({
            cnpj: cnpjData.cnpj,
            nome_fantasia: cnpjData.nome_fantasia,
            endereco: cnpjData.endereco,
            segmento: cnpjData.segmento,
          }).eq("user_id", user.id);
        }
      }

      toast({
        title: "Conta criada com sucesso!",
        description: "Verifique seu e-mail para confirmar o cadastro.",
      });
      navigate("/login");
    } catch (error: any) {
      toast({ title: "Erro ao criar conta", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="font-display font-bold text-primary-foreground text-sm">W</span>
            </div>
            <span className="font-display font-bold text-lg text-foreground">Workz</span>
          </Link>

          <h1 className="text-2xl font-display font-bold text-foreground mb-2">Criar conta</h1>
          <p className="text-muted-foreground mb-8">Escolha seu perfil e comece agora</p>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <button
              type="button"
              onClick={() => { setUserType("consultor"); setCnpjData(null); }}
              className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all ${
                userType === "consultor"
                  ? "border-primary bg-primary/5 shadow-card-hover"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <User className={`h-8 w-8 ${userType === "consultor" ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`font-medium text-sm ${userType === "consultor" ? "text-primary" : "text-foreground"}`}>
                Consultor
              </span>
              <span className="text-xs text-muted-foreground text-center">Quero encontrar projetos</span>
            </button>
            <button
              type="button"
              onClick={() => setUserType("empresa")}
              className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all ${
                userType === "empresa"
                  ? "border-primary bg-primary/5 shadow-card-hover"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <Building2 className={`h-8 w-8 ${userType === "empresa" ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`font-medium text-sm ${userType === "empresa" ? "text-primary" : "text-foreground"}`}>
                Empresa
              </span>
              <span className="text-xs text-muted-foreground text-center">Quero publicar projetos</span>
            </button>
          </div>

          {userType && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {userType === "empresa" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ <span className="text-destructive">*</span></Label>
                    <div className="flex gap-2">
                      <Input
                        id="cnpj"
                        placeholder="00.000.000/0000-00"
                        value={formData.cnpj}
                        onChange={(e) => { setFormData({ ...formData, cnpj: maskCNPJ(e.target.value) }); setCnpjData(null); }}
                        required
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleConsultarCnpj}
                        disabled={consultandoCnpj || unmask(formData.cnpj).length !== 14}
                      >
                        {consultandoCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {cnpjData && (
                    <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm space-y-1">
                      <p className="font-semibold text-foreground">{cnpjData.razao_social}</p>
                      {cnpjData.nome_fantasia && <p className="text-muted-foreground">{cnpjData.nome_fantasia}</p>}
                      {cnpjData.endereco && <p className="text-xs text-muted-foreground">{cnpjData.endereco}</p>}
                    </div>
                  )}
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">
                  {userType === "empresa" ? "Nome do responsável" : "Nome completo"} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder={userType === "empresa" ? "Seu nome" : "Seu nome"}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail <span className="text-destructive">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone <span className="text-destructive">*</span></Label>
                <Input
                  id="telefone"
                  placeholder="(00) 00000-0000"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: maskPhone(e.target.value) })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? "Criando conta..." : "Criar conta"}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground mt-6">
            Já tem conta?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-hero items-center justify-center p-12">
        <div className="max-w-md text-center">
          <h2 className="text-3xl font-display font-bold text-primary-foreground mb-4">
            Junte-se ao maior marketplace de ERP
          </h2>
          <p className="text-primary-foreground/60">
            Milhares de empresas e consultores já confiam na Workz.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
