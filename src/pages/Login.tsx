import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Building2, UserCheck, ShieldCheck, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const demoAccounts = [
  {
    label: "Empresa",
    description: "ABC Indústria — 3 projetos ativos, propostas para avaliar, matching de consultores",
    email: "contato@abcltda.com.br",
    password: "Teste123@",
    icon: Building2,
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  },
  {
    label: "Consultor",
    description: "João Silva — Especialista SAP, propostas enviadas, score de compatibilidade",
    email: "joao.silva@teste.com",
    password: "Teste123@",
    icon: UserCheck,
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  },
  {
    label: "Admin",
    description: "Painel completo — gestão de projetos, consultores, empresas e inteligência",
    email: "juliano@startgi.com.br",
    password: "Teste123@",
    icon: ShieldCheck,
    color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  },
];

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signIn(email, password);
      toast({ title: "Login realizado com sucesso!" });
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Erro ao fazer login",
        description: error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos"
          : error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async (account: typeof demoAccounts[0]) => {
    setDemoLoading(account.email);
    try {
      await signIn(account.email, account.password);
      toast({ title: `Logado como ${account.label}`, description: `Bem-vindo ao modo demonstração` });
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Erro no login demo",
        description: error.message === "Invalid login credentials"
          ? "Usuário de demo não encontrado. Verifique se os dados de teste foram criados."
          : error.message,
        variant: "destructive",
      });
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="font-display font-bold text-primary-foreground text-sm">TO</span>
            </div>
            <span className="font-display font-bold text-lg text-foreground">TalentOps</span>
          </Link>

          <h1 className="text-2xl font-display font-bold text-foreground mb-2">Bem-vindo de volta</h1>
          <p className="text-muted-foreground mb-8">Entre na sua conta para continuar</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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
              {isLoading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Não tem conta?{" "}
            <Link to="/register" className="text-primary font-medium hover:underline">
              Cadastre-se
            </Link>
          </p>

          {/* Demo Accounts Section */}
          <div className="mt-10 pt-8 border-t border-border/60">
            <div className="flex items-center gap-2 mb-4">
              <Play size={14} className="text-primary" />
              <h3 className="font-display font-semibold text-sm text-foreground">Modo Demonstração</h3>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">DEMO</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Acesse com um perfil de demonstração para explorar o sistema completo
            </p>
            <div className="space-y-2.5">
              {demoAccounts.map((account) => {
                const Icon = account.icon;
                return (
                  <button
                    key={account.email}
                    onClick={() => handleDemoLogin(account)}
                    disabled={!!demoLoading}
                    className={`w-full flex items-start gap-3 p-3.5 rounded-xl border transition-all hover:shadow-sm hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 ${account.color}`}
                  >
                    <div className="mt-0.5">
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-semibold text-sm">{account.label}</span>
                        {demoLoading === account.email && (
                          <span className="text-[10px] animate-pulse">Entrando...</span>
                        )}
                      </div>
                      <p className="text-[11px] opacity-70 mt-0.5 leading-relaxed">{account.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-hero items-center justify-center p-12">
        <div className="max-w-md text-center">
          <h2 className="text-3xl font-display font-bold text-primary-foreground mb-4">
            Conecte-se aos melhores projetos ERP
          </h2>
          <p className="text-primary-foreground/60">
            Acesse projetos de implementação TOTVS, SAP, Oracle e muito mais.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
