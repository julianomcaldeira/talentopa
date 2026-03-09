import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft size={16} /> Voltar ao login
        </Link>

        {!sent ? (
          <>
            <h1 className="text-2xl font-display font-bold text-foreground mb-2">Recuperar senha</h1>
            <p className="text-muted-foreground mb-8">
              Informe seu e-mail e enviaremos instruções para redefinir sua senha.
            </p>

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
              <Button type="submit" className="w-full" size="lg">
                Enviar instruções
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground mb-2">Verifique seu e-mail</h1>
            <p className="text-muted-foreground mb-6">
              Enviamos instruções para <strong className="text-foreground">{email}</strong>
            </p>
            <Button variant="outline" asChild>
              <Link to="/login">Voltar ao login</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
