import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Building2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type UserType = "consultor" | "empresa" | null;

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [userType, setUserType] = useState<UserType>(null);
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userType) return;

    setIsLoading(true);
    try {
      await signUp(formData.email, formData.password, {
        nome: formData.name,
        tipo_usuario: userType,
      });
      toast({
        title: "Conta criada com sucesso!",
        description: "Verifique seu e-mail para confirmar o cadastro.",
      });
      navigate("/login");
    } catch (error: any) {
      toast({
        title: "Erro ao criar conta",
        description: error.message,
        variant: "destructive",
      });
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
              onClick={() => setUserType("consultor")}
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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">{userType === "empresa" ? "Razão Social" : "Nome completo"}</Label>
              <Input
                id="name"
                placeholder={userType === "empresa" ? "Nome da empresa" : "Seu nome"}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
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
              <Label htmlFor="password">Senha</Label>
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

            <Button type="submit" className="w-full" size="lg" disabled={!userType || isLoading}>
              {isLoading ? "Criando conta..." : "Criar conta"}
            </Button>
          </form>

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
