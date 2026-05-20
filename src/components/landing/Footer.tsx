import { Link } from "react-router-dom";
import workzLogo from "@/assets/workz-logo-transparent.png";

const Footer = () => {
  return (
    <footer className="bg-muted/40 py-10 border-t border-border relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="mb-4">
              <img src={workzLogo} alt="Workz" className="h-8 w-auto" />
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Marketplace de consultoria ERP. Conectamos empresas aos melhores consultores do mercado.
            </p>
          </div>
          <div>
            <h4 className="font-display font-semibold text-foreground mb-4 text-sm">Plataforma</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground transition-colors">Funcionalidades</a></li>
              <li><a href="#how-it-works" className="hover:text-foreground transition-colors">Como funciona</a></li>
              <li><a href="#pricing" className="hover:text-foreground transition-colors">Planos</a></li>
              <li><Link to="/login" className="hover:text-foreground transition-colors">Entrar</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-semibold text-foreground mb-4 text-sm">Para Consultores</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><Link to="/register?type=consultor" className="hover:text-foreground transition-colors">Cadastrar como consultor</Link></li>
              <li><a href="#pricing" className="hover:text-foreground transition-colors">Planos do consultor</a></li>
              <li><a href="#how-it-works" className="hover:text-foreground transition-colors">Como receber projetos</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-semibold text-foreground mb-4 text-sm">Para Empresas</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><Link to="/register?type=empresa" className="hover:text-foreground transition-colors">Publicar projeto</Link></li>
              <li><a href="#features" className="hover:text-foreground transition-colors">Gestão de projetos</a></li>
              <li><a href="#how-it-works" className="hover:text-foreground transition-colors">Como contratar</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
          © 2026 Workz. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
